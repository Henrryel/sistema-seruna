import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { PERMISOS_VER_LIQUIDACIONES } from '@/esquemas/planilla/permisos';
import * as servicio from '@/server/services/planilla/liquidaciones';

export const runtime = 'nodejs';

export const GET = ruta(
  { permiso: PERMISOS_VER_LIQUIDACIONES, parametros: parametrosId },
  async ({ parametros }) => {
    const b = await servicio.boleta(parametros.id);
    return descargar(b.contenido, b.nombre, 'application/pdf');
  },
);
