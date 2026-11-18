import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaHoras, textoMinutos, type FilaHora } from '@/esquemas/planilla/horas';
import * as servicio from '@/server/services/planilla/portal-docente';

/** Horas registradas del propio docente (el docente sale de la sesión, no de la consulta). */
export const GET = ruta({ portal: 'docente', consulta: consultaHoras }, async ({ actor, consulta }) =>
  responderListado<FilaHora>(consulta, {
    titulo: 'Mis horas registradas',
    filtros: { Estado: consulta.estado, Desde: consulta.desde, Hasta: consulta.hasta },
    columnas: [
      { titulo: 'Fecha', valor: 'fecha', formato: 'fecha' },
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
        actor,
        { estado: consulta.estado, desde: consulta.desde, hasta: consulta.hasta, q: consulta.q },
        p,
      ),
  }),
);
