'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyPlus, ListChecks, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { CampoCatalogo } from '@/components/matricula/campos';
import { ENDPOINTS } from '@/components/matricula/utilidades';
import { api } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { esquemaRegla, esquemaRequisito, esquemaTipoDocumento, type FilaRegla, type FilaRequisito, type FilaTipoDocumento } from '@/esquemas/matricula/reglas';
import { etiqueta, opciones, TIPOS_INGRESO } from '@/esquemas/matricula/comunes';

function CamposRegla({ bloquearClave }: { bloquearClave?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoCatalogo nombre="anioId" etiqueta="Año académico" tipo="anios" deshabilitado={bloquearClave} />
      <CampoCatalogo nombre="gradoId" etiqueta="Grado" tipo="grados" deshabilitado={bloquearClave} />
      <CampoSelect nombre="tipoIngreso" etiqueta="Tipo de ingreso" opciones={opciones(TIPOS_INGRESO)} deshabilitado={bloquearClave} />
      <div />
      <CampoTexto nombre="solicitudesInicio" etiqueta="Solicitudes desde" tipo="date" />
      <CampoTexto nombre="solicitudesFin" etiqueta="Solicitudes hasta" tipo="date" />
      <CampoTexto nombre="corteEdad" etiqueta="Fecha de corte de edad" tipo="date" descripcion="Obligatoria si fija edades" />
      <div className="grid grid-cols-2 gap-2">
        <CampoTexto nombre="edadMinima" etiqueta="Edad mínima" tipo="number" />
        <CampoTexto nombre="edadMaxima" etiqueta="Edad máxima" tipo="number" />
      </div>
      <CampoTexto nombre="referenciaNormativa" etiqueta="Referencia normativa" placeholder="p. ej. RM N.º 447-2020-MINEDU" className="sm:col-span-2" />
    </div>
  );
}

const valoresRegla = (r: FilaRegla) => ({
  anioId: r.anio_id,
  gradoId: r.grado_id,
  tipoIngreso: r.tipo_ingreso as (typeof TIPOS_INGRESO)[number],
  solicitudesInicio: r.solicitudes_inicio,
  solicitudesFin: r.solicitudes_fin,
  corteEdad: r.corte_edad ?? '',
  edadMinima: r.edad_minima,
  edadMaxima: r.edad_maxima,
  referenciaNormativa: r.referencia_normativa ?? '',
});

export function ClienteReglas() {
  const recargar = useRecargarListado();
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  const [seleccionada, setSeleccionada] = useState<FilaRegla | null>(null);
  const [editando, setEditando] = useState<FilaRegla | null>(null);
  const refrescar = () => recargar(ENDPOINTS.reglas);

  return (
    <>
      <EncabezadoPagina
        titulo="Reglas y requisitos de matrícula"
        descripcion="Reglas versionadas por año, grado y tipo de ingreso. Una regla publicada no se edita: cree una nueva versión."
      />
      <Tabs defaultValue="reglas" className="gap-4">
        <TabsList>
          <TabsTrigger value="reglas">Reglas</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de documento</TabsTrigger>
        </TabsList>
        <TabsContent value="reglas" className="grid gap-4">
          <TablaDatos<FilaRegla>
            endpoint={ENDPOINTS.reglas}
            claveFila={(f) => f.id}
            placeholderBusqueda="Referencia normativa…"
            barra={
              <DialogoFormulario
                titulo="Nueva regla de matrícula"
                descripcion="Se crea en borrador con la siguiente versión disponible."
                esquema={esquemaRegla}
                valores={{ tipoIngreso: 'nuevo', solicitudesInicio: '', solicitudesFin: '', corteEdad: '', edadMinima: null, edadMaxima: null, referenciaNormativa: '' }}
                ancho="lg"
                mensajeExito="Regla creada"
                alEnviar={async (d) => {
                  await api.post(ENDPOINTS.reglas, d);
                  await refrescar();
                }}
                disparador={
                  <Button size="sm">
                    <Plus aria-hidden /> Nueva regla
                  </Button>
                }
              >
                <CamposRegla />
              </DialogoFormulario>
            }
            filtros={[
              { nombre: 'anioId', etiqueta: 'Año', tipo: 'select', opciones: anios.data ?? [] },
              { nombre: 'gradoId', etiqueta: 'Grado', tipo: 'select', opciones: grados.data ?? [] },
              { nombre: 'tipoIngreso', etiqueta: 'Ingreso', tipo: 'select', opciones: opciones(TIPOS_INGRESO) },
              {
                nombre: 'publicada',
                etiqueta: 'Estado',
                tipo: 'select',
                opciones: [
                  { valor: 'true', etiqueta: 'Publicadas' },
                  { valor: 'false', etiqueta: 'Borradores' },
                ],
              },
            ]}
            alSeleccionarFila={setSeleccionada}
            vacio={<EstadoVacio titulo="Sin reglas" descripcion="Cree la regla del año, grado y tipo de ingreso." />}
            columnas={[
              {
                clave: 'regla',
                titulo: 'Regla',
                celda: (f) => (
                  <span>
                    <span className="font-medium">
                      {f.anio} · {f.grado}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {etiqueta(f.tipo_ingreso)} · versión {f.version}
                    </span>
                  </span>
                ),
              },
              {
                clave: 'ventana',
                titulo: 'Solicitudes',
                ocultarEnMovil: true,
                celda: (f) => `${formatoFecha(f.solicitudes_inicio)} – ${formatoFecha(f.solicitudes_fin)}`,
              },
              {
                clave: 'edad',
                titulo: 'Edad al corte',
                ocultarEnMovil: true,
                celda: (f) => (f.corte_edad ? `${f.edad_minima ?? '—'} a ${f.edad_maxima ?? '—'} años al ${formatoFecha(f.corte_edad)}` : '—'),
              },
              { clave: 'requisitos', titulo: 'Requisitos', className: 'tabular-nums', ocultarEnMovil: true },
              {
                clave: 'estado',
                titulo: 'Estado',
                celda: (f) =>
                  f.publicada_en ? <Etiqueta tono="exito">Publicada</Etiqueta> : <Etiqueta tono="alerta">Borrador</Etiqueta>,
              },
            ]}
            acciones={(f) => (
              <>
                <Button variant="ghost" size="icon-sm" aria-label={`Requisitos de la versión ${f.version}`} onClick={() => setSeleccionada(f)}>
                  <ListChecks aria-hidden />
                </Button>
                {!f.publicada_en ? (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Editar regla" onClick={() => setEditando(f)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Confirmar
                      titulo="¿Publicar la regla?"
                      descripcion="Desde su publicación se usa para las solicitudes y ya no podrá editarse."
                      textoConfirmar="Publicar"
                      mensajeExito="Regla publicada"
                      alConfirmar={async () => {
                        await api.post(`${ENDPOINTS.reglas}/${f.id}/publicar`);
                        await refrescar();
                        setSeleccionada((s) => (s?.id === f.id ? { ...f, publicada_en: new Date().toISOString() } : s));
                      }}
                      disparador={
                        <Button variant="ghost" size="icon-sm" aria-label="Publicar regla">
                          <Send aria-hidden />
                        </Button>
                      }
                    />
                    <Confirmar
                      titulo="¿Eliminar el borrador?"
                      destructivo
                      textoConfirmar="Eliminar"
                      mensajeExito="Borrador eliminado"
                      alConfirmar={async () => {
                        await api.delete(`${ENDPOINTS.reglas}/${f.id}`);
                        await refrescar();
                        setSeleccionada((s) => (s?.id === f.id ? null : s));
                      }}
                      disparador={
                        <Button variant="ghost" size="icon-sm" aria-label="Eliminar borrador">
                          <Trash2 aria-hidden />
                        </Button>
                      }
                    />
                  </>
                ) : (
                  <Confirmar
                    titulo="¿Crear una nueva versión?"
                    descripcion="Se copia la regla con sus requisitos como borrador para modificarla y publicarla."
                    textoConfirmar="Crear versión"
                    mensajeExito="Nueva versión creada"
                    alConfirmar={async () => {
                      await api.post(`${ENDPOINTS.reglas}/${f.id}/version`);
                      await refrescar();
                    }}
                    disparador={
                      <Button variant="ghost" size="icon-sm" aria-label="Nueva versión">
                        <CopyPlus aria-hidden />
                      </Button>
                    }
                  />
                )}
              </>
            )}
          />
          {seleccionada ? <PanelRequisitos regla={seleccionada} alCambiar={refrescar} /> : null}
        </TabsContent>
        <TabsContent value="tipos">
          <TiposDocumento />
        </TabsContent>
      </Tabs>

      <DialogoFormulario
        titulo={`Editar regla (versión ${editando?.version ?? ''})`}
        esquema={esquemaRegla}
        valores={editando ? valoresRegla(editando) : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        ancho="lg"
        alEnviar={async (d) => {
          await api.put(`${ENDPOINTS.reglas}/${editando?.id}`, d);
          await refrescar();
        }}
      >
        <CamposRegla bloquearClave />
      </DialogoFormulario>
    </>
  );
}

function PanelRequisitos({ regla, alCambiar }: { regla: FilaRegla; alCambiar: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const clave = ['requisitos', regla.id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<{ requisitos: FilaRequisito[] }>(`${ENDPOINTS.reglas}/${regla.id}/requisitos`) });
  const [editando, setEditando] = useState<FilaRequisito | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const editable = !regla.publicada_en;
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await alCambiar();
  };
  const requisitos = consulta.data?.requisitos ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>
            Requisitos · {regla.anio} {regla.grado} · {etiqueta(regla.tipo_ingreso)} v{regla.version}
          </CardTitle>
          <CardDescription>
            {editable ? 'Documentos que exige la regla (borrador).' : `Publicada el ${formatoFechaHora(regla.publicada_en)}: solo lectura.`}
            {regla.referencia_normativa ? ` · ${regla.referencia_normativa}` : ''}
          </CardDescription>
        </div>
        {editable ? (
          <Button size="sm" onClick={() => setNuevo(true)}>
            <Plus aria-hidden /> Requisito
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {consulta.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : requisitos.length === 0 ? (
          <EstadoVacio titulo="Sin requisitos" descripcion="Agregue los documentos que se deben presentar." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Obligatorio</TableHead>
                  <TableHead className="hidden sm:table-cell">Regularización</TableHead>
                  {editable ? <TableHead className="text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitos.map((q) => (
                  <TableRow key={q.tipo_documento_id}>
                    <TableCell className="font-medium">{q.nombre}</TableCell>
                    <TableCell>{q.obligatorio ? 'Sí' : 'No'}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {q.admite_regularizacion ? `Sí${q.plazo_regularizacion ? `, hasta ${formatoFecha(q.plazo_regularizacion)}` : ''}` : 'No'}
                    </TableCell>
                    {editable ? (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar ${q.nombre}`} onClick={() => setEditando(q)}>
                          <Pencil aria-hidden />
                        </Button>
                        <Confirmar
                          titulo={`¿Quitar "${q.nombre}"?`}
                          destructivo
                          textoConfirmar="Quitar"
                          mensajeExito="Requisito quitado"
                          alConfirmar={async () => {
                            await api.delete(`${ENDPOINTS.reglas}/${regla.id}/requisitos/${q.tipo_documento_id}`);
                            await refrescar();
                          }}
                          disparador={
                            <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${q.nombre}`}>
                              <Trash2 aria-hidden />
                            </Button>
                          }
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <DialogoFormulario
        titulo={editando ? `Requisito: ${editando.nombre}` : 'Nuevo requisito'}
        esquema={esquemaRequisito}
        abierto={nuevo || editando !== null}
        alCambiarAbierto={(v) => {
          if (!v) {
            setNuevo(false);
            setEditando(null);
          }
        }}
        valores={
          editando
            ? {
                tipoDocumentoId: editando.tipo_documento_id,
                obligatorio: editando.obligatorio,
                admiteRegularizacion: editando.admite_regularizacion,
                plazoRegularizacion: editando.plazo_regularizacion ?? '',
              }
            : { obligatorio: true, admiteRegularizacion: false, plazoRegularizacion: '' }
        }
        mensajeExito="Requisito guardado"
        alEnviar={async (d) => {
          await api.post(`${ENDPOINTS.reglas}/${regla.id}/requisitos`, d);
          await refrescar();
        }}
      >
        <CampoCatalogo nombre="tipoDocumentoId" etiqueta="Tipo de documento" tipo="tipos-documento" deshabilitado={Boolean(editando)} />
        <CampoSwitch nombre="obligatorio" etiqueta="Obligatorio" />
        <CampoSwitch nombre="admiteRegularizacion" etiqueta="Admite regularización" descripcion="Puede presentarse después de la matrícula." />
        <CampoTexto nombre="plazoRegularizacion" etiqueta="Plazo de regularización" tipo="date" descripcion="Solo si admite regularización" />
      </DialogoFormulario>
    </Card>
  );
}

function TiposDocumento() {
  const recargar = useRecargarListado();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<FilaTipoDocumento | null>(null);
  const refrescar = async () => {
    await recargar(ENDPOINTS.tiposDocumento);
    await qc.invalidateQueries({ queryKey: ['catalogo', 'tipos-documento'] });
  };
  return (
    <>
      <TablaDatos<FilaTipoDocumento>
        endpoint={ENDPOINTS.tiposDocumento}
        claveFila={(f) => f.id}
        placeholderBusqueda="Código o nombre…"
        barra={
          <DialogoFormulario
            titulo="Nuevo tipo de documento"
            esquema={esquemaTipoDocumento}
            valores={{ codigo: '', nombre: '' }}
            ancho="sm"
            mensajeExito="Tipo de documento creado"
            alEnviar={async (d) => {
              await api.post(ENDPOINTS.tiposDocumento, d);
              await refrescar();
            }}
            disparador={
              <Button size="sm">
                <Plus aria-hidden /> Nuevo tipo
              </Button>
            }
          >
            <CampoTexto nombre="codigo" etiqueta="Código" placeholder="PARTIDA_NAC" descripcion="Único; se guarda en mayúsculas." />
            <CampoTexto nombre="nombre" etiqueta="Nombre" placeholder="Partida de nacimiento" />
          </DialogoFormulario>
        }
        vacio={<EstadoVacio titulo="Sin tipos de documento" descripcion="Registre los documentos del expediente (partida, DNI, certificado de estudios…)." />}
        columnas={[
          { clave: 'codigo', titulo: 'Código', celda: (f) => <span className="font-mono text-xs">{f.codigo}</span> },
          { clave: 'nombre', titulo: 'Nombre', celda: (f) => <span className="font-medium">{f.nombre}</span> },
          { clave: 'usos', titulo: 'Usos', className: 'tabular-nums', ocultarEnMovil: true },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.nombre}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
            <Confirmar
              titulo={`¿Eliminar "${f.nombre}"?`}
              descripcion="Solo es posible si no se usa en requisitos ni expedientes."
              destructivo
              textoConfirmar="Eliminar"
              mensajeExito="Tipo de documento eliminado"
              alConfirmar={async () => {
                await api.delete(`${ENDPOINTS.tiposDocumento}/${f.id}`);
                await refrescar();
              }}
              disparador={
                <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${f.nombre}`} disabled={f.usos > 0}>
                  <Trash2 aria-hidden />
                </Button>
              }
            />
          </>
        )}
      />
      <DialogoFormulario
        titulo="Editar tipo de documento"
        esquema={esquemaTipoDocumento}
        valores={editando ? { codigo: editando.codigo, nombre: editando.nombre } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        ancho="sm"
        alEnviar={async (d) => {
          await api.put(`${ENDPOINTS.tiposDocumento}/${editando?.id}`, d);
          await refrescar();
        }}
      >
        <CampoTexto nombre="codigo" etiqueta="Código" />
        <CampoTexto nombre="nombre" etiqueta="Nombre" />
      </DialogoFormulario>
    </>
  );
}
