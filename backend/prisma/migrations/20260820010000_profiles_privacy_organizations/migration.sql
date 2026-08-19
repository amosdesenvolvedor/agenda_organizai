ALTER TABLE `User`
  ADD COLUMN `username` VARCHAR(191) NULL,
  ADD COLUMN `avatarPath` VARCHAR(191) NULL,
  ADD COLUMN `coverPath` VARCHAR(191) NULL,
  ADD COLUMN `bio` TEXT NULL,
  ADD COLUMN `profession` VARCHAR(191) NULL,
  ADD COLUMN `city` VARCHAR(191) NULL,
  ADD COLUMN `region` VARCHAR(191) NULL,
  ADD COLUMN `country` VARCHAR(191) NULL,
  ADD COLUMN `website` VARCHAR(191) NULL,
  ADD COLUMN `professionalLinks` JSON NULL,
  ADD COLUMN `socialLinks` JSON NULL,
  ADD UNIQUE INDEX `User_username_key`(`username`);

ALTER TABLE `FeedPost`
  ADD COLUMN `visibility` ENUM('PUBLIC', 'NETWORK', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC';

CREATE TABLE `FeedMedia` (
  `id` VARCHAR(191) NOT NULL,
  `postId` VARCHAR(191) NOT NULL,
  `type` ENUM('IMAGE', 'VIDEO') NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `size` INTEGER NOT NULL,
  `path` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `FeedMedia_postId_type_idx`(`postId`, `type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Organization` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `region` VARCHAR(191) NULL,
  `country` VARCHAR(191) NULL,
  `website` VARCHAR(191) NULL,
  `logoPath` VARCHAR(191) NULL,
  `coverPath` VARCHAR(191) NULL,
  `isPublic` BOOLEAN NOT NULL DEFAULT false,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Organization_slug_key`(`slug`),
  INDEX `Organization_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrganizationMember` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `OrganizationMember_organizationId_userId_key`(`organizationId`, `userId`),
  INDEX `OrganizationMember_userId_status_idx`(`userId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrganizationInvitation` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `invitedUserId` VARCHAR(191) NULL,
  `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
  `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  `expiresAt` DATETIME(3) NOT NULL,
  `respondedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `OrganizationInvitation_tokenHash_key`(`tokenHash`),
  INDEX `OrganizationInvitation_organizationId_status_idx`(`organizationId`, `status`),
  INDEX `OrganizationInvitation_invitedUserId_status_idx`(`invitedUserId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Team` ADD COLUMN `organizationId` VARCHAR(191) NULL, ADD INDEX `Team_organizationId_idx`(`organizationId`);
ALTER TABLE `FeedMedia` ADD CONSTRAINT `FeedMedia_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `FeedPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Organization` ADD CONSTRAINT `Organization_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OrganizationMember` ADD CONSTRAINT `OrganizationMember_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrganizationMember` ADD CONSTRAINT `OrganizationMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrganizationInvitation` ADD CONSTRAINT `OrganizationInvitation_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrganizationInvitation` ADD CONSTRAINT `OrganizationInvitation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OrganizationInvitation` ADD CONSTRAINT `OrganizationInvitation_invitedUserId_fkey` FOREIGN KEY (`invitedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Team` ADD CONSTRAINT `Team_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
