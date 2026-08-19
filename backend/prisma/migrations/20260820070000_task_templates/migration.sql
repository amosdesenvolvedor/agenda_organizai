CREATE TABLE `TaskTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `summary` VARCHAR(191) NULL,
  `description` TEXT NULL,
  `color` VARCHAR(191) NULL DEFAULT '#2563eb',
  `icon` VARCHAR(191) NULL DEFAULT 'check-circle',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TaskTemplate_ownerId_name_key`(`ownerId`, `name`),
  INDEX `TaskTemplate_ownerId_isActive_idx`(`ownerId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TaskTemplateItem` (
  `id` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  INDEX `TaskTemplateItem_templateId_sortOrder_idx`(`templateId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TaskTemplate` ADD CONSTRAINT `TaskTemplate_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TaskTemplateItem` ADD CONSTRAINT `TaskTemplateItem_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `TaskTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
