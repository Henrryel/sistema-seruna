import { ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { consultaQuitarPuesto, esquemaPuestos } from '@/esquemas/evaluacion/merito';
import * as servicio from '@/server/services/evaluacion/merito';

export const POST = ruta({ permiso: 'academico.publicar_merito', parametros: parametrosId, cuerpo: esquemaPuestos }, async ({ actor, parametros, cuerpo }) =>
  servicio.registrarPuestos(actor, parametros.id, cuerpo.puestos),
);

export const DELETE = ruta({ permiso: 'academico.publicar_merito', parametros: parametrosId, consulta: consultaQuitarPuesto }, async ({ actor, parametros, consulta }) =>
  servicio.quitarPuesto(actor, parametros.id, consulta.matriculaId),
);
