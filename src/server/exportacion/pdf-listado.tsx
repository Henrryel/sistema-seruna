import 'server-only';
import { Text } from '@react-pdf/renderer';
import { DocumentoPdf, PaginaPdf, TablaPdf, renderizarPdf, estilosPdf } from '@/server/pdf/base';
import { valorColumna, type ColumnaExportacion } from '@/server/http/listado';
import { textoCelda } from './formato';

/** PDF de un listado con los mismos filtros de la pantalla. */
export async function generarPdfListado<F>(datos: {
  titulo: string;
  columnas: ColumnaExportacion<F>[];
  filas: F[];
  filtros?: Record<string, string>;
  horizontal?: boolean;
}): Promise<Buffer> {
  const filtros = Object.entries(datos.filtros ?? {});
  const subtitulo = [
    `${datos.filas.length} registro(s)`,
    filtros.length ? `Filtros: ${filtros.map(([k, v]) => `${k}: ${v}`).join(' · ')}` : '',
  ]
    .filter(Boolean)
    .join(' — ');
  const filas = datos.filas.map((f) => datos.columnas.map((c) => textoCelda(valorColumna(f, c), c.formato)));
  return renderizarPdf(
    <DocumentoPdf titulo={datos.titulo}>
      <PaginaPdf titulo={datos.titulo} subtitulo={subtitulo} horizontal={datos.horizontal}>
        {filas.length ? (
          <TablaPdf columnas={datos.columnas.map((c) => ({ titulo: c.titulo, peso: c.ancho ? c.ancho / 10 : 1 }))} filas={filas} />
        ) : (
          <Text style={estilosPdf.subtitulo}>Sin registros para los filtros seleccionados.</Text>
        )}
      </PaginaPdf>
    </DocumentoPdf>,
  );
}
