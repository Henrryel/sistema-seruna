import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaHoras, esquemaHora, textoMinutos, type FilaHora } from '@/esquemas/planilla/horas';
import { PERMISOS_VER_HORAS } from '@/esquemas/planilla/permisos';
import * as servicio from '@/server/services/planilla/horas';
import { leerCuerpoConArchivo } from '../_comun/formulario';

export const GET = ruta({ permiso: PERMISOS_VER_HORAS, consulta: consultaHoras }, async ({ consulta }) =>
  responderListado<FilaHora>(consulta, {
    titulo: 'Horas docentes',
    filtros: { Estado: consulta.estado, Desde: consulta.desde, Hasta: consulta.hasta, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Fecha', valor: 'fecha', formato: 'fecha' },
      { titulo: 'Docente', valor: 'docente', ancho: 28 },
      { titulo: 'Contrato', valor: 'referencia' },
      { titulo: 'Inicio', valor: 'hora_inicio' },
      { titulo: 'Fin', valor: 'hora_fin' },
      { titulo: 'Tiempo', valor: (f) => textoMinutos(f.minutos) },
      { titulo: 'Motivo', valor: 'motivo', ancho: 30 },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Decisión', valor: 'decision', ancho: 26 },
    ],
    obtener: (p) =>
      servicio.listarHoras(
        {
          q: consulta.q,
          estado: consulta.estado,
          contratoId: consulta.contratoId,
          docenteId: consulta.docenteId,
          desde: consulta.desde,
          hasta: consulta.hasta,
        },
        p,
      ),
  }),
);

/** JSON o multipart (`datos` + `archivo` de evidencia, opcional). */
export const POST = ruta({ permiso: 'planilla.horas' }, async ({ req, actor }) => {
  const { datos, archivo } = await leerCuerpoConArchivo(req, esquemaHora);
  return servicio.registrarHora(actor, datos, archivo);
});
