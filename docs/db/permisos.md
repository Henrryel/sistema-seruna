<!-- Archivo generado por scripts/db/generar-docs.mjs a partir del catálogo real. No editar a mano. -->

# Matriz rol → permiso

Roles sembrados: `admin` (Administrador), `docente` (Docente), `alumno` (Alumno), `apoderado` (Apoderado). 32 permisos y 37 asignaciones.

| Permiso | Descripción | admin | docente | alumno | apoderado |
|---|---|:---:|:---:|:---:|:---:|
| **academico** | |  |  |  |  |
| `academico.calificar` | Registrar notas en las asignaciones autorizadas | ✔ | ✔ | · | · |
| `academico.cerrar_anio` | Registrar y aprobar situaciones finales | ✔ | · | · | · |
| `academico.configurar` | Configurar currículo y horarios | ✔ | · | · | · |
| `academico.configurar_cierre_anual` | Versionar reglas de evaluación anual | ✔ | · | · | · |
| `academico.exportar_siagie` | Preparar exportaciones SIAGIE | ✔ | · | · | · |
| `academico.publicar` | Cerrar y publicar evaluaciones | ✔ | · | · | · |
| `academico.publicar_merito` | Conciliar y publicar el listado oficial de SIAGIE | ✔ | · | · | · |
| `academico.recuperacion` | Gestionar evaluaciones de recuperación y subsanación | ✔ | · | · | · |
| **asistencia** | |  |  |  |  |
| `asistencia.configurar` | Configurar jornadas, políticas, lectores y credenciales | ✔ | · | · | · |
| `asistencia.justificar` | Solicitar una justificación de asistencia | ✔ | ✔ | ✔ | ✔ |
| `asistencia.marcar` | Registrar entradas y salidas | ✔ | · | · | · |
| `asistencia.registrar` | Registrar y revisar la asistencia | ✔ | ✔ | · | · |
| `asistencia.resolver` | Resolver justificaciones de asistencia | ✔ | · | · | · |
| **datos** | |  |  |  |  |
| `datos.conciliar_historico` | Revisar y conciliar lotes de datos históricos | ✔ | · | · | · |
| **expediente** | |  |  |  |  |
| `expediente.gestionar` | Registrar y revisar documentos | ✔ | · | · | · |
| **familia** | |  |  |  |  |
| `familia.consultar` | Consultar información familiar autorizada | · | · | · | ✔ |
| **matriculas** | |  |  |  |  |
| `matriculas.gestionar` | Gestionar matrícula y cambios de sección | ✔ | · | · | · |
| **planilla** | |  |  |  |  |
| `planilla.aprobar_horas` | Resolver horas docentes | ✔ | · | · | · |
| `planilla.contratos` | Registrar contratos y condiciones de remuneración | ✔ | · | · | · |
| `planilla.horas` | Registrar horas docentes trabajadas | ✔ | · | · | · |
| `planilla.liquidar` | Preparar y aprobar liquidaciones docentes | ✔ | · | · | · |
| `planilla.pagar` | Registrar pagos de liquidaciones docentes | ✔ | · | · | · |
| `planilla.revertir_pago` | Autorizar reversiones de pagos docentes | ✔ | · | · | · |
| **reportes** | |  |  |  |  |
| `reportes.academico` | Emitir reportes de notas publicadas | ✔ | · | · | · |
| `reportes.asistencia` | Emitir reportes de asistencia | ✔ | · | · | · |
| `reportes.configurar` | Administrar y publicar plantillas de documentos | ✔ | · | · | · |
| `reportes.dashboard` | Consultar y exportar indicadores institucionales | ✔ | · | · | · |
| `reportes.matriculas` | Emitir ficha y nómina de matrícula | ✔ | · | · | · |
| `reportes.tesoreria` | Emitir estados de cuenta | ✔ | · | · | · |
| **tesoreria** | |  |  |  |  |
| `tesoreria.cobrar` | Registrar cobros y emitir recibos internos | ✔ | · | · | · |
| `tesoreria.revertir` | Autorizar reversiones y devoluciones | ✔ | · | · | · |
| **usuarios** | |  |  |  |  |
| `usuarios.gestionar` | Administrar cuentas y recuperación de acceso | ✔ | · | · | · |

## Totales por rol

- `admin`: 31 permisos
- `docente`: 3 permisos
- `alumno`: 1 permisos
- `apoderado`: 2 permisos

## Tipos de reporte y permiso requerido

| Tipo | Nombre | Permiso |
|---|---|---|
| `ficha_matricula` | Ficha de matrícula | `reportes.matriculas` |
| `nomina` | Nómina de matrícula | `reportes.matriculas` |
| `estado_cuenta` | Estado de cuenta | `reportes.tesoreria` |
| `notas` | Informe de notas | `reportes.academico` |
| `asistencia_alumnos` | Asistencia de alumnos | `reportes.asistencia` |
| `asistencia_docentes` | Asistencia de docentes | `reportes.asistencia` |
| `dashboard` | Indicadores institucionales | `reportes.dashboard` |

## Permisos verificados dentro de la base

- `preparar_documento_reporte` exige que el actor sea usuario **activo** con el permiso de `tipos_reporte.permiso` del tipo de la plantilla.
- `validar_operador_importacion` (usada por `avanzar_lote_historico` y `conciliar_fila_historica`) exige `datos.conciliar_historico`.
- `registrar_marcacion` solo exige un usuario activo como operador (no verifica `asistencia.marcar`): la app debe verificarlo.
- El resto de reglas de autorización y de **alcance de datos** (alumno, apoderado, docente) es responsabilidad de la capa de servicios.