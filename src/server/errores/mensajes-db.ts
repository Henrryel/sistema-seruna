// Archivo generado por scripts/db/generar-errores.mjs desde docs/db/catalogo.json. No editar a mano.
// Mensajes RAISE EXCEPTION (SQLSTATE P0001) de la base y su traducción a errores de dominio.
import type { TipoErrorDb } from './tipos';

export const MENSAJES_DB: Readonly<Record<string, TipoErrorDb>> = {
  "Abra el período mensual antes de aprobar horas": "Validation", // validar_horas_docente
  "Actualice el borrador según los últimos logros publicados": "Validation", // controlar_cierre_anual
  "Apruebe el borrador sin modificar su contenido": "Conflict", // controlar_evaluacion_recuperacion
  "Cierre el bimestre antes de publicarlo": "Conflict", // validar_cierre_evaluacion
  "Configure los cuatro bimestres, la sección y el plan al cierre del cuarto bimestre": "Validation", // controlar_cierre_anual
  "Credencial QR inválida, vencida o revocada": "Validation", // registrar_marcacion
  "Cree una nueva versión de la publicación de mérito": "Conflict", // controlar_publicacion_merito
  "Cree una versión nueva de la plantilla publicada": "Validation", // proteger_documento_reporte
  "El abono excede el saldo de la cuota": "Validation", // validar_aplicacion_pago
  "El archivo de origen es inmutable": "Conflict", // controlar_carga_historica
  "El archivo emitido debe coincidir con el formato de la plantilla": "Validation", // proteger_documento_reporte
  "El bimestre no pertenece al año académico": "Validation", // indicadores_dashboard
  "El cambio de contrato alteraría horas o condiciones ya registradas": "Conflict", // conservar_condiciones_contrato
  "El cierre aprobado debe conservarse": "Conflict", // controlar_cierre_anual
  "El cierre aprobado es inmutable": "Conflict", // controlar_resultado_anual
  "El cierre aprobado o su contexto no se pueden modificar": "Conflict", // controlar_cierre_anual
  "El cierre no admite cambios de notas": "Conflict", // validar_calificacion
  "El conteo de filas cargadas difiere del manifiesto": "Validation", // avanzar_lote_historico
  "El contexto del cierre no se puede cambiar": "Conflict", // validar_cierre_evaluacion
  "El contrato no estuvo vigente durante el período": "Validation", // validar_liquidacion_docente
  "El detalle requiere horas aprobadas del contrato y período de la liquidación": "Validation", // validar_detalle_liquidacion
  "El estado justificado requiere una solicitud aprobada": "Validation", // validar_asistencia
  "El estado no coincide con la tolerancia de entrada": "Validation", // validar_asistencia
  "El historial de asistencia es de solo inserción": "Conflict", // conservar_evento_asistencia
  "El historial de recuperación debe conservarse": "Conflict", // controlar_evaluacion_recuperacion
  "El historial del documento debe conservarse": "Conflict", // proteger_documento_reporte
  "El identificador ya corresponde a otra solicitud": "Conflict", // preparar_documento_reporte
  "El lector QR no está habilitado": "Validation", // registrar_marcacion
  "El listado debe contener puestos consecutivos desde el primero": "Conflict", // controlar_publicacion_merito
  "El listado publicado es inmutable": "Conflict", // controlar_puesto_merito
  "El lote debe estar en carga": "Validation", // controlar_carga_historica
  "El lote debe estar en revisión": "Validation", // conciliar_fila_historica
  "El lote tiene filas pendientes de conciliación": "Validation", // avanzar_lote_historico
  "El mérito requiere Secundaria y una regla aprobada; el alcance completo usa quinto grado": "Validation", // controlar_publicacion_merito
  "El origen ya tiene otra equivalencia registrada": "Conflict", // conciliar_fila_historica
  "El pago excede el saldo de la liquidación": "Validation", // validar_movimiento_pago_docente
  "El pago no admite nuevas aplicaciones": "Conflict", // validar_aplicacion_pago
  "El pago requiere una liquidación aprobada": "Validation", // validar_movimiento_pago_docente
  "El período de liquidación está cerrado": "Conflict", // validar_liquidacion_docente
  "El período debe empezar abierto": "Conflict", // controlar_periodo_planilla
  "El período tiene horas o liquidaciones pendientes": "Validation", // controlar_periodo_planilla
  "El puesto debe apuntar a un cierre lectivo aprobado del mismo año y grado": "Validation", // controlar_puesto_merito
  "El recibo requiere un pago vigente con el importe totalmente aplicado": "Validation", // emitir_recibo_caja
  "El registro QR obtiene identidad y hora en el servidor": "Validation", // registrar_marcacion
  "El sueldo parcial requiere importe autorizado y motivo": "Validation", // validar_liquidacion_docente
  "El tipo de reporte no admite uno de los filtros enviados": "Conflict", // preparar_documento_reporte
  "Ese UUID ya identifica otra marcación": "Conflict", // registrar_marcacion
  "Este origen se conserva en el archivo histórico": "Validation", // conciliar_fila_historica
  "Faltan códigos SIAGIE o mapeos de competencias del cierre": "Validation", // preparar_exportacion_siagie
  "Faltan competencias del plan para la nómina al cierre del bimestre": "Validation", // validar_cierre_evaluacion
  "Faltan resultados anuales del plan de estudios": "Validation", // controlar_cierre_anual
  "Hay bimestres cursados sin resultados publicados": "Validation", // controlar_cierre_anual
  "Hay notas pendientes o faltan conclusiones descriptivas obligatorias": "Validation", // validar_cierre_evaluacion
  "Identifique las competencias pendientes de recuperación": "Validation", // controlar_cierre_anual
  "Indique el motivo de la rectificación": "Validation", // validar_calificacion
  "Indique el UUID del evento y si es entrada o salida": "Validation", // registrar_marcacion
  "Indique identificador y fechas válidas para el reporte": "Validation", // preparar_documento_reporte
  "Indique un año académico y un rango de fechas válido": "Validation", // indicadores_dashboard
  "Indique una acción y su sustento": "Validation", // conciliar_fila_historica
  "La competencia debe estar pendiente en un cierre aprobado": "Validation", // controlar_evaluacion_recuperacion
  "La cuenta no está autorizada para conciliar datos históricos": "Forbidden", // validar_operador_importacion
  "La cuenta no está autorizada para este tipo de reporte": "Forbidden", // preparar_documento_reporte
  "La cuota debe reproducir un tramo válido de un plan publicado para una matrícula activa": "Validation", // validar_emision_cuota
  "La cuota no existe o aún no es exigible": "Validation", // validar_aplicacion_pago
  "La fecha o vigencia debe quedar dentro de la asignación docente": "Validation", // validar_vigencia_horario
  "La fecha o vigencia debe quedar dentro del plan de la sección": "Validation", // validar_vigencia_horario
  "La fila contiene credenciales o una estructura no permitida": "Validation", // controlar_carga_historica
  "La fila ya está conciliada en este lote": "Conflict", // conciliar_fila_historica
  "La fuente del resultado anual no coincide con el cierre": "Validation", // controlar_resultado_anual
  "La identidad de la calificación no se puede cambiar": "Conflict", // validar_calificacion
  "La jornada debe estar dentro del año y de la vigencia de su política": "Validation", // validar_fecha_jornada
  "La jornada, la matrícula o la sesión no coinciden": "Validation", // validar_asistencia
  "La justificación se registra primero como pendiente": "Conflict", // validar_justificacion
  "La liquidación aprobada no admite cambios": "Conflict", // validar_detalle_liquidacion
  "La liquidación debe empezar en borrador": "Conflict", // validar_liquidacion_docente
  "La liquidación requiere un neto válido y, por horas, tiempo aprobado": "Validation", // validar_liquidacion_docente
  "La liquidación solo puede pasar de borrador a aprobada": "Conflict", // validar_liquidacion_docente
  "La marcación de entrada no corresponde a la jornada": "Validation", // validar_asistencia
  "La marcación de salida no corresponde a la jornada": "Validation", // validar_asistencia
  "La marcación manual requiere persona, hora y motivo": "Validation", // registrar_marcacion
  "La marcación requiere un operador activo": "Forbidden", // registrar_marcacion
  "La matrícula debe estar confirmada y pertenecer al estudiante conciliado": "Validation", // conciliar_fila_historica
  "La matrícula y el plan no coinciden con la sección durante el bimestre": "Validation", // validar_calificacion
  "La operación sobrescribiría el historial de planilla": "Conflict", // conservar_historial_planilla
  "La persona no tiene perfil activo de alumno o docente": "Validation", // registrar_marcacion
  "La política exige una marcación para registrar presencia": "Validation", // validar_asistencia
  "La publicación de mérito debe conservarse": "Conflict", // controlar_publicacion_merito
  "La reversión debe ser posterior al pago": "Validation", // validar_movimiento_pago_docente
  "La revisión requiere el cierre aprobado anterior de la misma trayectoria": "Validation", // controlar_cierre_anual
  "La sección no está activa": "Validation", // validar_ocupacion_seccion
  "La vigencia de la sección debe quedar dentro del año académico": "Validation", // validar_ocupacion_seccion
  "Las aplicaciones exceden el importe del pago": "Validation", // validar_aplicacion_pago
  "Las cuotas superan el importe de ingreso acordado": "Validation", // validar_emision_cuota
  "Las horas corresponden a una liquidación o período cerrado": "Validation", // validar_horas_docente
  "Las horas deben pertenecer a una sesión realizada por el docente": "Validation", // validar_horas_docente
  "Las horas deben registrarse primero como pendientes": "Conflict", // validar_horas_docente
  "Las horas requieren un contrato por horas vigente para la fecha": "Validation", // validar_horas_docente
  "Las marcaciones contradicen el estado o el orden de la jornada": "Validation", // validar_asistencia
  "Los datos de la solicitud son inmutables": "Conflict", // proteger_documento_reporte
  "Los filtros no pertenecen al año de la plantilla": "Validation", // preparar_documento_reporte
  "Los parámetros no corresponden a la acción": "Validation", // conciliar_fila_historica
  "No hay cupo para el tipo de vacante seleccionado": "Validation", // validar_ocupacion_seccion
  "No se puede cambiar el contexto de la asistencia": "Conflict", // validar_asistencia
  "No se puede cambiar la jornada de la asistencia": "Conflict", // validar_asistencia
  "Publique el bimestre antes de preparar el Excel SIAGIE": "Conflict", // preparar_exportacion_siagie
  "Reabra el cierre antes de rectificar": "Conflict", // validar_calificacion
  "Reemplace el detalle mientras esté en borrador": "Conflict", // validar_detalle_liquidacion
  "Reemplace el puesto mientras el listado esté en borrador": "Conflict", // controlar_puesto_merito
  "Reemplace el resultado mientras el cierre esté en borrador": "Conflict", // controlar_resultado_anual
  "Registre el listado antes de publicarlo": "Conflict", // controlar_publicacion_merito
  "Registre la evaluación de recuperación primero como borrador": "Conflict", // controlar_evaluacion_recuperacion
  "Registre primero un cierre en borrador": "Conflict", // controlar_cierre_anual
  "Registre una nueva versión de la regla de evaluación": "Conflict", // proteger_regla_evaluacion
  "Resuelva las horas pendientes e incluya todas las horas aprobadas del período": "Validation", // validar_liquidacion_docente
  "Se requiere un plan publicado y una vigencia dentro del año escolar": "Validation", // validar_plan_seccion
  "Se requiere una regla de evaluación aprobada": "Validation", // controlar_cierre_anual
  "Seleccione un bimestre": "Validation", // preparar_documento_reporte
  "Seleccione una matrícula": "Validation", // preparar_documento_reporte
  "Solo se crean perfiles con código interno validado": "Validation", // conciliar_fila_historica
  "Solo se justifica una ausencia o tardanza registrada": "Validation", // validar_justificacion
  "Solo se permite cerrar el período conservando sus datos": "Conflict", // controlar_periodo_planilla
  "Solo se puede resolver una hora pendiente y conservar su contenido": "Conflict", // validar_horas_docente
  "Solo se puede resolver una solicitud pendiente, conservando su contenido": "Conflict", // validar_justificacion
  "Solo se pueden registrar horas ya trabajadas": "Validation", // validar_horas_docente
  "Tipo de reporte sin consulta implementada": "Validation", // preparar_documento_reporte
  "Transición de documento no permitida": "Conflict", // proteger_documento_reporte
  "Un cierre debe empezar en borrador": "Conflict", // validar_cierre_evaluacion
  "Una competencia pendiente requiere una evaluación aprobada para quedar resuelta": "Validation", // controlar_cierre_anual
  "Una solicitud de documento debe empezar como preparada": "Conflict", // proteger_documento_reporte
  "Use una rectificación para conservar el historial de la calificación": "Validation", // conservar_calificacion
  "Verifique la fecha de nacimiento": "Validation", // conciliar_fila_historica
  "Verifique nombres y apellidos o vincule con una persona existente": "Validation", // conciliar_fila_historica
  "Vincule al menos una evaluación de recuperación aprobada": "Validation", // controlar_cierre_anual
};

/** Mensajes con parámetros (%): se comparan por prefijo. */
export const PATRONES_DB: ReadonlyArray<{ prefijo: string; tipo: TipoErrorDb }> = [
  { prefijo: "Registre un ajuste o reversión para corregir ", tipo: "Conflict" }, // preservar_registro_financiero
];
