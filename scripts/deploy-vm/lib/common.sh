#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
CONFIG_FILE="${DEPLOY_CONFIG:-${SCRIPT_DIR}/deploy.env}"

die() {
  printf 'ERRO: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '\n==> %s\n' "$*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Comando obrigatório não encontrado: $1"
}

require_root() {
  [[ ${EUID} -eq 0 ]] || die "Execute este script com sudo."
}

load_config() {
  [[ -f "${CONFIG_FILE}" ]] || die "Configuração ausente. Copie deploy.env.example para deploy.env e preencha os valores."
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"

  : "${APP_DOMAIN:?APP_DOMAIN não definido em deploy.env}"
  : "${DB_NAME:?DB_NAME não definido em deploy.env}"
  : "${DB_USER:?DB_USER não definido em deploy.env}"
  : "${DB_PASSWORD:?DB_PASSWORD não definido em deploy.env}"
  : "${JWT_ACCESS_SECRET:?JWT_ACCESS_SECRET não definido em deploy.env}"
  : "${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET não definido em deploy.env}"

  APP_USER="${APP_USER:-agenda}"
  APP_GROUP="${APP_GROUP:-${APP_USER}}"
  APP_DIR="${APP_DIR:-/opt/agenda-organizai}"
  APP_PORT="${APP_PORT:-4000}"
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-3306}"
  DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
  REPOSITORY_URL="${REPOSITORY_URL:-git@github.com:amosdesenvolvedor/agenda_organizai.git}"
  APP_SCHEME="${APP_SCHEME:-https}"
  APP_URL="${APP_SCHEME}://${APP_DOMAIN}"
}

validate_config() {
  [[ "${APP_DOMAIN}" != "example.com" ]] || die "Substitua APP_DOMAIN pelo domínio real."
  [[ "${APP_DOMAIN}" != *"seudominio.com" ]] || die "Substitua APP_DOMAIN pelo domínio real."
  [[ "${APP_DOMAIN}" =~ ^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$ ]] || die "APP_DOMAIN não parece um domínio válido."
  [[ "${DB_NAME}" =~ ^[a-zA-Z0-9_]+$ ]] || die "DB_NAME aceita somente letras, números e underscore."
  [[ "${DB_USER}" =~ ^[a-zA-Z0-9_]+$ ]] || die "DB_USER aceita somente letras, números e underscore."
  [[ "${DB_PASSWORD}" =~ ^[a-zA-Z0-9_.~-]+$ ]] || die "DB_PASSWORD aceita letras, números e os símbolos _ . ~ - (compatível com a URL do Prisma)."
  [[ "${DB_PASSWORD}" != troque-* ]] || die "Substitua DB_PASSWORD por uma senha real."
  [[ "${APP_PORT}" =~ ^[0-9]+$ ]] || die "APP_PORT precisa ser numérica."
  (( APP_PORT >= 1024 && APP_PORT <= 65535 )) || die "APP_PORT deve ficar entre 1024 e 65535."
  (( ${#JWT_ACCESS_SECRET} >= 32 )) || die "JWT_ACCESS_SECRET precisa ter pelo menos 32 caracteres."
  (( ${#JWT_REFRESH_SECRET} >= 32 )) || die "JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres."
  [[ "${JWT_ACCESS_SECRET}" != troque-* && "${JWT_REFRESH_SECRET}" != troque-* ]] || die "Gere segredos JWT reais antes de continuar."
  [[ "${JWT_ACCESS_SECRET}" != "${JWT_REFRESH_SECRET}" ]] || die "Os dois segredos JWT devem ser diferentes."
}

backup_file() {
  local target="$1"
  if [[ -f "${target}" && ! -f "${target}.before-agenda-deploy" ]]; then
    cp -- "${target}" "${target}.before-agenda-deploy"
  fi
}
