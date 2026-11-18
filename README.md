# SERUNA · Sistema de Gestión Escolar

Sistema web para un colegio peruano (Primaria y Secundaria) construido **sobre la base de datos existente**
`excelencia_seruna` (PostgreSQL 18), que es la fuente de verdad: la app no modifica el esquema y delega en la base
sus reglas (CHECK, EXCLUDE, 58 triggers y 43 funciones).

Portales con layout propio: **Administración** (`/admin`), **Docente** (`/docente`), **Estudiante** (`/estudiante`),
**Padres de familia** (`/padre`) y la **pantalla de escaneo** de la puerta (`/escaner`, PWA).

## Stack

Next.js 15 (App Router) · TypeScript estricto · Route Handlers como API · Kysely + kysely-codegen (tipos desde la base
real) · `pg` · Zod compartido front/back · TanStack Query · React Hook Form · Tailwind 4 + shadcn/ui · Recharts ·
ExcelJS · @react-pdf/renderer · bwip-js (QR y Code 128) · Argon2id (@node-rs/argon2) · Vitest (integración contra
PostgreSQL real).

## Conectar a su base de datos

1. Requisitos: Node.js ≥ 20.18 y la base restaurada desde `db/seruna_back.dump`
   (`scripts/db-restore.ps1` en Windows con PostgreSQL local, o `scripts/db-restore.sh` con Docker; ver `docs/db/README.md`).
2. `npm install`
3. Copie `.env.example` a `.env.local` y complete al menos `DATABASE_URL` y `APP_URL`.
   La app fija por conexión `search_path=excelencia_seruna,public` y `timezone=America/Lima`.
   - Recomendado: conectar con un rol **sin superusuario**. Plantilla opcional para su DBA: `scripts/db/rol-app.sql`
     (crea `seruna_app`, otorga solo DML/EXECUTE y reaplica los `REVOKE` del dump original).
4. Cree el primer administrador (queda pendiente y recibe un enlace para crear su contraseña):
   ```bash
   npm run admin:crear -- --login admin --nombres "Nombre" --apellidos "Apellidos" --dni 12345678
   ```
5. `npm run dev` (desarrollo) o `npm run build && npm start` (producción). Abra `APP_URL` e ingrese con el enlace.

Si cambia la base (otra versión del dump), regenere: `npm run db:tipos` (tipos Kysely), `scripts/db-docs.ps1`
(documentación y `docs/db/catalogo.json`) y `npm run db:errores` (traducción de mensajes de error).

## Datos de demostración (opcional, nunca en producción)

```bash
npm run demo:sembrar -- --confirmar
```

Inserta (sin tocar el esquema y pasando todas las validaciones de la base) el catálogo CNEB, un año con 4 bimestres,
2 secciones, 2 docentes (fijo y por horas), 5 alumnos, 3 apoderados, matrículas, cuotas, pagos con recibo,
asistencias variadas, notas publicadas y horas docentes. Es idempotente y se niega a correr con
`NODE_ENV=production` o si el año ya tiene matrículas reales. Las cuentas `demo.*` y su contraseña están en
`scripts/sembrar-demo.ts`. Con `--solo-catalogo` siembra solo el catálogo CNEB y los tipos de documento.

## Arquitectura (monolito modular en 3 capas)

```
src/app/                    Presentación: páginas por portal + Route Handlers finos (src/app/api/**)
src/server/services/        Servicios: transacciones, alcance de datos, auditoría, errores de dominio
src/server/repositories/    Repositorios: ÚNICO lugar con Kysely/SQL (vistas y funciones de la base)
src/server/{auth,autorizacion,http,errores,db,pdf,exportacion,almacenamiento}/   Infraestructura común
src/esquemas/               Esquemas Zod compartidos front/back
src/components/             UI (shadcn/ui, TablaDatos, formularios, layout por portal)
docs/db/                    Documentación generada de la base real (diccionario, ER, funciones, triggers, permisos)
tests/                      Pruebas de integración contra PostgreSQL (cada prueba hace ROLLBACK)
```

Reglas detalladas para desarrollar: [`CLAUDE.md`](CLAUDE.md).

## Seguridad

- Login por `usuarios.login`, contraseñas Argon2id (PHC), sesiones en `sesiones` guardando solo SHA-256 del token
  (cookie httpOnly, SameSite=Lax, `__Host-` y Secure en producción), activación y recuperación con `tokens_acceso`
  de un solo uso, respeto de `usuarios.estado`, límite de intentos (memoria + `bitacora`) y bloqueo temporal.
- Autorización por **permiso** (`rol_permisos → permisos`), nunca por nombre de rol; alcance de datos en servicios
  (alumno: lo propio; apoderado: hijos con vínculo vigente según `acceso_academico`/`acceso_economico`; docente: sus
  asignaciones). Toda acción administrativa queda en `bitacora`.
- CSRF: las mutaciones exigen la cabecera `x-seruna: 1` y origen del mismo sitio. Cabeceras seguras (CSP, HSTS en
  producción, `frame-ancestors 'none'`, `nosniff`, Permissions-Policy). Validación Zod en cada endpoint.
- Errores de PostgreSQL (SQLSTATE y los 134 `RAISE EXCEPTION`) traducidos a errores tipados con su mensaje en español.

## Pruebas y calidad

```bash
# Base de pruebas restaurada desde el dump (las pruebas no dejan datos: todo se revierte)
.\scripts\db-restore.ps1 -DbName seruna_test
$env:DATABASE_URL_TEST = 'postgres://usuario@localhost:5432/seruna_test'   # contraseña en PGPASSWORD/PGPASSFILE
npm test
npm run typecheck
npm run lint
```

Estado actual: 115 pruebas de integración en 30 archivos (identidad, estructura académica, matrícula, cobros,
evaluación, asistencia, planilla, dashboards, reportes e importación), `tsc` y ESLint sin errores, `next build` con
134 rutas.

Documentos complementarios: `docs/normativa.md` (reglas de evaluación; los puntos **[VERIFICAR]** deben contrastarse
con el texto oficial) y `docs/privacidad.md` (datos de menores y biométricos, Ley 29733; revisión legal pendiente).

## Decisiones por apego a la base (sin cambios de esquema)

- **Nivel Inicial**: no habilitado; la base solo admite `primaria` y `secundaria` (`niveles_codigo_check`).
- **Yape / Plin**: se registran como medio `transferencia` con la referencia `Yape: <n.º de operación>` o `Plin: …`.
- **Comunicados y mensajería docente–padre**: no hay tablas para ello; solo se registran las comunicaciones de
  documentos institucionales (`comunicaciones_documento`).
- **Orden de mérito**: la base no lo calcula; se registra y publica el listado oficial de SIAGIE.
- **Cola de reportes pesados**: `documentos_emitidos` (estado `preparado`) procesada por un worker interno
  (`WORKER_REPORTES=1`), sin pg-boss.
- **Recuperación de contraseña**: no hay correo configurado; la solicitud queda en `bitacora` y secretaría emite el
  enlace desde *Usuarios y accesos*.
