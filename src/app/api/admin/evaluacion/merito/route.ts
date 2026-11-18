import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { archivoDeFormulario } from '@/server/almacenamiento';
import { ValidationError } from '@/server/errores';
import { consultaPublicaciones, esquemaPublicacion, type FilaPublicacion } from '@/esquemas/evaluacion/merito';
import * as servicio from '@/server/services/evaluacion/merito';

const PERMISO = 'academico.publicar_merito';

export const GET = ruta({ permiso: PERMISO, consulta: consultaPublicaciones }, async ({ consulta }) =>
  responderListado<FilaPublicacion>(consulta, {
    titulo: 'Publicaciones de mérito',
    filtros: { Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Grado', valor: (f) => `${f.grado}.º ${f.nivel}` },
      { titulo: 'Alcance', valor: 'alcance' },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Referencia SIAGIE', valor: 'referencia_siagie' },
      { titulo: 'Puestos', valor: 'puestos', formato: 'numero' },
      { titulo: 'Publicado', valor: (f) => (f.publicado_en ? new Date(f.publicado_en) : null), formato: 'fechaHora' },
    ],
    obtener: (p) => servicio.listarPublicaciones({ anioId: consulta.anioId, gradoId: consulta.gradoId, q: consulta.q }, p),
  }),
);

/** Registra el listado oficial de SIAGIE. Cuerpo: FormData (anioId, gradoId, alcance, referenciaSiagie, archivo). */
export const POST = ruta({ permiso: PERMISO }, async ({ req, actor }) => {
  const form = await req.formData();
  const datos = esquemaPublicacion.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')));
  if (!datos.success) throw new ValidationError(datos.error.issues[0]?.message ?? 'Datos inválidos', { campos: datos.error.flatten().fieldErrors });
  return servicio.registrarPublicacion(actor, datos.data, await archivoDeFormulario(form));
});
