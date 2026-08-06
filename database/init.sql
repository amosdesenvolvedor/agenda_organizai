CREATE DATABASE IF NOT EXISTS agenda_organizai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'agenda_organizai_user'@'%' IDENTIFIED BY 'change_me';
CREATE USER IF NOT EXISTS 'agenda_organizai_user'@'localhost' IDENTIFIED BY 'change_me';
CREATE USER IF NOT EXISTS 'agenda_organizai_user'@'127.0.0.1' IDENTIFIED BY 'change_me';
GRANT ALL PRIVILEGES ON agenda_organizai.* TO 'agenda_organizai_user'@'%';
GRANT ALL PRIVILEGES ON agenda_organizai.* TO 'agenda_organizai_user'@'localhost';
GRANT ALL PRIVILEGES ON agenda_organizai.* TO 'agenda_organizai_user'@'127.0.0.1';
FLUSH PRIVILEGES;
