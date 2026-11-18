import 'server-only';
import { Image, Text, View } from '@react-pdf/renderer';
import { DocumentoPdf, PaginaPdf, TablaPdf, estilosPdf, renderizarPdf } from '@/server/pdf/base';

// PDFs de la cola de documentos (documentos_emitidos): tabla genérica con las claves de cada fila y
// resumen de indicadores (tipo 'dashboard'). Usa la página institucional de `src/server/pdf/base.tsx`.

export interface LogoPdf {
  data: Buffer;
  format: 'png' | 'jpg';
}

function Logo({ logo }: { logo?: LogoPdf | null }) {
  if (!logo) return null;
  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf no admite alt; el PDF lleva título del documento.
  return <Image src={logo} style={{ height: 36, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 6 }} />;
}

/** Tabla genérica (una columna por clave). Con muchas columnas reduce la letra para que quepa en A4 horizontal. */
export async function generarPdfTabla(e: {
  titulo: string;
  subtitulo?: string;
  columnas: { titulo: string; peso?: number }[];
  filas: string[][];
  horizontal?: boolean;
  logo?: LogoPdf | null;
}): Promise<Buffer> {
  const n = e.columnas.length;
  const tamano = n > 12 ? 6 : n > 8 ? 7 : 8;
  return renderizarPdf(
    <DocumentoPdf titulo={e.titulo}>
      <PaginaPdf titulo={e.titulo} subtitulo={e.subtitulo} horizontal={e.horizontal ?? n > 6}>
        <Logo logo={e.logo} />
        {e.filas.length ? (
          <View style={{ fontSize: tamano }}>
            <TablaPdf columnas={e.columnas} filas={e.filas} />
          </View>
        ) : (
          <Text style={estilosPdf.subtitulo}>El documento no tiene registros para los filtros solicitados.</Text>
        )}
      </PaginaPdf>
    </DocumentoPdf>,
  );
}

/** Resumen por secciones (Indicador / Valor). */
export async function generarPdfResumen(e: {
  titulo: string;
  subtitulo?: string;
  secciones: { titulo: string; filas: [string, string][] }[];
  logo?: LogoPdf | null;
}): Promise<Buffer> {
  return renderizarPdf(
    <DocumentoPdf titulo={e.titulo}>
      <PaginaPdf titulo={e.titulo} subtitulo={e.subtitulo}>
        <Logo logo={e.logo} />
        {e.secciones.map((s) => (
          <View key={s.titulo} wrap={false}>
            <Text style={estilosPdf.seccion}>{s.titulo}</Text>
            <TablaPdf
              columnas={[
                { titulo: 'Indicador', peso: 3 },
                { titulo: 'Valor', peso: 2 },
              ]}
              filas={s.filas.map(([k, v]) => [k, v])}
            />
          </View>
        ))}
      </PaginaPdf>
    </DocumentoPdf>,
  );
}
