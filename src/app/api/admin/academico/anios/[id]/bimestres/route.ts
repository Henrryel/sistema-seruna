import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { esquemaBimestre } from '@/esquemas/academico/anios';
import * as servicio from '@/server/services/academico/anios';

export const GET = ruta({ permiso: 'academico.configurar', parametros: parametrosId }, async ({ parametros }) => ({
  bimestres: await servicio.listarBimestres(parametros.id),
}));

export const POST = ruta(
  { permiso: 'academico.configurar', parametros: parametrosId, cuerpo: esquemaBimestre },
  async ({ actor, parametros, cuerpo }) => servicio.crearBimestre(actor, parametros.id, cuerpo),
);
