import type { Modalidad } from './contratos';
import type { FilaLiquidacion } from './liquidaciones';

/** Respuesta de /api/docente/planilla (alcance propio). */
export interface ResumenPlanillaDocente {
  docente: { codigo: string; nombres: string; apellidos: string };
  contratos: {
    id: string;
    referencia: string;
    modalidad: Modalidad;
    inicio: string | null;
    fin: string | null;
    sueldo_mensual: string | null;
    tarifa_hora: string | null;
    minutos_por_hora: number | null;
  }[];
  liquidaciones: FilaLiquidacion[];
}
