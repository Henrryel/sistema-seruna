// Arranque del servidor Next.js. Con WORKER_REPORTES=1 (runtime Node) procesa la cola de documentos
// (documentos_emitidos en estado 'preparado') en segundo plano. Intervalo: WORKER_REPORTES_INTERVALO_MS.
// La condición sobre NEXT_RUNTIME va en un `if` (no en un return temprano) para que el bundle edge
// descarte la importación dinámica (pg, @react-pdf, exceljs solo existen en Node).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.WORKER_REPORTES === '1') {
      const { iniciarWorkerReportes } = await import('@/server/services/reportes/worker');
      iniciarWorkerReportes();
    }
  }
}
