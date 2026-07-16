#!/usr/bin/env bash
set -euo pipefail

APP_USER="${SUDO_USER:-ubuntu}"
APP_DIR="${APICE_DIR:-/opt/apice}"
REPO_URL="${APICE_REPOSITORY:-https://github.com/attgiasi/CARREIRA.git}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash deploy/oracle/bootstrap.sh"
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git openssl ufw docker.io

if ! docker compose version >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-v2 || \
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin
fi

systemctl enable --now docker
usermod -aG docker "${APP_USER}"

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

if [[ ! -d "${APP_DIR}/.git" ]]; then
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone "${REPO_URL}" "${APP_DIR}"
fi

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

ENV_FILE="${APP_DIR}/deploy/oracle/.env.production"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${APP_DIR}/deploy/oracle/env.production.example" "${ENV_FILE}"
  VAULT_KEY="$(openssl rand -base64 48 | tr -d '\n')"
  sed -i "s|^ACCOUNT_VAULT_KEY=.*|ACCOUNT_VAULT_KEY=${VAULT_KEY}|" "${ENV_FILE}"
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
fi

echo
echo "Base instalada em ${APP_DIR}."
echo "Edite ${ENV_FILE}, defina APICE_DOMAIN e as integrações desejadas."
echo "Depois execute: cd ${APP_DIR}/deploy/oracle && ./update.sh"
