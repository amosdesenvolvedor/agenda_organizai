-- CreateTable
CREATE TABLE `TaskRecurrence` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `frequency` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM') NOT NULL,
    `interval` INTEGER NOT NULL DEFAULT 1,
    `byWeekday` VARCHAR(191) NULL,
    `endsAt` DATETIME(3) NULL,
    `count` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaskRecurrence_taskId_key`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskRecurrence` ADD CONSTRAINT `TaskRecurrence_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
