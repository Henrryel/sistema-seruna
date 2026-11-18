import { z } from 'zod';
import { consultaListado, id, idOpcional } from '../comunes';

export const consultaNotasEstudiante = z.object({ matriculaId: idOpcional });
export const consultaNotasPadre = z.object({ estudianteId: id, matriculaId: idOpcional });
export const consultaLibretaEstudiante = z.object({ matriculaId: id });
export const consultaLibretaPadre = z.object({ estudianteId: id, matriculaId: id });

export const consultaLibretas = consultaListado.extend({ anioId: idOpcional, seccionId: idOpcional });
export const consultaLibretaSeccion = z.object({ seccionId: id });
export const parametrosMatricula = z.object({ matriculaId: id });

export interface LogroBimestre {
  estado: string;
  nivel: string | null;
  conclusion: string | null;
}

export interface CompetenciaBoleta {
  id: string;
  codigo: string;
  nombre: string;
  /** Clave: número de bimestre (1..4). */
  bimestres: Record<string, LogroBimestre>;
  /** Resultado anual del cierre aprobado vigente, si existe. */
  anual: { nivel: string; conclusion: string | null; requiereRecuperacion: boolean } | null;
}

export interface DatosBoleta {
  matricula: {
    id: string;
    anio: number;
    grado: number;
    nivel: string;
    seccion: string | null;
    estado: string;
    estudiante: { id: string; codigo: string; codigoSiagie: string | null; nombres: string; apellidos: string };
  };
  bimestres: { numero: number; publicadoEn: string }[];
  areas: { area: string; competencias: CompetenciaBoleta[] }[];
  situacionFinal: { situacion: string; etapa: string; version: number; aprobadoEn: string | null } | null;
}

export interface MatriculaOpcion {
  id: string;
  anio: number;
  grado: number;
  nivel: string;
  seccion: string | null;
}

export interface RespuestaNotasPortal {
  matriculas: MatriculaOpcion[];
  boleta: DatosBoleta | null;
}

export interface FilaLibreta {
  matricula_id: string;
  estudiante_id: string;
  codigo: string;
  alumno: string;
  seccion: string | null;
  estado: string;
  bimestres_publicados: number;
  situacion: string | null;
}
