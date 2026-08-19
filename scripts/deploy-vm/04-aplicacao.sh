#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config
require_command git

if ! getent group "${APP_GROUP}" >/dev/null 2>&1; then
  groupadd --system "${APP_GROUP}"
fi
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --gid "${APP_GROUP}" --shell /bin/bash "${APP_USER}"
fi

install -d -o "${APP_USER}" -g "${APP_GROUP}" "${APP_DIR}" "${APP_DIR}/shared/uploads"

if [[ -d "${PROJECT_DIR}/.git" ]]; then
  info "Copiando a versão local do projeto para ${APP_DIR}"
  rsync -a --delete --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.env' --exclude='deploy.env' --exclude='shared' "${PROJECT_DIR}/" "${APP_DIR}/"
else
  die "Execute a implantação a partir de um clone Git válido do projeto."
fi

install -d -o "${APP_USER}" -g "${APP_GROUP}" "${APP_DIR}/shared/uploads"
ln -sfn "${APP_DIR}/shared/uploads" "${APP_DIR}/uploads"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

info "Código preparado"
printf 'Próximo: sudo bash scripts/deploy-vm/05-ambiente.sh\n'
