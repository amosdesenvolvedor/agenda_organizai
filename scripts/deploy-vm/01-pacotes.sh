#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config

info "Atualizando índices e instalando pacotes do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git gnupg nginx mariadb-server build-essential openssl rsync
systemctl enable --now mariadb nginx

info "Pacotes instalados"
printf 'Próximo: sudo bash scripts/deploy-vm/02-nodejs.sh\n'
