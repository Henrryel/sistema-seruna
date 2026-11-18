# SERUNA — Sistema de Gestión Escolar (Perú, Primaria y Secundaria)

## Regla de oro: la base de datos es la fuente de verdad
- Base existente `excelencia_seruna` (PostgreSQL 18), restaurada desde `db/seruna_back.dump`. **No se modifica**:
  sin migraciones, sin tablas nuevas, sin cambiar CHECK/funciones/triggers, sin Prisma. La app se adapta a la base.
- Documentación real de la base en `docs/db/` (diccionario y ER por dominio, `funciones.md`, `triggers-y-vistas.md`,
  `permisos.md`). Léela antes de tocar un dominio. Tipos generados en `src/server/db/tipos.ts` (`npm run db:tipos`).
- **No dupliques reglas que ya viven en la base** (validaciones, cierres, recibos, marcaciones, auditoría por triggers).
  Llama a sus funciones (`registrar_marcacion`, `emitir_recibo_caja`, `preparar_exportacion_siagie`,
  `indicadores_dashboard`, `reporte_cuotas_al_corte`, `preparar_documento_reporte`, …) y deja que los triggers validen.
  Solo calcula en TypeScript lo que la base exige recibir ya calculado (p. ej. el estado `presente/tarde` que
  `validar_asistencia` verifica) usando exactamente la misma fórmula.

## Arquitectura: monolito modular en 3 capas
1. **Presentación** — `src/app/**`: páginas (Server Components que autorizan con `exigirPermisoPagina` /
   `exigirPortalPagina` y montan un componente cliente) y Route Handlers FINOS con `ruta()`/`rutaPublica()` de
   `src/server/http/ruta.ts`: CSRF → sesión → permiso/portal → Zod → servicio → JSON.
2. **Servicios** — `src/server/services/<modulo>/*.ts`: orquestan `transaccion()`, alcance de datos
   (`src/server/autorizacion/alcance.ts`), auditoría (`registrarBitacora`) y lanzan errores de dominio.
3. **Repositorios** — `src/server/repositories/<modulo>/*.ts`: ÚNICO lugar con Kysely/SQL. Siempre `db()` (toma la
   transacción en curso). Usan vistas y funciones SQL de la base.

- Esquemas Zod compartidos front/back en `src/esquemas/<modulo>/*.ts` (base común en `src/esquemas/comunes.ts`).
- Errores: `src/server/errores` (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`). Los errores de
  PostgreSQL (SQLSTATE y los 134 `RAISE EXCEPTION`, todos `P0001`) se traducen solos en `traducirErrorDb`
  (mapa generado en `mensajes-db.ts`). El mensaje de la base ya está en español y se muestra al usuario.
- Módulo de referencia completo (cópialo): años académicos → `src/esquemas/academico/anios.ts`,
  `src/server/repositories/academico/anios.ts`, `src/server/services/academico/anios.ts`,
  `src/app/api/admin/academico/anios/**`, `src/app/admin/academico/anios/{page,cliente}.tsx`.

## Autenticación y autorización
- Login por `usuarios.login`, Argon2id (PHC), sesión en `sesiones` (solo `token_hash` SHA-256, cookie httpOnly),
  activación/recuperación con `tokens_acceso` (`emitirTokenAcceso`, `canjearTokenAcceso`), respeta `usuarios.estado`.
- **Autoriza por PERMISO** (`ruta({ permiso: 'tesoreria.cobrar' })`, `exigirPermiso`), nunca por nombre de rol.
  Lista tipada en `src/lib/permisos.ts`.
- **Alcance de datos** (menores de edad, mínimo privilegio) en servicios:
  alumno → solo su registro (`estudianteDelActor`); apoderado → solo hijos con `estudiante_apoderado` vigente y
  `acceso_academico` / `acceso_economico` (`exigirAccesoEstudiante(actor, id, { portal: 'padre', tipo })`);
  docente → solo sus `asignaciones_docentes` (`exigirCursoDelDocente`, `exigirSeccionDelDocente`); admin → todo con
  permiso y **siempre auditado** (`registrarBitacora` dentro de la misma transacción).
- Portales `/admin`, `/docente`, `/estudiante`, `/padre` (layout propio en `src/app/<portal>/layout.tsx`). El portal se
  habilita por datos/permisos (`actor.portales`). APIs: `/api/admin/**`, `/api/docente/**`, `/api/estudiante/**`,
  `/api/padre/**` (estas reciben `estudianteId` y validan el vínculo).

## Convenciones
- Español (Perú) en código de dominio, UI y mensajes. Zona horaria `America/Lima` (la conexión la fija).
- Tipos de la base: ids `bigint` → `string`; `date` → `'YYYY-MM-DD'`; `timestamptz` → `Date`; `numeric` → `string`
  (no uses float para dinero); rangos (`daterange`) → texto `'[2026-03-01,2026-12-31)'` (usa `leerRangoFechas` y
  `rangoFechas` de `src/lib/formato.ts`). PK `GENERATED ALWAYS`: nunca envíes `id` al insertar.
- Historial inmutable: lo financiero, asistencia, calificaciones y planilla NO se borran ni se editan; se corrigen con
  ajustes, reversiones, rectificaciones (con motivo) o versiones nuevas, como exige la base.
- Idempotencia con UUID generado en el cliente (`pagos.clave_idempotencia`, `marcaciones.evento_uuid`,
  `documentos_emitidos.solicitud_uuid`).
- Listados: `responderListado()` (JSON paginado o `formato=xlsx|pdf` con los mismos filtros) + `<TablaDatos>` en el
  cliente (búsqueda, filtros, paginación, exportación). PDFs con `@react-pdf/renderer` sobre `src/server/pdf/base.tsx`;
  Excel con ExcelJS. Archivos: `guardarArchivo`/`leerArchivo` (`src/server/almacenamiento`), autorizando en el servicio.
- UI: shadcn/ui (`src/components/ui`), `TablaDatos`, `DialogoFormulario` + `Campo*`, `Confirmar` (con motivo),
  `BadgeNivelLogro`, `BadgeEstadoPago`, `BadgeEstado`, `EncabezadoPagina`, `EstadoVacio`, `Indicador`; selects con
  `useCatalogo(tipo)`; toasts con `sonner`. Mobile-first, modo claro/oscuro, accesible (labels, aria, contraste AA).
- Cliente HTTP: `api.get/post/put/patch/delete` de `src/lib/api.ts` (agrega la cabecera anti-CSRF `x-seruna: 1`).

## Pruebas
- Vitest de integración contra PostgreSQL real (`DATABASE_URL_TEST`, base restaurada del dump). Cada prueba corre en
  `enPrueba()` (transacción con ROLLBACK). Fixtures en `tests/fixtures/base.ts`; errores con `esperarError()`.
- Comandos: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Prohibido
- Modificar la base o el dump; SQL fuera de repositorios; autorizar por nombre de rol; guardar tokens o contraseñas en
  claro; borrar/editar registros financieros, de asistencia, calificaciones o planilla; exponer datos de otros alumnos.
