import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaDocumentosInstitucionales, esquemaDocumentoInstitucional, type FilaDocumentoInstitucional } from '@/esquemas/matricula/documentos';
import { etiqueta } from '@/esquemas/matricula/comunes';
import * as servicio from '@/server/services/matricula/documentos';
import { leerFormulario } from '@/app/api/admin/matricula/_lib/formulario';

export const GET = ruta({ permiso: 'matriculas.gestionar', consulta: consultaDocumentosInstitucionales }, async ({ consulta }) =>
  responderListado<FilaDocumentoInstitucional>(consulta, {
    titulo: 'Documentos institucionales',
    filtros: { Tipo: consulta.tipo ? etiqueta(consulta.tipo) : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Tipo', valor: (f) => etiqueta(f.tipo), ancho: 18 },
      { titulo: 'Versión', valor: 'version', formato: 'numero' },
      { titulo: 'Archivo', valor: 'nombre_archivo', ancho: 24 },
      { titulo: 'Vigente desde', valor: 'vigente_desde', formato: 'fecha' },
      { titulo: 'Publicado', valor: (f) => (f.publicado_en ? new Date(f.publicado_en) : null), formato: 'fechaHora' },
      { titulo: 'Aceptaciones', valor: 'aceptaciones', formato: 'numero' },
    ],
    obtener: (p) => servicio.listarDocumentosInstitucionales(consulta, p),
  }),
);

/** Carga de una nueva versión (multipart: anioId, tipo, vigenteDesde? y `archivo` PDF). */
export const POST = ruta({ permiso: 'matriculas.gestionar' }, async ({ req, actor }) => {
  const { datos, archivo } = await leerFormulario(req, esquemaDocumentoInstitucional, { archivo: 'requerido' });
  return servicio.cargarDocumentoInstitucional(actor, datos, archivo);
});
