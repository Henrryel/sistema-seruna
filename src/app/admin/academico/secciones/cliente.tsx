'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DoorOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { SelectorAnio } from '@/components/academico/selectores';
import { api, conConsulta } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha } from '@/lib/formato';
import { esquemaAula, esquemaSeccion, TURNOS, type FilaAula, type FilaGrado, type FilaSeccion } from '@/esquemas/academico/secciones';

const ENDPOINT = '/api/admin/academico/secciones';
const ENDPOINT_AULAS = '/api/admin/academico/aulas';
const OPCIONES_ACTIVA = [
  { valor: 'true', etiqueta: 'Activas' },
  { valor: 'false', etiqueta: 'Inactivas' },
];

function CamposSeccion() {
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="anioId" etiqueta="Año académico" opciones={anios.data ?? []} />
      <CampoSelect nombre="gradoId" etiqueta="Grado" opciones={grados.data ?? []} />
      <CampoTexto nombre="nombre" etiqueta="Sección" placeholder="A" descripcion="Se guarda en mayúsculas" />
      <CampoSelect nombre="turno" etiqueta="Turno" opciones={TURNOS.map((t) => ({ valor: t, etiqueta: t }))} />
      <CampoTexto nombre="cupo" etiqueta="Cupo" tipo="number" />
      <CampoTexto nombre="reserva" etiqueta="Vacantes reservadas" tipo="number" descripcion="Entre 0 y el cupo" />
      <CampoSwitch nombre="activa" etiqueta="Sección activa" descripcion="Solo las secciones activas reciben matrículas" className="sm:col-span-2" />
    </div>
  );
}

function CamposAula() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto nombre="codigo" etiqueta="Código" placeholder="A-101" />
      <CampoTexto nombre="nombre" etiqueta="Nombre" placeholder="Aula 101" />
      <CampoTexto nombre="capacidad" etiqueta="Capacidad" tipo="number" descripcion="Opcional" />
      <CampoSwitch nombre="activa" etiqueta="Aula activa" />
    </div>
  );
}

function Ocupacion({ f }: { f: FilaSeccion }) {
  const porcentaje = f.cupo > 0 ? Math.min(100, Math.round((f.ocupadas / f.cupo) * 100)) : 0;
  return (
    <div className="grid min-w-28 gap-1">
      <span className="text-sm tabular-nums">
        {f.ocupadas} / {f.cupo}
        <span className="text-xs text-muted-foreground"> · {f.reserva} reserv.</span>
      </span>
      <Progress value={porcentaje} aria-label={`Ocupación ${porcentaje}% al ${formatoFecha(f.fecha_ocupacion)}`} className="h-1.5" />
    </div>
  );
}

export function ClienteSecciones() {
  const recargar = useRecargarListado();
  const [anioId, setAnioId] = useState<string | undefined>();
  const [editando, setEditando] = useState<FilaSeccion | null>(null);
  const [aula, setAula] = useState<FilaAula | 'nueva' | null>(null);
  const grados = useCatalogo('grados');
  const parametros = useMemo(() => ({ anioId }), [anioId]);

  return (
    <>
      <EncabezadoPagina
        titulo="Secciones y aulas"
        descripcion="Secciones por año y grado con su ocupación actual. Cupo, reserva y nombre en mayúsculas los valida la base."
      />
      <Tabs defaultValue="secciones">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="secciones">Secciones</TabsTrigger>
            <TabsTrigger value="grados">Niveles y grados</TabsTrigger>
            <TabsTrigger value="aulas">Aulas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="secciones" className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SelectorAnio valor={anioId} alCambiar={setAnioId} />
            <DialogoFormulario
              titulo="Nueva sección"
              esquema={esquemaSeccion}
              valores={{ anioId: anioId ?? '', gradoId: '', nombre: '', turno: 'Mañana', cupo: 30, reserva: 2, activa: true }}
              ancho="lg"
              mensajeExito="Sección creada"
              alEnviar={async (d) => {
                await api.post(ENDPOINT, d);
                await recargar(ENDPOINT);
              }}
              disparador={
                <Button>
                  <Plus aria-hidden /> Nueva sección
                </Button>
              }
            >
              <CamposSeccion />
            </DialogoFormulario>
          </div>
          <TablaDatos<FilaSeccion>
            endpoint={ENDPOINT}
            parametros={parametros}
            claveFila={(f) => f.id}
            placeholderBusqueda="Buscar sección o turno…"
            filtros={[
              { nombre: 'gradoId', etiqueta: 'Grado', tipo: 'select', opciones: grados.data ?? [] },
              { nombre: 'activa', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ACTIVA },
            ]}
            vacio={<EstadoVacio titulo="Sin secciones" descripcion="Cree las secciones del año para luego aplicarles un plan de estudios." />}
            columnas={[
              {
                clave: 'seccion',
                titulo: 'Sección',
                celda: (f) => (
                  <div>
                    <p className="font-medium">
                      {f.grado.split(' ')[0]} {f.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.nivel} · {f.anio}
                    </p>
                  </div>
                ),
              },
              { clave: 'turno', titulo: 'Turno', ocultarEnMovil: true },
              { clave: 'ocupacion', titulo: 'Ocupación', celda: (f) => <Ocupacion f={f} /> },
              {
                clave: 'plan_vigente',
                titulo: 'Plan',
                ocultarEnMovil: true,
                celda: (f) => (f.plan_vigente ? <Etiqueta tono="info">{`${f.plan_vigente} · ${f.cursos} cursos`}</Etiqueta> : <Etiqueta tono="alerta">Sin plan</Etiqueta>),
              },
              { clave: 'activa', titulo: 'Estado', ocultarEnMovil: true, celda: (f) => <BadgeEstado estado={f.activa ? 'activa' : 'inactiva'} /> },
            ]}
            acciones={(f) => (
              <Button variant="ghost" size="icon-sm" aria-label={`Editar sección ${f.grado} ${f.nombre}`} onClick={() => setEditando(f)}>
                <Pencil aria-hidden />
              </Button>
            )}
          />
        </TabsContent>

        <TabsContent value="grados" className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SelectorAnio valor={anioId} alCambiar={setAnioId} />
            <p className="text-sm text-muted-foreground">Niveles y grados vienen sembrados en la base (solo lectura).</p>
          </div>
          <TablaGrados anioId={anioId} />
        </TabsContent>

        <TabsContent value="aulas" className="grid gap-4">
          <div className="flex justify-end">
            <Button onClick={() => setAula('nueva')}>
              <DoorOpen aria-hidden /> Nueva aula
            </Button>
          </div>
          <TablaDatos<FilaAula>
            endpoint={ENDPOINT_AULAS}
            claveFila={(f) => f.id}
            placeholderBusqueda="Buscar por código o nombre…"
            filtros={[{ nombre: 'activa', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ACTIVA }]}
            vacio={<EstadoVacio titulo="Sin aulas" descripcion="Registre los ambientes para asignarlos en los horarios." />}
            columnas={[
              { clave: 'codigo', titulo: 'Código', celda: (f) => <span className="font-mono">{f.codigo}</span> },
              { clave: 'nombre', titulo: 'Nombre' },
              { clave: 'capacidad', titulo: 'Capacidad', ocultarEnMovil: true, className: 'tabular-nums', celda: (f) => f.capacidad ?? '—' },
              { clave: 'bloques', titulo: 'Bloques vigentes', ocultarEnMovil: true, className: 'tabular-nums' },
              { clave: 'activa', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.activa ? 'activa' : 'inactiva'} /> },
            ]}
            acciones={(f) => (
              <>
                <Button variant="ghost" size="icon-sm" aria-label={`Editar aula ${f.codigo}`} onClick={() => setAula(f)}>
                  <Pencil aria-hidden />
                </Button>
                <Confirmar
                  titulo={`¿Eliminar el aula ${f.codigo}?`}
                  descripcion="Solo es posible si no figura en horarios ni sesiones. Si ya se usó, desactívela."
                  destructivo
                  textoConfirmar="Eliminar"
                  mensajeExito="Aula eliminada"
                  alConfirmar={async () => {
                    await api.delete(`${ENDPOINT_AULAS}/${f.id}`);
                    await recargar(ENDPOINT_AULAS);
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label={`Eliminar aula ${f.codigo}`}>
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
        titulo={`Editar sección ${editando ? `${editando.grado} ${editando.nombre}` : ''}`}
        esquema={esquemaSeccion}
        valores={
          editando
            ? {
                anioId: editando.anio_id,
                gradoId: editando.grado_id,
                nombre: editando.nombre,
                turno: editando.turno,
                cupo: editando.cupo,
                reserva: editando.reserva,
                activa: editando.activa,
              }
            : {}
        }
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        ancho="lg"
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${editando?.id}`, d);
          await recargar(ENDPOINT);
        }}
      >
        <CamposSeccion />
      </DialogoFormulario>
      <DialogoFormulario
        titulo={aula === 'nueva' ? 'Nueva aula' : `Editar aula ${aula?.codigo ?? ''}`}
        esquema={esquemaAula}
        valores={aula && aula !== 'nueva' ? { codigo: aula.codigo, nombre: aula.nombre, capacidad: aula.capacidad, activa: aula.activa } : { codigo: '', nombre: '', capacidad: null, activa: true }}
        abierto={aula !== null}
        alCambiarAbierto={(v) => !v && setAula(null)}
        mensajeExito="Aula guardada"
        alEnviar={async (d) => {
          if (aula === 'nueva') await api.post(ENDPOINT_AULAS, d);
          else if (aula) await api.put(`${ENDPOINT_AULAS}/${aula.id}`, d);
          await recargar(ENDPOINT_AULAS);
        }}
      >
        <CamposAula />
      </DialogoFormulario>
    </>
  );
}

function TablaGrados({ anioId }: { anioId: string | undefined }) {
  const consulta = useQuery({
    queryKey: ['grados-resumen', anioId],
    queryFn: () => api.get<{ grados: FilaGrado[] }>(conConsulta('/api/admin/academico/grados', { anioId })),
  });
  if (consulta.isPending) return <Skeleton className="h-48 w-full" />;
  const grados = consulta.data?.grados ?? [];
  if (grados.length === 0) return <EstadoVacio titulo="Sin grados" />;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nivel</TableHead>
            <TableHead>Grado</TableHead>
            <TableHead className="text-right">Secciones activas</TableHead>
            <TableHead className="text-right">Cupo total</TableHead>
            <TableHead className="text-right">Ocupadas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grados.map((g) => (
            <TableRow key={g.id}>
              <TableCell>{g.nivel}</TableCell>
              <TableCell className="font-medium">{g.numero}.º</TableCell>
              <TableCell className="text-right tabular-nums">{g.secciones}</TableCell>
              <TableCell className="text-right tabular-nums">{g.cupo_total}</TableCell>
              <TableCell className="text-right tabular-nums">{g.ocupadas}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
