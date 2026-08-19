#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config
require_command npm

info "Instalando dependências exatamente pelo package-lock"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && npm ci"

info "Compilando backend e frontend em sequência"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && npm run build --workspace backend"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && VITE_API_URL='' npm run build --workspace frontend"

[[ -f "${APP_DIR}/backend/dist/server.js" ]] || die "Build do backend não foi criado."
[[ -f "${APP_DIR}/frontend/dist/index.html" ]] || die "Build do frontend não foi criado."

info "Build concluído"
printf 'Próximo: sudo bash scripts/deploy-vm/07-migracoes.sh\n'
