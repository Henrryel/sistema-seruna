/** @jsxRuntime automatic */
/** @jsxImportSource react */
// (pragmas: el transformador de Vitest no hereda el JSX automático de Next)
import 'server-only';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { institucion } from '@/server/exportacion/formato';
import { renderizarPdf } from '@/server/pdf/base';
import { formatoFecha } from '@/lib/formato';

// Carnets tamaño CR80 (85,60 × 53,98 mm, ISO/IEC 7810 ID-1), 10 por hoja A4 (2 × 5) con líneas de corte.
// QR y Code 128 llevan el MISMO token; el token no se imprime en claro.

const MM = 72 / 25.4;
const ANCHO = 85.6 * MM;
const ALTO = 53.98 * MM;
const COLUMNAS = 2;
const FILAS = 5;
const POR_PAGINA = COLUMNAS * FILAS;
const AZUL = '#2f3d8f';

const e = StyleSheet.create({
  pagina: { paddingTop: 24, paddingHorizontal: 44, fontFamily: 'Helvetica', color: '#111' },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  carnet: { width: ANCHO, height: ALTO, borderWidth: 0.5, borderColor: '#9aa0b4', borderStyle: 'dashed', borderRadius: 6, overflow: 'hidden' },
  banda: { backgroundColor: AZUL, color: '#fff', paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between' },
  institucion: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, maxWidth: ANCHO - 70 },
  perfil: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  cuerpo: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 5, gap: 6 },
  datos: { flexGrow: 1, flexBasis: 0, gap: 2 },
  nombre: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, lineHeight: 1.15 },
  apellidos: { fontSize: 8.5, lineHeight: 1.15 },
  linea: { fontSize: 7, color: '#333' },
  etiqueta: { fontFamily: 'Helvetica-Bold' },
  qr: { width: 66, height: 66 },
  barras: { marginTop: 6, marginHorizontal: 12, height: 32 },
  pie: { fontSize: 5.5, color: '#666', textAlign: 'center', marginTop: 3 },
});

export interface Carnet {
  nombres: string;
  apellidos: string;
  perfil: 'alumno' | 'docente';
  codigo: string;
  detalle: string | null;
  expiraEn: string;
  qr: string;
  code128: string;
}

function TarjetaCarnet({ c, nombreInstitucion }: { c: Carnet; nombreInstitucion: string }) {
  return (
    <View style={e.carnet} wrap={false}>
      <View style={e.banda}>
        <Text style={e.institucion}>{nombreInstitucion}</Text>
        <Text style={e.perfil}>{c.perfil === 'alumno' ? 'ESTUDIANTE' : 'DOCENTE'}</Text>
      </View>
      <View style={e.cuerpo}>
        <View style={e.datos}>
          <Text style={e.nombre}>{c.nombres}</Text>
          <Text style={e.apellidos}>{c.apellidos}</Text>
          <Text style={e.linea}>
            <Text style={e.etiqueta}>Código: </Text>
            {c.codigo}
          </Text>
          {c.detalle ? (
            <Text style={e.linea}>
              <Text style={e.etiqueta}>{c.perfil === 'alumno' ? 'Sección: ' : 'Cargo: '}</Text>
              {c.detalle}
            </Text>
          ) : null}
          <Text style={e.linea}>
            <Text style={e.etiqueta}>Vence: </Text>
            {formatoFecha(c.expiraEn)}
          </Text>
        </View>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image no admite alt */}
        <Image style={e.qr} src={c.qr} />
      </View>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image no admite alt */}
      <Image style={e.barras} src={c.code128} />
      <Text style={e.pie}>Credencial personal e intransferible · Si la encuentra, devuélvala al colegio</Text>
    </View>
  );
}

export async function generarPdfCarnets(carnets: Carnet[]): Promise<Buffer> {
  const inst = institucion();
  const paginas: Carnet[][] = [];
  for (let i = 0; i < carnets.length; i += POR_PAGINA) paginas.push(carnets.slice(i, i + POR_PAGINA));
  return renderizarPdf(
    <Document title="Carnets de asistencia" author={inst.nombre} language="es-PE">
      {paginas.map((grupo, i) => (
        <Page key={i} size="A4" style={e.pagina}>
          <View style={e.grilla}>
            {grupo.map((c, j) => (
              <TarjetaCarnet key={j} c={c} nombreInstitucion={inst.nombre} />
            ))}
          </View>
        </Page>
      ))}
    </Document>,
  );
}
