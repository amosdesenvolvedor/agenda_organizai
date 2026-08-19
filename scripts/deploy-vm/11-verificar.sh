#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/lib/common.sh"
load_config
validate_config
require_command curl

info "Testando frontend"
curl --fail --show-error --silent --location --max-time 15 "${APP_URL}/" >/dev/null
info "Testando API"
curl --fail --show-error --silent --max-time 15 "${APP_URL}/health"
printf '\nImplantação validada: %s\n' "${APP_URL}"
