'use client';
import { useMemo, useState } from 'react';
import { Pencil, Power, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio, SelectSimple } from '@/components/academico/selectores';
import { api } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha } from '@/lib/formato';
import {
  esquemaActualizarAsignacion,
  esquemaAsignacion,
  FUNCIONES_DOCENTE,
  NOMBRE_FUNCION,
  type FilaAsignacion,
  type FilaCurso,
} from '@/esquemas/academico/asignaciones';
import { SIN_SELECCION } from '@/esquemas/academico/seleccion';

const ENDPOINT_CURSOS = '/api/admin/academico/cursos';
const ENDPOINT = '/api/admin/academico/asignaciones';
const OPCIONES_FUNCION = FUNCIONES_DOCENTE.map((f) => ({ valor: f, etiqueta: NOMBRE_FUNCION[f] ?? f }));

function CamposVigencia({ conFuncion = true }: { conFuncion?: boolean }) {
  return (
    <>
      {conFuncion ? <CampoSelect nombre="funcion" etiqueta="Función" opciones={OPCIONES_FUNCION} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto nombre="inicio" etiqueta="Desde" tipo="date" />
        <CampoTexto nombre="fin" etiqueta="Hasta" tipo="date" />
      </div>
    </>
  );
}

export function ClienteAsignaciones() {
  const recargar = useRecargarListado();
  const [anioId, setAnioId] = useState<string | undefined>();
  const [seccionId, setSeccionId] = useState<string>(SIN_SELECCION);
  const [asignandoA, setAsignandoA] = useState<FilaCurso | null>(null);
  const [editando, setEditando] = useState<FilaAsignacion | null>(null);
  const secciones = useCatalogo('secciones', { anioId }, Boolean(anioId));
  const docentes = useCatalogo('docentes');
  const parametros = useMemo(() => ({ anioId, seccionId: seccionId === SIN_SELECCION ? undefined : seccionId }), [anioId, seccionId]);
  const refrescar = () => Promise.all([recargar(ENDPOINT_CURSOS), recargar(ENDPOINT)]);

  return (
    <>
      <EncabezadoPagina
        titulo="Cursos y docentes"
        descripcion="Cada curso es una asignatura del plan dictada en una sección. La vigencia de la asignación debe quedar dentro del plan de la sección (lo valida la base)."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SelectorAnio
          valor={anioId}
          alCambiar={(v) => {
            setAnioId(v);
            setSeccionId(SIN_SELECCION);
          }}
        />
        <SelectSimple
          etiqueta="Sección"
          opciones={[{ valor: SIN_SELECCION, etiqueta: 'Todas las secciones' }, ...(secciones.data ?? [])]}
          valor={seccionId}
          alCambiar={setSeccionId}
          deshabilitado={!anioId}
        />
      </div>
      <Tabs defaultValue="cursos">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="cursos">Cursos</TabsTrigger>
            <TabsTrigger value="asignaciones">Asignaciones docentes</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="cursos">
          <TablaDatos<FilaCurso>
            endpoint={ENDPOINT_CURSOS}
            parametros={parametros}
            claveFila={(f) => f.id}
            placeholderBusqueda="Buscar asignatura…"
            filtros={[{ nombre: 'sinDocente', etiqueta: 'Docente', tipo: 'select', opciones: [{ valor: 'true', etiqueta: 'Sin docente' }] }]}
            vacio={<EstadoVacio titulo="Sin cursos" descripcion="Los cursos se crean al aplicar un plan de estudios publicado a la sección." />}
            columnas={[
              {
                clave: 'asignatura',
                titulo: 'Curso',
                celda: (f) => (
                  <div className="min-w-0">
                    <p className="font-medium">{f.asignatura}</p>
                    <p className="text-xs text-muted-foreground">{f.seccion}</p>
                  </div>
                ),
              },
              {
                clave: 'plan',
                titulo: 'Plan',
                ocultarEnMovil: true,
                celda: (f) => (
                  <span className="text-sm">
                    v{f.plan_version} <span className="text-xs text-muted-foreground">({formatoFecha(f.plan_inicio)} – {formatoFecha(f.plan_fin)})</span>
                  </span>
                ),
              },
              {
                clave: 'docentes',
                titulo: 'Docentes',
                celda: (f) => (f.docentes ? <span className="text-sm">{f.docentes}</span> : <Etiqueta tono="alerta">Sin docente</Etiqueta>),
              },
              { clave: 'activo', titulo: 'Estado', ocultarEnMovil: true, celda: (f) => <BadgeEstado estado={f.activo ? 'activo' : 'inactivo'} /> },
            ]}
            acciones={(f) => (
              <>
                <Button variant="ghost" size="icon-sm" aria-label={`Asignar docente a ${f.asignatura} ${f.seccion}`} onClick={() => setAsignandoA(f)}>
                  <UserPlus aria-hidden />
                </Button>
                <Confirmar
                  titulo={f.activo ? `¿Desactivar ${f.asignatura}?` : `¿Activar ${f.asignatura}?`}
                  descripcion={f.activo ? 'El curso dejará de aparecer en los cursos vigentes de los docentes.' : 'El curso volverá a estar disponible.'}
                  textoConfirmar={f.activo ? 'Desactivar' : 'Activar'}
                  mensajeExito="Curso actualizado"
                  alConfirmar={async () => {
                    await api.patch(`${ENDPOINT_CURSOS}/${f.id}`, { activo: !f.activo });
                    await refrescar();
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label={f.activo ? `Desactivar ${f.asignatura}` : `Activar ${f.asignatura}`}>
                      <Power aria-hidden />
                    </Button>
                  }
                />
              </>
            )}
          />
        </TabsContent>
        <TabsContent value="asignaciones">
          <TablaDatos<FilaAsignacion>
            endpoint={ENDPOINT}
            parametros={parametros}
            claveFila={(f) => f.id}
            placeholderBusqueda="Buscar docente o asignatura…"
            filtros={[{ nombre: 'funcion', etiqueta: 'Función', tipo: 'select', opciones: OPCIONES_FUNCION }]}
            vacio={<EstadoVacio titulo="Sin asignaciones" descripcion="Asigne docentes desde la pestaña Cursos." />}
            columnas={[
              {
                clave: 'docente',
                titulo: 'Docente',
                celda: (f) => (
                  <div className="min-w-0">
                    <p className="font-medium">{f.docente}</p>
                    <p className="font-mono text-xs text-muted-foreground">{f.docente_codigo}</p>
                  </div>
                ),
              },
              {
                clave: 'curso',
                titulo: 'Curso',
                celda: (f) => (
                  <div className="min-w-0">
                    <p>{f.asignatura}</p>
                    <p className="text-xs text-muted-foreground">{f.seccion}</p>
                  </div>
                ),
              },
              { clave: 'funcion', titulo: 'Función', celda: (f) => <Etiqueta tono={f.funcion === 'titular' ? 'info' : 'neutro'}>{NOMBRE_FUNCION[f.funcion] ?? f.funcion}</Etiqueta> },
              {
                clave: 'vigencia',
                titulo: 'Vigencia',
                ocultarEnMovil: true,
                celda: (f) => (
                  <div className="grid gap-0.5 text-sm">
                    <span className="tabular-nums">
                      {formatoFecha(f.inicio)} – {formatoFecha(f.fin)}
                    </span>
                    {f.vigente ? <Etiqueta tono="exito">Vigente hoy</Etiqueta> : null}
                  </div>
                ),
              },
              { clave: 'bloques', titulo: 'Bloques', ocultarEnMovil: true, className: 'tabular-nums' },
            ]}
            acciones={(f) => (
              <>
                <Button variant="ghost" size="icon-sm" aria-label={`Editar asignación de ${f.docente}`} onClick={() => setEditando(f)}>
                  <Pencil aria-hidden />
                </Button>
                <Confirmar
                  titulo={`¿Eliminar la asignación de ${f.docente}?`}
                  descripcion="Solo es posible si no tiene bloques de horario ni sesiones. Para terminarla, acorte su vigencia."
                  destructivo
                  textoConfirmar="Eliminar"
                  mensajeExito="Asignación eliminada"
                  alConfirmar={async () => {
                    await api.delete(`${ENDPOINT}/${f.id}`);
                    await refrescar();
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label={`Eliminar asignación de ${f.docente}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                />
              </>
            )}
          />
        </TabsContent>
      </Tabs>

      <DialogoFormulario
        titulo={`Asignar docente · ${asignandoA?.asignatura ?? ''}`}
        descripcion={asignandoA ? `${asignandoA.seccion}. Plan vigente del ${formatoFecha(asignandoA.plan_inicio)} al ${formatoFecha(asignandoA.plan_fin)}.` : undefined}
        esquema={esquemaAsignacion}
        valores={
          asignandoA
            ? { cursoId: asignandoA.id, docenteId: '', funcion: asignandoA.docentes ? 'reemplazo' : 'titular', inicio: asignandoA.plan_inicio ?? '', fin: asignandoA.plan_fin ?? '' }
            : {}
        }
        abierto={asignandoA !== null}
        alCambiarAbierto={(v) => !v && setAsignandoA(null)}
        mensajeExito="Docente asignado"
        alEnviar={async (d) => {
          await api.post(ENDPOINT, d);
          await refrescar();
        }}
      >
        <CampoSelect
          nombre="docenteId"
          etiqueta="Docente"
          opciones={(docentes.data ?? []).filter((d) => d.extra?.activo !== false)}
          placeholder={docentes.data?.length === 0 ? 'No hay docentes registrados' : 'Seleccione'}
        />
        <CamposVigencia />
      </DialogoFormulario>
      <DialogoFormulario
        titulo={`Editar asignación · ${editando?.docente ?? ''}`}
        descripcion={editando ? `${editando.asignatura} · ${editando.seccion}` : undefined}
        esquema={esquemaActualizarAsignacion}
        valores={editando ? { funcion: editando.funcion as 'titular', inicio: editando.inicio ?? '', fin: editando.fin ?? '' } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${editando?.id}`, d);
          await refrescar();
        }}
      >
        <CamposVigencia />
      </DialogoFormulario>
    </>
  );
}
