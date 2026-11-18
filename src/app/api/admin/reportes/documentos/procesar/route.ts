import { ruta } from '@/server/http/ruta';
import { PERMISOS_REPORTES } from '@/esquemas/reportes/documentos';
import { procesarCola } from '@/server/services/reportes/worker';

/** "Procesar ahora": atiende la cola sin esperar al worker (SKIP LOCKED evita duplicar trabajo). */
export const POST = ruta({ permiso: PERMISOS_REPORTES }, async ({ actor }) => {
  const resultados = await procesarCola({ limite: 10, procesadoPor: actor.usuarioId });
  return {
    procesados: resultados.length,
    emitidos: resultados.filter((r) => r.estado === 'emitido').length,
    fallidos: resultados.filter((r) => r.estado === 'fallido').length,
    resultados,
  };
});
