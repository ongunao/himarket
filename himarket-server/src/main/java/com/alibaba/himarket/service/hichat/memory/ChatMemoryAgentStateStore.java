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

import com.alibaba.himarket.entity.ChatMemory;
import com.alibaba.himarket.repository.ChatMemoryRepository;
import com.alibaba.himarket.utils.JsonUtil;
import io.agentscope.core.state.AgentState;
import io.agentscope.core.state.AgentStateStore;
import io.agentscope.core.state.State;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Slf4j
@RequiredArgsConstructor
public class ChatMemoryAgentStateStore implements AgentStateStore {

    private static final String AGENT_STATE_KEY = "agent_state";

    private final ChatMemoryRepository chatMemoryRepository;

    @Override
    @Transactional
    public void save(String userId, String sessionId, String key, State value) {
        Objects.requireNonNull(value, "value must not be null");

        userId = requireText(userId, "userId");
        sessionId = requireText(sessionId, "sessionId");
        key = requireText(key, "key");

        ChatMemory memory =
                chatMemoryRepository
                        .findByUserIdAndSessionIdAndMemoryKey(userId, sessionId, key)
                        .orElse(
                                ChatMemory.builder()
                                        .userId(userId)
                                        .sessionId(sessionId)
                                        .memoryKey(key)
                                        .build());
        memory.setMemoryPayload(JsonUtil.toJson(value));
        chatMemoryRepository.save(memory);
    }

    @Override
    public void save(String userId, String sessionId, String key, List<? extends State> values) {}

    @Override
    @Transactional
    public <T extends State> Optional<T> get(
            String userId, String sessionId, String key, Class<T> type) {
        userId = requireText(userId, "userId");
        sessionId = requireText(sessionId, "sessionId");
        key = requireText(key, "key");

        ChatMemory memory =
                chatMemoryRepository
                        .findByUserIdAndSessionIdAndMemoryKey(userId, sessionId, key)
                        .orElse(null);
        if (memory == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(
                    Objects.requireNonNull(
                            JsonUtil.parse(memory.getMemoryPayload(), type),
                            "chat memory payload must not be blank"));
        } catch (RuntimeException e) {
            log.warn(
                    "Discarding invalid chat memory, sessionId={}, memoryKey={}, stateType={},"
                            + " errorMessage={}",
                    sessionId,
                    key,
                    type.getName(),
                    e.getMessage());
            chatMemoryRepository.deleteByUserIdAndSessionIdAndMemoryKey(userId, sessionId, key);
            return Optional.empty();
        }
    }

    @Transactional
    public boolean hasAgentState(String userId, String sessionId) {
        return get(userId, sessionId, AGENT_STATE_KEY, AgentState.class).isPresent();
    }

    @Override
    public <T extends State> List<T> getList(
            String userId, String sessionId, String key, Class<T> itemType) {
        return List.of();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(String userId, String sessionId) {
        return chatMemoryRepository.existsByUserIdAndSessionId(
                requireText(userId, "userId"), requireText(sessionId, "sessionId"));
    }

    @Override
    @Transactional
    public void delete(String userId, String sessionId) {
        chatMemoryRepository.deleteAllByUserIdAndSessionId(
                requireText(userId, "userId"), requireText(sessionId, "sessionId"));
    }

    @Override
    @Transactional
    public void delete(String userId, String sessionId, String key) {
        chatMemoryRepository.deleteByUserIdAndSessionIdAndMemoryKey(
                requireText(userId, "userId"),
                requireText(sessionId, "sessionId"),
                requireText(key, "key"));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> listSessionIds(String userId) {
        return chatMemoryRepository.findSessionIdsByUserId(requireText(userId, "userId"));
    }

    @Transactional
    public void deleteBySessionId(String sessionId) {
        chatMemoryRepository.deleteAllBySessionId(requireText(sessionId, "sessionId"));
    }

    private static String requireText(String value, String name) {
        Objects.requireNonNull(value, name + " must not be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return value;
    }
}
