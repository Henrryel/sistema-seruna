'use client';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { CampoArchivo } from '@/components/matricula/campos';
import { aFormData, archivoOpcional, ENDPOINTS } from '@/components/matricula/utilidades';
import { api, conConsulta } from '@/lib/api';
import { hoyLima } from '@/lib/formato';
import {
  esquemaAnulacion,
  esquemaCambioSeccion,
  esquemaConfirmacion,
  esquemaReincorporacion,
  esquemaRetiro,
  type DetalleMatricula,
  type SeccionDisponible,
} from '@/esquemas/matricula/matriculas';
import { opciones, TIPOS_VACANTE } from '@/esquemas/matricula/comunes';

export type Operacion = 'confirmar' | 'cambiar' | 'retiro' | 'reincorporar' | 'anular';

/** Select de secciones del año/grado con la ocupación en la fecha del formulario. */
function CampoSeccion({ matriculaId, excluir }: { matriculaId: string; excluir?: string }) {
  const { watch } = useFormContext();
  const fecha = (watch('fecha') as string | undefined) || undefined;
  const consulta = useQuery({
    queryKey: ['secciones-matricula', matriculaId, fecha],
    queryFn: () => api.get<{ fecha: string; secciones: SeccionDisponible[] }>(conConsulta(`${ENDPOINTS.matriculas}/${matriculaId}/secciones`, { fecha })),
  });
  const lista = (consulta.data?.secciones ?? []).filter((s) => s.activa && s.id !== excluir);
  return (
    <CampoSelect
      nombre="seccionId"
      etiqueta="Sección"
      placeholder={consulta.isFetching ? 'Cargando…' : lista.length ? 'Seleccione' : 'Sin secciones activas para el grado'}
      opciones={lista.map((s) => ({
        valor: s.id,
        etiqueta: `${s.nombre} (${s.turno}) · ${s.ocupadas}/${s.cupo} ocupadas${s.reserva ? ` · ${s.reserva} reservadas` : ''}`,
      }))}
      descripcion="Ocupación a la fecha indicada. El cupo y las vacantes reservadas los controla la base."
    />
  );
}

const fechaInicial = (m: DetalleMatricula['matricula']) => {
  const hoy = hoyLima();
  if (hoy < m.anio_inicio) return m.anio_inicio;
  if (hoy > m.anio_fin) return m.anio_fin;
  return hoy;
};

const esquemaRetiroCliente = esquemaRetiro.extend({ archivo: archivoOpcional });

export function DialogosOperacion(props: {
  detalle: DetalleMatricula;
  operacion: Operacion | null;
  alCerrar: () => void;
  alCambiar: () => Promise<unknown>;
}) {
  const m = props.detalle.matricula;
  const base = `${ENDPOINTS.matriculas}/${m.id}`;
  const actual = props.detalle.ubicaciones.at(-1);
  const cerrar = (v: boolean) => !v && props.alCerrar();
  const comun = { alCambiarAbierto: cerrar };
  const fecha = fechaInicial(m);

  return (
    <>
      <DialogoFormulario
        {...comun}
        titulo="Confirmar matrícula"
        descripcion="La matrícula pasa a activa y el estudiante queda ubicado en la sección desde la fecha indicada hasta el fin del año."
        esquema={esquemaConfirmacion}
        valores={{ fecha, tipoVacante: 'regular', motivo: '' }}
        abierto={props.operacion === 'confirmar'}
        textoEnviar="Confirmar matrícula"
        mensajeExito="Matrícula confirmada"
        alEnviar={async (d) => {
          await api.post(`${base}/confirmar`, d);
          await props.alCambiar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="fecha" etiqueta="Inicio en la sección" tipo="date" />
          <CampoSelect nombre="tipoVacante" etiqueta="Tipo de vacante" opciones={opciones(TIPOS_VACANTE)} />
        </div>
        <CampoSeccion matriculaId={m.id} />
        <CampoTexto nombre="motivo" etiqueta="Observación" descripcion="Opcional" />
      </DialogoFormulario>

      <DialogoFormulario
        {...comun}
        titulo="Cambio de sección"
        descripcion={`La sección actual${actual ? ` (${actual.seccion})` : ''} se cierra el día anterior a la fecha indicada.`}
        esquema={esquemaCambioSeccion}
        valores={{ fecha, tipoVacante: 'regular', motivo: '', detalle: '' }}
        abierto={props.operacion === 'cambiar'}
        textoEnviar="Cambiar de sección"
        mensajeExito="Sección cambiada"
        alEnviar={async (d) => {
          await api.post(`${base}/cambiar-seccion`, d);
          await props.alCambiar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="fecha" etiqueta="Primer día en la nueva sección" tipo="date" />
          <CampoSelect nombre="tipoVacante" etiqueta="Tipo de vacante" opciones={opciones(TIPOS_VACANTE)} />
        </div>
        <CampoSeccion matriculaId={m.id} excluir={actual?.seccion_id} />
        <CampoTexto nombre="motivo" etiqueta="Motivo" />
        <CampoArea nombre="detalle" etiqueta="Detalle" descripcion="Opcional" />
      </DialogoFormulario>

      <DialogoFormulario
        {...comun}
        titulo="Retiro o traslado"
        descripcion="Desde la fecha efectiva el estudiante deja de figurar en la sección (su ubicación se cierra el día anterior)."
        esquema={esquemaRetiroCliente}
        valores={{ tipo: 'retiro', fecha, motivo: '', detalle: '' }}
        abierto={props.operacion === 'retiro'}
        textoEnviar="Registrar"
        mensajeExito="Movimiento registrado"
        alEnviar={async (d) => {
          await api.post(`${base}/retiro`, aFormData(d));
          await props.alCambiar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect
            nombre="tipo"
            etiqueta="Movimiento"
            opciones={[
              { valor: 'retiro', etiqueta: 'Retiro' },
              { valor: 'traslado', etiqueta: 'Traslado a otra IE' },
            ]}
          />
          <CampoTexto nombre="fecha" etiqueta="Fecha efectiva" tipo="date" />
        </div>
        <CampoTexto nombre="motivo" etiqueta="Motivo" />
        <CampoArea nombre="detalle" etiqueta="Detalle" descripcion="Para traslados: IE de destino, código modular, resolución." />
        <CampoArchivo nombre="archivo" etiqueta="Evidencia (opcional)" />
      </DialogoFormulario>

      <DialogoFormulario
        {...comun}
        titulo="Reincorporación"
        descripcion="Se abre una nueva ubicación desde la fecha indicada hasta el fin del año."
        esquema={esquemaReincorporacion}
        valores={{ fecha, tipoVacante: 'regular', motivo: '' }}
        abierto={props.operacion === 'reincorporar'}
        textoEnviar="Reincorporar"
        mensajeExito="Estudiante reincorporado"
        alEnviar={async (d) => {
          await api.post(`${base}/reincorporar`, d);
          await props.alCambiar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="fecha" etiqueta="Fecha de reincorporación" tipo="date" />
          <CampoSelect nombre="tipoVacante" etiqueta="Tipo de vacante" opciones={opciones(TIPOS_VACANTE)} />
        </div>
        <CampoSeccion matriculaId={m.id} />
        <CampoTexto nombre="motivo" etiqueta="Motivo" />
      </DialogoFormulario>

      <DialogoFormulario
        {...comun}
        titulo="Anular matrícula"
        descripcion="Use la anulación solo para matrículas registradas por error: se liberan sus ubicaciones. Si el estudiante ya asistió, registre un retiro."
        esquema={esquemaAnulacion}
        valores={{ fecha: hoyLima(), motivo: '' }}
        abierto={props.operacion === 'anular'}
        textoEnviar="Anular"
        mensajeExito="Matrícula anulada"
        alEnviar={async (d) => {
          await api.post(`${base}/anular`, d);
          await props.alCambiar();
        }}
      >
        <CampoTexto nombre="fecha" etiqueta="Fecha" tipo="date" />
        <CampoTexto nombre="motivo" etiqueta="Motivo" />
      </DialogoFormulario>
    </>
  );
}
