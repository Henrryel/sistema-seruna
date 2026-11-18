'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import {
  esquemaArea,
  esquemaAsignatura,
  esquemaCapacidad,
  esquemaCompetencia,
  type FilaArea,
  type FilaAsignatura,
  type FilaCapacidad,
  type FilaCompetencia,
} from '@/esquemas/academico/curriculo';
import { SIN_SELECCION } from '@/esquemas/academico/seleccion';

const BASE = '/api/admin/academico';
const SI_NO = (si: string, no: string) => [
  { valor: 'true', etiqueta: si },
  { valor: 'false', etiqueta: no },
];

function useOpcionesArea(conNinguna: boolean) {
  const areas = useCatalogo('areas');
  const opciones = areas.data ?? [];
  return conNinguna ? [{ valor: SIN_SELECCION, etiqueta: 'Sin área' }, ...opciones] : opciones;
}

function BotonEliminar(props: { titulo: string; descripcion?: string; url: string; alTerminar: () => Promise<unknown>; etiqueta: string }) {
  return (
    <Confirmar
      titulo={props.titulo}
      descripcion={props.descripcion ?? 'Solo es posible si no tiene registros relacionados.'}
      destructivo
      textoConfirmar="Eliminar"
      mensajeExito="Eliminado"
      alConfirmar={async () => {
        await api.delete(props.url);
        await props.alTerminar();
      }}
      disparador={
        <Button variant="ghost" size="icon-sm" aria-label={props.etiqueta}>
          <Trash2 aria-hidden />
        </Button>
      }
    />
  );
}

export function ClienteCurriculo() {
  return (
    <>
      <EncabezadoPagina
        titulo="Currículo"
        descripcion="Áreas curriculares, asignaturas o talleres y competencias versionadas del CNEB con sus capacidades."
      />
      <Tabs defaultValue="competencias">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="competencias">Competencias</TabsTrigger>
            <TabsTrigger value="asignaturas">Asignaturas</TabsTrigger>
            <TabsTrigger value="areas">Áreas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="competencias">
          <PestanaCompetencias />
        </TabsContent>
        <TabsContent value="asignaturas">
          <PestanaAsignaturas />
        </TabsContent>
        <TabsContent value="areas">
          <PestanaAreas />
        </TabsContent>
      </Tabs>
    </>
  );
}

function PestanaAreas() {
  const recargar = useRecargarListado();
  const qc = useQueryClient();
  const endpoint = `${BASE}/areas`;
  const [editando, setEditando] = useState<FilaArea | 'nueva' | null>(null);
  const refrescar = async () => {
    await Promise.all([recargar(endpoint), qc.invalidateQueries({ queryKey: ['catalogo', 'areas'] })]);
  };
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando('nueva')}>
          <Plus aria-hidden /> Nueva área
        </Button>
      </div>
      <TablaDatos<FilaArea>
        endpoint={endpoint}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar área…"
        vacio={<EstadoVacio titulo="Sin áreas" descripcion="Registre las áreas curriculares (Matemática, Comunicación, …)." />}
        columnas={[
          { clave: 'codigo', titulo: 'Código', celda: (f) => <span className="font-mono">{f.codigo}</span> },
          { clave: 'nombre', titulo: 'Nombre', className: 'font-medium' },
          { clave: 'asignaturas', titulo: 'Asignaturas', ocultarEnMovil: true, className: 'tabular-nums' },
          { clave: 'competencias', titulo: 'Competencias', ocultarEnMovil: true, className: 'tabular-nums' },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.nombre}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
            <BotonEliminar titulo={`¿Eliminar el área ${f.nombre}?`} url={`${endpoint}/${f.id}`} alTerminar={refrescar} etiqueta={`Eliminar ${f.nombre}`} />
          </>
        )}
      />
      <DialogoFormulario
        titulo={editando === 'nueva' ? 'Nueva área curricular' : 'Editar área curricular'}
        esquema={esquemaArea}
        valores={editando && editando !== 'nueva' ? { codigo: editando.codigo, nombre: editando.nombre } : { codigo: '', nombre: '' }}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        mensajeExito="Área guardada"
        alEnviar={async (d) => {
          if (editando === 'nueva') await api.post(endpoint, d);
          else if (editando) await api.put(`${endpoint}/${editando.id}`, d);
          await refrescar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <CampoTexto nombre="codigo" etiqueta="Código" placeholder="MAT" />
          <CampoTexto nombre="nombre" etiqueta="Nombre" placeholder="Matemática" />
        </div>
      </DialogoFormulario>
    </div>
  );
}

function PestanaAsignaturas() {
  const recargar = useRecargarListado();
  const qc = useQueryClient();
  const endpoint = `${BASE}/asignaturas`;
  const areas = useOpcionesArea(false);
  const areasConNinguna = useOpcionesArea(true);
  const [editando, setEditando] = useState<FilaAsignatura | 'nueva' | null>(null);
  const refrescar = async () => {
    await Promise.all([recargar(endpoint), qc.invalidateQueries({ queryKey: ['catalogo', 'asignaturas'] })]);
  };
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando('nueva')}>
          <Plus aria-hidden /> Nueva asignatura
        </Button>
      </div>
      <TablaDatos<FilaAsignatura>
        endpoint={endpoint}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar asignatura…"
        filtros={[
          { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas },
          { nombre: 'esTaller', etiqueta: 'Tipo', tipo: 'select', opciones: SI_NO('Talleres', 'Cursos') },
        ]}
        vacio={<EstadoVacio titulo="Sin asignaturas" descripcion="Registre los cursos y talleres que se dictan." />}
        columnas={[
          { clave: 'codigo', titulo: 'Código', celda: (f) => <span className="font-mono">{f.codigo}</span> },
          {
            clave: 'nombre',
            titulo: 'Nombre',
            celda: (f) => (
              <span className="font-medium">
                {f.nombre} {f.es_taller ? <Etiqueta tono="info">Taller</Etiqueta> : null}
              </span>
            ),
          },
          { clave: 'area', titulo: 'Área', ocultarEnMovil: true, celda: (f) => f.area ?? '—' },
          { clave: 'planes', titulo: 'Planes', ocultarEnMovil: true, className: 'tabular-nums' },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.nombre}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
            <BotonEliminar titulo={`¿Eliminar ${f.nombre}?`} url={`${endpoint}/${f.id}`} alTerminar={refrescar} etiqueta={`Eliminar ${f.nombre}`} />
          </>
        )}
      />
      <DialogoFormulario
        titulo={editando === 'nueva' ? 'Nueva asignatura' : 'Editar asignatura'}
        esquema={esquemaAsignatura}
        valores={
          editando && editando !== 'nueva'
            ? { codigo: editando.codigo, nombre: editando.nombre, areaId: editando.area_id ?? SIN_SELECCION, esTaller: editando.es_taller }
            : { codigo: '', nombre: '', areaId: SIN_SELECCION, esTaller: false }
        }
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        mensajeExito="Asignatura guardada"
        alEnviar={async (d) => {
          if (editando === 'nueva') await api.post(endpoint, d);
          else if (editando) await api.put(`${endpoint}/${editando.id}`, d);
          await refrescar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="codigo" etiqueta="Código" placeholder="MAT-ALG" />
          <CampoTexto nombre="nombre" etiqueta="Nombre" placeholder="Álgebra" />
          <CampoSelect nombre="areaId" etiqueta="Área curricular" opciones={areasConNinguna} />
          <CampoSwitch nombre="esTaller" etiqueta="Es taller" />
        </div>
      </DialogoFormulario>
    </div>
  );
}

function PestanaCompetencias() {
  const recargar = useRecargarListado();
  const qc = useQueryClient();
  const endpoint = `${BASE}/competencias`;
  const areas = useOpcionesArea(false);
  const areasConNinguna = useOpcionesArea(true);
  const [editando, setEditando] = useState<FilaCompetencia | 'nueva' | null>(null);
  const [capacidadesDe, setCapacidadesDe] = useState<FilaCompetencia | null>(null);
  const refrescar = async () => {
    await Promise.all([recargar(endpoint), qc.invalidateQueries({ queryKey: ['catalogo', 'competencias'] })]);
  };
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditando('nueva')}>
          <Plus aria-hidden /> Nueva competencia
        </Button>
      </div>
      <TablaDatos<FilaCompetencia>
        endpoint={endpoint}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por código o nombre…"
        filtros={[
          { nombre: 'areaId', etiqueta: 'Área', tipo: 'select', opciones: areas },
          { nombre: 'reportable', etiqueta: 'SIAGIE', tipo: 'select', opciones: SI_NO('Reportables', 'No reportables') },
        ]}
        alSeleccionarFila={setCapacidadesDe}
        vacio={<EstadoVacio titulo="Sin competencias" descripcion="Registre las competencias del CNEB (código y versión)." />}
        columnas={[
          {
            clave: 'codigo',
            titulo: 'Código',
            celda: (f) => (
              <span className="font-mono whitespace-nowrap">
                {f.codigo} <span className="text-xs text-muted-foreground">v{f.version}</span>
              </span>
            ),
          },
          { clave: 'nombre', titulo: 'Competencia', celda: (f) => <span className="line-clamp-2">{f.nombre}</span> },
          { clave: 'area', titulo: 'Área', ocultarEnMovil: true, celda: (f) => f.area ?? '—' },
          {
            clave: 'reportable_siagie',
            titulo: 'SIAGIE',
            ocultarEnMovil: true,
            celda: (f) => (f.reportable_siagie ? <Etiqueta tono="exito">Reporta</Etiqueta> : <Etiqueta>No reporta</Etiqueta>),
          },
          { clave: 'capacidades', titulo: 'Capacidades', ocultarEnMovil: true, className: 'tabular-nums' },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Capacidades de ${f.codigo}`} onClick={() => setCapacidadesDe(f)}>
              <ListTree aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.codigo}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
            <BotonEliminar titulo={`¿Eliminar la competencia ${f.codigo} v${f.version}?`} url={`${endpoint}/${f.id}`} alTerminar={refrescar} etiqueta={`Eliminar ${f.codigo}`} />
          </>
        )}
      />
      <DialogoFormulario
        titulo={editando === 'nueva' ? 'Nueva competencia' : 'Editar competencia'}
        descripcion="Para cambiar una competencia ya usada en evaluaciones, registre una nueva versión."
        esquema={esquemaCompetencia}
        valores={
          editando && editando !== 'nueva'
            ? { codigo: editando.codigo, nombre: editando.nombre, version: editando.version, reportableSiagie: editando.reportable_siagie, areaId: editando.area_id ?? SIN_SELECCION }
            : { codigo: '', nombre: '', version: 1, reportableSiagie: true, areaId: SIN_SELECCION }
        }
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        ancho="lg"
        mensajeExito="Competencia guardada"
        alEnviar={async (d) => {
          if (editando === 'nueva') await api.post(endpoint, d);
          else if (editando) await api.put(`${endpoint}/${editando.id}`, d);
          await refrescar();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto nombre="codigo" etiqueta="Código" placeholder="C23" />
          <CampoTexto nombre="version" etiqueta="Versión" tipo="number" />
          <CampoArea nombre="nombre" etiqueta="Nombre" className="sm:col-span-2" />
          <CampoSelect nombre="areaId" etiqueta="Área curricular" opciones={areasConNinguna} />
          <CampoSwitch nombre="reportableSiagie" etiqueta="Reportable al SIAGIE" />
        </div>
      </DialogoFormulario>
      <Sheet open={capacidadesDe !== null} onOpenChange={(v) => !v && setCapacidadesDe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {capacidadesDe ? <PanelCapacidades competencia={capacidadesDe} alCambiar={() => recargar(endpoint)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PanelCapacidades({ competencia, alCambiar }: { competencia: FilaCompetencia; alCambiar: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const clave = ['capacidades', competencia.id];
  const consulta = useQuery({
    queryKey: clave,
    queryFn: () => api.get<{ capacidades: FilaCapacidad[] }>(`${BASE}/competencias/${competencia.id}/capacidades`),
  });
  const [editando, setEditando] = useState<FilaCapacidad | 'nueva' | null>(null);
  const refrescar = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: clave }), alCambiar()]);
  };
  const capacidades = consulta.data?.capacidades ?? [];
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          Capacidades de {competencia.codigo} v{competencia.version}
        </SheetTitle>
        <SheetDescription>{competencia.nombre}</SheetDescription>
      </SheetHeader>
      <div className="grid gap-3 px-4 pb-6">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditando('nueva')}>
            <Plus aria-hidden /> Capacidad
          </Button>
        </div>
        {consulta.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : capacidades.length === 0 ? (
          <EstadoVacio titulo="Sin capacidades" descripcion="Registre las capacidades que componen esta competencia." />
        ) : (
          <ul className="grid gap-2">
            {capacidades.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-mono text-xs text-muted-foreground">{c.codigo}</p>
                  <p>{c.nombre}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Editar capacidad ${c.codigo}`} onClick={() => setEditando(c)}>
                    <Pencil aria-hidden />
                  </Button>
                  <BotonEliminar titulo={`¿Eliminar la capacidad ${c.codigo}?`} url={`${BASE}/capacidades/${c.id}`} alTerminar={refrescar} etiqueta={`Eliminar capacidad ${c.codigo}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DialogoFormulario
        titulo={editando === 'nueva' ? 'Nueva capacidad' : 'Editar capacidad'}
        esquema={esquemaCapacidad}
        valores={editando && editando !== 'nueva' ? { codigo: editando.codigo, nombre: editando.nombre } : { codigo: '', nombre: '' }}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        mensajeExito="Capacidad guardada"
        alEnviar={async (d) => {
          if (editando === 'nueva') await api.post(`${BASE}/competencias/${competencia.id}/capacidades`, d);
          else if (editando) await api.put(`${BASE}/capacidades/${editando.id}`, d);
          await refrescar();
        }}
      >
        <CampoTexto nombre="codigo" etiqueta="Código" placeholder="C23.1" />
        <CampoArea nombre="nombre" etiqueta="Nombre" />
      </DialogoFormulario>
    </>
  );
}
