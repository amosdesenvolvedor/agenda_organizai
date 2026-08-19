-- AlterTable
ALTER TABLE `Event` ADD COLUMN `teamId` VARCHAR(191) NULL;
ALTER TABLE `Task` ADD COLUMN `teamId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TaskExternalShare` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `TaskExternalShare_tokenHash_key`(`tokenHash`),
    INDEX `TaskExternalShare_taskId_revokedAt_idx`(`taskId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Event_teamId_idx` ON `Event`(`teamId`);
CREATE INDEX `Task_teamId_idx` ON `Task`(`teamId`);

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Task` ADD CONSTRAINT `Task_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TaskExternalShare` ADD CONSTRAINT `TaskExternalShare_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
