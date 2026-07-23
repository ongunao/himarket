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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.alibaba.himarket.utils.JsonUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.TextBlockDeltaEvent;
import io.agentscope.core.event.ThinkingBlockDeltaEvent;
import io.agentscope.core.event.ToolCallDeltaEvent;
import io.agentscope.core.event.ToolCallEndEvent;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ChatFormatterTest {

    private static final String CHAT_ID = "chat-1";
    private static final String REPLY_ID = "reply-1";
    private static final String TOOL_NAME = "search";

    private final ChatFormatter formatter = new ChatFormatter();

    @Test
    void shouldAppendAssistantTextToAnswer() {
        ChatContext chatContext = new ChatContext(CHAT_ID);

        ChatEvent event =
                single(format(new TextBlockDeltaEvent(REPLY_ID, "text", "hello"), chatContext));

        assertEquals(ChatEvent.EventType.ASSISTANT, event.getType());
        assertEquals("hello", event.getContent());
        assertEquals("hello", chatContext.toResult().getAnswer());
    }

    @Test
    void shouldKeepToolCallsSeparateByToolCallId() {
        ChatContext chatContext = new ChatContext(CHAT_ID);

        format(
                new ToolCallDeltaEvent(REPLY_ID, "call_1", TOOL_NAME, "{\"query\":\"alpha\"}"),
                chatContext);
        ChatEvent first =
                single(format(new ToolCallEndEvent(REPLY_ID, "call_1", TOOL_NAME), chatContext));

        format(
                new ToolCallDeltaEvent(REPLY_ID, "call_2", TOOL_NAME, "{\"query\":\"beta\"}"),
                chatContext);
        ChatEvent second =
                single(format(new ToolCallEndEvent(REPLY_ID, "call_2", TOOL_NAME), chatContext));

        assertToolCall(first, "call_1", "alpha");
        assertToolCall(second, "call_2", "beta");
    }

    @Test
    void shouldCompactMessageChunksBySequentialType() {
        ChatContext chatContext = new ChatContext(CHAT_ID);

        format(new ThinkingBlockDeltaEvent(REPLY_ID, "thinking", "think "), chatContext);
        format(new ThinkingBlockDeltaEvent(REPLY_ID, "thinking", "more"), chatContext);
        format(new TextBlockDeltaEvent(REPLY_ID, "text", "hello "), chatContext);
        format(new TextBlockDeltaEvent(REPLY_ID, "text", "world"), chatContext);
        format(
                new ToolCallDeltaEvent(REPLY_ID, "call_1", TOOL_NAME, "{\"query\":\"alpha\"}"),
                chatContext);
        format(new ToolCallEndEvent(REPLY_ID, "call_1", TOOL_NAME), chatContext);
        format(new TextBlockDeltaEvent(REPLY_ID, "text", "done"), chatContext);

        List<Map<String, Object>> chunks =
                JsonUtil.parse(chatContext.toResult().getMessageChunks(), new TypeReference<>() {});

        assertEquals(4, chunks.size());
        assertChunk(chunks.get(0), "THINKING", "think more");
        assertChunk(chunks.get(1), "ASSISTANT", "hello world");
        assertEquals("TOOL_CALL", chunks.get(2).get("type"));
        assertEquals("call_1", chunks.get(2).get("id"));
        assertEquals(TOOL_NAME, chunks.get(2).get("name"));
        Map<?, ?> arguments = assertInstanceOf(Map.class, chunks.get(2).get("arguments"));
        assertEquals("alpha", arguments.get("query"));
        assertChunk(chunks.get(3), "ASSISTANT", "done");
    }

    @Test
    void shouldKeepGeneratedImageInMessageOrder() {
        ChatContext chatContext = new ChatContext(CHAT_ID);

        chatContext.collect(ChatEvent.text(CHAT_ID, "before"));
        chatContext.collect(
                ChatEvent.image(
                        CHAT_ID,
                        ChatEvent.ImageContent.builder().attachmentId("attachment-1").build()));
        chatContext.collect(ChatEvent.text(CHAT_ID, "after"));

        List<Map<String, Object>> chunks =
                JsonUtil.parse(chatContext.toResult().getMessageChunks(), new TypeReference<>() {});

        assertEquals(3, chunks.size());
        assertChunk(chunks.get(0), "ASSISTANT", "before");
        assertEquals("IMAGE", chunks.get(1).get("type"));
        assertEquals("attachment-1", chunks.get(1).get("attachmentId"));
        assertChunk(chunks.get(2), "ASSISTANT", "after");
        assertEquals("beforeafter", chatContext.toResult().getAnswer());
    }

    private List<ChatEvent> format(AgentEvent event, ChatContext chatContext) {
        List<ChatEvent> events = formatter.format(event, chatContext).collectList().block();
        events.forEach(chatContext::collect);
        return events;
    }

    private ChatEvent single(List<ChatEvent> events) {
        assertEquals(1, events.size());
        return events.get(0);
    }

    private void assertToolCall(ChatEvent event, String toolCallId, String query) {
        assertEquals(ChatEvent.EventType.TOOL_CALL, event.getType());
        ChatEvent.ToolCallContent content =
                assertInstanceOf(ChatEvent.ToolCallContent.class, event.getContent());
        assertEquals(toolCallId, content.getId());
        assertEquals(TOOL_NAME, content.getName());

        Map<?, ?> arguments = assertInstanceOf(Map.class, content.getArguments());
        assertEquals(query, arguments.get("query"));
    }

    private void assertChunk(Map<String, Object> chunk, String type, String content) {
        assertEquals(type, chunk.get("type"));
        assertEquals(content, chunk.get("content"));
    }
}
