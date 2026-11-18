<!-- Archivo generado por scripts/db/generar-docs.mjs a partir del catálogo real. No editar a mano. -->

# Triggers (58) y vistas (13)

PostgreSQL ejecuta los triggers de una misma tabla y momento en **orden alfabético por nombre**. Los `BEFORE` validan o normalizan (`controlar_*`, `preservar_*`, `conservar_*`, `proteger_*`); los `AFTER` auditan en `bitacora` o propagan (`aplicar_justificacion`).

## Triggers por dominio

### Matrícula, familia y expediente

| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |
|---|---|---|---|---|---|---|
| [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones) | `controlar_cupo` | BEFORE | INSERT OR UPDATE OF seccion_id, anio_id, vigencia, tipo_vacante |  | [`validar_ocupacion_seccion`](funciones.md#validar_ocupacion_seccion) | Sección activa; vigencia dentro del año; controla cupo total y vacantes regulares vs. reservadas en cada fecha de inicio solapada. |

### Académico y evaluación

| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |
|---|---|---|---|---|---|---|
| [`asignaciones_docentes`](dominios/03-academico-evaluacion.md#asignaciones_docentes) | `controlar_asignacion` | BEFORE | INSERT OR UPDATE |  | [`validar_vigencia_horario`](funciones.md#validar_vigencia_horario) | La fecha o vigencia (asignación, bloque o sesión) debe estar dentro del plan de la sección y, salvo en asignaciones, dentro de la asignación docente. |
| [`bloques_horario`](dominios/03-academico-evaluacion.md#bloques_horario) | `controlar_bloque` | BEFORE | INSERT OR UPDATE |  | [`validar_vigencia_horario`](funciones.md#validar_vigencia_horario) | La fecha o vigencia (asignación, bloque o sesión) debe estar dentro del plan de la sección y, salvo en asignaciones, dentro de la asignación docente. |
| [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia) | `auditar_calificacion` | AFTER | UPDATE |  | [`registrar_revision_calificacion`](funciones.md#registrar_revision_calificacion) | Guarda la versión anterior y la nueva (jsonb) de una calificación con autor y motivo en revisiones_calificacion. |
| [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia) | `conservar_calificacion` | BEFORE | DELETE |  | [`conservar_calificacion`](funciones.md#conservar_calificacion) | Prohíbe borrar calificaciones; las correcciones se hacen por rectificación (UPDATE con motivo). |
| [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia) | `controlar_calificacion` | BEFORE | INSERT OR UPDATE |  | [`validar_calificacion`](funciones.md#validar_calificacion) | Identidad inmutable; rectificar exige motivo y cierre en borrador; la matrícula debe estar en la sección del cierre con ese plan durante el bimestre. |
| [`cierres_anuales`](dominios/03-academico-evaluacion.md#cierres_anuales) | `auditar_cierre_anual` | AFTER | UPDATE | `(old.estado <> new.estado)` | [`auditar_cierre_academico`](funciones.md#auditar_cierre_academico) | Registra en bitácora la aprobación de cierres anuales y recuperaciones, y la publicación del mérito. |
| [`cierres_anuales`](dominios/03-academico-evaluacion.md#cierres_anuales) | `controlar_cierre_anual` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`controlar_cierre_anual`](funciones.md#controlar_cierre_anual) | Cierre anual: nace en borrador; aprobado es inmutable. Al aprobar exige regla aprobada, trayectoria de versiones válida, matrícula confirmada en sección/plan al fin del 4.º bimestre, 4 bimestres, bimestres cursados publicados, resultados de todas las competencias del plan, coherencia de situación/etapa de recuperación y que coincida con los últimos logros publicados. |
| [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion) | `controlar_cierre` | BEFORE | INSERT OR UPDATE |  | [`validar_cierre_evaluacion`](funciones.md#validar_cierre_evaluacion) | Nace en borrador; contexto inmutable; reabrir se audita; publicar exige estar cerrado; cerrar/publicar exige notas sin pendientes, conclusión descriptiva en C (y en B para Primaria) y todas las competencias del plan para toda la nómina al fin del bimestre. |
| [`evaluaciones_recuperacion`](dominios/03-academico-evaluacion.md#evaluaciones_recuperacion) | `auditar_recuperacion` | AFTER | UPDATE | `(old.estado <> new.estado)` | [`auditar_cierre_academico`](funciones.md#auditar_cierre_academico) | Registra en bitácora la aprobación de cierres anuales y recuperaciones, y la publicación del mérito. |
| [`evaluaciones_recuperacion`](dominios/03-academico-evaluacion.md#evaluaciones_recuperacion) | `controlar_evaluacion_recuperacion` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`controlar_evaluacion_recuperacion`](funciones.md#controlar_evaluacion_recuperacion) | Recuperación: nace en borrador, se aprueba sin cambiar contenido y no se borra; exige competencia pendiente en un cierre anual aprobado y fecha ≥ fecha de corte. |
| [`orden_merito`](dominios/03-academico-evaluacion.md#orden_merito) | `controlar_puesto_merito` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`controlar_puesto_merito`](funciones.md#controlar_puesto_merito) | Puestos: sin UPDATE (reemplazar), solo con la publicación sin publicar; el puesto apunta a un cierre anual aprobado no de recuperación del mismo año y grado. |
| [`publicaciones_merito`](dominios/03-academico-evaluacion.md#publicaciones_merito) | `auditar_merito` | AFTER | UPDATE | `(old.publicado_en IS DISTINCT FROM new.publicado_en)` | [`auditar_cierre_academico`](funciones.md#auditar_cierre_academico) | Registra en bitácora la aprobación de cierres anuales y recuperaciones, y la publicación del mérito. |
| [`publicaciones_merito`](dominios/03-academico-evaluacion.md#publicaciones_merito) | `controlar_publicacion_merito` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`controlar_publicacion_merito`](funciones.md#controlar_publicacion_merito) | Mérito: nace sin publicar; publicado es inmutable (versionar). Solo Secundaria con regla aprobada (alcance secundaria_completa solo en 5.º). Al publicar exige puestos consecutivos desde 1. |
| [`reglas_evaluacion`](dominios/03-academico-evaluacion.md#reglas_evaluacion) | `proteger_regla_evaluacion` | BEFORE | DELETE OR UPDATE |  | [`proteger_regla_evaluacion`](funciones.md#proteger_regla_evaluacion) | Una regla de evaluación aprobada no se modifica ni se borra: se versiona. |
| [`resultados_anuales_competencia`](dominios/03-academico-evaluacion.md#resultados_anuales_competencia) | `controlar_resultado_anual` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`controlar_resultado_anual`](funciones.md#controlar_resultado_anual) | Resultados anuales: sin UPDATE, solo con el cierre en borrador; copia nivel y conclusión desde la fuente (último logro publicado, recuperación aprobada o resultado anterior) ignorando lo enviado. |
| [`seccion_planes_estudio`](dominios/03-academico-evaluacion.md#seccion_planes_estudio) | `controlar_plan_seccion` | BEFORE | INSERT OR UPDATE |  | [`validar_plan_seccion`](funciones.md#validar_plan_seccion) | El plan asignado a la sección debe estar publicado y su vigencia dentro del año escolar. |
| [`sesiones_clase`](dominios/03-academico-evaluacion.md#sesiones_clase) | `controlar_sesion` | BEFORE | INSERT OR UPDATE |  | [`validar_vigencia_horario`](funciones.md#validar_vigencia_horario) | La fecha o vigencia (asignación, bloque o sesión) debe estar dentro del plan de la sección y, salvo en asignaciones, dentro de la asignación docente. |

### Asistencia de alumnos y docentes

| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |
|---|---|---|---|---|---|---|
| [`asistencia_docentes`](dominios/04-asistencia.md#asistencia_docentes) | `auditar_asistencia_docente` | AFTER | INSERT OR UPDATE |  | [`auditar_asistencia`](funciones.md#auditar_asistencia) | Registra en bitácora el estado de asistencia (o la transición anterior → nueva) con el actor registrado_por. |
| [`asistencia_docentes`](dominios/04-asistencia.md#asistencia_docentes) | `conservar_asistencia_docente` | BEFORE | DELETE |  | [`conservar_evento_asistencia`](funciones.md#conservar_evento_asistencia) | Prohíbe la operación ("solo inserción"). Se reutiliza en marcaciones, asistencia y justificaciones (DELETE) y también en conciliaciones_historicas y equivalencias_historicas, aunque el mensaje mencione asistencia. |
| [`asistencia_docentes`](dominios/04-asistencia.md#asistencia_docentes) | `controlar_asistencia_docente` | BEFORE | INSERT OR UPDATE |  | [`validar_asistencia`](funciones.md#validar_asistencia) | Contexto inmutable; matrícula confirmada en la sección y jornada programada (y sesión no cancelada); "justificado" solo con justificación aprobada; marcaciones de la misma persona, día y ventanas de la política; "ausente" sin entrada; presencia sin marcación solo si la política admite manual; "tarde" debe coincidir con la tolerancia. |
| [`asistencia_estudiantes`](dominios/04-asistencia.md#asistencia_estudiantes) | `auditar_asistencia_estudiante` | AFTER | INSERT OR UPDATE |  | [`auditar_asistencia`](funciones.md#auditar_asistencia) | Registra en bitácora el estado de asistencia (o la transición anterior → nueva) con el actor registrado_por. |
| [`asistencia_estudiantes`](dominios/04-asistencia.md#asistencia_estudiantes) | `conservar_asistencia_estudiante` | BEFORE | DELETE |  | [`conservar_evento_asistencia`](funciones.md#conservar_evento_asistencia) | Prohíbe la operación ("solo inserción"). Se reutiliza en marcaciones, asistencia y justificaciones (DELETE) y también en conciliaciones_historicas y equivalencias_historicas, aunque el mensaje mencione asistencia. |
| [`asistencia_estudiantes`](dominios/04-asistencia.md#asistencia_estudiantes) | `controlar_asistencia_estudiante` | BEFORE | INSERT OR UPDATE |  | [`validar_asistencia`](funciones.md#validar_asistencia) | Contexto inmutable; matrícula confirmada en la sección y jornada programada (y sesión no cancelada); "justificado" solo con justificación aprobada; marcaciones de la misma persona, día y ventanas de la política; "ausente" sin entrada; presencia sin marcación solo si la política admite manual; "tarde" debe coincidir con la tolerancia. |
| [`jornadas_docente`](dominios/04-asistencia.md#jornadas_docente) | `controlar_jornada_docente` | BEFORE | INSERT OR UPDATE |  | [`validar_fecha_jornada`](funciones.md#validar_fecha_jornada) | La fecha de la jornada debe estar dentro del año académico y de la vigencia de su política. |
| [`jornadas_seccion`](dominios/04-asistencia.md#jornadas_seccion) | `controlar_jornada_seccion` | BEFORE | INSERT OR UPDATE |  | [`validar_fecha_jornada`](funciones.md#validar_fecha_jornada) | La fecha de la jornada debe estar dentro del año académico y de la vigencia de su política. |
| [`justificaciones_asistencia`](dominios/04-asistencia.md#justificaciones_asistencia) | `aplicar_justificacion` | AFTER | INSERT OR UPDATE |  | [`aplicar_justificacion`](funciones.md#aplicar_justificacion) | Si la justificación queda aprobada, pasa la asistencia (alumno o docente) a "justificado" con motivo "Justificación aprobada #id"; registra el evento en bitácora. |
| [`justificaciones_asistencia`](dominios/04-asistencia.md#justificaciones_asistencia) | `conservar_justificacion` | BEFORE | DELETE |  | [`conservar_evento_asistencia`](funciones.md#conservar_evento_asistencia) | Prohíbe la operación ("solo inserción"). Se reutiliza en marcaciones, asistencia y justificaciones (DELETE) y también en conciliaciones_historicas y equivalencias_historicas, aunque el mensaje mencione asistencia. |
| [`justificaciones_asistencia`](dominios/04-asistencia.md#justificaciones_asistencia) | `controlar_justificacion` | BEFORE | INSERT OR UPDATE |  | [`validar_justificacion`](funciones.md#validar_justificacion) | Nace pendiente; se resuelve una vez sin cambiar contenido; solo se justifica una asistencia "ausente" o "tarde". |
| [`marcaciones`](dominios/04-asistencia.md#marcaciones) | `conservar_marcaciones` | BEFORE | DELETE OR UPDATE |  | [`conservar_evento_asistencia`](funciones.md#conservar_evento_asistencia) | Prohíbe la operación ("solo inserción"). Se reutiliza en marcaciones, asistencia y justificaciones (DELETE) y también en conciliaciones_historicas y equivalencias_historicas, aunque el mensaje mencione asistencia. |

### Cobros, caja y tesorería

| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |
|---|---|---|---|---|---|---|
| [`aplicaciones_pago`](dominios/05-cobros.md#aplicaciones_pago) | `controlar_abono` | BEFORE | INSERT |  | [`validar_aplicacion_pago`](funciones.md#validar_aplicacion_pago) | Bloquea pago y cuota; el pago no debe estar revertido ni tener recibo; las aplicaciones no exceden el pago; la cuota debe ser exigible a la fecha del pago; el abono no excede el saldo. |
| [`aplicaciones_pago`](dominios/05-cobros.md#aplicaciones_pago) | `preservar_aplicacion` | BEFORE | DELETE OR UPDATE |  | [`preservar_registro_financiero`](funciones.md#preservar_registro_financiero) | Prohíbe UPDATE/DELETE en cuotas, pagos, aplicaciones y recibos (un UPDATE sin cambios se usa como bloqueo de fila). Las correcciones van por ajuste, devolución o reversión. |
| [`cuotas`](dominios/05-cobros.md#cuotas) | `controlar_emision` | BEFORE | INSERT |  | [`validar_emision_cuota`](funciones.md#validar_emision_cuota) | La cuota debe reproducir exactamente un tramo de un plan publicado y vigente para una matrícula activa; la matrícula no puede superar la pensión de referencia; las cuotas de ingreso no superan el importe acordado. |
| [`cuotas`](dominios/05-cobros.md#cuotas) | `preservar_cuota` | BEFORE | DELETE OR UPDATE |  | [`preservar_registro_financiero`](funciones.md#preservar_registro_financiero) | Prohíbe UPDATE/DELETE en cuotas, pagos, aplicaciones y recibos (un UPDATE sin cambios se usa como bloqueo de fila). Las correcciones van por ajuste, devolución o reversión. |
| [`pagos`](dominios/05-cobros.md#pagos) | `preservar_pago` | BEFORE | DELETE OR UPDATE |  | [`preservar_registro_financiero`](funciones.md#preservar_registro_financiero) | Prohíbe UPDATE/DELETE en cuotas, pagos, aplicaciones y recibos (un UPDATE sin cambios se usa como bloqueo de fila). Las correcciones van por ajuste, devolución o reversión. |
| [`recibos_caja`](dominios/05-cobros.md#recibos_caja) | `preservar_recibo` | BEFORE | DELETE OR UPDATE |  | [`preservar_registro_financiero`](funciones.md#preservar_registro_financiero) | Prohíbe UPDATE/DELETE en cuotas, pagos, aplicaciones y recibos (un UPDATE sin cambios se usa como bloqueo de fila). Las correcciones van por ajuste, devolución o reversión. |

### Personal docente y planilla

| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |
|---|---|---|---|---|---|---|
| [`contratos_docentes`](dominios/06-personal-planilla.md#contratos_docentes) | `controlar_cambio_contrato` | BEFORE | UPDATE |  | [`conservar_condiciones_contrato`](funciones.md#conservar_condiciones_contrato) | Si el contrato ya tiene horas o liquidaciones, solo permite cambiar la vigencia, y solo si sigue cubriendo esas horas y vigencias aplicadas. |
| [`detalle_liquidacion_docente`](dominios/06-personal-planilla.md#detalle_liquidacion_docente) | `controlar_detalle_liquidacion` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`validar_detalle_liquidacion`](funciones.md#validar_detalle_liquidacion) | Sin UPDATE; solo con liquidación en borrador; las líneas "horas" exigen una hora aprobada del contrato dentro de la vigencia aplicada y modalidad por horas. |
| [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes) | `auditar_horas_docentes` | AFTER | UPDATE |  | [`auditar_planilla`](funciones.md#auditar_planilla) | Registra en bitácora la resolución de horas, la aprobación de liquidaciones, los pagos y las reversiones docentes. |
| [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes) | `conservar_horas_docentes` | BEFORE | DELETE |  | [`conservar_historial_planilla`](funciones.md#conservar_historial_planilla) | Prohíbe borrar o modificar historial de planilla (horas, períodos, liquidaciones aprobadas, pagos y reversiones docentes). |
| [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes) | `controlar_horas_docente` | BEFORE | INSERT OR UPDATE |  | [`validar_horas_docente`](funciones.md#validar_horas_docente) | Horas: nacen pendientes y se resuelven una vez sin cambiar contenido; contrato por horas vigente; solo horas ya trabajadas (hora Lima); si hay sesión debe ser "realizada" del mismo docente y contener el tramo; aprobar exige período abierto y sin liquidación aprobada. |
| [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes) | `auditar_liquidacion_docente` | AFTER | UPDATE | `(old.estado IS DISTINCT FROM new.estado)` | [`auditar_planilla`](funciones.md#auditar_planilla) | Registra en bitácora la resolución de horas, la aprobación de liquidaciones, los pagos y las reversiones docentes. |
| [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes) | `conservar_liquidacion_aprobada` | BEFORE | DELETE | `(old.estado = 'aprobada'::text)` | [`conservar_historial_planilla`](funciones.md#conservar_historial_planilla) | Prohíbe borrar o modificar historial de planilla (horas, períodos, liquidaciones aprobadas, pagos y reversiones docentes). |
| [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes) | `controlar_liquidacion_docente` | BEFORE | INSERT OR UPDATE |  | [`validar_liquidacion_docente`](funciones.md#validar_liquidacion_docente) | Nace en borrador en período abierto; congela modalidad, tarifa y sueldo del contrato y calcula vigencia_aplicada (mes ∩ contrato); sueldo parcial exige importe y motivo; aprobar exige neto ≥ 0, minutos > 0 (por horas) e incluir todas las horas aprobadas del mes. |
| [`pagos_docentes`](dominios/06-personal-planilla.md#pagos_docentes) | `auditar_pago_docente` | AFTER | INSERT |  | [`auditar_planilla`](funciones.md#auditar_planilla) | Registra en bitácora la resolución de horas, la aprobación de liquidaciones, los pagos y las reversiones docentes. |
| [`pagos_docentes`](dominios/06-personal-planilla.md#pagos_docentes) | `conservar_pago_docente` | BEFORE | DELETE OR UPDATE |  | [`conservar_historial_planilla`](funciones.md#conservar_historial_planilla) | Prohíbe borrar o modificar historial de planilla (horas, períodos, liquidaciones aprobadas, pagos y reversiones docentes). |
| [`pagos_docentes`](dominios/06-personal-planilla.md#pagos_docentes) | `controlar_pago_docente` | BEFORE | INSERT |  | [`validar_movimiento_pago_docente`](funciones.md#validar_movimiento_pago_docente) | Exige liquidación aprobada; el pago no excede el saldo; la reversión debe ser posterior al pago. |
| [`periodos_liquidacion`](dominios/06-personal-planilla.md#periodos_liquidacion) | `conservar_periodo_planilla` | BEFORE | DELETE |  | [`conservar_historial_planilla`](funciones.md#conservar_historial_planilla) | Prohíbe borrar o modificar historial de planilla (horas, períodos, liquidaciones aprobadas, pagos y reversiones docentes). |
| [`periodos_liquidacion`](dominios/06-personal-planilla.md#periodos_liquidacion) | `controlar_periodo_planilla` | BEFORE | INSERT OR UPDATE |  | [`controlar_periodo_planilla`](funciones.md#controlar_periodo_planilla) | Período: nace abierto; solo pasa a cerrado sin cambiar datos y si no hay liquidaciones en borrador ni horas pendientes o aprobadas sin liquidar en el mes. |
| [`reversiones_pago_docente`](dominios/06-personal-planilla.md#reversiones_pago_docente) | `auditar_reversion_docente` | AFTER | INSERT |  | [`auditar_planilla`](funciones.md#auditar_planilla) | Registra en bitácora la resolución de horas, la aprobación de liquidaciones, los pagos y las reversiones docentes. |
| [`reversiones_pago_docente`](dominios/06-personal-planilla.md#reversiones_pago_docente) | `conservar_reversion_docente` | BEFORE | DELETE OR UPDATE |  | [`conservar_historial_planilla`](funciones.md#conservar_historial_planilla) | Prohíbe borrar o modificar historial de planilla (horas, períodos, liquidaciones aprobadas, pagos y reversiones docentes). |
| [`reversiones_pago_docente`](dominios/06-personal-planilla.md#reversiones_pago_docente) | `controlar_reversion_docente` | BEFORE | INSERT |  | [`validar_movimiento_pago_docente`](funciones.md#validar_movimiento_pago_docente) | Exige liquidación aprobada; el pago no excede el saldo; la reversión debe ser posterior al pago. |

### Documentos, archivos y reportes

| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |
|---|---|---|---|---|---|---|
| [`documentos_emitidos`](dominios/07-documentos-reportes.md#documentos_emitidos) | `auditar_documento_reporte` | AFTER | INSERT OR UPDATE |  | [`auditar_documento_reporte`](funciones.md#auditar_documento_reporte) | Registra en bitácora la solicitud, el procesamiento o la anulación de un documento emitido. |
| [`documentos_emitidos`](dominios/07-documentos-reportes.md#documentos_emitidos) | `proteger_documento_emitido` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`proteger_documento_reporte`](funciones.md#proteger_documento_reporte) | Documentos y plantillas no se borran; plantilla publicada inmutable; documento nace "preparado", datos inmutables, transiciones preparado → emitido/fallido y emitido → anulado; al emitir, el archivo debe tener bytes > 0 y MIME acorde al formato. |
| [`plantillas_documento`](dominios/07-documentos-reportes.md#plantillas_documento) | `proteger_plantilla_publicada` | BEFORE | DELETE OR UPDATE |  | [`proteger_documento_reporte`](funciones.md#proteger_documento_reporte) | Documentos y plantillas no se borran; plantilla publicada inmutable; documento nace "preparado", datos inmutables, transiciones preparado → emitido/fallido y emitido → anulado; al emitir, el archivo debe tener bytes > 0 y MIME acorde al formato. |

### Importación histórica

| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |
|---|---|---|---|---|---|---|
| [`conciliaciones_historicas`](dominios/08-importacion-historica.md#conciliaciones_historicas) | `conservar_conciliacion` | BEFORE | DELETE OR UPDATE |  | [`conservar_evento_asistencia`](funciones.md#conservar_evento_asistencia) | Prohíbe la operación ("solo inserción"). Se reutiliza en marcaciones, asistencia y justificaciones (DELETE) y también en conciliaciones_historicas y equivalencias_historicas, aunque el mensaje mencione asistencia. |
| [`equivalencias_historicas`](dominios/08-importacion-historica.md#equivalencias_historicas) | `conservar_equivalencia` | BEFORE | DELETE OR UPDATE |  | [`conservar_evento_asistencia`](funciones.md#conservar_evento_asistencia) | Prohíbe la operación ("solo inserción"). Se reutiliza en marcaciones, asistencia y justificaciones (DELETE) y también en conciliaciones_historicas y equivalencias_historicas, aunque el mensaje mencione asistencia. |
| [`filas_importacion`](dominios/08-importacion-historica.md#filas_importacion) | `controlar_fila_importacion` | BEFORE | INSERT OR DELETE OR UPDATE |  | [`controlar_carga_historica`](funciones.md#controlar_carga_historica) | Filas solo de inserción, solo con el lote en "carga"; rechaza valores anidados y claves que parezcan credenciales (clave, contraseña, password, hash, token, secret, salt, credencial). |

## Vistas

<a id="vista-archivo_historico"></a>
### archivo_historico

Filas históricas archivadas con el sustento de su conciliación.

- **Columnas:** `sistema` text, `sha256` bytea, `lote_id` bigint, `entidad` text, `clave_origen` text, `datos` jsonb, `motivo` text, `revisada_en` timestamptz
- **Fuentes:** [`conciliaciones_historicas`](dominios/08-importacion-historica.md#conciliaciones_historicas), [`filas_importacion`](dominios/08-importacion-historica.md#filas_importacion), [`lotes_importacion`](dominios/08-importacion-historica.md#lotes_importacion)

<details><summary>Definición</summary>

```sql
SELECT l.sistema,
    l.sha256,
    f.lote_id,
    f.entidad,
    f.clave_origen,
    f.datos,
    c.motivo,
    c.revisada_en
   FROM excelencia_seruna.filas_importacion f
     JOIN excelencia_seruna.lotes_importacion l ON l.id = f.lote_id
     JOIN excelencia_seruna.conciliaciones_historicas c USING (lote_id, entidad, clave_origen)
  WHERE c.accion = 'archivar'::text;
```

</details>

<a id="vista-asistencia_diaria_docentes"></a>
### asistencia_diaria_docentes

Cada jornada docente programada con su estado (pendiente si no hay registro) y horas de entrada/salida.

- **Columnas:** `anio_id` bigint, `docente_id` bigint, `fecha` date, `jornada_id` bigint, `asistencia_id` bigint, `estado` text, `entrada` timestamptz, `salida` timestamptz
- **Fuentes:** [`asistencia_docentes`](dominios/04-asistencia.md#asistencia_docentes), [`jornadas_docente`](dominios/04-asistencia.md#jornadas_docente), [`marcaciones`](dominios/04-asistencia.md#marcaciones)
- **Usada por:** [`indicadores_dashboard`](funciones.md#indicadores_dashboard), [`preparar_documento_reporte`](funciones.md#preparar_documento_reporte)

<details><summary>Definición</summary>

```sql
SELECT j.anio_id,
    j.docente_id,
    j.fecha,
    j.id AS jornada_id,
    a.id AS asistencia_id,
    COALESCE(a.estado, 'pendiente'::text) AS estado,
    entrada.instante AS entrada,
    salida.instante AS salida
   FROM excelencia_seruna.jornadas_docente j
     LEFT JOIN excelencia_seruna.asistencia_docentes a ON a.jornada_id = j.id
     LEFT JOIN excelencia_seruna.marcaciones entrada ON entrada.id = a.entrada_id
     LEFT JOIN excelencia_seruna.marcaciones salida ON salida.id = a.salida_id
  WHERE j.estado = 'programada'::text;
```

</details>

<a id="vista-asistencia_diaria_estudiantes"></a>
### asistencia_diaria_estudiantes

Nómina esperada por jornada de sección (matrículas confirmadas vigentes) con estado diario y marcaciones.

- **Columnas:** `anio_id` bigint, `seccion_id` bigint, `fecha` date, `estudiante_id` bigint, `matricula_id` bigint, `jornada_id` bigint, `asistencia_id` bigint, `estado` text, `entrada` timestamptz, `salida` timestamptz
- **Fuentes:** [`asistencia_estudiantes`](dominios/04-asistencia.md#asistencia_estudiantes), [`jornadas_seccion`](dominios/04-asistencia.md#jornadas_seccion), [`marcaciones`](dominios/04-asistencia.md#marcaciones), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones), [`matriculas`](dominios/02-matricula.md#matriculas)
- **Usada por:** [`indicadores_dashboard`](funciones.md#indicadores_dashboard), [`preparar_documento_reporte`](funciones.md#preparar_documento_reporte)

<details><summary>Definición</summary>

```sql
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
   FROM excelencia_seruna.jornadas_seccion j
     JOIN excelencia_seruna.matricula_secciones ms ON ms.seccion_id = j.seccion_id AND ms.vigencia @> j.fecha
     JOIN excelencia_seruna.matriculas m ON m.id = ms.matricula_id AND m.confirmada_en IS NOT NULL AND m.estado <> 'anulada'::text
     LEFT JOIN excelencia_seruna.asistencia_estudiantes a ON a.jornada_id = j.id AND a.matricula_id = ms.matricula_id AND a.sesion_id IS NULL
     LEFT JOIN excelencia_seruna.marcaciones entrada ON entrada.id = a.entrada_id
     LEFT JOIN excelencia_seruna.marcaciones salida ON salida.id = a.salida_id
  WHERE j.estado = 'programada'::text;
```

</details>

<a id="vista-horarios_seccion"></a>
### horarios_seccion

Horario legible por sección: asignatura, docente, aula, día y horas.

- **Columnas:** `id` bigint, `anio_id` bigint, `grado_id` bigint, `seccion_id` bigint, `curso_id` bigint, `asignatura` text, `docente_id` bigint, `docente` text, `aula` text, `dia_iso` smallint, `hora_inicio` time, `hora_fin` time, `vigencia` daterange
- **Fuentes:** [`asignaturas`](dominios/03-academico-evaluacion.md#asignaturas), [`aulas`](dominios/03-academico-evaluacion.md#aulas), [`bloques_horario`](dominios/03-academico-evaluacion.md#bloques_horario), [`cursos_seccion`](dominios/03-academico-evaluacion.md#cursos_seccion), [`docentes`](dominios/06-personal-planilla.md#docentes), [`personas`](dominios/01-identidad-permisos.md#personas), [`secciones`](dominios/03-academico-evaluacion.md#secciones)

<details><summary>Definición</summary>

```sql
SELECT h.id,
    s.anio_id,
    s.grado_id,
    h.seccion_id,
    h.curso_id,
    a.nombre AS asignatura,
    h.docente_id,
    (p.nombres || ' '::text) || p.apellidos AS docente,
    au.nombre AS aula,
    h.dia_iso,
    h.hora_inicio,
    h.hora_fin,
    h.vigencia
   FROM excelencia_seruna.bloques_horario h
     JOIN excelencia_seruna.cursos_seccion c ON c.id = h.curso_id
     JOIN excelencia_seruna.secciones s ON s.id = h.seccion_id
     JOIN excelencia_seruna.asignaturas a ON a.id = c.asignatura_id
     JOIN excelencia_seruna.docentes d ON d.id = h.docente_id
     JOIN excelencia_seruna.personas p ON p.id = d.persona_id
     LEFT JOIN excelencia_seruna.aulas au ON au.id = h.aula_id;
```

</details>

<a id="vista-orden_merito_publicado"></a>
### orden_merito_publicado

Última versión publicada del mérito por año, grado y alcance, con sus puestos.

- **Columnas:** `anio_id` bigint, `grado_id` bigint, `alcance` text, `version` integer, `publicado_en` timestamptz, `referencia_siagie` text, `publicacion_id` bigint, `matricula_id` bigint, `cierre_anual_id` bigint, `puesto` integer, `calificativo` numeric(6,3)
- **Fuentes:** [`orden_merito`](dominios/03-academico-evaluacion.md#orden_merito), [`publicaciones_merito`](dominios/03-academico-evaluacion.md#publicaciones_merito)

<details><summary>Definición</summary>

```sql
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
          WHERE publicaciones_merito.publicado_en IS NOT NULL
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
   FROM vigentes p
     JOIN excelencia_seruna.orden_merito o ON o.publicacion_id = p.id;
```

</details>

<a id="vista-reporte_nomina_matriculas"></a>
### reporte_nomina_matriculas

Nómina de matrículas con alumno, nivel, grado, sección y vigencia.

- **Columnas:** `matricula_id` bigint, `anio_id` bigint, `grado_id` bigint, `estado` text, `confirmada_en` timestamptz, `tipo_ingreso` text, `estudiante_id` bigint, `codigo` text, `codigo_siagie` text, `nombres` text, `apellidos` text, `nivel` text, `grado` smallint, `seccion_id` bigint, `seccion` text, `vigencia` daterange
- **Fuentes:** [`estudiantes`](dominios/02-matricula.md#estudiantes), [`grados`](dominios/03-academico-evaluacion.md#grados), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones), [`matriculas`](dominios/02-matricula.md#matriculas), [`niveles`](dominios/03-academico-evaluacion.md#niveles), [`personas`](dominios/01-identidad-permisos.md#personas), [`secciones`](dominios/03-academico-evaluacion.md#secciones)
- **Usada por:** [`preparar_documento_reporte`](funciones.md#preparar_documento_reporte)

<details><summary>Definición</summary>

```sql
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
   FROM excelencia_seruna.matriculas m
     JOIN excelencia_seruna.estudiantes e ON e.id = m.estudiante_id
     JOIN excelencia_seruna.personas p ON p.id = e.persona_id
     JOIN excelencia_seruna.grados g ON g.id = m.grado_id
     JOIN excelencia_seruna.niveles n ON n.id = g.nivel_id
     LEFT JOIN excelencia_seruna.matricula_secciones ms ON ms.matricula_id = m.id
     LEFT JOIN excelencia_seruna.secciones s ON s.id = ms.seccion_id;
```

</details>

<a id="vista-reporte_notas_publicadas"></a>
### reporte_notas_publicadas

Calificaciones de cierres publicados con datos del alumno, área y competencia.

- **Columnas:** `matricula_id` bigint, `anio_id` bigint, `grado_id` bigint, `seccion_id` bigint, `bimestre_id` bigint, `bimestre` smallint, `codigo` text, `codigo_siagie` text, `nombres` text, `apellidos` text, `competencia_id` bigint, `area` text, `competencia` text, `estado` text, `nivel_logro` text, `conclusion` text, `publicado_en` timestamptz
- **Fuentes:** [`areas_curriculares`](dominios/03-academico-evaluacion.md#areas_curriculares), [`bimestres`](dominios/03-academico-evaluacion.md#bimestres), [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia), [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion), [`competencias`](dominios/03-academico-evaluacion.md#competencias), [`estudiantes`](dominios/02-matricula.md#estudiantes), [`matriculas`](dominios/02-matricula.md#matriculas), [`personas`](dominios/01-identidad-permisos.md#personas)
- **Usada por:** [`preparar_documento_reporte`](funciones.md#preparar_documento_reporte)

<details><summary>Definición</summary>

```sql
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
   FROM excelencia_seruna.calificaciones_competencia c
     JOIN excelencia_seruna.cierres_evaluacion x ON x.id = c.cierre_id AND x.estado = 'publicado'::text
     JOIN excelencia_seruna.bimestres b ON b.id = c.bimestre_id
     JOIN excelencia_seruna.matriculas m ON m.id = c.matricula_id
     JOIN excelencia_seruna.estudiantes e ON e.id = m.estudiante_id
     JOIN excelencia_seruna.personas p ON p.id = e.persona_id
     JOIN excelencia_seruna.competencias k ON k.id = c.competencia_id
     LEFT JOIN excelencia_seruna.areas_curriculares a ON a.id = k.area_id;
```

</details>

<a id="vista-resumen_importacion_historica"></a>
### resumen_importacion_historica

Conteos por lote y entidad: cargadas, creadas, vinculadas, archivadas, excluidas y pendientes.

- **Columnas:** `lote_id` bigint, `entidad` text, `cargadas` bigint, `creadas` bigint, `vinculadas` bigint, `archivadas` bigint, `excluidas` bigint, `pendientes` bigint
- **Fuentes:** [`conciliaciones_historicas`](dominios/08-importacion-historica.md#conciliaciones_historicas), [`filas_importacion`](dominios/08-importacion-historica.md#filas_importacion)
- **Usada por:** [`avanzar_lote_historico`](funciones.md#avanzar_lote_historico)

<details><summary>Definición</summary>

```sql
SELECT f.lote_id,
    f.entidad,
    count(*) AS cargadas,
    count(*) FILTER (WHERE c.accion = 'crear'::text) AS creadas,
    count(*) FILTER (WHERE c.accion = 'vincular'::text) AS vinculadas,
    count(*) FILTER (WHERE c.accion = 'archivar'::text) AS archivadas,
    count(*) FILTER (WHERE c.accion = 'excluir'::text) AS excluidas,
    count(*) FILTER (WHERE c.accion IS NULL) AS pendientes
   FROM excelencia_seruna.filas_importacion f
     LEFT JOIN excelencia_seruna.conciliaciones_historicas c USING (lote_id, entidad, clave_origen)
  GROUP BY f.lote_id, f.entidad;
```

</details>

<a id="vista-saldos_cuotas"></a>
### saldos_cuotas

Saldo por cuota = importe + ajustes − abonos netos (excluye pagos revertidos y descuenta devoluciones). Lo usa validar_aplicacion_pago.

- **Columnas:** `cuota_id` bigint, `matricula_id` bigint, `vence_en` date, `importe` numeric(12,2), `ajustes` numeric, `abonado` numeric, `saldo` numeric
- **Fuentes:** [`ajustes_cuota`](dominios/05-cobros.md#ajustes_cuota), [`aplicaciones_pago`](dominios/05-cobros.md#aplicaciones_pago), [`cuotas`](dominios/05-cobros.md#cuotas), [`devoluciones`](dominios/05-cobros.md#devoluciones), [`reversiones_pago`](dominios/05-cobros.md#reversiones_pago)
- **Usada por:** [`validar_aplicacion_pago`](funciones.md#validar_aplicacion_pago)

<details><summary>Definición</summary>

```sql
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
            sum(a_1.importe - COALESCE(d.importe, 0::numeric)) AS importe
           FROM excelencia_seruna.aplicaciones_pago a_1
             LEFT JOIN devueltos d ON d.aplicacion_id = a_1.id
          WHERE NOT (EXISTS ( SELECT 1
                   FROM excelencia_seruna.reversiones_pago r
                  WHERE r.pago_id = a_1.pago_id))
          GROUP BY a_1.cuota_id
        )
 SELECT c.id AS cuota_id,
    c.matricula_id,
    c.vence_en,
    c.importe,
    COALESCE(j.importe, 0::numeric) AS ajustes,
    COALESCE(a.importe, 0::numeric) AS abonado,
    c.importe + COALESCE(j.importe, 0::numeric) - COALESCE(a.importe, 0::numeric) AS saldo
   FROM excelencia_seruna.cuotas c
     LEFT JOIN ajustes j ON j.cuota_id = c.id
     LEFT JOIN abonos a ON a.cuota_id = c.id;
```

</details>

<a id="vista-saldos_liquidacion_docente"></a>
### saldos_liquidacion_docente

Totales de la liquidación más abonado y saldo (solo en aprobadas).

- **Columnas:** `liquidacion_id` bigint, `minutos_aprobados` bigint, `base` numeric, `adicionales` numeric, `descuentos` numeric, `neto` numeric, `estado` text, `abonado` numeric, `saldo` numeric
- **Fuentes:** [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes), [`pagos_docentes`](dominios/06-personal-planilla.md#pagos_docentes), [`reversiones_pago_docente`](dominios/06-personal-planilla.md#reversiones_pago_docente), [`totales_liquidacion_docente`](triggers-y-vistas.md#vista-totales_liquidacion_docente)
- **Usada por:** [`validar_movimiento_pago_docente`](funciones.md#validar_movimiento_pago_docente)

<details><summary>Definición</summary>

```sql
WITH abonos AS (
         SELECT p.liquidacion_id,
            sum(p.importe) AS abonado
           FROM excelencia_seruna.pagos_docentes p
          WHERE NOT (EXISTS ( SELECT 1
                   FROM excelencia_seruna.reversiones_pago_docente r
                  WHERE r.pago_id = p.id))
          GROUP BY p.liquidacion_id
        )
 SELECT t.liquidacion_id,
    t.minutos_aprobados,
    t.base,
    t.adicionales,
    t.descuentos,
    t.neto,
    l.estado,
    COALESCE(a.abonado, 0::numeric) AS abonado,
        CASE
            WHEN l.estado = 'aprobada'::text THEN t.neto - COALESCE(a.abonado, 0::numeric)
            ELSE NULL::numeric
        END AS saldo
   FROM excelencia_seruna.totales_liquidacion_docente t
     JOIN excelencia_seruna.liquidaciones_docentes l ON l.id = t.liquidacion_id
     LEFT JOIN abonos a ON a.liquidacion_id = l.id;
```

</details>

<a id="vista-situaciones_finales"></a>
### situaciones_finales

Último cierre anual aprobado por matrícula (situación final vigente).

- **Columnas:** `cierre_anual_id` bigint, `matricula_id` bigint, `anio_id` bigint, `grado_id` bigint, `seccion_id` bigint, `version` integer, `etapa` text, `situacion` text, `regla_id` bigint, `fecha_corte` date, `aprobado_por` bigint, `aprobado_en` timestamptz
- **Fuentes:** [`cierres_anuales`](dominios/03-academico-evaluacion.md#cierres_anuales)

<details><summary>Definición</summary>

```sql
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
  WHERE estado = 'aprobado'::text
  ORDER BY matricula_id, version DESC;
```

</details>

<a id="vista-totales_liquidacion_docente"></a>
### totales_liquidacion_docente

Minutos aprobados, base (importe fijo o minutos × tarifa / minutos_por_hora), adicionales, descuentos y neto.

- **Columnas:** `liquidacion_id` bigint, `minutos_aprobados` bigint, `base` numeric, `adicionales` numeric, `descuentos` numeric, `neto` numeric
- **Fuentes:** [`detalle_liquidacion_docente`](dominios/06-personal-planilla.md#detalle_liquidacion_docente), [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes), [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes)
- **Usada por:** [`validar_liquidacion_docente`](funciones.md#validar_liquidacion_docente)

<details><summary>Definición</summary>

```sql
WITH detalle AS (
         SELECT d_1.liquidacion_id,
            sum(h.minutos) FILTER (WHERE d_1.tipo = 'horas'::text) AS minutos,
            sum(d_1.importe) FILTER (WHERE d_1.tipo = 'adicional'::text) AS adicionales,
            sum(d_1.importe) FILTER (WHERE d_1.tipo = 'descuento'::text) AS descuentos
           FROM excelencia_seruna.detalle_liquidacion_docente d_1
             LEFT JOIN excelencia_seruna.horas_docentes h ON h.id = d_1.hora_docente_id
          GROUP BY d_1.liquidacion_id
        )
 SELECT l.id AS liquidacion_id,
    COALESCE(d.minutos, 0::bigint) AS minutos_aprobados,
    COALESCE(l.importe_fijo, round(COALESCE(d.minutos, 0::bigint)::numeric * l.tarifa_hora / l.minutos_por_hora::numeric, 2)) AS base,
    COALESCE(d.adicionales, 0::numeric) AS adicionales,
    COALESCE(d.descuentos, 0::numeric) AS descuentos,
    COALESCE(l.importe_fijo, round(COALESCE(d.minutos, 0::bigint)::numeric * l.tarifa_hora / l.minutos_por_hora::numeric, 2)) + COALESCE(d.adicionales, 0::numeric) - COALESCE(d.descuentos, 0::numeric) AS neto
   FROM excelencia_seruna.liquidaciones_docentes l
     LEFT JOIN detalle d ON d.liquidacion_id = l.id;
```

</details>

<a id="vista-ultimos_logros_publicados"></a>
### ultimos_logros_publicados

Último nivel de logro evaluado y publicado por matrícula y competencia.

- **Columnas:** `matricula_id` bigint, `competencia_id` bigint, `calificacion_id` bigint, `bimestre` smallint, `nivel_logro` text, `conclusion` text
- **Fuentes:** [`bimestres`](dominios/03-academico-evaluacion.md#bimestres), [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia), [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion)
- **Usada por:** [`controlar_cierre_anual`](funciones.md#controlar_cierre_anual), [`controlar_resultado_anual`](funciones.md#controlar_resultado_anual)

<details><summary>Definición</summary>

```sql
SELECT DISTINCT ON (c.matricula_id, c.competencia_id) c.matricula_id,
    c.competencia_id,
    c.id AS calificacion_id,
    b.numero AS bimestre,
    c.nivel_logro,
    c.conclusion
   FROM excelencia_seruna.calificaciones_competencia c
     JOIN excelencia_seruna.cierres_evaluacion x ON x.id = c.cierre_id
     JOIN excelencia_seruna.bimestres b ON b.id = c.bimestre_id
  WHERE c.estado = 'evaluada'::text AND x.estado = 'publicado'::text
  ORDER BY c.matricula_id, c.competencia_id, b.numero DESC;
```

</details>
