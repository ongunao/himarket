CREATE TABLE IF NOT EXISTS `chat_memory` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` varchar(64) NOT NULL,
    `session_id` varchar(128) NOT NULL,
    `memory_key` varchar(128) NOT NULL,
    `memory_payload` longtext NOT NULL,
    `created_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` datetime(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_chat_memory_slot_key` (`user_id`, `session_id`, `memory_key`),
    KEY `idx_chat_memory_session` (`session_id`),
    KEY `idx_chat_memory_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
