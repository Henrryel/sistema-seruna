import { z } from 'zod';
import { ruta } from '@/server/http/ruta';
import { id, idOpcional } from '@/esquemas/comunes';
import * as servicio from '@/server/services/cobros/portal';

const consulta = z.object({ estudianteId: id, matriculaId: idOpcional });

/** Estado de cuenta de un hijo con vínculo vigente y acceso económico. */
export const GET = ruta({ portal: 'padre', consulta }, async ({ actor, consulta }) =>
  servicio.estadoCuentaPadre(actor, consulta.estudianteId, consulta.matriculaId),
);
