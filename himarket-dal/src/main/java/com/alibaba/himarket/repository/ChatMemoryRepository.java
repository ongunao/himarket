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

package com.alibaba.himarket.repository;

import com.alibaba.himarket.entity.ChatMemory;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMemoryRepository extends BaseRepository<ChatMemory, Long> {

    Optional<ChatMemory> findByUserIdAndSessionIdAndMemoryKey(
            String userId, String sessionId, String memoryKey);

    boolean existsByUserIdAndSessionId(String userId, String sessionId);

    void deleteAllByUserIdAndSessionId(String userId, String sessionId);

    void deleteAllBySessionId(String sessionId);

    void deleteByUserIdAndSessionIdAndMemoryKey(String userId, String sessionId, String memoryKey);

    @Query("SELECT DISTINCT cm.sessionId FROM ChatMemory cm WHERE cm.userId = :userId")
    Set<String> findSessionIdsByUserId(@Param("userId") String userId);
}
