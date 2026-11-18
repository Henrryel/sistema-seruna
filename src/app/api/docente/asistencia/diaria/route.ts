import { ruta } from '@/server/http/ruta';
import { consultaDiariaSeccion, esquemaRegistroDiario } from '@/esquemas/asistencia/registro';
import { responderDiaria } from '@/server/asistencia/http';
import * as servicio from '@/server/services/asistencia/registro';

// Alcance docente: solo secciones con asignación (exigirSeccionDelDocente en el servicio).
const op = { portal: 'docente', permiso: 'asistencia.registrar' } as const;

export const GET = ruta({ ...op, consulta: consultaDiariaSeccion }, async ({ actor, consulta }) => responderDiaria(actor, consulta, 'docente'));

export const POST = ruta({ ...op, cuerpo: esquemaRegistroDiario }, async ({ actor, cuerpo }) => servicio.registrarDiario(actor, cuerpo, 'docente'));
