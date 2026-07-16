#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"
docker run --rm \
  -v apice_apice_storage:/source:ro \
  -v "${BACKUP_DIR}:/backup" \
  alpine sh -c "tar -czf /backup/apice-${STAMP}.tar.gz -C /source ."

find "${BACKUP_DIR}" -type f -name 'apice-*.tar.gz' -mtime +14 -delete
echo "Backup criado: ${BACKUP_DIR}/apice-${STAMP}.tar.gz"
