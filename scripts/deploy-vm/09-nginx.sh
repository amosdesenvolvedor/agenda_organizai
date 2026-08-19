#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config

NGINX_FILE=/etc/nginx/sites-available/agenda-organizai
backup_file "${NGINX_FILE}"
cat > "${NGINX_FILE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    root ${APP_DIR}/frontend/dist;
    index index.html;
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /health {
        proxy_pass http://127.0.0.1:${APP_PORT}/health;
        proxy_set_header Host \$host;
    }

    location /docs/ {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sfn "${NGINX_FILE}" /etc/nginx/sites-enabled/agenda-organizai
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

info "Nginx configurado em HTTP"
printf 'Aponte o DNS do domínio para esta VM antes do HTTPS.\n'
printf 'Próximo: sudo bash scripts/deploy-vm/10-https.sh\n'
