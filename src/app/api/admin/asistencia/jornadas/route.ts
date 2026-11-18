import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaJornadas, type FilaJornada } from '@/esquemas/asistencia/configuracion';
import * as servicio from '@/server/services/asistencia/configuracion';

export const GET = ruta({ permiso: 'asistencia.configurar', portal: 'admin', consulta: consultaJornadas }, async ({ consulta }) =>
  responderListado<FilaJornada>(consulta, {
    titulo: consulta.tipo === 'seccion' ? 'Jornadas de secciones' : 'Jornadas de docentes',
    filtros: { Desde: consulta.desde, Hasta: consulta.hasta, Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Fecha', valor: 'fecha', formato: 'fecha' },
      { titulo: consulta.tipo === 'seccion' ? 'Sección' : 'Docente', valor: 'destino', ancho: 30 },
      { titulo: 'Entrada', valor: (f) => f.entrada.slice(0, 5) },
      { titulo: 'Salida', valor: (f) => f.salida.slice(0, 5) },
      { titulo: 'Política', valor: 'politica' },
      { titulo: 'Estado', valor: 'estado' },
      { titulo: 'Registros', valor: 'registros', formato: 'numero' },
    ],
    obtener: (p) =>
      servicio.listarJornadas(
        { tipo: consulta.tipo, q: consulta.q, anioId: consulta.anioId, desde: consulta.desde, hasta: consulta.hasta, estado: consulta.estado },
        p,
      ),
  }),
);
