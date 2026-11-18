import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { archivoDeFormulario } from '@/server/almacenamiento';
import { ValidationError } from '@/server/errores';
import { consultaPlantillas, esquemaPlantilla, type FilaPlantilla } from '@/esquemas/evaluacion/siagie';
import * as servicio from '@/server/services/evaluacion/siagie';

const PERMISO = 'academico.exportar_siagie';

export const GET = ruta({ permiso: PERMISO, consulta: consultaPlantillas }, async ({ consulta }) =>
  responderListado<FilaPlantilla>(consulta, {
    titulo: 'Plantillas SIAGIE',
    filtros: { Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Bimestre', valor: (f) => `${f.bimestre}.º` },
      { titulo: 'Grado', valor: (f) => `${f.grado}.º ${f.nivel}` },
      { titulo: 'Sección', valor: 'seccion' },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Archivo', valor: 'archivo' },
      { titulo: 'Mapeos', valor: 'mapeos', formato: 'numero' },
      { titulo: 'Exportaciones', valor: 'exportaciones', formato: 'numero' },
      { titulo: 'Bimestre', valor: 'cierre_estado' },
    ],
    obtener: (p) => servicio.listarPlantillas({ anioId: consulta.anioId, seccionId: consulta.seccionId, bimestreId: consulta.bimestreId, q: consulta.q }, p),
  }),
);

/** Sube la plantilla oficial (.xlsx) de una sección y bimestre. Cuerpo: FormData (seccionId, bimestreId, archivo). */
export const POST = ruta({ permiso: PERMISO }, async ({ req, actor }) => {
  const form = await req.formData();
  const datos = esquemaPlantilla.safeParse({ seccionId: form.get('seccionId'), bimestreId: form.get('bimestreId') });
  if (!datos.success) throw new ValidationError(datos.error.issues[0]?.message ?? 'Datos inválidos', { campos: datos.error.flatten().fieldErrors });
  return servicio.subirPlantilla(actor, datos.data, await archivoDeFormulario(form));
});
