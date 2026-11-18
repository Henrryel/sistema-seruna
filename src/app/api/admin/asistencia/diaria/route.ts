import { ruta } from '@/server/http/ruta';
import { consultaDiariaSeccion, esquemaRegistroDiario } from '@/esquemas/asistencia/registro';
import { responderDiaria } from '@/server/asistencia/http';
import * as servicio from '@/server/services/asistencia/registro';

// `asistencia.registrar` también lo tiene el rol docente: la ruta admin exige además el portal admin
// (el docente usa /api/docente/asistencia/**, limitado a sus secciones).
const op = { permiso: 'asistencia.registrar', portal: 'admin' } as const;

export const GET = ruta({ ...op, consulta: consultaDiariaSeccion }, async ({ actor, consulta }) => responderDiaria(actor, consulta, 'admin'));

export const POST = ruta({ ...op, cuerpo: esquemaRegistroDiario }, async ({ actor, cuerpo }) => servicio.registrarDiario(actor, cuerpo, 'admin'));
