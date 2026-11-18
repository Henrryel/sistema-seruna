# Base de datos `seruna_db` — Paso 0: restauración e introspección

La base existente es la **fuente de verdad**. Esta carpeta documenta lo que realmente contiene,
leído del catálogo de PostgreSQL tras restaurar el dump (no de suposiciones).

## Origen del dump

| Dato | Valor |
|---|---|
| Archivo | `db/seruna_back.dump` (copia byte a byte de `seruna_back`, SHA-256 `C79DFC1B…4056DE`) |
| Formato | pg_dump *custom*, gzip, 943 entradas de TOC, creado 2026-11-17 09:48:50 |
| Versión | PostgreSQL 18.7 (dump y servidor) |
| Esquema | `excelencia_seruna` + extensión `btree_gist` (en `public`) |
| Equivalente plano | `seruna_d3.sql` (raíz) tiene **el mismo contenido** que el dump: comparados ignorando comentarios, 5136 líneas idénticas |

## Restauración verificada

Restaurado en el PostgreSQL 18.7 local (servicio Windows `postgresql-x64-18`, puerto 5432) como `seruna_db`,
con `pg_restore --no-owner --no-privileges --exit-on-error` sobre una base creada con `template0`/UTF8 (sin `-C`).

| Objeto | Esperado | Obtenido |
|---|---|---|
| Tablas | 95 | 95 |
| Vistas | 13 | 13 |
| Funciones | 43 | 43 |
| Triggers | 58 | 58 |
| Extensión `btree_gist` | sí | sí |
| Restricciones CHECK / FK / EXCLUDE | — | 215 / 229 / 16 |
| Semillas | roles 4, permisos 32, rol_permisos 37, niveles 2, grados 11, conceptos_cobro 3, tipos_reporte 7 | idem |

Las otras 88 tablas están vacías (sin datos de negocio, sin usuarios).

## Cómo reproducir

| Entorno | Restaurar | Regenerar esta documentación |
|---|---|---|
| Docker (`docker-compose.yml`, `postgres:18`, puerto 5433) | `scripts/db-restore.sh [--force]` | `scripts/db-docs.sh` |
| PostgreSQL local de Windows | `.\scripts\db-restore.ps1 [-DbName x] [-Force]` | `.\scripts\db-docs.ps1` |

La contraseña nunca va en los scripts: use `PGPASSWORD` o `PGPASSFILE` (Windows) o `POSTGRES_PASSWORD` en `.env` (Docker).
`scripts/db/verificar-restauracion.sql` falla si falta cualquier objeto o semilla.

## Documentos

| | Documento | Contenido |
|---|---|---|
| (a)+(b) | [`dominios/`](dominios) | Por dominio: diagrama ER en Mermaid + diccionario de tablas y columnas con CHECK, FK, UNIQUE, EXCLUDE, índices y triggers |
| (c) | [`funciones.md`](funciones.md) | 43 funciones: firma, tipo, propósito, tablas que leen/escriben, errores que lanzan y catálogo de 134 mensajes con traducción propuesta |
| (d) | [`triggers-y-vistas.md`](triggers-y-vistas.md) | 58 triggers por dominio y 13 vistas con columnas, fuentes y definición |
| (e) | [`permisos.md`](permisos.md) | Matriz rol → permiso, tipos de reporte y permisos verificados por la base |
| | [`discrepancias.md`](discrepancias.md) | **Dudas y decisiones pendientes de confirmación** |
| | [`catalogo.json`](catalogo.json) | Catálogo crudo (entrada del generador y de la Fase 1) |

Dominios: [identidad y permisos](dominios/01-identidad-permisos.md) (10 tablas) ·
[matrícula](dominios/02-matricula.md) (12) · [académico y evaluación](dominios/03-academico-evaluacion.md) (32) ·
[asistencia](dominios/04-asistencia.md) (9) · [cobros](dominios/05-cobros.md) (15) ·
[personal y planilla](dominios/06-personal-planilla.md) (8) · [documentos y reportes](dominios/07-documentos-reportes.md) (5) ·
[importación histórica](dominios/08-importacion-historica.md) (4).

## Convenciones observadas (a respetar en migraciones nuevas)

- Nombres en español, `snake_case`; tablas en plural; fechas `*_en` (`timestamptz`) y `fecha`/`inicio`/`fin` (`date`).
- PK `bigint GENERATED ALWAYS AS IDENTITY` (los seeds no pueden fijar ids: deben ser idempotentes por clave natural).
- Importes `numeric(12,2)` (tarifa por hora `numeric(12,4)`); moneda implícita PEN.
- Vigencias con `daterange`/`tsrange` acotados y `EXCLUDE USING gist` para impedir solapes (requiere `btree_gist`).
- **FK compuestas** que arrastran `anio_id`/`grado_id` (o `estudiante_id`) para garantizar coherencia entre año, grado y matrícula.
- Estados en `text` con `CHECK (estado = ANY (...))` y CHECK de coherencia entre estado y columnas (`aprobado_por`/`aprobado_en`, etc.).
- Historial inmutable: lo financiero, la asistencia, las calificaciones y la planilla no se borran ni se sobrescriben; se corrige con ajustes, reversiones, rectificaciones o nuevas versiones.
- Idempotencia por UUID: `pagos.clave_idempotencia`, `pagos_docentes.clave_idempotencia`, `marcaciones.evento_uuid`, `documentos_emitidos.solicitud_uuid`.
- Funciones con `SET search_path TO 'excelencia_seruna', 'public'` y zona horaria explícita `America/Lima`.
- Errores de negocio con `RAISE EXCEPTION 'mensaje'` sin `ERRCODE` (SQLSTATE `P0001`); auditoría en `bitacora` vía triggers `AFTER`.
- Bloqueo de fila por `UPDATE ... SET x = x` (por eso los triggers de inmutabilidad dejan pasar un UPDATE sin cambios).
