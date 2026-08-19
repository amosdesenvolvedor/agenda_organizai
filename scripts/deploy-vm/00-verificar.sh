#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"

load_config
validate_config

[[ -r /etc/os-release ]] || die "Não foi possível identificar o sistema operacional."
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "Scripts preparados para Ubuntu; detectado: ${ID:-desconhecido}."

info "Configuração válida"
printf 'Ubuntu: %s\nDomínio: %s\nDiretório: %s\nPorta interna: %s\n' "${VERSION_ID}" "${APP_DOMAIN}" "${APP_DIR}" "${APP_PORT}"
printf 'Próximo: sudo bash scripts/deploy-vm/01-pacotes.sh\n'
