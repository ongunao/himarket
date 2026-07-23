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
package com.alibaba.himarket.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.alibaba.himarket.core.security.ContextHolder;
import com.alibaba.himarket.dto.result.chat.ChatAttachmentDetailResult;
import com.alibaba.himarket.entity.ChatAttachment;
import com.alibaba.himarket.repository.ChatAttachmentRepository;
import com.alibaba.himarket.support.enums.ChatAttachmentType;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChatAttachmentServiceImplTest {

    @Test
    void shouldSaveGeneratedImageAsReusableAttachment() {
        ContextHolder contextHolder = mock(ContextHolder.class);
        ChatAttachmentRepository repository = mock(ChatAttachmentRepository.class);
        when(repository.save(any(ChatAttachment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        ChatAttachmentServiceImpl service =
                new ChatAttachmentServiceImpl(contextHolder, repository);

        service.saveGeneratedImage("user-1", "image/png", "image".getBytes(StandardCharsets.UTF_8));

        ArgumentCaptor<ChatAttachment> attachment = ArgumentCaptor.forClass(ChatAttachment.class);
        verify(repository).save(attachment.capture());
        assertEquals("user-1", attachment.getValue().getUserId());
        assertEquals(ChatAttachmentType.IMAGE, attachment.getValue().getType());
    }

    @Test
    void shouldCleanupAttachmentsOlderThanNinetyDays() {
        ContextHolder contextHolder = mock(ContextHolder.class);
        ChatAttachmentRepository repository = mock(ChatAttachmentRepository.class);
        ChatAttachmentServiceImpl service =
                new ChatAttachmentServiceImpl(contextHolder, repository);
        LocalDateTime beforeCleanup = LocalDateTime.now().minusDays(90);
        when(repository.deleteExpiredAttachments(any(LocalDateTime.class))).thenReturn(12);

        int deletedCount = service.cleanupExpiredAttachments();

        ArgumentCaptor<LocalDateTime> expiredBefore = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(repository).deleteExpiredAttachments(expiredBefore.capture());
        LocalDateTime afterCleanup = LocalDateTime.now().minusDays(90);
        assertEquals(12, deletedCount);
        assertFalse(expiredBefore.getValue().isBefore(beforeCleanup));
        assertFalse(expiredBefore.getValue().isAfter(afterCleanup));
    }

    @Test
    void shouldLoadOnlyAttachmentOwnedByCurrentUser() {
        ContextHolder contextHolder = mock(ContextHolder.class);
        ChatAttachmentRepository repository = mock(ChatAttachmentRepository.class);
        when(contextHolder.getUser()).thenReturn("user-1");
        ChatAttachment attachment =
                ChatAttachment.builder()
                        .attachmentId("attachment-1")
                        .userId("user-1")
                        .name("image.png")
                        .type(ChatAttachmentType.IMAGE)
                        .mimeType("image/png")
                        .size(5L)
                        .data("image".getBytes(StandardCharsets.UTF_8))
                        .build();
        when(repository.findByAttachmentIdAndUserId("attachment-1", "user-1"))
                .thenReturn(Optional.of(attachment));
        ChatAttachmentServiceImpl service =
                new ChatAttachmentServiceImpl(contextHolder, repository);

        ChatAttachmentDetailResult result = service.getAttachmentDetail("attachment-1");

        assertEquals("attachment-1", result.getAttachmentId());
        verify(repository).findByAttachmentIdAndUserId("attachment-1", "user-1");
    }
}
