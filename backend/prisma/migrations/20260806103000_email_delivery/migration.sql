-- CreateTable
CREATE TABLE `EmailDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `from` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `html` LONGTEXT NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `providerMessageId` VARCHAR(191) NULL,
    `lastError` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailDelivery_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `EmailDelivery_to_createdAt_idx`(`to`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
