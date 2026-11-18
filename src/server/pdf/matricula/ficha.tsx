import 'server-only';
import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { DocumentoPdf, PaginaPdf, TablaPdf, estilosPdf, renderizarPdf } from '@/server/pdf/base';

// Ficha de matrícula: datos del alumno, matrícula, sección, apoderados y responsable económico.

const e = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  campo: { width: '50%', paddingVertical: 2, paddingRight: 6, flexDirection: 'row' },
  campoAncho: { width: '100%', paddingVertical: 2, flexDirection: 'row' },
  etiqueta: { fontFamily: 'Helvetica-Bold', width: 92, color: '#333' },
  valor: { flex: 1 },
  vacio: { color: '#777', marginTop: 2 },
  firmas: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 48 },
  firma: { width: 170, borderTopWidth: 0.8, borderTopColor: '#333', paddingTop: 4, textAlign: 'center', fontSize: 8 },
});

export interface DatosFichaPdf {
  alumno: {
    codigo: string;
    codigoSiagie: string | null;
    apellidos: string;
    nombres: string;
    fechaNacimiento: string | null;
    documentos: string;
    direccion: string | null;
    telefono: string | null;
    correo: string | null;
  };
  matricula: {
    id: string;
    anio: number;
    nivel: string;
    grado: string;
    tipoIngreso: string;
    estado: string;
    solicitadaEn: string;
    confirmadaEn: string | null;
    reglaVersion: number;
    referenciaSiagie: string | null;
  };
  seccionActual: string | null;
  ubicaciones: string[][];
  apoderados: string[][];
  responsable: { nombre: string; documento: string; direccion: string | null; desde: string } | null;
  movimientos: string[][];
}

function Campo({ etiqueta, valor, ancho }: { etiqueta: string; valor: string | null | undefined; ancho?: boolean }) {
  return (
    <View style={ancho ? e.campoAncho : e.campo}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <Text style={e.valor}>{valor || '—'}</Text>
    </View>
  );
}

export function FichaMatriculaPdf({ d }: { d: DatosFichaPdf }) {
  const titulo = `Ficha de matrícula ${d.matricula.anio}`;
  return (
    <DocumentoPdf titulo={titulo}>
      <PaginaPdf titulo={titulo} subtitulo={`${d.alumno.apellidos}, ${d.alumno.nombres} · Código ${d.alumno.codigo} · Matrícula N.º ${d.matricula.id}`}>
        <Text style={estilosPdf.seccion}>1. Datos del estudiante</Text>
        <View style={e.rejilla}>
          <Campo etiqueta="Apellidos" valor={d.alumno.apellidos} />
          <Campo etiqueta="Nombres" valor={d.alumno.nombres} />
          <Campo etiqueta="Código interno" valor={d.alumno.codigo} />
          <Campo etiqueta="Código SIAGIE" valor={d.alumno.codigoSiagie} />
          <Campo etiqueta="Documento(s)" valor={d.alumno.documentos} />
          <Campo etiqueta="Nacimiento" valor={d.alumno.fechaNacimiento} />
          <Campo etiqueta="Teléfono" valor={d.alumno.telefono} />
          <Campo etiqueta="Correo" valor={d.alumno.correo} />
          <Campo etiqueta="Dirección" valor={d.alumno.direccion} ancho />
        </View>

        <Text style={estilosPdf.seccion}>2. Matrícula</Text>
        <View style={e.rejilla}>
          <Campo etiqueta="Año académico" valor={String(d.matricula.anio)} />
          <Campo etiqueta="Nivel y grado" valor={`${d.matricula.grado}`} />
          <Campo etiqueta="Tipo de ingreso" valor={d.matricula.tipoIngreso} />
          <Campo etiqueta="Estado" valor={d.matricula.estado} />
          <Campo etiqueta="Solicitada" valor={d.matricula.solicitadaEn} />
          <Campo etiqueta="Confirmada" valor={d.matricula.confirmadaEn} />
          <Campo etiqueta="Regla aplicada" valor={`Versión ${d.matricula.reglaVersion}`} />
          <Campo etiqueta="Ref. SIAGIE" valor={d.matricula.referenciaSiagie} />
          <Campo etiqueta="Sección actual" valor={d.seccionActual} ancho />
        </View>
        {d.ubicaciones.length ? (
          <TablaPdf columnas={[{ titulo: 'Sección', peso: 2 }, { titulo: 'Desde' }, { titulo: 'Hasta' }, { titulo: 'Vacante' }]} filas={d.ubicaciones} />
        ) : (
          <Text style={e.vacio}>Aún sin sección asignada.</Text>
        )}

        <Text style={estilosPdf.seccion}>3. Apoderados</Text>
        {d.apoderados.length ? (
          <TablaPdf
            columnas={[{ titulo: 'Apellidos y nombres', peso: 3 }, { titulo: 'Parentesco' }, { titulo: 'Documento', peso: 1.5 }, { titulo: 'Teléfono' }, { titulo: 'Verificado' }, { titulo: 'Accesos', peso: 1.5 }]}
            filas={d.apoderados}
          />
        ) : (
          <Text style={e.vacio}>Sin apoderados vigentes registrados.</Text>
        )}

        <Text style={estilosPdf.seccion}>4. Responsable económico</Text>
        {d.responsable ? (
          <View style={e.rejilla}>
            <Campo etiqueta="Nombre / razón social" valor={d.responsable.nombre} />
            <Campo etiqueta="Documento" valor={d.responsable.documento} />
            <Campo etiqueta="Dirección" valor={d.responsable.direccion} />
            <Campo etiqueta="Desde" valor={d.responsable.desde} />
          </View>
        ) : (
          <Text style={e.vacio}>Sin responsable económico registrado.</Text>
        )}

        {d.movimientos.length ? (
          <>
            <Text style={estilosPdf.seccion}>5. Movimientos</Text>
            <TablaPdf columnas={[{ titulo: 'Fecha' }, { titulo: 'Movimiento', peso: 1.5 }, { titulo: 'Motivo', peso: 3 }, { titulo: 'Detalle', peso: 3 }]} filas={d.movimientos} />
          </>
        ) : null}

        <View style={e.firmas} wrap={false}>
          <Text style={e.firma}>Firma del padre, madre o apoderado</Text>
          <Text style={e.firma}>Dirección / Secretaría</Text>
        </View>
      </PaginaPdf>
    </DocumentoPdf>
  );
}

export function generarFichaMatriculaPdf(d: DatosFichaPdf): Promise<Buffer> {
  return renderizarPdf(<FichaMatriculaPdf d={d} />);
}
