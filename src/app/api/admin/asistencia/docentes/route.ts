import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaDiariaDocentes, esquemaRegistroDocente, ETIQUETA_ESTADO, type FilaAsistenciaDocente } from '@/esquemas/asistencia/registro';
import * as servicio from '@/server/services/asistencia/registro';

const op = { permiso: 'asistencia.registrar', portal: 'admin' } as const;

export const GET = ruta({ ...op, consulta: consultaDiariaDocentes }, async ({ consulta }) =>
  responderListado<FilaAsistenciaDocente>(consulta, {
    titulo: 'Asistencia de docentes',
    nombreArchivo: `asistencia-docentes-${consulta.fecha}`,
    filtros: { Fecha: consulta.fecha.split('-').reverse().join('/'), Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Docente', valor: 'docente', ancho: 32 },
      { titulo: 'Horario', valor: (f) => `${f.hora_entrada.slice(0, 5)}–${f.hora_salida.slice(0, 5)}` },
      { titulo: 'Estado', valor: (f) => ETIQUETA_ESTADO[f.estado] ?? f.estado },
      { titulo: 'Entrada', valor: (f) => (f.entrada ? new Date(f.entrada) : null), formato: 'fechaHora' },
      { titulo: 'Salida', valor: (f) => (f.salida ? new Date(f.salida) : null), formato: 'fechaHora' },
      { titulo: 'Justificación', valor: 'justificacion' },
      { titulo: 'Motivo', valor: 'motivo', ancho: 30 },
    ],
    obtener: (p) => servicio.listarDiariaDocentes({ fecha: consulta.fecha, estado: consulta.estado, q: consulta.q }, p),
  }),
);

export const POST = ruta({ ...op, cuerpo: esquemaRegistroDocente }, async ({ actor, cuerpo }) => servicio.registrarDocente(actor, cuerpo));
