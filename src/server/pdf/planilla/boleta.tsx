import 'server-only';
import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { DocumentoPdf, PaginaPdf, TablaPdf, estilosPdf, renderizarPdf } from '@/server/pdf/base';
import { formatoFecha, formatoFechaHora, formatoMes, formatoMoneda } from '@/lib/formato';
import { NOMBRE_MODALIDAD, textoRemuneracion } from '@/esquemas/planilla/contratos';
import { textoMinutos } from '@/esquemas/planilla/horas';
import type { DetalleLiquidacion } from '@/esquemas/planilla/liquidaciones';

// Boleta de pago docente (documento liviano generado al vuelo; discrepancias.md §19).

const estilos = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  dato: { width: '50%', paddingVertical: 2, paddingRight: 8 },
  etiqueta: { fontFamily: 'Helvetica-Bold', color: '#444' },
  totales: { marginTop: 8, marginLeft: 'auto', width: '55%', borderWidth: 0.5, borderColor: '#bbb' },
  filaTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  filaNeto: { backgroundColor: '#eef0fa', fontFamily: 'Helvetica-Bold' },
  aviso: { marginTop: 6, padding: 6, backgroundColor: '#fff4e5', color: '#7a4b00' },
  firma: { marginTop: 40, flexDirection: 'row', justifyContent: 'space-around' },
  lineaFirma: {
    width: 180,
    borderTopWidth: 0.5,
    borderTopColor: '#333',
    paddingTop: 3,
    textAlign: 'center',
    fontSize: 8,
  },
});

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato}>
      <Text>
        <Text style={estilos.etiqueta}>{etiqueta}: </Text>
        {valor}
      </Text>
    </View>
  );
}

function FilaTotal({ etiqueta, valor, neto }: { etiqueta: string; valor: string; neto?: boolean }) {
  return (
    <View style={neto ? [estilos.filaTotal, estilos.filaNeto] : estilos.filaTotal}>
      <Text>{etiqueta}</Text>
      <Text>{valor}</Text>
    </View>
  );
}

const NOMBRE_MEDIO: Record<string, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  otro: 'Otro',
};

export async function generarBoletaPdf(d: DetalleLiquidacion): Promise<Buffer> {
  const titulo = `Boleta de pago docente · ${formatoMes(d.mes)}`;
  const t = d.totales;
  const horas = d.lineas.filter((l) => l.tipo === 'horas');
  const otras = d.lineas.filter((l) => l.tipo !== 'horas');
  return renderizarPdf(
    <DocumentoPdf titulo={titulo}>
      <PaginaPdf
        titulo={titulo}
        subtitulo={`Liquidación N.º ${d.id} · ${d.estado === 'aprobada' ? `aprobada el ${formatoFechaHora(d.aprobado_en)}` : 'BORRADOR (no válido para pago)'}`}
      >
        <Text style={estilosPdf.seccion}>Docente y contrato</Text>
        <View style={estilos.rejilla}>
          <Dato etiqueta="Docente" valor={d.docente} />
          <Dato etiqueta="Código" valor={d.codigo_docente} />
          <Dato etiqueta="DNI" valor={d.dni ?? '—'} />
          <Dato etiqueta="Contrato" valor={d.referencia} />
          <Dato etiqueta="Modalidad" valor={NOMBRE_MODALIDAD[d.modalidad]} />
          <Dato etiqueta="Condiciones" valor={textoRemuneracion(d)} />
          <Dato etiqueta="Período" valor={formatoMes(d.mes)} />
          <Dato
            etiqueta="Días liquidados"
            valor={`${formatoFecha(d.vigencia_inicio)} al ${formatoFecha(d.vigencia_fin)}`}
          />
        </View>
        {d.motivo_prorrateo ? (
          <Text style={estilos.aviso}>Sueldo prorrateado: {d.motivo_prorrateo}</Text>
        ) : null}

        {horas.length > 0 ? (
          <>
            <Text style={estilosPdf.seccion}>
              Horas trabajadas aprobadas ({textoMinutos(t.minutos_aprobados)})
            </Text>
            <TablaPdf
              columnas={[{ titulo: 'Fecha' }, { titulo: 'Horario', peso: 1.4 }, { titulo: 'Tiempo' }]}
              filas={horas.map((l) => [
                formatoFecha(l.fecha),
                `${l.hora_inicio ?? ''} – ${l.hora_fin ?? ''}`,
                textoMinutos(l.minutos),
              ])}
            />
          </>
        ) : null}

        <Text style={estilosPdf.seccion}>Adicionales y descuentos</Text>
        {otras.length > 0 ? (
          <TablaPdf
            columnas={[{ titulo: 'Tipo' }, { titulo: 'Concepto', peso: 3 }, { titulo: 'Importe' }]}
            filas={otras.map((l) => [
              l.tipo === 'adicional' ? 'Adicional' : 'Descuento',
              l.concepto,
              `${l.tipo === 'descuento' ? '− ' : ''}${formatoMoneda(l.importe)}`,
            ])}
          />
        ) : (
          <Text>Sin adicionales ni descuentos.</Text>
        )}

        <View style={estilos.totales} wrap={false}>
          <FilaTotal
            etiqueta={
              d.modalidad === 'fijo' ? 'Remuneración base' : `Base (${textoMinutos(t.minutos_aprobados)})`
            }
            valor={formatoMoneda(t.base)}
          />
          <FilaTotal etiqueta="(+) Adicionales" valor={formatoMoneda(t.adicionales)} />
          <FilaTotal etiqueta="(−) Descuentos" valor={formatoMoneda(t.descuentos)} />
          <FilaTotal etiqueta="Neto a pagar" valor={formatoMoneda(t.neto)} neto />
          <FilaTotal etiqueta="Pagado" valor={formatoMoneda(t.abonado)} />
          <FilaTotal etiqueta="Saldo" valor={t.saldo === null ? '—' : formatoMoneda(t.saldo)} neto />
        </View>

        <Text style={estilosPdf.seccion}>Pagos</Text>
        {d.pagos.length > 0 ? (
          <TablaPdf
            columnas={[
              { titulo: 'Fecha', peso: 1.3 },
              { titulo: 'Medio' },
              { titulo: 'Referencia', peso: 1.5 },
              { titulo: 'Importe' },
              { titulo: 'Estado', peso: 1.5 },
            ]}
            filas={d.pagos.map((p) => [
              formatoFechaHora(p.pagado_en),
              NOMBRE_MEDIO[p.medio] ?? p.medio,
              p.referencia ?? '—',
              formatoMoneda(p.importe),
              p.reversion_id ? `Revertido ${formatoFecha(p.revertido_en)}` : 'Vigente',
            ])}
          />
        ) : (
          <Text>Sin pagos registrados.</Text>
        )}

        <View style={estilos.firma} wrap={false}>
          <Text style={estilos.lineaFirma}>Empleador</Text>
          <Text style={estilos.lineaFirma}>Docente</Text>
        </View>
      </PaginaPdf>
    </DocumentoPdf>,
  );
}
