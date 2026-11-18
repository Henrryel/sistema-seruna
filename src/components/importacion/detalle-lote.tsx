'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormContext, useWatch } from 'react-hook-form';
import { ArrowRightCircle, CheckCheck, GitMerge, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import {
  ACCIONES_CONCILIACION,
  ENTIDADES_CONCILIABLES,
  NOMBRE_ACCION,
  NOMBRE_ENTIDAD,
  esquemaConciliacion,
  esquemaConciliacionMasiva,
  type DatosConciliacion,
  type DetalleLote,
  type FilaImportacionVista,
} from '@/esquemas/importacion/lotes';
import { CargaArchivos } from './carga-archivos';
import { VisorDatos, VistaPreviaDatos } from './visor-datos';

const BASE = '/api/admin/reportes/importacion';

const esConciliable = (entidad: string) => (ENTIDADES_CONCILIABLES as readonly string[]).includes(entidad);

/** Acciones que la base admite por entidad (guía: crear solo alumnos/docentes; crear/vincular solo entidades maestras). */
function accionesPara(entidad: string) {
  const crear = entidad === 'estudiantes' || entidad === 'profesores';
  return ACCIONES_CONCILIACION.filter((a) => (a === 'crear' ? crear : a === 'vincular' ? esConciliable(entidad) : true)).map((a) => ({
    valor: a,
    etiqueta: NOMBRE_ACCION[a] ?? a,
  }));
}

const DESTINO: Record<string, string> = {
  estudiantes: 'Id del estudiante actual',
  profesores: 'Id del docente actual',
  cursos: 'Id del curso (cursos_seccion)',
  estudiantes_cursos: 'Id de la matrícula confirmada',
};

function CamposConciliacion() {
  const { control } = useFormContext<DatosConciliacion>();
  const accion = useWatch({ control, name: 'accion' });
  const entidad = useWatch({ control, name: 'entidad' });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="accion" etiqueta="Decisión" opciones={accionesPara(entidad)} className="sm:col-span-2" />
      {accion === 'vincular' ? <CampoTexto nombre="destinoId" etiqueta={DESTINO[entidad] ?? 'Id de destino'} tipo="number" className="sm:col-span-2" /> : null}
      {accion === 'crear' ? (
        <>
          <CampoTexto nombre="codigo" etiqueta={`Código interno del ${entidad === 'profesores' ? 'docente' : 'estudiante'}`} />
          <CampoTexto nombre="personaExistenteId" etiqueta="Persona existente (id, opcional)" tipo="number" descripcion="Vacío: se crea con los nombres del origen" />
        </>
      ) : null}
      <CampoArea nombre="motivo" etiqueta="Sustento" filas={3} className="sm:col-span-2" />
    </div>
  );
}

export function DetalleLotePanel({ loteId, alCambiar }: { loteId: string; alCambiar: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const endpointFilas = `${BASE}/${loteId}/filas`;
  const clave = ['importacion', 'lote', loteId];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetalleLote>(`${BASE}/${loteId}`) });
  const [conciliando, setConciliando] = useState<FilaImportacionVista | null>(null);
  const [masiva, setMasiva] = useState(false);

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await recargar(endpointFilas);
    await alCambiar();
  };

  if (consulta.isPending) return <Skeleton className="mt-6 h-64 w-full rounded-xl" />;
  if (consulta.isError) {
    return (
      <div role="alert" className="mt-6 rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
        {mensajeDeError(consulta.error)}
      </div>
    );
  }
  const l = consulta.data;
  const entidades = [...new Set([...Object.keys(l.conteos_esperados), ...l.resumen.map((r) => r.entidad)])].sort();
  const pendientesPorEntidad = l.resumen.filter((r) => r.pendientes > 0);

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Lote {l.id} · {l.sistema} <BadgeEstado estado={l.estado === 'revision' ? 'revisión' : l.estado} />
          </CardTitle>
          <CardDescription className="grid gap-0.5">
            <span>
              Creado {formatoFechaHora(l.creado_en)} por {l.creado_por_login ?? '—'}
              {l.sellado_en ? ` · sellado ${formatoFechaHora(l.sellado_en)}` : ''}
              {l.cerrado_en ? ` · cerrado ${formatoFechaHora(l.cerrado_en)}` : ''}
            </span>
            <span className="truncate font-mono text-xs" title={l.sha256}>
              SHA-256 {l.sha256}
            </span>
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {l.estado === 'carga' ? (
            <>
              <CargaArchivos modo="agregar" loteId={l.id} alTerminar={refrescar} />
              <Confirmar
                titulo="¿Sellar el lote y pasar a revisión?"
                descripcion="La base compara las filas cargadas con el manifiesto. Una vez sellado no se pueden agregar ni quitar filas."
                textoConfirmar="Sellar"
                mensajeExito="Lote en revisión"
                alConfirmar={async () => {
                  await api.post(`${BASE}/${l.id}/avanzar`);
                  await refrescar();
                }}
                disparador={
                  <Button size="sm">
                    <ArrowRightCircle aria-hidden /> Sellar y revisar
                  </Button>
                }
              />
            </>
          ) : null}
          {l.estado === 'revision' ? (
            <>
              <Button size="sm" variant="outline" disabled={pendientesPorEntidad.length === 0} onClick={() => setMasiva(true)}>
                <CheckCheck aria-hidden /> Conciliar pendientes
              </Button>
              <Confirmar
                titulo="¿Cerrar el lote?"
                descripcion="Solo es posible cuando no quedan filas pendientes. El lote cerrado queda como archivo inmutable."
                textoConfirmar="Cerrar lote"
                mensajeExito="Lote cerrado"
                alConfirmar={async () => {
                  await api.post(`${BASE}/${l.id}/avanzar`);
                  await refrescar();
                }}
                disparador={
                  <Button size="sm" disabled={l.pendientes > 0}>
                    <Lock aria-hidden /> Cerrar lote
                  </Button>
                }
              />
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entidad</TableHead>
                <TableHead className="text-right">Esperadas</TableHead>
                <TableHead className="text-right">Cargadas</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Creadas</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Vinculadas</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Archivadas</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Excluidas</TableHead>
                <TableHead className="text-right">Pendientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entidades.map((e) => {
                const r = l.resumen.find((x) => x.entidad === e);
                const esperadas = l.conteos_esperados[e];
                const difiere = esperadas !== undefined && esperadas !== (r?.cargadas ?? 0);
                return (
                  <TableRow key={e}>
                    <TableCell className="font-medium">{NOMBRE_ENTIDAD[e] ?? e}</TableCell>
                    <TableCell className="text-right tabular-nums">{esperadas ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r?.cargadas ?? 0} {difiere ? <Etiqueta tono="peligro">difiere</Etiqueta> : null}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{r?.creadas ?? 0}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{r?.vinculadas ?? 0}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{r?.archivadas ?? 0}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{r?.excluidas ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{r?.pendientes ? <Etiqueta tono="alerta">{r.pendientes}</Etiqueta> : 0}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Filas del lote</h3>
          <TablaDatos<FilaImportacionVista>
            endpoint={endpointFilas}
            claveFila={(f) => `${f.entidad}|${f.clave_origen}`}
            placeholderBusqueda="Buscar por clave o contenido…"
            filtros={[
              { nombre: 'entidad', etiqueta: 'Entidad', tipo: 'select', opciones: entidades.map((e) => ({ valor: e, etiqueta: NOMBRE_ENTIDAD[e] ?? e })) },
              {
                nombre: 'estado',
                etiqueta: 'Estado',
                tipo: 'select',
                opciones: [
                  { valor: 'pendiente', etiqueta: 'Pendiente' },
                  { valor: 'conciliada', etiqueta: 'Conciliada' },
                  ...ACCIONES_CONCILIACION.map((a) => ({ valor: a, etiqueta: NOMBRE_ACCION[a] ?? a })),
                ],
              },
            ]}
            columnas={[
              { clave: 'entidad', titulo: 'Entidad', celda: (f) => NOMBRE_ENTIDAD[f.entidad] ?? f.entidad, ocultarEnMovil: true },
              { clave: 'clave_origen', titulo: 'Clave', celda: (f) => <span className="font-mono text-xs">{f.clave_origen}</span> },
              { clave: 'datos', titulo: 'Datos', celda: (f) => <VistaPreviaDatos datos={f.datos} />, ocultarEnMovil: true },
              {
                clave: 'accion',
                titulo: 'Decisión',
                celda: (f) =>
                  f.accion ? (
                    <div className="grid max-w-56 gap-0.5">
                      <Etiqueta tono={f.accion === 'excluir' ? 'neutro' : f.accion === 'archivar' ? 'info' : 'exito'}>
                        {NOMBRE_ACCION[f.accion] ?? f.accion}
                        {f.destino_id ? ` → ${f.destino_id}` : ''}
                      </Etiqueta>
                      <span className="truncate text-xs text-muted-foreground" title={f.motivo ?? ''}>
                        {f.motivo}
                      </span>
                    </div>
                  ) : (
                    <Etiqueta tono="alerta">Pendiente</Etiqueta>
                  ),
              },
            ]}
            acciones={(f) => (
              <>
                <VisorDatos titulo={`${NOMBRE_ENTIDAD[f.entidad] ?? f.entidad} · ${f.clave_origen}`} descripcion={`Lote ${l.id} · ${l.sistema}`} datos={f.datos} />
                {l.estado === 'revision' && !f.accion ? (
                  <Button variant="ghost" size="icon-sm" aria-label={`Conciliar ${f.clave_origen}`} onClick={() => setConciliando(f)}>
                    <GitMerge aria-hidden />
                  </Button>
                ) : null}
              </>
            )}
          />
        </div>
      </CardContent>

      <DialogoFormulario
        titulo={`Conciliar ${conciliando ? `${NOMBRE_ENTIDAD[conciliando.entidad] ?? conciliando.entidad} · ${conciliando.clave_origen}` : ''}`}
        descripcion="La decisión es definitiva: queda registrada con su sustento en el historial del lote."
        esquema={esquemaConciliacion}
        abierto={conciliando !== null}
        alCambiarAbierto={(v) => !v && setConciliando(null)}
        valores={
          conciliando
            ? {
                entidad: conciliando.entidad,
                claveOrigen: conciliando.clave_origen,
                accion: esConciliable(conciliando.entidad) ? 'vincular' : 'archivar',
                motivo: '',
              }
            : {}
        }
        alEnviar={async (d) => {
          await api.post(`${BASE}/${l.id}/conciliar`, d);
          await refrescar();
        }}
        textoEnviar="Conciliar"
        mensajeExito="Fila conciliada"
      >
        <CamposConciliacion />
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Conciliar pendientes de una entidad"
        descripcion="Aplica la misma decisión (archivar o excluir) a todas las filas pendientes de la entidad elegida."
        esquema={esquemaConciliacionMasiva}
        abierto={masiva}
        alCambiarAbierto={setMasiva}
        valores={{ entidad: pendientesPorEntidad[0]?.entidad ?? '', accion: 'archivar', motivo: '' }}
        alEnviar={async (d) => {
          const r = await api.post<{ conciliadas: number }>(`${BASE}/${l.id}/conciliar-pendientes`, d);
          await refrescar();
          return r;
        }}
        textoEnviar="Aplicar"
        mensajeExito="Filas conciliadas"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect
            nombre="entidad"
            etiqueta="Entidad"
            opciones={pendientesPorEntidad.map((r) => ({ valor: r.entidad, etiqueta: `${NOMBRE_ENTIDAD[r.entidad] ?? r.entidad} (${r.pendientes})` }))}
          />
          <CampoSelect
            nombre="accion"
            etiqueta="Decisión"
            opciones={[
              { valor: 'archivar', etiqueta: NOMBRE_ACCION.archivar ?? 'Archivar' },
              { valor: 'excluir', etiqueta: NOMBRE_ACCION.excluir ?? 'Excluir' },
            ]}
          />
          <CampoArea nombre="motivo" etiqueta="Sustento" filas={3} className="sm:col-span-2" />
        </div>
      </DialogoFormulario>
    </Card>
  );
}
