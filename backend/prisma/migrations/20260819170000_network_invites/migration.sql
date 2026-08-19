CREATE TABLE `NetworkInvite` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `inviterId` VARCHAR(191) NOT NULL,
  `acceptedById` VARCHAR(191) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `acceptedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `NetworkInvite_tokenHash_key`(`tokenHash`),
  INDEX `NetworkInvite_inviterId_acceptedAt_idx`(`inviterId`, `acceptedAt`),
  INDEX `NetworkInvite_acceptedById_acceptedAt_idx`(`acceptedById`, `acceptedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NetworkInvite` ADD CONSTRAINT `NetworkInvite_inviterId_fkey` FOREIGN KEY (`inviterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `NetworkInvite` ADD CONSTRAINT `NetworkInvite_acceptedById_fkey` FOREIGN KEY (`acceptedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
