import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaPoliticas, esquemaPolitica, type FilaPolitica } from '@/esquemas/asistencia/configuracion';
import * as servicio from '@/server/services/asistencia/configuracion';

const op = { permiso: 'asistencia.configurar', portal: 'admin' } as const;

export const GET = ruta({ ...op, consulta: consultaPoliticas }, async ({ consulta }) =>
  responderListado<FilaPolitica>(consulta, {
    titulo: 'Políticas de asistencia',
    filtros: { Alcance: consulta.alcance, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Alcance', valor: 'alcance' },
      { titulo: 'Turno', valor: 'turno' },
      { titulo: 'Desde', valor: 'vigencia_inicio', formato: 'fecha' },
      { titulo: 'Hasta', valor: 'vigencia_fin', formato: 'fecha' },
      { titulo: 'QR', valor: 'admite_qr', formato: 'booleano' },
      { titulo: 'Manual', valor: 'admite_manual', formato: 'booleano' },
      { titulo: 'Tolerancia (min)', valor: 'tolerancia_minutos', formato: 'numero' },
      { titulo: 'Ventana entrada (min)', valor: 'ventana_entrada_minutos', formato: 'numero' },
      { titulo: 'Ventana salida (min)', valor: 'ventana_salida_minutos', formato: 'numero' },
      { titulo: 'Jornadas', valor: 'jornadas', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarPoliticas({ q: consulta.q, anioId: consulta.anioId, alcance: consulta.alcance }, p),
  }),
);

export const POST = ruta({ ...op, cuerpo: esquemaPolitica }, async ({ actor, cuerpo }) => servicio.crearPolitica(actor, cuerpo));
