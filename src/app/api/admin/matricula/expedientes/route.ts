import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { consultaExpedientes, esquemaCargaExpediente, type FilaDocumentoExpediente } from '@/esquemas/matricula/expedientes';
import { etiqueta } from '@/esquemas/matricula/comunes';
import * as servicio from '@/server/services/matricula/expedientes';
import { leerFormulario } from '@/app/api/admin/matricula/_lib/formulario';

export const GET = ruta({ permiso: 'expediente.gestionar', consulta: consultaExpedientes }, async ({ consulta }) =>
  responderListado<FilaDocumentoExpediente>(consulta, {
    titulo: 'Documentos del expediente',
    filtros: { Estado: consulta.estado ? etiqueta(consulta.estado) : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Código', valor: 'codigo' },
      { titulo: 'Estudiante', valor: (f) => `${f.apellidos}, ${f.nombres}`, ancho: 28 },
      { titulo: 'Documento', valor: 'tipo_documento', ancho: 20 },
      { titulo: 'Año', valor: 'anio' },
      { titulo: 'Archivo', valor: 'nombre_archivo', ancho: 20 },
      { titulo: 'Estado', valor: (f) => etiqueta(f.estado) },
      { titulo: 'Cargado', valor: (f) => new Date(f.cargado_en), formato: 'fechaHora' },
      { titulo: 'Observación', valor: 'observacion', ancho: 20 },
    ],
    obtener: (p) => servicio.listarDocumentos(consulta, p),
  }),
);

/** Carga de un documento (multipart: estudianteId, matriculaId?, tipoDocumentoId y `archivo`). */
export const POST = ruta({ permiso: 'expediente.gestionar' }, async ({ req, actor }) => {
  const { datos, archivo } = await leerFormulario(req, esquemaCargaExpediente, { archivo: 'requerido' });
  return servicio.cargarDocumento(actor, datos, archivo);
});
