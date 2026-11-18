import 'server-only';
import { Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { DocumentoPdf, EncabezadoPdf, PiePdf, estilosPdf, renderizarPdf } from '@/server/pdf/base';
import { textoCelda } from '@/server/exportacion/formato';
import type { DetallePago } from '@/esquemas/cobros/pagos';
import { ETIQUETA_COMPROBANTE, ETIQUETA_MEDIO } from '@/esquemas/cobros/pagos';
import { descripcionCuota } from '@/esquemas/cobros/cuotas';
import { aCentimos, deCentimos, numeroRecibo } from '@/esquemas/cobros/dinero';
import { importeEnLetras } from './letras';

const e = StyleSheet.create({
  pagina: { padding: 24, paddingBottom: 36, fontSize: 8.5, fontFamily: 'Helvetica', color: '#111' },
  bloque: { flexDirection: 'row', gap: 8, marginTop: 6 },
  caja: { flexGrow: 1, flexBasis: 0, borderWidth: 0.5, borderColor: '#ccc', borderRadius: 3, padding: 6 },
  fila: { flexDirection: 'row', marginBottom: 2 },
  etiqueta: { fontFamily: 'Helvetica-Bold', width: 62 },
  valor: { flexGrow: 1, flexBasis: 0 },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  letras: { marginTop: 2, fontSize: 8, textAlign: 'right' },
  revertido: {
    marginTop: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#b42318',
    color: '#b42318',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'center',
  },
  nota: { marginTop: 10, fontSize: 7, color: '#555' },
  cabecera: { flexDirection: 'row', backgroundColor: '#2f3d8f', color: '#fff', fontFamily: 'Helvetica-Bold' },
  celda: { padding: 3 },
  linea: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
});

const moneda = (v: string | number | null | undefined) => textoCelda(v, 'moneda');

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <View style={e.fila}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <Text style={e.valor}>{valor || '—'}</Text>
    </View>
  );
}

const COLUMNAS = [
  { titulo: 'Concepto', peso: 3 },
  { titulo: 'Vence', peso: 1.2 },
  { titulo: 'Importe', peso: 1.2 },
  { titulo: 'Devuelto', peso: 1.2 },
];

/** Recibo de caja interno (PDF A5) a partir del detalle del pago. */
export async function generarReciboPdf(d: DetallePago): Promise<Buffer> {
  const numero = numeroRecibo(d.recibo?.serie, d.recibo?.numero);
  const medio = `${ETIQUETA_MEDIO[d.medio_ui]}${d.referencia && d.medio_ui !== 'yape' && d.medio_ui !== 'plin' ? ` · ${d.referencia}` : ''}${
    d.medio_ui === 'yape' || d.medio_ui === 'plin' ? ` · Operación ${d.referencia?.replace(/^(yape|plin):\s*/i, '') ?? ''}` : ''
  }`;
  const devuelto = d.devoluciones.reduce((t, x) => t + aCentimos(x.importe), 0);
  return renderizarPdf(
    <DocumentoPdf titulo={`Recibo ${numero}`}>
      <Page size="A5" style={e.pagina} wrap>
        <EncabezadoPdf titulo={`Recibo de caja N.º ${numero}`} subtitulo="Recibo interno de la institución. No reemplaza al comprobante de pago electrónico (SUNAT)." />
        {d.reversion ? (
          <Text style={e.revertido}>
            PAGO REVERTIDO el {textoCelda(d.reversion.revertido_en, 'fechaHora')} — {d.reversion.motivo}
          </Text>
        ) : null}
        <View style={e.bloque}>
          <View style={e.caja}>
            <Dato etiqueta="Fecha" valor={textoCelda(d.pagado_en, 'fechaHora')} />
            <Dato etiqueta="Medio" valor={medio} />
            <Dato etiqueta="Caja" valor={d.caja} />
            <Dato etiqueta="Cajero" valor={d.recibo?.emitido_por ?? d.registrado_por} />
          </View>
          <View style={e.caja}>
            <Dato etiqueta="Alumno" valor={d.alumno?.nombre} />
            <Dato etiqueta="Código" valor={d.alumno?.codigo} />
            <Dato etiqueta="Año" valor={d.alumno ? String(d.alumno.anio) : null} />
            <Dato etiqueta="Grado" valor={d.alumno ? [d.alumno.grado, d.alumno.seccion && `sección ${d.alumno.seccion}`].filter(Boolean).join(' · ') : null} />
          </View>
        </View>
        <View style={[e.caja, { marginTop: 6 }]}>
          <Dato etiqueta="Recibí de" valor={d.pagante.nombre} />
          <Dato etiqueta="Documento" valor={[d.pagante.tipoDocumento, d.pagante.numeroDocumento].filter(Boolean).join(' ') || null} />
          <Dato etiqueta="Dirección" valor={d.pagante.direccion} />
        </View>

        <View style={[estilosPdf.tabla, { marginTop: 8 }]}>
          <View style={e.cabecera}>
            {COLUMNAS.map((c) => (
              <Text key={c.titulo} style={[e.celda, { flexGrow: c.peso, flexBasis: 0, textAlign: c.titulo === 'Concepto' ? 'left' : 'right' }]}>
                {c.titulo}
              </Text>
            ))}
          </View>
          {d.aplicaciones.map((a) => (
            <View key={a.id} style={e.linea} wrap={false}>
              <Text style={[e.celda, { flexGrow: 3, flexBasis: 0 }]}>{descripcionCuota(a)}</Text>
              <Text style={[e.celda, { flexGrow: 1.2, flexBasis: 0, textAlign: 'right' }]}>{textoCelda(a.vence_en, 'fecha')}</Text>
              <Text style={[e.celda, { flexGrow: 1.2, flexBasis: 0, textAlign: 'right' }]}>{moneda(a.importe)}</Text>
              <Text style={[e.celda, { flexGrow: 1.2, flexBasis: 0, textAlign: 'right' }]}>{aCentimos(a.devuelto) ? moneda(a.devuelto) : '—'}</Text>
            </View>
          ))}
        </View>
        <View style={e.total}>
          <Text>Total recibido: {moneda(d.importe)}</Text>
        </View>
        <Text style={e.letras}>SON: {importeEnLetras(aCentimos(d.importe))}</Text>
        {devuelto ? <Text style={e.letras}>Devoluciones registradas: {moneda(deCentimos(devuelto))}</Text> : null}

        {d.devoluciones.length ? (
          <View style={{ marginTop: 6 }}>
            <Text style={estilosPdf.seccion}>Devoluciones</Text>
            {d.devoluciones.map((x) => (
              <Text key={x.id}>
                {textoCelda(x.devuelto_en, 'fechaHora')} · {moneda(x.importe)} · {x.en_efectivo ? 'efectivo' : 'otro medio'} · {x.motivo}
              </Text>
            ))}
          </View>
        ) : null}
        {d.comprobantes.length ? (
          <View style={{ marginTop: 6 }}>
            <Text style={estilosPdf.seccion}>Comprobantes electrónicos asociados</Text>
            {d.comprobantes.map((c) => (
              <Text key={c.id}>
                {ETIQUETA_COMPROBANTE[c.tipo] ?? c.tipo} {c.serie}-{c.numero} · RUC {c.ruc_emisor} · {textoCelda(c.emitido_en, 'fecha')} · {c.estado}
              </Text>
            ))}
          </View>
        ) : null}
        <Text style={e.nota}>
          Conserve este recibo. Las correcciones se registran como ajustes, devoluciones o reversiones; el recibo no se modifica.
        </Text>
        <PiePdf />
      </Page>
    </DocumentoPdf>,
  );
}
