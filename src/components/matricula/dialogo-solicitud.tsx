'use client';
import type { ReactNode } from 'react';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { api } from '@/lib/api';
import { esquemaSolicitud } from '@/esquemas/matricula/matriculas';
import { opciones, TIPOS_INGRESO } from '@/esquemas/matricula/comunes';
import { CampoCatalogo, CampoEstudiante } from './campos';
import { ENDPOINTS } from './utilidades';

function CamposSolicitud({ estudiante }: { estudiante?: { id: string; etiqueta: string } }) {
  return (
    <div className="grid gap-4">
      {estudiante ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          Estudiante: <span className="font-medium">{estudiante.etiqueta}</span>
        </p>
      ) : (
        <CampoEstudiante nombre="estudianteId" etiqueta="Estudiante" />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoCatalogo nombre="anioId" etiqueta="Año académico" tipo="anios" />
        <CampoCatalogo nombre="gradoId" etiqueta="Grado" tipo="grados" />
        <CampoSelect nombre="tipoIngreso" etiqueta="Tipo de ingreso" opciones={opciones(TIPOS_INGRESO)} />
        <CampoTexto nombre="referenciaSiagie" etiqueta="Referencia SIAGIE" descripcion="Opcional" />
      </div>
      <p className="text-xs text-muted-foreground">
        Se aplica la regla publicada vigente del año, grado y tipo de ingreso; se validan la ventana de solicitudes y la edad al corte.
      </p>
    </div>
  );
}

/** Solicitud de matrícula (estudiante, año, grado y tipo de ingreso). */
export function DialogoSolicitud(props: {
  disparador?: ReactNode;
  abierto?: boolean;
  alCambiarAbierto?: (v: boolean) => void;
  estudiante?: { id: string; etiqueta: string };
  alSolicitar?: (r: { id: string }) => Promise<unknown> | void;
}) {
  return (
    <DialogoFormulario
      titulo="Solicitud de matrícula"
      esquema={esquemaSolicitud}
      valores={{ estudianteId: props.estudiante?.id ?? '', tipoIngreso: 'nuevo', referenciaSiagie: '' }}
      disparador={props.disparador}
      abierto={props.abierto}
      alCambiarAbierto={props.alCambiarAbierto}
      textoEnviar="Registrar solicitud"
      mensajeExito="Solicitud registrada"
      alEnviar={async (d) => {
        const r = await api.post<{ id: string }>(ENDPOINTS.matriculas, d);
        await props.alSolicitar?.(r);
      }}
    >
      <CamposSolicitud estudiante={props.estudiante} />
    </DialogoFormulario>
  );
}
