import 'server-only';
import { transaccion } from '@/server/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/server/errores';
import { guardarArchivo, leerArchivo } from '@/server/almacenamiento';
import { tienePermiso } from '@/server/autorizacion/permisos';
import { registrarBitacora } from '@/server/repositories/bitacora';
import * as repo from '@/server/repositories/matricula/documentos';
import type { Actor } from '@/server/auth/actor';
import type { DatosDocumentoInstitucional } from '@/esquemas/matricula/documentos';
import { conMensajes, type ArchivoSubido } from './comun';

// Documentos institucionales versionados por año (reglamento, contrato, condiciones económicas).
// La versión se asigna correlativa; la base exige vigente_desde para publicar y unicidad por año/tipo/versión.

export const listarDocumentosInstitucionales = repo.listarDocumentosInstitucionales;

export async function cargarDocumentoInstitucional(actor: Actor, datos: DatosDocumentoInstitucional, archivo: ArchivoSubido) {
  if (archivo.tipoMime !== 'application/pdf') throw new ValidationError('El documento institucional debe ser un PDF');
  return conMensajes(() =>
    transaccion(async () => {
      const a = await guardarArchivo(archivo);
      const version = await repo.siguienteVersionDocumento(datos.anioId, datos.tipo);
      const r = await repo.crearDocumentoInstitucional({ anioId: datos.anioId, tipo: datos.tipo, version, archivoId: a.id, vigenteDesde: datos.vigenteDesde ?? null });
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'crear', entidad: 'documentos_institucionales', registroId: r.id, resultado: 'ok' });
      return r;
    }),
  );
}

export async function publicarDocumentoInstitucional(actor: Actor, id: string, vigenteDesde?: string) {
  const d = await repo.obtenerDocumentoInstitucional(id);
  if (!d) throw new NotFoundError('El documento institucional no existe');
  if (d.publicado_en) throw new ConflictError('El documento ya está publicado');
  return conMensajes(() =>
    transaccion(async () => {
      const r = await repo.publicarDocumentoInstitucional(id, vigenteDesde ?? null);
      if (!r) throw new ConflictError('El documento ya está publicado');
      await registrarBitacora({ actorId: actor.usuarioId, accion: 'publicar', entidad: 'documentos_institucionales', registroId: id, resultado: 'ok' });
      return r;
    }),
  );
}

/**
 * Descarga de un archivo del módulo (expediente, documento institucional o evidencia) autorizada por
 * el registro que lo referencia: el expediente exige `expediente.gestionar`; lo demás `matriculas.gestionar`.
 */
export async function descargarArchivo(actor: Actor, archivoId: string) {
  const ref = await repo.referenciasArchivo(archivoId);
  const permitido =
    (ref.expediente && tienePermiso(actor, 'expediente.gestionar')) ||
    ((ref.institucional || ref.evidencia) && tienePermiso(actor, 'matriculas.gestionar'));
  if (!ref.expediente && !ref.institucional && !ref.evidencia) throw new NotFoundError('El archivo no existe');
  if (!permitido) throw new ForbiddenError();
  const archivo = await leerArchivo(archivoId);
  await registrarBitacora({ actorId: actor.usuarioId, accion: 'descargar', entidad: 'archivos', registroId: archivoId, resultado: 'ok' });
  return archivo;
}
