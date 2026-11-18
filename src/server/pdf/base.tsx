import 'server-only';
import type { ReactElement, ReactNode } from 'react';
import { Document, Page, StyleSheet, Text, View, renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { ahoraLegible, institucion } from '@/server/exportacion/formato';

export const estilosPdf = StyleSheet.create({
  pagina: { padding: 28, paddingBottom: 40, fontSize: 9, fontFamily: 'Helvetica', color: '#111' },
  encabezado: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#2f3d8f', paddingBottom: 6 },
  institucion: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2f3d8f' },
  titulo: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  subtitulo: { fontSize: 8, color: '#555', marginTop: 2 },
  tabla: { width: '100%', marginTop: 6 },
  filaCabecera: { flexDirection: 'row', backgroundColor: '#2f3d8f', color: '#fff', fontFamily: 'Helvetica-Bold' },
  fila: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
  filaPar: { backgroundColor: '#f4f5fb' },
  celda: { padding: 3, flexGrow: 1, flexBasis: 0 },
  pie: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#777', flexDirection: 'row', justifyContent: 'space-between' },
  etiqueta: { fontFamily: 'Helvetica-Bold' },
  seccion: { marginTop: 10, marginBottom: 4, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2f3d8f' },
});

export function EncabezadoPdf({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const inst = institucion();
  return (
    <View style={estilosPdf.encabezado} fixed>
      <Text style={estilosPdf.institucion}>{inst.nombre}</Text>
      {inst.ruc || inst.direccion ? (
        <Text style={estilosPdf.subtitulo}>{[inst.ruc && `RUC ${inst.ruc}`, inst.direccion].filter(Boolean).join(' · ')}</Text>
      ) : null}
      <Text style={estilosPdf.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={estilosPdf.subtitulo}>{subtitulo}</Text> : null}
    </View>
  );
}

export function PiePdf() {
  return (
    <View style={estilosPdf.pie} fixed>
      <Text>Generado: {ahoraLegible()}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

/** Página estándar A4 con encabezado institucional y pie con numeración. */
export function PaginaPdf(props: { titulo: string; subtitulo?: string; horizontal?: boolean; children: ReactNode }) {
  return (
    <Page size="A4" orientation={props.horizontal ? 'landscape' : 'portrait'} style={estilosPdf.pagina} wrap>
      <EncabezadoPdf titulo={props.titulo} subtitulo={props.subtitulo} />
      {props.children}
      <PiePdf />
    </Page>
  );
}

export function TablaPdf(props: { columnas: { titulo: string; peso?: number }[]; filas: string[][] }) {
  return (
    <View style={estilosPdf.tabla}>
      <View style={estilosPdf.filaCabecera} fixed>
        {props.columnas.map((c, i) => (
          <Text key={i} style={[estilosPdf.celda, { flexGrow: c.peso ?? 1 }]}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {props.filas.map((fila, i) => (
        <View key={i} style={i % 2 ? [estilosPdf.fila, estilosPdf.filaPar] : estilosPdf.fila} wrap={false}>
          {fila.map((valor, j) => (
            <Text key={j} style={[estilosPdf.celda, { flexGrow: props.columnas[j]?.peso ?? 1 }]}>
              {valor}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function DocumentoPdf(props: { titulo: string; children: ReactNode }) {
  return (
    <Document title={props.titulo} author={institucion().nombre} language="es-PE">
      {props.children}
    </Document>
  );
}

/** Renderiza un documento react-pdf a Buffer (solo en el servidor, runtime Node). */
export async function renderizarPdf(documento: ReactElement<DocumentProps>): Promise<Buffer> {
  return renderToBuffer(documento);
}
