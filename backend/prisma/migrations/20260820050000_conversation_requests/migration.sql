CREATE TABLE `ConversationRequest` (
  `id` VARCHAR(191) NOT NULL,
  `senderId` VARCHAR(191) NOT NULL,
  `recipientId` VARCHAR(191) NOT NULL,
  `firstMessage` TEXT NOT NULL,
  `status` ENUM('PENDING', 'ACCEPTED', 'SPAM') NOT NULL DEFAULT 'PENDING',
  `respondedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ConversationRequest_senderId_recipientId_key`(`senderId`, `recipientId`),
  INDEX `ConversationRequest_recipientId_status_createdAt_idx`(`recipientId`, `status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ConversationRequest` ADD CONSTRAINT `ConversationRequest_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConversationRequest` ADD CONSTRAINT `ConversationRequest_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `ConversationRequestMessage` (
  `id` VARCHAR(191) NOT NULL,
  `requestId` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ConversationRequestMessage_requestId_createdAt_idx`(`requestId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ConversationRequestMessage` ADD CONSTRAINT `ConversationRequestMessage_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ConversationRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
