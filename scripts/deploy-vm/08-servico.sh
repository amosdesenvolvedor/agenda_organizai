#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
require_root
load_config
validate_config

SERVICE_FILE=/etc/systemd/system/agenda-organizai.service
backup_file "${SERVICE_FILE}"
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Agenda OrganizaI API
After=network.target mariadb.service
Requires=mariadb.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ${APP_DIR}/backend/dist/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${APP_DIR}/shared/uploads

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now agenda-organizai
systemctl is-active --quiet agenda-organizai || { journalctl -u agenda-organizai -n 80 --no-pager; die "API não iniciou."; }

info "API ativa no systemd"
printf 'Próximo: sudo bash scripts/deploy-vm/09-nginx.sh\n'
