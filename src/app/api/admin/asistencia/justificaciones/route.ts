import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaJustificaciones, type FilaJustificacion } from '@/esquemas/asistencia/justificaciones';
import * as servicio from '@/server/services/asistencia/justificaciones';

export const GET = ruta({ permiso: 'asistencia.resolver', portal: 'admin', consulta: consultaJustificaciones }, async ({ consulta }) =>
  responderListado<FilaJustificacion>(consulta, {
    titulo: 'Justificaciones de asistencia',
    filtros: { Estado: consulta.estado, Perfil: consulta.perfil, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Solicitada', valor: (f) => new Date(f.solicitada_en), formato: 'fechaHora' },
      { titulo: 'Persona', valor: 'persona', ancho: 28 },
      { titulo: 'Perfil', valor: 'perfil' },
      { titulo: 'Fecha', valor: 'fecha', formato: 'fecha' },
      { titulo: 'Curso', valor: 'curso' },
      { titulo: 'Asistencia', valor: 'estado_asistencia' },
      { titulo: 'Motivo', valor: 'motivo', ancho: 36 },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Decisión', valor: 'decision', ancho: 30 },
      { titulo: 'Resuelta por', valor: 'resolutor' },
    ],
    obtener: (p) => servicio.listarJustificaciones({ q: consulta.q, estado: consulta.estado, perfil: consulta.perfil }, p),
  }),
);
