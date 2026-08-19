#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config

info "Aplicando somente migrations versionadas"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && npm run db:migrate"

info "Migrations concluídas; seed não é executado automaticamente por segurança"
printf 'Opcional, apenas na primeira instalação: sudo -u %s bash -lc "cd %s && npm run db:seed"\n' "${APP_USER}" "${APP_DIR}"
printf 'Próximo: sudo bash scripts/deploy-vm/08-servico.sh\n'
