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

import com.alibaba.himarket.utils.JsonUtil;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

class ChatContent {

    private final StringBuilder answer = new StringBuilder();

    private final List<ChatMessageChunk> chunks = new ArrayList<>();

    private ChatEvent.EventType currentChunkType;

    private final StringBuilder currentChunkContent = new StringBuilder();

    public void collect(ChatEvent event) {
        switch (event.getType()) {
            case ASSISTANT:
                if (event.getContent() instanceof String text) {
                    appendAnswer(text);
                    appendContentChunk(event.getType(), text);
                }
                break;

            case THINKING:
                if (event.getContent() instanceof String thinking) {
                    appendContentChunk(event.getType(), thinking);
                }
                break;

            case IMAGE:
                if (event.getContent() instanceof ChatEvent.ImageContent image) {
                    flushContentChunk();
                    chunks.add(
                            ChatMessageChunk.builder()
                                    .type(event.getType())
                                    .attachmentId(image.getAttachmentId())
                                    .build());
                }
                break;

            case TOOL_CALL:
                if (event.getContent() instanceof ChatEvent.ToolCallContent toolCall) {
                    flushContentChunk();
                    chunks.add(
                            ChatMessageChunk.builder()
                                    .type(event.getType())
                                    .id(toolCall.getId())
                                    .name(toolCall.getName())
                                    .arguments(toolCall.getArguments())
                                    .build());
                }
                break;

            case TOOL_RESULT:
                if (event.getContent() instanceof ChatEvent.ToolResultContent toolResult) {
                    flushContentChunk();
                    chunks.add(
                            ChatMessageChunk.builder()
                                    .type(event.getType())
                                    .id(toolResult.getId())
                                    .name(toolResult.getName())
                                    .result(toolResult.getResult())
                                    .build());
                }
                break;

            default:
                break;
        }
    }

    public void appendAnswer(String content) {
        answer.append(content);
    }

    public String getAnswer() {
        return answer.toString();
    }

    public String getMessageChunks() {
        flushContentChunk();
        return chunks.isEmpty() ? null : JsonUtil.toJson(chunks);
    }

    private void appendContentChunk(ChatEvent.EventType type, String content) {
        if (!type.equals(currentChunkType)) {
            flushContentChunk();
            currentChunkType = type;
        }
        currentChunkContent.append(content);
    }

    private void flushContentChunk() {
        if (currentChunkType == null || currentChunkContent.isEmpty()) {
            return;
        }
        chunks.add(
                ChatMessageChunk.builder()
                        .type(currentChunkType)
                        .content(currentChunkContent.toString())
                        .build());
        currentChunkType = null;
        currentChunkContent.setLength(0);
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChatMessageChunk {
        private ChatEvent.EventType type;
        private String content;
        private String id;
        private String name;
        private Map<String, Object> arguments;
        private Object result;
        private String attachmentId;
    }
}
