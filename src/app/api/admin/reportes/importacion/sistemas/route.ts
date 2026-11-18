import { ruta } from '@/server/http/ruta';
import { sistemasImportados } from '@/server/services/importacion/lotes';

/** Sistemas de origen con lotes registrados (filtro del archivo histórico). */
export const GET = ruta({ permiso: 'datos.conciliar_historico' }, async () => ({ sistemas: await sistemasImportados() }));
