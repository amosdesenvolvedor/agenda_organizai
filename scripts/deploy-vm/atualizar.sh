#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config

info "Sincronizando a versão local para a aplicação"
rsync -a --delete --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.env' --exclude='deploy.env' --exclude='shared' "${PROJECT_DIR}/" "${APP_DIR}/"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

info "Instalando, compilando e migrando em sequência"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && npm ci"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && npm run build --workspace backend"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && VITE_API_URL='' npm run build --workspace frontend"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && npm run db:migrate"
systemctl restart agenda-organizai
systemctl reload nginx
systemctl is-active --quiet agenda-organizai || { journalctl -u agenda-organizai -n 80 --no-pager; die "API não reiniciou."; }

info "Atualização concluída"
