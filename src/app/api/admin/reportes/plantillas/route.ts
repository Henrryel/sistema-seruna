import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaPlantillas, esquemaPlantilla, type FilaPlantilla } from '@/esquemas/reportes/plantillas';
import { archivoOpcional, camposTexto, leerFormulario, validarDatos } from '@/server/services/reportes/entrada';
import * as servicio from '@/server/services/reportes/plantillas';

export const GET = ruta({ permiso: 'reportes.configurar', consulta: consultaPlantillas }, async ({ consulta }) =>
  responderListado<FilaPlantilla>(consulta, {
    titulo: 'Plantillas de documento',
    filtros: { Tipo: consulta.tipo, Formato: consulta.formatoDocumento, Estado: consulta.estado, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Tipo', valor: 'tipo_nombre' },
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Formato', valor: (f) => f.formato.toUpperCase() },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Nombre', valor: 'nombre' },
      { titulo: 'Estado', valor: (f) => (f.publicada_en ? 'Publicada' : 'Borrador') },
      { titulo: 'Publicada', valor: 'publicada_en', formato: 'fechaHora' },
      { titulo: 'Documentos', valor: 'documentos', formato: 'numero' },
    ],
    obtener: (p) =>
      servicio.listarPlantillas({ q: consulta.q, anioId: consulta.anioId, tipo: consulta.tipo, formato: consulta.formatoDocumento, estado: consulta.estado }, p),
  }),
);

/** multipart/form-data: campos de la plantilla + `archivo` opcional. */
export const POST = ruta({ permiso: 'reportes.configurar' }, async ({ req, actor }) => {
  const form = await leerFormulario(req);
  const datos = validarDatos(esquemaPlantilla, camposTexto(form));
  return servicio.crearPlantilla(actor, datos, await archivoOpcional(form));
});
