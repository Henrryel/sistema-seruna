'use client';
import { useState } from 'react';
import { Check, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea } from '@/components/formularios/campos';
import { api } from '@/lib/api';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { esquemaResolverJustificacion, type FilaJustificacion } from '@/esquemas/asistencia/justificaciones';

const ENDPOINT = '/api/admin/asistencia/justificaciones';

export function ClienteJustificaciones() {
  const recargar = useRecargarListado();
  const [resolviendo, setResolviendo] = useState<{ fila: FilaJustificacion; estado: 'aprobada' | 'rechazada' } | null>(null);

  return (
    <>
      <EncabezadoPagina
        titulo="Justificaciones"
        descripcion="Aprobar marca la asistencia como «justificado» (lo hace la base). Cada solicitud se resuelve una sola vez."
      />
      <TablaDatos<FilaJustificacion>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por nombre o código…"
        filtros={[
          {
            nombre: 'estado',
            etiqueta: 'Estado',
            tipo: 'select',
            valor: 'pendiente',
            opciones: [
              { valor: 'pendiente', etiqueta: 'Pendientes' },
              { valor: 'aprobada', etiqueta: 'Aprobadas' },
              { valor: 'rechazada', etiqueta: 'Rechazadas' },
            ],
          },
          {
            nombre: 'perfil',
            etiqueta: 'Perfil',
            tipo: 'select',
            opciones: [
              { valor: 'alumno', etiqueta: 'Alumnos' },
              { valor: 'docente', etiqueta: 'Docentes' },
            ],
          },
        ]}
        columnas={[
          {
            clave: 'persona',
            titulo: 'Persona',
            celda: (f) => (
              <div className="min-w-0">
                <p className="font-medium">{f.persona}</p>
                <p className="text-xs text-muted-foreground">
                  {f.perfil === 'alumno' ? 'Alumno' : 'Docente'} · {f.codigo}
                </p>
              </div>
            ),
          },
          {
            clave: 'fecha',
            titulo: 'Asistencia',
            celda: (f) => (
              <div>
                <p>{formatoFecha(f.fecha)}</p>
                <p className="text-xs text-muted-foreground">
                  {f.curso ? `${f.curso} · ` : ''}
                  {f.estado_asistencia}
                </p>
              </div>
            ),
          },
          {
            clave: 'motivo',
            titulo: 'Motivo',
            ocultarEnMovil: true,
            celda: (f) => (
              <div className="max-w-72">
                <p className="line-clamp-3 text-sm whitespace-normal">{f.motivo}</p>
                {f.evidencia_id ? (
                  <a href={`${ENDPOINT}/${f.id}/evidencia`} className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline">
                    <Paperclip className="size-3" aria-hidden /> {f.evidencia_nombre ?? 'Evidencia'}
                  </a>
                ) : null}
              </div>
            ),
          },
          {
            clave: 'solicitada_en',
            titulo: 'Solicitada',
            ocultarEnMovil: true,
            celda: (f) => (
              <span className="text-xs text-muted-foreground">
                {formatoFechaHora(f.solicitada_en)}
                <span className="block">por {f.solicitante}</span>
              </span>
            ),
          },
          {
            clave: 'estado',
            titulo: 'Estado',
            celda: (f) => (
              <div>
                <BadgeEstado estado={f.estado} />
                {f.decision ? <p className="mt-1 line-clamp-2 max-w-48 text-xs whitespace-normal text-muted-foreground">{f.decision}</p> : null}
              </div>
            ),
          },
        ]}
        acciones={(f) =>
          f.estado === 'pendiente' ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setResolviendo({ fila: f, estado: 'aprobada' })} aria-label={`Aprobar justificación de ${f.persona}`}>
                <Check aria-hidden /> <span className="hidden lg:inline">Aprobar</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setResolviendo({ fila: f, estado: 'rechazada' })} aria-label={`Rechazar justificación de ${f.persona}`}>
                <X aria-hidden /> <span className="hidden lg:inline">Rechazar</span>
              </Button>
            </>
          ) : null
        }
      />
      <DialogoFormulario
        titulo={resolviendo?.estado === 'aprobada' ? 'Aprobar justificación' : 'Rechazar justificación'}
        descripcion={resolviendo ? `${resolviendo.fila.persona} · ${formatoFecha(resolviendo.fila.fecha)} (${resolviendo.fila.estado_asistencia})` : undefined}
        esquema={esquemaResolverJustificacion}
        valores={resolviendo ? { estado: resolviendo.estado, decision: resolviendo.estado === 'aprobada' ? 'Sustento conforme' : '' } : {}}
        abierto={resolviendo !== null}
        alCambiarAbierto={(v) => !v && setResolviendo(null)}
        textoEnviar={resolviendo?.estado === 'aprobada' ? 'Aprobar' : 'Rechazar'}
        mensajeExito="Justificación resuelta"
        alEnviar={async (d) => {
          await api.post(`${ENDPOINT}/${resolviendo?.fila.id}/resolver`, d);
          await recargar(ENDPOINT);
        }}
      >
        <CampoArea nombre="decision" etiqueta="Decisión (se comunica al solicitante)" filas={3} />
      </DialogoFormulario>
    </>
  );
}
