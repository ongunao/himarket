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
package com.alibaba.himarket.service.hichat.support;

import com.alibaba.himarket.support.common.Strings;
import com.alibaba.himarket.utils.JsonUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.AgentResultEvent;
import io.agentscope.core.event.ModelCallEndEvent;
import io.agentscope.core.event.TextBlockDeltaEvent;
import io.agentscope.core.event.ThinkingBlockDeltaEvent;
import io.agentscope.core.event.ToolCallDeltaEvent;
import io.agentscope.core.event.ToolCallEndEvent;
import io.agentscope.core.event.ToolResultDataDeltaEvent;
import io.agentscope.core.event.ToolResultEndEvent;
import io.agentscope.core.event.ToolResultTextDeltaEvent;
import io.agentscope.core.message.ContentBlock;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.TextBlock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;

/**
 * Formats AgentScope events into HiChat events for frontend streaming.
 *
 * <p>Event flow:
 * <pre>
 * 1. TEXT_BLOCK_DELTA / THINKING_BLOCK_DELTA - streaming text chunks
 * 2. TOOL_CALL_*                             - tool call argument chunks
 * 3. TOOL_RESULT_*                           - tool execution result chunks
 * 4. MODEL_CALL_END                          - token usage
 * 5. AGENT_RESULT                            - final result fallback
 * </pre>
 */
@Slf4j
public class ChatFormatter {

    private final Map<String, StringBuilder> toolCallArguments = new LinkedHashMap<>();

    private final Map<String, List<ContentBlock>> toolResultBlocks = new LinkedHashMap<>();

    private boolean hasTextEvent;

    public Flux<ChatEvent> format(AgentEvent event, ChatContext context) {
        String chatId = context.getChatId();
        try {
            log.debug("Converting chat event, type={}, eventId={}", event.getType(), event.getId());

            return switch (event.getType()) {
                case TEXT_BLOCK_DELTA -> formatText((TextBlockDeltaEvent) event, context);
                case THINKING_BLOCK_DELTA ->
                        formatThinking((ThinkingBlockDeltaEvent) event, context);
                // Start events are only boundaries; complete blocks are emitted on END events.
                case TOOL_CALL_START, TOOL_RESULT_START -> Flux.empty();
                case TOOL_CALL_DELTA -> collectToolCall((ToolCallDeltaEvent) event);
                case TOOL_CALL_END -> finishToolCall((ToolCallEndEvent) event, context);
                case TOOL_RESULT_TEXT_DELTA -> collectToolText((ToolResultTextDeltaEvent) event);
                case TOOL_RESULT_DATA_DELTA -> collectToolData((ToolResultDataDeltaEvent) event);
                case TOOL_RESULT_END -> finishToolResult((ToolResultEndEvent) event, context);
                case MODEL_CALL_END -> collectUsage((ModelCallEndEvent) event, context);
                case AGENT_RESULT -> formatResult((AgentResultEvent) event, context);
                default -> {
                    log.debug("Skipping unknown event type, type={}", event.getType());
                    yield Flux.empty();
                }
            };

        } catch (Exception e) {
            log.error(
                    "Failed to convert chat event, chatId={}, eventType={}, errorMessage={}",
                    chatId,
                    event.getType(),
                    e.getMessage(),
                    e);
            return Flux.just(ChatEvent.error(chatId, "CONVERSION_ERROR", e.getMessage()));
        }
    }

    private Flux<ChatEvent> formatText(TextBlockDeltaEvent event, ChatContext context) {
        if (Strings.isBlank(event.getDelta())) {
            return Flux.empty();
        }
        hasTextEvent = true;
        return Flux.just(ChatEvent.text(context.getChatId(), event.getDelta()));
    }

    private Flux<ChatEvent> formatThinking(ThinkingBlockDeltaEvent event, ChatContext context) {
        if (Strings.isBlank(event.getDelta())) {
            return Flux.empty();
        }
        return Flux.just(ChatEvent.thinking(context.getChatId(), event.getDelta()));
    }

    private Flux<ChatEvent> collectToolCall(ToolCallDeltaEvent event) {
        // Tool call arguments arrive as JSON fragments and are emitted after the END event.
        if (Strings.isNotBlank(event.getToolCallId()) && event.getDelta() != null) {
            toolCallArguments
                    .computeIfAbsent(event.getToolCallId(), ignored -> new StringBuilder())
                    .append(event.getDelta());
        }
        return Flux.empty();
    }

    private Flux<ChatEvent> finishToolCall(ToolCallEndEvent event, ChatContext context) {
        if (Strings.isBlank(event.getToolCallId())) {
            return Flux.empty();
        }
        return Flux.just(
                ChatEvent.toolCall(
                        context.getChatId(),
                        ChatEvent.ToolCallContent.builder()
                                .id(event.getToolCallId())
                                .name(event.getToolCallName())
                                .arguments(parseToolCallArguments(event.getToolCallId()))
                                .build()));
    }

    private Flux<ChatEvent> collectToolText(ToolResultTextDeltaEvent event) {
        if (event.getDelta() != null) {
            // Preserve tool output as content blocks for messageChunks replay.
            addToolResultBlock(
                    event.getToolCallId(), TextBlock.builder().text(event.getDelta()).build());
        }
        return Flux.empty();
    }

    private Flux<ChatEvent> collectToolData(ToolResultDataDeltaEvent event) {
        addToolResultBlock(event.getToolCallId(), event.getData());
        return Flux.empty();
    }

    private Flux<ChatEvent> finishToolResult(ToolResultEndEvent event, ChatContext context) {
        if (Strings.isBlank(event.getToolCallId())) {
            return Flux.empty();
        }
        return Flux.just(
                ChatEvent.toolResult(
                        context.getChatId(),
                        ChatEvent.ToolResultContent.builder()
                                .id(event.getToolCallId())
                                .name(event.getToolCallName())
                                .result(toToolResult(event.getToolCallId()))
                                .build()));
    }

    private Flux<ChatEvent> collectUsage(ModelCallEndEvent event, ChatContext context) {
        if (event.getUsage() != null) {
            // A single chat can trigger multiple model calls, so token usage is accumulated.
            context.accumulateTokenUsage(
                    event.getUsage().getInputTokens(), event.getUsage().getOutputTokens());
        }
        return Flux.empty();
    }

    private Flux<ChatEvent> formatResult(AgentResultEvent event, ChatContext context) {
        Msg result = event.getResult();
        if (!context.hasUsage() && result != null && result.getChatUsage() != null) {
            // AGENT_RESULT may be the only place that carries usage in non-standard paths.
            context.accumulateTokenUsage(
                    result.getChatUsage().getInputTokens(),
                    result.getChatUsage().getOutputTokens());
        }
        if (hasTextEvent || result == null || Strings.isBlank(result.getTextContent())) {
            return Flux.empty();
        }
        // Emit final text only when no streaming text was collected.
        hasTextEvent = true;
        return Flux.just(ChatEvent.text(context.getChatId(), result.getTextContent()));
    }

    private Map<String, Object> parseToolCallArguments(String toolCallId) {
        StringBuilder arguments = toolCallArguments.remove(toolCallId);
        String argumentsText = arguments != null ? arguments.toString() : "";
        if (Strings.isBlank(argumentsText)) {
            return Map.of();
        }
        try {
            return JsonUtil.parse(argumentsText, new TypeReference<>() {});
        } catch (RuntimeException e) {
            return Map.of("arguments", argumentsText);
        }
    }

    private void addToolResultBlock(String toolCallId, ContentBlock block) {
        if (Strings.isNotBlank(toolCallId) && block != null) {
            toolResultBlocks.computeIfAbsent(toolCallId, ignored -> new ArrayList<>()).add(block);
        }
    }

    private Object toToolResult(String toolCallId) {
        List<ContentBlock> output =
                Objects.requireNonNullElse(toolResultBlocks.remove(toolCallId), List.of());
        if (output.isEmpty()) {
            return "";
        }

        StringBuilder text = new StringBuilder();
        for (ContentBlock block : output) {
            if (!(block instanceof TextBlock textBlock)) {
                return output.size() == 1 ? output.get(0) : output;
            }
            text.append(textBlock.getText());
        }
        return text.toString();
    }
}
