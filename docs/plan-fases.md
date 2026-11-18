# Plan por fases — Sistema de Gestión Escolar SERUNA

> **Actualización (decisión del cliente tras el Paso 0):** apego estricto a la base existente. **No hay migraciones
> ni cambios de esquema**; la conexión la configura el cliente (`DATABASE_URL`). En consecuencia quedan fuera el nivel
> Inicial (CHECK de `niveles`), la ampliación del CHECK de medios de pago (Yape/Plin se registran como
> `transferencia` con referencia) y el módulo de comunicados/mensajería (no hay tablas). Ver `README.md`.

Base: `seruna_db` (esquema `excelencia_seruna`) como fuente de verdad.

## Fase 0 — Restaurar e introspectar ✅ (esta entrega)
Dump en `db/`, `docker-compose.yml`, scripts de restauración (Docker y Windows) con verificación, generador
reproducible de `docs/db/` (diccionario y ER por dominio, funciones, triggers, vistas, permisos) y `docs/db/discrepancias.md`.

## Fase 1 — Setup, autenticación, permisos y auditoría
- Next.js (App Router) + TypeScript estricto, ESLint, Prettier, Tailwind + shadcn/ui, Vitest; `CLAUDE.md`, `README`, `.env.example`.
- Migración 0001: privilegios (reaplica los REVOKE del dump, grants mínimos al rol de la app). Script aparte para crear el rol de login sin superusuario.
- Kysely + `pg` (search_path `excelencia_seruna,public`, timezone `America/Lima`), tipos con kysely-codegen desde la base real.
- Capas: Route Handlers finos → servicios → repositorios (único lugar con SQL). Errores tipados y traductor de SQLSTATE/mensajes generado del catálogo, con prueba de cobertura.
- Auth: login por `usuarios.login`, Argon2id (PHC), sesiones con cookie httpOnly y `token_hash` SHA-256, activación y recuperación con `tokens_acceso`, estados pendiente/activo/suspendido, rate limiting, bitácora, CSRF y cabeceras seguras.
- Autorización por permiso, helpers de alcance (alumno, apoderado con accesos, docente por asignaciones), selector de rol y layouts `/admin`, `/docente`, `/estudiante`, `/padre`.
- Comando de creación del primer admin. Pruebas de integración de login, sesión, permisos y alcance.

## Fase 2 — CRUD admin: estructura académica, usuarios y matrícula
Años, bimestres, calendario, niveles/grados, secciones, aulas, planes, áreas, asignaturas, competencias, capacidades,
cursos, asignaciones, horarios. Personas, usuarios, roles, documentos de identidad, reseteo de acceso. Estudiantes,
apoderados (verificación y accesos), reglas y requisitos, matrícula y movimientos, expediente, ficha PDF.
Tablas con búsqueda, filtros, paginación y exportación Excel/PDF. Seeds idempotentes (catálogo CNEB, año demo con
4 bimestres, datos de ejemplo). Migración de Inicial si la autorizas.

## Fase 3 — Cobros y caja (+ vista de estudiante y padre)
Planes y tramos, emisión de cuotas, ajustes, pagos idempotentes, aplicaciones, recibos con serie
(`emitir_recibo_caja`), cajas y sesiones, reversiones y devoluciones. Morosidad (`reporte_cuotas_al_corte`) y
recaudación. Portal: semáforo, línea de tiempo, historial y recibo PDF. Yape/Plin (migración aditiva).

## Fase 4 — Evaluación por competencias, libretas y SIAGIE
Registro de calificaciones del docente (solo sus competencias), cierres, rectificaciones, publicación, reglas
versionadas, cierre anual y situación final, recuperación, mérito (conciliación SIAGIE), libreta PDF, exportación
SIAGIE a Excel sobre la plantilla oficial. `docs/normativa.md` con fuentes verificadas.

## Fase 5 — Asistencia QR y barras con PWA offline
Políticas, jornadas (generación masiva), lectores, credenciales QR (token hasheado y revocable), pantalla de escaneo
a pantalla completa con cámara, cola offline idempotente por UUID, retroalimentación visual y sonora, asistencia por
sesión, justificaciones. Carnets PDF masivos con QR + Code 128. Interfaz `AttendanceProvider` y `docs/privacidad.md`.

## Fase 6 — Personal y planilla
Contratos fijo/por horas, horas con aprobación, períodos, liquidaciones, detalle, descuentos por tardanza,
pagos y reversiones, boletas PDF.

## Fase 7 — Dashboards, comunicación y documentos
Dashboards por rol con `indicadores_dashboard`. Módulo de comunicación (migración: comunicados, mensajes
docente–padre, notificaciones). Plantillas, documentos emitidos con cola y worker, importación histórica.

## Fase 8 — Pulido, pruebas y documentación
Accesibilidad AA, modo oscuro, estados vacíos, pruebas de permisos/alcance, pagos, marcaciones, cierre de notas y
liquidación; README y guías.

## Fase 9 — Opcional: reconocimiento facial
Solo con consentimiento de los padres (Ley 29733), detrás de `AttendanceProvider`.
