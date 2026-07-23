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

import com.alibaba.himarket.core.exception.ChatError;
import com.alibaba.himarket.dto.result.chat.ChatAttachmentResult;
import com.alibaba.himarket.dto.result.chat.LlmInvokeResult;
import com.alibaba.himarket.dto.result.httpapi.HttpRouteResult;
import com.alibaba.himarket.dto.result.model.ModelConfigResult;
import com.alibaba.himarket.service.ChatAttachmentService;
import com.alibaba.himarket.service.GatewayService;
import com.alibaba.himarket.service.hichat.manager.ChatBotManager;
import com.alibaba.himarket.service.hichat.support.ChatContext;
import com.alibaba.himarket.service.hichat.support.ChatEvent;
import com.alibaba.himarket.service.hichat.support.GeneratedImageDownloader;
import com.alibaba.himarket.service.hichat.support.InvokeModelParam;
import com.alibaba.himarket.service.hichat.support.LlmChatRequest;
import com.alibaba.himarket.support.common.Strings;
import io.agentscope.core.message.Base64Source;
import io.agentscope.core.message.ContentBlock;
import io.agentscope.core.message.ImageBlock;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.URLSource;
import io.agentscope.core.model.ChatResponse;
import java.net.URI;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.CollectionUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Slf4j
public abstract class AbstractImageLlmService extends AbstractLlmService {

    protected final ChatAttachmentService chatAttachmentService;

    private final GeneratedImageDownloader imageDownloader;

    protected AbstractImageLlmService(
            GatewayService gatewayService,
            ChatBotManager chatBotManager,
            ChatAttachmentService chatAttachmentService,
            GeneratedImageDownloader imageDownloader) {
        super(gatewayService, chatBotManager);
        this.chatAttachmentService = chatAttachmentService;
        this.imageDownloader = imageDownloader;
    }

    @Override
    public final Flux<ChatEvent> invokeLlm(
            InvokeModelParam param, Consumer<LlmInvokeResult> resultHandler) {
        ChatContext chatContext = new ChatContext(param.getChatId());

        try {
            LlmChatRequest request = composeRequest(param);
            chatContext.start();

            Flux<ChatEvent> imageEvents =
                    generateImage(request)
                            .switchIfEmpty(
                                    Mono.error(
                                            new IllegalStateException(
                                                    "Image generation returned no response")))
                            .flatMapMany(
                                    response -> convertToChatEvents(response, request, chatContext))
                            .doOnNext(chatContext::collect);

            return Flux.concat(
                            Flux.just(ChatEvent.start(param.getChatId())),
                            handleErrors(imageEvents, chatContext))
                    .concatWith(
                            Flux.defer(
                                    () -> {
                                        chatContext.stop();
                                        return Flux.just(
                                                ChatEvent.done(
                                                        param.getChatId(), chatContext.getUsage()));
                                    }))
                    .doFinally(signal -> resultHandler.accept(chatContext.toResult()));
        } catch (Exception e) {
            log.error(
                    "Failed to process image generation request, chatId={}, errorMessage={}",
                    param.getChatId(),
                    e.getMessage(),
                    e);
            ChatError chatError = ChatError.from(e);
            chatContext.fail();
            chatContext.appendAnswer(
                    String.format("[Image generation failed. Reason: %s]", e.getMessage()));
            resultHandler.accept(chatContext.toResult());

            return Flux.just(
                    ChatEvent.start(param.getChatId()),
                    ChatEvent.error(
                            param.getChatId(),
                            chatError.name(),
                            Strings.blankToDefault(e.getMessage(), chatError.getDescription())),
                    ChatEvent.done(param.getChatId(), null));
        }
    }

    protected Mono<ChatResponse> generateImage(LlmChatRequest request) {
        return newChatModel(request).stream(List.of(request.getUserMessages()), null, null)
                .next()
                .subscribeOn(Schedulers.boundedElastic());
    }

    protected URI resolveImageRoute(LlmChatRequest request, String routePath) {
        ModelConfigResult modelConfig = request.getProduct().getModelConfig();
        if (modelConfig == null
                || modelConfig.getModelAPIConfig() == null
                || CollectionUtils.isEmpty(modelConfig.getModelAPIConfig().getRoutes())
                || modelConfig.getModelAPIConfig().getRoutes().stream()
                        .map(HttpRouteResult::getMatch)
                        .filter(match -> match != null && match.getPath() != null)
                        .noneMatch(
                                match ->
                                        match.getPath().getValue() != null
                                                && match.getPath()
                                                        .getValue()
                                                        .endsWith(routePath))) {
            throw new IllegalStateException(
                    "The image model does not provide a supported generation route");
        }

        URI uri =
                buildUri(
                        modelConfig,
                        request.getGatewayUris(),
                        routePath,
                        (pathValue, pathType) -> pathValue);
        if (uri == null) {
            throw new IllegalStateException("Failed to resolve the image generation route");
        }
        return uri;
    }

    @Override
    public final String getModelCategory() {
        return "Image";
    }

    private Flux<ChatEvent> handleErrors(Flux<ChatEvent> events, ChatContext chatContext) {
        return events.doOnCancel(
                        () -> {
                            log.warn(
                                    "Image generation was canceled by client, chatId={}",
                                    chatContext.getChatId());
                            chatContext.fail();
                        })
                .onErrorResume(
                        error -> {
                            ChatError chatError = ChatError.from(error);
                            log.error(
                                    "Image generation failed, chatId={}, errorType={},"
                                            + " errorMessage={}",
                                    chatContext.getChatId(),
                                    chatError,
                                    error.getMessage(),
                                    error);
                            chatContext.fail();
                            chatContext.appendAnswer(
                                    String.format(
                                            "\n[Image generation error: %s]", error.getMessage()));
                            return Flux.just(
                                    ChatEvent.error(
                                            chatContext.getChatId(),
                                            chatError.name(),
                                            Strings.blankToDefault(
                                                    error.getMessage(),
                                                    chatError.getDescription())));
                        });
    }

    private Flux<ChatEvent> convertToChatEvents(
            ChatResponse response, LlmChatRequest request, ChatContext chatContext) {
        if (response.getUsage() != null) {
            chatContext.accumulateTokenUsage(
                    response.getUsage().getInputTokens(), response.getUsage().getOutputTokens());
        }
        if (CollectionUtils.isEmpty(response.getContent())) {
            return Flux.error(new IllegalStateException("Image generation returned no content"));
        }

        List<ChatEvent> events = new ArrayList<>();
        for (ContentBlock block : response.getContent()) {
            if (block instanceof TextBlock textBlock) {
                events.add(ChatEvent.text(chatContext.getChatId(), textBlock.getText()));
            } else if (block instanceof ImageBlock imageBlock) {
                events.add(
                        ChatEvent.image(chatContext.getChatId(), saveImage(imageBlock, request)));
            } else {
                log.warn(
                        "Unsupported image response content, contentType={}",
                        block.getClass().getName());
            }
        }
        if (events.isEmpty()) {
            return Flux.error(
                    new IllegalStateException("Image generation returned no supported content"));
        }
        return Flux.fromIterable(events);
    }

    private ChatEvent.ImageContent saveImage(ImageBlock imageBlock, LlmChatRequest request) {
        String mimeType;
        byte[] imageData;
        if (imageBlock.getSource() instanceof URLSource source) {
            if (Strings.isBlank(source.getUrl())) {
                throw new IllegalStateException("Image generation returned an empty image URL");
            }
            GeneratedImageDownloader.DownloadedImage image =
                    imageDownloader.download(source.getUrl());
            mimeType = image.mimeType();
            imageData = image.data();
        } else if (imageBlock.getSource() instanceof Base64Source source) {
            if (Strings.isBlank(source.getData())) {
                throw new IllegalStateException("Image generation returned empty Base64 data");
            }
            try {
                imageData = Base64.getDecoder().decode(source.getData());
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException("Image generation returned invalid Base64 data", e);
            }
            mimeType = source.getMediaType();
        } else {
            throw new IllegalStateException(
                    "Image generation returned an unsupported image source");
        }

        ChatAttachmentResult attachment =
                chatAttachmentService.saveGeneratedImage(request.getUserId(), mimeType, imageData);
        return ChatEvent.ImageContent.builder().attachmentId(attachment.getAttachmentId()).build();
    }
}
