#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Arquivo ausente: ${ENV_FILE}"
  echo "Copie env.production.example, preencha APICE_DOMAIN e tente novamente."
  exit 1
fi

cd "${APP_DIR}"
git fetch origin
git pull --ff-only origin main

cd "${SCRIPT_DIR}"
docker compose --env-file "${ENV_FILE}" build --pull app
docker compose --env-file "${ENV_FILE}" up -d --remove-orphans
docker image prune -f

echo
docker compose --env-file "${ENV_FILE}" ps
echo "Ápice atualizado. Endereço: https://$(grep '^APICE_DOMAIN=' "${ENV_FILE}" | cut -d= -f2-)"
