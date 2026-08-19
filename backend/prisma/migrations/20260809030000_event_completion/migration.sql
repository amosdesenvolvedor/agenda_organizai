-- AlterTable
ALTER TABLE `Event`
    ADD COLUMN `feedback` TEXT NULL,
    ADD COLUMN `discussionTopics` TEXT NULL,
    ADD COLUMN `completedAt` DATETIME(3) NULL;
