#!/usr/bin/env bash
# Restaura db/seruna_back.dump en una base vacía dentro del contenedor "db" (docker-compose.yml).
# Uso: scripts/db-restore.sh [--force]
#   DB_NAME (por defecto seruna_db), POSTGRES_USER (por defecto postgres).
#   --force elimina y recrea la base si ya existe.
# Importante: NO se usa -C (el dump trae locale de Windows); la base se crea aquí con template0/UTF8.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME="${DB_NAME:-seruna_db}"
DB_USER="${POSTGRES_USER:-postgres}"
DUMP_LOCAL="db/seruna_back.dump"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

[[ -f "$DUMP_LOCAL" ]] || { echo "No existe $DUMP_LOCAL" >&2; exit 1; }
[[ "$DB_NAME" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "Nombre de base inválido: $DB_NAME" >&2; exit 1; }

echo "==> Levantando el contenedor db"
docker compose up -d --wait db

psql_c() { docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"; }

existe="$(psql_c -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'")"
if [[ "$existe" == "1" ]]; then
  if [[ $FORCE -eq 1 ]]; then
    echo "==> Eliminando la base existente ${DB_NAME}"
    psql_c -d postgres -c "DROP DATABASE \"${DB_NAME}\" WITH (FORCE)"
  else
    echo "La base ${DB_NAME} ya existe. Use --force para recrearla." >&2
    exit 1
  fi
fi

echo "==> Creando la base vacía ${DB_NAME}"
psql_c -d postgres -c "CREATE DATABASE \"${DB_NAME}\" TEMPLATE template0 ENCODING 'UTF8'"

echo "==> pg_restore --no-owner --no-privileges"
docker compose exec -T db pg_restore --no-owner --no-privileges --exit-on-error \
  -U "$DB_USER" -d "$DB_NAME" /dump/seruna_back.dump

echo "==> Verificando"
psql_c -d "$DB_NAME" -f /scripts/verificar-restauracion.sql
echo "==> Restauración de ${DB_NAME} verificada"
