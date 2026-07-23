-- V22__Add_chat_message_chunks.sql
-- Add message_chunks column to chat table
-- Description: Store ordered message chunks for chat display

START TRANSACTION;

SET @dbname = DATABASE();
SET @tablename = 'chat';
SET @columnname = 'message_chunks';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT ''Column message_chunks already exists in chat'' AS result;',
  'ALTER TABLE `chat` ADD COLUMN `message_chunks` json DEFAULT NULL COMMENT ''Ordered message chunks for display'' AFTER `answer`;'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

COMMIT;
