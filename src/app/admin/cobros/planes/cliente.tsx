'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { CalendarPlus, CopyPlus, Loader2, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { BuscadorAlumno } from '@/components/cobros/buscador-alumno';
import { api, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoFechaHora, formatoMes, formatoMoneda, hoyLima } from '@/lib/formato';
import {
  ETIQUETA_CONCEPTO,
  OPCIONES_CONCEPTO,
  esquemaEditarObligacion,
  esquemaEditarPlan,
  esquemaGenerarPensiones,
  esquemaObligacion,
  esquemaPlan,
  esquemaTramo,
  type CondicionEconomica,
  type FilaObligacion,
  type FilaPlan,
  type FilaTramo,
} from '@/esquemas/cobros/planes';
import type { AlumnoBusqueda, CuentaCobro } from '@/esquemas/cobros/pagos';

const ENDPOINT = '/api/admin/cobros/planes';
const ENDPOINT_OBLIGACIONES = '/api/admin/cobros/obligaciones';
const OPCIONES_ESTADO = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'publicado', etiqueta: 'Publicado' },
];

function useCondiciones(anioId: string | undefined) {
  return useQuery({
    queryKey: ['cobros', 'condiciones', anioId],
    queryFn: () => api.get<{ condiciones: CondicionEconomica[] }>(`/api/admin/cobros/condiciones?anioId=${anioId}`),
    enabled: Boolean(anioId),
    staleTime: 60_000,
  });
}

/** Select de condiciones económicas publicadas del año (documentos institucionales). */
function CampoCondiciones({ anioId }: { anioId?: string }) {
  const q = useCondiciones(anioId);
  const opciones = (q.data?.condiciones ?? []).map((c) => ({
    valor: c.id,
    etiqueta: `Versión ${c.version}${c.vigente_desde ? ` · vigente desde ${formatoFecha(c.vigente_desde)}` : ''}`,
  }));
  return (
    <CampoSelect
      nombre="condicionesId"
      etiqueta="Condiciones económicas"
      opciones={opciones}
      placeholder={!anioId ? 'Elija el año' : q.isPending ? 'Cargando…' : opciones.length ? 'Vigente del año (automático)' : 'No hay condiciones publicadas'}
      descripcion="Documento institucional publicado del año. Si no elige, se usa el vigente."
      className="sm:col-span-2"
    />
  );
}

function CamposPlanNuevo() {
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  const anioId = useWatch({ name: 'anioId' }) as string | undefined;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="anioId" etiqueta="Año académico" opciones={anios.data ?? []} />
      <CampoSelect nombre="gradoId" etiqueta="Grado" opciones={grados.data ?? []} />
      <CampoTexto nombre="pensionReferencia" etiqueta="Pensión de referencia (S/)" tipo="number" paso="0.01" />
      <CampoTexto nombre="vigenteDesde" etiqueta="Vigente desde" tipo="date" />
      <CampoCondiciones anioId={anioId} />
    </div>
  );
}

function CamposTramo() {
  const concepto = useWatch({ name: 'concepto' }) as string | undefined;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="concepto" etiqueta="Concepto" opciones={OPCIONES_CONCEPTO} />
      <CampoTexto nombre="numero" etiqueta="Número" tipo="number" descripcion="La matrícula siempre es la n.º 1." />
      <CampoTexto nombre="importe" etiqueta="Importe (S/)" tipo="number" paso="0.01" />
      <CampoTexto
        nombre="mesServicio"
        etiqueta="Mes de servicio"
        tipo="month"
        descripcion={concepto === 'pension' ? 'Exigible desde el último día del mes.' : 'Solo para pensiones (déjelo vacío).'}
      />
      <CampoTexto nombre="exigibleDesde" etiqueta="Exigible desde" tipo="date" />
      <CampoTexto nombre="venceEn" etiqueta="Vence el" tipo="date" />
    </div>
  );
}

export function ClientePlanes() {
  return (
    <>
      <EncabezadoPagina
        titulo="Planes de cobro"
        descripcion="Planes versionados por año y grado. Un plan publicado no se modifica: se crea una nueva versión. Las cuotas replican exactamente sus tramos."
      />
      <Tabs defaultValue="planes">
        <TabsList>
          <TabsTrigger value="planes">Planes</TabsTrigger>
          <TabsTrigger value="obligaciones">Obligaciones de ingreso</TabsTrigger>
        </TabsList>
        <TabsContent value="planes" className="mt-4">
          <SeccionPlanes />
        </TabsContent>
        <TabsContent value="obligaciones" className="mt-4">
          <SeccionObligaciones />
        </TabsContent>
      </Tabs>
    </>
  );
}

function SeccionPlanes() {
  const recargar = useRecargarListado();
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const hoy = hoyLima();

  return (
    <div className="grid gap-4">
      <TablaDatos<FilaPlan>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por año o grado…"
        filtros={[
          { nombre: 'anioId', etiqueta: 'Año', tipo: 'select', opciones: anios.data ?? [] },
          { nombre: 'gradoId', etiqueta: 'Grado', tipo: 'select', opciones: grados.data ?? [] },
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO },
        ]}
        alSeleccionarFila={(f) => setSeleccionado(f.id)}
        barra={
          <DialogoFormulario
            titulo="Nuevo plan de cobro"
            descripcion="Se crea como borrador con la siguiente versión disponible para el año y grado."
            esquema={esquemaPlan}
            valores={{ anioId: '', gradoId: '', pensionReferencia: '', vigenteDesde: hoy, condicionesId: undefined }}
            alEnviar={async (d) => {
              const r = await api.post<{ id: string }>(ENDPOINT, d);
              await recargar(ENDPOINT);
              setSeleccionado(r.id);
            }}
            mensajeExito="Plan creado como borrador"
            disparador={
              <Button size="sm">
                <Plus aria-hidden /> Nuevo plan
              </Button>
            }
          >
            <CamposPlanNuevo />
          </DialogoFormulario>
        }
        columnas={[
          { clave: 'anio', titulo: 'Año', celda: (f) => <span className="font-medium">{f.anio}</span> },
          { clave: 'grado', titulo: 'Grado' },
          { clave: 'version', titulo: 'Versión', celda: (f) => `v${f.version}` },
          { clave: 'pension_referencia', titulo: 'Pensión ref.', celda: (f) => formatoMoneda(f.pension_referencia), className: 'text-right', ocultarEnMovil: true },
          { clave: 'vigente_desde', titulo: 'Vigente desde', celda: (f) => formatoFecha(f.vigente_desde), ocultarEnMovil: true },
          { clave: 'tramos', titulo: 'Tramos', celda: (f) => f.tramos, ocultarEnMovil: true },
          { clave: 'total', titulo: 'Total anual', celda: (f) => formatoMoneda(f.total), className: 'text-right', ocultarEnMovil: true },
          { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.publicado_en ? 'publicado' : 'borrador'} /> },
        ]}
        acciones={(f) => (
          <Button variant="ghost" size="sm" onClick={() => setSeleccionado(f.id)} aria-label={`Ver tramos del plan ${f.grado} ${f.anio} v${f.version}`}>
            Tramos
          </Button>
        )}
      />
      {seleccionado ? <PanelPlan planId={seleccionado} alCerrar={() => setSeleccionado(null)} alCambiarPlan={setSeleccionado} /> : null}
    </div>
  );
}

function PanelPlan({ planId, alCerrar, alCambiarPlan }: { planId: string; alCerrar: () => void; alCambiarPlan: (id: string) => void }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const clave = ['cobros', 'plan', planId];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<{ plan: FilaPlan; tramos: FilaTramo[] }>(`${ENDPOINT}/${planId}`) });
  const [editandoPlan, setEditandoPlan] = useState(false);
  const [editandoTramo, setEditandoTramo] = useState<FilaTramo | null>(null);
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await recargar(ENDPOINT);
  };

  if (consulta.isPending) return <Skeleton className="h-64 w-full" />;
  if (consulta.isError) {
    return (
      <div role="alert" className="rounded-md bg-peligro px-3 py-2 text-sm text-peligro-foreground">
        {mensajeDeError(consulta.error)}
      </div>
    );
  }
  const { plan, tramos } = consulta.data;
  const borrador = !plan.publicado_en;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {plan.grado} · {plan.anio} · v{plan.version}
        </CardTitle>
        <CardDescription>
          Pensión de referencia {formatoMoneda(plan.pension_referencia)} · vigente desde {formatoFecha(plan.vigente_desde)} · condiciones{' '}
          {plan.condiciones_version ? `v${plan.condiciones_version}` : 'por asignar'} ·{' '}
          {plan.publicado_en ? `publicado el ${formatoFechaHora(plan.publicado_en)}` : 'borrador'}
          {plan.cuotas ? ` · ${plan.cuotas} cuota(s) emitida(s)` : ''}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" onClick={alCerrar} aria-label="Cerrar detalle del plan">
            <X aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {borrador ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditandoPlan(true)}>
                <Pencil aria-hidden /> Editar plan
              </Button>
              <DialogoFormulario
                titulo="Nuevo tramo"
                esquema={esquemaTramo}
                valores={{ concepto: 'matricula', numero: 1, importe: plan.pension_referencia ?? '', mesServicio: null, exigibleDesde: plan.vigente_desde ?? '', venceEn: plan.vigente_desde ?? '' }}
                alEnviar={async (d) => {
                  await api.post(`${ENDPOINT}/${planId}/tramos`, d);
                  await refrescar();
                }}
                mensajeExito="Tramo agregado"
                disparador={
                  <Button variant="outline" size="sm">
                    <Plus aria-hidden /> Tramo
                  </Button>
                }
              >
                <CamposTramo />
              </DialogoFormulario>
              <DialogoFormulario
                titulo="Generar pensiones mensuales"
                descripcion="Reemplaza las pensiones del borrador. Cada pensión es exigible desde el último día de su mes y vence ese día más los días de gracia."
                esquema={esquemaGenerarPensiones}
                valores={{ mesInicio: `${plan.anio}-03`, cantidad: 10, importe: plan.pension_referencia ?? '', diasGracia: 0 }}
                alEnviar={async (d) => {
                  await api.post(`${ENDPOINT}/${planId}/pensiones`, d);
                  await refrescar();
                }}
                mensajeExito="Pensiones generadas"
                disparador={
                  <Button variant="outline" size="sm">
                    <CalendarPlus aria-hidden /> Generar 10 pensiones
                  </Button>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <CampoTexto nombre="mesInicio" etiqueta="Primer mes de servicio" tipo="month" />
                  <CampoTexto nombre="cantidad" etiqueta="Cantidad de pensiones" tipo="number" />
                  <CampoTexto nombre="importe" etiqueta="Importe de cada pensión (S/)" tipo="number" paso="0.01" />
                  <CampoTexto nombre="diasGracia" etiqueta="Días de gracia para vencer" tipo="number" />
                </div>
              </DialogoFormulario>
              <Confirmar
                titulo="¿Publicar el plan de cobro?"
                descripcion="Una vez publicado no se puede modificar; los cambios requieren una nueva versión. Desde su vigencia se podrán emitir cuotas."
                textoConfirmar="Publicar"
                mensajeExito="Plan publicado"
                alConfirmar={async () => {
                  await api.post(`${ENDPOINT}/${planId}/publicar`);
                  await refrescar();
                }}
                disparador={
                  <Button size="sm" disabled={tramos.length === 0}>
                    <Send aria-hidden /> Publicar
                  </Button>
                }
              />
            </>
          ) : (
            <Confirmar
              titulo="¿Crear una nueva versión?"
              descripcion="Se copiará el plan con sus tramos como borrador (versión siguiente). Las cuotas ya emitidas no cambian."
              textoConfirmar="Crear versión"
              mensajeExito="Nueva versión creada"
              alConfirmar={async () => {
                const r = await api.post<{ id: string }>(`${ENDPOINT}/${planId}/version`);
                await recargar(ENDPOINT);
                alCambiarPlan(r.id);
              }}
              disparador={
                <Button variant="outline" size="sm">
                  <CopyPlus aria-hidden /> Nueva versión
                </Button>
              }
            />
          )}
        </div>

        {tramos.length === 0 ? (
          <EstadoVacio titulo="Sin tramos" descripcion="Agregue la matrícula, la cuota de ingreso (si corresponde) y genere las pensiones." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>N.º</TableHead>
                  <TableHead>Mes</TableHead>
                  <TableHead className="hidden md:table-cell">Exigible</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  {borrador ? <TableHead className="text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tramos.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{ETIQUETA_CONCEPTO[t.concepto] ?? t.concepto}</TableCell>
                    <TableCell>{t.numero}</TableCell>
                    <TableCell>{t.mes_servicio ? formatoMes(t.mes_servicio) : '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{formatoFecha(t.exigible_desde)}</TableCell>
                    <TableCell>{formatoFecha(t.vence_en)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda(t.importe)}</TableCell>
                    {borrador ? (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar tramo ${t.concepto} ${t.numero}`} onClick={() => setEditandoTramo(t)}>
                          <Pencil aria-hidden />
                        </Button>
                        <Confirmar
                          titulo="¿Eliminar el tramo?"
                          descripcion="Solo es posible mientras el plan es borrador."
                          destructivo
                          textoConfirmar="Eliminar"
                          mensajeExito="Tramo eliminado"
                          alConfirmar={async () => {
                            await api.delete(`/api/admin/cobros/tramos/${t.id}`);
                            await refrescar();
                          }}
                          disparador={
                            <Button variant="ghost" size="icon-sm" aria-label={`Eliminar tramo ${t.concepto} ${t.numero}`}>
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
        <p className="text-right text-sm text-muted-foreground">
          Total anual del plan: <span className="font-semibold text-foreground">{formatoMoneda(plan.total)}</span>
        </p>
      </CardContent>

      <DialogoFormulario
        titulo="Editar plan"
        esquema={esquemaEditarPlan}
        valores={{ pensionReferencia: plan.pension_referencia ?? '', vigenteDesde: plan.vigente_desde ?? '', condicionesId: plan.condiciones_id ?? undefined }}
        abierto={editandoPlan}
        alCambiarAbierto={setEditandoPlan}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${planId}`, d);
          await refrescar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="pensionReferencia" etiqueta="Pensión de referencia (S/)" tipo="number" paso="0.01" />
          <CampoTexto nombre="vigenteDesde" etiqueta="Vigente desde" tipo="date" />
          <CampoCondiciones anioId={plan.anio_id} />
        </div>
      </DialogoFormulario>
      <DialogoFormulario
        titulo="Editar tramo"
        esquema={esquemaTramo}
        valores={
          editandoTramo
            ? {
                concepto: editandoTramo.concepto as 'pension',
                numero: editandoTramo.numero,
                importe: editandoTramo.importe,
                mesServicio: editandoTramo.mes_servicio?.slice(0, 7) ?? null,
                exigibleDesde: editandoTramo.exigible_desde,
                venceEn: editandoTramo.vence_en,
              }
            : {}
        }
        abierto={editandoTramo !== null}
        alCambiarAbierto={(v) => !v && setEditandoTramo(null)}
        alEnviar={async (d) => {
          await api.put(`/api/admin/cobros/tramos/${editandoTramo?.id}`, d);
          await refrescar();
        }}
      >
        <CamposTramo />
      </DialogoFormulario>
    </Card>
  );
}

// ---------- Obligaciones de ingreso ----------

function SeccionObligaciones() {
  const recargar = useRecargarListado();
  const anios = useCatalogo('anios');
  const [editando, setEditando] = useState<FilaObligacion | null>(null);
  return (
    <>
      <TablaDatos<FilaObligacion>
        endpoint={ENDPOINT_OBLIGACIONES}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar alumno o código…"
        filtros={[{ nombre: 'anioId', etiqueta: 'Año de ingreso', tipo: 'select', opciones: anios.data ?? [] }]}
        barra={<NuevaObligacion alGuardar={() => recargar(ENDPOINT_OBLIGACIONES)} />}
        vacio={<EstadoVacio titulo="Sin obligaciones de ingreso" descripcion="Registre la cuota de ingreso acordada con cada alumno nuevo." />}
        columnas={[
          { clave: 'alumno', titulo: 'Alumno', celda: (f) => <span className="font-medium">{f.alumno}</span> },
          { clave: 'codigo', titulo: 'Código', ocultarEnMovil: true },
          { clave: 'anio', titulo: 'Ingreso', celda: (f) => `${f.anio} · ${f.grado}`, ocultarEnMovil: true },
          { clave: 'importe_acordado', titulo: 'Acordado', celda: (f) => formatoMoneda(f.importe_acordado), className: 'text-right' },
          { clave: 'emitido', titulo: 'Emitido', celda: (f) => formatoMoneda(f.emitido), className: 'text-right', ocultarEnMovil: true },
          { clave: 'condiciones_version', titulo: 'Condiciones', celda: (f) => `v${f.condiciones_version}`, ocultarEnMovil: true },
        ]}
        acciones={(f) =>
          f.cuotas === 0 ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Editar obligación de ${f.alumno}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
          ) : null
        }
      />
      <DialogoFormulario
        titulo={`Obligación de ingreso · ${editando?.alumno ?? ''}`}
        descripcion="Editable solo mientras no se emitan cuotas de ingreso."
        esquema={esquemaEditarObligacion}
        valores={editando ? { importeAcordado: editando.importe_acordado, condicionesId: editando.condiciones_id } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT_OBLIGACIONES}/${editando?.id}`, d);
          await recargar(ENDPOINT_OBLIGACIONES);
        }}
      >
        <CampoTexto nombre="importeAcordado" etiqueta="Importe acordado (S/)" tipo="number" paso="0.01" />
      </DialogoFormulario>
    </>
  );
}

function NuevaObligacion({ alGuardar }: { alGuardar: () => Promise<unknown> }) {
  const [abierto, setAbierto] = useState(false);
  const [alumno, setAlumno] = useState<AlumnoBusqueda | null>(null);
  const [matriculaId, setMatriculaId] = useState<string>('');
  const [importe, setImporte] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cuenta = useQuery({
    queryKey: ['cobros', 'cuenta', alumno?.estudiante_id],
    queryFn: () => api.get<CuentaCobro>(`/api/admin/cobros/alumnos/${alumno?.estudiante_id}/cuenta`),
    enabled: Boolean(alumno),
  });
  const reiniciar = () => {
    setAlumno(null);
    setMatriculaId('');
    setImporte('');
  };

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) reiniciar();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden /> Nueva obligación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva obligación de ingreso</DialogTitle>
          <DialogDescription>Una por alumno, ligada a su matrícula de ingreso y a las condiciones económicas publicadas del año.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <BuscadorAlumno
            seleccionado={alumno?.estudiante_id}
            alSeleccionar={(a) => {
              setAlumno(a);
              setMatriculaId(a.matricula_id ?? '');
            }}
          />
          {alumno ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="obligacion-matricula">Matrícula de ingreso</Label>
                <Select value={matriculaId} onValueChange={setMatriculaId}>
                  <SelectTrigger id="obligacion-matricula" className="w-full">
                    <SelectValue placeholder={cuenta.isPending ? 'Cargando…' : 'Seleccione'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(cuenta.data?.matriculas ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.anio} · {m.grado} ({m.estado})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="obligacion-importe">Importe acordado (S/)</Label>
                <Input id="obligacion-importe" type="number" step="0.01" min="0" value={importe} onChange={(e) => setImporte(e.target.value)} />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!alumno || !matriculaId || !importe || enviando}
            onClick={async () => {
              const r = esquemaObligacion.safeParse({ matriculaId, importeAcordado: importe });
              if (!r.success) {
                toast.error(r.error.issues[0]?.message ?? 'Datos inválidos');
                return;
              }
              setEnviando(true);
              try {
                await api.post(ENDPOINT_OBLIGACIONES, r.data);
                toast.success('Obligación registrada');
                await alGuardar();
                setAbierto(false);
                reiniciar();
              } catch (e) {
                toast.error(mensajeDeError(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
