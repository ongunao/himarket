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

import com.alibaba.himarket.entity.ChatAttachment;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatAttachmentRepository extends BaseRepository<ChatAttachment, Long> {

    /**
     * Find an attachment owned by a user
     *
     * @param attachmentId the attachment ID
     * @param userId the owner user ID
     * @return the chat attachment
     */
    Optional<ChatAttachment> findByAttachmentIdAndUserId(String attachmentId, String userId);

    /**
     * Find attachments owned by a user
     *
     * @param attachmentIds the list of attachment IDs
     * @param userId the owner user ID
     * @return the list of chat attachments
     */
    List<ChatAttachment> findByAttachmentIdInAndUserId(List<String> attachmentIds, String userId);

    /**
     * Delete expired attachments
     *
     * @param expiredBefore the exclusive expiration time
     * @return the number of deleted attachments
     */
    @Modifying(clearAutomatically = true)
    @Query(
            value =
                    """
                    DELETE FROM chat_attachment
                    WHERE created_at < :expiredBefore
                    ORDER BY created_at, id
                    LIMIT 500
                    """,
            nativeQuery = true)
    int deleteExpiredAttachments(@Param("expiredBefore") LocalDateTime expiredBefore);
}
