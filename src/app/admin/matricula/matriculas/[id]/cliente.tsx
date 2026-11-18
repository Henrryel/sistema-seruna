'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft, Ban, CheckCircle2, FileDown, FileSignature, LogOut, Plus, RotateCcw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { CampoArchivo } from '@/components/matricula/campos';
import { ChecklistMatricula, claveChecklist } from '@/components/matricula/checklist';
import { aFormData, archivoOpcional, ENDPOINTS, urlArchivo } from '@/components/matricula/utilidades';
import { api, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora, hoyLima } from '@/lib/formato';
import { esquemaAceptacion, esquemaResponsable, type DetalleMatricula } from '@/esquemas/matricula/matriculas';
import { etiqueta, METODOS_ACEPTACION, opciones, TIPOS_DOCUMENTO_RESPONSABLE } from '@/esquemas/matricula/comunes';
import { DialogosOperacion, type Operacion } from './operaciones';

const esquemaAceptacionCliente = esquemaAceptacion.extend({ archivo: archivoOpcional });

export function ClienteDetalleMatricula(props: { id: string; puedeExpediente: boolean }) {
  const qc = useQueryClient();
  const clave = ['matricula', props.id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<DetalleMatricula>(`${ENDPOINTS.matriculas}/${props.id}`) });
  const [operacion, setOperacion] = useState<Operacion | null>(null);
  const [dialogo, setDialogo] = useState<'responsable' | 'aceptacion' | null>(null);
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await qc.invalidateQueries({ queryKey: claveChecklist(props.id) });
    await qc.invalidateQueries({ queryKey: ['listado', ENDPOINTS.matriculas] });
  };

  if (consulta.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Cargando matrícula">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }
  if (consulta.isError) return <EstadoVacio titulo="No se pudo cargar la matrícula" descripcion={mensajeDeError(consulta.error)} />;

  const d = consulta.data;
  const m = d.matricula;
  const responsableVigente = d.responsables.find((r) => r.vigente);

  return (
    <>
      <Button variant="link" size="sm" className="mb-2 px-0" asChild>
        <Link href="/admin/matricula/matriculas">
          <ArrowLeft aria-hidden /> Matrículas
        </Link>
      </Button>
      <EncabezadoPagina
        titulo={`${m.apellidos}, ${m.nombres}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              Matrícula {m.anio} · {m.grado} · {etiqueta(m.tipo_ingreso)} · regla v{m.regla_version}
            </span>
            <BadgeEstado estado={m.estado} />
          </span>
        }
        acciones={
          <>
            <Button variant="outline" asChild>
              <Link href={`/admin/matricula/estudiantes/${m.estudiante_id}`}>Ficha del estudiante</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${ENDPOINTS.matriculas}/${m.id}/ficha`} download>
                <FileDown aria-hidden /> Ficha PDF
              </a>
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
          <CardDescription>
            Solicitada {formatoFechaHora(m.solicitada_en)}
            {m.confirmada_en ? ` · confirmada ${formatoFechaHora(m.confirmada_en)}` : ''}
            {m.referencia_siagie ? ` · ref. SIAGIE ${m.referencia_siagie}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {m.estado === 'solicitada' ? (
            <Button onClick={() => setOperacion('confirmar')}>
              <CheckCircle2 aria-hidden /> Confirmar con sección
            </Button>
          ) : null}
          {m.estado === 'activa' ? (
            <>
              <Button variant="outline" onClick={() => setOperacion('cambiar')}>
                <ArrowRightLeft aria-hidden /> Cambiar sección
              </Button>
              <Button variant="outline" onClick={() => setOperacion('retiro')}>
                <LogOut aria-hidden /> Retiro o traslado
              </Button>
            </>
          ) : null}
          {m.estado === 'retirada' || m.estado === 'trasladada' ? (
            <Button variant="outline" onClick={() => setOperacion('reincorporar')}>
              <RotateCcw aria-hidden /> Reincorporar
            </Button>
          ) : null}
          {m.estado === 'solicitada' || m.estado === 'activa' ? (
            <Button variant="destructive" onClick={() => setOperacion('anular')}>
              <Ban aria-hidden /> Anular
            </Button>
          ) : null}
          {m.estado === 'anulada' ? <p className="text-sm text-muted-foreground">La matrícula está anulada: no admite más movimientos.</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ubicación en secciones</CardTitle>
          </CardHeader>
          <CardContent>
            {d.ubicaciones.length === 0 ? (
              <EstadoVacio titulo="Sin sección" descripcion="Se asigna al confirmar la matrícula." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sección</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead>Hasta</TableHead>
                      <TableHead className="hidden sm:table-cell">Vacante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.ubicaciones.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.seccion} <span className="text-xs text-muted-foreground">({u.turno})</span>
                        </TableCell>
                        <TableCell>{formatoFecha(u.desde)}</TableCell>
                        <TableCell>{formatoFecha(u.hasta)}</TableCell>
                        <TableCell className="hidden sm:table-cell">{etiqueta(u.tipo_vacante)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            {d.movimientos.length === 0 ? (
              <EstadoVacio titulo="Sin movimientos" />
            ) : (
              <ol className="grid gap-2">
                {d.movimientos.map((mv) => (
                  <li key={mv.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {etiqueta(mv.tipo)} · {formatoFecha(mv.fecha_efectiva)}
                      </span>
                      {mv.evidencia_id ? (
                        <Button variant="ghost" size="xs" asChild>
                          <a href={urlArchivo(mv.evidencia_id)}>
                            <FileDown aria-hidden /> Evidencia
                          </a>
                        </Button>
                      ) : null}
                    </div>
                    <p>{mv.motivo}</p>
                    {mv.detalle ? <p className="text-xs text-muted-foreground">{mv.detalle}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {mv.registrado_por} · {formatoFechaHora(mv.registrado_en)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" aria-hidden /> Responsable económico
              </CardTitle>
              <CardDescription>El nuevo responsable reemplaza al vigente desde la fecha indicada.</CardDescription>
            </div>
            {m.estado !== 'anulada' ? (
              <Button size="sm" variant="outline" onClick={() => setDialogo('responsable')}>
                <Plus aria-hidden /> Registrar
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {d.responsables.length === 0 ? (
              <EstadoVacio titulo="Sin responsable económico" descripcion="Regístrelo antes de emitir cuotas." />
            ) : (
              <ul className="grid gap-2">
                {d.responsables.map((r) => (
                  <li key={r.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{r.nombre_razon_social}</span>
                      {r.vigente ? <Etiqueta tono="exito">Vigente</Etiqueta> : <Etiqueta>Histórico</Etiqueta>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.tipo_documento} {r.numero_documento}
                      {r.direccion ? ` · ${r.direccion}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatoFecha(r.desde)} – {r.hasta ? formatoFecha(r.hasta) : 'indefinido'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="size-4" aria-hidden /> Documentos aceptados
              </CardTitle>
              <CardDescription>Reglamento, contrato y condiciones económicas publicados del año.</CardDescription>
            </div>
            {m.estado === 'solicitada' || m.estado === 'activa' ? (
              <Button size="sm" variant="outline" onClick={() => setDialogo('aceptacion')} disabled={d.documentos.length === 0}>
                <Plus aria-hidden /> Registrar
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {d.documentos.length === 0 ? (
              <p className="mb-2 text-sm text-muted-foreground">
                No hay documentos institucionales publicados para {m.anio}.{' '}
                <Link className="underline" href="/admin/matricula/documentos">
                  Publicar documentos
                </Link>
              </p>
            ) : null}
            {d.aceptaciones.length === 0 ? (
              <EstadoVacio titulo="Sin aceptaciones" />
            ) : (
              <ul className="grid gap-2">
                {d.aceptaciones.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">
                        {etiqueta(a.tipo)} v{a.version}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {a.firmante} · {etiqueta(a.metodo)} · {formatoFechaHora(a.aceptado_en)}
                      </span>
                    </span>
                    {a.evidencia_id ? (
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={urlArchivo(a.evidencia_id)} aria-label="Descargar evidencia de aceptación">
                          <FileDown aria-hidden />
                        </a>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <ChecklistMatricula
          matriculaId={m.id}
          accion={
            props.puedeExpediente ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/admin/matricula/expedientes?estudianteId=${m.estudiante_id}&matriculaId=${m.id}`}>Expediente</Link>
              </Button>
            ) : null
          }
        />
      </div>

      <DialogosOperacion detalle={d} operacion={operacion} alCerrar={() => setOperacion(null)} alCambiar={refrescar} />

      <DialogoFormulario
        titulo="Responsable económico"
        esquema={esquemaResponsable}
        abierto={dialogo === 'responsable'}
        alCambiarAbierto={(v) => !v && setDialogo(null)}
        valores={{
          personaId: '',
          tipoDocumento: 'DNI',
          numeroDocumento: '',
          nombreRazonSocial: '',
          direccion: '',
          desde: responsableVigente ? hoyLima() : m.anio_inicio < hoyLima() ? hoyLima() : m.anio_inicio,
        }}
        mensajeExito="Responsable registrado"
        alEnviar={async (datos) => {
          await api.post(`${ENDPOINTS.matriculas}/${m.id}/responsables`, datos);
          await refrescar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect nombre="tipoDocumento" etiqueta="Tipo de documento" opciones={opciones(TIPOS_DOCUMENTO_RESPONSABLE)} />
          <CampoTexto nombre="numeroDocumento" etiqueta="N.º de documento" autoComplete="off" />
        </div>
        <CampoTexto nombre="nombreRazonSocial" etiqueta="Nombre o razón social" />
        <CampoTexto nombre="direccion" etiqueta="Dirección" descripcion="Opcional (para comprobantes)" />
        <CampoTexto nombre="desde" etiqueta="Responsable desde" tipo="date" />
        {d.firmantes.length ? (
          <CampoSelect
            nombre="personaId"
            etiqueta="Vincular a un apoderado (opcional)"
            placeholder="Ninguno"
            opciones={d.firmantes.map((f) => ({ valor: f.persona_id, etiqueta: `${f.nombre} (${etiqueta(f.parentesco)})` }))}
          />
        ) : null}
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Aceptación de documento"
        esquema={esquemaAceptacionCliente}
        abierto={dialogo === 'aceptacion'}
        alCambiarAbierto={(v) => !v && setDialogo(null)}
        valores={{ documentoId: d.documentos[0]?.id ?? '', firmanteId: d.firmantes[0]?.persona_id ?? '', metodo: 'firma_fisica', fecha: hoyLima() }}
        mensajeExito="Aceptación registrada"
        alEnviar={async (datos) => {
          await api.post(`${ENDPOINTS.matriculas}/${m.id}/aceptaciones`, aFormData(datos));
          await refrescar();
        }}
      >
        <CampoSelect nombre="documentoId" etiqueta="Documento" opciones={d.documentos.map((x) => ({ valor: x.id, etiqueta: `${etiqueta(x.tipo)} v${x.version}` }))} />
        {d.firmantes.length ? (
          <CampoSelect
            nombre="firmanteId"
            etiqueta="Firmante"
            opciones={d.firmantes.map((f) => ({ valor: f.persona_id, etiqueta: `${f.nombre} (${etiqueta(f.parentesco)})` }))}
          />
        ) : (
          <p role="alert" className="text-sm text-destructive">
            El estudiante no tiene apoderados vigentes: vincúlelos desde su ficha.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoSelect nombre="metodo" etiqueta="Método" opciones={opciones(METODOS_ACEPTACION)} />
          <CampoTexto nombre="fecha" etiqueta="Fecha de aceptación" tipo="date" />
        </div>
        <CampoArchivo nombre="archivo" etiqueta="Evidencia (opcional)" descripcion="Documento firmado escaneado (PDF o imagen)." />
      </DialogoFormulario>
    </>
  );
}
