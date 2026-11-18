<!-- Archivo generado por scripts/db/generar-docs.mjs a partir del catálogo real. No editar a mano. -->

# Catálogo de funciones (43)

Todas las excepciones de negocio usan `RAISE EXCEPTION` **sin `ERRCODE`**, es decir SQLSTATE `P0001` (`raise_exception`). La app debe traducirlas por el texto del mensaje (ver [catálogo de mensajes](#catalogo-de-mensajes-de-error)). `SELECT ... INTO STRICT` lanza `P0002` (`no_data_found`) cuando el registro no existe.

Ninguna función es `SECURITY DEFINER`: se ejecutan con los privilegios del rol que llama (el rol de la app necesita privilegios sobre todas las tablas que tocan).

En el dump original se revoca `EXECUTE` a `PUBLIC` en: `avanzar_lote_historico`, `conciliar_fila_historica`, `indicadores_dashboard`, `preparar_documento_reporte`, `reporte_cuotas_al_corte`. Al restaurar con `--no-privileges` ese REVOKE se pierde.

## Índice

| Función | Tipo | Dominio | Usada por |
|---|---|---|---|
| [`auditar_cierre_academico`](#auditar_cierre_academico) | trigger | Académico | cierres_anuales.auditar_cierre_anual, evaluaciones_recuperacion.auditar_recuperacion, publicaciones_merito.auditar_merito |
| [`conservar_calificacion`](#conservar_calificacion) | trigger | Académico | calificaciones_competencia.conservar_calificacion |
| [`controlar_cierre_anual`](#controlar_cierre_anual) | trigger | Académico | cierres_anuales.controlar_cierre_anual |
| [`controlar_evaluacion_recuperacion`](#controlar_evaluacion_recuperacion) | trigger | Académico | evaluaciones_recuperacion.controlar_evaluacion_recuperacion |
| [`controlar_publicacion_merito`](#controlar_publicacion_merito) | trigger | Académico | publicaciones_merito.controlar_publicacion_merito |
| [`controlar_puesto_merito`](#controlar_puesto_merito) | trigger | Académico | orden_merito.controlar_puesto_merito |
| [`controlar_resultado_anual`](#controlar_resultado_anual) | trigger | Académico | resultados_anuales_competencia.controlar_resultado_anual |
| [`preparar_exportacion_siagie`](#preparar_exportacion_siagie) | invocable | Académico | app / otras funciones |
| [`proteger_regla_evaluacion`](#proteger_regla_evaluacion) | trigger | Académico | reglas_evaluacion.proteger_regla_evaluacion |
| [`registrar_revision_calificacion`](#registrar_revision_calificacion) | trigger | Académico | calificaciones_competencia.auditar_calificacion |
| [`validar_calificacion`](#validar_calificacion) | trigger | Académico | calificaciones_competencia.controlar_calificacion |
| [`validar_cierre_evaluacion`](#validar_cierre_evaluacion) | trigger | Académico | cierres_evaluacion.controlar_cierre |
| [`validar_plan_seccion`](#validar_plan_seccion) | trigger | Académico | seccion_planes_estudio.controlar_plan_seccion |
| [`validar_vigencia_horario`](#validar_vigencia_horario) | trigger | Académico | asignaciones_docentes.controlar_asignacion, bloques_horario.controlar_bloque, sesiones_clase.controlar_sesion |
| [`aplicar_justificacion`](#aplicar_justificacion) | trigger | Asistencia | justificaciones_asistencia.aplicar_justificacion |
| [`auditar_asistencia`](#auditar_asistencia) | trigger | Asistencia | asistencia_docentes.auditar_asistencia_docente, asistencia_estudiantes.auditar_asistencia_estudiante |
| [`registrar_marcacion`](#registrar_marcacion) | invocable | Asistencia | app / otras funciones |
| [`validar_asistencia`](#validar_asistencia) | trigger | Asistencia | asistencia_docentes.controlar_asistencia_docente, asistencia_estudiantes.controlar_asistencia_estudiante |
| [`validar_fecha_jornada`](#validar_fecha_jornada) | trigger | Asistencia | jornadas_docente.controlar_jornada_docente, jornadas_seccion.controlar_jornada_seccion |
| [`validar_justificacion`](#validar_justificacion) | trigger | Asistencia | justificaciones_asistencia.controlar_justificacion |
| [`emitir_recibo_caja`](#emitir_recibo_caja) | invocable | Cobros | app / otras funciones |
| [`preservar_registro_financiero`](#preservar_registro_financiero) | trigger | Cobros | aplicaciones_pago.preservar_aplicacion, cuotas.preservar_cuota, pagos.preservar_pago, recibos_caja.preservar_recibo |
| [`reporte_cuotas_al_corte`](#reporte_cuotas_al_corte) | invocable | Cobros | app / otras funciones |
| [`validar_aplicacion_pago`](#validar_aplicacion_pago) | trigger | Cobros | aplicaciones_pago.controlar_abono |
| [`validar_emision_cuota`](#validar_emision_cuota) | trigger | Cobros | cuotas.controlar_emision |
| [`auditar_documento_reporte`](#auditar_documento_reporte) | trigger | Documentos | documentos_emitidos.auditar_documento_reporte |
| [`preparar_documento_reporte`](#preparar_documento_reporte) | invocable | Documentos | app / otras funciones |
| [`proteger_documento_reporte`](#proteger_documento_reporte) | trigger | Documentos | documentos_emitidos.proteger_documento_emitido, plantillas_documento.proteger_plantilla_publicada |
| [`avanzar_lote_historico`](#avanzar_lote_historico) | invocable | Importación | app / otras funciones |
| [`conciliar_fila_historica`](#conciliar_fila_historica) | invocable | Importación | app / otras funciones |
| [`controlar_carga_historica`](#controlar_carga_historica) | trigger | Importación | filas_importacion.controlar_fila_importacion |
| [`validar_operador_importacion`](#validar_operador_importacion) | invocable | Importación | app / otras funciones |
| [`validar_ocupacion_seccion`](#validar_ocupacion_seccion) | trigger | Matrícula | matricula_secciones.controlar_cupo |
| [`auditar_planilla`](#auditar_planilla) | trigger | Planilla | horas_docentes.auditar_horas_docentes, liquidaciones_docentes.auditar_liquidacion_docente, pagos_docentes.auditar_pago_docente, reversiones_pago_docente.auditar_reversion_docente |
| [`conservar_condiciones_contrato`](#conservar_condiciones_contrato) | trigger | Planilla | contratos_docentes.controlar_cambio_contrato |
| [`conservar_historial_planilla`](#conservar_historial_planilla) | trigger | Planilla | horas_docentes.conservar_horas_docentes, liquidaciones_docentes.conservar_liquidacion_aprobada, pagos_docentes.conservar_pago_docente, periodos_liquidacion.conservar_periodo_planilla, reversiones_pago_docente.conservar_reversion_docente |
| [`controlar_periodo_planilla`](#controlar_periodo_planilla) | trigger | Planilla | periodos_liquidacion.controlar_periodo_planilla |
| [`validar_detalle_liquidacion`](#validar_detalle_liquidacion) | trigger | Planilla | detalle_liquidacion_docente.controlar_detalle_liquidacion |
| [`validar_horas_docente`](#validar_horas_docente) | trigger | Planilla | horas_docentes.controlar_horas_docente |
| [`validar_liquidacion_docente`](#validar_liquidacion_docente) | trigger | Planilla | liquidaciones_docentes.controlar_liquidacion_docente |
| [`validar_movimiento_pago_docente`](#validar_movimiento_pago_docente) | trigger | Planilla | pagos_docentes.controlar_pago_docente, reversiones_pago_docente.controlar_reversion_docente |
| [`indicadores_dashboard`](#indicadores_dashboard) | invocable | Reportes | app / otras funciones |
| [`conservar_evento_asistencia`](#conservar_evento_asistencia) | trigger | Transversal | asistencia_docentes.conservar_asistencia_docente, asistencia_estudiantes.conservar_asistencia_estudiante, conciliaciones_historicas.conservar_conciliacion, equivalencias_historicas.conservar_equivalencia, justificaciones_asistencia.conservar_justificacion, marcaciones.conservar_marcaciones |

## auditar_cierre_academico

```sql
auditar_cierre_academico() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Registra en bitácora la aprobación de cierres anuales y recuperaciones, y la publicación del mérito.
- **Triggers:** `cierres_anuales`.`auditar_cierre_anual` (AFTER UPDATE); `evaluaciones_recuperacion`.`auditar_recuperacion` (AFTER UPDATE); `publicaciones_merito`.`auditar_merito` (AFTER UPDATE)
- **Escribe o bloquea:** [`bitacora`](dominios/01-identidad-permisos.md#bitacora)
- **Lee:** [`publicaciones_merito`](dominios/03-academico-evaluacion.md#publicaciones_merito)
- **Errores:** no lanza excepciones propias.

## conservar_calificacion

```sql
conservar_calificacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **search_path:** no fijado
- **Propósito:** Prohíbe borrar calificaciones; las correcciones se hacen por rectificación (UPDATE con motivo).
- **Triggers:** `calificaciones_competencia`.`conservar_calificacion` (BEFORE DELETE)
- **Errores (`P0001`):**
  - `Use una rectificación para conservar el historial de la calificación` → Validation (422)

## controlar_cierre_anual

```sql
controlar_cierre_anual() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Cierre anual: nace en borrador; aprobado es inmutable. Al aprobar exige regla aprobada, trayectoria de versiones válida, matrícula confirmada en sección/plan al fin del 4.º bimestre, 4 bimestres, bimestres cursados publicados, resultados de todas las competencias del plan, coherencia de situación/etapa de recuperación y que coincida con los últimos logros publicados.
- **Triggers:** `cierres_anuales`.`controlar_cierre_anual` (BEFORE INSERT OR DELETE OR UPDATE)
- **Lee:** [`bimestres`](dominios/03-academico-evaluacion.md#bimestres), [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia), [`cierres_anuales`](dominios/03-academico-evaluacion.md#cierres_anuales), [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion), [`competencias`](dominios/03-academico-evaluacion.md#competencias), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones), [`matriculas`](dominios/02-matricula.md#matriculas), [`plan_competencias`](dominios/03-academico-evaluacion.md#plan_competencias), [`reglas_evaluacion`](dominios/03-academico-evaluacion.md#reglas_evaluacion), [`resultados_anuales_competencia`](dominios/03-academico-evaluacion.md#resultados_anuales_competencia), [`seccion_planes_estudio`](dominios/03-academico-evaluacion.md#seccion_planes_estudio), [`ultimos_logros_publicados`](triggers-y-vistas.md#vista-ultimos_logros_publicados)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `El cierre aprobado debe conservarse` → Conflict (409)
  - `El cierre aprobado o su contexto no se pueden modificar` → Conflict (409)
  - `Registre primero un cierre en borrador` → Conflict (409)
  - `Se requiere una regla de evaluación aprobada` → Validation (422)
  - `La revisión requiere el cierre aprobado anterior de la misma trayectoria` → Validation (422)
  - `Configure los cuatro bimestres, la sección y el plan al cierre del cuarto bimestre` → Validation (422)
  - `Hay bimestres cursados sin resultados publicados` → Validation (422)
  - `Faltan resultados anuales del plan de estudios` → Validation (422)
  - `Identifique las competencias pendientes de recuperación` → Validation (422)
  - `Vincule al menos una evaluación de recuperación aprobada` → Validation (422)
  - `Una competencia pendiente requiere una evaluación aprobada para quedar resuelta` → Validation (422)
  - `Actualice el borrador según los últimos logros publicados` → Validation (422)

## controlar_evaluacion_recuperacion

```sql
controlar_evaluacion_recuperacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Recuperación: nace en borrador, se aprueba sin cambiar contenido y no se borra; exige competencia pendiente en un cierre anual aprobado y fecha ≥ fecha de corte.
- **Triggers:** `evaluaciones_recuperacion`.`controlar_evaluacion_recuperacion` (BEFORE INSERT OR DELETE OR UPDATE)
- **Lee:** [`cierres_anuales`](dominios/03-academico-evaluacion.md#cierres_anuales), [`resultados_anuales_competencia`](dominios/03-academico-evaluacion.md#resultados_anuales_competencia)
- **Errores (`P0001`):**
  - `El historial de recuperación debe conservarse` → Conflict (409)
  - `Apruebe el borrador sin modificar su contenido` → Conflict (409)
  - `Registre la evaluación de recuperación primero como borrador` → Conflict (409)
  - `La competencia debe estar pendiente en un cierre aprobado` → Validation (422)

## controlar_publicacion_merito

```sql
controlar_publicacion_merito() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Mérito: nace sin publicar; publicado es inmutable (versionar). Solo Secundaria con regla aprobada (alcance secundaria_completa solo en 5.º). Al publicar exige puestos consecutivos desde 1.
- **Triggers:** `publicaciones_merito`.`controlar_publicacion_merito` (BEFORE INSERT OR DELETE OR UPDATE)
- **Lee:** [`grados`](dominios/03-academico-evaluacion.md#grados), [`niveles`](dominios/03-academico-evaluacion.md#niveles), [`orden_merito`](dominios/03-academico-evaluacion.md#orden_merito), [`reglas_evaluacion`](dominios/03-academico-evaluacion.md#reglas_evaluacion)
- **Errores (`P0001`):**
  - `La publicación de mérito debe conservarse` → Conflict (409)
  - `Cree una nueva versión de la publicación de mérito` → Conflict (409)
  - `Registre el listado antes de publicarlo` → Conflict (409)
  - `El mérito requiere Secundaria y una regla aprobada; el alcance completo usa quinto grado` → Validation (422)
  - `El listado debe contener puestos consecutivos desde el primero` → Conflict (409)

## controlar_puesto_merito

```sql
controlar_puesto_merito() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Puestos: sin UPDATE (reemplazar), solo con la publicación sin publicar; el puesto apunta a un cierre anual aprobado no de recuperación del mismo año y grado.
- **Triggers:** `orden_merito`.`controlar_puesto_merito` (BEFORE INSERT OR DELETE OR UPDATE)
- **Escribe o bloquea:** [`publicaciones_merito`](dominios/03-academico-evaluacion.md#publicaciones_merito)
- **Lee:** [`cierres_anuales`](dominios/03-academico-evaluacion.md#cierres_anuales)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `Reemplace el puesto mientras el listado esté en borrador` → Conflict (409)
  - `El listado publicado es inmutable` → Conflict (409)
  - `El puesto debe apuntar a un cierre lectivo aprobado del mismo año y grado` → Validation (422)

## controlar_resultado_anual

```sql
controlar_resultado_anual() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Resultados anuales: sin UPDATE, solo con el cierre en borrador; copia nivel y conclusión desde la fuente (último logro publicado, recuperación aprobada o resultado anterior) ignorando lo enviado.
- **Triggers:** `resultados_anuales_competencia`.`controlar_resultado_anual` (BEFORE INSERT OR DELETE OR UPDATE)
- **Escribe o bloquea:** [`cierres_anuales`](dominios/03-academico-evaluacion.md#cierres_anuales)
- **Lee:** [`evaluaciones_recuperacion`](dominios/03-academico-evaluacion.md#evaluaciones_recuperacion), [`resultados_anuales_competencia`](dominios/03-academico-evaluacion.md#resultados_anuales_competencia), [`ultimos_logros_publicados`](triggers-y-vistas.md#vista-ultimos_logros_publicados)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `Reemplace el resultado mientras el cierre esté en borrador` → Conflict (409)
  - `El cierre aprobado es inmutable` → Conflict (409)
  - `La fuente del resultado anual no coincide con el cierre` → Validation (422)

## preparar_exportacion_siagie

```sql
preparar_exportacion_siagie(p_plantilla_id bigint, p_usuario_id bigint) RETURNS excelencia_seruna.exportaciones_siagie
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Prepara la exportación SIAGIE de una sección/bimestre publicado: valida mapeos y códigos SIAGIE y arma el JSON (sha256 de la plantilla, mapeos y notas con nivel y conclusión) en exportaciones_siagie con estado "preparada".
- **Escribe o bloquea:** [`exportaciones_siagie`](dominios/03-academico-evaluacion.md#exportaciones_siagie)
- **Lee:** [`archivos`](dominios/07-documentos-reportes.md#archivos), [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia), [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion), [`competencias`](dominios/03-academico-evaluacion.md#competencias), [`estudiantes`](dominios/02-matricula.md#estudiantes), [`mapeos_siagie`](dominios/03-academico-evaluacion.md#mapeos_siagie), [`matriculas`](dominios/02-matricula.md#matriculas), [`plantillas_siagie`](dominios/03-academico-evaluacion.md#plantillas_siagie)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `Publique el bimestre antes de preparar el Excel SIAGIE` → Conflict (409)
  - `Faltan códigos SIAGIE o mapeos de competencias del cierre` → Validation (422)

## proteger_regla_evaluacion

```sql
proteger_regla_evaluacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **search_path:** no fijado
- **Propósito:** Una regla de evaluación aprobada no se modifica ni se borra: se versiona.
- **Triggers:** `reglas_evaluacion`.`proteger_regla_evaluacion` (BEFORE DELETE OR UPDATE)
- **Errores (`P0001`):**
  - `Registre una nueva versión de la regla de evaluación` → Conflict (409)

## registrar_revision_calificacion

```sql
registrar_revision_calificacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Guarda la versión anterior y la nueva (jsonb) de una calificación con autor y motivo en revisiones_calificacion.
- **Triggers:** `calificaciones_competencia`.`auditar_calificacion` (AFTER UPDATE)
- **Escribe o bloquea:** [`revisiones_calificacion`](dominios/03-academico-evaluacion.md#revisiones_calificacion)
- **Errores:** no lanza excepciones propias.

## validar_calificacion

```sql
validar_calificacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Identidad inmutable; rectificar exige motivo y cierre en borrador; la matrícula debe estar en la sección del cierre con ese plan durante el bimestre.
- **Triggers:** `calificaciones_competencia`.`controlar_calificacion` (BEFORE INSERT OR UPDATE)
- **Lee:** [`bimestres`](dominios/03-academico-evaluacion.md#bimestres), [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones), [`seccion_planes_estudio`](dominios/03-academico-evaluacion.md#seccion_planes_estudio)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `La identidad de la calificación no se puede cambiar` → Conflict (409)
  - `Indique el motivo de la rectificación` → Validation (422)
  - `Reabra el cierre antes de rectificar` → Conflict (409)
  - `El cierre no admite cambios de notas` → Conflict (409)
  - `La matrícula y el plan no coinciden con la sección durante el bimestre` → Validation (422)

## validar_cierre_evaluacion

```sql
validar_cierre_evaluacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Nace en borrador; contexto inmutable; reabrir se audita; publicar exige estar cerrado; cerrar/publicar exige notas sin pendientes, conclusión descriptiva en C (y en B para Primaria) y todas las competencias del plan para toda la nómina al fin del bimestre.
- **Triggers:** `cierres_evaluacion`.`controlar_cierre` (BEFORE INSERT OR UPDATE)
- **Escribe o bloquea:** [`bitacora`](dominios/01-identidad-permisos.md#bitacora)
- **Lee:** [`bimestres`](dominios/03-academico-evaluacion.md#bimestres), [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia), [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion), [`competencias`](dominios/03-academico-evaluacion.md#competencias), [`grados`](dominios/03-academico-evaluacion.md#grados), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones), [`niveles`](dominios/03-academico-evaluacion.md#niveles), [`plan_competencias`](dominios/03-academico-evaluacion.md#plan_competencias), [`seccion_planes_estudio`](dominios/03-academico-evaluacion.md#seccion_planes_estudio)
- **Errores (`P0001`):**
  - `Un cierre debe empezar en borrador` → Conflict (409)
  - `El contexto del cierre no se puede cambiar` → Conflict (409)
  - `Cierre el bimestre antes de publicarlo` → Conflict (409)
  - `Hay notas pendientes o faltan conclusiones descriptivas obligatorias` → Validation (422)
  - `Faltan competencias del plan para la nómina al cierre del bimestre` → Validation (422)

## validar_plan_seccion

```sql
validar_plan_seccion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** El plan asignado a la sección debe estar publicado y su vigencia dentro del año escolar.
- **Triggers:** `seccion_planes_estudio`.`controlar_plan_seccion` (BEFORE INSERT OR UPDATE)
- **Lee:** [`anios_academicos`](dominios/03-academico-evaluacion.md#anios_academicos), [`planes_estudio`](dominios/03-academico-evaluacion.md#planes_estudio)
- **Errores (`P0001`):**
  - `Se requiere un plan publicado y una vigencia dentro del año escolar` → Validation (422)

## validar_vigencia_horario

```sql
validar_vigencia_horario() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** La fecha o vigencia (asignación, bloque o sesión) debe estar dentro del plan de la sección y, salvo en asignaciones, dentro de la asignación docente.
- **Triggers:** `asignaciones_docentes`.`controlar_asignacion` (BEFORE INSERT OR UPDATE); `bloques_horario`.`controlar_bloque` (BEFORE INSERT OR UPDATE); `sesiones_clase`.`controlar_sesion` (BEFORE INSERT OR UPDATE)
- **Lee:** [`asignaciones_docentes`](dominios/03-academico-evaluacion.md#asignaciones_docentes), [`bloques_horario`](dominios/03-academico-evaluacion.md#bloques_horario), [`cursos_seccion`](dominios/03-academico-evaluacion.md#cursos_seccion), [`seccion_planes_estudio`](dominios/03-academico-evaluacion.md#seccion_planes_estudio)
- **Errores (`P0001`):**
  - `La fecha o vigencia debe quedar dentro del plan de la sección` → Validation (422)
  - `La fecha o vigencia debe quedar dentro de la asignación docente` → Validation (422)

## aplicar_justificacion

```sql
aplicar_justificacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Si la justificación queda aprobada, pasa la asistencia (alumno o docente) a "justificado" con motivo "Justificación aprobada #id"; registra el evento en bitácora.
- **Triggers:** `justificaciones_asistencia`.`aplicar_justificacion` (AFTER INSERT OR UPDATE)
- **Escribe o bloquea:** [`asistencia_docentes`](dominios/04-asistencia.md#asistencia_docentes), [`asistencia_estudiantes`](dominios/04-asistencia.md#asistencia_estudiantes), [`bitacora`](dominios/01-identidad-permisos.md#bitacora)
- **Lee:** [`justificaciones_asistencia`](dominios/04-asistencia.md#justificaciones_asistencia)
- **Errores:** no lanza excepciones propias.

## auditar_asistencia

```sql
auditar_asistencia() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Registra en bitácora el estado de asistencia (o la transición anterior → nueva) con el actor registrado_por.
- **Triggers:** `asistencia_docentes`.`auditar_asistencia_docente` (AFTER INSERT OR UPDATE); `asistencia_estudiantes`.`auditar_asistencia_estudiante` (AFTER INSERT OR UPDATE)
- **Escribe o bloquea:** [`bitacora`](dominios/01-identidad-permisos.md#bitacora)
- **Errores:** no lanza excepciones propias.

## registrar_marcacion

```sql
registrar_marcacion(p_evento uuid, p_tipo text, p_actor bigint, p_qr_hash bytea DEFAULT NULL::bytea, p_lector bigint DEFAULT NULL::bigint, p_persona bigint DEFAULT NULL::bigint, p_instante timestamp with time zone DEFAULT NULL::timestamp with time zone, p_motivo text DEFAULT NULL::text) RETURNS excelencia_seruna.marcaciones
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Registra una marcación idempotente por p_evento. QR: recibe el hash del token y el lector; persona y hora las pone el servidor; valida credencial vigente y lector activo. Manual: persona, instante y motivo obligatorios. Exige operador activo y persona con perfil activo de alumno o docente. NO crea el registro de asistencia.
- **Escribe o bloquea:** [`marcaciones`](dominios/04-asistencia.md#marcaciones)
- **Lee:** [`credenciales_qr`](dominios/04-asistencia.md#credenciales_qr), [`docentes`](dominios/06-personal-planilla.md#docentes), [`estudiantes`](dominios/02-matricula.md#estudiantes), [`lectores_qr`](dominios/04-asistencia.md#lectores_qr), [`usuarios`](dominios/01-identidad-permisos.md#usuarios)
- **Errores (`P0001`):**
  - `Indique el UUID del evento y si es entrada o salida` → Validation (422)
  - `Ese UUID ya identifica otra marcación` → Conflict (409)
  - `La marcación requiere un operador activo` → Forbidden (403)
  - `El registro QR obtiene identidad y hora en el servidor` → Validation (422)
  - `Credencial QR inválida, vencida o revocada` → Validation (422)
  - `El lector QR no está habilitado` → Validation (422)
  - `La marcación manual requiere persona, hora y motivo` → Validation (422)
  - `La persona no tiene perfil activo de alumno o docente` → Validation (422)

## validar_asistencia

```sql
validar_asistencia() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Contexto inmutable; matrícula confirmada en la sección y jornada programada (y sesión no cancelada); "justificado" solo con justificación aprobada; marcaciones de la misma persona, día y ventanas de la política; "ausente" sin entrada; presencia sin marcación solo si la política admite manual; "tarde" debe coincidir con la tolerancia.
- **Triggers:** `asistencia_docentes`.`controlar_asistencia_docente` (BEFORE INSERT OR UPDATE); `asistencia_estudiantes`.`controlar_asistencia_estudiante` (BEFORE INSERT OR UPDATE)
- **Lee:** [`asistencia_estudiantes`](dominios/04-asistencia.md#asistencia_estudiantes), [`docentes`](dominios/06-personal-planilla.md#docentes), [`estudiantes`](dominios/02-matricula.md#estudiantes), [`jornadas_docente`](dominios/04-asistencia.md#jornadas_docente), [`jornadas_seccion`](dominios/04-asistencia.md#jornadas_seccion), [`justificaciones_asistencia`](dominios/04-asistencia.md#justificaciones_asistencia), [`marcaciones`](dominios/04-asistencia.md#marcaciones), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones), [`matriculas`](dominios/02-matricula.md#matriculas), [`politicas_asistencia`](dominios/04-asistencia.md#politicas_asistencia), [`sesiones_clase`](dominios/03-academico-evaluacion.md#sesiones_clase)
- **Errores (`P0001`):**
  - `No se puede cambiar el contexto de la asistencia` → Conflict (409)
  - `No se puede cambiar la jornada de la asistencia` → Conflict (409)
  - `La jornada, la matrícula o la sesión no coinciden` → Validation (422)
  - `El estado justificado requiere una solicitud aprobada` → Validation (422)
  - `La marcación de entrada no corresponde a la jornada` → Validation (422)
  - `La marcación de salida no corresponde a la jornada` → Validation (422)
  - `Las marcaciones contradicen el estado o el orden de la jornada` → Validation (422)
  - `La política exige una marcación para registrar presencia` → Validation (422)
  - `El estado no coincide con la tolerancia de entrada` → Validation (422)

## validar_fecha_jornada

```sql
validar_fecha_jornada() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** La fecha de la jornada debe estar dentro del año académico y de la vigencia de su política.
- **Triggers:** `jornadas_docente`.`controlar_jornada_docente` (BEFORE INSERT OR UPDATE); `jornadas_seccion`.`controlar_jornada_seccion` (BEFORE INSERT OR UPDATE)
- **Lee:** [`anios_academicos`](dominios/03-academico-evaluacion.md#anios_academicos), [`politicas_asistencia`](dominios/04-asistencia.md#politicas_asistencia)
- **Errores (`P0001`):**
  - `La jornada debe estar dentro del año y de la vigencia de su política` → Validation (422)

## validar_justificacion

```sql
validar_justificacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Nace pendiente; se resuelve una vez sin cambiar contenido; solo se justifica una asistencia "ausente" o "tarde".
- **Triggers:** `justificaciones_asistencia`.`controlar_justificacion` (BEFORE INSERT OR UPDATE)
- **Lee:** [`asistencia_docentes`](dominios/04-asistencia.md#asistencia_docentes), [`asistencia_estudiantes`](dominios/04-asistencia.md#asistencia_estudiantes)
- **Errores (`P0001`):**
  - `La justificación se registra primero como pendiente` → Conflict (409)
  - `Solo se puede resolver una solicitud pendiente, conservando su contenido` → Conflict (409)
  - `Solo se justifica una ausencia o tardanza registrada` → Validation (422)

## emitir_recibo_caja

```sql
emitir_recibo_caja(p_pago_id bigint, p_serie_id bigint, p_usuario_id bigint) RETURNS excelencia_seruna.recibos_caja
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Emite (o devuelve si ya existe) el recibo interno de un pago vigente y totalmente aplicado, tomando el correlativo de la serie activa con bloqueo. Idempotente por pago.
- **Escribe o bloquea:** [`recibos_caja`](dominios/05-cobros.md#recibos_caja), [`series_recibos`](dominios/05-cobros.md#series_recibos)
- **Lee:** [`aplicaciones_pago`](dominios/05-cobros.md#aplicaciones_pago), [`pagos`](dominios/05-cobros.md#pagos), [`reversiones_pago`](dominios/05-cobros.md#reversiones_pago)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `El recibo requiere un pago vigente con el importe totalmente aplicado` → Validation (422)

## preservar_registro_financiero

```sql
preservar_registro_financiero() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **search_path:** no fijado
- **Propósito:** Prohíbe UPDATE/DELETE en cuotas, pagos, aplicaciones y recibos (un UPDATE sin cambios se usa como bloqueo de fila). Las correcciones van por ajuste, devolución o reversión.
- **Triggers:** `aplicaciones_pago`.`preservar_aplicacion` (BEFORE DELETE OR UPDATE); `cuotas`.`preservar_cuota` (BEFORE DELETE OR UPDATE); `pagos`.`preservar_pago` (BEFORE DELETE OR UPDATE); `recibos_caja`.`preservar_recibo` (BEFORE DELETE OR UPDATE)
- **Errores (`P0001`):**
  - `Registre un ajuste o reversión para corregir %` → Conflict (409)

## reporte_cuotas_al_corte

```sql
reporte_cuotas_al_corte(p_anio bigint, p_corte date) RETURNS TABLE(cuota_id bigint, matricula_id bigint, grado_id bigint, concepto text, vence_en date, importe numeric, ajustes numeric, abonado numeric, saldo numeric)
```

- **Tipo:** invocable desde la app · **Lenguaje:** sql · **Volatilidad:** STABLE · **Config:** `search_path=excelencia_seruna, public`
- **Privilegios en el dump:** `REVOKE ALL ... FROM PUBLIC` (no aplicado por `--no-privileges`).
- **Propósito:** Cuotas emitidas hasta la fecha de corte con importe, ajustes, abonado neto (sin pagos revertidos ni devoluciones al corte) y saldo. Base de morosidad, estado de cuenta y dashboard.
- **Invocada por:** [`indicadores_dashboard`](#indicadores_dashboard), [`preparar_documento_reporte`](#preparar_documento_reporte)
- **Lee:** [`ajustes_cuota`](dominios/05-cobros.md#ajustes_cuota), [`aplicaciones_pago`](dominios/05-cobros.md#aplicaciones_pago), [`cuotas`](dominios/05-cobros.md#cuotas), [`devoluciones`](dominios/05-cobros.md#devoluciones), [`pagos`](dominios/05-cobros.md#pagos), [`reversiones_pago`](dominios/05-cobros.md#reversiones_pago)
- **Errores:** no lanza excepciones propias.

## validar_aplicacion_pago

```sql
validar_aplicacion_pago() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Bloquea pago y cuota; el pago no debe estar revertido ni tener recibo; las aplicaciones no exceden el pago; la cuota debe ser exigible a la fecha del pago; el abono no excede el saldo.
- **Triggers:** `aplicaciones_pago`.`controlar_abono` (BEFORE INSERT)
- **Escribe o bloquea:** [`cuotas`](dominios/05-cobros.md#cuotas), [`pagos`](dominios/05-cobros.md#pagos)
- **Lee:** [`aplicaciones_pago`](dominios/05-cobros.md#aplicaciones_pago), [`recibos_caja`](dominios/05-cobros.md#recibos_caja), [`reversiones_pago`](dominios/05-cobros.md#reversiones_pago), [`saldos_cuotas`](triggers-y-vistas.md#vista-saldos_cuotas)
- **Errores (`P0001`):**
  - `El pago no admite nuevas aplicaciones` → Conflict (409)
  - `Las aplicaciones exceden el importe del pago` → Validation (422)
  - `La cuota no existe o aún no es exigible` → Validation (422)
  - `El abono excede el saldo de la cuota` → Validation (422)

## validar_emision_cuota

```sql
validar_emision_cuota() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** La cuota debe reproducir exactamente un tramo de un plan publicado y vigente para una matrícula activa; la matrícula no puede superar la pensión de referencia; las cuotas de ingreso no superan el importe acordado.
- **Triggers:** `cuotas`.`controlar_emision` (BEFORE INSERT)
- **Escribe o bloquea:** [`obligaciones_ingreso`](dominios/05-cobros.md#obligaciones_ingreso)
- **Lee:** [`cuotas`](dominios/05-cobros.md#cuotas), [`matriculas`](dominios/02-matricula.md#matriculas), [`planes_cobro`](dominios/05-cobros.md#planes_cobro), [`tramos_plan_cobro`](dominios/05-cobros.md#tramos_plan_cobro)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `La cuota debe reproducir un tramo válido de un plan publicado para una matrícula activa` → Validation (422)
  - `Las cuotas superan el importe de ingreso acordado` → Validation (422)

## auditar_documento_reporte

```sql
auditar_documento_reporte() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Registra en bitácora la solicitud, el procesamiento o la anulación de un documento emitido.
- **Triggers:** `documentos_emitidos`.`auditar_documento_reporte` (AFTER INSERT OR UPDATE)
- **Escribe o bloquea:** [`bitacora`](dominios/01-identidad-permisos.md#bitacora)
- **Errores:** no lanza excepciones propias.

## preparar_documento_reporte

```sql
preparar_documento_reporte(p_uuid uuid, p_plantilla bigint, p_actor bigint, p_desde date, p_hasta date, p_matricula bigint DEFAULT NULL::bigint, p_seccion bigint DEFAULT NULL::bigint, p_bimestre bigint DEFAULT NULL::bigint) RETURNS excelencia_seruna.documentos_emitidos
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Privilegios en el dump:** `REVOKE ALL ... FROM PUBLIC` (no aplicado por `--no-privileges`).
- **Propósito:** Crea la solicitud de documento (cola) de una plantilla publicada: valida el permiso del actor (tipos_reporte.permiso), los filtros del año y los admitidos por tipo, y congela los datos (ficha, nómina, estado de cuenta, notas, asistencia, dashboard). Idempotente por p_uuid.
- **Escribe o bloquea:** [`documentos_emitidos`](dominios/07-documentos-reportes.md#documentos_emitidos)
- **Lee:** [`asistencia_diaria_docentes`](triggers-y-vistas.md#vista-asistencia_diaria_docentes), [`asistencia_diaria_estudiantes`](triggers-y-vistas.md#vista-asistencia_diaria_estudiantes), [`asistencia_docentes`](dominios/04-asistencia.md#asistencia_docentes), [`bimestres`](dominios/03-academico-evaluacion.md#bimestres), [`docentes`](dominios/06-personal-planilla.md#docentes), [`estudiantes`](dominios/02-matricula.md#estudiantes), [`matriculas`](dominios/02-matricula.md#matriculas), [`permisos`](dominios/01-identidad-permisos.md#permisos), [`personas`](dominios/01-identidad-permisos.md#personas), [`plantillas_documento`](dominios/07-documentos-reportes.md#plantillas_documento), [`reporte_nomina_matriculas`](triggers-y-vistas.md#vista-reporte_nomina_matriculas), [`reporte_notas_publicadas`](triggers-y-vistas.md#vista-reporte_notas_publicadas), [`rol_permisos`](dominios/01-identidad-permisos.md#rol_permisos), [`secciones`](dominios/03-academico-evaluacion.md#secciones), [`tipos_reporte`](dominios/07-documentos-reportes.md#tipos_reporte), [`usuario_roles`](dominios/01-identidad-permisos.md#usuario_roles), [`usuarios`](dominios/01-identidad-permisos.md#usuarios)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `Indique identificador y fechas válidas para el reporte` → Validation (422)
  - `La cuenta no está autorizada para este tipo de reporte` → Forbidden (403)
  - `Los filtros no pertenecen al año de la plantilla` → Validation (422)
  - `El tipo de reporte no admite uno de los filtros enviados` → Conflict (409)
  - `El identificador ya corresponde a otra solicitud` → Conflict (409)
  - `Seleccione una matrícula` → Validation (422)
  - `Seleccione un bimestre` → Validation (422)
  - `Tipo de reporte sin consulta implementada` → Validation (422)

## proteger_documento_reporte

```sql
proteger_documento_reporte() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Documentos y plantillas no se borran; plantilla publicada inmutable; documento nace "preparado", datos inmutables, transiciones preparado → emitido/fallido y emitido → anulado; al emitir, el archivo debe tener bytes > 0 y MIME acorde al formato.
- **Triggers:** `documentos_emitidos`.`proteger_documento_emitido` (BEFORE INSERT OR DELETE OR UPDATE); `plantillas_documento`.`proteger_plantilla_publicada` (BEFORE DELETE OR UPDATE)
- **Lee:** [`archivos`](dominios/07-documentos-reportes.md#archivos), [`plantillas_documento`](dominios/07-documentos-reportes.md#plantillas_documento)
- **Errores (`P0001`):**
  - `El historial del documento debe conservarse` → Conflict (409)
  - `Cree una versión nueva de la plantilla publicada` → Validation (422)
  - `Una solicitud de documento debe empezar como preparada` → Conflict (409)
  - `Los datos de la solicitud son inmutables` → Conflict (409)
  - `Transición de documento no permitida` → Conflict (409)
  - `El archivo emitido debe coincidir con el formato de la plantilla` → Validation (422)

## avanzar_lote_historico

```sql
avanzar_lote_historico(p_lote bigint, p_actor bigint) RETURNS text
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Privilegios en el dump:** `REVOKE ALL ... FROM PUBLIC` (no aplicado por `--no-privileges`).
- **Propósito:** Avanza un lote: carga → revisión (sella si los conteos cargados coinciden con conteos_esperados) y revisión → cerrado (si no quedan filas pendientes). Exige permiso datos.conciliar_historico. Devuelve el estado destino, o el actual si ya estaba cerrado.
- **Escribe o bloquea:** [`bitacora`](dominios/01-identidad-permisos.md#bitacora), [`lotes_importacion`](dominios/08-importacion-historica.md#lotes_importacion)
- **Lee:** [`resumen_importacion_historica`](triggers-y-vistas.md#vista-resumen_importacion_historica)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `El conteo de filas cargadas difiere del manifiesto` → Validation (422)
  - `El lote tiene filas pendientes de conciliación` → Validation (422)

## conciliar_fila_historica

```sql
conciliar_fila_historica(p_lote bigint, p_entidad text, p_clave text, p_actor bigint, p_accion text, p_motivo text, p_destino bigint DEFAULT NULL::bigint, p_codigo text DEFAULT NULL::text, p_persona_existente bigint DEFAULT NULL::bigint) RETURNS excelencia_seruna.conciliaciones_historicas
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Privilegios en el dump:** `REVOKE ALL ... FROM PUBLIC` (no aplicado por `--no-privileges`).
- **Propósito:** Concilia una fila de un lote en revisión: crear (alumno/docente inactivo con código interno; crea la persona si no se indica una existente), vincular a un registro existente, archivar o excluir. Registra equivalencia, conciliación y bitácora. Repetir la misma decisión (no "crear") es idempotente.
- **Escribe o bloquea:** [`bitacora`](dominios/01-identidad-permisos.md#bitacora), [`conciliaciones_historicas`](dominios/08-importacion-historica.md#conciliaciones_historicas), [`docentes`](dominios/06-personal-planilla.md#docentes), [`equivalencias_historicas`](dominios/08-importacion-historica.md#equivalencias_historicas), [`estudiantes`](dominios/02-matricula.md#estudiantes), [`personas`](dominios/01-identidad-permisos.md#personas)
- **Lee:** [`filas_importacion`](dominios/08-importacion-historica.md#filas_importacion), [`lotes_importacion`](dominios/08-importacion-historica.md#lotes_importacion), [`matriculas`](dominios/02-matricula.md#matriculas)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `Indique una acción y su sustento` → Validation (422)
  - `Los parámetros no corresponden a la acción` → Validation (422)
  - `La fila ya está conciliada en este lote` → Conflict (409)
  - `El lote debe estar en revisión` → Validation (422)
  - `Este origen se conserva en el archivo histórico` → Validation (422)
  - `El origen ya tiene otra equivalencia registrada` → Conflict (409)
  - `Solo se crean perfiles con código interno validado` → Validation (422)
  - `Verifique nombres y apellidos o vincule con una persona existente` → Validation (422)
  - `Verifique la fecha de nacimiento` → Validation (422)
  - `La matrícula debe estar confirmada y pertenecer al estudiante conciliado` → Validation (422)

## controlar_carga_historica

```sql
controlar_carga_historica() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Filas solo de inserción, solo con el lote en "carga"; rechaza valores anidados y claves que parezcan credenciales (clave, contraseña, password, hash, token, secret, salt, credencial).
- **Triggers:** `filas_importacion`.`controlar_fila_importacion` (BEFORE INSERT OR DELETE OR UPDATE)
- **Lee:** [`lotes_importacion`](dominios/08-importacion-historica.md#lotes_importacion)
- **Errores (`P0001`):**
  - `El archivo de origen es inmutable` → Conflict (409)
  - `El lote debe estar en carga` → Validation (422)
  - `La fila contiene credenciales o una estructura no permitida` → Validation (422)

## validar_operador_importacion

```sql
validar_operador_importacion(p_actor bigint) RETURNS void
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** STABLE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Verifica que el actor sea un usuario activo con el permiso datos.conciliar_historico.
- **Invocada por:** [`avanzar_lote_historico`](#avanzar_lote_historico), [`conciliar_fila_historica`](#conciliar_fila_historica)
- **Lee:** [`permisos`](dominios/01-identidad-permisos.md#permisos), [`rol_permisos`](dominios/01-identidad-permisos.md#rol_permisos), [`usuario_roles`](dominios/01-identidad-permisos.md#usuario_roles), [`usuarios`](dominios/01-identidad-permisos.md#usuarios)
- **Errores (`P0001`):**
  - `La cuenta no está autorizada para conciliar datos históricos` → Forbidden (403)

## validar_ocupacion_seccion

```sql
validar_ocupacion_seccion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Sección activa; vigencia dentro del año; controla cupo total y vacantes regulares vs. reservadas en cada fecha de inicio solapada.
- **Triggers:** `matricula_secciones`.`controlar_cupo` (BEFORE INSERT OR UPDATE OF seccion_id, anio_id, vigencia, tipo_vacante)
- **Escribe o bloquea:** [`secciones`](dominios/03-academico-evaluacion.md#secciones)
- **Lee:** [`anios_academicos`](dominios/03-academico-evaluacion.md#anios_academicos), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones)
- **Errores (`P0001`):**
  - `La sección no está activa` → Validation (422)
  - `La vigencia de la sección debe quedar dentro del año académico` → Validation (422)
  - `No hay cupo para el tipo de vacante seleccionado` → Validation (422)

## auditar_planilla

```sql
auditar_planilla() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Registra en bitácora la resolución de horas, la aprobación de liquidaciones, los pagos y las reversiones docentes.
- **Triggers:** `horas_docentes`.`auditar_horas_docentes` (AFTER UPDATE); `liquidaciones_docentes`.`auditar_liquidacion_docente` (AFTER UPDATE); `pagos_docentes`.`auditar_pago_docente` (AFTER INSERT); `reversiones_pago_docente`.`auditar_reversion_docente` (AFTER INSERT)
- **Escribe o bloquea:** [`bitacora`](dominios/01-identidad-permisos.md#bitacora)
- **Lee:** [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes), [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes), [`reversiones_pago_docente`](dominios/06-personal-planilla.md#reversiones_pago_docente)
- **Errores:** no lanza excepciones propias.

## conservar_condiciones_contrato

```sql
conservar_condiciones_contrato() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Si el contrato ya tiene horas o liquidaciones, solo permite cambiar la vigencia, y solo si sigue cubriendo esas horas y vigencias aplicadas.
- **Triggers:** `contratos_docentes`.`controlar_cambio_contrato` (BEFORE UPDATE)
- **Lee:** [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes), [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes), [`periodos_liquidacion`](dominios/06-personal-planilla.md#periodos_liquidacion)
- **Errores (`P0001`):**
  - `El cambio de contrato alteraría horas o condiciones ya registradas` → Conflict (409)

## conservar_historial_planilla

```sql
conservar_historial_planilla() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **search_path:** no fijado
- **Propósito:** Prohíbe borrar o modificar historial de planilla (horas, períodos, liquidaciones aprobadas, pagos y reversiones docentes).
- **Triggers:** `horas_docentes`.`conservar_horas_docentes` (BEFORE DELETE); `liquidaciones_docentes`.`conservar_liquidacion_aprobada` (BEFORE DELETE); `pagos_docentes`.`conservar_pago_docente` (BEFORE DELETE OR UPDATE); `periodos_liquidacion`.`conservar_periodo_planilla` (BEFORE DELETE); `reversiones_pago_docente`.`conservar_reversion_docente` (BEFORE DELETE OR UPDATE)
- **Errores (`P0001`):**
  - `La operación sobrescribiría el historial de planilla` → Conflict (409)

## controlar_periodo_planilla

```sql
controlar_periodo_planilla() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Período: nace abierto; solo pasa a cerrado sin cambiar datos y si no hay liquidaciones en borrador ni horas pendientes o aprobadas sin liquidar en el mes.
- **Triggers:** `periodos_liquidacion`.`controlar_periodo_planilla` (BEFORE INSERT OR UPDATE)
- **Lee:** [`detalle_liquidacion_docente`](dominios/06-personal-planilla.md#detalle_liquidacion_docente), [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes), [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes)
- **Errores (`P0001`):**
  - `El período debe empezar abierto` → Conflict (409)
  - `Solo se permite cerrar el período conservando sus datos` → Conflict (409)
  - `El período tiene horas o liquidaciones pendientes` → Validation (422)

## validar_detalle_liquidacion

```sql
validar_detalle_liquidacion() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Sin UPDATE; solo con liquidación en borrador; las líneas "horas" exigen una hora aprobada del contrato dentro de la vigencia aplicada y modalidad por horas.
- **Triggers:** `detalle_liquidacion_docente`.`controlar_detalle_liquidacion` (BEFORE INSERT OR DELETE OR UPDATE)
- **Escribe o bloquea:** [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes)
- **Lee:** [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `Reemplace el detalle mientras esté en borrador` → Conflict (409)
  - `La liquidación aprobada no admite cambios` → Conflict (409)
  - `El detalle requiere horas aprobadas del contrato y período de la liquidación` → Validation (422)

## validar_horas_docente

```sql
validar_horas_docente() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Horas: nacen pendientes y se resuelven una vez sin cambiar contenido; contrato por horas vigente; solo horas ya trabajadas (hora Lima); si hay sesión debe ser "realizada" del mismo docente y contener el tramo; aprobar exige período abierto y sin liquidación aprobada.
- **Triggers:** `horas_docentes`.`controlar_horas_docente` (BEFORE INSERT OR UPDATE)
- **Escribe o bloquea:** [`periodos_liquidacion`](dominios/06-personal-planilla.md#periodos_liquidacion)
- **Lee:** [`contratos_docentes`](dominios/06-personal-planilla.md#contratos_docentes), [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes), [`sesiones_clase`](dominios/03-academico-evaluacion.md#sesiones_clase)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `Solo se puede resolver una hora pendiente y conservar su contenido` → Conflict (409)
  - `Las horas deben registrarse primero como pendientes` → Conflict (409)
  - `Las horas requieren un contrato por horas vigente para la fecha` → Validation (422)
  - `Solo se pueden registrar horas ya trabajadas` → Validation (422)
  - `Las horas deben pertenecer a una sesión realizada por el docente` → Validation (422)
  - `Abra el período mensual antes de aprobar horas` → Validation (422)
  - `Las horas corresponden a una liquidación o período cerrado` → Validation (422)

## validar_liquidacion_docente

```sql
validar_liquidacion_docente() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Nace en borrador en período abierto; congela modalidad, tarifa y sueldo del contrato y calcula vigencia_aplicada (mes ∩ contrato); sueldo parcial exige importe y motivo; aprobar exige neto ≥ 0, minutos > 0 (por horas) e incluir todas las horas aprobadas del mes.
- **Triggers:** `liquidaciones_docentes`.`controlar_liquidacion_docente` (BEFORE INSERT OR UPDATE)
- **Escribe o bloquea:** [`periodos_liquidacion`](dominios/06-personal-planilla.md#periodos_liquidacion)
- **Lee:** [`contratos_docentes`](dominios/06-personal-planilla.md#contratos_docentes), [`detalle_liquidacion_docente`](dominios/06-personal-planilla.md#detalle_liquidacion_docente), [`horas_docentes`](dominios/06-personal-planilla.md#horas_docentes), [`totales_liquidacion_docente`](triggers-y-vistas.md#vista-totales_liquidacion_docente)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `La liquidación solo puede pasar de borrador a aprobada` → Conflict (409)
  - `La liquidación debe empezar en borrador` → Conflict (409)
  - `El período de liquidación está cerrado` → Conflict (409)
  - `El contrato no estuvo vigente durante el período` → Validation (422)
  - `El sueldo parcial requiere importe autorizado y motivo` → Validation (422)
  - `La liquidación requiere un neto válido y, por horas, tiempo aprobado` → Validation (422)
  - `Resuelva las horas pendientes e incluya todas las horas aprobadas del período` → Validation (422)

## validar_movimiento_pago_docente

```sql
validar_movimiento_pago_docente() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **Config:** `search_path=excelencia_seruna, public`
- **Propósito:** Exige liquidación aprobada; el pago no excede el saldo; la reversión debe ser posterior al pago.
- **Triggers:** `pagos_docentes`.`controlar_pago_docente` (BEFORE INSERT); `reversiones_pago_docente`.`controlar_reversion_docente` (BEFORE INSERT)
- **Escribe o bloquea:** [`liquidaciones_docentes`](dominios/06-personal-planilla.md#liquidaciones_docentes)
- **Lee:** [`pagos_docentes`](dominios/06-personal-planilla.md#pagos_docentes), [`saldos_liquidacion_docente`](triggers-y-vistas.md#vista-saldos_liquidacion_docente)
- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).
- **Errores (`P0001`):**
  - `La reversión debe ser posterior al pago` → Validation (422)
  - `El pago requiere una liquidación aprobada` → Validation (422)
  - `El pago excede el saldo de la liquidación` → Validation (422)

## indicadores_dashboard

```sql
indicadores_dashboard(p_anio bigint, p_desde date, p_hasta date, p_bimestre bigint DEFAULT NULL::bigint) RETURNS jsonb
```

- **Tipo:** invocable desde la app · **Lenguaje:** plpgsql · **Volatilidad:** STABLE · **Config:** `search_path=excelencia_seruna, public`
- **Privilegios en el dump:** `REVOKE ALL ... FROM PUBLIC` (no aplicado por `--no-privileges`).
- **Propósito:** jsonb con indicadores del año y rango: matrícula (activas, cupo, vacantes), pagos (cobrado bruto/neto, devuelto, revertido, saldo pendiente/vencido, matrículas con mora), avance de notas del bimestre y asistencia de alumnos y docentes. Fechas en America/Lima.
- **Invocada por:** [`preparar_documento_reporte`](#preparar_documento_reporte)
- **Lee:** [`anios_academicos`](dominios/03-academico-evaluacion.md#anios_academicos), [`aplicaciones_pago`](dominios/05-cobros.md#aplicaciones_pago), [`asistencia_diaria_docentes`](triggers-y-vistas.md#vista-asistencia_diaria_docentes), [`asistencia_diaria_estudiantes`](triggers-y-vistas.md#vista-asistencia_diaria_estudiantes), [`bimestres`](dominios/03-academico-evaluacion.md#bimestres), [`calificaciones_competencia`](dominios/03-academico-evaluacion.md#calificaciones_competencia), [`cierres_evaluacion`](dominios/03-academico-evaluacion.md#cierres_evaluacion), [`cuotas`](dominios/05-cobros.md#cuotas), [`devoluciones`](dominios/05-cobros.md#devoluciones), [`docentes`](dominios/06-personal-planilla.md#docentes), [`matricula_secciones`](dominios/02-matricula.md#matricula_secciones), [`matriculas`](dominios/02-matricula.md#matriculas), [`pagos`](dominios/05-cobros.md#pagos), [`plan_competencias`](dominios/03-academico-evaluacion.md#plan_competencias), [`reversiones_pago`](dominios/05-cobros.md#reversiones_pago), [`seccion_planes_estudio`](dominios/03-academico-evaluacion.md#seccion_planes_estudio), [`secciones`](dominios/03-academico-evaluacion.md#secciones)
- **Errores (`P0001`):**
  - `Indique un año académico y un rango de fechas válido` → Validation (422)
  - `El bimestre no pertenece al año académico` → Validation (422)

## conservar_evento_asistencia

```sql
conservar_evento_asistencia() RETURNS trigger
```

- **Tipo:** función de trigger · **Lenguaje:** plpgsql · **Volatilidad:** VOLATILE · **search_path:** no fijado
- **Propósito:** Prohíbe la operación ("solo inserción"). Se reutiliza en marcaciones, asistencia y justificaciones (DELETE) y también en conciliaciones_historicas y equivalencias_historicas, aunque el mensaje mencione asistencia.
- **Triggers:** `asistencia_docentes`.`conservar_asistencia_docente` (BEFORE DELETE); `asistencia_estudiantes`.`conservar_asistencia_estudiante` (BEFORE DELETE); `conciliaciones_historicas`.`conservar_conciliacion` (BEFORE DELETE OR UPDATE); `equivalencias_historicas`.`conservar_equivalencia` (BEFORE DELETE OR UPDATE); `justificaciones_asistencia`.`conservar_justificacion` (BEFORE DELETE); `marcaciones`.`conservar_marcaciones` (BEFORE DELETE OR UPDATE)
- **Errores (`P0001`):**
  - `El historial de asistencia es de solo inserción` → Conflict (409)

<a id="catalogo-de-mensajes-de-error"></a>
## Catálogo de mensajes de error

134 mensajes distintos. La columna "Dominio" es una **propuesta inicial** de traducción a errores tipados (Validation 422, Conflict 409, Forbidden 403, NotFound 404) que se fija en la Fase 1.

| Mensaje | Dominio | HTTP | Funciones |
|---|---|---|---|
| Abra el período mensual antes de aprobar horas | Validation | 422 | validar_horas_docente |
| Actualice el borrador según los últimos logros publicados | Validation | 422 | controlar_cierre_anual |
| Apruebe el borrador sin modificar su contenido | Conflict | 409 | controlar_evaluacion_recuperacion |
| Cierre el bimestre antes de publicarlo | Conflict | 409 | validar_cierre_evaluacion |
| Configure los cuatro bimestres, la sección y el plan al cierre del cuarto bimestre | Validation | 422 | controlar_cierre_anual |
| Credencial QR inválida, vencida o revocada | Validation | 422 | registrar_marcacion |
| Cree una nueva versión de la publicación de mérito | Conflict | 409 | controlar_publicacion_merito |
| Cree una versión nueva de la plantilla publicada | Validation | 422 | proteger_documento_reporte |
| El abono excede el saldo de la cuota | Validation | 422 | validar_aplicacion_pago |
| El archivo de origen es inmutable | Conflict | 409 | controlar_carga_historica |
| El archivo emitido debe coincidir con el formato de la plantilla | Validation | 422 | proteger_documento_reporte |
| El bimestre no pertenece al año académico | Validation | 422 | indicadores_dashboard |
| El cambio de contrato alteraría horas o condiciones ya registradas | Conflict | 409 | conservar_condiciones_contrato |
| El cierre aprobado debe conservarse | Conflict | 409 | controlar_cierre_anual |
| El cierre aprobado es inmutable | Conflict | 409 | controlar_resultado_anual |
| El cierre aprobado o su contexto no se pueden modificar | Conflict | 409 | controlar_cierre_anual |
| El cierre no admite cambios de notas | Conflict | 409 | validar_calificacion |
| El conteo de filas cargadas difiere del manifiesto | Validation | 422 | avanzar_lote_historico |
| El contexto del cierre no se puede cambiar | Conflict | 409 | validar_cierre_evaluacion |
| El contrato no estuvo vigente durante el período | Validation | 422 | validar_liquidacion_docente |
| El detalle requiere horas aprobadas del contrato y período de la liquidación | Validation | 422 | validar_detalle_liquidacion |
| El estado justificado requiere una solicitud aprobada | Validation | 422 | validar_asistencia |
| El estado no coincide con la tolerancia de entrada | Validation | 422 | validar_asistencia |
| El historial de asistencia es de solo inserción | Conflict | 409 | conservar_evento_asistencia |
| El historial de recuperación debe conservarse | Conflict | 409 | controlar_evaluacion_recuperacion |
| El historial del documento debe conservarse | Conflict | 409 | proteger_documento_reporte |
| El identificador ya corresponde a otra solicitud | Conflict | 409 | preparar_documento_reporte |
| El lector QR no está habilitado | Validation | 422 | registrar_marcacion |
| El listado debe contener puestos consecutivos desde el primero | Conflict | 409 | controlar_publicacion_merito |
| El listado publicado es inmutable | Conflict | 409 | controlar_puesto_merito |
| El lote debe estar en carga | Validation | 422 | controlar_carga_historica |
| El lote debe estar en revisión | Validation | 422 | conciliar_fila_historica |
| El lote tiene filas pendientes de conciliación | Validation | 422 | avanzar_lote_historico |
| El mérito requiere Secundaria y una regla aprobada; el alcance completo usa quinto grado | Validation | 422 | controlar_publicacion_merito |
| El origen ya tiene otra equivalencia registrada | Conflict | 409 | conciliar_fila_historica |
| El pago excede el saldo de la liquidación | Validation | 422 | validar_movimiento_pago_docente |
| El pago no admite nuevas aplicaciones | Conflict | 409 | validar_aplicacion_pago |
| El pago requiere una liquidación aprobada | Validation | 422 | validar_movimiento_pago_docente |
| El período de liquidación está cerrado | Conflict | 409 | validar_liquidacion_docente |
| El período debe empezar abierto | Conflict | 409 | controlar_periodo_planilla |
| El período tiene horas o liquidaciones pendientes | Validation | 422 | controlar_periodo_planilla |
| El puesto debe apuntar a un cierre lectivo aprobado del mismo año y grado | Validation | 422 | controlar_puesto_merito |
| El recibo requiere un pago vigente con el importe totalmente aplicado | Validation | 422 | emitir_recibo_caja |
| El registro QR obtiene identidad y hora en el servidor | Validation | 422 | registrar_marcacion |
| El sueldo parcial requiere importe autorizado y motivo | Validation | 422 | validar_liquidacion_docente |
| El tipo de reporte no admite uno de los filtros enviados | Conflict | 409 | preparar_documento_reporte |
| Ese UUID ya identifica otra marcación | Conflict | 409 | registrar_marcacion |
| Este origen se conserva en el archivo histórico | Validation | 422 | conciliar_fila_historica |
| Faltan códigos SIAGIE o mapeos de competencias del cierre | Validation | 422 | preparar_exportacion_siagie |
| Faltan competencias del plan para la nómina al cierre del bimestre | Validation | 422 | validar_cierre_evaluacion |
| Faltan resultados anuales del plan de estudios | Validation | 422 | controlar_cierre_anual |
| Hay bimestres cursados sin resultados publicados | Validation | 422 | controlar_cierre_anual |
| Hay notas pendientes o faltan conclusiones descriptivas obligatorias | Validation | 422 | validar_cierre_evaluacion |
| Identifique las competencias pendientes de recuperación | Validation | 422 | controlar_cierre_anual |
| Indique el motivo de la rectificación | Validation | 422 | validar_calificacion |
| Indique el UUID del evento y si es entrada o salida | Validation | 422 | registrar_marcacion |
| Indique identificador y fechas válidas para el reporte | Validation | 422 | preparar_documento_reporte |
| Indique un año académico y un rango de fechas válido | Validation | 422 | indicadores_dashboard |
| Indique una acción y su sustento | Validation | 422 | conciliar_fila_historica |
| La competencia debe estar pendiente en un cierre aprobado | Validation | 422 | controlar_evaluacion_recuperacion |
| La cuenta no está autorizada para conciliar datos históricos | Forbidden | 403 | validar_operador_importacion |
| La cuenta no está autorizada para este tipo de reporte | Forbidden | 403 | preparar_documento_reporte |
| La cuota debe reproducir un tramo válido de un plan publicado para una matrícula activa | Validation | 422 | validar_emision_cuota |
| La cuota no existe o aún no es exigible | Validation | 422 | validar_aplicacion_pago |
| La fecha o vigencia debe quedar dentro de la asignación docente | Validation | 422 | validar_vigencia_horario |
| La fecha o vigencia debe quedar dentro del plan de la sección | Validation | 422 | validar_vigencia_horario |
| La fila contiene credenciales o una estructura no permitida | Validation | 422 | controlar_carga_historica |
| La fila ya está conciliada en este lote | Conflict | 409 | conciliar_fila_historica |
| La fuente del resultado anual no coincide con el cierre | Validation | 422 | controlar_resultado_anual |
| La identidad de la calificación no se puede cambiar | Conflict | 409 | validar_calificacion |
| La jornada debe estar dentro del año y de la vigencia de su política | Validation | 422 | validar_fecha_jornada |
| La jornada, la matrícula o la sesión no coinciden | Validation | 422 | validar_asistencia |
| La justificación se registra primero como pendiente | Conflict | 409 | validar_justificacion |
| La liquidación aprobada no admite cambios | Conflict | 409 | validar_detalle_liquidacion |
| La liquidación debe empezar en borrador | Conflict | 409 | validar_liquidacion_docente |
| La liquidación requiere un neto válido y, por horas, tiempo aprobado | Validation | 422 | validar_liquidacion_docente |
| La liquidación solo puede pasar de borrador a aprobada | Conflict | 409 | validar_liquidacion_docente |
| La marcación de entrada no corresponde a la jornada | Validation | 422 | validar_asistencia |
| La marcación de salida no corresponde a la jornada | Validation | 422 | validar_asistencia |
| La marcación manual requiere persona, hora y motivo | Validation | 422 | registrar_marcacion |
| La marcación requiere un operador activo | Forbidden | 403 | registrar_marcacion |
| La matrícula debe estar confirmada y pertenecer al estudiante conciliado | Validation | 422 | conciliar_fila_historica |
| La matrícula y el plan no coinciden con la sección durante el bimestre | Validation | 422 | validar_calificacion |
| La operación sobrescribiría el historial de planilla | Conflict | 409 | conservar_historial_planilla |
| La persona no tiene perfil activo de alumno o docente | Validation | 422 | registrar_marcacion |
| La política exige una marcación para registrar presencia | Validation | 422 | validar_asistencia |
| La publicación de mérito debe conservarse | Conflict | 409 | controlar_publicacion_merito |
| La reversión debe ser posterior al pago | Validation | 422 | validar_movimiento_pago_docente |
| La revisión requiere el cierre aprobado anterior de la misma trayectoria | Validation | 422 | controlar_cierre_anual |
| La sección no está activa | Validation | 422 | validar_ocupacion_seccion |
| La vigencia de la sección debe quedar dentro del año académico | Validation | 422 | validar_ocupacion_seccion |
| Las aplicaciones exceden el importe del pago | Validation | 422 | validar_aplicacion_pago |
| Las cuotas superan el importe de ingreso acordado | Validation | 422 | validar_emision_cuota |
| Las horas corresponden a una liquidación o período cerrado | Validation | 422 | validar_horas_docente |
| Las horas deben pertenecer a una sesión realizada por el docente | Validation | 422 | validar_horas_docente |
| Las horas deben registrarse primero como pendientes | Conflict | 409 | validar_horas_docente |
| Las horas requieren un contrato por horas vigente para la fecha | Validation | 422 | validar_horas_docente |
| Las marcaciones contradicen el estado o el orden de la jornada | Validation | 422 | validar_asistencia |
| Los datos de la solicitud son inmutables | Conflict | 409 | proteger_documento_reporte |
| Los filtros no pertenecen al año de la plantilla | Validation | 422 | preparar_documento_reporte |
| Los parámetros no corresponden a la acción | Validation | 422 | conciliar_fila_historica |
| No hay cupo para el tipo de vacante seleccionado | Validation | 422 | validar_ocupacion_seccion |
| No se puede cambiar el contexto de la asistencia | Conflict | 409 | validar_asistencia |
| No se puede cambiar la jornada de la asistencia | Conflict | 409 | validar_asistencia |
| Publique el bimestre antes de preparar el Excel SIAGIE | Conflict | 409 | preparar_exportacion_siagie |
| Reabra el cierre antes de rectificar | Conflict | 409 | validar_calificacion |
| Reemplace el detalle mientras esté en borrador | Conflict | 409 | validar_detalle_liquidacion |
| Reemplace el puesto mientras el listado esté en borrador | Conflict | 409 | controlar_puesto_merito |
| Reemplace el resultado mientras el cierre esté en borrador | Conflict | 409 | controlar_resultado_anual |
| Registre el listado antes de publicarlo | Conflict | 409 | controlar_publicacion_merito |
| Registre la evaluación de recuperación primero como borrador | Conflict | 409 | controlar_evaluacion_recuperacion |
| Registre primero un cierre en borrador | Conflict | 409 | controlar_cierre_anual |
| Registre un ajuste o reversión para corregir % | Conflict | 409 | preservar_registro_financiero |
| Registre una nueva versión de la regla de evaluación | Conflict | 409 | proteger_regla_evaluacion |
| Resuelva las horas pendientes e incluya todas las horas aprobadas del período | Validation | 422 | validar_liquidacion_docente |
| Se requiere un plan publicado y una vigencia dentro del año escolar | Validation | 422 | validar_plan_seccion |
| Se requiere una regla de evaluación aprobada | Validation | 422 | controlar_cierre_anual |
| Seleccione un bimestre | Validation | 422 | preparar_documento_reporte |
| Seleccione una matrícula | Validation | 422 | preparar_documento_reporte |
| Solo se crean perfiles con código interno validado | Validation | 422 | conciliar_fila_historica |
| Solo se justifica una ausencia o tardanza registrada | Validation | 422 | validar_justificacion |
| Solo se permite cerrar el período conservando sus datos | Conflict | 409 | controlar_periodo_planilla |
| Solo se puede resolver una hora pendiente y conservar su contenido | Conflict | 409 | validar_horas_docente |
| Solo se puede resolver una solicitud pendiente, conservando su contenido | Conflict | 409 | validar_justificacion |
| Solo se pueden registrar horas ya trabajadas | Validation | 422 | validar_horas_docente |
| Tipo de reporte sin consulta implementada | Validation | 422 | preparar_documento_reporte |
| Transición de documento no permitida | Conflict | 409 | proteger_documento_reporte |
| Un cierre debe empezar en borrador | Conflict | 409 | validar_cierre_evaluacion |
| Una competencia pendiente requiere una evaluación aprobada para quedar resuelta | Validation | 422 | controlar_cierre_anual |
| Una solicitud de documento debe empezar como preparada | Conflict | 409 | proteger_documento_reporte |
| Use una rectificación para conservar el historial de la calificación | Validation | 422 | conservar_calificacion |
| Verifique la fecha de nacimiento | Validation | 422 | conciliar_fila_historica |
| Verifique nombres y apellidos o vincule con una persona existente | Validation | 422 | conciliar_fila_historica |
| Vincule al menos una evaluación de recuperación aprobada | Validation | 422 | controlar_cierre_anual |

### SQLSTATE de restricciones

| SQLSTATE | Origen | Dominio propuesto |
|---|---|---|
| `23505` unique_violation | UNIQUE / PK (p. ej. `pagos.clave_idempotencia`, `marcaciones.evento_uuid`) | Conflict (409) |
| `23P01` exclusion_violation | EXCLUDE (solapes de vigencias, horarios, jornadas, contratos) | Conflict (409) |
| `23503` foreign_key_violation | FK (incluidas las compuestas con anio_id/grado_id) | Validation (422) |
| `23514` check_violation | CHECK | Validation (422) |
| `23502` not_null_violation | NOT NULL | Validation (422) |
| `P0002` no_data_found | `INTO STRICT` | NotFound (404) |
| `40001` / `40P01` | serialización / deadlock | reintentar la transacción |