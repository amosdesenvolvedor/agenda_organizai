-- AlterTable
ALTER TABLE `Event` MODIFY `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL') NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE `Task` ADD COLUMN `allDay` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `calendarId` VARCHAR(191) NULL,
    ADD COLUMN `color` VARCHAR(191) NULL DEFAULT '#2563eb',
    ADD COLUMN `endsAt` DATETIME(3) NULL,
    ADD COLUMN `icon` VARCHAR(191) NULL DEFAULT 'check-circle',
    ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isDraft` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isFavorite` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isPinned` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `noTime` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `privacy` ENUM('PUBLIC', 'PRIVATE', 'PARTICIPANTS', 'ADMINS') NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN `progressMode` ENUM('MANUAL', 'AUTOMATIC') NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN `startsAt` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'PAUSED', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN `summary` VARCHAR(191) NULL,
    ADD COLUMN `tags` TEXT NULL,
    MODIFY `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL') NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX `Task_calendarId_idx` ON `Task`(`calendarId`);

-- CreateIndex
CREATE INDEX `Task_status_isArchived_idx` ON `Task`(`status`, `isArchived`);

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_calendarId_fkey` FOREIGN KEY (`calendarId`) REFERENCES `Calendar`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `Task_categoryId_idx` ON `Task`(`categoryId`);
