/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package com.alibaba.himarket.service.hichat.service;

import com.alibaba.himarket.core.event.ChatSessionDeletingEvent;
import com.alibaba.himarket.core.exception.BusinessException;
import com.alibaba.himarket.core.exception.ErrorCode;
import com.alibaba.himarket.core.security.ContextHolder;
import com.alibaba.himarket.core.utils.IdGenerator;
import com.alibaba.himarket.dto.params.chat.CreateChatParam;
import com.alibaba.himarket.dto.result.chat.LlmInvokeResult;
import com.alibaba.himarket.dto.result.consumer.CredentialContext;
import com.alibaba.himarket.dto.result.model.ModelConfigResult;
import com.alibaba.himarket.dto.result.product.ProductRefResult;
import com.alibaba.himarket.dto.result.product.ProductResult;
import com.alibaba.himarket.dto.result.product.SubscriptionResult;
import com.alibaba.himarket.entity.Chat;
import com.alibaba.himarket.entity.ChatAttachment;
import com.alibaba.himarket.entity.ChatSession;
import com.alibaba.himarket.repository.ChatAttachmentRepository;
import com.alibaba.himarket.repository.ChatRepository;
import com.alibaba.himarket.service.ChatSessionService;
import com.alibaba.himarket.service.ConsumerService;
import com.alibaba.himarket.service.ProductService;
import com.alibaba.himarket.service.hichat.memory.ChatMemoryAgentStateStore;
import com.alibaba.himarket.service.hichat.support.ChatEvent;
import com.alibaba.himarket.service.hichat.support.InvokeModelParam;
import com.alibaba.himarket.support.chat.attachment.ChatAttachmentConfig;
import com.alibaba.himarket.support.chat.mcp.McpTransportConfig;
import com.alibaba.himarket.support.common.Strings;
import com.alibaba.himarket.support.enums.ChatAttachmentType;
import com.alibaba.himarket.support.enums.ChatStatus;
import com.alibaba.himarket.support.enums.ProductType;
import io.agentscope.core.message.AudioBlock;
import io.agentscope.core.message.Base64Source;
import io.agentscope.core.message.ContentBlock;
import io.agentscope.core.message.ImageBlock;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.VideoBlock;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import reactor.core.publisher.Flux;

@Service
@Slf4j
@RequiredArgsConstructor
public class ChatService {

    private final ChatSessionService sessionService;

    private final List<LlmService> llmServices;

    private final ChatRepository chatRepository;

    private final ChatAttachmentRepository chatAttachmentRepository;

    private final ContextHolder contextHolder;

    private final ProductService productService;

    private final ConsumerService consumerService;

    private final ChatMemoryAgentStateStore chatMemoryAgentStateStore;

    public Flux<ChatEvent> chat(CreateChatParam param) {
        performAllChecks(param);

        Chat chat = createChat(param);
        InvokeModelParam invokeModelParam = buildInvokeModelParam(param, chat);

        return getLlmService(invokeModelParam)
                .invokeLlm(invokeModelParam, r -> updateChatResult(chat.getChatId(), r));
    }

    private void updateChatResult(String chatId, LlmInvokeResult result) {
        chatRepository
                .findByChatId(chatId)
                .ifPresent(
                        chat -> {
                            chat.setAnswer(result.getAnswer());
                            chat.setStatus(
                                    result.isSuccess() ? ChatStatus.SUCCESS : ChatStatus.FAILED);
                            chat.setChatUsage(result.getUsage());
                            chat.setMessageChunks(result.getMessageChunks());
                            chatRepository.save(chat);
                        });
    }

    private void performAllChecks(CreateChatParam param) {
        ChatSession session = sessionService.findUserSession(param.getSessionId());

        if (!session.getProducts().contains(param.getProductId())) {
            throw new BusinessException(
                    ErrorCode.INVALID_REQUEST,
                    String.format("Product `%s` not in current session", param.getProductId()));
        }

        if (!CollectionUtils.isEmpty(param.getMcpProducts())) {
            Set<String> subscribedProductIds =
                    consumerService
                            .listConsumerSubscriptions(
                                    consumerService.getPrimaryConsumer().getConsumerId())
                            .stream()
                            .map(SubscriptionResult::getProductId)
                            .collect(Collectors.toSet());

            Set<String> unsubscribedProducts =
                    param.getMcpProducts().stream()
                            .filter(productId -> !subscribedProductIds.contains(productId))
                            .collect(Collectors.toSet());

            if (!unsubscribedProducts.isEmpty()) {
                log.warn(
                        "MCP products are not subscribed, which may cause unauthorized access,"
                                + " productIds={}",
                        unsubscribedProducts);
            }
        }

        validateAttachments(param);
    }

    public Chat createChat(CreateChatParam param) {
        String chatId = IdGenerator.genChatId();
        Chat chat = param.convertTo();
        chat.setChatId(chatId);
        chat.setUserId(contextHolder.getUser());

        // Sequence represent the number of tries for this question
        Integer sequence =
                chatRepository.findCurrentSequence(
                        param.getSessionId(),
                        param.getConversationId(),
                        param.getQuestionId(),
                        param.getProductId());
        chat.setSequence(sequence + 1);

        return chatRepository.save(chat);
    }

    private InvokeModelParam buildInvokeModelParam(CreateChatParam param, Chat chat) {
        // Get product config
        ProductResult productResult = productService.getProduct(param.getProductId());

        // Record target gateway
        ProductRefResult productRef = productService.getProductRef(param.getProductId());
        String gatewayId = productRef.getGatewayId();

        // Get authentication info
        CredentialContext credentialContext =
                consumerService.getDefaultCredential(contextHolder.getUser());

        // Build user msg and history msg list which will be passed to model
        String userId = contextHolder.getUser();
        boolean rebuildMemory = chat.getSequence() != null && chat.getSequence() > 1;
        List<Msg> historyMsgList =
                !rebuildMemory
                                && chatMemoryAgentStateStore.hasAgentState(
                                        userId, param.getSessionId())
                        ? Collections.emptyList()
                        : buildHistoryMsgList(param);
        Msg currentMsg = buildUserMsg(chat);

        return InvokeModelParam.builder()
                .chatId(chat.getChatId())
                .sessionId(param.getSessionId())
                .userId(userId)
                .userMessage(currentMsg)
                .product(productResult)
                .historyMessages(historyMsgList)
                .enableWebSearch(param.isEnableWebSearch())
                .enableThinking(param.isEnableThinking())
                .rebuildMemory(rebuildMemory)
                .gatewayId(gatewayId)
                .mcpConfigs(buildMCPConfigs(param, credentialContext))
                .credentialContext(credentialContext)
                .build();
    }

    public List<Msg> buildHistoryMsgList(CreateChatParam param) {
        List<Msg> messages = new ArrayList<>();

        // 1. Query successful chat records from database
        List<Chat> chats =
                chatRepository.findBySessionIdAndStatus(
                        param.getSessionId(),
                        ChatStatus.SUCCESS,
                        Sort.by(Sort.Direction.ASC, "createAt"));

        if (CollectionUtils.isEmpty(chats)) {
            return Collections.emptyList();
        }

        // 2. Filter valid history chats and keep the latest answer for each question.
        Map<String, Chat> latestChatMap = new LinkedHashMap<>();
        chats.stream()
                .filter(
                        chat ->
                                Strings.isNotBlank(chat.getQuestionId())
                                        && Strings.isNotBlank(chat.getQuestion())
                                        && Strings.isNotBlank(chat.getAnswer()))
                // Exclude current question so retry/regenerate does not use its previous answer.
                .filter(chat -> !Strings.equals(param.getQuestionId(), chat.getQuestionId()))
                // Ensure same product
                .filter(chat -> Strings.equals(chat.getProductId(), param.getProductId()))
                .forEach(chat -> latestChatMap.put(chat.getQuestionId(), chat));

        // 3. Preserve chronological order for AgentScope memory rebuild.
        List<Chat> latestChats =
                latestChatMap.values().stream()
                        .sorted(Comparator.comparing(Chat::getCreateAt))
                        .toList();

        // 4. Build AgentScope Msg objects (user + assistant pairs)
        for (Chat chat : latestChats) {
            // User message (with multimodal support)
            Msg userMsg = buildUserMsg(chat);
            messages.add(userMsg);

            // Assistant message
            Msg assistantMsg = buildAssistantMsg(chat);
            messages.add(assistantMsg);
        }

        // 5. Truncate if too many messages
        messages = truncateMessages(messages);

        log.debug(
                "Built AgentScope messages, messageCount={}, historyQuestionCount={}, sessionId={}",
                messages.size(),
                latestChats.size(),
                param.getSessionId());
        return messages;
    }

    private Msg buildUserMsg(Chat chat) {
        List<ContentBlock> contentBlocks = new ArrayList<>();

        // 1. Prepare text content (question)
        StringBuilder textContent = new StringBuilder();
        if (Strings.isNotBlank(chat.getQuestion())) {
            textContent.append(chat.getQuestion());
        }

        // 2. Load and process attachments
        List<String> attachmentIds = getAttachmentIds(chat.getAttachments());
        if (!attachmentIds.isEmpty()) {
            Map<String, ChatAttachment> attachments =
                    chatAttachmentRepository
                            .findByAttachmentIdInAndUserId(attachmentIds, chat.getUserId())
                            .stream()
                            .collect(
                                    Collectors.toMap(
                                            ChatAttachment::getAttachmentId,
                                            attachment -> attachment));

            for (String attachmentId : attachmentIds) {
                ChatAttachment attachment = attachments.get(attachmentId);
                if (attachment == null
                        || attachment.getData() == null
                        || attachment.getData().length == 0) {
                    continue;
                }

                if (attachment.getType() == ChatAttachmentType.TEXT) {
                    buildTextContent(attachment, textContent);
                } else {
                    buildMediaContent(attachment, contentBlocks);
                }
            }
        }

        // 3. Build content blocks
        // Always add text content first (using correct AgentScope API)
        if (!textContent.isEmpty()) {
            contentBlocks.add(0, TextBlock.builder().text(textContent.toString()).build());
        }

        // 4. Create Msg object with proper content format
        // If no content blocks, use textContent() convenience method for empty string
        if (contentBlocks.isEmpty()) {
            return Msg.builder().role(MsgRole.USER).textContent("").build();
        } else {
            return Msg.builder().role(MsgRole.USER).content(contentBlocks).build();
        }
    }

    private void validateAttachments(CreateChatParam param) {
        List<String> attachmentIds = getAttachmentIds(param.getAttachments());
        if (attachmentIds.isEmpty()) {
            return;
        }

        Map<String, ChatAttachment> attachments =
                chatAttachmentRepository
                        .findByAttachmentIdInAndUserId(attachmentIds, contextHolder.getUser())
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        ChatAttachment::getAttachmentId, attachment -> attachment));
        for (String attachmentId : attachmentIds) {
            if (!attachments.containsKey(attachmentId)) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Chat attachment", attachmentId);
            }
        }
    }

    private List<String> getAttachmentIds(List<ChatAttachmentConfig> attachments) {
        if (CollectionUtils.isEmpty(attachments)) {
            return Collections.emptyList();
        }
        return attachments.stream()
                .map(ChatAttachmentConfig::getAttachmentId)
                .filter(Strings::isNotBlank)
                .distinct()
                .toList();
    }

    private void buildTextContent(ChatAttachment attachment, StringBuilder textContent) {
        String text = new String(attachment.getData(), StandardCharsets.UTF_8);
        textContent.append("\n\n## ").append(attachment.getName()).append("\n").append(text);
    }

    private void buildMediaContent(ChatAttachment attachment, List<ContentBlock> contentBlocks) {

        // Encode to pure Base64 string (no data URL prefix)
        String base64Data = Base64.getEncoder().encodeToString(attachment.getData());

        // Use default mime type if not specified
        String mediaType =
                Strings.isBlank(attachment.getMimeType())
                        ? "application/octet-stream"
                        : attachment.getMimeType();

        // Create Base64Source with pure base64 data
        Base64Source source = Base64Source.builder().data(base64Data).mediaType(mediaType).build();

        ContentBlock contentBlock;
        switch (attachment.getType()) {
            case IMAGE:
                contentBlock = ImageBlock.builder().source(source).build();
                break;
            case AUDIO:
                contentBlock = AudioBlock.builder().source(source).build();
                break;
            case VIDEO:
                contentBlock = VideoBlock.builder().source(source).build();
                break;
            default:
                log.warn(
                        "Unsupported media attachment type, attachmentType={}",
                        attachment.getType());
                return;
        }

        contentBlocks.add(contentBlock);
    }

    private Msg buildAssistantMsg(Chat chat) {
        String answer = Strings.isBlank(chat.getAnswer()) ? "" : chat.getAnswer();
        // Use textContent() convenience method for simple text messages
        return Msg.builder().role(MsgRole.ASSISTANT).textContent(answer).build();
    }

    private List<Msg> truncateMessages(List<Msg> messages) {
        // Max conversation pairs to keep
        int maxHistoryPairs = 10;
        int maxMessages = maxHistoryPairs * 2;

        if (messages.size() > maxMessages) {
            int startIndex = messages.size() - maxMessages;
            List<Msg> truncated = messages.subList(startIndex, messages.size());
            log.debug("Truncated history, maxConversationPairs={}", maxHistoryPairs);
            return truncated;
        }

        return messages;
    }

    private List<McpTransportConfig> buildMCPConfigs(
            CreateChatParam param, CredentialContext credentialContext) {
        if (CollectionUtils.isEmpty(param.getMcpProducts())) {
            return Collections.emptyList();
        }

        List<McpTransportConfig> configs = new ArrayList<>();
        for (ProductResult product : productService.getProducts(param.getMcpProducts()).values()) {
            if (product.getType() != ProductType.MCP_SERVER || product.getMcpConfig() == null) {
                continue;
            }

            McpTransportConfig transportConfig = product.getMcpConfig().toTransportConfig();
            transportConfig.setHeaders(credentialContext.copyHeaders());
            transportConfig.setQueryParams(credentialContext.copyQueryParams());
            configs.add(transportConfig);
        }
        return configs;
    }

    private LlmService getLlmService(InvokeModelParam param) {
        ModelConfigResult.ModelAPIConfig modelAPIConfig =
                param.getProduct().getModelConfig().getModelAPIConfig();

        return llmServices.stream()
                .filter(service -> service.match(modelAPIConfig))
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "No supported LLM service found for model category: "
                                                + modelAPIConfig.getModelCategory()
                                                + ", protocols: "
                                                + modelAPIConfig.getAiProtocols()));
    }

    /**
     * Handle session deletion event - cleanup all related chat records
     *
     * @param event session deletion event
     */
    @EventListener
    @Async("taskExecutor")
    @Transactional
    public void onSessionDeletion(ChatSessionDeletingEvent event) {
        String sessionId = event.getSessionId();

        try {
            log.info("Cleaning chat records and memory, sessionId={}", sessionId);

            chatRepository.deleteAllBySessionId(sessionId);
            chatMemoryAgentStateStore.deleteBySessionId(sessionId);

            log.info("Cleaned chat records and memory, sessionId={}", sessionId);
        } catch (Exception e) {
            log.error(
                    "Failed to cleanup chat records, sessionId={}, errorMessage={}",
                    sessionId,
                    e.getMessage(),
                    e);
        }
    }
}
