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

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.alibaba.himarket.service.ChatAttachmentService;
import org.junit.jupiter.api.Test;

class ChatAttachmentCleanupTaskTest {

    @Test
    void shouldDelegateAttachmentCleanup() {
        ChatAttachmentService attachmentService = mock(ChatAttachmentService.class);
        when(attachmentService.cleanupExpiredAttachments()).thenReturn(0);
        ChatAttachmentCleanupTask task = new ChatAttachmentCleanupTask(attachmentService);

        task.cleanupExpiredAttachments();

        verify(attachmentService).cleanupExpiredAttachments();
    }

    @Test
    void shouldContinueCleanupUntilNoAttachmentsRemain() {
        ChatAttachmentService attachmentService = mock(ChatAttachmentService.class);
        when(attachmentService.cleanupExpiredAttachments()).thenReturn(500, 200, 0);
        ChatAttachmentCleanupTask task = new ChatAttachmentCleanupTask(attachmentService);

        task.cleanupExpiredAttachments();

        verify(attachmentService, times(3)).cleanupExpiredAttachments();
    }

    @Test
    void shouldStopCleanupAtBatchLimit() {
        ChatAttachmentService attachmentService = mock(ChatAttachmentService.class);
        when(attachmentService.cleanupExpiredAttachments()).thenReturn(500);
        ChatAttachmentCleanupTask task = new ChatAttachmentCleanupTask(attachmentService);

        task.cleanupExpiredAttachments();

        verify(attachmentService, times(20)).cleanupExpiredAttachments();
    }
}
