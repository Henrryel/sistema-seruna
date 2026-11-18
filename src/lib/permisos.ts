// Permisos sembrados en excelencia_seruna.permisos (32). Compartido entre cliente y servidor.
export const PERMISOS = [
  'usuarios.gestionar',
  'matriculas.gestionar',
  'expediente.gestionar',
  'tesoreria.cobrar',
  'tesoreria.revertir',
  'familia.consultar',
  'academico.configurar',
  'academico.calificar',
  'academico.publicar',
  'academico.exportar_siagie',
  'asistencia.configurar',
  'asistencia.marcar',
  'asistencia.registrar',
  'asistencia.justificar',
  'asistencia.resolver',
  'planilla.contratos',
  'planilla.horas',
  'planilla.aprobar_horas',
  'planilla.liquidar',
  'planilla.pagar',
  'planilla.revertir_pago',
  'reportes.configurar',
  'reportes.matriculas',
  'reportes.tesoreria',
  'reportes.academico',
  'reportes.asistencia',
  'reportes.dashboard',
  'academico.configurar_cierre_anual',
  'academico.cerrar_anio',
  'academico.recuperacion',
  'academico.publicar_merito',
  'datos.conciliar_historico',
] as const;

export type Permiso = (typeof PERMISOS)[number];

/** Permisos que habilitan el portal administrativo (cualquiera de ellos). */
export const PERMISOS_ADMINISTRATIVOS: readonly Permiso[] = PERMISOS.filter(
  (p) => !['familia.consultar', 'asistencia.justificar', 'academico.calificar', 'asistencia.registrar'].includes(p),
);

export type Portal = 'admin' | 'docente' | 'estudiante' | 'padre';

export const NOMBRE_PORTAL: Record<Portal, string> = {
  admin: 'Administración',
  docente: 'Docente',
  estudiante: 'Estudiante',
  padre: 'Padres de familia',
};
