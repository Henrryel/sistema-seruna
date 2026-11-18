import { ruta } from '@/server/http/ruta';
import { responderListado } from '@/server/http/listado';
import { PERMISOS_COMUNICACIONES } from '@/esquemas/reportes/documentos';
import { NOMBRE_CANAL, NOMBRE_DOCUMENTO_INSTITUCIONAL, consultaComunicaciones, esquemaComunicacion, type FilaComunicacion } from '@/esquemas/reportes/comunicaciones';
import { archivoOpcional, camposTexto, leerFormulario, validarDatos } from '@/server/services/reportes/entrada';
import * as servicio from '@/server/services/reportes/comunicaciones';

export const GET = ruta({ permiso: PERMISOS_COMUNICACIONES, consulta: consultaComunicaciones }, async ({ consulta }) =>
  responderListado<FilaComunicacion>(consulta, {
    titulo: 'Comunicaciones de documentos',
    filtros: { Canal: consulta.canal ? (NOMBRE_CANAL[consulta.canal] ?? consulta.canal) : undefined, Búsqueda: consulta.q },
    columnas: [
      { titulo: 'Documento', valor: (f) => `${NOMBRE_DOCUMENTO_INSTITUCIONAL[f.documento_tipo] ?? f.documento_tipo} ${f.anio} v${f.documento_version}` },
      { titulo: 'Destinatario', valor: (f) => f.destinatario ?? '' },
      { titulo: 'Alcance', valor: (f) => f.alcance ?? '' },
      { titulo: 'Canal', valor: (f) => NOMBRE_CANAL[f.canal] ?? f.canal },
      { titulo: 'Comunicado', valor: 'comunicado_en', formato: 'fechaHora' },
      { titulo: 'Evidencia', valor: (f) => f.evidencia_nombre ?? '' },
      { titulo: 'Registrado por', valor: 'registrado_por_login' },
    ],
    obtener: (p) => servicio.listarComunicaciones({ q: consulta.q, documentoId: consulta.documentoId, canal: consulta.canal }, p),
  }),
);

/** multipart/form-data: datos de la comunicación + `evidencia` opcional. */
export const POST = ruta({ permiso: PERMISOS_COMUNICACIONES }, async ({ req, actor }) => {
  const form = await leerFormulario(req);
  const datos = validarDatos(esquemaComunicacion, camposTexto(form));
  return servicio.registrarComunicacion(actor, datos, await archivoOpcional(form, 'evidencia'));
});
