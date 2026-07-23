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

package com.alibaba.himarket.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "chat_memory",
        uniqueConstraints = {
            @UniqueConstraint(
                    columnNames = {"user_id", "session_id", "memory_key"},
                    name = "uk_chat_memory_slot_key")
        })
@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMemory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * HiMarket user ID.
     */
    @Column(name = "user_id", nullable = false, length = 64)
    private String userId;

    /**
     * Chat session ID used by AgentScope RuntimeContext.
     */
    @Column(name = "session_id", nullable = false, length = 128)
    private String sessionId;

    /**
     * AgentScope state key, for example agent_state.
     */
    @Column(name = "memory_key", nullable = false, length = 128)
    private String memoryKey;

    /**
     * Serialized AgentScope state payload.
     */
    @Column(name = "memory_payload", nullable = false, columnDefinition = "longtext")
    private String memoryPayload;
}
