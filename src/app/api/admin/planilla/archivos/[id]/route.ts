import { descargar, ruta } from '@/server/http/ruta';
import { parametrosId } from '@/esquemas/comunes';
import { PERMISOS_PLANILLA } from '@/esquemas/planilla/permisos';
import { leerArchivoPlanilla } from '@/server/services/planilla/archivos';

/** Documento de contrato o evidencia de horas/pagos/reversiones (permiso según el registro dueño). */
export const GET = ruta(
  { permiso: PERMISOS_PLANILLA, parametros: parametrosId },
  async ({ actor, parametros }) => {
    const a = await leerArchivoPlanilla(actor, parametros.id);
    return descargar(a.contenido, a.nombre_original, a.tipo_mime);
  },
);
