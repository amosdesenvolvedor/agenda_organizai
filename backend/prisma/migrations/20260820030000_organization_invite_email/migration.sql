ALTER TABLE `OrganizationInvitation`
  ADD COLUMN `invitedEmail` VARCHAR(191) NULL,
  ADD INDEX `OrganizationInvitation_invitedEmail_status_idx`(`invitedEmail`, `status`);
