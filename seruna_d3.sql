--
-- PostgreSQL database dump
--

\restrict CsGWvyCeYvOccGgvnGeNTDCmCxbk59Qk97spGTPNtTrLMFNdVGo9GzHVLyA5zjr

-- Dumped from database version 18.7
-- Dumped by pg_dump version 18.7

-- Started on 2026-11-17 10:59:11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 7 (class 2615 OID 17115)
-- Name: excelencia_seruna; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA excelencia_seruna;


ALTER SCHEMA excelencia_seruna OWNER TO postgres;

--
-- TOC entry 2 (class 3079 OID 16389)
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- TOC entry 7071 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- TOC entry 432 (class 1255 OID 19358)
-- Name: aplicar_justificacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.aplicar_justificacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF NEW.estado = 'aprobada' THEN
        IF NEW.asistencia_estudiante_id IS NOT NULL THEN
            UPDATE asistencia_estudiantes SET estado = 'justificado',
                registrado_por = NEW.resuelta_por, motivo = 'Justificación aprobada #' || NEW.id
            WHERE id = NEW.asistencia_estudiante_id;
        ELSE
            UPDATE asistencia_docentes SET estado = 'justificado',
                registrado_por = NEW.resuelta_por, motivo = 'Justificación aprobada #' || NEW.id
            WHERE id = NEW.asistencia_docente_id;
        END IF;
    END IF;
    INSERT INTO bitacora (actor_id, accion, entidad, registro_id, resultado)
    VALUES (coalesce(NEW.resuelta_por, NEW.solicitada_por), lower(TG_OP),
        'justificaciones_asistencia', NEW.id::text, NEW.estado);
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.aplicar_justificacion() OWNER TO postgres;

--
-- TOC entry 588 (class 1255 OID 19350)
-- Name: auditar_asistencia(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.auditar_asistencia() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    INSERT INTO bitacora (actor_id, accion, entidad, registro_id, motivo, resultado)
    VALUES (NEW.registrado_por, lower(TG_OP), TG_TABLE_NAME, NEW.id::text, NEW.motivo,
        CASE WHEN TG_OP = 'INSERT' THEN NEW.estado ELSE OLD.estado || ' → ' || NEW.estado END);
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.auditar_asistencia() OWNER TO postgres;

--
-- TOC entry 610 (class 1255 OID 20144)
-- Name: auditar_cierre_academico(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.auditar_cierre_academico() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'publicaciones_merito' THEN
        INSERT INTO bitacora (actor_id,accion,entidad,registro_id,resultado)
        VALUES (NEW.publicado_por,'publicar',TG_TABLE_NAME,NEW.id::text,'ok');
    ELSE
        INSERT INTO bitacora (actor_id,accion,entidad,registro_id,resultado)
        VALUES (NEW.aprobado_por,'aprobar',TG_TABLE_NAME,NEW.id::text,'ok');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.auditar_cierre_academico() OWNER TO postgres;

--
-- TOC entry 583 (class 1255 OID 19824)
-- Name: auditar_documento_reporte(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.auditar_documento_reporte() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    INSERT INTO bitacora (actor_id, accion, entidad, registro_id, motivo, resultado)
    VALUES (coalesce(NEW.anulado_por, NEW.procesado_por, NEW.solicitado_por),
        lower(TG_OP), TG_TABLE_NAME, NEW.id::text, NEW.motivo_anulacion, NEW.estado);
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.auditar_documento_reporte() OWNER TO postgres;

--
-- TOC entry 433 (class 1255 OID 19679)
-- Name: auditar_planilla(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.auditar_planilla() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'horas_docentes' THEN
        INSERT INTO bitacora (actor_id, accion, entidad, registro_id, motivo, resultado)
        VALUES (NEW.resuelto_por, 'resolver', TG_TABLE_NAME, NEW.id::text, NEW.decision, NEW.estado);
    ELSIF TG_TABLE_NAME = 'liquidaciones_docentes' THEN
        INSERT INTO bitacora (actor_id, accion, entidad, registro_id, motivo, resultado)
        VALUES (NEW.aprobado_por, 'aprobar', TG_TABLE_NAME, NEW.id::text, NEW.motivo_prorrateo, NEW.estado);
    ELSIF TG_TABLE_NAME = 'reversiones_pago_docente' THEN
        INSERT INTO bitacora (actor_id, accion, entidad, registro_id, motivo, resultado)
        VALUES (NEW.autorizado_por, 'revertir', TG_TABLE_NAME, NEW.id::text, NEW.motivo, 'ok');
    ELSE
        INSERT INTO bitacora (actor_id, accion, entidad, registro_id, resultado)
        VALUES (NEW.registrado_por, 'registrar', TG_TABLE_NAME, NEW.id::text, 'ok');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.auditar_planilla() OWNER TO postgres;

--
-- TOC entry 515 (class 1255 OID 20277)
-- Name: avanzar_lote_historico(bigint, bigint); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.avanzar_lote_historico(p_lote bigint, p_actor bigint) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    lote lotes_importacion;
    conteos jsonb;
    destino text;
BEGIN
    PERFORM validar_operador_importacion(p_actor);
    SELECT * INTO STRICT lote FROM lotes_importacion WHERE id = p_lote FOR UPDATE;
    CASE lote.estado
        WHEN 'carga' THEN
            SELECT jsonb_object_agg(entidad, cargadas) INTO conteos
            FROM resumen_importacion_historica WHERE lote_id = p_lote;
            IF conteos IS NULL OR conteos <> lote.conteos_esperados THEN
                RAISE EXCEPTION 'El conteo de filas cargadas difiere del manifiesto';
            END IF;
            destino := 'revision';
            UPDATE lotes_importacion SET estado = destino, sellado_en = clock_timestamp() WHERE id = p_lote;
        WHEN 'revision' THEN
            IF EXISTS (SELECT 1 FROM resumen_importacion_historica WHERE lote_id = p_lote AND pendientes > 0) THEN
                RAISE EXCEPTION 'El lote tiene filas pendientes de conciliación';
            END IF;
            destino := 'cerrado';
            UPDATE lotes_importacion SET estado = destino, cerrado_en = clock_timestamp() WHERE id = p_lote;
        ELSE
            RETURN lote.estado;
    END CASE;
    INSERT INTO bitacora (actor_id,accion,entidad,registro_id,resultado)
    VALUES (p_actor,'avanzar','lotes_importacion',p_lote::text,destino);
    RETURN destino;
END;
$$;


ALTER FUNCTION excelencia_seruna.avanzar_lote_historico(p_lote bigint, p_actor bigint) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 408 (class 1259 OID 20234)
-- Name: conciliaciones_historicas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.conciliaciones_historicas (
    lote_id bigint NOT NULL,
    entidad text NOT NULL,
    clave_origen text NOT NULL,
    accion text NOT NULL,
    destino_id bigint,
    motivo text NOT NULL,
    revisada_por bigint NOT NULL,
    revisada_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT conciliaciones_historicas_accion_check CHECK ((accion = ANY (ARRAY['crear'::text, 'vincular'::text, 'archivar'::text, 'excluir'::text]))),
    CONSTRAINT conciliaciones_historicas_check CHECK (((accion = ANY (ARRAY['crear'::text, 'vincular'::text])) = (destino_id IS NOT NULL))),
    CONSTRAINT conciliaciones_historicas_motivo_check CHECK ((btrim(motivo) <> ''::text))
);


ALTER TABLE excelencia_seruna.conciliaciones_historicas OWNER TO postgres;

--
-- TOC entry 478 (class 1255 OID 20278)
-- Name: conciliar_fila_historica(bigint, text, text, bigint, text, text, bigint, text, bigint); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.conciliar_fila_historica(p_lote bigint, p_entidad text, p_clave text, p_actor bigint, p_accion text, p_motivo text, p_destino bigint DEFAULT NULL::bigint, p_codigo text DEFAULT NULL::text, p_persona_existente bigint DEFAULT NULL::bigint) RETURNS excelencia_seruna.conciliaciones_historicas
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    lote lotes_importacion;
    fila filas_importacion;
    resultado conciliaciones_historicas;
    equivalente equivalencias_historicas;
    persona bigint;
    destino bigint := p_destino;
    nacimiento date;
BEGIN
    PERFORM validar_operador_importacion(p_actor);
    IF p_accion IS NULL OR p_accion NOT IN ('crear','vincular','archivar','excluir')
       OR nullif(btrim(p_motivo),'') IS NULL THEN
        RAISE EXCEPTION 'Indique una acción y su sustento';
    END IF;
    IF (p_accion = 'vincular') <> (p_destino IS NOT NULL)
       OR (p_accion <> 'crear' AND (p_codigo IS NOT NULL OR p_persona_existente IS NOT NULL)) THEN
        RAISE EXCEPTION 'Los parámetros no corresponden a la acción';
    END IF;
    SELECT * INTO STRICT lote FROM lotes_importacion WHERE id = p_lote FOR SHARE;
    SELECT * INTO STRICT fila FROM filas_importacion
    WHERE lote_id = p_lote AND entidad = p_entidad AND clave_origen = p_clave FOR UPDATE;

    SELECT * INTO resultado FROM conciliaciones_historicas
    WHERE lote_id = p_lote AND entidad = p_entidad AND clave_origen = p_clave;
    IF FOUND THEN
        IF p_accion = resultado.accion AND p_motivo = resultado.motivo
           AND p_accion <> 'crear' AND p_destino IS NOT DISTINCT FROM resultado.destino_id THEN
            RETURN resultado;
        END IF;
        RAISE EXCEPTION 'La fila ya está conciliada en este lote';
    END IF;
    IF lote.estado <> 'revision' THEN RAISE EXCEPTION 'El lote debe estar en revisión'; END IF;

    IF p_accion IN ('crear','vincular') THEN
        IF p_entidad NOT IN ('estudiantes','profesores','cursos','estudiantes_cursos') THEN
            RAISE EXCEPTION 'Este origen se conserva en el archivo histórico';
        END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(
            jsonb_build_array(lote.sistema,p_entidad,p_clave)::text, 0));
        SELECT * INTO equivalente FROM equivalencias_historicas
        WHERE sistema = lote.sistema AND entidad = p_entidad AND clave_origen = p_clave;

        IF FOUND THEN
            IF p_accion <> 'vincular' OR destino IS DISTINCT FROM coalesce(
                equivalente.estudiante_id,equivalente.docente_id,equivalente.curso_id,equivalente.matricula_id
            ) THEN
                RAISE EXCEPTION 'El origen ya tiene otra equivalencia registrada';
            END IF;
        ELSE
            IF p_accion = 'crear' THEN
                IF p_entidad NOT IN ('estudiantes','profesores') OR nullif(btrim(p_codigo),'') IS NULL THEN
                    RAISE EXCEPTION 'Solo se crean perfiles con código interno validado';
                END IF;
                persona := p_persona_existente;
                IF persona IS NULL THEN
                    IF nullif(btrim(fila.datos->>'primer_nombre'),'') IS NULL
                       OR nullif(btrim(fila.datos->>'apellido'),'') IS NULL THEN
                        RAISE EXCEPTION 'Verifique nombres y apellidos o vincule con una persona existente';
                    END IF;
                    nacimiento := nullif(nullif(fila.datos->>'fecha_nacimiento',''),'0000-00-00')::date;
                    IF nacimiento > current_date THEN RAISE EXCEPTION 'Verifique la fecha de nacimiento'; END IF;
                    INSERT INTO personas (nombres,apellidos,fecha_nacimiento,correo_contacto,telefono,direccion)
                    VALUES (btrim(fila.datos->>'primer_nombre'),btrim(fila.datos->>'apellido'),nacimiento,
                        nullif(btrim(fila.datos->>'correo'), ''),
                        nullif(btrim(coalesce(fila.datos->>'telefono',fila.datos->>'numero_telefono')), ''),
                        nullif(btrim(fila.datos->>'direccion'), ''))
                    RETURNING id INTO persona;
                END IF;
                IF p_entidad = 'estudiantes' THEN
                    INSERT INTO estudiantes (persona_id,codigo,activo) VALUES (persona,btrim(p_codigo),false)
                    RETURNING id INTO destino;
                ELSE
                    INSERT INTO docentes (persona_id,codigo,activo) VALUES (persona,btrim(p_codigo),false)
                    RETURNING id INTO destino;
                END IF;
            END IF;

            IF p_entidad = 'estudiantes_cursos' AND NOT EXISTS (
                SELECT 1 FROM matriculas m
                JOIN equivalencias_historicas e ON e.estudiante_id = m.estudiante_id
                WHERE m.id = destino AND m.confirmada_en IS NOT NULL AND m.estado <> 'anulada'
                  AND e.sistema = lote.sistema AND e.entidad = 'estudiantes'
                  AND e.clave_origen = fila.datos->>'id_estudiante'
            ) THEN
                RAISE EXCEPTION 'La matrícula debe estar confirmada y pertenecer al estudiante conciliado';
            END IF;

            INSERT INTO equivalencias_historicas
                (sistema,entidad,clave_origen,lote_id,estudiante_id,docente_id,curso_id,matricula_id)
            VALUES (lote.sistema,p_entidad,p_clave,p_lote,
                CASE WHEN p_entidad = 'estudiantes' THEN destino END,
                CASE WHEN p_entidad = 'profesores' THEN destino END,
                CASE WHEN p_entidad = 'cursos' THEN destino END,
                CASE WHEN p_entidad = 'estudiantes_cursos' THEN destino END);
        END IF;
    END IF;

    INSERT INTO conciliaciones_historicas (lote_id,entidad,clave_origen,accion,destino_id,motivo,revisada_por)
    VALUES (p_lote,p_entidad,p_clave,p_accion,destino,p_motivo,p_actor) RETURNING * INTO resultado;
    INSERT INTO bitacora (actor_id,accion,entidad,registro_id,motivo,resultado)
    VALUES (p_actor,'conciliar','lotes_importacion',p_lote::text,p_motivo,p_accion);
    RETURN resultado;
END;
$$;


ALTER FUNCTION excelencia_seruna.conciliar_fila_historica(p_lote bigint, p_entidad text, p_clave text, p_actor bigint, p_accion text, p_motivo text, p_destino bigint, p_codigo text, p_persona_existente bigint) OWNER TO postgres;

--
-- TOC entry 450 (class 1255 OID 18875)
-- Name: conservar_calificacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.conservar_calificacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Use una rectificación para conservar el historial de la calificación';
END;
$$;


ALTER FUNCTION excelencia_seruna.conservar_calificacion() OWNER TO postgres;

--
-- TOC entry 442 (class 1255 OID 19677)
-- Name: conservar_condiciones_contrato(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.conservar_condiciones_contrato() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF NEW IS DISTINCT FROM OLD AND (
        EXISTS (SELECT 1 FROM horas_docentes WHERE contrato_id = OLD.id)
        OR EXISTS (SELECT 1 FROM liquidaciones_docentes WHERE contrato_id = OLD.id)
    ) THEN
        IF (to_jsonb(NEW) - 'vigencia') IS DISTINCT FROM (to_jsonb(OLD) - 'vigencia')
           OR EXISTS (
               SELECT 1 FROM horas_docentes WHERE contrato_id = OLD.id AND NOT (NEW.vigencia @> fecha)
           )
           OR EXISTS (
               SELECT 1 FROM liquidaciones_docentes l JOIN periodos_liquidacion p ON p.id = l.periodo_id
               WHERE l.contrato_id = OLD.id AND l.vigencia_aplicada <>
                   NEW.vigencia * daterange(p.mes, (p.mes + interval '1 month')::date, '[)')
           ) THEN
            RAISE EXCEPTION 'El cambio de contrato alteraría horas o condiciones ya registradas';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.conservar_condiciones_contrato() OWNER TO postgres;

--
-- TOC entry 615 (class 1255 OID 19198)
-- Name: conservar_evento_asistencia(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.conservar_evento_asistencia() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'El historial de asistencia es de solo inserción';
END;
$$;


ALTER FUNCTION excelencia_seruna.conservar_evento_asistencia() OWNER TO postgres;

--
-- TOC entry 506 (class 1255 OID 19669)
-- Name: conservar_historial_planilla(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.conservar_historial_planilla() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'La operación sobrescribiría el historial de planilla';
END;
$$;


ALTER FUNCTION excelencia_seruna.conservar_historial_planilla() OWNER TO postgres;

--
-- TOC entry 602 (class 1255 OID 20263)
-- Name: controlar_carga_historica(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.controlar_carga_historica() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'El archivo de origen es inmutable'; END IF;
    PERFORM id FROM lotes_importacion WHERE id = NEW.lote_id AND estado = 'carga' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El lote debe estar en carga'; END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_each(NEW.datos) AS d
        WHERE jsonb_typeof(d.value) IN ('object','array')
           OR d.key ~* '(clave|contras|password|hash|token|secret|salt|credencial)'
    ) THEN
        RAISE EXCEPTION 'La fila contiene credenciales o una estructura no permitida';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.controlar_carga_historica() OWNER TO postgres;

--
-- TOC entry 593 (class 1255 OID 20043)
-- Name: controlar_cierre_anual(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.controlar_cierre_anual() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    previo cierres_anuales;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.estado = 'aprobado' THEN RAISE EXCEPTION 'El cierre aprobado debe conservarse'; END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
        IF OLD.estado = 'aprobado' OR
           (to_jsonb(NEW) - ARRAY['estado','situacion','sustento','evidencia_id','aprobado_por','aprobado_en'])
           IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['estado','situacion','sustento','evidencia_id','aprobado_por','aprobado_en']) THEN
            RAISE EXCEPTION 'El cierre aprobado o su contexto no se pueden modificar';
        END IF;
        IF NEW.estado <> 'aprobado' THEN RETURN NEW; END IF;
    ELSIF NEW.estado <> 'borrador' THEN
        RAISE EXCEPTION 'Registre primero un cierre en borrador';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reglas_evaluacion WHERE id = NEW.regla_id AND aprobado_en <= clock_timestamp()) THEN
        RAISE EXCEPTION 'Se requiere una regla de evaluación aprobada';
    END IF;
    IF NEW.anterior_id IS NOT NULL THEN
        SELECT * INTO STRICT previo FROM cierres_anuales WHERE id = NEW.anterior_id;
        IF previo.estado <> 'aprobado' OR previo.version <> NEW.version - 1
           OR previo.fecha_corte <> NEW.fecha_corte OR previo.seccion_id <> NEW.seccion_id
           OR (NEW.etapa = 'rectificacion' AND previo.etapa = 'recuperacion')
           OR (NEW.etapa = 'recuperacion' AND previo.plan_id <> NEW.plan_id) THEN
            RAISE EXCEPTION 'La revisión requiere el cierre aprobado anterior de la misma trayectoria';
        END IF;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM matricula_secciones ms JOIN matriculas m ON m.id = ms.matricula_id
        JOIN seccion_planes_estudio sp ON sp.seccion_id = ms.seccion_id
        WHERE m.id = NEW.matricula_id AND m.confirmada_en IS NOT NULL AND m.estado <> 'anulada'
          AND ms.seccion_id = NEW.seccion_id AND sp.plan_id = NEW.plan_id
          AND ms.vigencia @> NEW.fecha_corte AND sp.vigencia @> NEW.fecha_corte
    ) OR NEW.fecha_corte IS DISTINCT FROM (
        SELECT fin FROM bimestres WHERE anio_id = NEW.anio_id AND numero = 4
    ) OR (SELECT count(*) FROM bimestres WHERE anio_id = NEW.anio_id) <> 4 THEN
        RAISE EXCEPTION 'Configure los cuatro bimestres, la sección y el plan al cierre del cuarto bimestre';
    END IF;
    IF NEW.estado = 'aprobado' THEN
        IF EXISTS (
            SELECT 1 FROM bimestres b
            WHERE b.anio_id = NEW.anio_id AND EXISTS (
                SELECT 1 FROM matricula_secciones ms WHERE ms.matricula_id = NEW.matricula_id
                    AND ms.vigencia && daterange(b.inicio, b.fin, '[]')
            ) AND NOT EXISTS (
                SELECT 1 FROM calificaciones_competencia c JOIN cierres_evaluacion x ON x.id = c.cierre_id
                WHERE c.matricula_id = NEW.matricula_id AND c.bimestre_id = b.id AND x.estado = 'publicado'
            )
        ) THEN
            RAISE EXCEPTION 'Hay bimestres cursados sin resultados publicados';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM plan_competencias WHERE plan_id = NEW.plan_id)
           OR EXISTS (
               SELECT 1 FROM plan_competencias pc WHERE pc.plan_id = NEW.plan_id AND NOT EXISTS (
                   SELECT 1 FROM resultados_anuales_competencia r
                   WHERE r.cierre_anual_id = NEW.id AND r.competencia_id = pc.competencia_id
               )
           ) THEN
            RAISE EXCEPTION 'Faltan resultados anuales del plan de estudios';
        END IF;
        IF NEW.situacion = 'recuperacion' AND NOT EXISTS (
            SELECT 1 FROM resultados_anuales_competencia
            WHERE cierre_anual_id = NEW.id AND requiere_recuperacion
        ) THEN
            RAISE EXCEPTION 'Identifique las competencias pendientes de recuperación';
        END IF;
        IF NEW.etapa = 'recuperacion' AND NOT EXISTS (
            SELECT 1 FROM resultados_anuales_competencia
            WHERE cierre_anual_id = NEW.id AND recuperacion_id IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Vincule al menos una evaluación de recuperación aprobada';
        END IF;
        IF NEW.etapa = 'recuperacion' AND EXISTS (
            SELECT 1 FROM resultados_anuales_competencia nuevo
            JOIN resultados_anuales_competencia original
              ON original.cierre_anual_id = NEW.anterior_id AND original.competencia_id = nuevo.competencia_id
            WHERE nuevo.cierre_anual_id = NEW.id AND nuevo.resultado_anterior_id IS NOT NULL
              AND original.requiere_recuperacion AND NOT nuevo.requiere_recuperacion
        ) THEN
            RAISE EXCEPTION 'Una competencia pendiente requiere una evaluación aprobada para quedar resuelta';
        END IF;
        IF NEW.etapa <> 'recuperacion' AND EXISTS (
            SELECT 1 FROM resultados_anuales_competencia r
            LEFT JOIN ultimos_logros_publicados u ON u.matricula_id = NEW.matricula_id AND u.competencia_id = r.competencia_id
            WHERE r.cierre_anual_id = NEW.id
              AND (r.calificacion_id, r.nivel_logro, r.conclusion)
                  IS DISTINCT FROM (u.calificacion_id, u.nivel_logro, u.conclusion)
        ) THEN
            RAISE EXCEPTION 'Actualice el borrador según los últimos logros publicados';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.controlar_cierre_anual() OWNER TO postgres;

--
-- TOC entry 634 (class 1255 OID 20047)
-- Name: controlar_evaluacion_recuperacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.controlar_evaluacion_recuperacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'El historial de recuperación debe conservarse';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado <> 'borrador' OR (NEW.estado = 'aprobada' AND
           (to_jsonb(NEW) - ARRAY['estado','aprobado_por','aprobado_en'])
           IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['estado','aprobado_por','aprobado_en'])) THEN
            RAISE EXCEPTION 'Apruebe el borrador sin modificar su contenido';
        END IF;
    ELSIF NEW.estado <> 'borrador' THEN
        RAISE EXCEPTION 'Registre la evaluación de recuperación primero como borrador';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM resultados_anuales_competencia r JOIN cierres_anuales c ON c.id = r.cierre_anual_id
        WHERE r.id = NEW.resultado_origen_id AND r.requiere_recuperacion AND c.estado = 'aprobado'
          AND NEW.fecha >= c.fecha_corte
    ) THEN
        RAISE EXCEPTION 'La competencia debe estar pendiente en un cierre aprobado';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.controlar_evaluacion_recuperacion() OWNER TO postgres;

--
-- TOC entry 536 (class 1255 OID 19674)
-- Name: controlar_periodo_planilla(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.controlar_periodo_planilla() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'abierto' THEN
            RAISE EXCEPTION 'El período debe empezar abierto';
        END IF;
    ELSIF NEW IS DISTINCT FROM OLD THEN
        IF OLD.estado <> 'abierto' OR NEW.estado <> 'cerrado'
           OR (to_jsonb(NEW) - ARRAY['estado','cerrado_por','cerrado_en'])
              IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['estado','cerrado_por','cerrado_en']) THEN
            RAISE EXCEPTION 'Solo se permite cerrar el período conservando sus datos';
        END IF;
        IF EXISTS (SELECT 1 FROM liquidaciones_docentes WHERE periodo_id = OLD.id AND estado = 'borrador')
           OR EXISTS (
               SELECT 1 FROM horas_docentes h
               WHERE daterange(OLD.mes, (OLD.mes + interval '1 month')::date, '[)') @> h.fecha
                 AND (h.estado = 'pendiente' OR (h.estado = 'aprobada' AND NOT EXISTS (
                     SELECT 1 FROM detalle_liquidacion_docente d WHERE d.hora_docente_id = h.id
                 )))
           ) THEN
            RAISE EXCEPTION 'El período tiene horas o liquidaciones pendientes';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.controlar_periodo_planilla() OWNER TO postgres;

--
-- TOC entry 453 (class 1255 OID 20135)
-- Name: controlar_publicacion_merito(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.controlar_publicacion_merito() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    cantidad integer;
    ultimo integer;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.publicado_en IS NOT NULL THEN RAISE EXCEPTION 'La publicación de mérito debe conservarse'; END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
        IF OLD.publicado_en IS NOT NULL OR
           (to_jsonb(NEW) - ARRAY['publicado_en','publicado_por'])
           IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['publicado_en','publicado_por']) THEN
            RAISE EXCEPTION 'Cree una nueva versión de la publicación de mérito';
        END IF;
    ELSIF NEW.publicado_en IS NOT NULL THEN
        RAISE EXCEPTION 'Registre el listado antes de publicarlo';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM grados g JOIN niveles n ON n.id = g.nivel_id
        JOIN reglas_evaluacion r ON r.id = NEW.regla_id
        WHERE g.id = NEW.grado_id AND n.codigo = 'secundaria'
          AND (NEW.alcance = 'grado' OR g.numero = 5)
          AND r.aprobado_en <= clock_timestamp()
    ) THEN
        RAISE EXCEPTION 'El mérito requiere Secundaria y una regla aprobada; el alcance completo usa quinto grado';
    END IF;
    IF NEW.publicado_en IS NOT NULL THEN
        SELECT count(*), max(puesto) INTO cantidad, ultimo FROM orden_merito WHERE publicacion_id = NEW.id;
        IF cantidad = 0 OR cantidad <> ultimo THEN
            RAISE EXCEPTION 'El listado debe contener puestos consecutivos desde el primero';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.controlar_publicacion_merito() OWNER TO postgres;

--
-- TOC entry 554 (class 1255 OID 20137)
-- Name: controlar_puesto_merito(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.controlar_puesto_merito() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    publicacion publicaciones_merito;
BEGIN
    IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Reemplace el puesto mientras el listado esté en borrador'; END IF;
    UPDATE publicaciones_merito SET version = version
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.publicacion_id ELSE NEW.publicacion_id END
    RETURNING * INTO STRICT publicacion;
    IF publicacion.publicado_en IS NOT NULL THEN RAISE EXCEPTION 'El listado publicado es inmutable'; END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM cierres_anuales c WHERE c.id = NEW.cierre_anual_id AND c.matricula_id = NEW.matricula_id
          AND c.anio_id = publicacion.anio_id AND c.grado_id = publicacion.grado_id
          AND c.estado = 'aprobado' AND c.etapa <> 'recuperacion'
    ) THEN
        RAISE EXCEPTION 'El puesto debe apuntar a un cierre lectivo aprobado del mismo año y grado';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.controlar_puesto_merito() OWNER TO postgres;

--
-- TOC entry 495 (class 1255 OID 20045)
-- Name: controlar_resultado_anual(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.controlar_resultado_anual() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    cierre cierres_anuales;
    origen record;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Reemplace el resultado mientras el cierre esté en borrador';
    END IF;
    UPDATE cierres_anuales SET estado = estado
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.cierre_anual_id ELSE NEW.cierre_anual_id END
    RETURNING * INTO STRICT cierre;
    IF cierre.estado <> 'borrador' THEN RAISE EXCEPTION 'El cierre aprobado es inmutable'; END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

    IF cierre.etapa <> 'recuperacion' THEN
        SELECT nivel_logro, conclusion INTO origen FROM ultimos_logros_publicados
        WHERE matricula_id = cierre.matricula_id AND competencia_id = NEW.competencia_id
          AND calificacion_id = NEW.calificacion_id;
    ELSIF NEW.recuperacion_id IS NOT NULL THEN
        SELECT e.nivel_logro, e.conclusion INTO origen
        FROM evaluaciones_recuperacion e JOIN resultados_anuales_competencia r ON r.id = e.resultado_origen_id
        WHERE e.id = NEW.recuperacion_id AND e.estado = 'aprobada'
          AND r.cierre_anual_id = cierre.anterior_id AND r.competencia_id = NEW.competencia_id;
    ELSE
        SELECT nivel_logro, conclusion INTO origen FROM resultados_anuales_competencia
        WHERE id = NEW.resultado_anterior_id AND cierre_anual_id = cierre.anterior_id
          AND competencia_id = NEW.competencia_id;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'La fuente del resultado anual no coincide con el cierre'; END IF;
    NEW.nivel_logro := origen.nivel_logro;
    NEW.conclusion := origen.conclusion;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.controlar_resultado_anual() OWNER TO postgres;

--
-- TOC entry 305 (class 1259 OID 18300)
-- Name: recibos_caja; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.recibos_caja (
    id bigint NOT NULL,
    pago_id bigint NOT NULL,
    serie_id bigint NOT NULL,
    numero bigint NOT NULL,
    emitido_por bigint NOT NULL,
    emitido_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recibos_caja_numero_check CHECK ((numero > 0))
);


ALTER TABLE excelencia_seruna.recibos_caja OWNER TO postgres;

--
-- TOC entry 493 (class 1255 OID 18388)
-- Name: emitir_recibo_caja(bigint, bigint, bigint); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.emitir_recibo_caja(p_pago_id bigint, p_serie_id bigint, p_usuario_id bigint) RETURNS excelencia_seruna.recibos_caja
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    recibo recibos_caja;
    correlativo bigint;
    total numeric;
BEGIN
    SELECT importe INTO STRICT total FROM pagos WHERE id = p_pago_id FOR UPDATE;
    SELECT * INTO recibo FROM recibos_caja WHERE pago_id = p_pago_id;
    IF FOUND THEN
        RETURN recibo;
    END IF;
    IF EXISTS (SELECT 1 FROM reversiones_pago WHERE pago_id = p_pago_id)
        OR (SELECT coalesce(sum(importe), 0) FROM aplicaciones_pago WHERE pago_id = p_pago_id) <> total THEN
        RAISE EXCEPTION 'El recibo requiere un pago vigente con el importe totalmente aplicado';
    END IF;

    UPDATE series_recibos SET siguiente_numero = siguiente_numero + 1
    WHERE id = p_serie_id AND activa
    RETURNING siguiente_numero - 1 INTO STRICT correlativo;

    INSERT INTO recibos_caja (pago_id, serie_id, numero, emitido_por)
    VALUES (p_pago_id, p_serie_id, correlativo, p_usuario_id)
    RETURNING * INTO recibo;
    RETURN recibo;
END;
$$;


ALTER FUNCTION excelencia_seruna.emitir_recibo_caja(p_pago_id bigint, p_serie_id bigint, p_usuario_id bigint) OWNER TO postgres;

--
-- TOC entry 586 (class 1255 OID 19820)
-- Name: indicadores_dashboard(bigint, date, date, bigint); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.indicadores_dashboard(p_anio bigint, p_desde date, p_hasta date, p_bimestre bigint DEFAULT NULL::bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    resultado jsonb;
BEGIN
    IF p_desde IS NULL OR p_hasta IS NULL OR p_desde > p_hasta OR NOT isfinite(p_hasta)
       OR NOT isfinite(p_desde) OR NOT EXISTS (SELECT 1 FROM anios_academicos WHERE id = p_anio) THEN
        RAISE EXCEPTION 'Indique un año académico y un rango de fechas válido';
    END IF;
    IF p_bimestre IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bimestres WHERE id = p_bimestre AND anio_id = p_anio) THEN
        RAISE EXCEPTION 'El bimestre no pertenece al año académico';
    END IF;

    WITH limites AS (
        SELECT p_desde::timestamp AT TIME ZONE 'America/Lima' AS desde,
               (p_hasta + 1)::timestamp AT TIME ZONE 'America/Lima' AS hasta
    ), ocupacion AS (
        SELECT s.id, s.cupo, count(m.id) AS alumnos,
               count(m.id) FILTER (WHERE ms.tipo_vacante = 'regular') AS regulares,
               count(m.id) FILTER (WHERE ms.tipo_vacante = 'reservada') AS reservadas,
               s.reserva
        FROM secciones s CROSS JOIN limites l
        LEFT JOIN matricula_secciones ms ON ms.seccion_id = s.id AND ms.vigencia @> p_hasta
        LEFT JOIN matriculas m ON m.id = ms.matricula_id AND m.confirmada_en < l.hasta AND m.estado <> 'anulada'
        WHERE s.anio_id = p_anio AND s.activa
        GROUP BY s.id
    ), cobros AS (
        SELECT sum(a.importe) AS total
        FROM aplicaciones_pago a JOIN cuotas q ON q.id = a.cuota_id JOIN pagos p ON p.id = a.pago_id
        CROSS JOIN limites l WHERE q.anio_id = p_anio AND p.pagado_en >= l.desde AND p.pagado_en < l.hasta
    ), salidas_caja AS (
        SELECT sum(d.importe) AS devoluciones
        FROM devoluciones d JOIN aplicaciones_pago a ON a.id = d.aplicacion_id
        JOIN cuotas q ON q.id = a.cuota_id CROSS JOIN limites l
        WHERE q.anio_id = p_anio AND d.devuelto_en >= l.desde AND d.devuelto_en < l.hasta
    ), reversiones AS (
        SELECT sum(a.importe - coalesce((
            SELECT sum(d.importe) FROM devoluciones d
            WHERE d.aplicacion_id = a.id AND d.devuelto_en <= r.revertido_en
        ),0)) AS total
        FROM reversiones_pago r JOIN aplicaciones_pago a ON a.pago_id = r.pago_id
        JOIN cuotas q ON q.id = a.cuota_id CROSS JOIN limites l
        WHERE q.anio_id = p_anio AND r.revertido_en >= l.desde AND r.revertido_en < l.hasta
    ), cuotas_corte AS (
        SELECT * FROM reporte_cuotas_al_corte(p_anio, p_hasta)
    ), notas_esperadas AS (
        SELECT s.id AS seccion_id, ms.matricula_id, pc.competencia_id, b.id AS bimestre_id
        FROM bimestres b JOIN secciones s ON s.anio_id = b.anio_id
        JOIN seccion_planes_estudio sp ON sp.seccion_id = s.id AND sp.vigencia @> b.fin
        JOIN plan_competencias pc ON pc.plan_id = sp.plan_id
        JOIN matricula_secciones ms ON ms.seccion_id = s.id AND ms.vigencia @> b.fin
        JOIN matriculas m ON m.id = ms.matricula_id AND m.estado <> 'anulada' AND m.confirmada_en IS NOT NULL
        WHERE b.id = p_bimestre
    ), asistencia AS (
        SELECT 'alumnos' AS grupo, estado FROM asistencia_diaria_estudiantes
        WHERE anio_id = p_anio AND fecha BETWEEN p_desde AND p_hasta
        UNION ALL
        SELECT 'docentes', estado FROM asistencia_diaria_docentes
        WHERE anio_id = p_anio AND fecha BETWEEN p_desde AND p_hasta
    ), resumen_asistencia AS (
        SELECT g.grupo, count(a.estado) AS esperadas,
               count(*) FILTER (WHERE a.estado = 'presente') AS presentes,
               count(*) FILTER (WHERE a.estado = 'tarde') AS tardanzas,
               count(*) FILTER (WHERE a.estado = 'ausente') AS ausencias,
               count(*) FILTER (WHERE a.estado = 'justificado') AS justificadas,
               count(*) FILTER (WHERE a.estado = 'pendiente') AS pendientes
        FROM (VALUES ('alumnos'), ('docentes')) g(grupo)
        LEFT JOIN asistencia a ON a.grupo = g.grupo GROUP BY g.grupo
    )
    SELECT jsonb_build_object(
        'anio_id', p_anio, 'desde', p_desde, 'hasta', p_hasta, 'bimestre_id', p_bimestre,
        'matricula', (SELECT jsonb_build_object(
            'activas', coalesce(sum(alumnos),0), 'cupo', coalesce(sum(cupo),0),
            'vacantes_totales', coalesce(sum(greatest(cupo - alumnos,0)),0),
            'vacantes_regulares', coalesce(sum(greatest(least(cupo - alumnos, cupo - reserva - regulares),0)),0),
            'vacantes_reservadas', coalesce(sum(greatest(least(cupo - alumnos, reserva - reservadas),0)),0)
        ) FROM ocupacion),
        'pagos', (SELECT jsonb_build_object(
            'cobrado_bruto_aplicado', coalesce(c.total,0), 'devuelto', coalesce(d.devoluciones,0),
            'revertido', coalesce(r.total,0), 'cobrado_neto_aplicado',
                coalesce(c.total,0) - coalesce(d.devoluciones,0) - coalesce(r.total,0),
            'saldo_pendiente', (SELECT coalesce(sum(greatest(saldo,0)),0) FROM cuotas_corte),
            'saldo_vencido', (SELECT coalesce(sum(saldo),0) FROM cuotas_corte WHERE vence_en < p_hasta AND saldo > 0),
            'matriculas_con_mora', (SELECT count(DISTINCT matricula_id)
                FROM cuotas_corte WHERE vence_en < p_hasta AND saldo > 0)
        ) FROM cobros c CROSS JOIN salidas_caja d CROSS JOIN reversiones r),
        'notas', CASE WHEN p_bimestre IS NOT NULL THEN (
            SELECT jsonb_build_object('esperadas', count(*),
                'resueltas', count(*) FILTER (WHERE c.estado IN ('evaluada','no_desarrollada')),
                'publicadas', count(*) FILTER (WHERE x.publicado_en < l.hasta),
                'avance_pct', round(100.0 * count(*) FILTER (WHERE c.estado IN ('evaluada','no_desarrollada'))
                    / nullif(count(*),0),2))
            FROM notas_esperadas ne CROSS JOIN limites l
            LEFT JOIN calificaciones_competencia c USING (matricula_id, bimestre_id, competencia_id)
            LEFT JOIN cierres_evaluacion x ON x.id = c.cierre_id AND x.estado = 'publicado'
                AND x.seccion_id = ne.seccion_id
        ) END,
        'asistencia', (SELECT jsonb_object_agg(grupo, to_jsonb(s) - 'grupo') FROM resumen_asistencia s)
    ) INTO resultado;

    RETURN resultado;
END;
$$;


ALTER FUNCTION excelencia_seruna.indicadores_dashboard(p_anio bigint, p_desde date, p_hasta date, p_bimestre bigint) OWNER TO postgres;

--
-- TOC entry 387 (class 1259 OID 19748)
-- Name: documentos_emitidos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.documentos_emitidos (
    id bigint NOT NULL,
    solicitud_uuid uuid NOT NULL,
    plantilla_id bigint NOT NULL,
    tipo text NOT NULL,
    anio_id bigint NOT NULL,
    formato text NOT NULL,
    parametros jsonb NOT NULL,
    datos jsonb NOT NULL,
    solicitado_por bigint NOT NULL,
    solicitado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    estado text DEFAULT 'preparado'::text NOT NULL,
    archivo_id bigint,
    procesado_por bigint,
    procesado_en timestamp with time zone,
    motivo_fallo text,
    anulado_por bigint,
    anulado_en timestamp with time zone,
    motivo_anulacion text,
    CONSTRAINT documentos_emitidos_check CHECK ((procesado_en >= solicitado_en)),
    CONSTRAINT documentos_emitidos_check1 CHECK ((anulado_en >= procesado_en)),
    CONSTRAINT documentos_emitidos_check2 CHECK ((((estado = 'preparado'::text) AND (num_nonnulls(archivo_id, procesado_por, procesado_en, motivo_fallo) = 0)) OR ((estado = ANY (ARRAY['emitido'::text, 'anulado'::text])) AND (num_nonnulls(archivo_id, procesado_por, procesado_en) = 3) AND (motivo_fallo IS NULL)) OR ((estado = 'fallido'::text) AND (archivo_id IS NULL) AND (procesado_por IS NOT NULL) AND (procesado_en IS NOT NULL) AND (motivo_fallo IS NOT NULL) AND (btrim(motivo_fallo) <> ''::text)))),
    CONSTRAINT documentos_emitidos_check3 CHECK ((((estado <> 'anulado'::text) AND (num_nonnulls(anulado_por, anulado_en, motivo_anulacion) = 0)) OR ((estado = 'anulado'::text) AND (anulado_por IS NOT NULL) AND (anulado_en IS NOT NULL) AND (motivo_anulacion IS NOT NULL) AND (btrim(motivo_anulacion) <> ''::text)))),
    CONSTRAINT documentos_emitidos_datos_check CHECK ((jsonb_typeof(datos) = 'object'::text)),
    CONSTRAINT documentos_emitidos_estado_check CHECK ((estado = ANY (ARRAY['preparado'::text, 'emitido'::text, 'fallido'::text, 'anulado'::text]))),
    CONSTRAINT documentos_emitidos_parametros_check CHECK ((jsonb_typeof(parametros) = 'object'::text))
);


ALTER TABLE excelencia_seruna.documentos_emitidos OWNER TO postgres;

--
-- TOC entry 674 (class 1255 OID 19822)
-- Name: preparar_documento_reporte(uuid, bigint, bigint, date, date, bigint, bigint, bigint); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.preparar_documento_reporte(p_uuid uuid, p_plantilla bigint, p_actor bigint, p_desde date, p_hasta date, p_matricula bigint DEFAULT NULL::bigint, p_seccion bigint DEFAULT NULL::bigint, p_bimestre bigint DEFAULT NULL::bigint) RETURNS excelencia_seruna.documentos_emitidos
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    plantilla plantillas_documento;
    documento documentos_emitidos;
    parametros jsonb;
    filas jsonb;
BEGIN
    IF p_uuid IS NULL OR p_desde IS NULL OR p_hasta IS NULL OR p_desde > p_hasta
       OR NOT isfinite(p_desde) OR NOT isfinite(p_hasta) THEN
        RAISE EXCEPTION 'Indique identificador y fechas válidas para el reporte';
    END IF;
    SELECT * INTO STRICT plantilla FROM plantillas_documento
    WHERE id = p_plantilla AND publicada_en <= clock_timestamp() FOR SHARE;
    IF NOT EXISTS (
        SELECT 1 FROM usuarios u JOIN usuario_roles ur ON ur.usuario_id = u.id
        JOIN rol_permisos rp ON rp.rol_id = ur.rol_id JOIN permisos p ON p.id = rp.permiso_id
        JOIN tipos_reporte t ON t.permiso = p.codigo
        WHERE u.id = p_actor AND u.estado = 'activo' AND t.codigo = plantilla.tipo
    ) THEN
        RAISE EXCEPTION 'La cuenta no está autorizada para este tipo de reporte';
    END IF;
    IF (p_matricula IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM matriculas WHERE id = p_matricula AND anio_id = plantilla.anio_id
    )) OR (p_seccion IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM secciones WHERE id = p_seccion AND anio_id = plantilla.anio_id
    )) OR (p_bimestre IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM bimestres WHERE id = p_bimestre AND anio_id = plantilla.anio_id
    )) THEN
        RAISE EXCEPTION 'Los filtros no pertenecen al año de la plantilla';
    END IF;
    IF (p_bimestre IS NOT NULL AND plantilla.tipo NOT IN ('notas','dashboard'))
       OR (p_seccion IS NOT NULL AND plantilla.tipo NOT IN ('nomina','notas','asistencia_alumnos'))
       OR (p_matricula IS NOT NULL AND plantilla.tipo NOT IN ('ficha_matricula','estado_cuenta','notas','asistencia_alumnos')) THEN
        RAISE EXCEPTION 'El tipo de reporte no admite uno de los filtros enviados';
    END IF;

    parametros := jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'matricula_id', p_matricula,
        'seccion_id', p_seccion, 'bimestre_id', p_bimestre);
    PERFORM pg_advisory_xact_lock(hashtextextended('reporte:' || p_uuid::text, 0));
    SELECT * INTO documento FROM documentos_emitidos WHERE solicitud_uuid = p_uuid;
    IF FOUND THEN
        IF documento.plantilla_id <> p_plantilla OR documento.solicitado_por <> p_actor
            OR documento.parametros <> parametros THEN
            RAISE EXCEPTION 'El identificador ya corresponde a otra solicitud';
        END IF;
        RETURN documento;
    END IF;

    CASE plantilla.tipo
        WHEN 'ficha_matricula' THEN
            IF p_matricula IS NULL THEN RAISE EXCEPTION 'Seleccione una matrícula'; END IF;
            SELECT jsonb_agg(to_jsonb(r) ORDER BY lower(r.vigencia)) INTO filas
            FROM reporte_nomina_matriculas r WHERE r.matricula_id = p_matricula;
        WHEN 'nomina' THEN
            SELECT jsonb_agg(to_jsonb(r) ORDER BY r.apellidos,r.nombres,r.matricula_id) INTO filas
            FROM reporte_nomina_matriculas r WHERE r.anio_id = plantilla.anio_id
              AND r.vigencia @> p_hasta AND r.estado <> 'anulada'
              AND r.confirmada_en < (p_hasta + 1)::timestamp AT TIME ZONE 'America/Lima'
              AND (p_seccion IS NULL OR r.seccion_id = p_seccion);
        WHEN 'estado_cuenta' THEN
            IF p_matricula IS NULL THEN RAISE EXCEPTION 'Seleccione una matrícula'; END IF;
            SELECT jsonb_agg(to_jsonb(r) ORDER BY r.vence_en,r.cuota_id) INTO filas
            FROM reporte_cuotas_al_corte(plantilla.anio_id, p_hasta) r WHERE r.matricula_id = p_matricula;
        WHEN 'notas' THEN
            IF p_bimestre IS NULL THEN RAISE EXCEPTION 'Seleccione un bimestre'; END IF;
            SELECT jsonb_agg(to_jsonb(r) ORDER BY r.apellidos,r.nombres,r.matricula_id,r.competencia_id) INTO filas
            FROM reporte_notas_publicadas r
            WHERE r.anio_id = plantilla.anio_id AND r.bimestre_id = p_bimestre
              AND r.publicado_en < (p_hasta + 1)::timestamp AT TIME ZONE 'America/Lima'
              AND (p_matricula IS NULL OR r.matricula_id = p_matricula)
              AND (p_seccion IS NULL OR r.seccion_id = p_seccion);
        WHEN 'asistencia_alumnos' THEN
            SELECT jsonb_agg(to_jsonb(r) || jsonb_build_object('codigo', e.codigo, 'nombres', p.nombres,
                'apellidos', p.apellidos) ORDER BY r.fecha,p.apellidos,p.nombres,r.matricula_id) INTO filas
            FROM asistencia_diaria_estudiantes r
            JOIN estudiantes e ON e.id = r.estudiante_id JOIN personas p ON p.id = e.persona_id
            WHERE r.anio_id = plantilla.anio_id AND r.fecha BETWEEN p_desde AND p_hasta
              AND (p_matricula IS NULL OR r.matricula_id = p_matricula)
              AND (p_seccion IS NULL OR r.seccion_id = p_seccion);
        WHEN 'asistencia_docentes' THEN
            SELECT jsonb_agg(to_jsonb(r) || jsonb_build_object('codigo', d.codigo, 'nombres', p.nombres,
                'apellidos', p.apellidos) ORDER BY r.fecha,p.apellidos,p.nombres,r.jornada_id) INTO filas
            FROM asistencia_diaria_docentes r
            JOIN docentes d ON d.id = r.docente_id JOIN personas p ON p.id = d.persona_id
            WHERE r.anio_id = plantilla.anio_id AND r.fecha BETWEEN p_desde AND p_hasta;
        WHEN 'dashboard' THEN
            filas := jsonb_build_array(indicadores_dashboard(plantilla.anio_id, p_desde, p_hasta, p_bimestre));
        ELSE
            RAISE EXCEPTION 'Tipo de reporte sin consulta implementada';
    END CASE;

    INSERT INTO documentos_emitidos (solicitud_uuid, plantilla_id, tipo, anio_id, formato, parametros, datos, solicitado_por)
    VALUES (p_uuid, plantilla.id, plantilla.tipo, plantilla.anio_id, plantilla.formato, parametros,
        jsonb_build_object('version_esquema', 1, 'titulo', plantilla.nombre, 'filas', coalesce(filas,'[]'::jsonb)), p_actor)
    RETURNING * INTO documento;
    RETURN documento;
END;
$$;


ALTER FUNCTION excelencia_seruna.preparar_documento_reporte(p_uuid uuid, p_plantilla bigint, p_actor bigint, p_desde date, p_hasta date, p_matricula bigint, p_seccion bigint, p_bimestre bigint) OWNER TO postgres;

--
-- TOC entry 346 (class 1259 OID 18948)
-- Name: exportaciones_siagie; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.exportaciones_siagie (
    id bigint NOT NULL,
    plantilla_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    bimestre_id bigint NOT NULL,
    solicitado_por bigint NOT NULL,
    solicitado_en timestamp with time zone DEFAULT now() NOT NULL,
    contenido jsonb NOT NULL,
    resultado_archivo_id bigint,
    estado text DEFAULT 'preparada'::text NOT NULL,
    observacion text,
    CONSTRAINT exportaciones_siagie_check CHECK (((estado <> ALL (ARRAY['generada'::text, 'aceptada'::text])) OR (resultado_archivo_id IS NOT NULL))),
    CONSTRAINT exportaciones_siagie_estado_check CHECK ((estado = ANY (ARRAY['preparada'::text, 'generada'::text, 'aceptada'::text, 'rechazada'::text])))
);


ALTER TABLE excelencia_seruna.exportaciones_siagie OWNER TO postgres;

--
-- TOC entry 628 (class 1255 OID 18982)
-- Name: preparar_exportacion_siagie(bigint, bigint); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.preparar_exportacion_siagie(p_plantilla_id bigint, p_usuario_id bigint) RETURNS excelencia_seruna.exportaciones_siagie
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    plantilla plantillas_siagie;
    cierre cierres_evaluacion;
    exportacion exportaciones_siagie;
    datos jsonb;
    huella text;
BEGIN
    SELECT * INTO STRICT plantilla FROM plantillas_siagie WHERE id = p_plantilla_id FOR UPDATE;
    SELECT * INTO STRICT cierre FROM cierres_evaluacion
    WHERE seccion_id = plantilla.seccion_id AND bimestre_id = plantilla.bimestre_id FOR UPDATE;
    IF cierre.estado <> 'publicado' THEN
        RAISE EXCEPTION 'Publique el bimestre antes de preparar el Excel SIAGIE';
    END IF;
    SELECT encode(sha256, 'hex') INTO STRICT huella FROM archivos WHERE id = plantilla.archivo_id;

    IF NOT EXISTS (SELECT 1 FROM mapeos_siagie WHERE plantilla_id = plantilla.id) OR EXISTS (
        SELECT 1
        FROM calificaciones_competencia c
        JOIN matriculas m ON m.id = c.matricula_id
        JOIN estudiantes e ON e.id = m.estudiante_id
        LEFT JOIN mapeos_siagie x ON x.plantilla_id = plantilla.id AND x.competencia_id = c.competencia_id
        LEFT JOIN competencias k ON k.id = c.competencia_id
        WHERE c.cierre_id = cierre.id
          AND ((x.id IS NOT NULL AND nullif(btrim(e.codigo_siagie), '') IS NULL)
            OR (x.id IS NULL AND k.reportable_siagie))
    ) THEN
        RAISE EXCEPTION 'Faltan códigos SIAGIE o mapeos de competencias del cierre';
    END IF;

    WITH mapeo AS (
        SELECT * FROM mapeos_siagie WHERE plantilla_id = plantilla.id
    ), notas AS (
        SELECT x.hoja, x.codigo_excel, e.codigo_siagie AS alumno, c.nivel_logro AS nl, c.conclusion
        FROM calificaciones_competencia c
        JOIN mapeo x ON x.competencia_id = c.competencia_id
        JOIN matriculas m ON m.id = c.matricula_id
        JOIN estudiantes e ON e.id = m.estudiante_id
        WHERE c.cierre_id = cierre.id
    )
    SELECT jsonb_build_object(
        'sha256', huella,
        'mapeos', (SELECT jsonb_agg(jsonb_build_object(
            'hoja', hoja, 'codigo', codigo_excel, 'nl', columna_nl, 'conclusion', columna_conclusion
        ) ORDER BY hoja, columna_nl) FROM mapeo),
        'notas', (SELECT coalesce(jsonb_agg(to_jsonb(notas) ORDER BY hoja, alumno, codigo_excel), '[]'::jsonb) FROM notas)
    ) INTO datos;

    INSERT INTO exportaciones_siagie (plantilla_id, seccion_id, bimestre_id, solicitado_por, contenido)
    VALUES (plantilla.id, plantilla.seccion_id, plantilla.bimestre_id, p_usuario_id, datos)
    RETURNING * INTO exportacion;
    RETURN exportacion;
END;
$$;


ALTER FUNCTION excelencia_seruna.preparar_exportacion_siagie(p_plantilla_id bigint, p_usuario_id bigint) OWNER TO postgres;

--
-- TOC entry 566 (class 1255 OID 18376)
-- Name: preservar_registro_financiero(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.preservar_registro_financiero() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW IS NOT DISTINCT FROM OLD THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'Registre un ajuste o reversión para corregir %', TG_TABLE_NAME;
END;
$$;


ALTER FUNCTION excelencia_seruna.preservar_registro_financiero() OWNER TO postgres;

--
-- TOC entry 413 (class 1255 OID 19806)
-- Name: proteger_documento_reporte(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.proteger_documento_reporte() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'El historial del documento debe conservarse';
    END IF;
    IF TG_TABLE_NAME = 'plantillas_documento' THEN
        IF OLD.publicada_en IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION 'Cree una versión nueva de la plantilla publicada';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'preparado' THEN
            RAISE EXCEPTION 'Una solicitud de documento debe empezar como preparada';
        END IF;
        RETURN NEW;
    END IF;
    IF (to_jsonb(NEW) - ARRAY['estado','archivo_id','procesado_por','procesado_en','motivo_fallo',
                              'anulado_por','anulado_en','motivo_anulacion'])
        IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['estado','archivo_id','procesado_por','procesado_en','motivo_fallo',
                              'anulado_por','anulado_en','motivo_anulacion']) THEN
        RAISE EXCEPTION 'Los datos de la solicitud son inmutables';
    END IF;
    IF NOT ((OLD.estado = 'preparado' AND NEW.estado IN ('emitido','fallido'))
        OR (OLD.estado = 'emitido' AND NEW.estado = 'anulado'
            AND (NEW.archivo_id, NEW.procesado_por, NEW.procesado_en) =
                (OLD.archivo_id, OLD.procesado_por, OLD.procesado_en))) THEN
        RAISE EXCEPTION 'Transición de documento no permitida';
    END IF;
    IF NEW.estado = 'emitido' AND NOT EXISTS (
        SELECT 1 FROM archivos a WHERE a.id = NEW.archivo_id
          AND a.bytes > 0
          AND a.tipo_mime = CASE NEW.formato WHEN 'pdf' THEN 'application/pdf'
              ELSE 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' END
    ) THEN
        RAISE EXCEPTION 'El archivo emitido debe coincidir con el formato de la plantilla';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.proteger_documento_reporte() OWNER TO postgres;

--
-- TOC entry 438 (class 1255 OID 19870)
-- Name: proteger_regla_evaluacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.proteger_regla_evaluacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.aprobado_en IS NOT NULL THEN
        RAISE EXCEPTION 'Registre una nueva versión de la regla de evaluación';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.proteger_regla_evaluacion() OWNER TO postgres;

--
-- TOC entry 358 (class 1259 OID 19154)
-- Name: marcaciones; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.marcaciones (
    id bigint NOT NULL,
    evento_uuid uuid NOT NULL,
    persona_id bigint NOT NULL,
    instante timestamp with time zone NOT NULL,
    tipo text NOT NULL,
    metodo text NOT NULL,
    credencial_id bigint,
    lector_id bigint,
    actor_id bigint NOT NULL,
    motivo text,
    registrada_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT marcaciones_check CHECK ((instante <= registrada_en)),
    CONSTRAINT marcaciones_check1 CHECK ((((metodo = 'qr'::text) AND (credencial_id IS NOT NULL) AND (lector_id IS NOT NULL) AND (motivo IS NULL)) OR ((metodo = 'manual'::text) AND (credencial_id IS NULL) AND (lector_id IS NULL) AND (motivo IS NOT NULL) AND (btrim(motivo) <> ''::text)))),
    CONSTRAINT marcaciones_metodo_check CHECK ((metodo = ANY (ARRAY['qr'::text, 'manual'::text]))),
    CONSTRAINT marcaciones_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'salida'::text])))
);


ALTER TABLE excelencia_seruna.marcaciones OWNER TO postgres;

--
-- TOC entry 597 (class 1255 OID 19200)
-- Name: registrar_marcacion(uuid, text, bigint, bytea, bigint, bigint, timestamp with time zone, text); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.registrar_marcacion(p_evento uuid, p_tipo text, p_actor bigint, p_qr_hash bytea DEFAULT NULL::bytea, p_lector bigint DEFAULT NULL::bigint, p_persona bigint DEFAULT NULL::bigint, p_instante timestamp with time zone DEFAULT NULL::timestamp with time zone, p_motivo text DEFAULT NULL::text) RETURNS excelencia_seruna.marcaciones
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    evento marcaciones;
    credencial credenciales_qr;
    momento timestamptz;
BEGIN
    IF p_evento IS NULL OR p_tipo IS NULL OR p_tipo NOT IN ('entrada','salida') THEN
        RAISE EXCEPTION 'Indique el UUID del evento y si es entrada o salida';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('asistencia:' || p_evento::text, 0));
    SELECT * INTO evento FROM marcaciones WHERE evento_uuid = p_evento;
    IF FOUND THEN
        IF evento.tipo IS DISTINCT FROM p_tipo OR evento.actor_id IS DISTINCT FROM p_actor
           OR evento.lector_id IS DISTINCT FROM p_lector
           OR (evento.metodo = 'qr' AND (
               p_persona IS NOT NULL OR p_instante IS NOT NULL OR p_motivo IS NOT NULL
               OR p_qr_hash IS DISTINCT FROM (SELECT token_hash FROM credenciales_qr WHERE id = evento.credencial_id)))
           OR (evento.metodo = 'manual' AND (
               p_qr_hash IS NOT NULL OR evento.persona_id IS DISTINCT FROM p_persona
               OR evento.instante IS DISTINCT FROM p_instante OR evento.motivo IS DISTINCT FROM p_motivo)) THEN
            RAISE EXCEPTION 'Ese UUID ya identifica otra marcación';
        END IF;
        RETURN evento;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_actor AND estado = 'activo') THEN
        RAISE EXCEPTION 'La marcación requiere un operador activo';
    END IF;
    IF p_qr_hash IS NOT NULL THEN
        IF p_persona IS NOT NULL OR p_instante IS NOT NULL OR p_motivo IS NOT NULL THEN
            RAISE EXCEPTION 'El registro QR obtiene identidad y hora en el servidor';
        END IF;
        SELECT * INTO credencial FROM credenciales_qr WHERE token_hash = p_qr_hash FOR SHARE;
        IF NOT FOUND OR credencial.revocada_en IS NOT NULL THEN
            RAISE EXCEPTION 'Credencial QR inválida, vencida o revocada';
        END IF;
        PERFORM id FROM lectores_qr WHERE id = p_lector AND activo FOR SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El lector QR no está habilitado';
        END IF;
        momento := clock_timestamp();
        IF momento < credencial.emitida_en OR momento >= credencial.expira_en THEN
            RAISE EXCEPTION 'Credencial QR inválida, vencida o revocada';
        END IF;
        p_persona := credencial.persona_id;
        p_instante := momento;
    ELSE
        IF p_persona IS NULL OR p_instante IS NULL OR p_lector IS NOT NULL
           OR nullif(btrim(p_motivo), '') IS NULL THEN
            RAISE EXCEPTION 'La marcación manual requiere persona, hora y motivo';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM estudiantes WHERE persona_id = p_persona AND activo)
       AND NOT EXISTS (SELECT 1 FROM docentes WHERE persona_id = p_persona AND activo) THEN
        RAISE EXCEPTION 'La persona no tiene perfil activo de alumno o docente';
    END IF;
    INSERT INTO marcaciones (evento_uuid, persona_id, instante, tipo, metodo, credencial_id, lector_id, actor_id, motivo)
    VALUES (p_evento, p_persona, p_instante, p_tipo,
            CASE WHEN p_qr_hash IS NULL THEN 'manual' ELSE 'qr' END, credencial.id, p_lector, p_actor, p_motivo)
    RETURNING * INTO evento;
    RETURN evento;
END;
$$;


ALTER FUNCTION excelencia_seruna.registrar_marcacion(p_evento uuid, p_tipo text, p_actor bigint, p_qr_hash bytea, p_lector bigint, p_persona bigint, p_instante timestamp with time zone, p_motivo text) OWNER TO postgres;

--
-- TOC entry 521 (class 1255 OID 18872)
-- Name: registrar_revision_calificacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.registrar_revision_calificacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    INSERT INTO revisiones_calificacion (calificacion_id, anterior, nueva, autor_id, motivo)
    VALUES (NEW.id, to_jsonb(OLD), to_jsonb(NEW), NEW.autor_id, NEW.motivo_cambio);
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.registrar_revision_calificacion() OWNER TO postgres;

--
-- TOC entry 642 (class 1255 OID 19819)
-- Name: reporte_cuotas_al_corte(bigint, date); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.reporte_cuotas_al_corte(p_anio bigint, p_corte date) RETURNS TABLE(cuota_id bigint, matricula_id bigint, grado_id bigint, concepto text, vence_en date, importe numeric, ajustes numeric, abonado numeric, saldo numeric)
    LANGUAGE sql STABLE STRICT
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
    WITH limite AS (
        SELECT (p_corte + 1)::timestamp AT TIME ZONE 'America/Lima' AS instante
    ), seleccion AS (
        SELECT q.* FROM cuotas q CROSS JOIN limite l WHERE q.anio_id = p_anio AND q.emitida_en < l.instante
    ), ajustes AS (
        SELECT j.cuota_id, sum(j.importe) AS total
        FROM ajustes_cuota j JOIN seleccion q ON q.id = j.cuota_id CROSS JOIN limite l
        WHERE j.registrado_en < l.instante GROUP BY j.cuota_id
    ), devoluciones_corte AS (
        SELECT d.aplicacion_id, sum(d.importe) AS total
        FROM devoluciones d JOIN aplicaciones_pago a ON a.id = d.aplicacion_id
        JOIN seleccion q ON q.id = a.cuota_id CROSS JOIN limite l
        WHERE d.devuelto_en < l.instante GROUP BY d.aplicacion_id
    ), pagos_corte AS (
        SELECT a.cuota_id, sum(a.importe - coalesce(d.total,0)) AS total
        FROM aplicaciones_pago a JOIN seleccion q ON q.id = a.cuota_id
        JOIN pagos p ON p.id = a.pago_id CROSS JOIN limite l
        LEFT JOIN devoluciones_corte d ON d.aplicacion_id = a.id
        WHERE p.pagado_en < l.instante AND NOT EXISTS (
            SELECT 1 FROM reversiones_pago r WHERE r.pago_id = p.id AND r.revertido_en < l.instante
        ) GROUP BY a.cuota_id
    )
    SELECT q.id, q.matricula_id, q.grado_id, q.concepto, q.vence_en,
           q.importe, coalesce(j.total,0), coalesce(a.total,0),
           q.importe + coalesce(j.total,0) - coalesce(a.total,0)
    FROM seleccion q LEFT JOIN ajustes j ON j.cuota_id = q.id LEFT JOIN pagos_corte a ON a.cuota_id = q.id;
$$;


ALTER FUNCTION excelencia_seruna.reporte_cuotas_al_corte(p_anio bigint, p_corte date) OWNER TO postgres;

--
-- TOC entry 553 (class 1255 OID 18386)
-- Name: validar_aplicacion_pago(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_aplicacion_pago() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    total numeric;
    fecha_pago date;
    exigible date;
BEGIN
    UPDATE pagos SET importe = importe WHERE id = NEW.pago_id
    RETURNING importe, (pagado_en AT TIME ZONE 'America/Lima')::date INTO total, fecha_pago;
    IF NOT FOUND OR EXISTS (SELECT 1 FROM reversiones_pago WHERE pago_id = NEW.pago_id)
        OR EXISTS (SELECT 1 FROM recibos_caja WHERE pago_id = NEW.pago_id) THEN
        RAISE EXCEPTION 'El pago no admite nuevas aplicaciones';
    END IF;
    IF (SELECT coalesce(sum(importe), 0) FROM aplicaciones_pago WHERE pago_id = NEW.pago_id)
        + NEW.importe > total THEN
        RAISE EXCEPTION 'Las aplicaciones exceden el importe del pago';
    END IF;

    UPDATE cuotas SET importe = importe WHERE id = NEW.cuota_id
    RETURNING exigible_desde INTO exigible;
    IF NOT FOUND OR fecha_pago < exigible THEN
        RAISE EXCEPTION 'La cuota no existe o aún no es exigible';
    END IF;
    IF NEW.importe > (SELECT saldo FROM saldos_cuotas WHERE cuota_id = NEW.cuota_id) THEN
        RAISE EXCEPTION 'El abono excede el saldo de la cuota';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_aplicacion_pago() OWNER TO postgres;

--
-- TOC entry 670 (class 1255 OID 19349)
-- Name: validar_asistencia(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_asistencia() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    persona bigint;
    politica politicas_asistencia;
    dia date;
    hora_entrada time;
    hora_salida time;
    entrada timestamptz;
    salida timestamptz;
    justificada boolean;
BEGIN
    IF TG_TABLE_NAME = 'asistencia_estudiantes' THEN
        IF TG_OP = 'UPDATE' THEN
            IF (NEW.matricula_id, NEW.matricula_seccion_id, NEW.jornada_id, NEW.sesion_id)
                IS DISTINCT FROM (OLD.matricula_id, OLD.matricula_seccion_id, OLD.jornada_id, OLD.sesion_id) THEN
                RAISE EXCEPTION 'No se puede cambiar el contexto de la asistencia';
            END IF;
        END IF;
        SELECT e.persona_id, j.fecha, j.entrada, j.salida INTO persona, dia, hora_entrada, hora_salida
        FROM matricula_secciones ms JOIN matriculas m ON m.id = ms.matricula_id
        JOIN estudiantes e ON e.id = m.estudiante_id
        JOIN jornadas_seccion j ON j.seccion_id = ms.seccion_id AND ms.vigencia @> j.fecha
        WHERE ms.id = NEW.matricula_seccion_id AND m.id = NEW.matricula_id
          AND m.confirmada_en IS NOT NULL AND m.estado <> 'anulada'
          AND j.id = NEW.jornada_id AND j.estado = 'programada'
          AND (NEW.sesion_id IS NULL OR EXISTS (
              SELECT 1 FROM sesiones_clase s WHERE s.id = NEW.sesion_id
                AND s.seccion_id = j.seccion_id AND s.fecha = j.fecha AND s.estado <> 'cancelada'
          ));
        SELECT p.* INTO politica FROM politicas_asistencia p
        JOIN jornadas_seccion j ON j.politica_id = p.id WHERE j.id = NEW.jornada_id;
        SELECT EXISTS (SELECT 1 FROM justificaciones_asistencia
            WHERE asistencia_estudiante_id = NEW.id AND estado = 'aprobada') INTO justificada;
    ELSE
        IF TG_OP = 'UPDATE' THEN
            IF NEW.jornada_id <> OLD.jornada_id THEN
                RAISE EXCEPTION 'No se puede cambiar la jornada de la asistencia';
            END IF;
        END IF;
        SELECT d.persona_id, j.fecha, j.entrada, j.salida INTO persona, dia, hora_entrada, hora_salida
        FROM jornadas_docente j JOIN docentes d ON d.id = j.docente_id
        WHERE j.id = NEW.jornada_id AND j.estado = 'programada';
        SELECT p.* INTO politica FROM politicas_asistencia p
        JOIN jornadas_docente j ON j.politica_id = p.id WHERE j.id = NEW.jornada_id;
        SELECT EXISTS (SELECT 1 FROM justificaciones_asistencia
            WHERE asistencia_docente_id = NEW.id AND estado = 'aprobada') INTO justificada;
    END IF;
    IF persona IS NULL THEN
        RAISE EXCEPTION 'La jornada, la matrícula o la sesión no coinciden';
    END IF;
    IF (NEW.estado = 'justificado') <> justificada THEN
        RAISE EXCEPTION 'El estado justificado requiere una solicitud aprobada';
    END IF;

    IF NEW.entrada_id IS NOT NULL THEN
        SELECT instante INTO entrada FROM marcaciones
        WHERE id = NEW.entrada_id AND persona_id = persona AND tipo = 'entrada'
          AND (instante AT TIME ZONE 'America/Lima')::date = dia
          AND ((metodo = 'manual' AND politica.admite_manual)
              OR (metodo = 'qr' AND politica.admite_qr
                  AND instante AT TIME ZONE 'America/Lima' >= dia + hora_entrada
                      - make_interval(mins => politica.ventana_entrada_minutos)
                  AND instante AT TIME ZONE 'America/Lima' < dia + hora_salida));
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La marcación de entrada no corresponde a la jornada';
        END IF;
    END IF;
    IF NEW.salida_id IS NOT NULL THEN
        SELECT instante INTO salida FROM marcaciones
        WHERE id = NEW.salida_id AND persona_id = persona AND tipo = 'salida'
          AND (instante AT TIME ZONE 'America/Lima')::date = dia
          AND ((metodo = 'manual' AND politica.admite_manual)
              OR (metodo = 'qr' AND politica.admite_qr
                  AND instante AT TIME ZONE 'America/Lima' >= dia + hora_entrada
                  AND instante AT TIME ZONE 'America/Lima' <= dia + hora_salida
                      + make_interval(mins => politica.ventana_salida_minutos)));
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La marcación de salida no corresponde a la jornada';
        END IF;
    END IF;
    IF salida < entrada OR (NEW.estado = 'ausente' AND entrada IS NOT NULL) THEN
        RAISE EXCEPTION 'Las marcaciones contradicen el estado o el orden de la jornada';
    END IF;
    IF NEW.estado IN ('presente','tarde') THEN
        IF entrada IS NULL AND NOT politica.admite_manual THEN
            RAISE EXCEPTION 'La política exige una marcación para registrar presencia';
        END IF;
        IF entrada IS NOT NULL AND ((NEW.estado = 'tarde') <>
            (entrada AT TIME ZONE 'America/Lima' > dia + hora_entrada
                + make_interval(mins => politica.tolerancia_minutos))) THEN
            RAISE EXCEPTION 'El estado no coincide con la tolerancia de entrada';
        END IF;
    END IF;
    NEW.actualizado_en := clock_timestamp();
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_asistencia() OWNER TO postgres;

--
-- TOC entry 542 (class 1255 OID 18871)
-- Name: validar_calificacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_calificacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    cierre cierres_evaluacion;
    periodo daterange;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.matricula_id, OLD.competencia_id, OLD.bimestre_id)
            IS DISTINCT FROM (NEW.matricula_id, NEW.competencia_id, NEW.bimestre_id) THEN
            RAISE EXCEPTION 'La identidad de la calificación no se puede cambiar';
        END IF;
        IF nullif(btrim(NEW.motivo_cambio), '') IS NULL THEN
            RAISE EXCEPTION 'Indique el motivo de la rectificación';
        END IF;
        PERFORM id FROM cierres_evaluacion WHERE id IN (OLD.cierre_id, NEW.cierre_id) ORDER BY id FOR UPDATE;
        IF EXISTS (SELECT 1 FROM cierres_evaluacion WHERE id = OLD.cierre_id AND estado <> 'borrador') THEN
            RAISE EXCEPTION 'Reabra el cierre antes de rectificar';
        END IF;
    END IF;
    SELECT * INTO STRICT cierre FROM cierres_evaluacion WHERE id = NEW.cierre_id FOR UPDATE;
    IF cierre.estado <> 'borrador' THEN
        RAISE EXCEPTION 'El cierre no admite cambios de notas';
    END IF;
    SELECT daterange(inicio, fin, '[]') INTO STRICT periodo FROM bimestres WHERE id = NEW.bimestre_id;
    IF NOT EXISTS (
        SELECT 1 FROM matricula_secciones m JOIN seccion_planes_estudio s ON s.seccion_id = m.seccion_id
        WHERE m.matricula_id = NEW.matricula_id AND m.seccion_id = cierre.seccion_id
          AND s.plan_id = NEW.plan_id AND NOT isempty(m.vigencia * s.vigencia * periodo)
    ) THEN
        RAISE EXCEPTION 'La matrícula y el plan no coinciden con la sección durante el bimestre';
    END IF;
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_calificacion() OWNER TO postgres;

--
-- TOC entry 641 (class 1255 OID 18877)
-- Name: validar_cierre_evaluacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_cierre_evaluacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'borrador' THEN
            RAISE EXCEPTION 'Un cierre debe empezar en borrador';
        END IF;
        RETURN NEW;
    END IF;
    IF (OLD.seccion_id, OLD.bimestre_id, OLD.anio_id, OLD.grado_id)
        IS DISTINCT FROM (NEW.seccion_id, NEW.bimestre_id, NEW.anio_id, NEW.grado_id) THEN
        RAISE EXCEPTION 'El contexto del cierre no se puede cambiar';
    END IF;
    IF NEW.estado = 'borrador' THEN
        IF OLD.estado <> 'borrador' THEN
            INSERT INTO bitacora (actor_id, accion, entidad, registro_id, resultado)
            VALUES (NEW.responsable_id, 'reapertura', 'cierres_evaluacion', NEW.id::text, 'ok');
        END IF;
    ELSIF NEW.estado <> OLD.estado THEN
        IF NEW.estado = 'publicado' AND OLD.estado <> 'cerrado' THEN
            RAISE EXCEPTION 'Cierre el bimestre antes de publicarlo';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM calificaciones_competencia WHERE cierre_id = NEW.id)
           OR EXISTS (
               SELECT 1 FROM calificaciones_competencia c
               JOIN grados g ON g.id = c.grado_id JOIN niveles n ON n.id = g.nivel_id
               WHERE c.cierre_id = NEW.id AND (
                   c.estado = 'pendiente'
                   OR ((c.nivel_logro = 'C' OR (c.nivel_logro = 'B' AND n.codigo = 'primaria'))
                       AND nullif(btrim(c.conclusion), '') IS NULL)
               )
           ) THEN
            RAISE EXCEPTION 'Hay notas pendientes o faltan conclusiones descriptivas obligatorias';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM bimestres b
            JOIN matricula_secciones ms ON ms.seccion_id = NEW.seccion_id AND ms.vigencia @> b.fin
            WHERE b.id = NEW.bimestre_id AND (
                NOT EXISTS (
                    SELECT 1 FROM seccion_planes_estudio sp
                    JOIN plan_competencias pc ON pc.plan_id = sp.plan_id
                    WHERE sp.seccion_id = NEW.seccion_id AND sp.vigencia @> b.fin
                )
                OR EXISTS (
                    SELECT 1 FROM seccion_planes_estudio sp
                    JOIN plan_competencias pc ON pc.plan_id = sp.plan_id
                    WHERE sp.seccion_id = NEW.seccion_id AND sp.vigencia @> b.fin
                      AND NOT EXISTS (
                          SELECT 1 FROM calificaciones_competencia c
                          WHERE c.cierre_id = NEW.id AND c.matricula_id = ms.matricula_id
                            AND c.competencia_id = pc.competencia_id
                      )
                )
            )
        ) THEN
            RAISE EXCEPTION 'Faltan competencias del plan para la nómina al cierre del bimestre';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_cierre_evaluacion() OWNER TO postgres;

--
-- TOC entry 622 (class 1255 OID 19664)
-- Name: validar_detalle_liquidacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_detalle_liquidacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    liquidacion liquidaciones_docentes;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Reemplace el detalle mientras esté en borrador';
    END IF;
    UPDATE liquidaciones_docentes SET estado = estado
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.liquidacion_id ELSE NEW.liquidacion_id END
    RETURNING * INTO STRICT liquidacion;
    IF liquidacion.estado <> 'borrador' THEN
        RAISE EXCEPTION 'La liquidación aprobada no admite cambios';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    IF NEW.tipo = 'horas' AND (
        liquidacion.modalidad <> 'por_horas' OR NOT EXISTS (
            SELECT 1 FROM horas_docentes h
            WHERE h.id = NEW.hora_docente_id AND h.estado = 'aprobada'
              AND h.contrato_id = liquidacion.contrato_id AND liquidacion.vigencia_aplicada @> h.fecha
        )
    ) THEN
        RAISE EXCEPTION 'El detalle requiere horas aprobadas del contrato y período de la liquidación';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_detalle_liquidacion() OWNER TO postgres;

--
-- TOC entry 599 (class 1255 OID 18374)
-- Name: validar_emision_cuota(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_emision_cuota() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    limite_ingreso numeric;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM tramos_plan_cobro t
        JOIN planes_cobro p ON p.id = t.plan_id
        JOIN matriculas m ON m.id = NEW.matricula_id
        WHERE t.id = NEW.tramo_id AND m.estado = 'activa'
          AND p.publicado_en <= NEW.emitida_en
          AND p.vigente_desde <= (NEW.emitida_en AT TIME ZONE 'America/Lima')::date
          AND (t.concepto <> 'matricula' OR t.importe <= p.pension_referencia)
          AND t.importe = NEW.importe AND t.numero = NEW.numero
          AND t.mes_servicio IS NOT DISTINCT FROM NEW.mes_servicio
          AND t.exigible_desde = NEW.exigible_desde AND t.vence_en = NEW.vence_en
    ) THEN
        RAISE EXCEPTION 'La cuota debe reproducir un tramo válido de un plan publicado para una matrícula activa';
    END IF;

    IF NEW.obligacion_ingreso_id IS NOT NULL THEN
        UPDATE obligaciones_ingreso SET importe_acordado = importe_acordado
        WHERE id = NEW.obligacion_ingreso_id
        RETURNING importe_acordado INTO STRICT limite_ingreso;
        IF (SELECT coalesce(sum(importe), 0) FROM cuotas
            WHERE obligacion_ingreso_id = NEW.obligacion_ingreso_id) + NEW.importe > limite_ingreso THEN
            RAISE EXCEPTION 'Las cuotas superan el importe de ingreso acordado';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_emision_cuota() OWNER TO postgres;

--
-- TOC entry 562 (class 1255 OID 19097)
-- Name: validar_fecha_jornada(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_fecha_jornada() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM politicas_asistencia p JOIN anios_academicos a ON a.id = p.anio_id
        WHERE p.id = NEW.politica_id AND p.anio_id = NEW.anio_id AND p.vigencia @> NEW.fecha
          AND NEW.fecha BETWEEN a.inicio AND a.fin
    ) THEN
        RAISE EXCEPTION 'La jornada debe estar dentro del año y de la vigencia de su política';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_fecha_jornada() OWNER TO postgres;

--
-- TOC entry 560 (class 1255 OID 19660)
-- Name: validar_horas_docente(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_horas_docente() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    contrato contratos_docentes;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado <> 'pendiente' OR NEW.estado = 'pendiente'
           OR (NEW.contrato_id, NEW.sesion_id, NEW.fecha, NEW.hora_inicio, NEW.hora_fin,
               NEW.motivo, NEW.evidencia_id, NEW.registrado_por, NEW.registrado_en)
              IS DISTINCT FROM
              (OLD.contrato_id, OLD.sesion_id, OLD.fecha, OLD.hora_inicio, OLD.hora_fin,
               OLD.motivo, OLD.evidencia_id, OLD.registrado_por, OLD.registrado_en) THEN
            RAISE EXCEPTION 'Solo se puede resolver una hora pendiente y conservar su contenido';
        END IF;
        IF NEW.estado = 'rechazada' THEN
            RETURN NEW;
        END IF;
    ELSIF NEW.estado <> 'pendiente' THEN
        RAISE EXCEPTION 'Las horas deben registrarse primero como pendientes';
    END IF;

    SELECT * INTO STRICT contrato FROM contratos_docentes WHERE id = NEW.contrato_id FOR SHARE;
    IF contrato.modalidad <> 'por_horas' OR NOT (contrato.vigencia @> NEW.fecha) THEN
        RAISE EXCEPTION 'Las horas requieren un contrato por horas vigente para la fecha';
    END IF;
    IF NEW.fecha + NEW.hora_fin > clock_timestamp() AT TIME ZONE 'America/Lima' THEN
        RAISE EXCEPTION 'Solo se pueden registrar horas ya trabajadas';
    END IF;
    IF NEW.sesion_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM sesiones_clase s
        WHERE s.id = NEW.sesion_id AND s.docente_id = contrato.docente_id
          AND s.fecha = NEW.fecha AND s.estado = 'realizada'
          AND NEW.hora_inicio >= s.hora_inicio AND NEW.hora_fin <= s.hora_fin
    ) THEN
        RAISE EXCEPTION 'Las horas deben pertenecer a una sesión realizada por el docente';
    END IF;
    IF NEW.estado IN ('pendiente','aprobada') THEN
        UPDATE periodos_liquidacion SET estado = estado
        WHERE mes = date_trunc('month', NEW.fecha::timestamp)::date;
        IF NOT FOUND AND NEW.estado = 'aprobada' THEN
            RAISE EXCEPTION 'Abra el período mensual antes de aprobar horas';
        END IF;
        IF EXISTS (
            SELECT 1 FROM periodos_liquidacion p
            LEFT JOIN liquidaciones_docentes l ON l.periodo_id = p.id AND l.contrato_id = NEW.contrato_id
            WHERE p.mes = date_trunc('month', NEW.fecha::timestamp)::date
              AND (p.estado = 'cerrado' OR l.estado = 'aprobada')
        ) THEN
            RAISE EXCEPTION 'Las horas corresponden a una liquidación o período cerrado';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_horas_docente() OWNER TO postgres;

--
-- TOC entry 437 (class 1255 OID 19357)
-- Name: validar_justificacion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_justificacion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    estado_asistencia text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'pendiente' THEN
            RAISE EXCEPTION 'La justificación se registra primero como pendiente';
        END IF;
    ELSE
        IF OLD.estado <> 'pendiente' OR NEW.estado = 'pendiente'
           OR (OLD.asistencia_estudiante_id, OLD.asistencia_docente_id, OLD.solicitada_por,
               OLD.solicitada_en, OLD.motivo, OLD.evidencia_id) IS DISTINCT FROM
              (NEW.asistencia_estudiante_id, NEW.asistencia_docente_id, NEW.solicitada_por,
               NEW.solicitada_en, NEW.motivo, NEW.evidencia_id) THEN
            RAISE EXCEPTION 'Solo se puede resolver una solicitud pendiente, conservando su contenido';
        END IF;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.estado = 'aprobada' THEN
        IF NEW.asistencia_estudiante_id IS NOT NULL THEN
            SELECT estado INTO estado_asistencia FROM asistencia_estudiantes
            WHERE id = NEW.asistencia_estudiante_id FOR UPDATE;
        ELSE
            SELECT estado INTO estado_asistencia FROM asistencia_docentes
            WHERE id = NEW.asistencia_docente_id FOR UPDATE;
        END IF;
        IF estado_asistencia IS NULL OR estado_asistencia NOT IN ('ausente','tarde') THEN
            RAISE EXCEPTION 'Solo se justifica una ausencia o tardanza registrada';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_justificacion() OWNER TO postgres;

--
-- TOC entry 459 (class 1255 OID 19662)
-- Name: validar_liquidacion_docente(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_liquidacion_docente() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    contrato contratos_docentes;
    periodo periodos_liquidacion;
    mes daterange;
    total totales_liquidacion_docente;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW IS NOT DISTINCT FROM OLD THEN
            RETURN NEW;
        END IF;
        IF OLD.estado <> 'borrador' OR NEW.estado <> 'aprobada'
           OR (to_jsonb(NEW) - ARRAY['estado','aprobado_por','aprobado_en'])
              IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['estado','aprobado_por','aprobado_en']) THEN
            RAISE EXCEPTION 'La liquidación solo puede pasar de borrador a aprobada';
        END IF;
    ELSIF NEW.estado <> 'borrador' THEN
        RAISE EXCEPTION 'La liquidación debe empezar en borrador';
    END IF;

    UPDATE periodos_liquidacion SET estado = estado WHERE id = NEW.periodo_id
    RETURNING * INTO STRICT periodo;
    IF periodo.estado <> 'abierto' THEN
        RAISE EXCEPTION 'El período de liquidación está cerrado';
    END IF;
    mes := daterange(periodo.mes, (periodo.mes + interval '1 month')::date, '[)');

    IF TG_OP = 'INSERT' THEN
        SELECT * INTO STRICT contrato FROM contratos_docentes WHERE id = NEW.contrato_id FOR SHARE;
        NEW.vigencia_aplicada := mes * contrato.vigencia;
        IF isempty(NEW.vigencia_aplicada) THEN
            RAISE EXCEPTION 'El contrato no estuvo vigente durante el período';
        END IF;
        NEW.modalidad := contrato.modalidad;
        NEW.tarifa_hora := contrato.tarifa_hora;
        NEW.minutos_por_hora := contrato.minutos_por_hora;
        NEW.sueldo_mensual := contrato.sueldo_mensual;
        IF NEW.modalidad = 'fijo' THEN
            IF NEW.importe_fijo IS NULL AND NEW.vigencia_aplicada = mes THEN
                NEW.importe_fijo := contrato.sueldo_mensual;
            END IF;
            IF NEW.importe_fijo IS NULL OR (
                (NEW.vigencia_aplicada <> mes OR NEW.importe_fijo <> contrato.sueldo_mensual)
                AND nullif(btrim(NEW.motivo_prorrateo), '') IS NULL
            ) THEN
                RAISE EXCEPTION 'El sueldo parcial requiere importe autorizado y motivo';
            END IF;
        END IF;
    ELSE
        SELECT * INTO STRICT total FROM totales_liquidacion_docente WHERE liquidacion_id = NEW.id;
        IF total.neto < 0 OR (NEW.modalidad = 'por_horas' AND total.minutos_aprobados = 0) THEN
            RAISE EXCEPTION 'La liquidación requiere un neto válido y, por horas, tiempo aprobado';
        END IF;
        IF NEW.modalidad = 'por_horas' AND EXISTS (
            SELECT 1 FROM horas_docentes h
            WHERE h.contrato_id = NEW.contrato_id AND mes @> h.fecha
              AND (h.estado = 'pendiente' OR (h.estado = 'aprobada' AND NOT EXISTS (
                  SELECT 1 FROM detalle_liquidacion_docente d
                  WHERE d.liquidacion_id = NEW.id AND d.hora_docente_id = h.id
              )))
        ) THEN
            RAISE EXCEPTION 'Resuelva las horas pendientes e incluya todas las horas aprobadas del período';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_liquidacion_docente() OWNER TO postgres;

--
-- TOC entry 411 (class 1255 OID 19666)
-- Name: validar_movimiento_pago_docente(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_movimiento_pago_docente() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    liquidacion bigint;
    resumen saldos_liquidacion_docente;
    momento_pago timestamptz;
BEGIN
    IF TG_TABLE_NAME = 'pagos_docentes' THEN
        liquidacion := NEW.liquidacion_id;
    ELSE
        SELECT liquidacion_id, pagado_en INTO STRICT liquidacion, momento_pago
        FROM pagos_docentes WHERE id = NEW.pago_id;
        IF NEW.revertido_en < momento_pago THEN
            RAISE EXCEPTION 'La reversión debe ser posterior al pago';
        END IF;
    END IF;
    UPDATE liquidaciones_docentes SET estado = estado WHERE id = liquidacion;
    SELECT * INTO STRICT resumen FROM saldos_liquidacion_docente WHERE liquidacion_id = liquidacion;
    IF resumen.estado <> 'aprobada' THEN
        RAISE EXCEPTION 'El pago requiere una liquidación aprobada';
    END IF;
    IF TG_TABLE_NAME = 'pagos_docentes' THEN
        IF NEW.importe > resumen.saldo THEN
            RAISE EXCEPTION 'El pago excede el saldo de la liquidación';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_movimiento_pago_docente() OWNER TO postgres;

--
-- TOC entry 456 (class 1255 OID 18372)
-- Name: validar_ocupacion_seccion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_ocupacion_seccion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    limite integer;
    reservadas integer;
BEGIN
    UPDATE secciones SET cupo = cupo
    WHERE id = NEW.seccion_id AND activa
    RETURNING cupo, reserva INTO limite, reservadas;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La sección no está activa';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM anios_academicos
        WHERE id = NEW.anio_id AND daterange(inicio, fin, '[]') @> NEW.vigencia
    ) THEN
        RAISE EXCEPTION 'La vigencia de la sección debe quedar dentro del año académico';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT lower(NEW.vigencia) AS dia
            UNION
            SELECT lower(s.vigencia)
            FROM matricula_secciones s
            WHERE s.seccion_id = NEW.seccion_id AND NEW.vigencia @> lower(s.vigencia)
        ) AS fechas
        JOIN matricula_secciones s ON s.seccion_id = NEW.seccion_id
            AND s.vigencia @> fechas.dia AND s.id IS DISTINCT FROM NEW.id
        GROUP BY fechas.dia
        HAVING count(*) >= limite
            OR (NEW.tipo_vacante = 'regular'
                AND count(*) FILTER (WHERE s.tipo_vacante = 'regular') >= limite - reservadas)
    ) OR (NEW.tipo_vacante = 'regular' AND limite = reservadas) THEN
        RAISE EXCEPTION 'No hay cupo para el tipo de vacante seleccionado';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_ocupacion_seccion() OWNER TO postgres;

--
-- TOC entry 581 (class 1255 OID 20262)
-- Name: validar_operador_importacion(bigint); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_operador_importacion(p_actor bigint) RETURNS void
    LANGUAGE plpgsql STABLE
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuarios u JOIN usuario_roles ur ON ur.usuario_id = u.id
        JOIN rol_permisos rp ON rp.rol_id = ur.rol_id JOIN permisos p ON p.id = rp.permiso_id
        WHERE u.id = p_actor AND u.estado = 'activo' AND p.codigo = 'datos.conciliar_historico'
    ) THEN
        RAISE EXCEPTION 'La cuenta no está autorizada para conciliar datos históricos';
    END IF;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_operador_importacion(p_actor bigint) OWNER TO postgres;

--
-- TOC entry 627 (class 1255 OID 18578)
-- Name: validar_plan_seccion(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_plan_seccion() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM planes_estudio p JOIN anios_academicos a ON a.id = p.anio_id
        WHERE p.id = NEW.plan_id AND p.publicado_en IS NOT NULL
          AND daterange(a.inicio, a.fin, '[]') @> NEW.vigencia
    ) THEN
        RAISE EXCEPTION 'Se requiere un plan publicado y una vigencia dentro del año escolar';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_plan_seccion() OWNER TO postgres;

--
-- TOC entry 631 (class 1255 OID 18743)
-- Name: validar_vigencia_horario(); Type: FUNCTION; Schema: excelencia_seruna; Owner: postgres
--

CREATE FUNCTION excelencia_seruna.validar_vigencia_horario() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'excelencia_seruna', 'public'
    AS $$
DECLARE
    periodo daterange;
BEGIN
    IF TG_TABLE_NAME = 'asignaciones_docentes' THEN
        periodo := NEW.vigencia;
    ELSIF TG_TABLE_NAME = 'bloques_horario' THEN
        periodo := NEW.vigencia;
    ELSE
        periodo := daterange(NEW.fecha, NEW.fecha, '[]');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM cursos_seccion c JOIN seccion_planes_estudio s ON s.id = c.seccion_plan_id
        WHERE c.id = NEW.curso_id AND s.vigencia @> periodo
    ) THEN
        RAISE EXCEPTION 'La fecha o vigencia debe quedar dentro del plan de la sección';
    END IF;

    IF TG_TABLE_NAME <> 'asignaciones_docentes' THEN
        IF NOT EXISTS (
            SELECT 1 FROM asignaciones_docentes a WHERE a.id = NEW.asignacion_id AND a.vigencia @> periodo
        ) THEN
            RAISE EXCEPTION 'La fecha o vigencia debe quedar dentro de la asignación docente';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION excelencia_seruna.validar_vigencia_horario() OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 17852)
-- Name: aceptaciones_documento; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.aceptaciones_documento (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    documento_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    firmante_id bigint NOT NULL,
    aceptado_en timestamp with time zone NOT NULL,
    metodo text NOT NULL,
    evidencia_id bigint
);


ALTER TABLE excelencia_seruna.aceptaciones_documento OWNER TO postgres;

--
-- TOC entry 275 (class 1259 OID 17851)
-- Name: aceptaciones_documento_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.aceptaciones_documento ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.aceptaciones_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 289 (class 1259 OID 18078)
-- Name: ajustes_cuota; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.ajustes_cuota (
    id bigint NOT NULL,
    cuota_id bigint NOT NULL,
    tipo text NOT NULL,
    importe numeric(12,2) NOT NULL,
    motivo text NOT NULL,
    autorizado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ajustes_cuota_check CHECK (((tipo = 'correccion'::text) OR (importe < (0)::numeric))),
    CONSTRAINT ajustes_cuota_importe_check CHECK ((importe <> (0)::numeric)),
    CONSTRAINT ajustes_cuota_tipo_check CHECK ((tipo = ANY (ARRAY['descuento'::text, 'exoneracion'::text, 'correccion'::text])))
);


ALTER TABLE excelencia_seruna.ajustes_cuota OWNER TO postgres;

--
-- TOC entry 288 (class 1259 OID 18077)
-- Name: ajustes_cuota_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.ajustes_cuota ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.ajustes_cuota_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 248 (class 1259 OID 17424)
-- Name: anios_academicos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.anios_academicos (
    id bigint NOT NULL,
    anio smallint NOT NULL,
    inicio date NOT NULL,
    fin date NOT NULL,
    estado text DEFAULT 'borrador'::text NOT NULL,
    CONSTRAINT anios_academicos_anio_check CHECK (((anio >= 2000) AND (anio <= 2200))),
    CONSTRAINT anios_academicos_check CHECK ((fin >= inicio)),
    CONSTRAINT anios_academicos_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'abierto'::text, 'cerrado'::text])))
);


ALTER TABLE excelencia_seruna.anios_academicos OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 17423)
-- Name: anios_academicos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.anios_academicos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.anios_academicos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 297 (class 1259 OID 18184)
-- Name: aplicaciones_pago; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.aplicaciones_pago (
    id bigint NOT NULL,
    pago_id bigint NOT NULL,
    cuota_id bigint NOT NULL,
    importe numeric(12,2) NOT NULL,
    imputacion text NOT NULL,
    CONSTRAINT aplicaciones_pago_importe_check CHECK ((importe > (0)::numeric)),
    CONSTRAINT aplicaciones_pago_imputacion_check CHECK ((imputacion = ANY (ARRAY['eleccion_pagante'::text, 'regla'::text])))
);


ALTER TABLE excelencia_seruna.aplicaciones_pago OWNER TO postgres;

--
-- TOC entry 296 (class 1259 OID 18183)
-- Name: aplicaciones_pago_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.aplicaciones_pago ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.aplicaciones_pago_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 406 (class 1259 OID 20177)
-- Name: filas_importacion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.filas_importacion (
    lote_id bigint NOT NULL,
    entidad text NOT NULL,
    clave_origen text NOT NULL,
    datos jsonb NOT NULL,
    CONSTRAINT filas_importacion_clave_origen_check CHECK ((btrim(clave_origen) <> ''::text)),
    CONSTRAINT filas_importacion_datos_check CHECK (((jsonb_typeof(datos) = 'object'::text) AND (datos <> '{}'::jsonb))),
    CONSTRAINT filas_importacion_entidad_check CHECK ((entidad = ANY (ARRAY['estudiantes'::text, 'profesores'::text, 'cursos'::text, 'estudiantes_cursos'::text, 'notas_bimestre'::text, 'entradas_notas'::text, 'reportes_notas'::text, 'materias_reportes_notas'::text, 'puntuaciones_notas'::text, 'valores_puntuaciones_notas'::text, 'registros_asistencia'::text, 'comentarios_estudiantes'::text])))
);


ALTER TABLE excelencia_seruna.filas_importacion OWNER TO postgres;

--
-- TOC entry 405 (class 1259 OID 20149)
-- Name: lotes_importacion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.lotes_importacion (
    id bigint NOT NULL,
    sistema text NOT NULL,
    sha256 bytea NOT NULL,
    conteos_esperados jsonb NOT NULL,
    creado_por bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    estado text DEFAULT 'carga'::text NOT NULL,
    sellado_en timestamp with time zone,
    cerrado_en timestamp with time zone,
    CONSTRAINT lotes_importacion_check CHECK ((((estado = 'carga'::text) AND (sellado_en IS NULL) AND (cerrado_en IS NULL)) OR ((estado = 'revision'::text) AND (sellado_en IS NOT NULL) AND (cerrado_en IS NULL)) OR ((estado = 'cerrado'::text) AND (sellado_en IS NOT NULL) AND (cerrado_en IS NOT NULL)))),
    CONSTRAINT lotes_importacion_conteos_esperados_check CHECK ((jsonb_typeof(conteos_esperados) = 'object'::text)),
    CONSTRAINT lotes_importacion_estado_check CHECK ((estado = ANY (ARRAY['carga'::text, 'revision'::text, 'cerrado'::text]))),
    CONSTRAINT lotes_importacion_sha256_check CHECK ((octet_length(sha256) = 32)),
    CONSTRAINT lotes_importacion_sistema_check CHECK (((sistema = lower(btrim(sistema))) AND (sistema <> ''::text)))
);


ALTER TABLE excelencia_seruna.lotes_importacion OWNER TO postgres;

--
-- TOC entry 410 (class 1259 OID 20272)
-- Name: archivo_historico; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.archivo_historico AS
 SELECT l.sistema,
    l.sha256,
    f.lote_id,
    f.entidad,
    f.clave_origen,
    f.datos,
    c.motivo,
    c.revisada_en
   FROM ((excelencia_seruna.filas_importacion f
     JOIN excelencia_seruna.lotes_importacion l ON ((l.id = f.lote_id)))
     JOIN excelencia_seruna.conciliaciones_historicas c USING (lote_id, entidad, clave_origen))
  WHERE (c.accion = 'archivar'::text);


ALTER VIEW excelencia_seruna.archivo_historico OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 17363)
-- Name: archivos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.archivos (
    id bigint NOT NULL,
    clave_almacenamiento text NOT NULL,
    nombre_original text NOT NULL,
    tipo_mime text NOT NULL,
    bytes bigint NOT NULL,
    sha256 bytea NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT archivos_bytes_check CHECK ((bytes >= 0)),
    CONSTRAINT archivos_sha256_check CHECK ((octet_length(sha256) = 32))
);


ALTER TABLE excelencia_seruna.archivos OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 17362)
-- Name: archivos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.archivos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.archivos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 310 (class 1259 OID 18398)
-- Name: areas_curriculares; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.areas_curriculares (
    id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL
);


ALTER TABLE excelencia_seruna.areas_curriculares OWNER TO postgres;

--
-- TOC entry 309 (class 1259 OID 18397)
-- Name: areas_curriculares_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.areas_curriculares ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.areas_curriculares_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 327 (class 1259 OID 18608)
-- Name: asignaciones_docentes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.asignaciones_docentes (
    id bigint NOT NULL,
    curso_id bigint NOT NULL,
    docente_id bigint NOT NULL,
    funcion text NOT NULL,
    vigencia daterange NOT NULL,
    CONSTRAINT asignaciones_docentes_funcion_check CHECK ((funcion = ANY (ARRAY['titular'::text, 'reemplazo'::text, 'apoyo'::text]))),
    CONSTRAINT asignaciones_docentes_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia)) AND (NOT upper_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.asignaciones_docentes OWNER TO postgres;

--
-- TOC entry 326 (class 1259 OID 18607)
-- Name: asignaciones_docentes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.asignaciones_docentes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.asignaciones_docentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 321 (class 1259 OID 18531)
-- Name: asignatura_competencias; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.asignatura_competencias (
    plan_id bigint NOT NULL,
    asignatura_id bigint NOT NULL,
    competencia_id bigint NOT NULL
);


ALTER TABLE excelencia_seruna.asignatura_competencias OWNER TO postgres;

--
-- TOC entry 316 (class 1259 OID 18453)
-- Name: asignaturas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.asignaturas (
    id bigint NOT NULL,
    area_id bigint,
    codigo text NOT NULL,
    nombre text NOT NULL,
    es_taller boolean DEFAULT false NOT NULL
);


ALTER TABLE excelencia_seruna.asignaturas OWNER TO postgres;

--
-- TOC entry 315 (class 1259 OID 18452)
-- Name: asignaturas_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.asignaturas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.asignaturas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 362 (class 1259 OID 19262)
-- Name: asistencia_docentes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.asistencia_docentes (
    id bigint NOT NULL,
    jornada_id bigint NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    entrada_id bigint,
    salida_id bigint,
    registrado_por bigint NOT NULL,
    motivo text NOT NULL,
    actualizado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT asistencia_docentes_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'presente'::text, 'tarde'::text, 'ausente'::text, 'justificado'::text]))),
    CONSTRAINT asistencia_docentes_motivo_check CHECK ((btrim(motivo) <> ''::text))
);


ALTER TABLE excelencia_seruna.asistencia_docentes OWNER TO postgres;

--
-- TOC entry 352 (class 1259 OID 19060)
-- Name: jornadas_docente; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.jornadas_docente (
    id bigint NOT NULL,
    docente_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    politica_id bigint NOT NULL,
    alcance text GENERATED ALWAYS AS ('docente'::text) STORED,
    fecha date NOT NULL,
    entrada time without time zone NOT NULL,
    salida time without time zone NOT NULL,
    estado text DEFAULT 'programada'::text NOT NULL,
    horario tsrange GENERATED ALWAYS AS (tsrange((fecha + entrada), (fecha + salida), '[)'::text)) STORED,
    CONSTRAINT jornadas_docente_check CHECK ((entrada < salida)),
    CONSTRAINT jornadas_docente_estado_check CHECK ((estado = ANY (ARRAY['programada'::text, 'cancelada'::text])))
);


ALTER TABLE excelencia_seruna.jornadas_docente OWNER TO postgres;

--
-- TOC entry 366 (class 1259 OID 19367)
-- Name: asistencia_diaria_docentes; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.asistencia_diaria_docentes AS
 SELECT j.anio_id,
    j.docente_id,
    j.fecha,
    j.id AS jornada_id,
    a.id AS asistencia_id,
    COALESCE(a.estado, 'pendiente'::text) AS estado,
    entrada.instante AS entrada,
    salida.instante AS salida
   FROM (((excelencia_seruna.jornadas_docente j
     LEFT JOIN excelencia_seruna.asistencia_docentes a ON ((a.jornada_id = j.id)))
     LEFT JOIN excelencia_seruna.marcaciones entrada ON ((entrada.id = a.entrada_id)))
     LEFT JOIN excelencia_seruna.marcaciones salida ON ((salida.id = a.salida_id)))
  WHERE (j.estado = 'programada'::text);


ALTER VIEW excelencia_seruna.asistencia_diaria_docentes OWNER TO postgres;

--
-- TOC entry 360 (class 1259 OID 19202)
-- Name: asistencia_estudiantes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.asistencia_estudiantes (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    matricula_seccion_id bigint NOT NULL,
    jornada_id bigint NOT NULL,
    sesion_id bigint,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    entrada_id bigint,
    salida_id bigint,
    registrado_por bigint NOT NULL,
    motivo text NOT NULL,
    actualizado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT asistencia_estudiantes_check CHECK (((sesion_id IS NULL) OR ((entrada_id IS NULL) AND (salida_id IS NULL)))),
    CONSTRAINT asistencia_estudiantes_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'presente'::text, 'tarde'::text, 'ausente'::text, 'justificado'::text]))),
    CONSTRAINT asistencia_estudiantes_motivo_check CHECK ((btrim(motivo) <> ''::text))
);


ALTER TABLE excelencia_seruna.asistencia_estudiantes OWNER TO postgres;

--
-- TOC entry 350 (class 1259 OID 19027)
-- Name: jornadas_seccion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.jornadas_seccion (
    id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    politica_id bigint NOT NULL,
    alcance text GENERATED ALWAYS AS ('alumno'::text) STORED,
    fecha date NOT NULL,
    entrada time without time zone NOT NULL,
    salida time without time zone NOT NULL,
    estado text DEFAULT 'programada'::text NOT NULL,
    CONSTRAINT jornadas_seccion_check CHECK ((entrada < salida)),
    CONSTRAINT jornadas_seccion_estado_check CHECK ((estado = ANY (ARRAY['programada'::text, 'cancelada'::text])))
);


ALTER TABLE excelencia_seruna.jornadas_seccion OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 17636)
-- Name: matricula_secciones; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.matricula_secciones (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    vigencia daterange NOT NULL,
    tipo_vacante text DEFAULT 'regular'::text NOT NULL,
    registrado_por bigint NOT NULL,
    CONSTRAINT matricula_secciones_tipo_vacante_check CHECK ((tipo_vacante = ANY (ARRAY['regular'::text, 'reservada'::text]))),
    CONSTRAINT matricula_secciones_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia)) AND (NOT upper_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.matricula_secciones OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 17583)
-- Name: matriculas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.matriculas (
    id bigint NOT NULL,
    estudiante_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    regla_id bigint NOT NULL,
    tipo_ingreso text NOT NULL,
    solicitada_en timestamp with time zone DEFAULT now() NOT NULL,
    confirmada_en timestamp with time zone,
    estado text DEFAULT 'solicitada'::text NOT NULL,
    referencia_siagie text,
    registrado_por bigint NOT NULL,
    CONSTRAINT matriculas_check CHECK (((estado <> ALL (ARRAY['activa'::text, 'retirada'::text, 'trasladada'::text])) OR (confirmada_en IS NOT NULL))),
    CONSTRAINT matriculas_check1 CHECK ((confirmada_en >= solicitada_en)),
    CONSTRAINT matriculas_estado_check CHECK ((estado = ANY (ARRAY['solicitada'::text, 'activa'::text, 'retirada'::text, 'trasladada'::text, 'anulada'::text])))
);


ALTER TABLE excelencia_seruna.matriculas OWNER TO postgres;

--
-- TOC entry 365 (class 1259 OID 19362)
-- Name: asistencia_diaria_estudiantes; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.asistencia_diaria_estudiantes AS
 SELECT j.anio_id,
    j.seccion_id,
    j.fecha,
    m.estudiante_id,
    ms.matricula_id,
    j.id AS jornada_id,
    a.id AS asistencia_id,
    COALESCE(a.estado, 'pendiente'::text) AS estado,
    entrada.instante AS entrada,
    salida.instante AS salida
   FROM (((((excelencia_seruna.jornadas_seccion j
     JOIN excelencia_seruna.matricula_secciones ms ON (((ms.seccion_id = j.seccion_id) AND (ms.vigencia @> j.fecha))))
     JOIN excelencia_seruna.matriculas m ON (((m.id = ms.matricula_id) AND (m.confirmada_en IS NOT NULL) AND (m.estado <> 'anulada'::text))))
     LEFT JOIN excelencia_seruna.asistencia_estudiantes a ON (((a.jornada_id = j.id) AND (a.matricula_id = ms.matricula_id) AND (a.sesion_id IS NULL))))
     LEFT JOIN excelencia_seruna.marcaciones entrada ON ((entrada.id = a.entrada_id)))
     LEFT JOIN excelencia_seruna.marcaciones salida ON ((salida.id = a.salida_id)))
  WHERE (j.estado = 'programada'::text);


ALTER VIEW excelencia_seruna.asistencia_diaria_estudiantes OWNER TO postgres;

--
-- TOC entry 361 (class 1259 OID 19261)
-- Name: asistencia_docentes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.asistencia_docentes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.asistencia_docentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 359 (class 1259 OID 19201)
-- Name: asistencia_estudiantes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.asistencia_estudiantes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.asistencia_estudiantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 329 (class 1259 OID 18637)
-- Name: aulas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.aulas (
    id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL,
    capacidad integer,
    activa boolean DEFAULT true NOT NULL,
    CONSTRAINT aulas_capacidad_check CHECK ((capacidad > 0))
);


ALTER TABLE excelencia_seruna.aulas OWNER TO postgres;

--
-- TOC entry 328 (class 1259 OID 18636)
-- Name: aulas_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.aulas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.aulas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 250 (class 1259 OID 17443)
-- Name: bimestres; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.bimestres (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    numero smallint NOT NULL,
    inicio date NOT NULL,
    fin date NOT NULL,
    registro_inicio timestamp with time zone,
    registro_fin timestamp with time zone,
    CONSTRAINT bimestres_check CHECK ((fin >= inicio)),
    CONSTRAINT bimestres_check1 CHECK ((registro_fin >= registro_inicio)),
    CONSTRAINT bimestres_numero_check CHECK (((numero >= 1) AND (numero <= 4)))
);


ALTER TABLE excelencia_seruna.bimestres OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 17442)
-- Name: bimestres_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.bimestres ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.bimestres_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 242 (class 1259 OID 17339)
-- Name: bitacora; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.bitacora (
    id bigint NOT NULL,
    actor_id bigint,
    usuario_afectado_id bigint,
    accion text NOT NULL,
    entidad text NOT NULL,
    registro_id text,
    ocurrido_en timestamp with time zone DEFAULT now() NOT NULL,
    motivo text,
    resultado text NOT NULL
);


ALTER TABLE excelencia_seruna.bitacora OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 17338)
-- Name: bitacora_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.bitacora ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.bitacora_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 331 (class 1259 OID 18653)
-- Name: bloques_horario; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.bloques_horario (
    id bigint NOT NULL,
    curso_id bigint NOT NULL,
    asignacion_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    docente_id bigint NOT NULL,
    aula_id bigint,
    dia_iso smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    vigencia daterange NOT NULL,
    franja int4range GENERATED ALWAYS AS (int4range((EXTRACT(epoch FROM hora_inicio))::integer, (EXTRACT(epoch FROM hora_fin))::integer, '[)'::text)) STORED,
    CONSTRAINT bloques_horario_check CHECK (((hora_inicio < hora_fin) AND (EXTRACT(second FROM hora_inicio) = (0)::numeric) AND (EXTRACT(second FROM hora_fin) = (0)::numeric))),
    CONSTRAINT bloques_horario_dia_iso_check CHECK (((dia_iso >= 1) AND (dia_iso <= 7))),
    CONSTRAINT bloques_horario_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia)) AND (NOT upper_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.bloques_horario OWNER TO postgres;

--
-- TOC entry 330 (class 1259 OID 18652)
-- Name: bloques_horario_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.bloques_horario ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.bloques_horario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 291 (class 1259 OID 18107)
-- Name: cajas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.cajas (
    id bigint NOT NULL,
    nombre text NOT NULL,
    activa boolean DEFAULT true NOT NULL
);


ALTER TABLE excelencia_seruna.cajas OWNER TO postgres;

--
-- TOC entry 290 (class 1259 OID 18106)
-- Name: cajas_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.cajas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.cajas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 251 (class 1259 OID 17465)
-- Name: calendario_escolar; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.calendario_escolar (
    anio_id bigint NOT NULL,
    fecha date NOT NULL,
    tipo text NOT NULL,
    descripcion text,
    CONSTRAINT calendario_escolar_tipo_check CHECK ((tipo = ANY (ARRAY['lectivo'::text, 'feriado'::text, 'no_lectivo'::text])))
);


ALTER TABLE excelencia_seruna.calendario_escolar OWNER TO postgres;

--
-- TOC entry 338 (class 1259 OID 18794)
-- Name: calificaciones_competencia; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.calificaciones_competencia (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    bimestre_id bigint NOT NULL,
    competencia_id bigint NOT NULL,
    plan_id bigint NOT NULL,
    cierre_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    estado text NOT NULL,
    nivel_logro text,
    conclusion text,
    autor_id bigint NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    motivo_cambio text,
    CONSTRAINT calificaciones_competencia_check CHECK (((estado = 'evaluada'::text) = (nivel_logro IS NOT NULL))),
    CONSTRAINT calificaciones_competencia_check1 CHECK (((estado = 'evaluada'::text) OR (conclusion IS NULL))),
    CONSTRAINT calificaciones_competencia_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'no_desarrollada'::text, 'evaluada'::text]))),
    CONSTRAINT calificaciones_competencia_nivel_logro_check CHECK ((nivel_logro = ANY (ARRAY['C'::text, 'B'::text, 'A'::text, 'AD'::text])))
);


ALTER TABLE excelencia_seruna.calificaciones_competencia OWNER TO postgres;

--
-- TOC entry 337 (class 1259 OID 18793)
-- Name: calificaciones_competencia_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.calificaciones_competencia ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.calificaciones_competencia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 314 (class 1259 OID 18434)
-- Name: capacidades; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.capacidades (
    id bigint NOT NULL,
    competencia_id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL
);


ALTER TABLE excelencia_seruna.capacidades OWNER TO postgres;

--
-- TOC entry 313 (class 1259 OID 18433)
-- Name: capacidades_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.capacidades ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.capacidades_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 393 (class 1259 OID 19873)
-- Name: cierres_anuales; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.cierres_anuales (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    plan_id bigint NOT NULL,
    regla_id bigint NOT NULL,
    version integer NOT NULL,
    etapa text NOT NULL,
    anterior_id bigint,
    fecha_corte date NOT NULL,
    estado text DEFAULT 'borrador'::text NOT NULL,
    situacion text,
    sustento text,
    motivo_revision text,
    evidencia_id bigint,
    registrado_por bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    aprobado_por bigint,
    aprobado_en timestamp with time zone,
    CONSTRAINT cierres_anuales_check CHECK (((version = 1) = (etapa = 'ordinario'::text))),
    CONSTRAINT cierres_anuales_check1 CHECK ((((etapa = 'ordinario'::text) AND (anterior_id IS NULL)) OR ((etapa <> 'ordinario'::text) AND (anterior_id IS NOT NULL) AND (motivo_revision IS NOT NULL) AND (btrim(motivo_revision) <> ''::text)))),
    CONSTRAINT cierres_anuales_check2 CHECK ((((estado = 'borrador'::text) AND (aprobado_por IS NULL) AND (aprobado_en IS NULL)) OR ((estado = 'aprobado'::text) AND (aprobado_por IS NOT NULL) AND (aprobado_en IS NOT NULL) AND (aprobado_en >= creado_en) AND (situacion IS NOT NULL) AND (sustento IS NOT NULL) AND (btrim(sustento) <> ''::text)))),
    CONSTRAINT cierres_anuales_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'aprobado'::text]))),
    CONSTRAINT cierres_anuales_etapa_check CHECK ((etapa = ANY (ARRAY['ordinario'::text, 'rectificacion'::text, 'recuperacion'::text]))),
    CONSTRAINT cierres_anuales_situacion_check CHECK ((situacion = ANY (ARRAY['promovido'::text, 'recuperacion'::text, 'permanencia'::text]))),
    CONSTRAINT cierres_anuales_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.cierres_anuales OWNER TO postgres;

--
-- TOC entry 392 (class 1259 OID 19872)
-- Name: cierres_anuales_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.cierres_anuales ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.cierres_anuales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 336 (class 1259 OID 18755)
-- Name: cierres_evaluacion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.cierres_evaluacion (
    id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    bimestre_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    estado text DEFAULT 'borrador'::text NOT NULL,
    cerrado_en timestamp with time zone,
    publicado_en timestamp with time zone,
    responsable_id bigint NOT NULL,
    CONSTRAINT cierres_evaluacion_check CHECK (((estado = 'borrador'::text) = (cerrado_en IS NULL))),
    CONSTRAINT cierres_evaluacion_check1 CHECK (((estado = 'publicado'::text) = (publicado_en IS NOT NULL))),
    CONSTRAINT cierres_evaluacion_check2 CHECK ((publicado_en >= cerrado_en)),
    CONSTRAINT cierres_evaluacion_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'cerrado'::text, 'publicado'::text])))
);


ALTER TABLE excelencia_seruna.cierres_evaluacion OWNER TO postgres;

--
-- TOC entry 335 (class 1259 OID 18754)
-- Name: cierres_evaluacion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.cierres_evaluacion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.cierres_evaluacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 312 (class 1259 OID 18411)
-- Name: competencias; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.competencias (
    id bigint NOT NULL,
    area_id bigint,
    codigo text NOT NULL,
    nombre text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    reportable_siagie boolean DEFAULT true NOT NULL,
    CONSTRAINT competencias_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.competencias OWNER TO postgres;

--
-- TOC entry 311 (class 1259 OID 18410)
-- Name: competencias_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.competencias ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.competencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 307 (class 1259 OID 18333)
-- Name: comprobantes_externos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.comprobantes_externos (
    id bigint NOT NULL,
    pago_id bigint NOT NULL,
    ruc_emisor text NOT NULL,
    tipo text NOT NULL,
    serie text NOT NULL,
    numero text NOT NULL,
    emitido_en date NOT NULL,
    estado text NOT NULL,
    archivo_id bigint,
    CONSTRAINT comprobantes_externos_ruc_emisor_check CHECK ((ruc_emisor ~ '^[0-9]{11}$'::text))
);


ALTER TABLE excelencia_seruna.comprobantes_externos OWNER TO postgres;

--
-- TOC entry 306 (class 1259 OID 18332)
-- Name: comprobantes_externos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.comprobantes_externos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.comprobantes_externos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 274 (class 1259 OID 17818)
-- Name: comunicaciones_documento; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.comunicaciones_documento (
    id bigint NOT NULL,
    documento_id bigint NOT NULL,
    destinatario_id bigint,
    alcance text,
    comunicado_en timestamp with time zone NOT NULL,
    canal text NOT NULL,
    evidencia_id bigint,
    registrado_por bigint NOT NULL,
    CONSTRAINT comunicaciones_documento_check CHECK (((destinatario_id IS NOT NULL) OR (NULLIF(btrim(alcance), ''::text) IS NOT NULL)))
);


ALTER TABLE excelencia_seruna.comunicaciones_documento OWNER TO postgres;

--
-- TOC entry 273 (class 1259 OID 17817)
-- Name: comunicaciones_documento_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.comunicaciones_documento ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.comunicaciones_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 277 (class 1259 OID 17889)
-- Name: conceptos_cobro; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.conceptos_cobro (
    codigo text NOT NULL,
    nombre text NOT NULL,
    CONSTRAINT conceptos_cobro_codigo_check CHECK ((codigo = ANY (ARRAY['ingreso'::text, 'matricula'::text, 'pension'::text])))
);


ALTER TABLE excelencia_seruna.conceptos_cobro OWNER TO postgres;

--
-- TOC entry 368 (class 1259 OID 19373)
-- Name: contratos_docentes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.contratos_docentes (
    id bigint NOT NULL,
    docente_id bigint NOT NULL,
    referencia text NOT NULL,
    vigencia daterange NOT NULL,
    modalidad text NOT NULL,
    sueldo_mensual numeric(12,2),
    tarifa_hora numeric(12,4),
    minutos_por_hora smallint,
    documento_id bigint,
    registrado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contratos_docentes_check CHECK ((((modalidad = 'fijo'::text) AND (sueldo_mensual IS NOT NULL) AND (sueldo_mensual > (0)::numeric) AND (tarifa_hora IS NULL) AND (minutos_por_hora IS NULL)) OR ((modalidad = 'por_horas'::text) AND (sueldo_mensual IS NULL) AND (tarifa_hora IS NOT NULL) AND (tarifa_hora > (0)::numeric) AND (minutos_por_hora IS NOT NULL) AND ((minutos_por_hora >= 1) AND (minutos_por_hora <= 60))))),
    CONSTRAINT contratos_docentes_modalidad_check CHECK ((modalidad = ANY (ARRAY['fijo'::text, 'por_horas'::text]))),
    CONSTRAINT contratos_docentes_referencia_check CHECK ((btrim(referencia) <> ''::text)),
    CONSTRAINT contratos_docentes_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia)) AND (NOT upper_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.contratos_docentes OWNER TO postgres;

--
-- TOC entry 367 (class 1259 OID 19372)
-- Name: contratos_docentes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.contratos_docentes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.contratos_docentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 356 (class 1259 OID 19116)
-- Name: credenciales_qr; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.credenciales_qr (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    token_hash bytea NOT NULL,
    emitida_por bigint NOT NULL,
    emitida_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    revocada_en timestamp with time zone,
    revocada_por bigint,
    CONSTRAINT credenciales_qr_check CHECK ((expira_en > emitida_en)),
    CONSTRAINT credenciales_qr_check1 CHECK (((revocada_en IS NULL) = (revocada_por IS NULL))),
    CONSTRAINT credenciales_qr_check2 CHECK ((revocada_en >= emitida_en)),
    CONSTRAINT credenciales_qr_token_hash_check CHECK ((octet_length(token_hash) = 32))
);


ALTER TABLE excelencia_seruna.credenciales_qr OWNER TO postgres;

--
-- TOC entry 355 (class 1259 OID 19115)
-- Name: credenciales_qr_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.credenciales_qr ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.credenciales_qr_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 287 (class 1259 OID 18024)
-- Name: cuotas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.cuotas (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    estudiante_id bigint NOT NULL,
    tramo_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    concepto text NOT NULL,
    obligacion_ingreso_id bigint,
    numero smallint NOT NULL,
    importe numeric(12,2) NOT NULL,
    mes_servicio date,
    exigible_desde date NOT NULL,
    vence_en date NOT NULL,
    emitida_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cuotas_check CHECK (((concepto = 'ingreso'::text) = (obligacion_ingreso_id IS NOT NULL))),
    CONSTRAINT cuotas_check1 CHECK (((concepto <> 'matricula'::text) OR (numero = 1))),
    CONSTRAINT cuotas_check2 CHECK ((vence_en >= exigible_desde)),
    CONSTRAINT cuotas_check3 CHECK (((concepto = 'pension'::text) = (mes_servicio IS NOT NULL))),
    CONSTRAINT cuotas_check4 CHECK (((mes_servicio IS NULL) OR ((EXTRACT(day FROM mes_servicio) = (1)::numeric) AND (exigible_desde >= (((mes_servicio + '1 mon'::interval))::date - 1))))),
    CONSTRAINT cuotas_importe_check CHECK ((importe >= (0)::numeric)),
    CONSTRAINT cuotas_numero_check CHECK ((numero > 0))
);


ALTER TABLE excelencia_seruna.cuotas OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 18023)
-- Name: cuotas_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.cuotas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.cuotas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 325 (class 1259 OID 18581)
-- Name: cursos_seccion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.cursos_seccion (
    id bigint NOT NULL,
    seccion_plan_id bigint NOT NULL,
    plan_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    asignatura_id bigint NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE excelencia_seruna.cursos_seccion OWNER TO postgres;

--
-- TOC entry 324 (class 1259 OID 18580)
-- Name: cursos_seccion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.cursos_seccion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.cursos_seccion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 376 (class 1259 OID 19546)
-- Name: detalle_liquidacion_docente; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.detalle_liquidacion_docente (
    id bigint NOT NULL,
    liquidacion_id bigint NOT NULL,
    hora_docente_id bigint,
    tipo text NOT NULL,
    concepto text NOT NULL,
    importe numeric(12,2),
    registrado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT detalle_liquidacion_docente_check CHECK ((((tipo = 'horas'::text) AND (hora_docente_id IS NOT NULL) AND (importe IS NULL)) OR ((tipo <> 'horas'::text) AND (hora_docente_id IS NULL) AND (importe IS NOT NULL) AND (importe > (0)::numeric)))),
    CONSTRAINT detalle_liquidacion_docente_concepto_check CHECK ((btrim(concepto) <> ''::text)),
    CONSTRAINT detalle_liquidacion_docente_tipo_check CHECK ((tipo = ANY (ARRAY['horas'::text, 'adicional'::text, 'descuento'::text])))
);


ALTER TABLE excelencia_seruna.detalle_liquidacion_docente OWNER TO postgres;

--
-- TOC entry 375 (class 1259 OID 19545)
-- Name: detalle_liquidacion_docente_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.detalle_liquidacion_docente ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.detalle_liquidacion_docente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 301 (class 1259 OID 18239)
-- Name: devoluciones; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.devoluciones (
    id bigint NOT NULL,
    pago_id bigint NOT NULL,
    aplicacion_id bigint NOT NULL,
    sesion_caja_id bigint,
    importe numeric(12,2) NOT NULL,
    motivo text NOT NULL,
    evidencia_id bigint,
    autorizado_por bigint NOT NULL,
    devuelto_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT devoluciones_importe_check CHECK ((importe > (0)::numeric))
);


ALTER TABLE excelencia_seruna.devoluciones OWNER TO postgres;

--
-- TOC entry 300 (class 1259 OID 18238)
-- Name: devoluciones_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.devoluciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.devoluciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 228 (class 1259 OID 17179)
-- Name: docentes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.docentes (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    codigo text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE excelencia_seruna.docentes OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 17178)
-- Name: docentes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.docentes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.docentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 386 (class 1259 OID 19747)
-- Name: documentos_emitidos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.documentos_emitidos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.documentos_emitidos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 270 (class 1259 OID 17739)
-- Name: documentos_expediente; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.documentos_expediente (
    id bigint NOT NULL,
    estudiante_id bigint NOT NULL,
    matricula_id bigint,
    tipo_documento_id bigint NOT NULL,
    archivo_id bigint NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    cargado_por bigint NOT NULL,
    cargado_en timestamp with time zone DEFAULT now() NOT NULL,
    revisado_por bigint,
    revisado_en timestamp with time zone,
    observacion text,
    CONSTRAINT documentos_expediente_check CHECK (((estado <> ALL (ARRAY['validado'::text, 'observado'::text])) OR ((revisado_por IS NOT NULL) AND (revisado_en IS NOT NULL)))),
    CONSTRAINT documentos_expediente_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'validado'::text, 'observado'::text, 'reemplazado'::text])))
);


ALTER TABLE excelencia_seruna.documentos_expediente OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 17738)
-- Name: documentos_expediente_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.documentos_expediente ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.documentos_expediente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 224 (class 1259 OID 17132)
-- Name: documentos_identidad; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.documentos_identidad (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    tipo text NOT NULL,
    pais_emisor character(2) DEFAULT 'PE'::bpchar NOT NULL,
    numero text NOT NULL,
    verificado_en timestamp with time zone,
    CONSTRAINT documentos_identidad_check CHECK (((tipo <> 'DNI'::text) OR ((pais_emisor = 'PE'::bpchar) AND (numero ~ '^[0-9]{8}$'::text)))),
    CONSTRAINT documentos_identidad_numero_check CHECK (((numero = upper(btrim(numero))) AND (numero <> ''::text)))
);


ALTER TABLE excelencia_seruna.documentos_identidad OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 17131)
-- Name: documentos_identidad_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.documentos_identidad ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.documentos_identidad_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 272 (class 1259 OID 17788)
-- Name: documentos_institucionales; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.documentos_institucionales (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    tipo text NOT NULL,
    version integer NOT NULL,
    archivo_id bigint NOT NULL,
    vigente_desde date,
    publicado_en timestamp with time zone,
    CONSTRAINT documentos_institucionales_check CHECK (((publicado_en IS NULL) OR (vigente_desde IS NOT NULL))),
    CONSTRAINT documentos_institucionales_tipo_check CHECK ((tipo = ANY (ARRAY['reglamento'::text, 'contrato'::text, 'condiciones_economicas'::text]))),
    CONSTRAINT documentos_institucionales_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.documentos_institucionales OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 17787)
-- Name: documentos_institucionales_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.documentos_institucionales ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.documentos_institucionales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 407 (class 1259 OID 20196)
-- Name: equivalencias_historicas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.equivalencias_historicas (
    sistema text NOT NULL,
    entidad text NOT NULL,
    clave_origen text NOT NULL,
    lote_id bigint NOT NULL,
    estudiante_id bigint,
    docente_id bigint,
    curso_id bigint,
    matricula_id bigint,
    CONSTRAINT equivalencias_historicas_check CHECK ((num_nonnulls(estudiante_id, docente_id, curso_id, matricula_id) = 1)),
    CONSTRAINT equivalencias_historicas_check1 CHECK ((((entidad = 'estudiantes'::text) AND (estudiante_id IS NOT NULL)) OR ((entidad = 'profesores'::text) AND (docente_id IS NOT NULL)) OR ((entidad = 'cursos'::text) AND (curso_id IS NOT NULL)) OR ((entidad = 'estudiantes_cursos'::text) AND (matricula_id IS NOT NULL))))
);


ALTER TABLE excelencia_seruna.equivalencias_historicas OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 17383)
-- Name: estudiante_apoderado; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.estudiante_apoderado (
    id bigint NOT NULL,
    estudiante_id bigint NOT NULL,
    persona_id bigint NOT NULL,
    parentesco text NOT NULL,
    vigencia daterange NOT NULL,
    verificado_por bigint,
    verificado_en timestamp with time zone,
    evidencia_id bigint,
    acceso_academico boolean DEFAULT false NOT NULL,
    acceso_economico boolean DEFAULT false NOT NULL,
    CONSTRAINT estudiante_apoderado_check CHECK (((NOT (acceso_academico OR acceso_economico)) OR ((verificado_por IS NOT NULL) AND (verificado_en IS NOT NULL)))),
    CONSTRAINT estudiante_apoderado_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.estudiante_apoderado OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 17382)
-- Name: estudiante_apoderado_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.estudiante_apoderado ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.estudiante_apoderado_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 226 (class 1259 OID 17155)
-- Name: estudiantes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.estudiantes (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    codigo text NOT NULL,
    codigo_siagie text,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE excelencia_seruna.estudiantes OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 17154)
-- Name: estudiantes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.estudiantes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.estudiantes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 397 (class 1259 OID 19988)
-- Name: evaluaciones_recuperacion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.evaluaciones_recuperacion (
    id bigint NOT NULL,
    resultado_origen_id bigint NOT NULL,
    intento integer NOT NULL,
    tipo text NOT NULL,
    fecha date NOT NULL,
    nivel_logro text NOT NULL,
    conclusion text,
    evidencia_id bigint,
    registrado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    estado text DEFAULT 'borrador'::text NOT NULL,
    aprobado_por bigint,
    aprobado_en timestamp with time zone,
    CONSTRAINT evaluaciones_recuperacion_check CHECK ((((estado = 'borrador'::text) AND (aprobado_por IS NULL) AND (aprobado_en IS NULL)) OR ((estado = 'aprobada'::text) AND (aprobado_por IS NOT NULL) AND (aprobado_en >= registrado_en) AND (aprobado_en IS NOT NULL)))),
    CONSTRAINT evaluaciones_recuperacion_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'aprobada'::text]))),
    CONSTRAINT evaluaciones_recuperacion_intento_check CHECK ((intento > 0)),
    CONSTRAINT evaluaciones_recuperacion_nivel_logro_check CHECK ((nivel_logro = ANY (ARRAY['C'::text, 'B'::text, 'A'::text, 'AD'::text]))),
    CONSTRAINT evaluaciones_recuperacion_tipo_check CHECK ((tipo = ANY (ARRAY['recuperacion'::text, 'subsanacion'::text])))
);


ALTER TABLE excelencia_seruna.evaluaciones_recuperacion OWNER TO postgres;

--
-- TOC entry 396 (class 1259 OID 19987)
-- Name: evaluaciones_recuperacion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.evaluaciones_recuperacion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.evaluaciones_recuperacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 345 (class 1259 OID 18947)
-- Name: exportaciones_siagie_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.exportaciones_siagie ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.exportaciones_siagie_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 255 (class 1259 OID 17496)
-- Name: grados; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.grados (
    id bigint NOT NULL,
    nivel_id bigint NOT NULL,
    numero smallint NOT NULL,
    CONSTRAINT grados_numero_check CHECK (((numero >= 1) AND (numero <= 6)))
);


ALTER TABLE excelencia_seruna.grados OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 17495)
-- Name: grados_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.grados ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.grados_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 222 (class 1259 OID 17117)
-- Name: personas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.personas (
    id bigint NOT NULL,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    fecha_nacimiento date,
    correo_contacto text,
    telefono text,
    direccion text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT personas_apellidos_check CHECK ((btrim(apellidos) <> ''::text)),
    CONSTRAINT personas_nombres_check CHECK ((btrim(nombres) <> ''::text))
);


ALTER TABLE excelencia_seruna.personas OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 17513)
-- Name: secciones; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.secciones (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    nombre text NOT NULL,
    turno text NOT NULL,
    cupo integer NOT NULL,
    reserva integer DEFAULT 2 NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    CONSTRAINT secciones_check CHECK (((reserva >= 0) AND (reserva <= cupo))),
    CONSTRAINT secciones_cupo_check CHECK ((cupo > 0)),
    CONSTRAINT secciones_nombre_check CHECK (((nombre = upper(btrim(nombre))) AND (nombre <> ''::text)))
);


ALTER TABLE excelencia_seruna.secciones OWNER TO postgres;

--
-- TOC entry 334 (class 1259 OID 18747)
-- Name: horarios_seccion; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.horarios_seccion AS
 SELECT h.id,
    s.anio_id,
    s.grado_id,
    h.seccion_id,
    h.curso_id,
    a.nombre AS asignatura,
    h.docente_id,
    ((p.nombres || ' '::text) || p.apellidos) AS docente,
    au.nombre AS aula,
    h.dia_iso,
    h.hora_inicio,
    h.hora_fin,
    h.vigencia
   FROM ((((((excelencia_seruna.bloques_horario h
     JOIN excelencia_seruna.cursos_seccion c ON ((c.id = h.curso_id)))
     JOIN excelencia_seruna.secciones s ON ((s.id = h.seccion_id)))
     JOIN excelencia_seruna.asignaturas a ON ((a.id = c.asignatura_id)))
     JOIN excelencia_seruna.docentes d ON ((d.id = h.docente_id)))
     JOIN excelencia_seruna.personas p ON ((p.id = d.persona_id)))
     LEFT JOIN excelencia_seruna.aulas au ON ((au.id = h.aula_id)));


ALTER VIEW excelencia_seruna.horarios_seccion OWNER TO postgres;

--
-- TOC entry 370 (class 1259 OID 19412)
-- Name: horas_docentes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.horas_docentes (
    id bigint NOT NULL,
    contrato_id bigint NOT NULL,
    sesion_id bigint,
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    tramo tsrange GENERATED ALWAYS AS (tsrange((fecha + hora_inicio), (fecha + hora_fin), '[)'::text)) STORED,
    minutos integer GENERATED ALWAYS AS (((EXTRACT(epoch FROM (hora_fin - hora_inicio)) / (60)::numeric))::integer) STORED,
    motivo text NOT NULL,
    evidencia_id bigint,
    registrado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    resuelto_por bigint,
    resuelto_en timestamp with time zone,
    decision text,
    CONSTRAINT horas_docentes_check CHECK (((hora_inicio < hora_fin) AND (hora_fin < '24:00:00'::time without time zone) AND (EXTRACT(second FROM hora_inicio) = (0)::numeric) AND (EXTRACT(second FROM hora_fin) = (0)::numeric))),
    CONSTRAINT horas_docentes_check1 CHECK ((((estado = 'pendiente'::text) AND (num_nonnulls(resuelto_por, resuelto_en, decision) = 0)) OR ((estado <> 'pendiente'::text) AND (resuelto_por IS NOT NULL) AND (resuelto_en IS NOT NULL) AND (resuelto_en >= registrado_en) AND (decision IS NOT NULL) AND (btrim(decision) <> ''::text)))),
    CONSTRAINT horas_docentes_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text]))),
    CONSTRAINT horas_docentes_motivo_check CHECK ((btrim(motivo) <> ''::text))
);


ALTER TABLE excelencia_seruna.horas_docentes OWNER TO postgres;

--
-- TOC entry 369 (class 1259 OID 19411)
-- Name: horas_docentes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.horas_docentes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.horas_docentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 351 (class 1259 OID 19059)
-- Name: jornadas_docente_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.jornadas_docente ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.jornadas_docente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 349 (class 1259 OID 19026)
-- Name: jornadas_seccion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.jornadas_seccion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.jornadas_seccion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 364 (class 1259 OID 19304)
-- Name: justificaciones_asistencia; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.justificaciones_asistencia (
    id bigint NOT NULL,
    asistencia_estudiante_id bigint,
    asistencia_docente_id bigint,
    solicitada_por bigint NOT NULL,
    solicitada_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    motivo text NOT NULL,
    evidencia_id bigint,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    resuelta_por bigint,
    resuelta_en timestamp with time zone,
    decision text,
    CONSTRAINT justificaciones_asistencia_check CHECK ((num_nonnulls(asistencia_estudiante_id, asistencia_docente_id) = 1)),
    CONSTRAINT justificaciones_asistencia_check1 CHECK ((((estado = 'pendiente'::text) AND (num_nonnulls(resuelta_por, resuelta_en, decision) = 0)) OR ((estado <> 'pendiente'::text) AND (resuelta_por IS NOT NULL) AND (resuelta_en IS NOT NULL) AND (resuelta_en >= solicitada_en) AND (decision IS NOT NULL) AND (btrim(decision) <> ''::text)))),
    CONSTRAINT justificaciones_asistencia_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text]))),
    CONSTRAINT justificaciones_asistencia_motivo_check CHECK ((btrim(motivo) <> ''::text))
);


ALTER TABLE excelencia_seruna.justificaciones_asistencia OWNER TO postgres;

--
-- TOC entry 363 (class 1259 OID 19303)
-- Name: justificaciones_asistencia_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.justificaciones_asistencia ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.justificaciones_asistencia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 354 (class 1259 OID 19101)
-- Name: lectores_qr; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.lectores_qr (
    id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);


ALTER TABLE excelencia_seruna.lectores_qr OWNER TO postgres;

--
-- TOC entry 353 (class 1259 OID 19100)
-- Name: lectores_qr_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.lectores_qr ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.lectores_qr_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 374 (class 1259 OID 19496)
-- Name: liquidaciones_docentes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.liquidaciones_docentes (
    id bigint NOT NULL,
    contrato_id bigint NOT NULL,
    periodo_id bigint NOT NULL,
    moneda text DEFAULT 'PEN'::text NOT NULL,
    modalidad text NOT NULL,
    sueldo_mensual numeric(12,2),
    tarifa_hora numeric(12,4),
    minutos_por_hora smallint,
    vigencia_aplicada daterange NOT NULL,
    importe_fijo numeric(12,2),
    motivo_prorrateo text,
    estado text DEFAULT 'borrador'::text NOT NULL,
    registrado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    aprobado_por bigint,
    aprobado_en timestamp with time zone,
    CONSTRAINT liquidaciones_docentes_check CHECK (((estado = 'aprobada'::text) = ((aprobado_por IS NOT NULL) AND (aprobado_en IS NOT NULL)))),
    CONSTRAINT liquidaciones_docentes_check1 CHECK (((aprobado_por IS NULL) = (aprobado_en IS NULL))),
    CONSTRAINT liquidaciones_docentes_check2 CHECK ((aprobado_en >= registrado_en)),
    CONSTRAINT liquidaciones_docentes_check3 CHECK ((((modalidad = 'fijo'::text) AND (sueldo_mensual IS NOT NULL) AND (importe_fijo IS NOT NULL) AND ((importe_fijo >= (0)::numeric) AND (importe_fijo <= sueldo_mensual)) AND (tarifa_hora IS NULL) AND (minutos_por_hora IS NULL)) OR ((modalidad = 'por_horas'::text) AND (sueldo_mensual IS NULL) AND (importe_fijo IS NULL) AND (motivo_prorrateo IS NULL) AND (tarifa_hora IS NOT NULL) AND (minutos_por_hora IS NOT NULL)))),
    CONSTRAINT liquidaciones_docentes_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'aprobada'::text]))),
    CONSTRAINT liquidaciones_docentes_modalidad_check CHECK ((modalidad = ANY (ARRAY['fijo'::text, 'por_horas'::text]))),
    CONSTRAINT liquidaciones_docentes_moneda_check CHECK ((moneda = 'PEN'::text)),
    CONSTRAINT liquidaciones_docentes_vigencia_aplicada_check CHECK ((NOT isempty(vigencia_aplicada)))
);


ALTER TABLE excelencia_seruna.liquidaciones_docentes OWNER TO postgres;

--
-- TOC entry 373 (class 1259 OID 19495)
-- Name: liquidaciones_docentes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.liquidaciones_docentes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.liquidaciones_docentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 404 (class 1259 OID 20148)
-- Name: lotes_importacion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.lotes_importacion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.lotes_importacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 344 (class 1259 OID 18913)
-- Name: mapeos_siagie; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.mapeos_siagie (
    id bigint NOT NULL,
    plantilla_id bigint NOT NULL,
    competencia_id bigint NOT NULL,
    hoja text NOT NULL,
    codigo_excel text NOT NULL,
    columna_nl smallint NOT NULL,
    columna_conclusion smallint NOT NULL,
    CONSTRAINT mapeos_siagie_check CHECK ((columna_conclusion = (columna_nl + 1))),
    CONSTRAINT mapeos_siagie_codigo_excel_check CHECK ((codigo_excel ~ '^[0-9]+$'::text)),
    CONSTRAINT mapeos_siagie_columna_nl_check CHECK ((((columna_nl >= 4) AND (columna_nl <= 16383)) AND (((columna_nl)::integer % 2) = 0))),
    CONSTRAINT mapeos_siagie_hoja_check CHECK (((char_length(hoja) >= 1) AND (char_length(hoja) <= 31)))
);


ALTER TABLE excelencia_seruna.mapeos_siagie OWNER TO postgres;

--
-- TOC entry 343 (class 1259 OID 18912)
-- Name: mapeos_siagie_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.mapeos_siagie ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.mapeos_siagie_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 357 (class 1259 OID 19153)
-- Name: marcaciones_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.marcaciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.marcaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 262 (class 1259 OID 17635)
-- Name: matricula_secciones_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.matricula_secciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.matricula_secciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 260 (class 1259 OID 17582)
-- Name: matriculas_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.matriculas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.matriculas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 265 (class 1259 OID 17672)
-- Name: movimientos_matricula; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.movimientos_matricula (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    tipo text NOT NULL,
    fecha_efectiva date NOT NULL,
    motivo text NOT NULL,
    detalle text,
    evidencia_id bigint,
    registrado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT movimientos_matricula_tipo_check CHECK ((tipo = ANY (ARRAY['confirmacion'::text, 'cambio_seccion'::text, 'traslado'::text, 'retiro'::text, 'reincorporacion'::text, 'anulacion'::text])))
);


ALTER TABLE excelencia_seruna.movimientos_matricula OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 17671)
-- Name: movimientos_matricula_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.movimientos_matricula ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.movimientos_matricula_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 253 (class 1259 OID 17482)
-- Name: niveles; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.niveles (
    id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL,
    CONSTRAINT niveles_codigo_check CHECK ((codigo = ANY (ARRAY['primaria'::text, 'secundaria'::text])))
);


ALTER TABLE excelencia_seruna.niveles OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 17481)
-- Name: niveles_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.niveles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.niveles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 285 (class 1259 OID 17998)
-- Name: obligaciones_ingreso; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.obligaciones_ingreso (
    id bigint NOT NULL,
    estudiante_id bigint NOT NULL,
    matricula_ingreso_id bigint NOT NULL,
    importe_acordado numeric(12,2) NOT NULL,
    condiciones_id bigint NOT NULL,
    CONSTRAINT obligaciones_ingreso_importe_acordado_check CHECK ((importe_acordado >= (0)::numeric))
);


ALTER TABLE excelencia_seruna.obligaciones_ingreso OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 17997)
-- Name: obligaciones_ingreso_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.obligaciones_ingreso ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.obligaciones_ingreso_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 402 (class 1259 OID 20109)
-- Name: orden_merito; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.orden_merito (
    publicacion_id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    cierre_anual_id bigint NOT NULL,
    puesto integer NOT NULL,
    calificativo numeric(6,3) NOT NULL,
    sustento_desempate text,
    CONSTRAINT orden_merito_calificativo_check CHECK (((calificativo >= 2.5) AND (calificativo <= (10)::numeric))),
    CONSTRAINT orden_merito_puesto_check CHECK ((puesto > 0))
);


ALTER TABLE excelencia_seruna.orden_merito OWNER TO postgres;

--
-- TOC entry 401 (class 1259 OID 20054)
-- Name: publicaciones_merito; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.publicaciones_merito (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    regla_id bigint NOT NULL,
    alcance text NOT NULL,
    version integer NOT NULL,
    archivo_siagie_id bigint NOT NULL,
    referencia_siagie text NOT NULL,
    registrado_por bigint NOT NULL,
    registrado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    publicado_por bigint,
    publicado_en timestamp with time zone,
    CONSTRAINT publicaciones_merito_alcance_check CHECK ((alcance = ANY (ARRAY['grado'::text, 'secundaria_completa'::text]))),
    CONSTRAINT publicaciones_merito_check CHECK (((publicado_por IS NULL) = (publicado_en IS NULL))),
    CONSTRAINT publicaciones_merito_check1 CHECK ((publicado_en >= registrado_en)),
    CONSTRAINT publicaciones_merito_referencia_siagie_check CHECK ((btrim(referencia_siagie) <> ''::text)),
    CONSTRAINT publicaciones_merito_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.publicaciones_merito OWNER TO postgres;

--
-- TOC entry 403 (class 1259 OID 20139)
-- Name: orden_merito_publicado; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.orden_merito_publicado AS
 WITH vigentes AS (
         SELECT DISTINCT ON (publicaciones_merito.anio_id, publicaciones_merito.grado_id, publicaciones_merito.alcance) publicaciones_merito.id,
            publicaciones_merito.anio_id,
            publicaciones_merito.grado_id,
            publicaciones_merito.regla_id,
            publicaciones_merito.alcance,
            publicaciones_merito.version,
            publicaciones_merito.archivo_siagie_id,
            publicaciones_merito.referencia_siagie,
            publicaciones_merito.registrado_por,
            publicaciones_merito.registrado_en,
            publicaciones_merito.publicado_por,
            publicaciones_merito.publicado_en
           FROM excelencia_seruna.publicaciones_merito
          WHERE (publicaciones_merito.publicado_en IS NOT NULL)
          ORDER BY publicaciones_merito.anio_id, publicaciones_merito.grado_id, publicaciones_merito.alcance, publicaciones_merito.version DESC
        )
 SELECT p.anio_id,
    p.grado_id,
    p.alcance,
    p.version,
    p.publicado_en,
    p.referencia_siagie,
    o.publicacion_id,
    o.matricula_id,
    o.cierre_anual_id,
    o.puesto,
    o.calificativo
   FROM (vigentes p
     JOIN excelencia_seruna.orden_merito o ON ((o.publicacion_id = p.id)));


ALTER VIEW excelencia_seruna.orden_merito_publicado OWNER TO postgres;

--
-- TOC entry 295 (class 1259 OID 18148)
-- Name: pagos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.pagos (
    id bigint NOT NULL,
    clave_idempotencia uuid NOT NULL,
    sesion_caja_id bigint,
    registrado_por bigint NOT NULL,
    pagante_persona_id bigint,
    pagante_tipo_documento text,
    pagante_numero_documento text,
    pagante_nombre text NOT NULL,
    pagante_direccion text,
    importe numeric(12,2) NOT NULL,
    medio text NOT NULL,
    referencia text,
    pagado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pagos_check CHECK (((medio <> 'efectivo'::text) OR (sesion_caja_id IS NOT NULL))),
    CONSTRAINT pagos_importe_check CHECK ((importe > (0)::numeric)),
    CONSTRAINT pagos_medio_check CHECK ((medio = ANY (ARRAY['efectivo'::text, 'transferencia'::text, 'tarjeta'::text, 'otro'::text])))
);


ALTER TABLE excelencia_seruna.pagos OWNER TO postgres;

--
-- TOC entry 378 (class 1259 OID 19581)
-- Name: pagos_docentes; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.pagos_docentes (
    id bigint NOT NULL,
    liquidacion_id bigint NOT NULL,
    clave_idempotencia uuid NOT NULL,
    importe numeric(12,2) NOT NULL,
    medio text NOT NULL,
    referencia text,
    evidencia_id bigint,
    pagado_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    registrado_por bigint NOT NULL,
    CONSTRAINT pagos_docentes_importe_check CHECK ((importe > (0)::numeric)),
    CONSTRAINT pagos_docentes_medio_check CHECK ((medio = ANY (ARRAY['transferencia'::text, 'efectivo'::text, 'otro'::text])))
);


ALTER TABLE excelencia_seruna.pagos_docentes OWNER TO postgres;

--
-- TOC entry 377 (class 1259 OID 19580)
-- Name: pagos_docentes_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.pagos_docentes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.pagos_docentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 294 (class 1259 OID 18147)
-- Name: pagos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.pagos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.pagos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 372 (class 1259 OID 19464)
-- Name: periodos_liquidacion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.periodos_liquidacion (
    id bigint NOT NULL,
    mes date NOT NULL,
    estado text DEFAULT 'abierto'::text NOT NULL,
    registrado_por bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    cerrado_por bigint,
    cerrado_en timestamp with time zone,
    CONSTRAINT periodos_liquidacion_check CHECK (((estado = 'cerrado'::text) = ((cerrado_por IS NOT NULL) AND (cerrado_en IS NOT NULL)))),
    CONSTRAINT periodos_liquidacion_check1 CHECK (((cerrado_por IS NULL) = (cerrado_en IS NULL))),
    CONSTRAINT periodos_liquidacion_check2 CHECK ((cerrado_en >= creado_en)),
    CONSTRAINT periodos_liquidacion_estado_check CHECK ((estado = ANY (ARRAY['abierto'::text, 'cerrado'::text]))),
    CONSTRAINT periodos_liquidacion_mes_check CHECK ((EXTRACT(day FROM mes) = (1)::numeric))
);


ALTER TABLE excelencia_seruna.periodos_liquidacion OWNER TO postgres;

--
-- TOC entry 371 (class 1259 OID 19463)
-- Name: periodos_liquidacion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.periodos_liquidacion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.periodos_liquidacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 234 (class 1259 OID 17240)
-- Name: permisos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.permisos (
    id bigint NOT NULL,
    codigo text NOT NULL,
    descripcion text NOT NULL
);


ALTER TABLE excelencia_seruna.permisos OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 17239)
-- Name: permisos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.permisos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.permisos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 221 (class 1259 OID 17116)
-- Name: personas_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.personas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.personas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 319 (class 1259 OID 18497)
-- Name: plan_asignaturas; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.plan_asignaturas (
    plan_id bigint NOT NULL,
    asignatura_id bigint NOT NULL
);


ALTER TABLE excelencia_seruna.plan_asignaturas OWNER TO postgres;

--
-- TOC entry 320 (class 1259 OID 18514)
-- Name: plan_competencias; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.plan_competencias (
    plan_id bigint NOT NULL,
    competencia_id bigint NOT NULL
);


ALTER TABLE excelencia_seruna.plan_competencias OWNER TO postgres;

--
-- TOC entry 279 (class 1259 OID 17900)
-- Name: planes_cobro; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.planes_cobro (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    version integer NOT NULL,
    condiciones_id bigint,
    pension_referencia numeric(12,2),
    vigente_desde date,
    publicado_en timestamp with time zone,
    CONSTRAINT planes_cobro_check CHECK (((publicado_en IS NULL) OR ((condiciones_id IS NOT NULL) AND (pension_referencia IS NOT NULL) AND (vigente_desde IS NOT NULL)))),
    CONSTRAINT planes_cobro_pension_referencia_check CHECK ((pension_referencia > (0)::numeric)),
    CONSTRAINT planes_cobro_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.planes_cobro OWNER TO postgres;

--
-- TOC entry 278 (class 1259 OID 17899)
-- Name: planes_cobro_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.planes_cobro ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.planes_cobro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 318 (class 1259 OID 18473)
-- Name: planes_estudio; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.planes_estudio (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    version integer NOT NULL,
    publicado_en timestamp with time zone,
    CONSTRAINT planes_estudio_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.planes_estudio OWNER TO postgres;

--
-- TOC entry 317 (class 1259 OID 18472)
-- Name: planes_estudio_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.planes_estudio ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.planes_estudio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 385 (class 1259 OID 19700)
-- Name: plantillas_documento; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.plantillas_documento (
    id bigint NOT NULL,
    tipo text NOT NULL,
    anio_id bigint NOT NULL,
    formato text NOT NULL,
    version integer NOT NULL,
    nombre text NOT NULL,
    archivo_id bigint,
    configuracion jsonb DEFAULT '{}'::jsonb NOT NULL,
    creada_por bigint NOT NULL,
    creada_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    publicada_en timestamp with time zone,
    CONSTRAINT plantillas_documento_check CHECK ((publicada_en >= creada_en)),
    CONSTRAINT plantillas_documento_configuracion_check CHECK ((jsonb_typeof(configuracion) = 'object'::text)),
    CONSTRAINT plantillas_documento_formato_check CHECK ((formato = ANY (ARRAY['pdf'::text, 'xlsx'::text]))),
    CONSTRAINT plantillas_documento_nombre_check CHECK ((btrim(nombre) <> ''::text)),
    CONSTRAINT plantillas_documento_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.plantillas_documento OWNER TO postgres;

--
-- TOC entry 384 (class 1259 OID 19699)
-- Name: plantillas_documento_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.plantillas_documento ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.plantillas_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 342 (class 1259 OID 18880)
-- Name: plantillas_siagie; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.plantillas_siagie (
    id bigint NOT NULL,
    archivo_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    bimestre_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    version integer NOT NULL,
    CONSTRAINT plantillas_siagie_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.plantillas_siagie OWNER TO postgres;

--
-- TOC entry 341 (class 1259 OID 18879)
-- Name: plantillas_siagie_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.plantillas_siagie ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.plantillas_siagie_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 348 (class 1259 OID 18988)
-- Name: politicas_asistencia; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.politicas_asistencia (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    alcance text NOT NULL,
    turno text NOT NULL,
    vigencia daterange NOT NULL,
    admite_qr boolean DEFAULT true NOT NULL,
    admite_manual boolean DEFAULT true NOT NULL,
    tolerancia_minutos smallint DEFAULT 0 NOT NULL,
    ventana_entrada_minutos smallint DEFAULT 60 NOT NULL,
    ventana_salida_minutos smallint DEFAULT 60 NOT NULL,
    CONSTRAINT politicas_asistencia_alcance_check CHECK ((alcance = ANY (ARRAY['alumno'::text, 'docente'::text]))),
    CONSTRAINT politicas_asistencia_check CHECK ((admite_qr OR admite_manual)),
    CONSTRAINT politicas_asistencia_tolerancia_minutos_check CHECK (((tolerancia_minutos >= 0) AND (tolerancia_minutos <= 120))),
    CONSTRAINT politicas_asistencia_turno_check CHECK ((btrim(turno) <> ''::text)),
    CONSTRAINT politicas_asistencia_ventana_entrada_minutos_check CHECK (((ventana_entrada_minutos >= 0) AND (ventana_entrada_minutos <= 720))),
    CONSTRAINT politicas_asistencia_ventana_salida_minutos_check CHECK (((ventana_salida_minutos >= 0) AND (ventana_salida_minutos <= 720))),
    CONSTRAINT politicas_asistencia_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia)) AND (NOT upper_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.politicas_asistencia OWNER TO postgres;

--
-- TOC entry 347 (class 1259 OID 18987)
-- Name: politicas_asistencia_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.politicas_asistencia ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.politicas_asistencia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 400 (class 1259 OID 20053)
-- Name: publicaciones_merito_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.publicaciones_merito ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.publicaciones_merito_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 304 (class 1259 OID 18299)
-- Name: recibos_caja_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.recibos_caja ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.recibos_caja_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 391 (class 1259 OID 19829)
-- Name: reglas_evaluacion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.reglas_evaluacion (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    version integer NOT NULL,
    referencia_normativa text NOT NULL,
    criterios jsonb NOT NULL,
    evidencia_id bigint,
    aprobado_por bigint,
    aprobado_en timestamp with time zone,
    CONSTRAINT reglas_evaluacion_check CHECK (((aprobado_por IS NULL) = (aprobado_en IS NULL))),
    CONSTRAINT reglas_evaluacion_criterios_check CHECK (((jsonb_typeof(criterios) = 'object'::text) AND (criterios <> '{}'::jsonb))),
    CONSTRAINT reglas_evaluacion_referencia_normativa_check CHECK ((btrim(referencia_normativa) <> ''::text)),
    CONSTRAINT reglas_evaluacion_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.reglas_evaluacion OWNER TO postgres;

--
-- TOC entry 390 (class 1259 OID 19828)
-- Name: reglas_evaluacion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.reglas_evaluacion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.reglas_evaluacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 259 (class 1259 OID 17548)
-- Name: reglas_matricula; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.reglas_matricula (
    id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    tipo_ingreso text NOT NULL,
    version integer NOT NULL,
    solicitudes_inicio date NOT NULL,
    solicitudes_fin date NOT NULL,
    corte_edad date,
    edad_minima smallint,
    edad_maxima smallint,
    referencia_normativa text,
    publicada_en timestamp with time zone,
    CONSTRAINT reglas_matricula_check CHECK (((edad_maxima >= edad_minima) AND (edad_maxima >= 0))),
    CONSTRAINT reglas_matricula_check1 CHECK ((solicitudes_fin >= solicitudes_inicio)),
    CONSTRAINT reglas_matricula_check2 CHECK ((((edad_minima IS NULL) AND (edad_maxima IS NULL)) OR (corte_edad IS NOT NULL))),
    CONSTRAINT reglas_matricula_edad_minima_check CHECK ((edad_minima >= 0)),
    CONSTRAINT reglas_matricula_tipo_ingreso_check CHECK ((tipo_ingreso = ANY (ARRAY['nuevo'::text, 'continuidad'::text, 'traslado'::text]))),
    CONSTRAINT reglas_matricula_version_check CHECK ((version > 0))
);


ALTER TABLE excelencia_seruna.reglas_matricula OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 17547)
-- Name: reglas_matricula_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.reglas_matricula ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.reglas_matricula_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 388 (class 1259 OID 19809)
-- Name: reporte_nomina_matriculas; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.reporte_nomina_matriculas AS
 SELECT m.id AS matricula_id,
    m.anio_id,
    m.grado_id,
    m.estado,
    m.confirmada_en,
    m.tipo_ingreso,
    e.id AS estudiante_id,
    e.codigo,
    e.codigo_siagie,
    p.nombres,
    p.apellidos,
    n.nombre AS nivel,
    g.numero AS grado,
    s.id AS seccion_id,
    s.nombre AS seccion,
    ms.vigencia
   FROM ((((((excelencia_seruna.matriculas m
     JOIN excelencia_seruna.estudiantes e ON ((e.id = m.estudiante_id)))
     JOIN excelencia_seruna.personas p ON ((p.id = e.persona_id)))
     JOIN excelencia_seruna.grados g ON ((g.id = m.grado_id)))
     JOIN excelencia_seruna.niveles n ON ((n.id = g.nivel_id)))
     LEFT JOIN excelencia_seruna.matricula_secciones ms ON ((ms.matricula_id = m.id)))
     LEFT JOIN excelencia_seruna.secciones s ON ((s.id = ms.seccion_id)));


ALTER VIEW excelencia_seruna.reporte_nomina_matriculas OWNER TO postgres;

--
-- TOC entry 389 (class 1259 OID 19814)
-- Name: reporte_notas_publicadas; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.reporte_notas_publicadas AS
 SELECT c.matricula_id,
    c.anio_id,
    c.grado_id,
    x.seccion_id,
    c.bimestre_id,
    b.numero AS bimestre,
    e.codigo,
    e.codigo_siagie,
    p.nombres,
    p.apellidos,
    c.competencia_id,
    a.nombre AS area,
    k.nombre AS competencia,
    c.estado,
    c.nivel_logro,
    c.conclusion,
    x.publicado_en
   FROM (((((((excelencia_seruna.calificaciones_competencia c
     JOIN excelencia_seruna.cierres_evaluacion x ON (((x.id = c.cierre_id) AND (x.estado = 'publicado'::text))))
     JOIN excelencia_seruna.bimestres b ON ((b.id = c.bimestre_id)))
     JOIN excelencia_seruna.matriculas m ON ((m.id = c.matricula_id)))
     JOIN excelencia_seruna.estudiantes e ON ((e.id = m.estudiante_id)))
     JOIN excelencia_seruna.personas p ON ((p.id = e.persona_id)))
     JOIN excelencia_seruna.competencias k ON ((k.id = c.competencia_id)))
     LEFT JOIN excelencia_seruna.areas_curriculares a ON ((a.id = k.area_id)));


ALTER VIEW excelencia_seruna.reporte_notas_publicadas OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 17716)
-- Name: requisitos_matricula; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.requisitos_matricula (
    regla_id bigint NOT NULL,
    tipo_documento_id bigint NOT NULL,
    obligatorio boolean DEFAULT true NOT NULL,
    admite_regularizacion boolean DEFAULT false NOT NULL,
    plazo_regularizacion date,
    CONSTRAINT requisitos_matricula_check CHECK (((plazo_regularizacion IS NULL) OR admite_regularizacion))
);


ALTER TABLE excelencia_seruna.requisitos_matricula OWNER TO postgres;

--
-- TOC entry 283 (class 1259 OID 17971)
-- Name: responsables_economicos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.responsables_economicos (
    id bigint NOT NULL,
    matricula_id bigint NOT NULL,
    persona_id bigint,
    tipo_documento text NOT NULL,
    numero_documento text NOT NULL,
    nombre_razon_social text NOT NULL,
    direccion text,
    vigencia daterange NOT NULL,
    CONSTRAINT responsables_economicos_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.responsables_economicos OWNER TO postgres;

--
-- TOC entry 282 (class 1259 OID 17970)
-- Name: responsables_economicos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.responsables_economicos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.responsables_economicos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 395 (class 1259 OID 19949)
-- Name: resultados_anuales_competencia; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.resultados_anuales_competencia (
    id bigint NOT NULL,
    cierre_anual_id bigint NOT NULL,
    plan_id bigint NOT NULL,
    competencia_id bigint NOT NULL,
    nivel_logro text NOT NULL,
    conclusion text,
    requiere_recuperacion boolean DEFAULT false NOT NULL,
    calificacion_id bigint,
    resultado_anterior_id bigint,
    recuperacion_id bigint,
    CONSTRAINT resultados_anuales_competencia_check CHECK ((num_nonnulls(calificacion_id, resultado_anterior_id, recuperacion_id) = 1)),
    CONSTRAINT resultados_anuales_competencia_nivel_logro_check CHECK ((nivel_logro = ANY (ARRAY['C'::text, 'B'::text, 'A'::text, 'AD'::text])))
);


ALTER TABLE excelencia_seruna.resultados_anuales_competencia OWNER TO postgres;

--
-- TOC entry 394 (class 1259 OID 19948)
-- Name: resultados_anuales_competencia_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.resultados_anuales_competencia ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.resultados_anuales_competencia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 409 (class 1259 OID 20267)
-- Name: resumen_importacion_historica; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.resumen_importacion_historica AS
 SELECT f.lote_id,
    f.entidad,
    count(*) AS cargadas,
    count(*) FILTER (WHERE (c.accion = 'crear'::text)) AS creadas,
    count(*) FILTER (WHERE (c.accion = 'vincular'::text)) AS vinculadas,
    count(*) FILTER (WHERE (c.accion = 'archivar'::text)) AS archivadas,
    count(*) FILTER (WHERE (c.accion = 'excluir'::text)) AS excluidas,
    count(*) FILTER (WHERE (c.accion IS NULL)) AS pendientes
   FROM (excelencia_seruna.filas_importacion f
     LEFT JOIN excelencia_seruna.conciliaciones_historicas c USING (lote_id, entidad, clave_origen))
  GROUP BY f.lote_id, f.entidad;


ALTER VIEW excelencia_seruna.resumen_importacion_historica OWNER TO postgres;

--
-- TOC entry 299 (class 1259 OID 18213)
-- Name: reversiones_pago; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.reversiones_pago (
    id bigint NOT NULL,
    pago_id bigint NOT NULL,
    motivo text NOT NULL,
    autorizado_por bigint NOT NULL,
    revertido_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE excelencia_seruna.reversiones_pago OWNER TO postgres;

--
-- TOC entry 380 (class 1259 OID 19616)
-- Name: reversiones_pago_docente; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.reversiones_pago_docente (
    id bigint NOT NULL,
    pago_id bigint NOT NULL,
    motivo text NOT NULL,
    evidencia_id bigint,
    autorizado_por bigint NOT NULL,
    revertido_en timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT reversiones_pago_docente_motivo_check CHECK ((btrim(motivo) <> ''::text))
);


ALTER TABLE excelencia_seruna.reversiones_pago_docente OWNER TO postgres;

--
-- TOC entry 379 (class 1259 OID 19615)
-- Name: reversiones_pago_docente_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.reversiones_pago_docente ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.reversiones_pago_docente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 298 (class 1259 OID 18212)
-- Name: reversiones_pago_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.reversiones_pago ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.reversiones_pago_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 340 (class 1259 OID 18845)
-- Name: revisiones_calificacion; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.revisiones_calificacion (
    id bigint NOT NULL,
    calificacion_id bigint NOT NULL,
    anterior jsonb NOT NULL,
    nueva jsonb NOT NULL,
    autor_id bigint NOT NULL,
    motivo text NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE excelencia_seruna.revisiones_calificacion OWNER TO postgres;

--
-- TOC entry 339 (class 1259 OID 18844)
-- Name: revisiones_calificacion_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.revisiones_calificacion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.revisiones_calificacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 236 (class 1259 OID 17269)
-- Name: rol_permisos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.rol_permisos (
    rol_id bigint NOT NULL,
    permiso_id bigint NOT NULL
);


ALTER TABLE excelencia_seruna.rol_permisos OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 17227)
-- Name: roles; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.roles (
    id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL
);


ALTER TABLE excelencia_seruna.roles OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 17226)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 308 (class 1259 OID 18381)
-- Name: saldos_cuotas; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.saldos_cuotas AS
 WITH ajustes AS (
         SELECT ajustes_cuota.cuota_id,
            sum(ajustes_cuota.importe) AS importe
           FROM excelencia_seruna.ajustes_cuota
          GROUP BY ajustes_cuota.cuota_id
        ), devueltos AS (
         SELECT devoluciones.aplicacion_id,
            sum(devoluciones.importe) AS importe
           FROM excelencia_seruna.devoluciones
          GROUP BY devoluciones.aplicacion_id
        ), abonos AS (
         SELECT a_1.cuota_id,
            sum((a_1.importe - COALESCE(d.importe, (0)::numeric))) AS importe
           FROM (excelencia_seruna.aplicaciones_pago a_1
             LEFT JOIN devueltos d ON ((d.aplicacion_id = a_1.id)))
          WHERE (NOT (EXISTS ( SELECT 1
                   FROM excelencia_seruna.reversiones_pago r
                  WHERE (r.pago_id = a_1.pago_id))))
          GROUP BY a_1.cuota_id
        )
 SELECT c.id AS cuota_id,
    c.matricula_id,
    c.vence_en,
    c.importe,
    COALESCE(j.importe, (0)::numeric) AS ajustes,
    COALESCE(a.importe, (0)::numeric) AS abonado,
    ((c.importe + COALESCE(j.importe, (0)::numeric)) - COALESCE(a.importe, (0)::numeric)) AS saldo
   FROM ((excelencia_seruna.cuotas c
     LEFT JOIN ajustes j ON ((j.cuota_id = c.id)))
     LEFT JOIN abonos a ON ((a.cuota_id = c.id)));


ALTER VIEW excelencia_seruna.saldos_cuotas OWNER TO postgres;

--
-- TOC entry 381 (class 1259 OID 19650)
-- Name: totales_liquidacion_docente; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.totales_liquidacion_docente AS
 WITH detalle AS (
         SELECT d_1.liquidacion_id,
            sum(h.minutos) FILTER (WHERE (d_1.tipo = 'horas'::text)) AS minutos,
            sum(d_1.importe) FILTER (WHERE (d_1.tipo = 'adicional'::text)) AS adicionales,
            sum(d_1.importe) FILTER (WHERE (d_1.tipo = 'descuento'::text)) AS descuentos
           FROM (excelencia_seruna.detalle_liquidacion_docente d_1
             LEFT JOIN excelencia_seruna.horas_docentes h ON ((h.id = d_1.hora_docente_id)))
          GROUP BY d_1.liquidacion_id
        )
 SELECT l.id AS liquidacion_id,
    COALESCE(d.minutos, (0)::bigint) AS minutos_aprobados,
    COALESCE(l.importe_fijo, round((((COALESCE(d.minutos, (0)::bigint))::numeric * l.tarifa_hora) / (l.minutos_por_hora)::numeric), 2)) AS base,
    COALESCE(d.adicionales, (0)::numeric) AS adicionales,
    COALESCE(d.descuentos, (0)::numeric) AS descuentos,
    ((COALESCE(l.importe_fijo, round((((COALESCE(d.minutos, (0)::bigint))::numeric * l.tarifa_hora) / (l.minutos_por_hora)::numeric), 2)) + COALESCE(d.adicionales, (0)::numeric)) - COALESCE(d.descuentos, (0)::numeric)) AS neto
   FROM (excelencia_seruna.liquidaciones_docentes l
     LEFT JOIN detalle d ON ((d.liquidacion_id = l.id)));


ALTER VIEW excelencia_seruna.totales_liquidacion_docente OWNER TO postgres;

--
-- TOC entry 382 (class 1259 OID 19655)
-- Name: saldos_liquidacion_docente; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.saldos_liquidacion_docente AS
 WITH abonos AS (
         SELECT p.liquidacion_id,
            sum(p.importe) AS abonado
           FROM excelencia_seruna.pagos_docentes p
          WHERE (NOT (EXISTS ( SELECT 1
                   FROM excelencia_seruna.reversiones_pago_docente r
                  WHERE (r.pago_id = p.id))))
          GROUP BY p.liquidacion_id
        )
 SELECT t.liquidacion_id,
    t.minutos_aprobados,
    t.base,
    t.adicionales,
    t.descuentos,
    t.neto,
    l.estado,
    COALESCE(a.abonado, (0)::numeric) AS abonado,
        CASE
            WHEN (l.estado = 'aprobada'::text) THEN (t.neto - COALESCE(a.abonado, (0)::numeric))
            ELSE NULL::numeric
        END AS saldo
   FROM ((excelencia_seruna.totales_liquidacion_docente t
     JOIN excelencia_seruna.liquidaciones_docentes l ON ((l.id = t.liquidacion_id)))
     LEFT JOIN abonos a ON ((a.liquidacion_id = l.id)));


ALTER VIEW excelencia_seruna.saldos_liquidacion_docente OWNER TO postgres;

--
-- TOC entry 323 (class 1259 OID 18550)
-- Name: seccion_planes_estudio; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.seccion_planes_estudio (
    id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    plan_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    vigencia daterange NOT NULL,
    CONSTRAINT seccion_planes_estudio_vigencia_check CHECK (((NOT isempty(vigencia)) AND (NOT lower_inf(vigencia)) AND (NOT upper_inf(vigencia))))
);


ALTER TABLE excelencia_seruna.seccion_planes_estudio OWNER TO postgres;

--
-- TOC entry 322 (class 1259 OID 18549)
-- Name: seccion_planes_estudio_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.seccion_planes_estudio ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.seccion_planes_estudio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 256 (class 1259 OID 17512)
-- Name: secciones_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.secciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.secciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 303 (class 1259 OID 18281)
-- Name: series_recibos; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.series_recibos (
    id bigint NOT NULL,
    codigo text NOT NULL,
    numero_inicial bigint NOT NULL,
    siguiente_numero bigint NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    CONSTRAINT series_recibos_check CHECK ((siguiente_numero >= numero_inicial)),
    CONSTRAINT series_recibos_codigo_check CHECK ((codigo ~ '^REC-[A-Z0-9]+$'::text)),
    CONSTRAINT series_recibos_numero_inicial_check CHECK ((numero_inicial > 0))
);


ALTER TABLE excelencia_seruna.series_recibos OWNER TO postgres;

--
-- TOC entry 302 (class 1259 OID 18280)
-- Name: series_recibos_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.series_recibos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.series_recibos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 240 (class 1259 OID 17317)
-- Name: sesiones; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.sesiones (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    token_hash bytea NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    revocada_en timestamp with time zone,
    CONSTRAINT sesiones_check CHECK ((expira_en > creada_en))
);


ALTER TABLE excelencia_seruna.sesiones OWNER TO postgres;

--
-- TOC entry 293 (class 1259 OID 18121)
-- Name: sesiones_caja; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.sesiones_caja (
    id bigint NOT NULL,
    caja_id bigint NOT NULL,
    operador_id bigint NOT NULL,
    abierta_en timestamp with time zone DEFAULT now() NOT NULL,
    cerrada_en timestamp with time zone,
    saldo_inicial numeric(12,2) NOT NULL,
    saldo_contado numeric(12,2),
    CONSTRAINT sesiones_caja_check CHECK ((cerrada_en >= abierta_en)),
    CONSTRAINT sesiones_caja_check1 CHECK (((cerrada_en IS NULL) OR (saldo_contado IS NOT NULL))),
    CONSTRAINT sesiones_caja_saldo_contado_check CHECK ((saldo_contado >= (0)::numeric)),
    CONSTRAINT sesiones_caja_saldo_inicial_check CHECK ((saldo_inicial >= (0)::numeric))
);


ALTER TABLE excelencia_seruna.sesiones_caja OWNER TO postgres;

--
-- TOC entry 292 (class 1259 OID 18120)
-- Name: sesiones_caja_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.sesiones_caja ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.sesiones_caja_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 333 (class 1259 OID 18697)
-- Name: sesiones_clase; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.sesiones_clase (
    id bigint NOT NULL,
    curso_id bigint NOT NULL,
    seccion_id bigint NOT NULL,
    bloque_id bigint,
    asignacion_id bigint NOT NULL,
    docente_id bigint NOT NULL,
    aula_id bigint,
    fecha date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    estado text DEFAULT 'programada'::text NOT NULL,
    franja tsrange GENERATED ALWAYS AS (tsrange((fecha + hora_inicio), (fecha + hora_fin), '[)'::text)) STORED,
    CONSTRAINT sesiones_clase_check CHECK ((hora_inicio < hora_fin)),
    CONSTRAINT sesiones_clase_estado_check CHECK ((estado = ANY (ARRAY['programada'::text, 'realizada'::text, 'cancelada'::text])))
);


ALTER TABLE excelencia_seruna.sesiones_clase OWNER TO postgres;

--
-- TOC entry 332 (class 1259 OID 18696)
-- Name: sesiones_clase_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.sesiones_clase ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.sesiones_clase_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 239 (class 1259 OID 17316)
-- Name: sesiones_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.sesiones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.sesiones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 399 (class 1259 OID 20049)
-- Name: situaciones_finales; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.situaciones_finales AS
 SELECT DISTINCT ON (matricula_id) id AS cierre_anual_id,
    matricula_id,
    anio_id,
    grado_id,
    seccion_id,
    version,
    etapa,
    situacion,
    regla_id,
    fecha_corte,
    aprobado_por,
    aprobado_en
   FROM excelencia_seruna.cierres_anuales
  WHERE (estado = 'aprobado'::text)
  ORDER BY matricula_id, version DESC;


ALTER VIEW excelencia_seruna.situaciones_finales OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 17704)
-- Name: tipos_documento; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.tipos_documento (
    id bigint NOT NULL,
    codigo text NOT NULL,
    nombre text NOT NULL
);


ALTER TABLE excelencia_seruna.tipos_documento OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 17703)
-- Name: tipos_documento_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.tipos_documento ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.tipos_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 383 (class 1259 OID 19684)
-- Name: tipos_reporte; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.tipos_reporte (
    codigo text NOT NULL,
    nombre text NOT NULL,
    permiso text NOT NULL
);


ALTER TABLE excelencia_seruna.tipos_reporte OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 17287)
-- Name: tokens_acceso; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.tokens_acceso (
    id bigint NOT NULL,
    usuario_id bigint NOT NULL,
    emisor_id bigint,
    proposito text NOT NULL,
    token_hash bytea NOT NULL,
    emitido_en timestamp with time zone DEFAULT now() NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    consumido_en timestamp with time zone,
    revocado_en timestamp with time zone,
    CONSTRAINT tokens_acceso_check CHECK ((expira_en > emitido_en)),
    CONSTRAINT tokens_acceso_check1 CHECK (((consumido_en IS NULL) OR (consumido_en >= emitido_en))),
    CONSTRAINT tokens_acceso_proposito_check CHECK ((proposito = ANY (ARRAY['activacion'::text, 'recuperacion'::text])))
);


ALTER TABLE excelencia_seruna.tokens_acceso OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 17286)
-- Name: tokens_acceso_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.tokens_acceso ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.tokens_acceso_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 281 (class 1259 OID 17932)
-- Name: tramos_plan_cobro; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.tramos_plan_cobro (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    anio_id bigint NOT NULL,
    grado_id bigint NOT NULL,
    concepto text NOT NULL,
    numero smallint NOT NULL,
    importe numeric(12,2) NOT NULL,
    mes_servicio date,
    exigible_desde date NOT NULL,
    vence_en date NOT NULL,
    CONSTRAINT tramos_plan_cobro_check CHECK (((concepto <> 'matricula'::text) OR (numero = 1))),
    CONSTRAINT tramos_plan_cobro_check1 CHECK ((vence_en >= exigible_desde)),
    CONSTRAINT tramos_plan_cobro_check2 CHECK (((concepto = 'pension'::text) = (mes_servicio IS NOT NULL))),
    CONSTRAINT tramos_plan_cobro_check3 CHECK (((mes_servicio IS NULL) OR ((EXTRACT(day FROM mes_servicio) = (1)::numeric) AND (exigible_desde >= (((mes_servicio + '1 mon'::interval))::date - 1))))),
    CONSTRAINT tramos_plan_cobro_importe_check CHECK ((importe >= (0)::numeric)),
    CONSTRAINT tramos_plan_cobro_numero_check CHECK ((numero > 0))
);


ALTER TABLE excelencia_seruna.tramos_plan_cobro OWNER TO postgres;

--
-- TOC entry 280 (class 1259 OID 17931)
-- Name: tramos_plan_cobro_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.tramos_plan_cobro ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.tramos_plan_cobro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 398 (class 1259 OID 20038)
-- Name: ultimos_logros_publicados; Type: VIEW; Schema: excelencia_seruna; Owner: postgres
--

CREATE VIEW excelencia_seruna.ultimos_logros_publicados AS
 SELECT DISTINCT ON (c.matricula_id, c.competencia_id) c.matricula_id,
    c.competencia_id,
    c.id AS calificacion_id,
    b.numero AS bimestre,
    c.nivel_logro,
    c.conclusion
   FROM ((excelencia_seruna.calificaciones_competencia c
     JOIN excelencia_seruna.cierres_evaluacion x ON ((x.id = c.cierre_id)))
     JOIN excelencia_seruna.bimestres b ON ((b.id = c.bimestre_id)))
  WHERE ((c.estado = 'evaluada'::text) AND (x.estado = 'publicado'::text))
  ORDER BY c.matricula_id, c.competencia_id, b.numero DESC;


ALTER VIEW excelencia_seruna.ultimos_logros_publicados OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 17252)
-- Name: usuario_roles; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.usuario_roles (
    usuario_id bigint NOT NULL,
    rol_id bigint NOT NULL
);


ALTER TABLE excelencia_seruna.usuario_roles OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 17201)
-- Name: usuarios; Type: TABLE; Schema: excelencia_seruna; Owner: postgres
--

CREATE TABLE excelencia_seruna.usuarios (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    login text NOT NULL,
    contrasena_hash text,
    correo_recuperacion text,
    correo_verificado_en timestamp with time zone,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    ultimo_acceso timestamp with time zone,
    CONSTRAINT usuarios_check CHECK (((estado <> 'activo'::text) OR (NULLIF(btrim(contrasena_hash), ''::text) IS NOT NULL))),
    CONSTRAINT usuarios_check1 CHECK (((correo_verificado_en IS NULL) OR (correo_recuperacion IS NOT NULL))),
    CONSTRAINT usuarios_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'activo'::text, 'suspendido'::text]))),
    CONSTRAINT usuarios_login_check CHECK (((login = lower(btrim(login))) AND (login <> ''::text)))
);


ALTER TABLE excelencia_seruna.usuarios OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 17200)
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE excelencia_seruna.usuarios ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME excelencia_seruna.usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 6944 (class 0 OID 17852)
-- Dependencies: 276
-- Data for Name: aceptaciones_documento; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.aceptaciones_documento (id, matricula_id, grado_id, documento_id, anio_id, firmante_id, aceptado_en, metodo, evidencia_id) FROM stdin;
\.


--
-- TOC entry 6957 (class 0 OID 18078)
-- Dependencies: 289
-- Data for Name: ajustes_cuota; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.ajustes_cuota (id, cuota_id, tipo, importe, motivo, autorizado_por, registrado_en) FROM stdin;
\.


--
-- TOC entry 6916 (class 0 OID 17424)
-- Dependencies: 248
-- Data for Name: anios_academicos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.anios_academicos (id, anio, inicio, fin, estado) FROM stdin;
\.


--
-- TOC entry 6965 (class 0 OID 18184)
-- Dependencies: 297
-- Data for Name: aplicaciones_pago; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.aplicaciones_pago (id, pago_id, cuota_id, importe, imputacion) FROM stdin;
\.


--
-- TOC entry 6912 (class 0 OID 17363)
-- Dependencies: 244
-- Data for Name: archivos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.archivos (id, clave_almacenamiento, nombre_original, tipo_mime, bytes, sha256, creado_en) FROM stdin;
\.


--
-- TOC entry 6977 (class 0 OID 18398)
-- Dependencies: 310
-- Data for Name: areas_curriculares; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.areas_curriculares (id, codigo, nombre) FROM stdin;
\.


--
-- TOC entry 6994 (class 0 OID 18608)
-- Dependencies: 327
-- Data for Name: asignaciones_docentes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.asignaciones_docentes (id, curso_id, docente_id, funcion, vigencia) FROM stdin;
\.


--
-- TOC entry 6988 (class 0 OID 18531)
-- Dependencies: 321
-- Data for Name: asignatura_competencias; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.asignatura_competencias (plan_id, asignatura_id, competencia_id) FROM stdin;
\.


--
-- TOC entry 6983 (class 0 OID 18453)
-- Dependencies: 316
-- Data for Name: asignaturas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.asignaturas (id, area_id, codigo, nombre, es_taller) FROM stdin;
\.


--
-- TOC entry 7028 (class 0 OID 19262)
-- Dependencies: 362
-- Data for Name: asistencia_docentes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.asistencia_docentes (id, jornada_id, estado, entrada_id, salida_id, registrado_por, motivo, actualizado_en) FROM stdin;
\.


--
-- TOC entry 7026 (class 0 OID 19202)
-- Dependencies: 360
-- Data for Name: asistencia_estudiantes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.asistencia_estudiantes (id, matricula_id, matricula_seccion_id, jornada_id, sesion_id, estado, entrada_id, salida_id, registrado_por, motivo, actualizado_en) FROM stdin;
\.


--
-- TOC entry 6996 (class 0 OID 18637)
-- Dependencies: 329
-- Data for Name: aulas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.aulas (id, codigo, nombre, capacidad, activa) FROM stdin;
\.


--
-- TOC entry 6918 (class 0 OID 17443)
-- Dependencies: 250
-- Data for Name: bimestres; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.bimestres (id, anio_id, numero, inicio, fin, registro_inicio, registro_fin) FROM stdin;
\.


--
-- TOC entry 6910 (class 0 OID 17339)
-- Dependencies: 242
-- Data for Name: bitacora; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.bitacora (id, actor_id, usuario_afectado_id, accion, entidad, registro_id, ocurrido_en, motivo, resultado) FROM stdin;
\.


--
-- TOC entry 6998 (class 0 OID 18653)
-- Dependencies: 331
-- Data for Name: bloques_horario; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.bloques_horario (id, curso_id, asignacion_id, seccion_id, docente_id, aula_id, dia_iso, hora_inicio, hora_fin, vigencia) FROM stdin;
\.


--
-- TOC entry 6959 (class 0 OID 18107)
-- Dependencies: 291
-- Data for Name: cajas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.cajas (id, nombre, activa) FROM stdin;
\.


--
-- TOC entry 6919 (class 0 OID 17465)
-- Dependencies: 251
-- Data for Name: calendario_escolar; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.calendario_escolar (anio_id, fecha, tipo, descripcion) FROM stdin;
\.


--
-- TOC entry 7004 (class 0 OID 18794)
-- Dependencies: 338
-- Data for Name: calificaciones_competencia; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.calificaciones_competencia (id, matricula_id, bimestre_id, competencia_id, plan_id, cierre_id, anio_id, grado_id, estado, nivel_logro, conclusion, autor_id, actualizado_en, motivo_cambio) FROM stdin;
\.


--
-- TOC entry 6981 (class 0 OID 18434)
-- Dependencies: 314
-- Data for Name: capacidades; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.capacidades (id, competencia_id, codigo, nombre) FROM stdin;
\.


--
-- TOC entry 7053 (class 0 OID 19873)
-- Dependencies: 393
-- Data for Name: cierres_anuales; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.cierres_anuales (id, matricula_id, anio_id, grado_id, seccion_id, plan_id, regla_id, version, etapa, anterior_id, fecha_corte, estado, situacion, sustento, motivo_revision, evidencia_id, registrado_por, creado_en, aprobado_por, aprobado_en) FROM stdin;
\.


--
-- TOC entry 7002 (class 0 OID 18755)
-- Dependencies: 336
-- Data for Name: cierres_evaluacion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.cierres_evaluacion (id, seccion_id, bimestre_id, anio_id, grado_id, estado, cerrado_en, publicado_en, responsable_id) FROM stdin;
\.


--
-- TOC entry 6979 (class 0 OID 18411)
-- Dependencies: 312
-- Data for Name: competencias; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.competencias (id, area_id, codigo, nombre, version, reportable_siagie) FROM stdin;
\.


--
-- TOC entry 6975 (class 0 OID 18333)
-- Dependencies: 307
-- Data for Name: comprobantes_externos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.comprobantes_externos (id, pago_id, ruc_emisor, tipo, serie, numero, emitido_en, estado, archivo_id) FROM stdin;
\.


--
-- TOC entry 6942 (class 0 OID 17818)
-- Dependencies: 274
-- Data for Name: comunicaciones_documento; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.comunicaciones_documento (id, documento_id, destinatario_id, alcance, comunicado_en, canal, evidencia_id, registrado_por) FROM stdin;
\.


--
-- TOC entry 6945 (class 0 OID 17889)
-- Dependencies: 277
-- Data for Name: conceptos_cobro; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.conceptos_cobro (codigo, nombre) FROM stdin;
ingreso	Cuota de ingreso
matricula	Matrícula
pension	Pensión de enseñanza
\.


--
-- TOC entry 7065 (class 0 OID 20234)
-- Dependencies: 408
-- Data for Name: conciliaciones_historicas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.conciliaciones_historicas (lote_id, entidad, clave_origen, accion, destino_id, motivo, revisada_por, revisada_en) FROM stdin;
\.


--
-- TOC entry 7032 (class 0 OID 19373)
-- Dependencies: 368
-- Data for Name: contratos_docentes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.contratos_docentes (id, docente_id, referencia, vigencia, modalidad, sueldo_mensual, tarifa_hora, minutos_por_hora, documento_id, registrado_por, registrado_en) FROM stdin;
\.


--
-- TOC entry 7022 (class 0 OID 19116)
-- Dependencies: 356
-- Data for Name: credenciales_qr; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.credenciales_qr (id, persona_id, token_hash, emitida_por, emitida_en, expira_en, revocada_en, revocada_por) FROM stdin;
\.


--
-- TOC entry 6955 (class 0 OID 18024)
-- Dependencies: 287
-- Data for Name: cuotas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.cuotas (id, matricula_id, estudiante_id, tramo_id, anio_id, grado_id, concepto, obligacion_ingreso_id, numero, importe, mes_servicio, exigible_desde, vence_en, emitida_en) FROM stdin;
\.


--
-- TOC entry 6992 (class 0 OID 18581)
-- Dependencies: 325
-- Data for Name: cursos_seccion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.cursos_seccion (id, seccion_plan_id, plan_id, seccion_id, asignatura_id, activo) FROM stdin;
\.


--
-- TOC entry 7040 (class 0 OID 19546)
-- Dependencies: 376
-- Data for Name: detalle_liquidacion_docente; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.detalle_liquidacion_docente (id, liquidacion_id, hora_docente_id, tipo, concepto, importe, registrado_por, registrado_en) FROM stdin;
\.


--
-- TOC entry 6969 (class 0 OID 18239)
-- Dependencies: 301
-- Data for Name: devoluciones; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.devoluciones (id, pago_id, aplicacion_id, sesion_caja_id, importe, motivo, evidencia_id, autorizado_por, devuelto_en) FROM stdin;
\.


--
-- TOC entry 6896 (class 0 OID 17179)
-- Dependencies: 228
-- Data for Name: docentes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.docentes (id, persona_id, codigo, activo) FROM stdin;
\.


--
-- TOC entry 7049 (class 0 OID 19748)
-- Dependencies: 387
-- Data for Name: documentos_emitidos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.documentos_emitidos (id, solicitud_uuid, plantilla_id, tipo, anio_id, formato, parametros, datos, solicitado_por, solicitado_en, estado, archivo_id, procesado_por, procesado_en, motivo_fallo, anulado_por, anulado_en, motivo_anulacion) FROM stdin;
\.


--
-- TOC entry 6938 (class 0 OID 17739)
-- Dependencies: 270
-- Data for Name: documentos_expediente; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.documentos_expediente (id, estudiante_id, matricula_id, tipo_documento_id, archivo_id, estado, cargado_por, cargado_en, revisado_por, revisado_en, observacion) FROM stdin;
\.


--
-- TOC entry 6892 (class 0 OID 17132)
-- Dependencies: 224
-- Data for Name: documentos_identidad; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.documentos_identidad (id, persona_id, tipo, pais_emisor, numero, verificado_en) FROM stdin;
\.


--
-- TOC entry 6940 (class 0 OID 17788)
-- Dependencies: 272
-- Data for Name: documentos_institucionales; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.documentos_institucionales (id, anio_id, tipo, version, archivo_id, vigente_desde, publicado_en) FROM stdin;
\.


--
-- TOC entry 7064 (class 0 OID 20196)
-- Dependencies: 407
-- Data for Name: equivalencias_historicas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.equivalencias_historicas (sistema, entidad, clave_origen, lote_id, estudiante_id, docente_id, curso_id, matricula_id) FROM stdin;
\.


--
-- TOC entry 6914 (class 0 OID 17383)
-- Dependencies: 246
-- Data for Name: estudiante_apoderado; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.estudiante_apoderado (id, estudiante_id, persona_id, parentesco, vigencia, verificado_por, verificado_en, evidencia_id, acceso_academico, acceso_economico) FROM stdin;
\.


--
-- TOC entry 6894 (class 0 OID 17155)
-- Dependencies: 226
-- Data for Name: estudiantes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.estudiantes (id, persona_id, codigo, codigo_siagie, activo) FROM stdin;
\.


--
-- TOC entry 7057 (class 0 OID 19988)
-- Dependencies: 397
-- Data for Name: evaluaciones_recuperacion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.evaluaciones_recuperacion (id, resultado_origen_id, intento, tipo, fecha, nivel_logro, conclusion, evidencia_id, registrado_por, registrado_en, estado, aprobado_por, aprobado_en) FROM stdin;
\.


--
-- TOC entry 7012 (class 0 OID 18948)
-- Dependencies: 346
-- Data for Name: exportaciones_siagie; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.exportaciones_siagie (id, plantilla_id, seccion_id, bimestre_id, solicitado_por, solicitado_en, contenido, resultado_archivo_id, estado, observacion) FROM stdin;
\.


--
-- TOC entry 7063 (class 0 OID 20177)
-- Dependencies: 406
-- Data for Name: filas_importacion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.filas_importacion (lote_id, entidad, clave_origen, datos) FROM stdin;
\.


--
-- TOC entry 6923 (class 0 OID 17496)
-- Dependencies: 255
-- Data for Name: grados; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.grados (id, nivel_id, numero) FROM stdin;
1	1	1
2	1	2
3	1	3
4	1	4
5	1	5
6	1	6
7	2	1
8	2	2
9	2	3
10	2	4
11	2	5
\.


--
-- TOC entry 7034 (class 0 OID 19412)
-- Dependencies: 370
-- Data for Name: horas_docentes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.horas_docentes (id, contrato_id, sesion_id, fecha, hora_inicio, hora_fin, motivo, evidencia_id, registrado_por, registrado_en, estado, resuelto_por, resuelto_en, decision) FROM stdin;
\.


--
-- TOC entry 7018 (class 0 OID 19060)
-- Dependencies: 352
-- Data for Name: jornadas_docente; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.jornadas_docente (id, docente_id, anio_id, politica_id, fecha, entrada, salida, estado) FROM stdin;
\.


--
-- TOC entry 7016 (class 0 OID 19027)
-- Dependencies: 350
-- Data for Name: jornadas_seccion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.jornadas_seccion (id, seccion_id, anio_id, grado_id, politica_id, fecha, entrada, salida, estado) FROM stdin;
\.


--
-- TOC entry 7030 (class 0 OID 19304)
-- Dependencies: 364
-- Data for Name: justificaciones_asistencia; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.justificaciones_asistencia (id, asistencia_estudiante_id, asistencia_docente_id, solicitada_por, solicitada_en, motivo, evidencia_id, estado, resuelta_por, resuelta_en, decision) FROM stdin;
\.


--
-- TOC entry 7020 (class 0 OID 19101)
-- Dependencies: 354
-- Data for Name: lectores_qr; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.lectores_qr (id, codigo, nombre, activo) FROM stdin;
\.


--
-- TOC entry 7038 (class 0 OID 19496)
-- Dependencies: 374
-- Data for Name: liquidaciones_docentes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.liquidaciones_docentes (id, contrato_id, periodo_id, moneda, modalidad, sueldo_mensual, tarifa_hora, minutos_por_hora, vigencia_aplicada, importe_fijo, motivo_prorrateo, estado, registrado_por, registrado_en, aprobado_por, aprobado_en) FROM stdin;
\.


--
-- TOC entry 7062 (class 0 OID 20149)
-- Dependencies: 405
-- Data for Name: lotes_importacion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.lotes_importacion (id, sistema, sha256, conteos_esperados, creado_por, creado_en, estado, sellado_en, cerrado_en) FROM stdin;
\.


--
-- TOC entry 7010 (class 0 OID 18913)
-- Dependencies: 344
-- Data for Name: mapeos_siagie; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.mapeos_siagie (id, plantilla_id, competencia_id, hoja, codigo_excel, columna_nl, columna_conclusion) FROM stdin;
\.


--
-- TOC entry 7024 (class 0 OID 19154)
-- Dependencies: 358
-- Data for Name: marcaciones; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.marcaciones (id, evento_uuid, persona_id, instante, tipo, metodo, credencial_id, lector_id, actor_id, motivo, registrada_en) FROM stdin;
\.


--
-- TOC entry 6931 (class 0 OID 17636)
-- Dependencies: 263
-- Data for Name: matricula_secciones; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.matricula_secciones (id, matricula_id, seccion_id, anio_id, grado_id, vigencia, tipo_vacante, registrado_por) FROM stdin;
\.


--
-- TOC entry 6929 (class 0 OID 17583)
-- Dependencies: 261
-- Data for Name: matriculas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.matriculas (id, estudiante_id, anio_id, grado_id, regla_id, tipo_ingreso, solicitada_en, confirmada_en, estado, referencia_siagie, registrado_por) FROM stdin;
\.


--
-- TOC entry 6933 (class 0 OID 17672)
-- Dependencies: 265
-- Data for Name: movimientos_matricula; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.movimientos_matricula (id, matricula_id, tipo, fecha_efectiva, motivo, detalle, evidencia_id, registrado_por, registrado_en) FROM stdin;
\.


--
-- TOC entry 6921 (class 0 OID 17482)
-- Dependencies: 253
-- Data for Name: niveles; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.niveles (id, codigo, nombre) FROM stdin;
1	primaria	Primaria
2	secundaria	Secundaria
\.


--
-- TOC entry 6953 (class 0 OID 17998)
-- Dependencies: 285
-- Data for Name: obligaciones_ingreso; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.obligaciones_ingreso (id, estudiante_id, matricula_ingreso_id, importe_acordado, condiciones_id) FROM stdin;
\.


--
-- TOC entry 7060 (class 0 OID 20109)
-- Dependencies: 402
-- Data for Name: orden_merito; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.orden_merito (publicacion_id, matricula_id, cierre_anual_id, puesto, calificativo, sustento_desempate) FROM stdin;
\.


--
-- TOC entry 6963 (class 0 OID 18148)
-- Dependencies: 295
-- Data for Name: pagos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.pagos (id, clave_idempotencia, sesion_caja_id, registrado_por, pagante_persona_id, pagante_tipo_documento, pagante_numero_documento, pagante_nombre, pagante_direccion, importe, medio, referencia, pagado_en) FROM stdin;
\.


--
-- TOC entry 7042 (class 0 OID 19581)
-- Dependencies: 378
-- Data for Name: pagos_docentes; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.pagos_docentes (id, liquidacion_id, clave_idempotencia, importe, medio, referencia, evidencia_id, pagado_en, registrado_por) FROM stdin;
\.


--
-- TOC entry 7036 (class 0 OID 19464)
-- Dependencies: 372
-- Data for Name: periodos_liquidacion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.periodos_liquidacion (id, mes, estado, registrado_por, creado_en, cerrado_por, cerrado_en) FROM stdin;
\.


--
-- TOC entry 6902 (class 0 OID 17240)
-- Dependencies: 234
-- Data for Name: permisos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.permisos (id, codigo, descripcion) FROM stdin;
1	usuarios.gestionar	Administrar cuentas y recuperación de acceso
2	matriculas.gestionar	Gestionar matrícula y cambios de sección
3	expediente.gestionar	Registrar y revisar documentos
4	tesoreria.cobrar	Registrar cobros y emitir recibos internos
5	tesoreria.revertir	Autorizar reversiones y devoluciones
6	familia.consultar	Consultar información familiar autorizada
7	academico.configurar	Configurar currículo y horarios
8	academico.calificar	Registrar notas en las asignaciones autorizadas
9	academico.publicar	Cerrar y publicar evaluaciones
10	academico.exportar_siagie	Preparar exportaciones SIAGIE
11	asistencia.configurar	Configurar jornadas, políticas, lectores y credenciales
12	asistencia.marcar	Registrar entradas y salidas
13	asistencia.registrar	Registrar y revisar la asistencia
14	asistencia.justificar	Solicitar una justificación de asistencia
15	asistencia.resolver	Resolver justificaciones de asistencia
16	planilla.contratos	Registrar contratos y condiciones de remuneración
17	planilla.horas	Registrar horas docentes trabajadas
18	planilla.aprobar_horas	Resolver horas docentes
19	planilla.liquidar	Preparar y aprobar liquidaciones docentes
20	planilla.pagar	Registrar pagos de liquidaciones docentes
21	planilla.revertir_pago	Autorizar reversiones de pagos docentes
22	reportes.configurar	Administrar y publicar plantillas de documentos
23	reportes.matriculas	Emitir ficha y nómina de matrícula
24	reportes.tesoreria	Emitir estados de cuenta
25	reportes.academico	Emitir reportes de notas publicadas
26	reportes.asistencia	Emitir reportes de asistencia
27	reportes.dashboard	Consultar y exportar indicadores institucionales
28	academico.configurar_cierre_anual	Versionar reglas de evaluación anual
29	academico.cerrar_anio	Registrar y aprobar situaciones finales
30	academico.recuperacion	Gestionar evaluaciones de recuperación y subsanación
31	academico.publicar_merito	Conciliar y publicar el listado oficial de SIAGIE
32	datos.conciliar_historico	Revisar y conciliar lotes de datos históricos
\.


--
-- TOC entry 6890 (class 0 OID 17117)
-- Dependencies: 222
-- Data for Name: personas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.personas (id, nombres, apellidos, fecha_nacimiento, correo_contacto, telefono, direccion, creado_en) FROM stdin;
\.


--
-- TOC entry 6986 (class 0 OID 18497)
-- Dependencies: 319
-- Data for Name: plan_asignaturas; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.plan_asignaturas (plan_id, asignatura_id) FROM stdin;
\.


--
-- TOC entry 6987 (class 0 OID 18514)
-- Dependencies: 320
-- Data for Name: plan_competencias; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.plan_competencias (plan_id, competencia_id) FROM stdin;
\.


--
-- TOC entry 6947 (class 0 OID 17900)
-- Dependencies: 279
-- Data for Name: planes_cobro; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.planes_cobro (id, anio_id, grado_id, version, condiciones_id, pension_referencia, vigente_desde, publicado_en) FROM stdin;
\.


--
-- TOC entry 6985 (class 0 OID 18473)
-- Dependencies: 318
-- Data for Name: planes_estudio; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.planes_estudio (id, anio_id, grado_id, version, publicado_en) FROM stdin;
\.


--
-- TOC entry 7047 (class 0 OID 19700)
-- Dependencies: 385
-- Data for Name: plantillas_documento; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.plantillas_documento (id, tipo, anio_id, formato, version, nombre, archivo_id, configuracion, creada_por, creada_en, publicada_en) FROM stdin;
\.


--
-- TOC entry 7008 (class 0 OID 18880)
-- Dependencies: 342
-- Data for Name: plantillas_siagie; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.plantillas_siagie (id, archivo_id, seccion_id, bimestre_id, anio_id, grado_id, version) FROM stdin;
\.


--
-- TOC entry 7014 (class 0 OID 18988)
-- Dependencies: 348
-- Data for Name: politicas_asistencia; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.politicas_asistencia (id, anio_id, alcance, turno, vigencia, admite_qr, admite_manual, tolerancia_minutos, ventana_entrada_minutos, ventana_salida_minutos) FROM stdin;
\.


--
-- TOC entry 7059 (class 0 OID 20054)
-- Dependencies: 401
-- Data for Name: publicaciones_merito; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.publicaciones_merito (id, anio_id, grado_id, regla_id, alcance, version, archivo_siagie_id, referencia_siagie, registrado_por, registrado_en, publicado_por, publicado_en) FROM stdin;
\.


--
-- TOC entry 6973 (class 0 OID 18300)
-- Dependencies: 305
-- Data for Name: recibos_caja; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.recibos_caja (id, pago_id, serie_id, numero, emitido_por, emitido_en) FROM stdin;
\.


--
-- TOC entry 7051 (class 0 OID 19829)
-- Dependencies: 391
-- Data for Name: reglas_evaluacion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.reglas_evaluacion (id, anio_id, grado_id, version, referencia_normativa, criterios, evidencia_id, aprobado_por, aprobado_en) FROM stdin;
\.


--
-- TOC entry 6927 (class 0 OID 17548)
-- Dependencies: 259
-- Data for Name: reglas_matricula; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.reglas_matricula (id, anio_id, grado_id, tipo_ingreso, version, solicitudes_inicio, solicitudes_fin, corte_edad, edad_minima, edad_maxima, referencia_normativa, publicada_en) FROM stdin;
\.


--
-- TOC entry 6936 (class 0 OID 17716)
-- Dependencies: 268
-- Data for Name: requisitos_matricula; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.requisitos_matricula (regla_id, tipo_documento_id, obligatorio, admite_regularizacion, plazo_regularizacion) FROM stdin;
\.


--
-- TOC entry 6951 (class 0 OID 17971)
-- Dependencies: 283
-- Data for Name: responsables_economicos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.responsables_economicos (id, matricula_id, persona_id, tipo_documento, numero_documento, nombre_razon_social, direccion, vigencia) FROM stdin;
\.


--
-- TOC entry 7055 (class 0 OID 19949)
-- Dependencies: 395
-- Data for Name: resultados_anuales_competencia; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.resultados_anuales_competencia (id, cierre_anual_id, plan_id, competencia_id, nivel_logro, conclusion, requiere_recuperacion, calificacion_id, resultado_anterior_id, recuperacion_id) FROM stdin;
\.


--
-- TOC entry 6967 (class 0 OID 18213)
-- Dependencies: 299
-- Data for Name: reversiones_pago; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.reversiones_pago (id, pago_id, motivo, autorizado_por, revertido_en) FROM stdin;
\.


--
-- TOC entry 7044 (class 0 OID 19616)
-- Dependencies: 380
-- Data for Name: reversiones_pago_docente; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.reversiones_pago_docente (id, pago_id, motivo, evidencia_id, autorizado_por, revertido_en) FROM stdin;
\.


--
-- TOC entry 7006 (class 0 OID 18845)
-- Dependencies: 340
-- Data for Name: revisiones_calificacion; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.revisiones_calificacion (id, calificacion_id, anterior, nueva, autor_id, motivo, registrado_en) FROM stdin;
\.


--
-- TOC entry 6904 (class 0 OID 17269)
-- Dependencies: 236
-- Data for Name: rol_permisos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.rol_permisos (rol_id, permiso_id) FROM stdin;
1	1
1	2
1	3
1	4
1	5
4	6
1	7
1	8
2	8
1	9
1	10
1	11
1	12
1	13
2	13
1	14
2	14
3	14
4	14
1	15
1	16
1	17
1	18
1	19
1	20
1	21
1	22
1	23
1	24
1	25
1	26
1	27
1	28
1	29
1	30
1	31
1	32
\.


--
-- TOC entry 6900 (class 0 OID 17227)
-- Dependencies: 232
-- Data for Name: roles; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.roles (id, codigo, nombre) FROM stdin;
1	admin	Administrador
2	docente	Docente
3	alumno	Alumno
4	apoderado	Apoderado
\.


--
-- TOC entry 6990 (class 0 OID 18550)
-- Dependencies: 323
-- Data for Name: seccion_planes_estudio; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.seccion_planes_estudio (id, seccion_id, plan_id, anio_id, grado_id, vigencia) FROM stdin;
\.


--
-- TOC entry 6925 (class 0 OID 17513)
-- Dependencies: 257
-- Data for Name: secciones; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.secciones (id, anio_id, grado_id, nombre, turno, cupo, reserva, activa) FROM stdin;
\.


--
-- TOC entry 6971 (class 0 OID 18281)
-- Dependencies: 303
-- Data for Name: series_recibos; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.series_recibos (id, codigo, numero_inicial, siguiente_numero, activa) FROM stdin;
\.


--
-- TOC entry 6908 (class 0 OID 17317)
-- Dependencies: 240
-- Data for Name: sesiones; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.sesiones (id, usuario_id, token_hash, creada_en, expira_en, revocada_en) FROM stdin;
\.


--
-- TOC entry 6961 (class 0 OID 18121)
-- Dependencies: 293
-- Data for Name: sesiones_caja; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.sesiones_caja (id, caja_id, operador_id, abierta_en, cerrada_en, saldo_inicial, saldo_contado) FROM stdin;
\.


--
-- TOC entry 7000 (class 0 OID 18697)
-- Dependencies: 333
-- Data for Name: sesiones_clase; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.sesiones_clase (id, curso_id, seccion_id, bloque_id, asignacion_id, docente_id, aula_id, fecha, hora_inicio, hora_fin, estado) FROM stdin;
\.


--
-- TOC entry 6935 (class 0 OID 17704)
-- Dependencies: 267
-- Data for Name: tipos_documento; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.tipos_documento (id, codigo, nombre) FROM stdin;
\.


--
-- TOC entry 7045 (class 0 OID 19684)
-- Dependencies: 383
-- Data for Name: tipos_reporte; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.tipos_reporte (codigo, nombre, permiso) FROM stdin;
ficha_matricula	Ficha de matrícula	reportes.matriculas
nomina	Nómina de matrícula	reportes.matriculas
estado_cuenta	Estado de cuenta	reportes.tesoreria
notas	Informe de notas	reportes.academico
asistencia_alumnos	Asistencia de alumnos	reportes.asistencia
asistencia_docentes	Asistencia de docentes	reportes.asistencia
dashboard	Indicadores institucionales	reportes.dashboard
\.


--
-- TOC entry 6906 (class 0 OID 17287)
-- Dependencies: 238
-- Data for Name: tokens_acceso; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.tokens_acceso (id, usuario_id, emisor_id, proposito, token_hash, emitido_en, expira_en, consumido_en, revocado_en) FROM stdin;
\.


--
-- TOC entry 6949 (class 0 OID 17932)
-- Dependencies: 281
-- Data for Name: tramos_plan_cobro; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.tramos_plan_cobro (id, plan_id, anio_id, grado_id, concepto, numero, importe, mes_servicio, exigible_desde, vence_en) FROM stdin;
\.


--
-- TOC entry 6903 (class 0 OID 17252)
-- Dependencies: 235
-- Data for Name: usuario_roles; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.usuario_roles (usuario_id, rol_id) FROM stdin;
\.


--
-- TOC entry 6898 (class 0 OID 17201)
-- Dependencies: 230
-- Data for Name: usuarios; Type: TABLE DATA; Schema: excelencia_seruna; Owner: postgres
--

COPY excelencia_seruna.usuarios (id, persona_id, login, contrasena_hash, correo_recuperacion, correo_verificado_en, estado, ultimo_acceso) FROM stdin;
\.


--
-- TOC entry 7077 (class 0 OID 0)
-- Dependencies: 275
-- Name: aceptaciones_documento_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.aceptaciones_documento_id_seq', 1, false);


--
-- TOC entry 7078 (class 0 OID 0)
-- Dependencies: 288
-- Name: ajustes_cuota_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.ajustes_cuota_id_seq', 1, false);


--
-- TOC entry 7079 (class 0 OID 0)
-- Dependencies: 247
-- Name: anios_academicos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.anios_academicos_id_seq', 1, false);


--
-- TOC entry 7080 (class 0 OID 0)
-- Dependencies: 296
-- Name: aplicaciones_pago_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.aplicaciones_pago_id_seq', 1, false);


--
-- TOC entry 7081 (class 0 OID 0)
-- Dependencies: 243
-- Name: archivos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.archivos_id_seq', 1, false);


--
-- TOC entry 7082 (class 0 OID 0)
-- Dependencies: 309
-- Name: areas_curriculares_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.areas_curriculares_id_seq', 1, false);


--
-- TOC entry 7083 (class 0 OID 0)
-- Dependencies: 326
-- Name: asignaciones_docentes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.asignaciones_docentes_id_seq', 1, false);


--
-- TOC entry 7084 (class 0 OID 0)
-- Dependencies: 315
-- Name: asignaturas_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.asignaturas_id_seq', 1, false);


--
-- TOC entry 7085 (class 0 OID 0)
-- Dependencies: 361
-- Name: asistencia_docentes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.asistencia_docentes_id_seq', 1, false);


--
-- TOC entry 7086 (class 0 OID 0)
-- Dependencies: 359
-- Name: asistencia_estudiantes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.asistencia_estudiantes_id_seq', 1, false);


--
-- TOC entry 7087 (class 0 OID 0)
-- Dependencies: 328
-- Name: aulas_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.aulas_id_seq', 1, false);


--
-- TOC entry 7088 (class 0 OID 0)
-- Dependencies: 249
-- Name: bimestres_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.bimestres_id_seq', 1, false);


--
-- TOC entry 7089 (class 0 OID 0)
-- Dependencies: 241
-- Name: bitacora_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.bitacora_id_seq', 1, false);


--
-- TOC entry 7090 (class 0 OID 0)
-- Dependencies: 330
-- Name: bloques_horario_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.bloques_horario_id_seq', 1, false);


--
-- TOC entry 7091 (class 0 OID 0)
-- Dependencies: 290
-- Name: cajas_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.cajas_id_seq', 1, false);


--
-- TOC entry 7092 (class 0 OID 0)
-- Dependencies: 337
-- Name: calificaciones_competencia_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.calificaciones_competencia_id_seq', 1, false);


--
-- TOC entry 7093 (class 0 OID 0)
-- Dependencies: 313
-- Name: capacidades_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.capacidades_id_seq', 1, false);


--
-- TOC entry 7094 (class 0 OID 0)
-- Dependencies: 392
-- Name: cierres_anuales_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.cierres_anuales_id_seq', 1, false);


--
-- TOC entry 7095 (class 0 OID 0)
-- Dependencies: 335
-- Name: cierres_evaluacion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.cierres_evaluacion_id_seq', 1, false);


--
-- TOC entry 7096 (class 0 OID 0)
-- Dependencies: 311
-- Name: competencias_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.competencias_id_seq', 1, false);


--
-- TOC entry 7097 (class 0 OID 0)
-- Dependencies: 306
-- Name: comprobantes_externos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.comprobantes_externos_id_seq', 1, false);


--
-- TOC entry 7098 (class 0 OID 0)
-- Dependencies: 273
-- Name: comunicaciones_documento_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.comunicaciones_documento_id_seq', 1, false);


--
-- TOC entry 7099 (class 0 OID 0)
-- Dependencies: 367
-- Name: contratos_docentes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.contratos_docentes_id_seq', 1, false);


--
-- TOC entry 7100 (class 0 OID 0)
-- Dependencies: 355
-- Name: credenciales_qr_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.credenciales_qr_id_seq', 1, false);


--
-- TOC entry 7101 (class 0 OID 0)
-- Dependencies: 286
-- Name: cuotas_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.cuotas_id_seq', 1, false);


--
-- TOC entry 7102 (class 0 OID 0)
-- Dependencies: 324
-- Name: cursos_seccion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.cursos_seccion_id_seq', 1, false);


--
-- TOC entry 7103 (class 0 OID 0)
-- Dependencies: 375
-- Name: detalle_liquidacion_docente_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.detalle_liquidacion_docente_id_seq', 1, false);


--
-- TOC entry 7104 (class 0 OID 0)
-- Dependencies: 300
-- Name: devoluciones_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.devoluciones_id_seq', 1, false);


--
-- TOC entry 7105 (class 0 OID 0)
-- Dependencies: 227
-- Name: docentes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.docentes_id_seq', 1, false);


--
-- TOC entry 7106 (class 0 OID 0)
-- Dependencies: 386
-- Name: documentos_emitidos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.documentos_emitidos_id_seq', 1, false);


--
-- TOC entry 7107 (class 0 OID 0)
-- Dependencies: 269
-- Name: documentos_expediente_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.documentos_expediente_id_seq', 1, false);


--
-- TOC entry 7108 (class 0 OID 0)
-- Dependencies: 223
-- Name: documentos_identidad_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.documentos_identidad_id_seq', 1, false);


--
-- TOC entry 7109 (class 0 OID 0)
-- Dependencies: 271
-- Name: documentos_institucionales_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.documentos_institucionales_id_seq', 1, false);


--
-- TOC entry 7110 (class 0 OID 0)
-- Dependencies: 245
-- Name: estudiante_apoderado_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.estudiante_apoderado_id_seq', 1, false);


--
-- TOC entry 7111 (class 0 OID 0)
-- Dependencies: 225
-- Name: estudiantes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.estudiantes_id_seq', 1, false);


--
-- TOC entry 7112 (class 0 OID 0)
-- Dependencies: 396
-- Name: evaluaciones_recuperacion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.evaluaciones_recuperacion_id_seq', 1, false);


--
-- TOC entry 7113 (class 0 OID 0)
-- Dependencies: 345
-- Name: exportaciones_siagie_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.exportaciones_siagie_id_seq', 1, false);


--
-- TOC entry 7114 (class 0 OID 0)
-- Dependencies: 254
-- Name: grados_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.grados_id_seq', 11, true);


--
-- TOC entry 7115 (class 0 OID 0)
-- Dependencies: 369
-- Name: horas_docentes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.horas_docentes_id_seq', 1, false);


--
-- TOC entry 7116 (class 0 OID 0)
-- Dependencies: 351
-- Name: jornadas_docente_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.jornadas_docente_id_seq', 1, false);


--
-- TOC entry 7117 (class 0 OID 0)
-- Dependencies: 349
-- Name: jornadas_seccion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.jornadas_seccion_id_seq', 1, false);


--
-- TOC entry 7118 (class 0 OID 0)
-- Dependencies: 363
-- Name: justificaciones_asistencia_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.justificaciones_asistencia_id_seq', 1, false);


--
-- TOC entry 7119 (class 0 OID 0)
-- Dependencies: 353
-- Name: lectores_qr_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.lectores_qr_id_seq', 1, false);


--
-- TOC entry 7120 (class 0 OID 0)
-- Dependencies: 373
-- Name: liquidaciones_docentes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.liquidaciones_docentes_id_seq', 1, false);


--
-- TOC entry 7121 (class 0 OID 0)
-- Dependencies: 404
-- Name: lotes_importacion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.lotes_importacion_id_seq', 1, false);


--
-- TOC entry 7122 (class 0 OID 0)
-- Dependencies: 343
-- Name: mapeos_siagie_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.mapeos_siagie_id_seq', 1, false);


--
-- TOC entry 7123 (class 0 OID 0)
-- Dependencies: 357
-- Name: marcaciones_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.marcaciones_id_seq', 1, false);


--
-- TOC entry 7124 (class 0 OID 0)
-- Dependencies: 262
-- Name: matricula_secciones_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.matricula_secciones_id_seq', 1, false);


--
-- TOC entry 7125 (class 0 OID 0)
-- Dependencies: 260
-- Name: matriculas_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.matriculas_id_seq', 1, false);


--
-- TOC entry 7126 (class 0 OID 0)
-- Dependencies: 264
-- Name: movimientos_matricula_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.movimientos_matricula_id_seq', 1, false);


--
-- TOC entry 7127 (class 0 OID 0)
-- Dependencies: 252
-- Name: niveles_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.niveles_id_seq', 2, true);


--
-- TOC entry 7128 (class 0 OID 0)
-- Dependencies: 284
-- Name: obligaciones_ingreso_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.obligaciones_ingreso_id_seq', 1, false);


--
-- TOC entry 7129 (class 0 OID 0)
-- Dependencies: 377
-- Name: pagos_docentes_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.pagos_docentes_id_seq', 1, false);


--
-- TOC entry 7130 (class 0 OID 0)
-- Dependencies: 294
-- Name: pagos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.pagos_id_seq', 1, false);


--
-- TOC entry 7131 (class 0 OID 0)
-- Dependencies: 371
-- Name: periodos_liquidacion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.periodos_liquidacion_id_seq', 1, false);


--
-- TOC entry 7132 (class 0 OID 0)
-- Dependencies: 233
-- Name: permisos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.permisos_id_seq', 32, true);


--
-- TOC entry 7133 (class 0 OID 0)
-- Dependencies: 221
-- Name: personas_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.personas_id_seq', 1, false);


--
-- TOC entry 7134 (class 0 OID 0)
-- Dependencies: 278
-- Name: planes_cobro_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.planes_cobro_id_seq', 1, false);


--
-- TOC entry 7135 (class 0 OID 0)
-- Dependencies: 317
-- Name: planes_estudio_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.planes_estudio_id_seq', 1, false);


--
-- TOC entry 7136 (class 0 OID 0)
-- Dependencies: 384
-- Name: plantillas_documento_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.plantillas_documento_id_seq', 1, false);


--
-- TOC entry 7137 (class 0 OID 0)
-- Dependencies: 341
-- Name: plantillas_siagie_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.plantillas_siagie_id_seq', 1, false);


--
-- TOC entry 7138 (class 0 OID 0)
-- Dependencies: 347
-- Name: politicas_asistencia_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.politicas_asistencia_id_seq', 1, false);


--
-- TOC entry 7139 (class 0 OID 0)
-- Dependencies: 400
-- Name: publicaciones_merito_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.publicaciones_merito_id_seq', 1, false);


--
-- TOC entry 7140 (class 0 OID 0)
-- Dependencies: 304
-- Name: recibos_caja_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.recibos_caja_id_seq', 1, false);


--
-- TOC entry 7141 (class 0 OID 0)
-- Dependencies: 390
-- Name: reglas_evaluacion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.reglas_evaluacion_id_seq', 1, false);


--
-- TOC entry 7142 (class 0 OID 0)
-- Dependencies: 258
-- Name: reglas_matricula_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.reglas_matricula_id_seq', 1, false);


--
-- TOC entry 7143 (class 0 OID 0)
-- Dependencies: 282
-- Name: responsables_economicos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.responsables_economicos_id_seq', 1, false);


--
-- TOC entry 7144 (class 0 OID 0)
-- Dependencies: 394
-- Name: resultados_anuales_competencia_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.resultados_anuales_competencia_id_seq', 1, false);


--
-- TOC entry 7145 (class 0 OID 0)
-- Dependencies: 379
-- Name: reversiones_pago_docente_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.reversiones_pago_docente_id_seq', 1, false);


--
-- TOC entry 7146 (class 0 OID 0)
-- Dependencies: 298
-- Name: reversiones_pago_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.reversiones_pago_id_seq', 1, false);


--
-- TOC entry 7147 (class 0 OID 0)
-- Dependencies: 339
-- Name: revisiones_calificacion_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.revisiones_calificacion_id_seq', 1, false);


--
-- TOC entry 7148 (class 0 OID 0)
-- Dependencies: 231
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.roles_id_seq', 4, true);


--
-- TOC entry 7149 (class 0 OID 0)
-- Dependencies: 322
-- Name: seccion_planes_estudio_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.seccion_planes_estudio_id_seq', 1, false);


--
-- TOC entry 7150 (class 0 OID 0)
-- Dependencies: 256
-- Name: secciones_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.secciones_id_seq', 1, false);


--
-- TOC entry 7151 (class 0 OID 0)
-- Dependencies: 302
-- Name: series_recibos_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.series_recibos_id_seq', 1, false);


--
-- TOC entry 7152 (class 0 OID 0)
-- Dependencies: 292
-- Name: sesiones_caja_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.sesiones_caja_id_seq', 1, false);


--
-- TOC entry 7153 (class 0 OID 0)
-- Dependencies: 332
-- Name: sesiones_clase_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.sesiones_clase_id_seq', 1, false);


--
-- TOC entry 7154 (class 0 OID 0)
-- Dependencies: 239
-- Name: sesiones_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.sesiones_id_seq', 1, false);


--
-- TOC entry 7155 (class 0 OID 0)
-- Dependencies: 266
-- Name: tipos_documento_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.tipos_documento_id_seq', 1, false);


--
-- TOC entry 7156 (class 0 OID 0)
-- Dependencies: 237
-- Name: tokens_acceso_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.tokens_acceso_id_seq', 1, false);


--
-- TOC entry 7157 (class 0 OID 0)
-- Dependencies: 280
-- Name: tramos_plan_cobro_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.tramos_plan_cobro_id_seq', 1, false);


--
-- TOC entry 7158 (class 0 OID 0)
-- Dependencies: 229
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: excelencia_seruna; Owner: postgres
--

SELECT pg_catalog.setval('excelencia_seruna.usuarios_id_seq', 1, false);


--
-- TOC entry 6130 (class 2606 OID 17868)
-- Name: aceptaciones_documento aceptaciones_documento_matricula_id_documento_id_firmante_i_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aceptaciones_documento
    ADD CONSTRAINT aceptaciones_documento_matricula_id_documento_id_firmante_i_key UNIQUE (matricula_id, documento_id, firmante_id);


--
-- TOC entry 6132 (class 2606 OID 17866)
-- Name: aceptaciones_documento aceptaciones_documento_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aceptaciones_documento
    ADD CONSTRAINT aceptaciones_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 6170 (class 2606 OID 18095)
-- Name: ajustes_cuota ajustes_cuota_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.ajustes_cuota
    ADD CONSTRAINT ajustes_cuota_pkey PRIMARY KEY (id);


--
-- TOC entry 6063 (class 2606 OID 17441)
-- Name: anios_academicos anios_academicos_anio_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.anios_academicos
    ADD CONSTRAINT anios_academicos_anio_key UNIQUE (anio);


--
-- TOC entry 6065 (class 2606 OID 17439)
-- Name: anios_academicos anios_academicos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.anios_academicos
    ADD CONSTRAINT anios_academicos_pkey PRIMARY KEY (id);


--
-- TOC entry 6184 (class 2606 OID 18201)
-- Name: aplicaciones_pago aplicaciones_pago_id_pago_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_id_pago_id_key UNIQUE (id, pago_id);


--
-- TOC entry 6186 (class 2606 OID 18199)
-- Name: aplicaciones_pago aplicaciones_pago_pago_id_cuota_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_pago_id_cuota_id_key UNIQUE (pago_id, cuota_id);


--
-- TOC entry 6188 (class 2606 OID 18197)
-- Name: aplicaciones_pago aplicaciones_pago_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_pkey PRIMARY KEY (id);


--
-- TOC entry 6054 (class 2606 OID 17381)
-- Name: archivos archivos_clave_almacenamiento_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.archivos
    ADD CONSTRAINT archivos_clave_almacenamiento_key UNIQUE (clave_almacenamiento);


--
-- TOC entry 6056 (class 2606 OID 17379)
-- Name: archivos archivos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.archivos
    ADD CONSTRAINT archivos_pkey PRIMARY KEY (id);


--
-- TOC entry 6211 (class 2606 OID 18409)
-- Name: areas_curriculares areas_curriculares_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.areas_curriculares
    ADD CONSTRAINT areas_curriculares_codigo_key UNIQUE (codigo);


--
-- TOC entry 6213 (class 2606 OID 18407)
-- Name: areas_curriculares areas_curriculares_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.areas_curriculares
    ADD CONSTRAINT areas_curriculares_pkey PRIMARY KEY (id);


--
-- TOC entry 6251 (class 2606 OID 18625)
-- Name: asignaciones_docentes asignaciones_docentes_curso_id_docente_id_vigencia_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaciones_docentes
    ADD CONSTRAINT asignaciones_docentes_curso_id_docente_id_vigencia_excl EXCLUDE USING gist (curso_id WITH =, docente_id WITH =, vigencia WITH &&);


--
-- TOC entry 6253 (class 2606 OID 18623)
-- Name: asignaciones_docentes asignaciones_docentes_id_curso_id_docente_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaciones_docentes
    ADD CONSTRAINT asignaciones_docentes_id_curso_id_docente_id_key UNIQUE (id, curso_id, docente_id);


--
-- TOC entry 6255 (class 2606 OID 18621)
-- Name: asignaciones_docentes asignaciones_docentes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaciones_docentes
    ADD CONSTRAINT asignaciones_docentes_pkey PRIMARY KEY (id);


--
-- TOC entry 6237 (class 2606 OID 18538)
-- Name: asignatura_competencias asignatura_competencias_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignatura_competencias
    ADD CONSTRAINT asignatura_competencias_pkey PRIMARY KEY (plan_id, asignatura_id, competencia_id);


--
-- TOC entry 6223 (class 2606 OID 18466)
-- Name: asignaturas asignaturas_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaturas
    ADD CONSTRAINT asignaturas_codigo_key UNIQUE (codigo);


--
-- TOC entry 6225 (class 2606 OID 18464)
-- Name: asignaturas asignaturas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaturas
    ADD CONSTRAINT asignaturas_pkey PRIMARY KEY (id);


--
-- TOC entry 6346 (class 2606 OID 19280)
-- Name: asistencia_docentes asistencia_docentes_jornada_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_docentes
    ADD CONSTRAINT asistencia_docentes_jornada_id_key UNIQUE (jornada_id);


--
-- TOC entry 6348 (class 2606 OID 19278)
-- Name: asistencia_docentes asistencia_docentes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_docentes
    ADD CONSTRAINT asistencia_docentes_pkey PRIMARY KEY (id);


--
-- TOC entry 6342 (class 2606 OID 19221)
-- Name: asistencia_estudiantes asistencia_estudiantes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_pkey PRIMARY KEY (id);


--
-- TOC entry 6257 (class 2606 OID 18651)
-- Name: aulas aulas_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aulas
    ADD CONSTRAINT aulas_codigo_key UNIQUE (codigo);


--
-- TOC entry 6259 (class 2606 OID 18649)
-- Name: aulas aulas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aulas
    ADD CONSTRAINT aulas_pkey PRIMARY KEY (id);


--
-- TOC entry 6067 (class 2606 OID 17459)
-- Name: bimestres bimestres_anio_id_daterange_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bimestres
    ADD CONSTRAINT bimestres_anio_id_daterange_excl EXCLUDE USING gist (anio_id WITH =, daterange(inicio, fin, '[]'::text) WITH &&);


--
-- TOC entry 6069 (class 2606 OID 17457)
-- Name: bimestres bimestres_anio_id_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bimestres
    ADD CONSTRAINT bimestres_anio_id_numero_key UNIQUE (anio_id, numero);


--
-- TOC entry 6071 (class 2606 OID 18753)
-- Name: bimestres bimestres_id_anio_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bimestres
    ADD CONSTRAINT bimestres_id_anio_id_key UNIQUE (id, anio_id);


--
-- TOC entry 6073 (class 2606 OID 17455)
-- Name: bimestres bimestres_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bimestres
    ADD CONSTRAINT bimestres_pkey PRIMARY KEY (id);


--
-- TOC entry 6052 (class 2606 OID 17351)
-- Name: bitacora bitacora_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bitacora
    ADD CONSTRAINT bitacora_pkey PRIMARY KEY (id);


--
-- TOC entry 6261 (class 2606 OID 18680)
-- Name: bloques_horario bloques_horario_aula_id_dia_iso_vigencia_franja_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_aula_id_dia_iso_vigencia_franja_excl EXCLUDE USING gist (aula_id WITH =, dia_iso WITH =, vigencia WITH &&, franja WITH &&);


--
-- TOC entry 6263 (class 2606 OID 18678)
-- Name: bloques_horario bloques_horario_docente_id_dia_iso_vigencia_franja_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_docente_id_dia_iso_vigencia_franja_excl EXCLUDE USING gist (docente_id WITH =, dia_iso WITH =, vigencia WITH &&, franja WITH &&);


--
-- TOC entry 6265 (class 2606 OID 18674)
-- Name: bloques_horario bloques_horario_id_curso_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_id_curso_id_key UNIQUE (id, curso_id);


--
-- TOC entry 6267 (class 2606 OID 18672)
-- Name: bloques_horario bloques_horario_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_pkey PRIMARY KEY (id);


--
-- TOC entry 6269 (class 2606 OID 18676)
-- Name: bloques_horario bloques_horario_seccion_id_dia_iso_vigencia_franja_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_seccion_id_dia_iso_vigencia_franja_excl EXCLUDE USING gist (seccion_id WITH =, dia_iso WITH =, vigencia WITH &&, franja WITH &&);


--
-- TOC entry 6172 (class 2606 OID 18119)
-- Name: cajas cajas_nombre_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cajas
    ADD CONSTRAINT cajas_nombre_key UNIQUE (nombre);


--
-- TOC entry 6174 (class 2606 OID 18117)
-- Name: cajas cajas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cajas
    ADD CONSTRAINT cajas_pkey PRIMARY KEY (id);


--
-- TOC entry 6075 (class 2606 OID 17475)
-- Name: calendario_escolar calendario_escolar_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calendario_escolar
    ADD CONSTRAINT calendario_escolar_pkey PRIMARY KEY (anio_id, fecha);


--
-- TOC entry 6286 (class 2606 OID 18818)
-- Name: calificaciones_competencia calificaciones_competencia_matricula_id_bimestre_id_compete_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calificaciones_competencia
    ADD CONSTRAINT calificaciones_competencia_matricula_id_bimestre_id_compete_key UNIQUE (matricula_id, bimestre_id, competencia_id);


--
-- TOC entry 6288 (class 2606 OID 18816)
-- Name: calificaciones_competencia calificaciones_competencia_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calificaciones_competencia
    ADD CONSTRAINT calificaciones_competencia_pkey PRIMARY KEY (id);


--
-- TOC entry 6219 (class 2606 OID 18446)
-- Name: capacidades capacidades_competencia_id_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.capacidades
    ADD CONSTRAINT capacidades_competencia_id_codigo_key UNIQUE (competencia_id, codigo);


--
-- TOC entry 6221 (class 2606 OID 18444)
-- Name: capacidades capacidades_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.capacidades
    ADD CONSTRAINT capacidades_pkey PRIMARY KEY (id);


--
-- TOC entry 6409 (class 2606 OID 19903)
-- Name: cierres_anuales cierres_anuales_id_matricula_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_id_matricula_id_key UNIQUE (id, matricula_id);


--
-- TOC entry 6411 (class 2606 OID 19907)
-- Name: cierres_anuales cierres_anuales_id_plan_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_id_plan_id_key UNIQUE (id, plan_id);


--
-- TOC entry 6413 (class 2606 OID 19905)
-- Name: cierres_anuales cierres_anuales_matricula_id_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_matricula_id_version_key UNIQUE (matricula_id, version);


--
-- TOC entry 6415 (class 2606 OID 19901)
-- Name: cierres_anuales cierres_anuales_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_pkey PRIMARY KEY (id);


--
-- TOC entry 6279 (class 2606 OID 18777)
-- Name: cierres_evaluacion cierres_evaluacion_id_bimestre_id_anio_id_grado_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_evaluacion
    ADD CONSTRAINT cierres_evaluacion_id_bimestre_id_anio_id_grado_id_key UNIQUE (id, bimestre_id, anio_id, grado_id);


--
-- TOC entry 6281 (class 2606 OID 18773)
-- Name: cierres_evaluacion cierres_evaluacion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_evaluacion
    ADD CONSTRAINT cierres_evaluacion_pkey PRIMARY KEY (id);


--
-- TOC entry 6283 (class 2606 OID 18775)
-- Name: cierres_evaluacion cierres_evaluacion_seccion_id_bimestre_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_evaluacion
    ADD CONSTRAINT cierres_evaluacion_seccion_id_bimestre_id_key UNIQUE (seccion_id, bimestre_id);


--
-- TOC entry 6215 (class 2606 OID 18427)
-- Name: competencias competencias_codigo_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.competencias
    ADD CONSTRAINT competencias_codigo_version_key UNIQUE (codigo, version);


--
-- TOC entry 6217 (class 2606 OID 18425)
-- Name: competencias competencias_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.competencias
    ADD CONSTRAINT competencias_pkey PRIMARY KEY (id);


--
-- TOC entry 6207 (class 2606 OID 18348)
-- Name: comprobantes_externos comprobantes_externos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comprobantes_externos
    ADD CONSTRAINT comprobantes_externos_pkey PRIMARY KEY (id);


--
-- TOC entry 6209 (class 2606 OID 18350)
-- Name: comprobantes_externos comprobantes_externos_ruc_emisor_tipo_serie_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comprobantes_externos
    ADD CONSTRAINT comprobantes_externos_ruc_emisor_tipo_serie_numero_key UNIQUE (ruc_emisor, tipo, serie, numero);


--
-- TOC entry 6128 (class 2606 OID 17830)
-- Name: comunicaciones_documento comunicaciones_documento_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comunicaciones_documento
    ADD CONSTRAINT comunicaciones_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 6134 (class 2606 OID 17898)
-- Name: conceptos_cobro conceptos_cobro_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.conceptos_cobro
    ADD CONSTRAINT conceptos_cobro_pkey PRIMARY KEY (codigo);


--
-- TOC entry 6441 (class 2606 OID 20251)
-- Name: conciliaciones_historicas conciliaciones_historicas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.conciliaciones_historicas
    ADD CONSTRAINT conciliaciones_historicas_pkey PRIMARY KEY (lote_id, entidad, clave_origen);


--
-- TOC entry 6354 (class 2606 OID 19393)
-- Name: contratos_docentes contratos_docentes_docente_id_referencia_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.contratos_docentes
    ADD CONSTRAINT contratos_docentes_docente_id_referencia_key UNIQUE (docente_id, referencia);


--
-- TOC entry 6356 (class 2606 OID 19395)
-- Name: contratos_docentes contratos_docentes_docente_id_vigencia_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.contratos_docentes
    ADD CONSTRAINT contratos_docentes_docente_id_vigencia_excl EXCLUDE USING gist (docente_id WITH =, vigencia WITH &&);


--
-- TOC entry 6358 (class 2606 OID 19391)
-- Name: contratos_docentes contratos_docentes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.contratos_docentes
    ADD CONSTRAINT contratos_docentes_pkey PRIMARY KEY (id);


--
-- TOC entry 6326 (class 2606 OID 19137)
-- Name: credenciales_qr credenciales_qr_id_persona_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.credenciales_qr
    ADD CONSTRAINT credenciales_qr_id_persona_id_key UNIQUE (id, persona_id);


--
-- TOC entry 6329 (class 2606 OID 19133)
-- Name: credenciales_qr credenciales_qr_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.credenciales_qr
    ADD CONSTRAINT credenciales_qr_pkey PRIMARY KEY (id);


--
-- TOC entry 6331 (class 2606 OID 19135)
-- Name: credenciales_qr credenciales_qr_token_hash_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.credenciales_qr
    ADD CONSTRAINT credenciales_qr_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 6160 (class 2606 OID 18052)
-- Name: cuotas cuotas_matricula_id_concepto_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_matricula_id_concepto_numero_key UNIQUE (matricula_id, concepto, numero);


--
-- TOC entry 6162 (class 2606 OID 18054)
-- Name: cuotas cuotas_matricula_id_mes_servicio_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_matricula_id_mes_servicio_key UNIQUE (matricula_id, mes_servicio);


--
-- TOC entry 6164 (class 2606 OID 18056)
-- Name: cuotas cuotas_obligacion_ingreso_id_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_obligacion_ingreso_id_numero_key UNIQUE (obligacion_ingreso_id, numero);


--
-- TOC entry 6166 (class 2606 OID 18050)
-- Name: cuotas cuotas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_pkey PRIMARY KEY (id);


--
-- TOC entry 6245 (class 2606 OID 18596)
-- Name: cursos_seccion cursos_seccion_id_seccion_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cursos_seccion
    ADD CONSTRAINT cursos_seccion_id_seccion_id_key UNIQUE (id, seccion_id);


--
-- TOC entry 6247 (class 2606 OID 18592)
-- Name: cursos_seccion cursos_seccion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cursos_seccion
    ADD CONSTRAINT cursos_seccion_pkey PRIMARY KEY (id);


--
-- TOC entry 6249 (class 2606 OID 18594)
-- Name: cursos_seccion cursos_seccion_seccion_plan_id_asignatura_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cursos_seccion
    ADD CONSTRAINT cursos_seccion_seccion_plan_id_asignatura_id_key UNIQUE (seccion_plan_id, asignatura_id);


--
-- TOC entry 6373 (class 2606 OID 19564)
-- Name: detalle_liquidacion_docente detalle_liquidacion_docente_hora_docente_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.detalle_liquidacion_docente
    ADD CONSTRAINT detalle_liquidacion_docente_hora_docente_id_key UNIQUE (hora_docente_id);


--
-- TOC entry 6376 (class 2606 OID 19562)
-- Name: detalle_liquidacion_docente detalle_liquidacion_docente_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.detalle_liquidacion_docente
    ADD CONSTRAINT detalle_liquidacion_docente_pkey PRIMARY KEY (id);


--
-- TOC entry 6195 (class 2606 OID 18254)
-- Name: devoluciones devoluciones_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.devoluciones
    ADD CONSTRAINT devoluciones_pkey PRIMARY KEY (id);


--
-- TOC entry 6018 (class 2606 OID 17194)
-- Name: docentes docentes_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.docentes
    ADD CONSTRAINT docentes_codigo_key UNIQUE (codigo);


--
-- TOC entry 6020 (class 2606 OID 17192)
-- Name: docentes docentes_persona_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.docentes
    ADD CONSTRAINT docentes_persona_id_key UNIQUE (persona_id);


--
-- TOC entry 6022 (class 2606 OID 17190)
-- Name: docentes docentes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.docentes
    ADD CONSTRAINT docentes_pkey PRIMARY KEY (id);


--
-- TOC entry 6395 (class 2606 OID 19778)
-- Name: documentos_emitidos documentos_emitidos_archivo_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_archivo_id_key UNIQUE (archivo_id);


--
-- TOC entry 6399 (class 2606 OID 19774)
-- Name: documentos_emitidos documentos_emitidos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_pkey PRIMARY KEY (id);


--
-- TOC entry 6401 (class 2606 OID 19776)
-- Name: documentos_emitidos documentos_emitidos_solicitud_uuid_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_solicitud_uuid_key UNIQUE (solicitud_uuid);


--
-- TOC entry 6120 (class 2606 OID 17756)
-- Name: documentos_expediente documentos_expediente_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_expediente
    ADD CONSTRAINT documentos_expediente_pkey PRIMARY KEY (id);


--
-- TOC entry 6006 (class 2606 OID 17146)
-- Name: documentos_identidad documentos_identidad_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_identidad
    ADD CONSTRAINT documentos_identidad_pkey PRIMARY KEY (id);


--
-- TOC entry 6008 (class 2606 OID 17148)
-- Name: documentos_identidad documentos_identidad_tipo_pais_emisor_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_identidad
    ADD CONSTRAINT documentos_identidad_tipo_pais_emisor_numero_key UNIQUE (tipo, pais_emisor, numero);


--
-- TOC entry 6122 (class 2606 OID 17804)
-- Name: documentos_institucionales documentos_institucionales_anio_id_tipo_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_institucionales
    ADD CONSTRAINT documentos_institucionales_anio_id_tipo_version_key UNIQUE (anio_id, tipo, version);


--
-- TOC entry 6124 (class 2606 OID 17806)
-- Name: documentos_institucionales documentos_institucionales_id_anio_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_institucionales
    ADD CONSTRAINT documentos_institucionales_id_anio_id_key UNIQUE (id, anio_id);


--
-- TOC entry 6126 (class 2606 OID 17802)
-- Name: documentos_institucionales documentos_institucionales_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_institucionales
    ADD CONSTRAINT documentos_institucionales_pkey PRIMARY KEY (id);


--
-- TOC entry 6439 (class 2606 OID 20208)
-- Name: equivalencias_historicas equivalencias_historicas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.equivalencias_historicas
    ADD CONSTRAINT equivalencias_historicas_pkey PRIMARY KEY (sistema, entidad, clave_origen);


--
-- TOC entry 6058 (class 2606 OID 17402)
-- Name: estudiante_apoderado estudiante_apoderado_estudiante_id_persona_id_vigencia_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiante_apoderado
    ADD CONSTRAINT estudiante_apoderado_estudiante_id_persona_id_vigencia_excl EXCLUDE USING gist (estudiante_id WITH =, persona_id WITH =, vigencia WITH &&);


--
-- TOC entry 6061 (class 2606 OID 17400)
-- Name: estudiante_apoderado estudiante_apoderado_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiante_apoderado
    ADD CONSTRAINT estudiante_apoderado_pkey PRIMARY KEY (id);


--
-- TOC entry 6010 (class 2606 OID 17170)
-- Name: estudiantes estudiantes_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiantes
    ADD CONSTRAINT estudiantes_codigo_key UNIQUE (codigo);


--
-- TOC entry 6012 (class 2606 OID 17172)
-- Name: estudiantes estudiantes_codigo_siagie_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiantes
    ADD CONSTRAINT estudiantes_codigo_siagie_key UNIQUE (codigo_siagie);


--
-- TOC entry 6014 (class 2606 OID 17168)
-- Name: estudiantes estudiantes_persona_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiantes
    ADD CONSTRAINT estudiantes_persona_id_key UNIQUE (persona_id);


--
-- TOC entry 6016 (class 2606 OID 17166)
-- Name: estudiantes estudiantes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiantes
    ADD CONSTRAINT estudiantes_pkey PRIMARY KEY (id);


--
-- TOC entry 6421 (class 2606 OID 20010)
-- Name: evaluaciones_recuperacion evaluaciones_recuperacion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.evaluaciones_recuperacion
    ADD CONSTRAINT evaluaciones_recuperacion_pkey PRIMARY KEY (id);


--
-- TOC entry 6423 (class 2606 OID 20012)
-- Name: evaluaciones_recuperacion evaluaciones_recuperacion_resultado_origen_id_intento_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.evaluaciones_recuperacion
    ADD CONSTRAINT evaluaciones_recuperacion_resultado_origen_id_intento_key UNIQUE (resultado_origen_id, intento);


--
-- TOC entry 6306 (class 2606 OID 18966)
-- Name: exportaciones_siagie exportaciones_siagie_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_pkey PRIMARY KEY (id);


--
-- TOC entry 6437 (class 2606 OID 20190)
-- Name: filas_importacion filas_importacion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.filas_importacion
    ADD CONSTRAINT filas_importacion_pkey PRIMARY KEY (lote_id, entidad, clave_origen);


--
-- TOC entry 6081 (class 2606 OID 17506)
-- Name: grados grados_nivel_id_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.grados
    ADD CONSTRAINT grados_nivel_id_numero_key UNIQUE (nivel_id, numero);


--
-- TOC entry 6083 (class 2606 OID 17504)
-- Name: grados grados_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.grados
    ADD CONSTRAINT grados_pkey PRIMARY KEY (id);


--
-- TOC entry 6361 (class 2606 OID 19437)
-- Name: horas_docentes horas_docentes_contrato_id_tramo_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.horas_docentes
    ADD CONSTRAINT horas_docentes_contrato_id_tramo_excl EXCLUDE USING gist (contrato_id WITH =, tramo WITH &&) WHERE ((estado <> 'rechazada'::text));


--
-- TOC entry 6363 (class 2606 OID 19435)
-- Name: horas_docentes horas_docentes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.horas_docentes
    ADD CONSTRAINT horas_docentes_pkey PRIMARY KEY (id);


--
-- TOC entry 6318 (class 2606 OID 19081)
-- Name: jornadas_docente jornadas_docente_docente_id_horario_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_docente
    ADD CONSTRAINT jornadas_docente_docente_id_horario_excl EXCLUDE USING gist (docente_id WITH =, horario WITH &&) WHERE ((estado = 'programada'::text));


--
-- TOC entry 6320 (class 2606 OID 19079)
-- Name: jornadas_docente jornadas_docente_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_docente
    ADD CONSTRAINT jornadas_docente_pkey PRIMARY KEY (id);


--
-- TOC entry 6314 (class 2606 OID 19046)
-- Name: jornadas_seccion jornadas_seccion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_seccion
    ADD CONSTRAINT jornadas_seccion_pkey PRIMARY KEY (id);


--
-- TOC entry 6316 (class 2606 OID 19048)
-- Name: jornadas_seccion jornadas_seccion_seccion_id_fecha_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_seccion
    ADD CONSTRAINT jornadas_seccion_seccion_id_fecha_key UNIQUE (seccion_id, fecha);


--
-- TOC entry 6352 (class 2606 OID 19321)
-- Name: justificaciones_asistencia justificaciones_asistencia_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.justificaciones_asistencia
    ADD CONSTRAINT justificaciones_asistencia_pkey PRIMARY KEY (id);


--
-- TOC entry 6322 (class 2606 OID 19114)
-- Name: lectores_qr lectores_qr_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.lectores_qr
    ADD CONSTRAINT lectores_qr_codigo_key UNIQUE (codigo);


--
-- TOC entry 6324 (class 2606 OID 19112)
-- Name: lectores_qr lectores_qr_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.lectores_qr
    ADD CONSTRAINT lectores_qr_pkey PRIMARY KEY (id);


--
-- TOC entry 6369 (class 2606 OID 19524)
-- Name: liquidaciones_docentes liquidaciones_docentes_contrato_id_periodo_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.liquidaciones_docentes
    ADD CONSTRAINT liquidaciones_docentes_contrato_id_periodo_id_key UNIQUE (contrato_id, periodo_id);


--
-- TOC entry 6371 (class 2606 OID 19522)
-- Name: liquidaciones_docentes liquidaciones_docentes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.liquidaciones_docentes
    ADD CONSTRAINT liquidaciones_docentes_pkey PRIMARY KEY (id);


--
-- TOC entry 6433 (class 2606 OID 20169)
-- Name: lotes_importacion lotes_importacion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.lotes_importacion
    ADD CONSTRAINT lotes_importacion_pkey PRIMARY KEY (id);


--
-- TOC entry 6435 (class 2606 OID 20171)
-- Name: lotes_importacion lotes_importacion_sistema_sha256_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.lotes_importacion
    ADD CONSTRAINT lotes_importacion_sistema_sha256_key UNIQUE (sistema, sha256);


--
-- TOC entry 6298 (class 2606 OID 18930)
-- Name: mapeos_siagie mapeos_siagie_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.mapeos_siagie
    ADD CONSTRAINT mapeos_siagie_pkey PRIMARY KEY (id);


--
-- TOC entry 6300 (class 2606 OID 18932)
-- Name: mapeos_siagie mapeos_siagie_plantilla_id_competencia_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.mapeos_siagie
    ADD CONSTRAINT mapeos_siagie_plantilla_id_competencia_id_key UNIQUE (plantilla_id, competencia_id);


--
-- TOC entry 6302 (class 2606 OID 18934)
-- Name: mapeos_siagie mapeos_siagie_plantilla_id_hoja_codigo_excel_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.mapeos_siagie
    ADD CONSTRAINT mapeos_siagie_plantilla_id_hoja_codigo_excel_key UNIQUE (plantilla_id, hoja, codigo_excel);


--
-- TOC entry 6304 (class 2606 OID 18936)
-- Name: mapeos_siagie mapeos_siagie_plantilla_id_hoja_columna_nl_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.mapeos_siagie
    ADD CONSTRAINT mapeos_siagie_plantilla_id_hoja_columna_nl_key UNIQUE (plantilla_id, hoja, columna_nl);


--
-- TOC entry 6333 (class 2606 OID 19175)
-- Name: marcaciones marcaciones_evento_uuid_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.marcaciones
    ADD CONSTRAINT marcaciones_evento_uuid_key UNIQUE (evento_uuid);


--
-- TOC entry 6336 (class 2606 OID 19173)
-- Name: marcaciones marcaciones_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.marcaciones
    ADD CONSTRAINT marcaciones_pkey PRIMARY KEY (id);


--
-- TOC entry 6106 (class 2606 OID 17655)
-- Name: matricula_secciones matricula_secciones_matricula_id_vigencia_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matricula_secciones
    ADD CONSTRAINT matricula_secciones_matricula_id_vigencia_excl EXCLUDE USING gist (matricula_id WITH =, vigencia WITH &&);


--
-- TOC entry 6109 (class 2606 OID 17653)
-- Name: matricula_secciones matricula_secciones_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matricula_secciones
    ADD CONSTRAINT matricula_secciones_pkey PRIMARY KEY (id);


--
-- TOC entry 6098 (class 2606 OID 17605)
-- Name: matriculas matriculas_estudiante_id_anio_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_estudiante_id_anio_id_key UNIQUE (estudiante_id, anio_id);


--
-- TOC entry 6100 (class 2606 OID 17607)
-- Name: matriculas matriculas_id_anio_id_grado_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_id_anio_id_grado_id_key UNIQUE (id, anio_id, grado_id);


--
-- TOC entry 6102 (class 2606 OID 17609)
-- Name: matriculas matriculas_id_estudiante_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_id_estudiante_id_key UNIQUE (id, estudiante_id);


--
-- TOC entry 6104 (class 2606 OID 17603)
-- Name: matriculas matriculas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_pkey PRIMARY KEY (id);


--
-- TOC entry 6111 (class 2606 OID 17687)
-- Name: movimientos_matricula movimientos_matricula_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.movimientos_matricula
    ADD CONSTRAINT movimientos_matricula_pkey PRIMARY KEY (id);


--
-- TOC entry 6077 (class 2606 OID 17494)
-- Name: niveles niveles_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.niveles
    ADD CONSTRAINT niveles_codigo_key UNIQUE (codigo);


--
-- TOC entry 6079 (class 2606 OID 17492)
-- Name: niveles niveles_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.niveles
    ADD CONSTRAINT niveles_pkey PRIMARY KEY (id);


--
-- TOC entry 6154 (class 2606 OID 18010)
-- Name: obligaciones_ingreso obligaciones_ingreso_estudiante_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.obligaciones_ingreso
    ADD CONSTRAINT obligaciones_ingreso_estudiante_id_key UNIQUE (estudiante_id);


--
-- TOC entry 6156 (class 2606 OID 18012)
-- Name: obligaciones_ingreso obligaciones_ingreso_id_estudiante_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.obligaciones_ingreso
    ADD CONSTRAINT obligaciones_ingreso_id_estudiante_id_key UNIQUE (id, estudiante_id);


--
-- TOC entry 6158 (class 2606 OID 18008)
-- Name: obligaciones_ingreso obligaciones_ingreso_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.obligaciones_ingreso
    ADD CONSTRAINT obligaciones_ingreso_pkey PRIMARY KEY (id);


--
-- TOC entry 6429 (class 2606 OID 20122)
-- Name: orden_merito orden_merito_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.orden_merito
    ADD CONSTRAINT orden_merito_pkey PRIMARY KEY (publicacion_id, matricula_id);


--
-- TOC entry 6431 (class 2606 OID 20124)
-- Name: orden_merito orden_merito_publicacion_id_puesto_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.orden_merito
    ADD CONSTRAINT orden_merito_publicacion_id_puesto_key UNIQUE (publicacion_id, puesto);


--
-- TOC entry 6179 (class 2606 OID 18167)
-- Name: pagos pagos_clave_idempotencia_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos
    ADD CONSTRAINT pagos_clave_idempotencia_key UNIQUE (clave_idempotencia);


--
-- TOC entry 6378 (class 2606 OID 19599)
-- Name: pagos_docentes pagos_docentes_clave_idempotencia_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos_docentes
    ADD CONSTRAINT pagos_docentes_clave_idempotencia_key UNIQUE (clave_idempotencia);


--
-- TOC entry 6381 (class 2606 OID 19597)
-- Name: pagos_docentes pagos_docentes_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos_docentes
    ADD CONSTRAINT pagos_docentes_pkey PRIMARY KEY (id);


--
-- TOC entry 6181 (class 2606 OID 18165)
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- TOC entry 6365 (class 2606 OID 19484)
-- Name: periodos_liquidacion periodos_liquidacion_mes_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.periodos_liquidacion
    ADD CONSTRAINT periodos_liquidacion_mes_key UNIQUE (mes);


--
-- TOC entry 6367 (class 2606 OID 19482)
-- Name: periodos_liquidacion periodos_liquidacion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.periodos_liquidacion
    ADD CONSTRAINT periodos_liquidacion_pkey PRIMARY KEY (id);


--
-- TOC entry 6034 (class 2606 OID 17251)
-- Name: permisos permisos_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.permisos
    ADD CONSTRAINT permisos_codigo_key UNIQUE (codigo);


--
-- TOC entry 6036 (class 2606 OID 17249)
-- Name: permisos permisos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.permisos
    ADD CONSTRAINT permisos_pkey PRIMARY KEY (id);


--
-- TOC entry 6003 (class 2606 OID 17130)
-- Name: personas personas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.personas
    ADD CONSTRAINT personas_pkey PRIMARY KEY (id);


--
-- TOC entry 6233 (class 2606 OID 18503)
-- Name: plan_asignaturas plan_asignaturas_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plan_asignaturas
    ADD CONSTRAINT plan_asignaturas_pkey PRIMARY KEY (plan_id, asignatura_id);


--
-- TOC entry 6235 (class 2606 OID 18520)
-- Name: plan_competencias plan_competencias_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plan_competencias
    ADD CONSTRAINT plan_competencias_pkey PRIMARY KEY (plan_id, competencia_id);


--
-- TOC entry 6136 (class 2606 OID 17913)
-- Name: planes_cobro planes_cobro_anio_id_grado_id_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_cobro
    ADD CONSTRAINT planes_cobro_anio_id_grado_id_version_key UNIQUE (anio_id, grado_id, version);


--
-- TOC entry 6138 (class 2606 OID 17915)
-- Name: planes_cobro planes_cobro_id_anio_id_grado_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_cobro
    ADD CONSTRAINT planes_cobro_id_anio_id_grado_id_key UNIQUE (id, anio_id, grado_id);


--
-- TOC entry 6140 (class 2606 OID 17911)
-- Name: planes_cobro planes_cobro_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_cobro
    ADD CONSTRAINT planes_cobro_pkey PRIMARY KEY (id);


--
-- TOC entry 6227 (class 2606 OID 18484)
-- Name: planes_estudio planes_estudio_anio_id_grado_id_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_estudio
    ADD CONSTRAINT planes_estudio_anio_id_grado_id_version_key UNIQUE (anio_id, grado_id, version);


--
-- TOC entry 6229 (class 2606 OID 18486)
-- Name: planes_estudio planes_estudio_id_anio_id_grado_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_estudio
    ADD CONSTRAINT planes_estudio_id_anio_id_grado_id_key UNIQUE (id, anio_id, grado_id);


--
-- TOC entry 6231 (class 2606 OID 18482)
-- Name: planes_estudio planes_estudio_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_estudio
    ADD CONSTRAINT planes_estudio_pkey PRIMARY KEY (id);


--
-- TOC entry 6389 (class 2606 OID 19726)
-- Name: plantillas_documento plantillas_documento_id_tipo_anio_id_formato_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_documento
    ADD CONSTRAINT plantillas_documento_id_tipo_anio_id_formato_key UNIQUE (id, tipo, anio_id, formato);


--
-- TOC entry 6391 (class 2606 OID 19722)
-- Name: plantillas_documento plantillas_documento_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_documento
    ADD CONSTRAINT plantillas_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 6393 (class 2606 OID 19724)
-- Name: plantillas_documento plantillas_documento_tipo_anio_id_formato_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_documento
    ADD CONSTRAINT plantillas_documento_tipo_anio_id_formato_version_key UNIQUE (tipo, anio_id, formato, version);


--
-- TOC entry 6292 (class 2606 OID 18896)
-- Name: plantillas_siagie plantillas_siagie_id_seccion_id_bimestre_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_siagie
    ADD CONSTRAINT plantillas_siagie_id_seccion_id_bimestre_id_key UNIQUE (id, seccion_id, bimestre_id);


--
-- TOC entry 6294 (class 2606 OID 18892)
-- Name: plantillas_siagie plantillas_siagie_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_siagie
    ADD CONSTRAINT plantillas_siagie_pkey PRIMARY KEY (id);


--
-- TOC entry 6296 (class 2606 OID 18894)
-- Name: plantillas_siagie plantillas_siagie_seccion_id_bimestre_id_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_siagie
    ADD CONSTRAINT plantillas_siagie_seccion_id_bimestre_id_version_key UNIQUE (seccion_id, bimestre_id, version);


--
-- TOC entry 6308 (class 2606 OID 19020)
-- Name: politicas_asistencia politicas_asistencia_anio_id_alcance_turno_vigencia_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.politicas_asistencia
    ADD CONSTRAINT politicas_asistencia_anio_id_alcance_turno_vigencia_excl EXCLUDE USING gist (anio_id WITH =, alcance WITH =, turno WITH =, vigencia WITH &&);


--
-- TOC entry 6310 (class 2606 OID 19018)
-- Name: politicas_asistencia politicas_asistencia_id_anio_id_alcance_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.politicas_asistencia
    ADD CONSTRAINT politicas_asistencia_id_anio_id_alcance_key UNIQUE (id, anio_id, alcance);


--
-- TOC entry 6312 (class 2606 OID 19016)
-- Name: politicas_asistencia politicas_asistencia_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.politicas_asistencia
    ADD CONSTRAINT politicas_asistencia_pkey PRIMARY KEY (id);


--
-- TOC entry 6425 (class 2606 OID 20078)
-- Name: publicaciones_merito publicaciones_merito_anio_id_grado_id_alcance_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_anio_id_grado_id_alcance_version_key UNIQUE (anio_id, grado_id, alcance, version);


--
-- TOC entry 6427 (class 2606 OID 20076)
-- Name: publicaciones_merito publicaciones_merito_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_pkey PRIMARY KEY (id);


--
-- TOC entry 6201 (class 2606 OID 18314)
-- Name: recibos_caja recibos_caja_pago_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.recibos_caja
    ADD CONSTRAINT recibos_caja_pago_id_key UNIQUE (pago_id);


--
-- TOC entry 6203 (class 2606 OID 18312)
-- Name: recibos_caja recibos_caja_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.recibos_caja
    ADD CONSTRAINT recibos_caja_pkey PRIMARY KEY (id);


--
-- TOC entry 6205 (class 2606 OID 18316)
-- Name: recibos_caja recibos_caja_serie_id_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.recibos_caja
    ADD CONSTRAINT recibos_caja_serie_id_numero_key UNIQUE (serie_id, numero);


--
-- TOC entry 6403 (class 2606 OID 19847)
-- Name: reglas_evaluacion reglas_evaluacion_anio_id_grado_id_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_evaluacion
    ADD CONSTRAINT reglas_evaluacion_anio_id_grado_id_version_key UNIQUE (anio_id, grado_id, version);


--
-- TOC entry 6405 (class 2606 OID 19849)
-- Name: reglas_evaluacion reglas_evaluacion_id_anio_id_grado_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_evaluacion
    ADD CONSTRAINT reglas_evaluacion_id_anio_id_grado_id_key UNIQUE (id, anio_id, grado_id);


--
-- TOC entry 6407 (class 2606 OID 19845)
-- Name: reglas_evaluacion reglas_evaluacion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_evaluacion
    ADD CONSTRAINT reglas_evaluacion_pkey PRIMARY KEY (id);


--
-- TOC entry 6091 (class 2606 OID 17569)
-- Name: reglas_matricula reglas_matricula_anio_id_grado_id_tipo_ingreso_version_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_matricula
    ADD CONSTRAINT reglas_matricula_anio_id_grado_id_tipo_ingreso_version_key UNIQUE (anio_id, grado_id, tipo_ingreso, version);


--
-- TOC entry 6093 (class 2606 OID 17571)
-- Name: reglas_matricula reglas_matricula_id_anio_id_grado_id_tipo_ingreso_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_matricula
    ADD CONSTRAINT reglas_matricula_id_anio_id_grado_id_tipo_ingreso_key UNIQUE (id, anio_id, grado_id, tipo_ingreso);


--
-- TOC entry 6095 (class 2606 OID 17567)
-- Name: reglas_matricula reglas_matricula_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_matricula
    ADD CONSTRAINT reglas_matricula_pkey PRIMARY KEY (id);


--
-- TOC entry 6117 (class 2606 OID 17727)
-- Name: requisitos_matricula requisitos_matricula_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.requisitos_matricula
    ADD CONSTRAINT requisitos_matricula_pkey PRIMARY KEY (regla_id, tipo_documento_id);


--
-- TOC entry 6150 (class 2606 OID 17986)
-- Name: responsables_economicos responsables_economicos_matricula_id_vigencia_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.responsables_economicos
    ADD CONSTRAINT responsables_economicos_matricula_id_vigencia_excl EXCLUDE USING gist (matricula_id WITH =, vigencia WITH &&);


--
-- TOC entry 6152 (class 2606 OID 17984)
-- Name: responsables_economicos responsables_economicos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.responsables_economicos
    ADD CONSTRAINT responsables_economicos_pkey PRIMARY KEY (id);


--
-- TOC entry 6417 (class 2606 OID 19966)
-- Name: resultados_anuales_competencia resultados_anuales_competenci_cierre_anual_id_competencia_i_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.resultados_anuales_competencia
    ADD CONSTRAINT resultados_anuales_competenci_cierre_anual_id_competencia_i_key UNIQUE (cierre_anual_id, competencia_id);


--
-- TOC entry 6419 (class 2606 OID 19964)
-- Name: resultados_anuales_competencia resultados_anuales_competencia_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.resultados_anuales_competencia
    ADD CONSTRAINT resultados_anuales_competencia_pkey PRIMARY KEY (id);


--
-- TOC entry 6383 (class 2606 OID 19631)
-- Name: reversiones_pago_docente reversiones_pago_docente_pago_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago_docente
    ADD CONSTRAINT reversiones_pago_docente_pago_id_key UNIQUE (pago_id);


--
-- TOC entry 6385 (class 2606 OID 19629)
-- Name: reversiones_pago_docente reversiones_pago_docente_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago_docente
    ADD CONSTRAINT reversiones_pago_docente_pkey PRIMARY KEY (id);


--
-- TOC entry 6190 (class 2606 OID 18227)
-- Name: reversiones_pago reversiones_pago_pago_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago
    ADD CONSTRAINT reversiones_pago_pago_id_key UNIQUE (pago_id);


--
-- TOC entry 6192 (class 2606 OID 18225)
-- Name: reversiones_pago reversiones_pago_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago
    ADD CONSTRAINT reversiones_pago_pkey PRIMARY KEY (id);


--
-- TOC entry 6290 (class 2606 OID 18859)
-- Name: revisiones_calificacion revisiones_calificacion_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.revisiones_calificacion
    ADD CONSTRAINT revisiones_calificacion_pkey PRIMARY KEY (id);


--
-- TOC entry 6040 (class 2606 OID 17275)
-- Name: rol_permisos rol_permisos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.rol_permisos
    ADD CONSTRAINT rol_permisos_pkey PRIMARY KEY (rol_id, permiso_id);


--
-- TOC entry 6030 (class 2606 OID 17238)
-- Name: roles roles_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.roles
    ADD CONSTRAINT roles_codigo_key UNIQUE (codigo);


--
-- TOC entry 6032 (class 2606 OID 17236)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 6239 (class 2606 OID 18565)
-- Name: seccion_planes_estudio seccion_planes_estudio_id_plan_id_seccion_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.seccion_planes_estudio
    ADD CONSTRAINT seccion_planes_estudio_id_plan_id_seccion_id_key UNIQUE (id, plan_id, seccion_id);


--
-- TOC entry 6241 (class 2606 OID 18563)
-- Name: seccion_planes_estudio seccion_planes_estudio_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.seccion_planes_estudio
    ADD CONSTRAINT seccion_planes_estudio_pkey PRIMARY KEY (id);


--
-- TOC entry 6243 (class 2606 OID 18567)
-- Name: seccion_planes_estudio seccion_planes_estudio_seccion_id_vigencia_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.seccion_planes_estudio
    ADD CONSTRAINT seccion_planes_estudio_seccion_id_vigencia_excl EXCLUDE USING gist (seccion_id WITH =, vigencia WITH &&);


--
-- TOC entry 6085 (class 2606 OID 17534)
-- Name: secciones secciones_anio_id_grado_id_nombre_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.secciones
    ADD CONSTRAINT secciones_anio_id_grado_id_nombre_key UNIQUE (anio_id, grado_id, nombre);


--
-- TOC entry 6087 (class 2606 OID 17536)
-- Name: secciones secciones_id_anio_id_grado_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.secciones
    ADD CONSTRAINT secciones_id_anio_id_grado_id_key UNIQUE (id, anio_id, grado_id);


--
-- TOC entry 6089 (class 2606 OID 17532)
-- Name: secciones secciones_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.secciones
    ADD CONSTRAINT secciones_pkey PRIMARY KEY (id);


--
-- TOC entry 6197 (class 2606 OID 18298)
-- Name: series_recibos series_recibos_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.series_recibos
    ADD CONSTRAINT series_recibos_codigo_key UNIQUE (codigo);


--
-- TOC entry 6199 (class 2606 OID 18296)
-- Name: series_recibos series_recibos_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.series_recibos
    ADD CONSTRAINT series_recibos_pkey PRIMARY KEY (id);


--
-- TOC entry 6176 (class 2606 OID 18135)
-- Name: sesiones_caja sesiones_caja_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_caja
    ADD CONSTRAINT sesiones_caja_pkey PRIMARY KEY (id);


--
-- TOC entry 6271 (class 2606 OID 18722)
-- Name: sesiones_clase sesiones_clase_aula_id_franja_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_aula_id_franja_excl EXCLUDE USING gist (aula_id WITH =, franja WITH &&) WHERE ((estado <> 'cancelada'::text));


--
-- TOC entry 6273 (class 2606 OID 18720)
-- Name: sesiones_clase sesiones_clase_docente_id_franja_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_docente_id_franja_excl EXCLUDE USING gist (docente_id WITH =, franja WITH &&) WHERE ((estado <> 'cancelada'::text));


--
-- TOC entry 6275 (class 2606 OID 18716)
-- Name: sesiones_clase sesiones_clase_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_pkey PRIMARY KEY (id);


--
-- TOC entry 6277 (class 2606 OID 18718)
-- Name: sesiones_clase sesiones_clase_seccion_id_franja_excl; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_seccion_id_franja_excl EXCLUDE USING gist (seccion_id WITH =, franja WITH &&) WHERE ((estado <> 'cancelada'::text));


--
-- TOC entry 6047 (class 2606 OID 17330)
-- Name: sesiones sesiones_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones
    ADD CONSTRAINT sesiones_pkey PRIMARY KEY (id);


--
-- TOC entry 6049 (class 2606 OID 17332)
-- Name: sesiones sesiones_token_hash_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones
    ADD CONSTRAINT sesiones_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 6113 (class 2606 OID 17715)
-- Name: tipos_documento tipos_documento_codigo_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tipos_documento
    ADD CONSTRAINT tipos_documento_codigo_key UNIQUE (codigo);


--
-- TOC entry 6115 (class 2606 OID 17713)
-- Name: tipos_documento tipos_documento_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tipos_documento
    ADD CONSTRAINT tipos_documento_pkey PRIMARY KEY (id);


--
-- TOC entry 6387 (class 2606 OID 19693)
-- Name: tipos_reporte tipos_reporte_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tipos_reporte
    ADD CONSTRAINT tipos_reporte_pkey PRIMARY KEY (codigo);


--
-- TOC entry 6042 (class 2606 OID 17303)
-- Name: tokens_acceso tokens_acceso_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tokens_acceso
    ADD CONSTRAINT tokens_acceso_pkey PRIMARY KEY (id);


--
-- TOC entry 6044 (class 2606 OID 17305)
-- Name: tokens_acceso tokens_acceso_token_hash_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tokens_acceso
    ADD CONSTRAINT tokens_acceso_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 6142 (class 2606 OID 17959)
-- Name: tramos_plan_cobro tramos_plan_cobro_id_anio_id_grado_id_concepto_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tramos_plan_cobro
    ADD CONSTRAINT tramos_plan_cobro_id_anio_id_grado_id_concepto_key UNIQUE (id, anio_id, grado_id, concepto);


--
-- TOC entry 6144 (class 2606 OID 17953)
-- Name: tramos_plan_cobro tramos_plan_cobro_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tramos_plan_cobro
    ADD CONSTRAINT tramos_plan_cobro_pkey PRIMARY KEY (id);


--
-- TOC entry 6146 (class 2606 OID 17955)
-- Name: tramos_plan_cobro tramos_plan_cobro_plan_id_concepto_numero_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tramos_plan_cobro
    ADD CONSTRAINT tramos_plan_cobro_plan_id_concepto_numero_key UNIQUE (plan_id, concepto, numero);


--
-- TOC entry 6148 (class 2606 OID 17957)
-- Name: tramos_plan_cobro tramos_plan_cobro_plan_id_mes_servicio_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tramos_plan_cobro
    ADD CONSTRAINT tramos_plan_cobro_plan_id_mes_servicio_key UNIQUE (plan_id, mes_servicio);


--
-- TOC entry 6038 (class 2606 OID 17258)
-- Name: usuario_roles usuario_roles_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.usuario_roles
    ADD CONSTRAINT usuario_roles_pkey PRIMARY KEY (usuario_id, rol_id);


--
-- TOC entry 6024 (class 2606 OID 17220)
-- Name: usuarios usuarios_login_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.usuarios
    ADD CONSTRAINT usuarios_login_key UNIQUE (login);


--
-- TOC entry 6026 (class 2606 OID 17218)
-- Name: usuarios usuarios_persona_id_key; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.usuarios
    ADD CONSTRAINT usuarios_persona_id_key UNIQUE (persona_id);


--
-- TOC entry 6028 (class 2606 OID 17216)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 6168 (class 1259 OID 18370)
-- Name: ajustes_cuota_cuota_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX ajustes_cuota_cuota_idx ON excelencia_seruna.ajustes_cuota USING btree (cuota_id);


--
-- TOC entry 6182 (class 1259 OID 18369)
-- Name: aplicaciones_pago_cuota_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX aplicaciones_pago_cuota_idx ON excelencia_seruna.aplicaciones_pago USING btree (cuota_id);


--
-- TOC entry 6343 (class 1259 OID 19301)
-- Name: asistencia_docente_entrada_unica; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX asistencia_docente_entrada_unica ON excelencia_seruna.asistencia_docentes USING btree (entrada_id) WHERE (entrada_id IS NOT NULL);


--
-- TOC entry 6344 (class 1259 OID 19302)
-- Name: asistencia_docente_salida_unica; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX asistencia_docente_salida_unica ON excelencia_seruna.asistencia_docentes USING btree (salida_id) WHERE (salida_id IS NOT NULL);


--
-- TOC entry 6337 (class 1259 OID 19257)
-- Name: asistencia_estudiante_diaria_unica; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX asistencia_estudiante_diaria_unica ON excelencia_seruna.asistencia_estudiantes USING btree (matricula_id, jornada_id) WHERE (sesion_id IS NULL);


--
-- TOC entry 6338 (class 1259 OID 19259)
-- Name: asistencia_estudiante_entrada_unica; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX asistencia_estudiante_entrada_unica ON excelencia_seruna.asistencia_estudiantes USING btree (entrada_id) WHERE (entrada_id IS NOT NULL);


--
-- TOC entry 6339 (class 1259 OID 19260)
-- Name: asistencia_estudiante_salida_unica; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX asistencia_estudiante_salida_unica ON excelencia_seruna.asistencia_estudiantes USING btree (salida_id) WHERE (salida_id IS NOT NULL);


--
-- TOC entry 6340 (class 1259 OID 19258)
-- Name: asistencia_estudiante_sesion_unica; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX asistencia_estudiante_sesion_unica ON excelencia_seruna.asistencia_estudiantes USING btree (matricula_id, sesion_id) WHERE (sesion_id IS NOT NULL);


--
-- TOC entry 6284 (class 1259 OID 18870)
-- Name: calificaciones_cierre_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX calificaciones_cierre_idx ON excelencia_seruna.calificaciones_competencia USING btree (cierre_id);


--
-- TOC entry 6327 (class 1259 OID 19197)
-- Name: credenciales_qr_persona_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX credenciales_qr_persona_idx ON excelencia_seruna.credenciales_qr USING btree (persona_id);


--
-- TOC entry 6167 (class 1259 OID 18368)
-- Name: cuotas_vencimiento_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX cuotas_vencimiento_idx ON excelencia_seruna.cuotas USING btree (vence_en, matricula_id);


--
-- TOC entry 6374 (class 1259 OID 19648)
-- Name: detalle_liquidacion_docente_liq_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX detalle_liquidacion_docente_liq_idx ON excelencia_seruna.detalle_liquidacion_docente USING btree (liquidacion_id);


--
-- TOC entry 6193 (class 1259 OID 18371)
-- Name: devoluciones_aplicacion_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX devoluciones_aplicacion_idx ON excelencia_seruna.devoluciones USING btree (aplicacion_id);


--
-- TOC entry 6396 (class 1259 OID 19805)
-- Name: documentos_emitidos_cola_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX documentos_emitidos_cola_idx ON excelencia_seruna.documentos_emitidos USING btree (id) WHERE (estado = 'preparado'::text);


--
-- TOC entry 6397 (class 1259 OID 19804)
-- Name: documentos_emitidos_consulta_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX documentos_emitidos_consulta_idx ON excelencia_seruna.documentos_emitidos USING btree (anio_id, tipo, solicitado_en DESC);


--
-- TOC entry 6118 (class 1259 OID 18367)
-- Name: documentos_expediente_estudiante_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX documentos_expediente_estudiante_idx ON excelencia_seruna.documentos_expediente USING btree (estudiante_id);


--
-- TOC entry 6004 (class 1259 OID 18361)
-- Name: documentos_identidad_persona_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX documentos_identidad_persona_idx ON excelencia_seruna.documentos_identidad USING btree (persona_id);


--
-- TOC entry 6059 (class 1259 OID 18362)
-- Name: estudiante_apoderado_persona_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX estudiante_apoderado_persona_idx ON excelencia_seruna.estudiante_apoderado USING btree (persona_id);


--
-- TOC entry 6359 (class 1259 OID 19647)
-- Name: horas_docentes_contrato_fecha_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX horas_docentes_contrato_fecha_idx ON excelencia_seruna.horas_docentes USING btree (contrato_id, fecha);


--
-- TOC entry 6349 (class 1259 OID 19348)
-- Name: justificacion_docente_vigente; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX justificacion_docente_vigente ON excelencia_seruna.justificaciones_asistencia USING btree (asistencia_docente_id) WHERE (estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text]));


--
-- TOC entry 6350 (class 1259 OID 19347)
-- Name: justificacion_estudiante_vigente; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX justificacion_estudiante_vigente ON excelencia_seruna.justificaciones_asistencia USING btree (asistencia_estudiante_id) WHERE (estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text]));


--
-- TOC entry 6334 (class 1259 OID 19196)
-- Name: marcaciones_persona_instante_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX marcaciones_persona_instante_idx ON excelencia_seruna.marcaciones USING btree (persona_id, instante);


--
-- TOC entry 6107 (class 1259 OID 18366)
-- Name: matricula_secciones_ocupacion_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX matricula_secciones_ocupacion_idx ON excelencia_seruna.matricula_secciones USING gist (seccion_id, vigencia);


--
-- TOC entry 6096 (class 1259 OID 18365)
-- Name: matriculas_anio_grado_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX matriculas_anio_grado_idx ON excelencia_seruna.matriculas USING btree (anio_id, grado_id, estado);


--
-- TOC entry 6379 (class 1259 OID 19649)
-- Name: pagos_docentes_liq_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX pagos_docentes_liq_idx ON excelencia_seruna.pagos_docentes USING btree (liquidacion_id);


--
-- TOC entry 6177 (class 1259 OID 18146)
-- Name: sesiones_caja_una_abierta; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE UNIQUE INDEX sesiones_caja_una_abierta ON excelencia_seruna.sesiones_caja USING btree (caja_id) WHERE (cerrada_en IS NULL);


--
-- TOC entry 6050 (class 1259 OID 18364)
-- Name: sesiones_usuario_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX sesiones_usuario_idx ON excelencia_seruna.sesiones USING btree (usuario_id);


--
-- TOC entry 6045 (class 1259 OID 18363)
-- Name: tokens_acceso_usuario_idx; Type: INDEX; Schema: excelencia_seruna; Owner: postgres
--

CREATE INDEX tokens_acceso_usuario_idx ON excelencia_seruna.tokens_acceso USING btree (usuario_id);


--
-- TOC entry 6695 (class 2620 OID 19360)
-- Name: justificaciones_asistencia aplicar_justificacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER aplicar_justificacion AFTER INSERT OR UPDATE ON excelencia_seruna.justificaciones_asistencia FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.aplicar_justificacion();


--
-- TOC entry 6692 (class 2620 OID 19354)
-- Name: asistencia_docentes auditar_asistencia_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_asistencia_docente AFTER INSERT OR UPDATE ON excelencia_seruna.asistencia_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.auditar_asistencia();


--
-- TOC entry 6689 (class 2620 OID 19353)
-- Name: asistencia_estudiantes auditar_asistencia_estudiante; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_asistencia_estudiante AFTER INSERT OR UPDATE ON excelencia_seruna.asistencia_estudiantes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.auditar_asistencia();


--
-- TOC entry 6683 (class 2620 OID 18874)
-- Name: calificaciones_competencia auditar_calificacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_calificacion AFTER UPDATE ON excelencia_seruna.calificaciones_competencia FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.registrar_revision_calificacion();


--
-- TOC entry 6718 (class 2620 OID 20145)
-- Name: cierres_anuales auditar_cierre_anual; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_cierre_anual AFTER UPDATE ON excelencia_seruna.cierres_anuales FOR EACH ROW WHEN ((old.estado <> new.estado)) EXECUTE FUNCTION excelencia_seruna.auditar_cierre_academico();


--
-- TOC entry 6715 (class 2620 OID 19825)
-- Name: documentos_emitidos auditar_documento_reporte; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_documento_reporte AFTER INSERT OR UPDATE ON excelencia_seruna.documentos_emitidos FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.auditar_documento_reporte();


--
-- TOC entry 6699 (class 2620 OID 19680)
-- Name: horas_docentes auditar_horas_docentes; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_horas_docentes AFTER UPDATE ON excelencia_seruna.horas_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.auditar_planilla();


--
-- TOC entry 6704 (class 2620 OID 19681)
-- Name: liquidaciones_docentes auditar_liquidacion_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_liquidacion_docente AFTER UPDATE ON excelencia_seruna.liquidaciones_docentes FOR EACH ROW WHEN ((old.estado IS DISTINCT FROM new.estado)) EXECUTE FUNCTION excelencia_seruna.auditar_planilla();


--
-- TOC entry 6723 (class 2620 OID 20147)
-- Name: publicaciones_merito auditar_merito; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_merito AFTER UPDATE ON excelencia_seruna.publicaciones_merito FOR EACH ROW WHEN ((old.publicado_en IS DISTINCT FROM new.publicado_en)) EXECUTE FUNCTION excelencia_seruna.auditar_cierre_academico();


--
-- TOC entry 6708 (class 2620 OID 19682)
-- Name: pagos_docentes auditar_pago_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_pago_docente AFTER INSERT ON excelencia_seruna.pagos_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.auditar_planilla();


--
-- TOC entry 6721 (class 2620 OID 20146)
-- Name: evaluaciones_recuperacion auditar_recuperacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_recuperacion AFTER UPDATE ON excelencia_seruna.evaluaciones_recuperacion FOR EACH ROW WHEN ((old.estado <> new.estado)) EXECUTE FUNCTION excelencia_seruna.auditar_cierre_academico();


--
-- TOC entry 6711 (class 2620 OID 19683)
-- Name: reversiones_pago_docente auditar_reversion_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER auditar_reversion_docente AFTER INSERT ON excelencia_seruna.reversiones_pago_docente FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.auditar_planilla();


--
-- TOC entry 6693 (class 2620 OID 19356)
-- Name: asistencia_docentes conservar_asistencia_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_asistencia_docente BEFORE DELETE ON excelencia_seruna.asistencia_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_evento_asistencia();


--
-- TOC entry 6690 (class 2620 OID 19355)
-- Name: asistencia_estudiantes conservar_asistencia_estudiante; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_asistencia_estudiante BEFORE DELETE ON excelencia_seruna.asistencia_estudiantes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_evento_asistencia();


--
-- TOC entry 6684 (class 2620 OID 18876)
-- Name: calificaciones_competencia conservar_calificacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_calificacion BEFORE DELETE ON excelencia_seruna.calificaciones_competencia FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_calificacion();


--
-- TOC entry 6728 (class 2620 OID 20266)
-- Name: conciliaciones_historicas conservar_conciliacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_conciliacion BEFORE DELETE OR UPDATE ON excelencia_seruna.conciliaciones_historicas FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_evento_asistencia();


--
-- TOC entry 6727 (class 2620 OID 20265)
-- Name: equivalencias_historicas conservar_equivalencia; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_equivalencia BEFORE DELETE OR UPDATE ON excelencia_seruna.equivalencias_historicas FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_evento_asistencia();


--
-- TOC entry 6700 (class 2620 OID 19670)
-- Name: horas_docentes conservar_horas_docentes; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_horas_docentes BEFORE DELETE ON excelencia_seruna.horas_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_historial_planilla();


--
-- TOC entry 6696 (class 2620 OID 19361)
-- Name: justificaciones_asistencia conservar_justificacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_justificacion BEFORE DELETE ON excelencia_seruna.justificaciones_asistencia FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_evento_asistencia();


--
-- TOC entry 6705 (class 2620 OID 19673)
-- Name: liquidaciones_docentes conservar_liquidacion_aprobada; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_liquidacion_aprobada BEFORE DELETE ON excelencia_seruna.liquidaciones_docentes FOR EACH ROW WHEN ((old.estado = 'aprobada'::text)) EXECUTE FUNCTION excelencia_seruna.conservar_historial_planilla();


--
-- TOC entry 6688 (class 2620 OID 19199)
-- Name: marcaciones conservar_marcaciones; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_marcaciones BEFORE DELETE OR UPDATE ON excelencia_seruna.marcaciones FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_evento_asistencia();


--
-- TOC entry 6709 (class 2620 OID 19671)
-- Name: pagos_docentes conservar_pago_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_pago_docente BEFORE DELETE OR UPDATE ON excelencia_seruna.pagos_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_historial_planilla();


--
-- TOC entry 6702 (class 2620 OID 19676)
-- Name: periodos_liquidacion conservar_periodo_planilla; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_periodo_planilla BEFORE DELETE ON excelencia_seruna.periodos_liquidacion FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_historial_planilla();


--
-- TOC entry 6712 (class 2620 OID 19672)
-- Name: reversiones_pago_docente conservar_reversion_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER conservar_reversion_docente BEFORE DELETE OR UPDATE ON excelencia_seruna.reversiones_pago_docente FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_historial_planilla();


--
-- TOC entry 6675 (class 2620 OID 18387)
-- Name: aplicaciones_pago controlar_abono; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_abono BEFORE INSERT ON excelencia_seruna.aplicaciones_pago FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_aplicacion_pago();


--
-- TOC entry 6679 (class 2620 OID 18744)
-- Name: asignaciones_docentes controlar_asignacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_asignacion BEFORE INSERT OR UPDATE ON excelencia_seruna.asignaciones_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_vigencia_horario();


--
-- TOC entry 6694 (class 2620 OID 19352)
-- Name: asistencia_docentes controlar_asistencia_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_asistencia_docente BEFORE INSERT OR UPDATE ON excelencia_seruna.asistencia_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_asistencia();


--
-- TOC entry 6691 (class 2620 OID 19351)
-- Name: asistencia_estudiantes controlar_asistencia_estudiante; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_asistencia_estudiante BEFORE INSERT OR UPDATE ON excelencia_seruna.asistencia_estudiantes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_asistencia();


--
-- TOC entry 6680 (class 2620 OID 18745)
-- Name: bloques_horario controlar_bloque; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_bloque BEFORE INSERT OR UPDATE ON excelencia_seruna.bloques_horario FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_vigencia_horario();


--
-- TOC entry 6685 (class 2620 OID 18873)
-- Name: calificaciones_competencia controlar_calificacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_calificacion BEFORE INSERT OR UPDATE ON excelencia_seruna.calificaciones_competencia FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_calificacion();


--
-- TOC entry 6698 (class 2620 OID 19678)
-- Name: contratos_docentes controlar_cambio_contrato; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_cambio_contrato BEFORE UPDATE ON excelencia_seruna.contratos_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.conservar_condiciones_contrato();


--
-- TOC entry 6682 (class 2620 OID 18878)
-- Name: cierres_evaluacion controlar_cierre; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_cierre BEFORE INSERT OR UPDATE ON excelencia_seruna.cierres_evaluacion FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_cierre_evaluacion();


--
-- TOC entry 6719 (class 2620 OID 20044)
-- Name: cierres_anuales controlar_cierre_anual; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_cierre_anual BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.cierres_anuales FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.controlar_cierre_anual();


--
-- TOC entry 6671 (class 2620 OID 18373)
-- Name: matricula_secciones controlar_cupo; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_cupo BEFORE INSERT OR UPDATE OF seccion_id, anio_id, vigencia, tipo_vacante ON excelencia_seruna.matricula_secciones FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_ocupacion_seccion();


--
-- TOC entry 6707 (class 2620 OID 19665)
-- Name: detalle_liquidacion_docente controlar_detalle_liquidacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_detalle_liquidacion BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.detalle_liquidacion_docente FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_detalle_liquidacion();


--
-- TOC entry 6672 (class 2620 OID 18375)
-- Name: cuotas controlar_emision; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_emision BEFORE INSERT ON excelencia_seruna.cuotas FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_emision_cuota();


--
-- TOC entry 6722 (class 2620 OID 20048)
-- Name: evaluaciones_recuperacion controlar_evaluacion_recuperacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_evaluacion_recuperacion BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.evaluaciones_recuperacion FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.controlar_evaluacion_recuperacion();


--
-- TOC entry 6726 (class 2620 OID 20264)
-- Name: filas_importacion controlar_fila_importacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_fila_importacion BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.filas_importacion FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.controlar_carga_historica();


--
-- TOC entry 6701 (class 2620 OID 19661)
-- Name: horas_docentes controlar_horas_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_horas_docente BEFORE INSERT OR UPDATE ON excelencia_seruna.horas_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_horas_docente();


--
-- TOC entry 6687 (class 2620 OID 19099)
-- Name: jornadas_docente controlar_jornada_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_jornada_docente BEFORE INSERT OR UPDATE ON excelencia_seruna.jornadas_docente FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_fecha_jornada();


--
-- TOC entry 6686 (class 2620 OID 19098)
-- Name: jornadas_seccion controlar_jornada_seccion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_jornada_seccion BEFORE INSERT OR UPDATE ON excelencia_seruna.jornadas_seccion FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_fecha_jornada();


--
-- TOC entry 6697 (class 2620 OID 19359)
-- Name: justificaciones_asistencia controlar_justificacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_justificacion BEFORE INSERT OR UPDATE ON excelencia_seruna.justificaciones_asistencia FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_justificacion();


--
-- TOC entry 6706 (class 2620 OID 19663)
-- Name: liquidaciones_docentes controlar_liquidacion_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_liquidacion_docente BEFORE INSERT OR UPDATE ON excelencia_seruna.liquidaciones_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_liquidacion_docente();


--
-- TOC entry 6710 (class 2620 OID 19667)
-- Name: pagos_docentes controlar_pago_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_pago_docente BEFORE INSERT ON excelencia_seruna.pagos_docentes FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_movimiento_pago_docente();


--
-- TOC entry 6703 (class 2620 OID 19675)
-- Name: periodos_liquidacion controlar_periodo_planilla; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_periodo_planilla BEFORE INSERT OR UPDATE ON excelencia_seruna.periodos_liquidacion FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.controlar_periodo_planilla();


--
-- TOC entry 6678 (class 2620 OID 18579)
-- Name: seccion_planes_estudio controlar_plan_seccion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_plan_seccion BEFORE INSERT OR UPDATE ON excelencia_seruna.seccion_planes_estudio FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_plan_seccion();


--
-- TOC entry 6724 (class 2620 OID 20136)
-- Name: publicaciones_merito controlar_publicacion_merito; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_publicacion_merito BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.publicaciones_merito FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.controlar_publicacion_merito();


--
-- TOC entry 6725 (class 2620 OID 20138)
-- Name: orden_merito controlar_puesto_merito; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_puesto_merito BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.orden_merito FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.controlar_puesto_merito();


--
-- TOC entry 6720 (class 2620 OID 20046)
-- Name: resultados_anuales_competencia controlar_resultado_anual; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_resultado_anual BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.resultados_anuales_competencia FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.controlar_resultado_anual();


--
-- TOC entry 6713 (class 2620 OID 19668)
-- Name: reversiones_pago_docente controlar_reversion_docente; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_reversion_docente BEFORE INSERT ON excelencia_seruna.reversiones_pago_docente FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_movimiento_pago_docente();


--
-- TOC entry 6681 (class 2620 OID 18746)
-- Name: sesiones_clase controlar_sesion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER controlar_sesion BEFORE INSERT OR UPDATE ON excelencia_seruna.sesiones_clase FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.validar_vigencia_horario();


--
-- TOC entry 6676 (class 2620 OID 18379)
-- Name: aplicaciones_pago preservar_aplicacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER preservar_aplicacion BEFORE DELETE OR UPDATE ON excelencia_seruna.aplicaciones_pago FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.preservar_registro_financiero();


--
-- TOC entry 6673 (class 2620 OID 18377)
-- Name: cuotas preservar_cuota; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER preservar_cuota BEFORE DELETE OR UPDATE ON excelencia_seruna.cuotas FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.preservar_registro_financiero();


--
-- TOC entry 6674 (class 2620 OID 18378)
-- Name: pagos preservar_pago; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER preservar_pago BEFORE DELETE OR UPDATE ON excelencia_seruna.pagos FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.preservar_registro_financiero();


--
-- TOC entry 6677 (class 2620 OID 18380)
-- Name: recibos_caja preservar_recibo; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER preservar_recibo BEFORE DELETE OR UPDATE ON excelencia_seruna.recibos_caja FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.preservar_registro_financiero();


--
-- TOC entry 6716 (class 2620 OID 19808)
-- Name: documentos_emitidos proteger_documento_emitido; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER proteger_documento_emitido BEFORE INSERT OR DELETE OR UPDATE ON excelencia_seruna.documentos_emitidos FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.proteger_documento_reporte();


--
-- TOC entry 6714 (class 2620 OID 19807)
-- Name: plantillas_documento proteger_plantilla_publicada; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER proteger_plantilla_publicada BEFORE DELETE OR UPDATE ON excelencia_seruna.plantillas_documento FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.proteger_documento_reporte();


--
-- TOC entry 6717 (class 2620 OID 19871)
-- Name: reglas_evaluacion proteger_regla_evaluacion; Type: TRIGGER; Schema: excelencia_seruna; Owner: postgres
--

CREATE TRIGGER proteger_regla_evaluacion BEFORE DELETE OR UPDATE ON excelencia_seruna.reglas_evaluacion FOR EACH ROW EXECUTE FUNCTION excelencia_seruna.proteger_regla_evaluacion();


--
-- TOC entry 6491 (class 2606 OID 17884)
-- Name: aceptaciones_documento aceptaciones_documento_documento_id_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aceptaciones_documento
    ADD CONSTRAINT aceptaciones_documento_documento_id_anio_id_fkey FOREIGN KEY (documento_id, anio_id) REFERENCES excelencia_seruna.documentos_institucionales(id, anio_id);


--
-- TOC entry 6492 (class 2606 OID 17874)
-- Name: aceptaciones_documento aceptaciones_documento_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aceptaciones_documento
    ADD CONSTRAINT aceptaciones_documento_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6493 (class 2606 OID 17869)
-- Name: aceptaciones_documento aceptaciones_documento_firmante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aceptaciones_documento
    ADD CONSTRAINT aceptaciones_documento_firmante_id_fkey FOREIGN KEY (firmante_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6494 (class 2606 OID 17879)
-- Name: aceptaciones_documento aceptaciones_documento_matricula_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aceptaciones_documento
    ADD CONSTRAINT aceptaciones_documento_matricula_id_anio_id_grado_id_fkey FOREIGN KEY (matricula_id, anio_id, grado_id) REFERENCES excelencia_seruna.matriculas(id, anio_id, grado_id);


--
-- TOC entry 6508 (class 2606 OID 18101)
-- Name: ajustes_cuota ajustes_cuota_autorizado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.ajustes_cuota
    ADD CONSTRAINT ajustes_cuota_autorizado_por_fkey FOREIGN KEY (autorizado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6509 (class 2606 OID 18096)
-- Name: ajustes_cuota ajustes_cuota_cuota_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.ajustes_cuota
    ADD CONSTRAINT ajustes_cuota_cuota_id_fkey FOREIGN KEY (cuota_id) REFERENCES excelencia_seruna.cuotas(id);


--
-- TOC entry 6515 (class 2606 OID 18207)
-- Name: aplicaciones_pago aplicaciones_pago_cuota_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_cuota_id_fkey FOREIGN KEY (cuota_id) REFERENCES excelencia_seruna.cuotas(id);


--
-- TOC entry 6516 (class 2606 OID 18202)
-- Name: aplicaciones_pago aplicaciones_pago_pago_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES excelencia_seruna.pagos(id);


--
-- TOC entry 6544 (class 2606 OID 18626)
-- Name: asignaciones_docentes asignaciones_docentes_curso_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaciones_docentes
    ADD CONSTRAINT asignaciones_docentes_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES excelencia_seruna.cursos_seccion(id);


--
-- TOC entry 6545 (class 2606 OID 18631)
-- Name: asignaciones_docentes asignaciones_docentes_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaciones_docentes
    ADD CONSTRAINT asignaciones_docentes_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES excelencia_seruna.docentes(id);


--
-- TOC entry 6538 (class 2606 OID 18539)
-- Name: asignatura_competencias asignatura_competencias_plan_id_asignatura_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignatura_competencias
    ADD CONSTRAINT asignatura_competencias_plan_id_asignatura_id_fkey FOREIGN KEY (plan_id, asignatura_id) REFERENCES excelencia_seruna.plan_asignaturas(plan_id, asignatura_id);


--
-- TOC entry 6539 (class 2606 OID 18544)
-- Name: asignatura_competencias asignatura_competencias_plan_id_competencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignatura_competencias
    ADD CONSTRAINT asignatura_competencias_plan_id_competencia_id_fkey FOREIGN KEY (plan_id, competencia_id) REFERENCES excelencia_seruna.plan_competencias(plan_id, competencia_id);


--
-- TOC entry 6531 (class 2606 OID 18467)
-- Name: asignaturas asignaturas_area_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asignaturas
    ADD CONSTRAINT asignaturas_area_id_fkey FOREIGN KEY (area_id) REFERENCES excelencia_seruna.areas_curriculares(id);


--
-- TOC entry 6591 (class 2606 OID 19286)
-- Name: asistencia_docentes asistencia_docentes_entrada_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_docentes
    ADD CONSTRAINT asistencia_docentes_entrada_id_fkey FOREIGN KEY (entrada_id) REFERENCES excelencia_seruna.marcaciones(id);


--
-- TOC entry 6592 (class 2606 OID 19281)
-- Name: asistencia_docentes asistencia_docentes_jornada_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_docentes
    ADD CONSTRAINT asistencia_docentes_jornada_id_fkey FOREIGN KEY (jornada_id) REFERENCES excelencia_seruna.jornadas_docente(id);


--
-- TOC entry 6593 (class 2606 OID 19296)
-- Name: asistencia_docentes asistencia_docentes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_docentes
    ADD CONSTRAINT asistencia_docentes_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6594 (class 2606 OID 19291)
-- Name: asistencia_docentes asistencia_docentes_salida_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_docentes
    ADD CONSTRAINT asistencia_docentes_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES excelencia_seruna.marcaciones(id);


--
-- TOC entry 6584 (class 2606 OID 19242)
-- Name: asistencia_estudiantes asistencia_estudiantes_entrada_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_entrada_id_fkey FOREIGN KEY (entrada_id) REFERENCES excelencia_seruna.marcaciones(id);


--
-- TOC entry 6585 (class 2606 OID 19232)
-- Name: asistencia_estudiantes asistencia_estudiantes_jornada_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_jornada_id_fkey FOREIGN KEY (jornada_id) REFERENCES excelencia_seruna.jornadas_seccion(id);


--
-- TOC entry 6586 (class 2606 OID 19222)
-- Name: asistencia_estudiantes asistencia_estudiantes_matricula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES excelencia_seruna.matriculas(id);


--
-- TOC entry 6587 (class 2606 OID 19227)
-- Name: asistencia_estudiantes asistencia_estudiantes_matricula_seccion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_matricula_seccion_id_fkey FOREIGN KEY (matricula_seccion_id) REFERENCES excelencia_seruna.matricula_secciones(id);


--
-- TOC entry 6588 (class 2606 OID 19252)
-- Name: asistencia_estudiantes asistencia_estudiantes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6589 (class 2606 OID 19247)
-- Name: asistencia_estudiantes asistencia_estudiantes_salida_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES excelencia_seruna.marcaciones(id);


--
-- TOC entry 6590 (class 2606 OID 19237)
-- Name: asistencia_estudiantes asistencia_estudiantes_sesion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.asistencia_estudiantes
    ADD CONSTRAINT asistencia_estudiantes_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES excelencia_seruna.sesiones_clase(id);


--
-- TOC entry 6459 (class 2606 OID 17460)
-- Name: bimestres bimestres_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bimestres
    ADD CONSTRAINT bimestres_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6453 (class 2606 OID 17352)
-- Name: bitacora bitacora_actor_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bitacora
    ADD CONSTRAINT bitacora_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6454 (class 2606 OID 17357)
-- Name: bitacora bitacora_usuario_afectado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bitacora
    ADD CONSTRAINT bitacora_usuario_afectado_id_fkey FOREIGN KEY (usuario_afectado_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6546 (class 2606 OID 18691)
-- Name: bloques_horario bloques_horario_asignacion_id_curso_id_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_asignacion_id_curso_id_docente_id_fkey FOREIGN KEY (asignacion_id, curso_id, docente_id) REFERENCES excelencia_seruna.asignaciones_docentes(id, curso_id, docente_id);


--
-- TOC entry 6547 (class 2606 OID 18681)
-- Name: bloques_horario bloques_horario_aula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES excelencia_seruna.aulas(id);


--
-- TOC entry 6548 (class 2606 OID 18686)
-- Name: bloques_horario bloques_horario_curso_id_seccion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.bloques_horario
    ADD CONSTRAINT bloques_horario_curso_id_seccion_id_fkey FOREIGN KEY (curso_id, seccion_id) REFERENCES excelencia_seruna.cursos_seccion(id, seccion_id);


--
-- TOC entry 6460 (class 2606 OID 17476)
-- Name: calendario_escolar calendario_escolar_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calendario_escolar
    ADD CONSTRAINT calendario_escolar_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6556 (class 2606 OID 18819)
-- Name: calificaciones_competencia calificaciones_competencia_autor_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calificaciones_competencia
    ADD CONSTRAINT calificaciones_competencia_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6557 (class 2606 OID 18839)
-- Name: calificaciones_competencia calificaciones_competencia_cierre_id_bimestre_id_anio_id_g_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calificaciones_competencia
    ADD CONSTRAINT calificaciones_competencia_cierre_id_bimestre_id_anio_id_g_fkey FOREIGN KEY (cierre_id, bimestre_id, anio_id, grado_id) REFERENCES excelencia_seruna.cierres_evaluacion(id, bimestre_id, anio_id, grado_id);


--
-- TOC entry 6558 (class 2606 OID 18824)
-- Name: calificaciones_competencia calificaciones_competencia_matricula_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calificaciones_competencia
    ADD CONSTRAINT calificaciones_competencia_matricula_id_anio_id_grado_id_fkey FOREIGN KEY (matricula_id, anio_id, grado_id) REFERENCES excelencia_seruna.matriculas(id, anio_id, grado_id);


--
-- TOC entry 6559 (class 2606 OID 18829)
-- Name: calificaciones_competencia calificaciones_competencia_plan_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calificaciones_competencia
    ADD CONSTRAINT calificaciones_competencia_plan_id_anio_id_grado_id_fkey FOREIGN KEY (plan_id, anio_id, grado_id) REFERENCES excelencia_seruna.planes_estudio(id, anio_id, grado_id);


--
-- TOC entry 6560 (class 2606 OID 18834)
-- Name: calificaciones_competencia calificaciones_competencia_plan_id_competencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.calificaciones_competencia
    ADD CONSTRAINT calificaciones_competencia_plan_id_competencia_id_fkey FOREIGN KEY (plan_id, competencia_id) REFERENCES excelencia_seruna.plan_competencias(plan_id, competencia_id);


--
-- TOC entry 6530 (class 2606 OID 18447)
-- Name: capacidades capacidades_competencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.capacidades
    ADD CONSTRAINT capacidades_competencia_id_fkey FOREIGN KEY (competencia_id) REFERENCES excelencia_seruna.competencias(id);


--
-- TOC entry 6637 (class 2606 OID 19943)
-- Name: cierres_anuales cierres_anuales_anterior_id_matricula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_anterior_id_matricula_id_fkey FOREIGN KEY (anterior_id, matricula_id) REFERENCES excelencia_seruna.cierres_anuales(id, matricula_id);


--
-- TOC entry 6638 (class 2606 OID 19918)
-- Name: cierres_anuales cierres_anuales_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6639 (class 2606 OID 19908)
-- Name: cierres_anuales cierres_anuales_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6640 (class 2606 OID 19923)
-- Name: cierres_anuales cierres_anuales_matricula_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_matricula_id_anio_id_grado_id_fkey FOREIGN KEY (matricula_id, anio_id, grado_id) REFERENCES excelencia_seruna.matriculas(id, anio_id, grado_id);


--
-- TOC entry 6641 (class 2606 OID 19933)
-- Name: cierres_anuales cierres_anuales_plan_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_plan_id_anio_id_grado_id_fkey FOREIGN KEY (plan_id, anio_id, grado_id) REFERENCES excelencia_seruna.planes_estudio(id, anio_id, grado_id);


--
-- TOC entry 6642 (class 2606 OID 19913)
-- Name: cierres_anuales cierres_anuales_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6643 (class 2606 OID 19938)
-- Name: cierres_anuales cierres_anuales_regla_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_regla_id_anio_id_grado_id_fkey FOREIGN KEY (regla_id, anio_id, grado_id) REFERENCES excelencia_seruna.reglas_evaluacion(id, anio_id, grado_id);


--
-- TOC entry 6644 (class 2606 OID 19928)
-- Name: cierres_anuales cierres_anuales_seccion_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_anuales
    ADD CONSTRAINT cierres_anuales_seccion_id_anio_id_grado_id_fkey FOREIGN KEY (seccion_id, anio_id, grado_id) REFERENCES excelencia_seruna.secciones(id, anio_id, grado_id);


--
-- TOC entry 6553 (class 2606 OID 18783)
-- Name: cierres_evaluacion cierres_evaluacion_bimestre_id_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_evaluacion
    ADD CONSTRAINT cierres_evaluacion_bimestre_id_anio_id_fkey FOREIGN KEY (bimestre_id, anio_id) REFERENCES excelencia_seruna.bimestres(id, anio_id);


--
-- TOC entry 6554 (class 2606 OID 18778)
-- Name: cierres_evaluacion cierres_evaluacion_responsable_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_evaluacion
    ADD CONSTRAINT cierres_evaluacion_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6555 (class 2606 OID 18788)
-- Name: cierres_evaluacion cierres_evaluacion_seccion_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cierres_evaluacion
    ADD CONSTRAINT cierres_evaluacion_seccion_id_anio_id_grado_id_fkey FOREIGN KEY (seccion_id, anio_id, grado_id) REFERENCES excelencia_seruna.secciones(id, anio_id, grado_id);


--
-- TOC entry 6529 (class 2606 OID 18428)
-- Name: competencias competencias_area_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.competencias
    ADD CONSTRAINT competencias_area_id_fkey FOREIGN KEY (area_id) REFERENCES excelencia_seruna.areas_curriculares(id);


--
-- TOC entry 6527 (class 2606 OID 18356)
-- Name: comprobantes_externos comprobantes_externos_archivo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comprobantes_externos
    ADD CONSTRAINT comprobantes_externos_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6528 (class 2606 OID 18351)
-- Name: comprobantes_externos comprobantes_externos_pago_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comprobantes_externos
    ADD CONSTRAINT comprobantes_externos_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES excelencia_seruna.pagos(id);


--
-- TOC entry 6487 (class 2606 OID 17836)
-- Name: comunicaciones_documento comunicaciones_documento_destinatario_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comunicaciones_documento
    ADD CONSTRAINT comunicaciones_documento_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6488 (class 2606 OID 17831)
-- Name: comunicaciones_documento comunicaciones_documento_documento_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comunicaciones_documento
    ADD CONSTRAINT comunicaciones_documento_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES excelencia_seruna.documentos_institucionales(id);


--
-- TOC entry 6489 (class 2606 OID 17841)
-- Name: comunicaciones_documento comunicaciones_documento_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comunicaciones_documento
    ADD CONSTRAINT comunicaciones_documento_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6490 (class 2606 OID 17846)
-- Name: comunicaciones_documento comunicaciones_documento_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.comunicaciones_documento
    ADD CONSTRAINT comunicaciones_documento_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6669 (class 2606 OID 20257)
-- Name: conciliaciones_historicas conciliaciones_historicas_lote_id_entidad_clave_origen_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.conciliaciones_historicas
    ADD CONSTRAINT conciliaciones_historicas_lote_id_entidad_clave_origen_fkey FOREIGN KEY (lote_id, entidad, clave_origen) REFERENCES excelencia_seruna.filas_importacion(lote_id, entidad, clave_origen);


--
-- TOC entry 6670 (class 2606 OID 20252)
-- Name: conciliaciones_historicas conciliaciones_historicas_revisada_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.conciliaciones_historicas
    ADD CONSTRAINT conciliaciones_historicas_revisada_por_fkey FOREIGN KEY (revisada_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6600 (class 2606 OID 19396)
-- Name: contratos_docentes contratos_docentes_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.contratos_docentes
    ADD CONSTRAINT contratos_docentes_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES excelencia_seruna.docentes(id);


--
-- TOC entry 6601 (class 2606 OID 19401)
-- Name: contratos_docentes contratos_docentes_documento_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.contratos_docentes
    ADD CONSTRAINT contratos_docentes_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6602 (class 2606 OID 19406)
-- Name: contratos_docentes contratos_docentes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.contratos_docentes
    ADD CONSTRAINT contratos_docentes_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6577 (class 2606 OID 19143)
-- Name: credenciales_qr credenciales_qr_emitida_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.credenciales_qr
    ADD CONSTRAINT credenciales_qr_emitida_por_fkey FOREIGN KEY (emitida_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6578 (class 2606 OID 19138)
-- Name: credenciales_qr credenciales_qr_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.credenciales_qr
    ADD CONSTRAINT credenciales_qr_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6579 (class 2606 OID 19148)
-- Name: credenciales_qr credenciales_qr_revocada_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.credenciales_qr
    ADD CONSTRAINT credenciales_qr_revocada_por_fkey FOREIGN KEY (revocada_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6504 (class 2606 OID 18057)
-- Name: cuotas cuotas_matricula_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_matricula_id_anio_id_grado_id_fkey FOREIGN KEY (matricula_id, anio_id, grado_id) REFERENCES excelencia_seruna.matriculas(id, anio_id, grado_id);


--
-- TOC entry 6505 (class 2606 OID 18062)
-- Name: cuotas cuotas_matricula_id_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_matricula_id_estudiante_id_fkey FOREIGN KEY (matricula_id, estudiante_id) REFERENCES excelencia_seruna.matriculas(id, estudiante_id);


--
-- TOC entry 6506 (class 2606 OID 18072)
-- Name: cuotas cuotas_obligacion_ingreso_id_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_obligacion_ingreso_id_estudiante_id_fkey FOREIGN KEY (obligacion_ingreso_id, estudiante_id) REFERENCES excelencia_seruna.obligaciones_ingreso(id, estudiante_id);


--
-- TOC entry 6507 (class 2606 OID 18067)
-- Name: cuotas cuotas_tramo_id_anio_id_grado_id_concepto_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cuotas
    ADD CONSTRAINT cuotas_tramo_id_anio_id_grado_id_concepto_fkey FOREIGN KEY (tramo_id, anio_id, grado_id, concepto) REFERENCES excelencia_seruna.tramos_plan_cobro(id, anio_id, grado_id, concepto);


--
-- TOC entry 6542 (class 2606 OID 18602)
-- Name: cursos_seccion cursos_seccion_plan_id_asignatura_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cursos_seccion
    ADD CONSTRAINT cursos_seccion_plan_id_asignatura_id_fkey FOREIGN KEY (plan_id, asignatura_id) REFERENCES excelencia_seruna.plan_asignaturas(plan_id, asignatura_id);


--
-- TOC entry 6543 (class 2606 OID 18597)
-- Name: cursos_seccion cursos_seccion_seccion_plan_id_plan_id_seccion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.cursos_seccion
    ADD CONSTRAINT cursos_seccion_seccion_plan_id_plan_id_seccion_id_fkey FOREIGN KEY (seccion_plan_id, plan_id, seccion_id) REFERENCES excelencia_seruna.seccion_planes_estudio(id, plan_id, seccion_id);


--
-- TOC entry 6614 (class 2606 OID 19570)
-- Name: detalle_liquidacion_docente detalle_liquidacion_docente_hora_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.detalle_liquidacion_docente
    ADD CONSTRAINT detalle_liquidacion_docente_hora_docente_id_fkey FOREIGN KEY (hora_docente_id) REFERENCES excelencia_seruna.horas_docentes(id);


--
-- TOC entry 6615 (class 2606 OID 19565)
-- Name: detalle_liquidacion_docente detalle_liquidacion_docente_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.detalle_liquidacion_docente
    ADD CONSTRAINT detalle_liquidacion_docente_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES excelencia_seruna.liquidaciones_docentes(id);


--
-- TOC entry 6616 (class 2606 OID 19575)
-- Name: detalle_liquidacion_docente detalle_liquidacion_docente_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.detalle_liquidacion_docente
    ADD CONSTRAINT detalle_liquidacion_docente_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6519 (class 2606 OID 18275)
-- Name: devoluciones devoluciones_aplicacion_id_pago_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.devoluciones
    ADD CONSTRAINT devoluciones_aplicacion_id_pago_id_fkey FOREIGN KEY (aplicacion_id, pago_id) REFERENCES excelencia_seruna.aplicaciones_pago(id, pago_id);


--
-- TOC entry 6520 (class 2606 OID 18270)
-- Name: devoluciones devoluciones_autorizado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.devoluciones
    ADD CONSTRAINT devoluciones_autorizado_por_fkey FOREIGN KEY (autorizado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6521 (class 2606 OID 18265)
-- Name: devoluciones devoluciones_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.devoluciones
    ADD CONSTRAINT devoluciones_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6522 (class 2606 OID 18255)
-- Name: devoluciones devoluciones_pago_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.devoluciones
    ADD CONSTRAINT devoluciones_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES excelencia_seruna.pagos(id);


--
-- TOC entry 6523 (class 2606 OID 18260)
-- Name: devoluciones devoluciones_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.devoluciones
    ADD CONSTRAINT devoluciones_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES excelencia_seruna.sesiones_caja(id);


--
-- TOC entry 6444 (class 2606 OID 17195)
-- Name: docentes docentes_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.docentes
    ADD CONSTRAINT docentes_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6628 (class 2606 OID 19794)
-- Name: documentos_emitidos documentos_emitidos_anulado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6629 (class 2606 OID 19784)
-- Name: documentos_emitidos documentos_emitidos_archivo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6630 (class 2606 OID 19799)
-- Name: documentos_emitidos documentos_emitidos_plantilla_id_tipo_anio_id_formato_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_plantilla_id_tipo_anio_id_formato_fkey FOREIGN KEY (plantilla_id, tipo, anio_id, formato) REFERENCES excelencia_seruna.plantillas_documento(id, tipo, anio_id, formato);


--
-- TOC entry 6631 (class 2606 OID 19789)
-- Name: documentos_emitidos documentos_emitidos_procesado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_procesado_por_fkey FOREIGN KEY (procesado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6632 (class 2606 OID 19779)
-- Name: documentos_emitidos documentos_emitidos_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_emitidos
    ADD CONSTRAINT documentos_emitidos_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6479 (class 2606 OID 17767)
-- Name: documentos_expediente documentos_expediente_archivo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_expediente
    ADD CONSTRAINT documentos_expediente_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6480 (class 2606 OID 17772)
-- Name: documentos_expediente documentos_expediente_cargado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_expediente
    ADD CONSTRAINT documentos_expediente_cargado_por_fkey FOREIGN KEY (cargado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6481 (class 2606 OID 17757)
-- Name: documentos_expediente documentos_expediente_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_expediente
    ADD CONSTRAINT documentos_expediente_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES excelencia_seruna.estudiantes(id);


--
-- TOC entry 6482 (class 2606 OID 17782)
-- Name: documentos_expediente documentos_expediente_matricula_id_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_expediente
    ADD CONSTRAINT documentos_expediente_matricula_id_estudiante_id_fkey FOREIGN KEY (matricula_id, estudiante_id) REFERENCES excelencia_seruna.matriculas(id, estudiante_id);


--
-- TOC entry 6483 (class 2606 OID 17777)
-- Name: documentos_expediente documentos_expediente_revisado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_expediente
    ADD CONSTRAINT documentos_expediente_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6484 (class 2606 OID 17762)
-- Name: documentos_expediente documentos_expediente_tipo_documento_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_expediente
    ADD CONSTRAINT documentos_expediente_tipo_documento_id_fkey FOREIGN KEY (tipo_documento_id) REFERENCES excelencia_seruna.tipos_documento(id);


--
-- TOC entry 6442 (class 2606 OID 17149)
-- Name: documentos_identidad documentos_identidad_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_identidad
    ADD CONSTRAINT documentos_identidad_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6485 (class 2606 OID 17807)
-- Name: documentos_institucionales documentos_institucionales_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_institucionales
    ADD CONSTRAINT documentos_institucionales_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6486 (class 2606 OID 17812)
-- Name: documentos_institucionales documentos_institucionales_archivo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.documentos_institucionales
    ADD CONSTRAINT documentos_institucionales_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6664 (class 2606 OID 20219)
-- Name: equivalencias_historicas equivalencias_historicas_curso_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.equivalencias_historicas
    ADD CONSTRAINT equivalencias_historicas_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES excelencia_seruna.cursos_seccion(id);


--
-- TOC entry 6665 (class 2606 OID 20214)
-- Name: equivalencias_historicas equivalencias_historicas_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.equivalencias_historicas
    ADD CONSTRAINT equivalencias_historicas_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES excelencia_seruna.docentes(id);


--
-- TOC entry 6666 (class 2606 OID 20209)
-- Name: equivalencias_historicas equivalencias_historicas_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.equivalencias_historicas
    ADD CONSTRAINT equivalencias_historicas_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES excelencia_seruna.estudiantes(id);


--
-- TOC entry 6667 (class 2606 OID 20229)
-- Name: equivalencias_historicas equivalencias_historicas_lote_id_entidad_clave_origen_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.equivalencias_historicas
    ADD CONSTRAINT equivalencias_historicas_lote_id_entidad_clave_origen_fkey FOREIGN KEY (lote_id, entidad, clave_origen) REFERENCES excelencia_seruna.filas_importacion(lote_id, entidad, clave_origen);


--
-- TOC entry 6668 (class 2606 OID 20224)
-- Name: equivalencias_historicas equivalencias_historicas_matricula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.equivalencias_historicas
    ADD CONSTRAINT equivalencias_historicas_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES excelencia_seruna.matriculas(id);


--
-- TOC entry 6455 (class 2606 OID 17403)
-- Name: estudiante_apoderado estudiante_apoderado_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiante_apoderado
    ADD CONSTRAINT estudiante_apoderado_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES excelencia_seruna.estudiantes(id);


--
-- TOC entry 6456 (class 2606 OID 17418)
-- Name: estudiante_apoderado estudiante_apoderado_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiante_apoderado
    ADD CONSTRAINT estudiante_apoderado_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6457 (class 2606 OID 17408)
-- Name: estudiante_apoderado estudiante_apoderado_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiante_apoderado
    ADD CONSTRAINT estudiante_apoderado_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6458 (class 2606 OID 17413)
-- Name: estudiante_apoderado estudiante_apoderado_verificado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiante_apoderado
    ADD CONSTRAINT estudiante_apoderado_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6443 (class 2606 OID 17173)
-- Name: estudiantes estudiantes_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.estudiantes
    ADD CONSTRAINT estudiantes_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6650 (class 2606 OID 20028)
-- Name: evaluaciones_recuperacion evaluaciones_recuperacion_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.evaluaciones_recuperacion
    ADD CONSTRAINT evaluaciones_recuperacion_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6651 (class 2606 OID 20018)
-- Name: evaluaciones_recuperacion evaluaciones_recuperacion_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.evaluaciones_recuperacion
    ADD CONSTRAINT evaluaciones_recuperacion_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6652 (class 2606 OID 20023)
-- Name: evaluaciones_recuperacion evaluaciones_recuperacion_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.evaluaciones_recuperacion
    ADD CONSTRAINT evaluaciones_recuperacion_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6653 (class 2606 OID 20013)
-- Name: evaluaciones_recuperacion evaluaciones_recuperacion_resultado_origen_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.evaluaciones_recuperacion
    ADD CONSTRAINT evaluaciones_recuperacion_resultado_origen_id_fkey FOREIGN KEY (resultado_origen_id) REFERENCES excelencia_seruna.resultados_anuales_competencia(id);


--
-- TOC entry 6568 (class 2606 OID 18977)
-- Name: exportaciones_siagie exportaciones_siagie_plantilla_id_seccion_id_bimestre_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_plantilla_id_seccion_id_bimestre_id_fkey FOREIGN KEY (plantilla_id, seccion_id, bimestre_id) REFERENCES excelencia_seruna.plantillas_siagie(id, seccion_id, bimestre_id);


--
-- TOC entry 6569 (class 2606 OID 18972)
-- Name: exportaciones_siagie exportaciones_siagie_resultado_archivo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_resultado_archivo_id_fkey FOREIGN KEY (resultado_archivo_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6570 (class 2606 OID 18967)
-- Name: exportaciones_siagie exportaciones_siagie_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6663 (class 2606 OID 20191)
-- Name: filas_importacion filas_importacion_lote_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.filas_importacion
    ADD CONSTRAINT filas_importacion_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES excelencia_seruna.lotes_importacion(id);


--
-- TOC entry 6461 (class 2606 OID 17507)
-- Name: grados grados_nivel_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.grados
    ADD CONSTRAINT grados_nivel_id_fkey FOREIGN KEY (nivel_id) REFERENCES excelencia_seruna.niveles(id);


--
-- TOC entry 6603 (class 2606 OID 19438)
-- Name: horas_docentes horas_docentes_contrato_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.horas_docentes
    ADD CONSTRAINT horas_docentes_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES excelencia_seruna.contratos_docentes(id);


--
-- TOC entry 6604 (class 2606 OID 19448)
-- Name: horas_docentes horas_docentes_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.horas_docentes
    ADD CONSTRAINT horas_docentes_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6605 (class 2606 OID 19453)
-- Name: horas_docentes horas_docentes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.horas_docentes
    ADD CONSTRAINT horas_docentes_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6606 (class 2606 OID 19458)
-- Name: horas_docentes horas_docentes_resuelto_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.horas_docentes
    ADD CONSTRAINT horas_docentes_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6607 (class 2606 OID 19443)
-- Name: horas_docentes horas_docentes_sesion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.horas_docentes
    ADD CONSTRAINT horas_docentes_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES excelencia_seruna.sesiones_clase(id);


--
-- TOC entry 6574 (class 2606 OID 19087)
-- Name: jornadas_docente jornadas_docente_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_docente
    ADD CONSTRAINT jornadas_docente_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6575 (class 2606 OID 19082)
-- Name: jornadas_docente jornadas_docente_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_docente
    ADD CONSTRAINT jornadas_docente_docente_id_fkey FOREIGN KEY (docente_id) REFERENCES excelencia_seruna.docentes(id);


--
-- TOC entry 6576 (class 2606 OID 19092)
-- Name: jornadas_docente jornadas_docente_politica_id_anio_id_alcance_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_docente
    ADD CONSTRAINT jornadas_docente_politica_id_anio_id_alcance_fkey FOREIGN KEY (politica_id, anio_id, alcance) REFERENCES excelencia_seruna.politicas_asistencia(id, anio_id, alcance);


--
-- TOC entry 6572 (class 2606 OID 19054)
-- Name: jornadas_seccion jornadas_seccion_politica_id_anio_id_alcance_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_seccion
    ADD CONSTRAINT jornadas_seccion_politica_id_anio_id_alcance_fkey FOREIGN KEY (politica_id, anio_id, alcance) REFERENCES excelencia_seruna.politicas_asistencia(id, anio_id, alcance);


--
-- TOC entry 6573 (class 2606 OID 19049)
-- Name: jornadas_seccion jornadas_seccion_seccion_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.jornadas_seccion
    ADD CONSTRAINT jornadas_seccion_seccion_id_anio_id_grado_id_fkey FOREIGN KEY (seccion_id, anio_id, grado_id) REFERENCES excelencia_seruna.secciones(id, anio_id, grado_id);


--
-- TOC entry 6595 (class 2606 OID 19327)
-- Name: justificaciones_asistencia justificaciones_asistencia_asistencia_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.justificaciones_asistencia
    ADD CONSTRAINT justificaciones_asistencia_asistencia_docente_id_fkey FOREIGN KEY (asistencia_docente_id) REFERENCES excelencia_seruna.asistencia_docentes(id);


--
-- TOC entry 6596 (class 2606 OID 19322)
-- Name: justificaciones_asistencia justificaciones_asistencia_asistencia_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.justificaciones_asistencia
    ADD CONSTRAINT justificaciones_asistencia_asistencia_estudiante_id_fkey FOREIGN KEY (asistencia_estudiante_id) REFERENCES excelencia_seruna.asistencia_estudiantes(id);


--
-- TOC entry 6597 (class 2606 OID 19337)
-- Name: justificaciones_asistencia justificaciones_asistencia_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.justificaciones_asistencia
    ADD CONSTRAINT justificaciones_asistencia_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6598 (class 2606 OID 19342)
-- Name: justificaciones_asistencia justificaciones_asistencia_resuelta_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.justificaciones_asistencia
    ADD CONSTRAINT justificaciones_asistencia_resuelta_por_fkey FOREIGN KEY (resuelta_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6599 (class 2606 OID 19332)
-- Name: justificaciones_asistencia justificaciones_asistencia_solicitada_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.justificaciones_asistencia
    ADD CONSTRAINT justificaciones_asistencia_solicitada_por_fkey FOREIGN KEY (solicitada_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6610 (class 2606 OID 19540)
-- Name: liquidaciones_docentes liquidaciones_docentes_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.liquidaciones_docentes
    ADD CONSTRAINT liquidaciones_docentes_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6611 (class 2606 OID 19525)
-- Name: liquidaciones_docentes liquidaciones_docentes_contrato_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.liquidaciones_docentes
    ADD CONSTRAINT liquidaciones_docentes_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES excelencia_seruna.contratos_docentes(id);


--
-- TOC entry 6612 (class 2606 OID 19530)
-- Name: liquidaciones_docentes liquidaciones_docentes_periodo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.liquidaciones_docentes
    ADD CONSTRAINT liquidaciones_docentes_periodo_id_fkey FOREIGN KEY (periodo_id) REFERENCES excelencia_seruna.periodos_liquidacion(id);


--
-- TOC entry 6613 (class 2606 OID 19535)
-- Name: liquidaciones_docentes liquidaciones_docentes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.liquidaciones_docentes
    ADD CONSTRAINT liquidaciones_docentes_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6662 (class 2606 OID 20172)
-- Name: lotes_importacion lotes_importacion_creado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.lotes_importacion
    ADD CONSTRAINT lotes_importacion_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6566 (class 2606 OID 18942)
-- Name: mapeos_siagie mapeos_siagie_competencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.mapeos_siagie
    ADD CONSTRAINT mapeos_siagie_competencia_id_fkey FOREIGN KEY (competencia_id) REFERENCES excelencia_seruna.competencias(id);


--
-- TOC entry 6567 (class 2606 OID 18937)
-- Name: mapeos_siagie mapeos_siagie_plantilla_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.mapeos_siagie
    ADD CONSTRAINT mapeos_siagie_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES excelencia_seruna.plantillas_siagie(id);


--
-- TOC entry 6580 (class 2606 OID 19186)
-- Name: marcaciones marcaciones_actor_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.marcaciones
    ADD CONSTRAINT marcaciones_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6581 (class 2606 OID 19191)
-- Name: marcaciones marcaciones_credencial_id_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.marcaciones
    ADD CONSTRAINT marcaciones_credencial_id_persona_id_fkey FOREIGN KEY (credencial_id, persona_id) REFERENCES excelencia_seruna.credenciales_qr(id, persona_id);


--
-- TOC entry 6582 (class 2606 OID 19181)
-- Name: marcaciones marcaciones_lector_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.marcaciones
    ADD CONSTRAINT marcaciones_lector_id_fkey FOREIGN KEY (lector_id) REFERENCES excelencia_seruna.lectores_qr(id);


--
-- TOC entry 6583 (class 2606 OID 19176)
-- Name: marcaciones marcaciones_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.marcaciones
    ADD CONSTRAINT marcaciones_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6471 (class 2606 OID 17661)
-- Name: matricula_secciones matricula_secciones_matricula_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matricula_secciones
    ADD CONSTRAINT matricula_secciones_matricula_id_anio_id_grado_id_fkey FOREIGN KEY (matricula_id, anio_id, grado_id) REFERENCES excelencia_seruna.matriculas(id, anio_id, grado_id);


--
-- TOC entry 6472 (class 2606 OID 17656)
-- Name: matricula_secciones matricula_secciones_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matricula_secciones
    ADD CONSTRAINT matricula_secciones_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6473 (class 2606 OID 17666)
-- Name: matricula_secciones matricula_secciones_seccion_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matricula_secciones
    ADD CONSTRAINT matricula_secciones_seccion_id_anio_id_grado_id_fkey FOREIGN KEY (seccion_id, anio_id, grado_id) REFERENCES excelencia_seruna.secciones(id, anio_id, grado_id);


--
-- TOC entry 6466 (class 2606 OID 17615)
-- Name: matriculas matriculas_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6467 (class 2606 OID 17610)
-- Name: matriculas matriculas_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_estudiante_id_fkey FOREIGN KEY (estudiante_id) REFERENCES excelencia_seruna.estudiantes(id);


--
-- TOC entry 6468 (class 2606 OID 17620)
-- Name: matriculas matriculas_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES excelencia_seruna.grados(id);


--
-- TOC entry 6469 (class 2606 OID 17625)
-- Name: matriculas matriculas_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6470 (class 2606 OID 17630)
-- Name: matriculas matriculas_regla_id_anio_id_grado_id_tipo_ingreso_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.matriculas
    ADD CONSTRAINT matriculas_regla_id_anio_id_grado_id_tipo_ingreso_fkey FOREIGN KEY (regla_id, anio_id, grado_id, tipo_ingreso) REFERENCES excelencia_seruna.reglas_matricula(id, anio_id, grado_id, tipo_ingreso);


--
-- TOC entry 6474 (class 2606 OID 17693)
-- Name: movimientos_matricula movimientos_matricula_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.movimientos_matricula
    ADD CONSTRAINT movimientos_matricula_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6475 (class 2606 OID 17688)
-- Name: movimientos_matricula movimientos_matricula_matricula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.movimientos_matricula
    ADD CONSTRAINT movimientos_matricula_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES excelencia_seruna.matriculas(id);


--
-- TOC entry 6476 (class 2606 OID 17698)
-- Name: movimientos_matricula movimientos_matricula_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.movimientos_matricula
    ADD CONSTRAINT movimientos_matricula_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6502 (class 2606 OID 18013)
-- Name: obligaciones_ingreso obligaciones_ingreso_condiciones_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.obligaciones_ingreso
    ADD CONSTRAINT obligaciones_ingreso_condiciones_id_fkey FOREIGN KEY (condiciones_id) REFERENCES excelencia_seruna.documentos_institucionales(id);


--
-- TOC entry 6503 (class 2606 OID 18018)
-- Name: obligaciones_ingreso obligaciones_ingreso_matricula_ingreso_id_estudiante_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.obligaciones_ingreso
    ADD CONSTRAINT obligaciones_ingreso_matricula_ingreso_id_estudiante_id_fkey FOREIGN KEY (matricula_ingreso_id, estudiante_id) REFERENCES excelencia_seruna.matriculas(id, estudiante_id);


--
-- TOC entry 6660 (class 2606 OID 20130)
-- Name: orden_merito orden_merito_cierre_anual_id_matricula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.orden_merito
    ADD CONSTRAINT orden_merito_cierre_anual_id_matricula_id_fkey FOREIGN KEY (cierre_anual_id, matricula_id) REFERENCES excelencia_seruna.cierres_anuales(id, matricula_id);


--
-- TOC entry 6661 (class 2606 OID 20125)
-- Name: orden_merito orden_merito_publicacion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.orden_merito
    ADD CONSTRAINT orden_merito_publicacion_id_fkey FOREIGN KEY (publicacion_id) REFERENCES excelencia_seruna.publicaciones_merito(id);


--
-- TOC entry 6617 (class 2606 OID 19605)
-- Name: pagos_docentes pagos_docentes_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos_docentes
    ADD CONSTRAINT pagos_docentes_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6618 (class 2606 OID 19600)
-- Name: pagos_docentes pagos_docentes_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos_docentes
    ADD CONSTRAINT pagos_docentes_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES excelencia_seruna.liquidaciones_docentes(id);


--
-- TOC entry 6619 (class 2606 OID 19610)
-- Name: pagos_docentes pagos_docentes_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos_docentes
    ADD CONSTRAINT pagos_docentes_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6512 (class 2606 OID 18178)
-- Name: pagos pagos_pagante_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos
    ADD CONSTRAINT pagos_pagante_persona_id_fkey FOREIGN KEY (pagante_persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6513 (class 2606 OID 18173)
-- Name: pagos pagos_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos
    ADD CONSTRAINT pagos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6514 (class 2606 OID 18168)
-- Name: pagos pagos_sesion_caja_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.pagos
    ADD CONSTRAINT pagos_sesion_caja_id_fkey FOREIGN KEY (sesion_caja_id) REFERENCES excelencia_seruna.sesiones_caja(id);


--
-- TOC entry 6608 (class 2606 OID 19490)
-- Name: periodos_liquidacion periodos_liquidacion_cerrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.periodos_liquidacion
    ADD CONSTRAINT periodos_liquidacion_cerrado_por_fkey FOREIGN KEY (cerrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6609 (class 2606 OID 19485)
-- Name: periodos_liquidacion periodos_liquidacion_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.periodos_liquidacion
    ADD CONSTRAINT periodos_liquidacion_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6534 (class 2606 OID 18509)
-- Name: plan_asignaturas plan_asignaturas_asignatura_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plan_asignaturas
    ADD CONSTRAINT plan_asignaturas_asignatura_id_fkey FOREIGN KEY (asignatura_id) REFERENCES excelencia_seruna.asignaturas(id);


--
-- TOC entry 6535 (class 2606 OID 18504)
-- Name: plan_asignaturas plan_asignaturas_plan_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plan_asignaturas
    ADD CONSTRAINT plan_asignaturas_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES excelencia_seruna.planes_estudio(id);


--
-- TOC entry 6536 (class 2606 OID 18526)
-- Name: plan_competencias plan_competencias_competencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plan_competencias
    ADD CONSTRAINT plan_competencias_competencia_id_fkey FOREIGN KEY (competencia_id) REFERENCES excelencia_seruna.competencias(id);


--
-- TOC entry 6537 (class 2606 OID 18521)
-- Name: plan_competencias plan_competencias_plan_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plan_competencias
    ADD CONSTRAINT plan_competencias_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES excelencia_seruna.planes_estudio(id);


--
-- TOC entry 6495 (class 2606 OID 17916)
-- Name: planes_cobro planes_cobro_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_cobro
    ADD CONSTRAINT planes_cobro_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6496 (class 2606 OID 17926)
-- Name: planes_cobro planes_cobro_condiciones_id_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_cobro
    ADD CONSTRAINT planes_cobro_condiciones_id_anio_id_fkey FOREIGN KEY (condiciones_id, anio_id) REFERENCES excelencia_seruna.documentos_institucionales(id, anio_id);


--
-- TOC entry 6497 (class 2606 OID 17921)
-- Name: planes_cobro planes_cobro_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_cobro
    ADD CONSTRAINT planes_cobro_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES excelencia_seruna.grados(id);


--
-- TOC entry 6532 (class 2606 OID 18487)
-- Name: planes_estudio planes_estudio_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_estudio
    ADD CONSTRAINT planes_estudio_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6533 (class 2606 OID 18492)
-- Name: planes_estudio planes_estudio_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.planes_estudio
    ADD CONSTRAINT planes_estudio_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES excelencia_seruna.grados(id);


--
-- TOC entry 6624 (class 2606 OID 19732)
-- Name: plantillas_documento plantillas_documento_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_documento
    ADD CONSTRAINT plantillas_documento_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6625 (class 2606 OID 19737)
-- Name: plantillas_documento plantillas_documento_archivo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_documento
    ADD CONSTRAINT plantillas_documento_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6626 (class 2606 OID 19742)
-- Name: plantillas_documento plantillas_documento_creada_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_documento
    ADD CONSTRAINT plantillas_documento_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6627 (class 2606 OID 19727)
-- Name: plantillas_documento plantillas_documento_tipo_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_documento
    ADD CONSTRAINT plantillas_documento_tipo_fkey FOREIGN KEY (tipo) REFERENCES excelencia_seruna.tipos_reporte(codigo);


--
-- TOC entry 6563 (class 2606 OID 18897)
-- Name: plantillas_siagie plantillas_siagie_archivo_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_siagie
    ADD CONSTRAINT plantillas_siagie_archivo_id_fkey FOREIGN KEY (archivo_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6564 (class 2606 OID 18907)
-- Name: plantillas_siagie plantillas_siagie_bimestre_id_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_siagie
    ADD CONSTRAINT plantillas_siagie_bimestre_id_anio_id_fkey FOREIGN KEY (bimestre_id, anio_id) REFERENCES excelencia_seruna.bimestres(id, anio_id);


--
-- TOC entry 6565 (class 2606 OID 18902)
-- Name: plantillas_siagie plantillas_siagie_seccion_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.plantillas_siagie
    ADD CONSTRAINT plantillas_siagie_seccion_id_anio_id_grado_id_fkey FOREIGN KEY (seccion_id, anio_id, grado_id) REFERENCES excelencia_seruna.secciones(id, anio_id, grado_id);


--
-- TOC entry 6571 (class 2606 OID 19021)
-- Name: politicas_asistencia politicas_asistencia_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.politicas_asistencia
    ADD CONSTRAINT politicas_asistencia_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6654 (class 2606 OID 20079)
-- Name: publicaciones_merito publicaciones_merito_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6655 (class 2606 OID 20089)
-- Name: publicaciones_merito publicaciones_merito_archivo_siagie_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_archivo_siagie_id_fkey FOREIGN KEY (archivo_siagie_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6656 (class 2606 OID 20084)
-- Name: publicaciones_merito publicaciones_merito_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES excelencia_seruna.grados(id);


--
-- TOC entry 6657 (class 2606 OID 20099)
-- Name: publicaciones_merito publicaciones_merito_publicado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_publicado_por_fkey FOREIGN KEY (publicado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6658 (class 2606 OID 20094)
-- Name: publicaciones_merito publicaciones_merito_registrado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6659 (class 2606 OID 20104)
-- Name: publicaciones_merito publicaciones_merito_regla_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.publicaciones_merito
    ADD CONSTRAINT publicaciones_merito_regla_id_anio_id_grado_id_fkey FOREIGN KEY (regla_id, anio_id, grado_id) REFERENCES excelencia_seruna.reglas_evaluacion(id, anio_id, grado_id);


--
-- TOC entry 6524 (class 2606 OID 18327)
-- Name: recibos_caja recibos_caja_emitido_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.recibos_caja
    ADD CONSTRAINT recibos_caja_emitido_por_fkey FOREIGN KEY (emitido_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6525 (class 2606 OID 18317)
-- Name: recibos_caja recibos_caja_pago_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.recibos_caja
    ADD CONSTRAINT recibos_caja_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES excelencia_seruna.pagos(id);


--
-- TOC entry 6526 (class 2606 OID 18322)
-- Name: recibos_caja recibos_caja_serie_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.recibos_caja
    ADD CONSTRAINT recibos_caja_serie_id_fkey FOREIGN KEY (serie_id) REFERENCES excelencia_seruna.series_recibos(id);


--
-- TOC entry 6633 (class 2606 OID 19850)
-- Name: reglas_evaluacion reglas_evaluacion_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_evaluacion
    ADD CONSTRAINT reglas_evaluacion_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6634 (class 2606 OID 19865)
-- Name: reglas_evaluacion reglas_evaluacion_aprobado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_evaluacion
    ADD CONSTRAINT reglas_evaluacion_aprobado_por_fkey FOREIGN KEY (aprobado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6635 (class 2606 OID 19860)
-- Name: reglas_evaluacion reglas_evaluacion_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_evaluacion
    ADD CONSTRAINT reglas_evaluacion_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6636 (class 2606 OID 19855)
-- Name: reglas_evaluacion reglas_evaluacion_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_evaluacion
    ADD CONSTRAINT reglas_evaluacion_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES excelencia_seruna.grados(id);


--
-- TOC entry 6464 (class 2606 OID 17572)
-- Name: reglas_matricula reglas_matricula_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_matricula
    ADD CONSTRAINT reglas_matricula_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6465 (class 2606 OID 17577)
-- Name: reglas_matricula reglas_matricula_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reglas_matricula
    ADD CONSTRAINT reglas_matricula_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES excelencia_seruna.grados(id);


--
-- TOC entry 6477 (class 2606 OID 17728)
-- Name: requisitos_matricula requisitos_matricula_regla_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.requisitos_matricula
    ADD CONSTRAINT requisitos_matricula_regla_id_fkey FOREIGN KEY (regla_id) REFERENCES excelencia_seruna.reglas_matricula(id);


--
-- TOC entry 6478 (class 2606 OID 17733)
-- Name: requisitos_matricula requisitos_matricula_tipo_documento_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.requisitos_matricula
    ADD CONSTRAINT requisitos_matricula_tipo_documento_id_fkey FOREIGN KEY (tipo_documento_id) REFERENCES excelencia_seruna.tipos_documento(id);


--
-- TOC entry 6500 (class 2606 OID 17987)
-- Name: responsables_economicos responsables_economicos_matricula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.responsables_economicos
    ADD CONSTRAINT responsables_economicos_matricula_id_fkey FOREIGN KEY (matricula_id) REFERENCES excelencia_seruna.matriculas(id);


--
-- TOC entry 6501 (class 2606 OID 17992)
-- Name: responsables_economicos responsables_economicos_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.responsables_economicos
    ADD CONSTRAINT responsables_economicos_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 6645 (class 2606 OID 19967)
-- Name: resultados_anuales_competencia resultados_anuales_competencia_calificacion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.resultados_anuales_competencia
    ADD CONSTRAINT resultados_anuales_competencia_calificacion_id_fkey FOREIGN KEY (calificacion_id) REFERENCES excelencia_seruna.calificaciones_competencia(id);


--
-- TOC entry 6646 (class 2606 OID 19977)
-- Name: resultados_anuales_competencia resultados_anuales_competencia_cierre_anual_id_plan_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.resultados_anuales_competencia
    ADD CONSTRAINT resultados_anuales_competencia_cierre_anual_id_plan_id_fkey FOREIGN KEY (cierre_anual_id, plan_id) REFERENCES excelencia_seruna.cierres_anuales(id, plan_id);


--
-- TOC entry 6647 (class 2606 OID 19982)
-- Name: resultados_anuales_competencia resultados_anuales_competencia_plan_id_competencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.resultados_anuales_competencia
    ADD CONSTRAINT resultados_anuales_competencia_plan_id_competencia_id_fkey FOREIGN KEY (plan_id, competencia_id) REFERENCES excelencia_seruna.plan_competencias(plan_id, competencia_id);


--
-- TOC entry 6648 (class 2606 OID 20033)
-- Name: resultados_anuales_competencia resultados_anuales_competencia_recuperacion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.resultados_anuales_competencia
    ADD CONSTRAINT resultados_anuales_competencia_recuperacion_id_fkey FOREIGN KEY (recuperacion_id) REFERENCES excelencia_seruna.evaluaciones_recuperacion(id);


--
-- TOC entry 6649 (class 2606 OID 19972)
-- Name: resultados_anuales_competencia resultados_anuales_competencia_resultado_anterior_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.resultados_anuales_competencia
    ADD CONSTRAINT resultados_anuales_competencia_resultado_anterior_id_fkey FOREIGN KEY (resultado_anterior_id) REFERENCES excelencia_seruna.resultados_anuales_competencia(id);


--
-- TOC entry 6517 (class 2606 OID 18233)
-- Name: reversiones_pago reversiones_pago_autorizado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago
    ADD CONSTRAINT reversiones_pago_autorizado_por_fkey FOREIGN KEY (autorizado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6620 (class 2606 OID 19642)
-- Name: reversiones_pago_docente reversiones_pago_docente_autorizado_por_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago_docente
    ADD CONSTRAINT reversiones_pago_docente_autorizado_por_fkey FOREIGN KEY (autorizado_por) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6621 (class 2606 OID 19637)
-- Name: reversiones_pago_docente reversiones_pago_docente_evidencia_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago_docente
    ADD CONSTRAINT reversiones_pago_docente_evidencia_id_fkey FOREIGN KEY (evidencia_id) REFERENCES excelencia_seruna.archivos(id);


--
-- TOC entry 6622 (class 2606 OID 19632)
-- Name: reversiones_pago_docente reversiones_pago_docente_pago_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago_docente
    ADD CONSTRAINT reversiones_pago_docente_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES excelencia_seruna.pagos_docentes(id);


--
-- TOC entry 6518 (class 2606 OID 18228)
-- Name: reversiones_pago reversiones_pago_pago_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.reversiones_pago
    ADD CONSTRAINT reversiones_pago_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES excelencia_seruna.pagos(id);


--
-- TOC entry 6561 (class 2606 OID 18865)
-- Name: revisiones_calificacion revisiones_calificacion_autor_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.revisiones_calificacion
    ADD CONSTRAINT revisiones_calificacion_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6562 (class 2606 OID 18860)
-- Name: revisiones_calificacion revisiones_calificacion_calificacion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.revisiones_calificacion
    ADD CONSTRAINT revisiones_calificacion_calificacion_id_fkey FOREIGN KEY (calificacion_id) REFERENCES excelencia_seruna.calificaciones_competencia(id);


--
-- TOC entry 6448 (class 2606 OID 17281)
-- Name: rol_permisos rol_permisos_permiso_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.rol_permisos
    ADD CONSTRAINT rol_permisos_permiso_id_fkey FOREIGN KEY (permiso_id) REFERENCES excelencia_seruna.permisos(id);


--
-- TOC entry 6449 (class 2606 OID 17276)
-- Name: rol_permisos rol_permisos_rol_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.rol_permisos
    ADD CONSTRAINT rol_permisos_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES excelencia_seruna.roles(id);


--
-- TOC entry 6540 (class 2606 OID 18573)
-- Name: seccion_planes_estudio seccion_planes_estudio_plan_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.seccion_planes_estudio
    ADD CONSTRAINT seccion_planes_estudio_plan_id_anio_id_grado_id_fkey FOREIGN KEY (plan_id, anio_id, grado_id) REFERENCES excelencia_seruna.planes_estudio(id, anio_id, grado_id);


--
-- TOC entry 6541 (class 2606 OID 18568)
-- Name: seccion_planes_estudio seccion_planes_estudio_seccion_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.seccion_planes_estudio
    ADD CONSTRAINT seccion_planes_estudio_seccion_id_anio_id_grado_id_fkey FOREIGN KEY (seccion_id, anio_id, grado_id) REFERENCES excelencia_seruna.secciones(id, anio_id, grado_id);


--
-- TOC entry 6462 (class 2606 OID 17537)
-- Name: secciones secciones_anio_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.secciones
    ADD CONSTRAINT secciones_anio_id_fkey FOREIGN KEY (anio_id) REFERENCES excelencia_seruna.anios_academicos(id);


--
-- TOC entry 6463 (class 2606 OID 17542)
-- Name: secciones secciones_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.secciones
    ADD CONSTRAINT secciones_grado_id_fkey FOREIGN KEY (grado_id) REFERENCES excelencia_seruna.grados(id);


--
-- TOC entry 6510 (class 2606 OID 18136)
-- Name: sesiones_caja sesiones_caja_caja_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_caja
    ADD CONSTRAINT sesiones_caja_caja_id_fkey FOREIGN KEY (caja_id) REFERENCES excelencia_seruna.cajas(id);


--
-- TOC entry 6511 (class 2606 OID 18141)
-- Name: sesiones_caja sesiones_caja_operador_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_caja
    ADD CONSTRAINT sesiones_caja_operador_id_fkey FOREIGN KEY (operador_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6549 (class 2606 OID 18738)
-- Name: sesiones_clase sesiones_clase_asignacion_id_curso_id_docente_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_asignacion_id_curso_id_docente_id_fkey FOREIGN KEY (asignacion_id, curso_id, docente_id) REFERENCES excelencia_seruna.asignaciones_docentes(id, curso_id, docente_id);


--
-- TOC entry 6550 (class 2606 OID 18723)
-- Name: sesiones_clase sesiones_clase_aula_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_aula_id_fkey FOREIGN KEY (aula_id) REFERENCES excelencia_seruna.aulas(id);


--
-- TOC entry 6551 (class 2606 OID 18733)
-- Name: sesiones_clase sesiones_clase_bloque_id_curso_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_bloque_id_curso_id_fkey FOREIGN KEY (bloque_id, curso_id) REFERENCES excelencia_seruna.bloques_horario(id, curso_id);


--
-- TOC entry 6552 (class 2606 OID 18728)
-- Name: sesiones_clase sesiones_clase_curso_id_seccion_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones_clase
    ADD CONSTRAINT sesiones_clase_curso_id_seccion_id_fkey FOREIGN KEY (curso_id, seccion_id) REFERENCES excelencia_seruna.cursos_seccion(id, seccion_id);


--
-- TOC entry 6452 (class 2606 OID 17333)
-- Name: sesiones sesiones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.sesiones
    ADD CONSTRAINT sesiones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6623 (class 2606 OID 19694)
-- Name: tipos_reporte tipos_reporte_permiso_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tipos_reporte
    ADD CONSTRAINT tipos_reporte_permiso_fkey FOREIGN KEY (permiso) REFERENCES excelencia_seruna.permisos(codigo);


--
-- TOC entry 6450 (class 2606 OID 17311)
-- Name: tokens_acceso tokens_acceso_emisor_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tokens_acceso
    ADD CONSTRAINT tokens_acceso_emisor_id_fkey FOREIGN KEY (emisor_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6451 (class 2606 OID 17306)
-- Name: tokens_acceso tokens_acceso_usuario_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tokens_acceso
    ADD CONSTRAINT tokens_acceso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6498 (class 2606 OID 17960)
-- Name: tramos_plan_cobro tramos_plan_cobro_concepto_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tramos_plan_cobro
    ADD CONSTRAINT tramos_plan_cobro_concepto_fkey FOREIGN KEY (concepto) REFERENCES excelencia_seruna.conceptos_cobro(codigo);


--
-- TOC entry 6499 (class 2606 OID 17965)
-- Name: tramos_plan_cobro tramos_plan_cobro_plan_id_anio_id_grado_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.tramos_plan_cobro
    ADD CONSTRAINT tramos_plan_cobro_plan_id_anio_id_grado_id_fkey FOREIGN KEY (plan_id, anio_id, grado_id) REFERENCES excelencia_seruna.planes_cobro(id, anio_id, grado_id);


--
-- TOC entry 6446 (class 2606 OID 17264)
-- Name: usuario_roles usuario_roles_rol_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.usuario_roles
    ADD CONSTRAINT usuario_roles_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES excelencia_seruna.roles(id);


--
-- TOC entry 6447 (class 2606 OID 17259)
-- Name: usuario_roles usuario_roles_usuario_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.usuario_roles
    ADD CONSTRAINT usuario_roles_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES excelencia_seruna.usuarios(id);


--
-- TOC entry 6445 (class 2606 OID 17221)
-- Name: usuarios usuarios_persona_id_fkey; Type: FK CONSTRAINT; Schema: excelencia_seruna; Owner: postgres
--

ALTER TABLE ONLY excelencia_seruna.usuarios
    ADD CONSTRAINT usuarios_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES excelencia_seruna.personas(id);


--
-- TOC entry 7072 (class 0 OID 0)
-- Dependencies: 515
-- Name: FUNCTION avanzar_lote_historico(p_lote bigint, p_actor bigint); Type: ACL; Schema: excelencia_seruna; Owner: postgres
--

REVOKE ALL ON FUNCTION excelencia_seruna.avanzar_lote_historico(p_lote bigint, p_actor bigint) FROM PUBLIC;


--
-- TOC entry 7073 (class 0 OID 0)
-- Dependencies: 478
-- Name: FUNCTION conciliar_fila_historica(p_lote bigint, p_entidad text, p_clave text, p_actor bigint, p_accion text, p_motivo text, p_destino bigint, p_codigo text, p_persona_existente bigint); Type: ACL; Schema: excelencia_seruna; Owner: postgres
--

REVOKE ALL ON FUNCTION excelencia_seruna.conciliar_fila_historica(p_lote bigint, p_entidad text, p_clave text, p_actor bigint, p_accion text, p_motivo text, p_destino bigint, p_codigo text, p_persona_existente bigint) FROM PUBLIC;


--
-- TOC entry 7074 (class 0 OID 0)
-- Dependencies: 586
-- Name: FUNCTION indicadores_dashboard(p_anio bigint, p_desde date, p_hasta date, p_bimestre bigint); Type: ACL; Schema: excelencia_seruna; Owner: postgres
--

REVOKE ALL ON FUNCTION excelencia_seruna.indicadores_dashboard(p_anio bigint, p_desde date, p_hasta date, p_bimestre bigint) FROM PUBLIC;


--
-- TOC entry 7075 (class 0 OID 0)
-- Dependencies: 674
-- Name: FUNCTION preparar_documento_reporte(p_uuid uuid, p_plantilla bigint, p_actor bigint, p_desde date, p_hasta date, p_matricula bigint, p_seccion bigint, p_bimestre bigint); Type: ACL; Schema: excelencia_seruna; Owner: postgres
--

REVOKE ALL ON FUNCTION excelencia_seruna.preparar_documento_reporte(p_uuid uuid, p_plantilla bigint, p_actor bigint, p_desde date, p_hasta date, p_matricula bigint, p_seccion bigint, p_bimestre bigint) FROM PUBLIC;


--
-- TOC entry 7076 (class 0 OID 0)
-- Dependencies: 642
-- Name: FUNCTION reporte_cuotas_al_corte(p_anio bigint, p_corte date); Type: ACL; Schema: excelencia_seruna; Owner: postgres
--

REVOKE ALL ON FUNCTION excelencia_seruna.reporte_cuotas_al_corte(p_anio bigint, p_corte date) FROM PUBLIC;


-- Completed on 2026-11-17 10:59:12

--
-- PostgreSQL database dump complete
--

\unrestrict CsGWvyCeYvOccGgvnGeNTDCmCxbk59Qk97spGTPNtTrLMFNdVGo9GzHVLyA5zjr

