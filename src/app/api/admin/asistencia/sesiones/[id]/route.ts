import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { consultaListadoSesion, esquemaRegistroSesion } from '@/esquemas/asistencia/registro';
import { responderSesion } from '@/server/asistencia/http';
import * as servicio from '@/server/services/asistencia/registro';

const op = { permiso: 'asistencia.registrar', portal: 'admin', parametros: parametrosId } as const;

export const GET = ruta({ ...op, consulta: consultaListadoSesion }, async ({ actor, parametros, consulta }) => responderSesion(actor, consulta, parametros.id, 'admin'));

export const POST = ruta({ ...op, cuerpo: esquemaRegistroSesion }, async ({ actor, parametros, cuerpo }) =>
  servicio.registrarSesion(actor, parametros.id, cuerpo, 'admin'),
);
