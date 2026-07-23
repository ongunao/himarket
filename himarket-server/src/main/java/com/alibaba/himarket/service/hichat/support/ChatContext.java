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

import com.alibaba.himarket.dto.result.chat.LlmInvokeResult;
import com.alibaba.himarket.support.chat.ChatUsage;
import java.util.Objects;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ChatContext {

    /**
     * Chat ID for tracking
     */
    @Getter private final String chatId;

    private final ChatContent content = new ChatContent();

    @Getter private final ChatUsage usage = ChatUsage.builder().build();

    /**
     * Success flag
     */
    private boolean success = true;

    /**
     * Request start time in milliseconds
     */
    private Long startTime;

    /**
     * First byte timeout (time to first byte in milliseconds)
     */
    private Long firstByteTimeout;

    public ChatContext(String chatId) {
        this.chatId = chatId;
    }

    public void start() {
        this.startTime = System.currentTimeMillis();
    }

    /**
     * Record first byte arrival time
     */
    public void recordFirstByteTimeout() {
        if (firstByteTimeout == null && startTime != null) {
            firstByteTimeout = System.currentTimeMillis() - startTime;
            log.debug("First byte received, elapsedMillis={}", firstByteTimeout);
        }
    }

    /**
     * Stop timing and update usage with elapsed time
     */
    public void stop() {
        if (startTime == null) {
            return;
        }

        long elapsedTime = System.currentTimeMillis() - startTime;
        usage.setElapsedTime(elapsedTime);
        log.debug("Chat completed, elapsedMillis={}", elapsedTime);

        if (firstByteTimeout != null) {
            usage.setFirstByteTimeout(firstByteTimeout);
        }
    }

    /**
     * Collect chat event and update context
     *
     * @param event ChatEvent to collect
     */
    public void collect(ChatEvent event) {
        if (event == null) {
            return;
        }

        switch (event.getType()) {
            case ASSISTANT:
            case THINKING:
            case IMAGE:
            case TOOL_CALL:
            case TOOL_RESULT:
                if (event.getContent() != null) {
                    recordFirstByteTimeout();
                    content.collect(event);
                }
                break;

            case ERROR:
                this.success = false;
                if (event.getMessage() != null) {
                    appendAnswer("\n[Request failed. Reason: " + event.getMessage() + "]");
                }
                break;

            case START:
            case DONE:
            default:
                break;
        }
    }

    /**
     * Convert to LlmInvokeResult for database persistence
     *
     * @return LlmInvokeResult instance
     */
    public LlmInvokeResult toResult() {
        return LlmInvokeResult.builder()
                .success(success)
                .answer(content.getAnswer())
                .messageChunks(content.getMessageChunks())
                .usage(usage)
                .build();
    }

    public void appendAnswer(String content) {
        this.content.appendAnswer(content);
    }

    public void fail() {
        this.success = false;
    }

    public boolean hasUsage() {
        return usage.getTotalTokens() != null;
    }

    public void accumulateTokenUsage(int inputTokens, int outputTokens) {
        usage.setInputTokens(Objects.requireNonNullElse(usage.getInputTokens(), 0) + inputTokens);
        usage.setOutputTokens(
                Objects.requireNonNullElse(usage.getOutputTokens(), 0) + outputTokens);
        usage.setTotalTokens(usage.getInputTokens() + usage.getOutputTokens());
    }
}
