import 'server-only';
import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { DocumentoPdf, PaginaPdf, TablaPdf, estilosPdf, renderizarPdf } from '@/server/pdf/base';
import type { DatosBoleta } from '@/esquemas/evaluacion/notas';

// Libreta / boletín de logros por matrícula: bimestres PUBLICADOS, competencias por área, conclusiones
// descriptivas y situación final vigente (si existe).

const ETIQUETA_NIVEL: Record<string, string> = { AD: 'Logro destacado', A: 'Logro esperado', B: 'En proceso', C: 'En inicio' };
const ETIQUETA_SITUACION: Record<string, string> = { promovido: 'Promovido(a)', recuperacion: 'Requiere recuperación', permanencia: 'Permanece en el grado' };

const e = StyleSheet.create({
  datos: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  dato: { width: '50%', marginBottom: 2 },
  leyenda: { marginTop: 8, fontSize: 7, color: '#555' },
  conclusion: { marginBottom: 3 },
  situacion: { marginTop: 10, padding: 6, borderWidth: 1, borderColor: '#2f3d8f' },
  firmas: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 36 },
  firma: { width: '35%', borderTopWidth: 0.5, borderTopColor: '#333', paddingTop: 3, textAlign: 'center', fontSize: 8 },
  vacio: { marginTop: 8, color: '#555' },
});

function celda(boleta: DatosBoleta, comp: DatosBoleta['areas'][number]['competencias'][number], n: number) {
  const l = comp.bimestres[String(n)];
  if (!l) return boleta.bimestres.some((b) => b.numero === n) ? '—' : '';
  if (l.estado === 'no_desarrollada') return 'ND';
  return l.nivel ?? '—';
}

function PaginaLibreta({ boleta }: { boleta: DatosBoleta }) {
  const m = boleta.matricula;
  const conclusiones = boleta.areas.flatMap((a) =>
    a.competencias.flatMap((c) =>
      Object.entries(c.bimestres)
        .filter(([, l]) => l.conclusion)
        .map(([n, l]) => ({ texto: `${n}.º bim. · ${c.nombre}: ${l.conclusion}` })),
    ),
  );
  const conAnual = boleta.areas.some((a) => a.competencias.some((c) => c.anual));
  return (
    <PaginaPdf titulo="Informe de progreso de competencias" subtitulo={`Año escolar ${m.anio} · ${m.grado}.º de ${m.nivel}${m.seccion ? ` · Sección ${m.seccion}` : ''}`}>
      <View style={e.datos}>
        <Text style={e.dato}>
          <Text style={estilosPdf.etiqueta}>Estudiante: </Text>
          {m.estudiante.apellidos}, {m.estudiante.nombres}
        </Text>
        <Text style={e.dato}>
          <Text style={estilosPdf.etiqueta}>Código: </Text>
          {m.estudiante.codigo}
          {m.estudiante.codigoSiagie ? ` · SIAGIE ${m.estudiante.codigoSiagie}` : ''}
        </Text>
        <Text style={e.dato}>
          <Text style={estilosPdf.etiqueta}>Bimestres publicados: </Text>
          {boleta.bimestres.length ? boleta.bimestres.map((b) => `${b.numero}.º`).join(', ') : 'ninguno'}
        </Text>
      </View>
      {boleta.areas.length === 0 ? <Text style={e.vacio}>Aún no hay logros publicados para esta matrícula.</Text> : null}
      {boleta.areas.map((a) => (
        <View key={a.area} wrap={false}>
          <Text style={estilosPdf.seccion}>{a.area}</Text>
          <TablaPdf
            columnas={[
              { titulo: 'Competencia', peso: 6 },
              { titulo: '1.º', peso: 1 },
              { titulo: '2.º', peso: 1 },
              { titulo: '3.º', peso: 1 },
              { titulo: '4.º', peso: 1 },
              ...(conAnual ? [{ titulo: 'Final', peso: 1 }] : []),
            ]}
            filas={a.competencias.map((c) => [
              c.nombre,
              celda(boleta, c, 1),
              celda(boleta, c, 2),
              celda(boleta, c, 3),
              celda(boleta, c, 4),
              ...(conAnual ? [c.anual ? `${c.anual.nivel}${c.anual.requiereRecuperacion ? '*' : ''}` : '—'] : []),
            ])}
          />
        </View>
      ))}
      {conclusiones.length ? (
        <View>
          <Text style={estilosPdf.seccion}>Conclusiones descriptivas</Text>
          {conclusiones.map((c, i) => (
            <Text key={i} style={e.conclusion}>
              {c.texto}
            </Text>
          ))}
        </View>
      ) : null}
      {boleta.situacionFinal ? (
        <View style={e.situacion} wrap={false}>
          <Text>
            <Text style={estilosPdf.etiqueta}>Situación final: </Text>
            {ETIQUETA_SITUACION[boleta.situacionFinal.situacion] ?? boleta.situacionFinal.situacion}
            {boleta.situacionFinal.etapa !== 'ordinario' ? ` (versión ${boleta.situacionFinal.version}, ${boleta.situacionFinal.etapa})` : ''}
          </Text>
          {conAnual ? <Text style={e.leyenda}>* Competencia pendiente de recuperación.</Text> : null}
        </View>
      ) : null}
      <Text style={e.leyenda}>
        Escala: {Object.entries(ETIQUETA_NIVEL).map(([k, v]) => `${k} = ${v}`).join(' · ')} · ND = No desarrollada en el bimestre.
      </Text>
      <View style={e.firmas} wrap={false}>
        <Text style={e.firma}>Docente tutor(a)</Text>
        <Text style={e.firma}>Dirección</Text>
      </View>
    </PaginaPdf>
  );
}

/** Una o varias libretas (una página o más por matrícula) en un solo PDF. */
export async function generarLibretasPdf(boletas: DatosBoleta[]): Promise<Buffer> {
  return renderizarPdf(
    <DocumentoPdf titulo="Libreta de notas">
      {boletas.map((b) => (
        <PaginaLibreta key={b.matricula.id} boleta={b} />
      ))}
    </DocumentoPdf>,
  );
}
