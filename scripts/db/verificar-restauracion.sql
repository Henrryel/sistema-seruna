-- Verifica una base RECIÉN restaurada desde db/seruna_back.dump (antes de aplicar migraciones).
-- Falla con error si falta algún objeto o semilla esperada.
\set ON_ERROR_STOP on

DO $$
DECLARE
    esperado jsonb := '{
        "tablas": 95, "vistas": 13, "funciones": 43, "triggers": 58,
        "roles": 4, "permisos": 32, "rol_permisos": 37, "niveles": 2,
        "grados": 11, "conceptos_cobro": 3, "tipos_reporte": 7
    }';
    obtenido jsonb;
BEGIN
    SELECT jsonb_build_object(
        'tablas', (SELECT count(*) FROM pg_tables WHERE schemaname = 'excelencia_seruna'),
        'vistas', (SELECT count(*) FROM pg_views WHERE schemaname = 'excelencia_seruna'),
        'funciones', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                      WHERE n.nspname = 'excelencia_seruna'),
        'triggers', (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                     JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'excelencia_seruna' AND NOT t.tgisinternal),
        'roles', (SELECT count(*) FROM excelencia_seruna.roles),
        'permisos', (SELECT count(*) FROM excelencia_seruna.permisos),
        'rol_permisos', (SELECT count(*) FROM excelencia_seruna.rol_permisos),
        'niveles', (SELECT count(*) FROM excelencia_seruna.niveles),
        'grados', (SELECT count(*) FROM excelencia_seruna.grados),
        'conceptos_cobro', (SELECT count(*) FROM excelencia_seruna.conceptos_cobro),
        'tipos_reporte', (SELECT count(*) FROM excelencia_seruna.tipos_reporte)
    ) INTO obtenido;

    IF obtenido IS DISTINCT FROM esperado THEN
        RAISE EXCEPTION 'Restauración incompleta. Esperado: %, obtenido: %', esperado, obtenido;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
        RAISE EXCEPTION 'Falta la extensión btree_gist';
    END IF;
    IF EXISTS (
        SELECT 1 FROM excelencia_seruna.roles
        WHERE codigo NOT IN ('admin', 'docente', 'alumno', 'apoderado')
    ) THEN
        RAISE EXCEPTION 'Los roles sembrados no coinciden con admin, docente, alumno, apoderado';
    END IF;
    RAISE NOTICE 'Restauración verificada: %', obtenido;
END
$$;

SELECT 'tablas' AS objeto, count(*) AS cantidad FROM pg_tables WHERE schemaname = 'excelencia_seruna'
UNION ALL SELECT 'vistas', count(*) FROM pg_views WHERE schemaname = 'excelencia_seruna'
UNION ALL SELECT 'funciones', count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'excelencia_seruna'
UNION ALL SELECT 'triggers', count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'excelencia_seruna' AND NOT t.tgisinternal;
