# Discrepancias, dudas y decisiones pendientes (Paso 0)

Resultado de leer los 215 CHECK, 58 triggers, 43 funciones y 13 vistas contra el encargo.
Cada punto indica **qué dice la base**, **por qué importa** y **qué propongo**. Los marcados con 🔶 necesitan tu decisión.

## A. Entorno y archivos

1. 🔶 **Docker no está instalado** (tampoco WSL2, que Docker Desktop necesita). Restauré en el PostgreSQL 18.7 local
   (`D:\aplicaciones\PostgreSQL`, servicio `postgresql-x64-18`) como `seruna_db`. Dejé `docker-compose.yml` +
   `scripts/db-restore.sh` para Docker y `scripts/db-restore.ps1` para el Postgres local (probado: crea, rechaza si
   existe, `-Force` recrea y verifica).
   **Propuesta:** desarrollar y correr las pruebas de integración contra el Postgres local (bases `seruna_db` y
   `seruna_test`, esta última restaurada + migrada antes de cada corrida), manteniendo Docker como opción equivalente.
2. 🔶 El dump llegó como `seruna_back` (sin extensión) en la raíz; lo **copié** a `db/seruna_back.dump` (mismo SHA-256).
   `seruna_d3.sql` es el mismo dump en SQL plano (contenido idéntico sin contar comentarios). ¿Puedo borrar ambos de la raíz?
3. 🔶 La carpeta no es un repositorio git. Propongo `git init` antes de la Fase 1.
4. El servidor local usa `TimeZone = America/Bogota`; las funciones usan `America/Lima` explícitamente (ambas UTC−5 sin
   horario de verano). La app fijará `timezone = 'America/Lima'` en cada conexión.

## B. Cambios pedidos que NO pueden ser estrictamente aditivos

5. 🔶 **Nivel Inicial.** `niveles_codigo_check` solo admite `primaria` y `secundaria`. Agregar `inicial` exige
   reemplazar ese CHECK (`DROP CONSTRAINT` + `ADD CONSTRAINT`), lo que choca con "no borrar objetos existentes".
   Además: la escala A/B/C (sin AD) para Inicial se haría con un trigger **nuevo** sobre `calificaciones_competencia`
   (aditivo); `validar_cierre_evaluacion` exige conclusión descriptiva en C (todos los niveles) y en B solo para
   `primaria`, así que Inicial heredaría la regla de C únicamente. `grados.numero` admite 1–6: propongo 3, 4 y 5 (= edad).
   ¿Autorizas reemplazar ese CHECK como única excepción?
6. 🔶 **Yape y Plin.** `pagos_medio_check` = `efectivo, transferencia, tarjeta, otro`.
   **Propuesta 100 % aditiva:** registrar el pago con `medio = 'transferencia'` y una tabla nueva
   `pagos_billetera (pago_id PK, billetera CHECK IN ('yape','plin'), numero_operacion)`. Alternativa: reemplazar el CHECK.
7. **Privilegios.** El dump hace `REVOKE ALL ... FROM PUBLIC` sobre `avanzar_lote_historico`, `conciliar_fila_historica`,
   `indicadores_dashboard`, `preparar_documento_reporte` y `reporte_cuotas_al_corte`; con `--no-privileges` (obligatorio)
   ese REVOKE se pierde. La primera migración lo reaplica y otorga permisos mínimos al rol de la app (sin superusuario,
   sin DDL). La creación del rol de login y su contraseña irán en un script aparte (no en la migración).

## C. Datos y semillas

8. **No hay ningún usuario** (tampoco admin), así que el formato real de `contrasena_hash` no se puede confirmar con datos:
   es `text` sin restricción de formato (solo exige no vacío si el usuario está `activo`). **Propuesta:** Argon2id en
   formato PHC (`$argon2id$v=19$m=…,t=…,p=…$sal$hash`) y un comando para crear el primer admin con token de activación
   (`tokens_acceso.proposito = 'activacion'`), fuera de los seeds.
9. 🔶 **`reglas_evaluacion` está vacía:** no hay reglas sembradas que validar contra la normativa. Además `criterios` es
   `jsonb` libre (solo exige objeto no vacío). En la Fase 4 propondré el esquema de `criterios` con fuentes oficiales
   verificadas en `docs/normativa.md`, y te lo mostraré antes de sembrarlo.
10. Vacías y necesarias para operar: catálogo CNEB (áreas, competencias, capacidades), `tipos_documento`,
    `series_recibos`, `cajas`, `lectores_qr`, políticas de asistencia, planes de cobro → irán en seeds.
11. Las PK son `GENERATED ALWAYS AS IDENTITY`: los seeds serán idempotentes por clave natural (código, login, año…),
    nunca fijando ids.

## D. Reglas de la base que condicionan el diseño

12. 🔶 **Marcación ≠ asistencia.** `registrar_marcacion` solo inserta en `marcaciones`; no crea ni actualiza
    `asistencia_estudiantes`/`asistencia_docentes`. Luego `validar_asistencia` **verifica** (no calcula) que el estado
    `presente`/`tarde` coincida con la tolerancia de la política. Para no duplicar la regla en TypeScript propongo una
    **función SQL nueva** (aditiva) `registrar_asistencia_por_marcacion(marcacion_id, actor)` que ubique la jornada del día,
    calcule el estado y haga el upsert; la app solo la llama.
13. Las jornadas (`jornadas_seccion`, `jornadas_docente`) son por fecha: hará falta una herramienta de generación masiva
    (desde `calendario_escolar` lectivo y políticas). `asistencia_*.motivo` es obligatorio incluso en registros automáticos
    (se usará p. ej. "Marcación QR").
14. **Errores:** las 134 excepciones de negocio son `P0001` sin `ERRCODE`. La traducción a NotFound/Forbidden/Validation/
    Conflict será por texto exacto del mensaje, con una prueba que falle si un mensaje cambia o aparece uno nuevo.
    `conservar_evento_asistencia` se reutiliza en `conciliaciones_historicas` y `equivalencias_historicas` con un mensaje
    que habla de asistencia: la app lo traducirá según la tabla.
15. 🔶 **Cuotas solo para matrícula `activa`** y replicando exactamente un tramo de un plan **publicado** (que exige un
    documento de condiciones económicas con archivo). Es decir, la cuota de matrícula se emite **después** de confirmar
    la matrícula. ¿Es ese el flujo del colegio? Además, la matrícula no puede superar la pensión de referencia.
16. **Matrícula sin máquina de estados en la base:** no hay triggers sobre `matriculas` ni `movimientos_matricula`. Los
    servicios orquestarán cada movimiento (retiro/traslado/cambio de sección = cerrar vigencia en `matricula_secciones`
    + estado + movimiento) en una transacción.
17. 🔶 **Orden de mérito:** la base no lo calcula. `publicaciones_merito` exige archivo y referencia **SIAGIE**, el permiso
    dice "Conciliar y publicar el listado oficial de SIAGIE", `orden_merito.calificativo` va de 2.5 a 10 y solo aplica
    a Secundaria (alcance `secundaria_completa` solo en 5.º). **Propuesta:** la app importa y concilia el listado de
    SIAGIE (no lo calcula). ¿Confirmas? ¿Sabes de dónde sale la escala 2.5–10?
18. **Situación final:** la base valida coherencia del cierre anual pero no decide promovido/recuperación/permanencia;
    la app aplicará los `criterios` de la regla aprobada y la base lo verificará.
19. 🔶 **Documentos PDF:** `tipos_reporte` solo tiene 7 tipos y `preparar_documento_reporte` falla con "Tipo de reporte sin
    consulta implementada" para cualquier otro. **Propuesta:** libreta/boletín = tipo `notas` filtrado por matrícula
    (ya lo admite); recibo, boleta de pago docente, ficha y carnets QR = PDF generado al vuelo por los servicios
    (documentos livianos), sin pasar por `documentos_emitidos`.
20. 🔶 **Cola de reportes:** `documentos_emitidos` ya es una cola (estado `preparado` + índice parcial
    `documentos_emitidos_cola_idx`). **Propuesta:** usarla como cola de reportes con un worker (`FOR UPDATE SKIP LOCKED`)
    y no instalar pg-boss, que crea su propio esquema `pgboss` fuera de nuestras migraciones. Si prefieres pg-boss igual,
    lo aislamos en ese esquema.
21. **Permisos:** el docente tiene `academico.calificar` y `asistencia.registrar`, pero no `reportes.academico`
    (no puede emitir informes de notas por la función de la base). Alumno y apoderado casi no tienen permisos
    (`asistencia.justificar`, `familia.consultar`): el acceso "a lo propio" se resolverá por **alcance** en servicios.
    El módulo de comunicación necesitará permisos nuevos (migración).
22. `registrar_marcacion` no verifica `asistencia.marcar` (solo que el operador esté activo): lo verificará la app.
    El escáner de puerta operará con una cuenta con ese permiso y un `lectores_qr` registrado.
23. **QR/barras:** `credenciales_qr.token_hash` es SHA-256 de 32 bytes. El QR y el Code 128 llevarán el mismo token en
    texto alfanumérico (compatible con lectores USB que "teclean"); solo se guarda el hash. La revocación es por credencial.
24. 🔶 **Planilla — descuentos por tardanza:** la base no define la regla; se registran como líneas `descuento` de
    `detalle_liquidacion_docente`. **Propuesta:** minutos de tardanza = entrada − (inicio de jornada + tolerancia),
    excluyendo justificadas; valor por minuto = sueldo / minutos programados del mes (fijo) o tarifa / minutos_por_hora
    (por horas). ¿Te sirve o usan un monto fijo por tardanza?
25. La planilla solo cubre **docentes** (no hay tablas para personal administrativo).
26. `comprobantes_externos` registra comprobantes SUNAT emitidos fuera del sistema; no hay integración con OSE/PSE (fuera de alcance salvo que lo pidas).
27. 🔶 **Importación histórica:** las entidades (`estudiantes`, `profesores`, `cursos`, `notas_bimestre`, `registros_asistencia`…)
    sugieren un sistema anterior concreto. ¿Tienes esos datos y en qué formato? Si no, el módulo queda listo sin carga real.
28. **Rate limiting de login:** no hay tabla de intentos; usaré `bitacora` (acción `login`, resultado `fallido`) más un
    limitador en memoria. `bitacora` no guarda IP ni agente de usuario.

## E. Normativa (para la Fase 4)

29. Lo que la base ya codifica: niveles AD/A/B/C, conclusión descriptiva obligatoria en C (y en B en Primaria),
    4 bimestres, situación final promovido/recuperación/permanencia, recuperación y subsanación, mérito solo en Secundaria.
    La correspondencia con RVM 094-2020-MINEDU, RVM 048-2024-MINEDU y RM 556-2024-MINEDU la verificaré con las fuentes
    oficiales en la Fase 4 y la documentaré en `docs/normativa.md`; si algo no coincide, te lo reportaré antes de tocar nada.
