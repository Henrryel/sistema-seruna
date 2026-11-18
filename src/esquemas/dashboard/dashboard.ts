// Esquemas y tipos del panel institucional y de las páginas de inicio de cada portal.
import { z } from 'zod';
import { fecha, id, idOpcional } from '../comunes';

/** Filtros del dashboard: el rango y el bimestre los valida `indicadores_dashboard` en la base. */
export const consultaDashboard = z.object({
  anioId: id,
  desde: fecha,
  hasta: fecha,
  bimestreId: idOpcional,
});

export type ConsultaDashboard = z.infer<typeof consultaDashboard>;

/** Bloques del dashboard; cada uno se muestra solo con su permiso. */
export const BLOQUES_DASHBOARD = ['matricula', 'asistencia', 'pagos', 'notas', 'planilla'] as const;
export type BloqueDashboard = (typeof BLOQUES_DASHBOARD)[number];

export interface ResumenAsistencia {
  esperadas: number;
  presentes: number;
  tardanzas: number;
  ausencias: number;
  justificadas: number;
  pendientes: number;
}

/** jsonb devuelto por `indicadores_dashboard(p_anio, p_desde, p_hasta, p_bimestre)`. */
export interface IndicadoresDashboard {
  anio_id: number | string;
  desde: string;
  hasta: string;
  bimestre_id: number | string | null;
  matricula: {
    activas: number;
    cupo: number;
    vacantes_totales: number;
    vacantes_regulares: number;
    vacantes_reservadas: number;
  };
  pagos: {
    cobrado_bruto_aplicado: number;
    devuelto: number;
    revertido: number;
    cobrado_neto_aplicado: number;
    saldo_pendiente: number;
    saldo_vencido: number;
    matriculas_con_mora: number;
  };
  notas: { esperadas: number; resueltas: number; publicadas: number; avance_pct: number | null } | null;
  asistencia: { alumnos: ResumenAsistencia; docentes: ResumenAsistencia };
}

export interface RecaudacionDia {
  fecha: string;
  cobrado: string;
  pagos: number;
}

export interface DistribucionNivel {
  nivel: 'AD' | 'A' | 'B' | 'C';
  cantidad: number;
}

export interface PlanillaMes {
  mes: string;
  neto: string;
  abonado: string;
}

export interface ResumenPlanilla {
  liquidaciones: number;
  borradores: number;
  aprobadas: number;
  neto: string;
  abonado: string;
  saldo: string;
  porMes: PlanillaMes[];
}

export interface RespuestaDashboard {
  bloques: BloqueDashboard[];
  matricula?: IndicadoresDashboard['matricula'];
  asistencia?: IndicadoresDashboard['asistencia'];
  pagos?: IndicadoresDashboard['pagos'] & { recaudacion: RecaudacionDia[] };
  notas?: { avance: IndicadoresDashboard['notas']; distribucion: DistribucionNivel[] };
  planilla?: ResumenPlanilla;
}

// ---------------------------------------------------------------- Portal docente

export interface ClaseDelDia {
  id: string;
  origen: 'sesion' | 'horario';
  curso_id: string;
  asignatura: string;
  seccion: string;
  grado: number;
  nivel: string;
  aula: string | null;
  hora_inicio: string;
  hora_fin: string;
  estado: string | null;
}

export interface PendienteCalificacion {
  cierre_id: string;
  bimestre: number;
  curso_id: string;
  asignatura: string;
  seccion: string;
  grado: number;
  nivel: string;
  esperadas: number;
  pendientes: number;
}

export interface InicioDocente {
  fecha: string;
  origenClases: 'sesiones' | 'horario';
  clases: ClaseDelDia[];
  pendientes: PendienteCalificacion[];
  cursos: number;
}

// ------------------------------------------------------- Portal estudiante / padres

export interface LogroReciente {
  competencia_id: string;
  competencia: string;
  area: string | null;
  bimestre: number;
  nivel_logro: string;
  conclusion: string | null;
}

export interface ResumenAsistenciaMes extends ResumenAsistencia {
  desde: string;
  hasta: string;
}

export interface ResumenDeuda {
  total: string;
  vencido: string;
  cuotasPendientes: number;
  proximoVencimiento: { fecha: string; saldo: string } | null;
}

export interface MatriculaInicio {
  id: string;
  anio: number;
  nivel: string;
  grado: number;
  seccion: string | null;
  estado: string;
}

export interface InicioEstudiante {
  estudiante: { id: string; codigo: string; nombres: string; apellidos: string };
  matricula: MatriculaInicio | null;
  accesoAcademico: boolean;
  accesoEconomico: boolean;
  logros: LogroReciente[] | null;
  asistencia: ResumenAsistenciaMes | null;
  deuda: ResumenDeuda | null;
}

export const consultaInicioPadre = z.object({ estudianteId: id });
