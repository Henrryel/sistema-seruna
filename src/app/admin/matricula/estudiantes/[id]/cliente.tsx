'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardPlus, ExternalLink, FileDown, IdCard, KeyRound, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio, SinPermiso } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { EtiquetaBooleana } from '@/components/matricula/campos';
import { DialogoSolicitud } from '@/components/matricula/dialogo-solicitud';
import { ENDPOINTS, urlArchivo } from '@/components/matricula/utilidades';
import { api, conConsulta, mensajeDeError } from '@/lib/api';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { esquemaEstudianteEdicion, type FichaEstudiante } from '@/esquemas/matricula/estudiantes';
import { esquemaDocumentoIdentidad, etiqueta, opciones, TIPOS_DOCUMENTO_IDENTIDAD } from '@/esquemas/matricula/comunes';
import type { RespuestaListado } from '@/esquemas/comunes';
import type { FilaDocumentoExpediente } from '@/esquemas/matricula/expedientes';
import { PanelApoderados } from './apoderados';

export const claveFicha = (id: string) => ['ficha-estudiante', id] as const;

function Dato({ etiqueta: e, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{e}</dt>
      <dd className="truncate text-sm font-medium">{children || '—'}</dd>
    </div>
  );
}

export function ClienteFichaEstudiante(props: { id: string; puedeExpediente: boolean; puedeUsuarios: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const consulta = useQuery({ queryKey: claveFicha(props.id), queryFn: () => api.get<FichaEstudiante>(`${ENDPOINTS.estudiantes}/${props.id}`) });
  const refrescar = () => qc.invalidateQueries({ queryKey: claveFicha(props.id) });
  const [editando, setEditando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);

  if (consulta.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Cargando ficha">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (consulta.isError) {
    return <EstadoVacio titulo="No se pudo cargar la ficha" descripcion={mensajeDeError(consulta.error)} />;
  }
  const f = consulta.data;
  const e = f.estudiante;
  const nombre = `${e.apellidos}, ${e.nombres}`;

  return (
    <>
      <Button variant="link" size="sm" className="mb-2 px-0" asChild>
        <Link href="/admin/matricula/estudiantes">
          <ArrowLeft aria-hidden /> Estudiantes
        </Link>
      </Button>
      <EncabezadoPagina
        titulo={nombre}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{e.codigo}</span>
            {e.codigo_siagie ? <span>· SIAGIE {e.codigo_siagie}</span> : null}
            <EtiquetaBooleana valor={e.activo} si="Activo" no="Inactivo" />
          </span>
        }
        acciones={
          <>
            <Button variant="outline" onClick={() => setEditando(true)}>
              <Pencil aria-hidden /> Editar
            </Button>
            <Button onClick={() => setSolicitando(true)} disabled={!e.activo}>
              <ClipboardPlus aria-hidden /> Solicitar matrícula
            </Button>
          </>
        }
      />

      <Tabs defaultValue="datos" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="datos">Datos</TabsTrigger>
            <TabsTrigger value="apoderados">Apoderados ({f.apoderados.length})</TabsTrigger>
            <TabsTrigger value="matriculas">Matrículas ({f.matriculas.length})</TabsTrigger>
            <TabsTrigger value="expediente">Expediente</TabsTrigger>
            <TabsTrigger value="responsables">Responsables</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="datos" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Datos personales</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Dato etiqueta="Apellidos">{e.apellidos}</Dato>
                <Dato etiqueta="Nombres">{e.nombres}</Dato>
                <Dato etiqueta="Fecha de nacimiento">{e.fecha_nacimiento ? formatoFecha(e.fecha_nacimiento) : null}</Dato>
                <Dato etiqueta="Teléfono">{e.telefono}</Dato>
                <Dato etiqueta="Correo">{e.correo_contacto}</Dato>
                <Dato etiqueta="Dirección">{e.direccion}</Dato>
              </dl>
            </CardContent>
          </Card>
          <div className="grid content-start gap-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <IdCard className="size-4" aria-hidden /> Documentos
                </CardTitle>
                <DialogoFormulario
                  titulo="Agregar documento de identidad"
                  esquema={esquemaDocumentoIdentidad}
                  valores={{ tipo: 'DNI', numero: '', paisEmisor: 'PE' }}
                  ancho="sm"
                  mensajeExito="Documento agregado"
                  alEnviar={async (d) => {
                    await api.post(`${ENDPOINTS.estudiantes}/${props.id}/documentos`, d);
                    await refrescar();
                  }}
                  disparador={
                    <Button size="icon-sm" variant="outline" aria-label="Agregar documento de identidad">
                      <Plus aria-hidden />
                    </Button>
                  }
                >
                  <CampoSelect nombre="tipo" etiqueta="Tipo" opciones={opciones(TIPOS_DOCUMENTO_IDENTIDAD)} />
                  <CampoTexto nombre="numero" etiqueta="Número" autoComplete="off" />
                  <CampoTexto nombre="paisEmisor" etiqueta="País emisor" descripcion="Código de 2 letras" />
                </DialogoFormulario>
              </CardHeader>
              <CardContent>
                {f.documentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin documentos registrados.</p>
                ) : (
                  <ul className="grid gap-1 text-sm">
                    {f.documentos.map((d) => (
                      <li key={d.id}>
                        <span className="font-medium">{etiqueta(d.tipo)}</span> {d.numero}
                        {d.pais_emisor !== 'PE' ? <span className="text-muted-foreground"> ({d.pais_emisor})</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4" aria-hidden /> Acceso al portal
                </CardTitle>
                <CardDescription>
                  {f.usuario ? (
                    <>
                      Usuario <span className="font-mono">{f.usuario.login}</span> · <BadgeEstado estado={f.usuario.estado} />
                    </>
                  ) : (
                    'El estudiante aún no tiene cuenta de acceso.'
                  )}
                </CardDescription>
              </CardHeader>
              {props.puedeUsuarios ? (
                <CardContent>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/usuarios?persona=${e.persona_id}`}>
                      <ExternalLink aria-hidden /> {f.usuario ? 'Gestionar acceso' : 'Crear acceso'}
                    </Link>
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="apoderados">
          <PanelApoderados estudianteId={props.id} apoderados={f.apoderados} alCambiar={refrescar} />
        </TabsContent>

        <TabsContent value="matriculas">
          <Card>
            <CardHeader>
              <CardTitle>Matrículas</CardTitle>
              <CardDescription>Una matrícula por año académico.</CardDescription>
            </CardHeader>
            <CardContent>
              {f.matriculas.length === 0 ? (
                <EstadoVacio titulo="Sin matrículas" descripcion="Registre la solicitud de matrícula del año." />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Año</TableHead>
                        <TableHead>Grado</TableHead>
                        <TableHead className="hidden sm:table-cell">Sección</TableHead>
                        <TableHead className="hidden md:table-cell">Ingreso</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.matriculas.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.anio}</TableCell>
                          <TableCell>{m.grado}</TableCell>
                          <TableCell className="hidden sm:table-cell">{m.seccion ?? '—'}</TableCell>
                          <TableCell className="hidden md:table-cell">{etiqueta(m.tipo_ingreso)}</TableCell>
                          <TableCell>
                            <BadgeEstado estado={m.estado} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" asChild>
                                <a href={`${ENDPOINTS.matriculas}/${m.id}/ficha`} download aria-label={`Descargar ficha de matrícula ${m.anio}`}>
                                  <FileDown aria-hidden />
                                </a>
                              </Button>
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/admin/matricula/matriculas/${m.id}`}>Gestionar</Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expediente">
          {props.puedeExpediente ? <ExpedienteEstudiante estudianteId={props.id} /> : <SinPermiso mensaje="Requiere el permiso de gestión de expedientes." />}
        </TabsContent>

        <TabsContent value="responsables">
          <Card>
            <CardHeader>
              <CardTitle>Responsables económicos</CardTitle>
              <CardDescription>Se registran por matrícula, desde la pantalla de cada matrícula.</CardDescription>
            </CardHeader>
            <CardContent>
              {f.responsables.length === 0 ? (
                <EstadoVacio titulo="Sin responsables económicos" />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Año</TableHead>
                        <TableHead>Nombre o razón social</TableHead>
                        <TableHead className="hidden sm:table-cell">Documento</TableHead>
                        <TableHead>Vigencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.responsables.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.anio}</TableCell>
                          <TableCell className="font-medium">{r.nombre_razon_social}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {r.tipo_documento} {r.numero_documento}
                          </TableCell>
                          <TableCell>
                            {formatoFecha(r.desde)} – {r.hasta ? formatoFecha(r.hasta) : 'indefinido'} {r.vigente ? <BadgeEstado estado="activo" /> : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DialogoFormulario
        titulo="Editar estudiante"
        esquema={esquemaEstudianteEdicion}
        abierto={editando}
        alCambiarAbierto={setEditando}
        ancho="lg"
        valores={{
          nombres: e.nombres,
          apellidos: e.apellidos,
          fechaNacimiento: e.fecha_nacimiento ?? '',
          correo: e.correo_contacto ?? '',
          telefono: e.telefono ?? '',
          direccion: e.direccion ?? '',
          codigo: e.codigo,
          codigoSiagie: e.codigo_siagie ?? '',
          activo: e.activo,
        }}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINTS.estudiantes}/${props.id}`, d);
          await refrescar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="apellidos" etiqueta="Apellidos" />
          <CampoTexto nombre="nombres" etiqueta="Nombres" />
          <CampoTexto nombre="fechaNacimiento" etiqueta="Fecha de nacimiento" tipo="date" />
          <CampoTexto nombre="telefono" etiqueta="Teléfono" tipo="tel" />
          <CampoTexto nombre="correo" etiqueta="Correo" tipo="email" />
          <CampoTexto nombre="direccion" etiqueta="Dirección" />
          <CampoTexto nombre="codigo" etiqueta="Código interno" />
          <CampoTexto nombre="codigoSiagie" etiqueta="Código SIAGIE" descripcion="Opcional" />
        </div>
        <CampoSwitch nombre="activo" etiqueta="Activo" />
      </DialogoFormulario>

      <DialogoSolicitud
        abierto={solicitando}
        alCambiarAbierto={setSolicitando}
        estudiante={{ id: props.id, etiqueta: `${nombre} (${e.codigo})` }}
        alSolicitar={(r) => router.push(`/admin/matricula/matriculas/${r.id}`)}
      />
    </>
  );
}

function ExpedienteEstudiante({ estudianteId }: { estudianteId: string }) {
  const consulta = useQuery({
    queryKey: ['expediente-estudiante', estudianteId],
    queryFn: () => api.get<RespuestaListado<FilaDocumentoExpediente>>(conConsulta(ENDPOINTS.expedientes, { estudianteId, porPagina: 100 })),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Expediente</CardTitle>
          <CardDescription>Documentos presentados y su revisión.</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/matricula/expedientes?estudianteId=${estudianteId}`}>Gestionar expediente</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {consulta.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : consulta.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {mensajeDeError(consulta.error)}
          </p>
        ) : consulta.data.filas.length === 0 ? (
          <EstadoVacio titulo="Expediente vacío" descripcion="Aún no se cargaron documentos." />
        ) : (
          <ul className="divide-y rounded-lg border">
            {consulta.data.filas.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{d.tipo_documento}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {d.anio ?? 'general'} · {formatoFechaHora(d.cargado_en)}
                  </span>
                  {d.observacion ? <span className="block text-xs text-muted-foreground">Obs.: {d.observacion}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <BadgeEstado estado={d.estado} />
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={urlArchivo(d.archivo_id)} aria-label={`Descargar ${d.nombre_archivo}`}>
                      <FileDown aria-hidden />
                    </a>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
