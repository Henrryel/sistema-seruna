-- OPCIONAL (lo ejecuta el DBA): rol de conexión de la app SIN superusuario, con mínimo privilegio.
-- No cambia el esquema: solo crea un rol y otorga permisos. Uso:
--   psql -U postgres -d seruna_db -v clave='<contraseña segura>' -f scripts/db/rol-app.sql
-- Luego: DATABASE_URL=postgres://seruna_app:<contraseña>@host:5432/seruna_db

\set ON_ERROR_STOP on

SELECT format('CREATE ROLE seruna_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'clave')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'seruna_app') \gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO seruna_app', current_database()) \gexec
GRANT USAGE ON SCHEMA excelencia_seruna, public TO seruna_app;

-- Datos: la app nunca ejecuta DDL. Los triggers de la base impiden borrar/editar historial financiero,
-- de asistencia, calificaciones y planilla aunque el rol tenga DELETE/UPDATE.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA excelencia_seruna TO seruna_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA excelencia_seruna TO seruna_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA excelencia_seruna TO seruna_app;

-- El dump original revoca EXECUTE a PUBLIC en estas funciones; con --no-privileges ese REVOKE se pierde.
REVOKE ALL ON FUNCTION excelencia_seruna.avanzar_lote_historico(bigint, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION excelencia_seruna.conciliar_fila_historica(bigint, text, text, bigint, text, text, bigint, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION excelencia_seruna.indicadores_dashboard(bigint, date, date, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION excelencia_seruna.preparar_documento_reporte(uuid, bigint, bigint, date, date, bigint, bigint, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION excelencia_seruna.reporte_cuotas_al_corte(bigint, date) FROM PUBLIC;

ALTER ROLE seruna_app SET search_path = excelencia_seruna, public;
ALTER ROLE seruna_app SET timezone = 'America/Lima';
