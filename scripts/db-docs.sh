#!/usr/bin/env bash
# Regenera docs/db a partir del catálogo real de la base que corre en el contenedor "db".
set -euo pipefail
cd "$(dirname "$0")/.."
DB_NAME="${DB_NAME:-seruna_db}"
DB_USER="${POSTGRES_USER:-postgres}"
mkdir -p docs/db
docker compose exec -T -e PGCLIENTENCODING=UTF8 db \
  psql -v ON_ERROR_STOP=1 -At -U "$DB_USER" -d "$DB_NAME" -f /scripts/catalogo.sql > docs/db/catalogo.json
node scripts/db/generar-docs.mjs docs/db/catalogo.json docs/db
