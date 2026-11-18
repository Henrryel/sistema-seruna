import { ruta } from '@/server/http/ruta';
import { consultaGrillaAdmin, esquemaGuardarAdmin } from '@/esquemas/evaluacion/calificaciones';
import * as servicio from '@/server/services/evaluacion/calificaciones';

// `academico.calificar` también lo tiene el rol docente: se exige además el portal administrativo para que un
// docente no califique secciones ajenas por esta ruta (su ruta es /api/docente/calificaciones).
const acceso = { portal: 'admin', permiso: ['academico.calificar', 'academico.publicar'] } as const;

export const GET = ruta({ ...acceso, consulta: consultaGrillaAdmin }, async ({ consulta }) => servicio.grillaAdmin(consulta));

export const POST = ruta({ ...acceso, cuerpo: esquemaGuardarAdmin }, async ({ actor, cuerpo }) => servicio.guardarAdmin(actor, cuerpo));
