-- AlterTable
ALTER TABLE `Task` ADD COLUMN `startedAt` DATETIME(3) NULL,
    ADD COLUMN `executionReport` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `TaskMessage` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NULL,
    `imagePath` VARCHAR(191) NULL,
    `imageName` VARCHAR(191) NULL,
    `imageMime` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `TaskMessage_taskId_createdAt_idx`(`taskId`, `createdAt`),
    INDEX `TaskMessage_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskMessage` ADD CONSTRAINT `TaskMessage_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TaskMessage` ADD CONSTRAINT `TaskMessage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
