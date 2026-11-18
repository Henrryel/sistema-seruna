import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaLectores, esquemaLector, type FilaLector } from '@/esquemas/asistencia/configuracion';
import * as servicio from '@/server/services/asistencia/configuracion';

const op = { permiso: 'asistencia.configurar', portal: 'admin' } as const;

export const GET = ruta({ ...op, consulta: consultaLectores }, async ({ consulta }) =>
  responderListado<FilaLector>(consulta, {
    titulo: 'Lectores QR',
    filtros: { Activo: consulta.activo, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Nombre', valor: 'nombre', ancho: 30 },
      { titulo: 'Activo', valor: 'activo', formato: 'booleano' },
      { titulo: 'Marcaciones', valor: 'marcaciones', formato: 'numero' },
      { titulo: 'Última marcación', valor: (f) => (f.ultima_marcacion ? new Date(f.ultima_marcacion) : null), formato: 'fechaHora' },
    ],
    obtener: (p) => servicio.listarLectores({ q: consulta.q, activo: consulta.activo === undefined ? undefined : consulta.activo === 'true' }, p),
  }),
);

export const POST = ruta({ ...op, cuerpo: esquemaLector }, async ({ actor, cuerpo }) => servicio.crearLector(actor, cuerpo));
