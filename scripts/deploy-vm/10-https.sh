#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL não definido em deploy.env}"

info "Instalando Certbot e solicitando certificado"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y certbot python3-certbot-nginx
certbot --nginx --non-interactive --agree-tos --redirect --email "${LETSENCRYPT_EMAIL}" -d "${APP_DOMAIN}"
systemctl enable --now certbot.timer

info "HTTPS configurado"
printf 'Próximo: bash scripts/deploy-vm/11-verificar.sh\n'
