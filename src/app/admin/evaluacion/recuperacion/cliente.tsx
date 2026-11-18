'use client';
import { useMemo, useState } from 'react';
import { BadgeCheck, ClipboardPlus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, BadgeNivelLogro } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio, SelectorSeccion, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { api } from '@/lib/api';
import { formatoFecha, hoyLima } from '@/lib/formato';
import { NIVELES_LOGRO } from '@/esquemas/comunes';
import {
  ETIQUETA_TIPO_RECUPERACION,
  TIPOS_RECUPERACION,
  esquemaRecuperacion,
  type EvaluacionRecuperacionFila,
  type FilaPendienteRecuperacion,
} from '@/esquemas/evaluacion/recuperacion';

const ENDPOINT = '/api/admin/evaluacion/recuperacion';

function CamposRecuperacion() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="tipo" etiqueta="Tipo" opciones={TIPOS_RECUPERACION.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_RECUPERACION[t] }))} />
      <CampoTexto nombre="fecha" etiqueta="Fecha" tipo="date" descripcion="Posterior a la fecha de corte del cierre anual" />
      <CampoSelect nombre="nivelLogro" etiqueta="Nivel de logro" opciones={NIVELES_LOGRO.map((n) => ({ valor: n, etiqueta: n }))} />
      <CampoArea nombre="conclusion" etiqueta="Conclusión descriptiva" className="sm:col-span-2" />
    </div>
  );
}

export function ClienteRecuperacion() {
  const recargar = useRecargarListado();
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [seccionId, setSeccionId] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<FilaPendienteRecuperacion | null>(null);
  const [editando, setEditando] = useState<EvaluacionRecuperacionFila | null>(null);
  const parametros = useMemo(() => ({ anioId, seccionId }), [anioId, seccionId]);

  return (
    <>
      <EncabezadoPagina
        titulo="Recuperación y subsanación"
        descripcion="Competencias pendientes de cierres anuales aprobados. Cada intento nace en borrador y, una vez aprobado, no se modifica; luego genere la versión de recuperación del cierre anual."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <SelectorAnio
          anios={anios}
          anioId={anioId}
          alCambiar={(v) => {
            setAnioId(v);
            setSeccionId(null);
          }}
        />
        <SelectorSeccion anioId={anioId} valor={seccionId} alCambiar={setSeccionId} opcionVacia="Todas" />
      </div>
      {anioId ? (
        <TablaDatos<FilaPendienteRecuperacion>
          endpoint={ENDPOINT}
          parametros={parametros}
          claveFila={(f) => f.resultado_id}
          placeholderBusqueda="Buscar estudiante o competencia…"
          filtros={[
            {
              nombre: 'estado',
              etiqueta: 'Evaluación',
              tipo: 'select',
              opciones: [
                { valor: 'sin_evaluacion', etiqueta: 'Sin evaluación' },
                { valor: 'borrador', etiqueta: 'Con borrador' },
                { valor: 'aprobada', etiqueta: 'Con aprobada' },
              ],
            },
          ]}
          columnas={[
            {
              clave: 'alumno',
              titulo: 'Estudiante',
              celda: (f) => (
                <div>
                  <p className="font-medium">{f.alumno}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.codigo} · {f.grado}.º {f.seccion}
                  </p>
                </div>
              ),
            },
            {
              clave: 'competencia',
              titulo: 'Competencia',
              celda: (f) => (
                <div>
                  <p className="text-sm">{f.competencia}</p>
                  <p className="text-xs text-muted-foreground">{f.area ?? '—'}</p>
                </div>
              ),
            },
            { clave: 'nivel_original', titulo: 'Anual', celda: (f) => <BadgeNivelLogro nivel={f.nivel_original} /> },
            {
              clave: 'evaluaciones',
              titulo: 'Intentos',
              celda: (f) =>
                f.evaluaciones.length ? (
                  <ul className="grid gap-1">
                    {f.evaluaciones.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-1 text-xs">
                        #{e.intento} {ETIQUETA_TIPO_RECUPERACION[e.tipo as 'recuperacion'] ?? e.tipo} · {formatoFecha(e.fecha)} <BadgeNivelLogro nivel={e.nivel_logro} />
                        <BadgeEstado estado={e.estado} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin evaluación</span>
                ),
            },
          ]}
          acciones={(f) => {
            const borrador = f.evaluaciones.find((e) => e.estado === 'borrador');
            return (
              <>
                {!borrador ? (
                  <Button variant="ghost" size="icon-sm" aria-label={`Registrar intento de ${f.alumno}`} onClick={() => setRegistrando(f)}>
                    <ClipboardPlus aria-hidden />
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Editar borrador" onClick={() => setEditando(borrador)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Confirmar
                      titulo={`¿Aprobar el intento #${borrador.intento}?`}
                      descripcion={`Nivel ${borrador.nivel_logro}. Una vez aprobado, la evaluación no se puede modificar.`}
                      textoConfirmar="Aprobar"
                      mensajeExito="Evaluación aprobada"
                      alConfirmar={async () => {
                        await api.post(`${ENDPOINT}/${borrador.id}/aprobar`);
                        await recargar(ENDPOINT);
                      }}
                      disparador={
                        <Button variant="ghost" size="icon-sm" aria-label="Aprobar evaluación">
                          <BadgeCheck aria-hidden />
                        </Button>
                      }
                    />
                  </>
                )}
              </>
            );
          }}
          vacio={<EstadoVacio titulo="Sin competencias pendientes" descripcion="Aquí aparecen las competencias marcadas para recuperación en cierres anuales aprobados." />}
        />
      ) : null}

      <DialogoFormulario
        titulo="Registrar evaluación de recuperación"
        descripcion={registrando ? `${registrando.alumno} · ${registrando.competencia} (corte ${formatoFecha(registrando.fecha_corte)})` : undefined}
        esquema={esquemaRecuperacion}
        valores={registrando ? { resultadoOrigenId: registrando.resultado_id, tipo: 'recuperacion', fecha: hoyLima(), conclusion: '' } : {}}
        abierto={registrando !== null}
        alCambiarAbierto={(v) => !v && setRegistrando(null)}
        mensajeExito="Evaluación registrada en borrador"
        alEnviar={async (d) => {
          await api.post(ENDPOINT, d);
          await recargar(ENDPOINT);
        }}
      >
        <CamposRecuperacion />
      </DialogoFormulario>

      <DialogoFormulario
        titulo={`Editar intento #${editando?.intento ?? ''}`}
        esquema={esquemaRecuperacion.omit({ resultadoOrigenId: true })}
        valores={editando ? { tipo: editando.tipo as 'recuperacion', fecha: editando.fecha, nivelLogro: editando.nivel_logro as 'A', conclusion: editando.conclusion ?? '' } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${editando?.id}`, d);
          await recargar(ENDPOINT);
        }}
      >
        <CamposRecuperacion />
      </DialogoFormulario>
    </>
  );
}
