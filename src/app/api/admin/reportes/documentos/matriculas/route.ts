import { ruta } from '@/server/http/ruta';
import { PERMISOS_REPORTES, consultaMatriculasReporte } from '@/esquemas/reportes/documentos';
import { buscarMatriculas } from '@/server/services/reportes/documentos';

/** Matrículas del año para el filtro de los reportes por estudiante (máximo 30 resultados). */
export const GET = ruta({ permiso: PERMISOS_REPORTES, consulta: consultaMatriculasReporte }, async ({ consulta }) => ({
  opciones: await buscarMatriculas(consulta.anioId, consulta.q),
}));
