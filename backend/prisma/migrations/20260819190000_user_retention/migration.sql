ALTER TABLE `User`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `deactivatedAt` DATETIME(3) NULL;

CREATE TRIGGER `User_prevent_physical_delete`
BEFORE DELETE ON `User`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exclusao fisica de usuarios bloqueada: use desativacao logica';
