import 'server-only';
import * as repo from '@/server/repositories/identidad/bitacora';

// Consulta de auditoría (solo lectura; la bitácora no se edita ni se borra).

export const listarBitacora = repo.listarBitacora;
export const opcionesBitacora = repo.opcionesBitacora;
