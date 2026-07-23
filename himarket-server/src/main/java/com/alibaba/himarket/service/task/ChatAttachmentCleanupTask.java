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

package com.alibaba.himarket.service.task;

import com.alibaba.himarket.service.ChatAttachmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("!h2")
@Slf4j
@RequiredArgsConstructor
public class ChatAttachmentCleanupTask {

    private static final int MAX_CLEANUP_BATCHES = 20;

    private final ChatAttachmentService chatAttachmentService;

    @Scheduled(cron = "0 0 3 * * *")
    public void cleanupExpiredAttachments() {
        int totalDeleted = 0;
        for (int batch = 0; batch < MAX_CLEANUP_BATCHES; batch++) {
            int deletedCount = chatAttachmentService.cleanupExpiredAttachments();
            if (deletedCount == 0) {
                break;
            }
            totalDeleted += deletedCount;
        }
        log.info("Completed expired chat attachment cleanup, deletedCount={}", totalDeleted);
    }
}
