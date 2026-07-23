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

package com.alibaba.himarket.service.hichat.memory;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.alibaba.himarket.entity.ChatMemory;
import com.alibaba.himarket.repository.ChatMemoryRepository;
import com.alibaba.himarket.utils.JsonUtil;
import io.agentscope.core.state.AgentState;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ChatMemoryAgentStateStoreTest {

    private static final String USER_ID = "user-1";
    private static final String SESSION_ID = "session-1";
    private static final String AGENT_STATE_KEY = "agent_state";

    private final ChatMemoryRepository repository = mock(ChatMemoryRepository.class);
    private final ChatMemoryAgentStateStore stateStore = new ChatMemoryAgentStateStore(repository);

    @Test
    void shouldReportAvailableAgentStateWhenPayloadIsReadable() {
        AgentState state = AgentState.builder().userId(USER_ID).sessionId(SESSION_ID).build();
        when(repository.findByUserIdAndSessionIdAndMemoryKey(USER_ID, SESSION_ID, AGENT_STATE_KEY))
                .thenReturn(Optional.of(memory(JsonUtil.toJson(state))));

        assertTrue(stateStore.hasAgentState(USER_ID, SESSION_ID));

        verify(repository, never())
                .deleteByUserIdAndSessionIdAndMemoryKey(USER_ID, SESSION_ID, AGENT_STATE_KEY);
    }

    @Test
    void shouldDiscardUnreadableAgentState() {
        when(repository.findByUserIdAndSessionIdAndMemoryKey(USER_ID, SESSION_ID, AGENT_STATE_KEY))
                .thenReturn(Optional.of(memory("invalid-json")));

        assertFalse(stateStore.hasAgentState(USER_ID, SESSION_ID));

        verify(repository)
                .deleteByUserIdAndSessionIdAndMemoryKey(USER_ID, SESSION_ID, AGENT_STATE_KEY);
    }

    @Test
    void shouldIgnoreOtherSessionStateRecords() {
        when(repository.findByUserIdAndSessionIdAndMemoryKey(USER_ID, SESSION_ID, AGENT_STATE_KEY))
                .thenReturn(Optional.empty());

        assertFalse(stateStore.hasAgentState(USER_ID, SESSION_ID));

        verify(repository, never()).existsByUserIdAndSessionId(USER_ID, SESSION_ID);
    }

    private ChatMemory memory(String payload) {
        return ChatMemory.builder()
                .userId(USER_ID)
                .sessionId(SESSION_ID)
                .memoryKey(AGENT_STATE_KEY)
                .memoryPayload(payload)
                .build();
    }
}
