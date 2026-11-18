'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado, Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { api } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import { ENTIDADES_IMPORTACION, ESTADOS_LOTE, NOMBRE_ENTIDAD, type FilaArchivoHistorico, type FilaLote } from '@/esquemas/importacion/lotes';
import { CargaArchivos } from './carga-archivos';
import { DetalleLotePanel } from './detalle-lote';
import { VisorDatos, VistaPreviaDatos } from './visor-datos';

const BASE = '/api/admin/reportes/importacion';
const NOMBRE_ESTADO: Record<string, string> = { carga: 'Carga', revision: 'Revisión', cerrado: 'Cerrado' };

function Lotes() {
  const recargar = useRecargarListado();
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Ciclo: carga → revisión (sellado contra el manifiesto) → conciliación fila por fila → cerrado.</p>
        <CargaArchivos
          modo="nuevo"
          alTerminar={async (id) => {
            await recargar(BASE);
            setSeleccionado(id);
          }}
        />
      </div>
      <TablaDatos<FilaLote>
        endpoint={BASE}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por sistema…"
        alSeleccionarFila={(f) => setSeleccionado(f.id)}
        filtros={[{ nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ESTADOS_LOTE.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO[e] ?? e })) }]}
        columnas={[
          { clave: 'id', titulo: 'Lote', celda: (f) => <span className="tabular-nums">{f.id}</span> },
          { clave: 'sistema', titulo: 'Sistema', celda: (f) => <span className="font-medium">{f.sistema}</span> },
          { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado === 'revision' ? 'revisión' : f.estado} /> },
          { clave: 'cargadas', titulo: 'Filas', celda: (f) => <span className="tabular-nums">{f.cargadas}</span> },
          {
            clave: 'pendientes',
            titulo: 'Pendientes',
            celda: (f) => (f.pendientes ? <Etiqueta tono="alerta">{f.pendientes}</Etiqueta> : <span className="tabular-nums">0</span>),
          },
          { clave: 'creado_en', titulo: 'Creado', ocultarEnMovil: true, celda: (f) => formatoFechaHora(f.creado_en) },
        ]}
        acciones={(f) => (
          <Button variant={seleccionado === f.id ? 'secondary' : 'ghost'} size="sm" onClick={() => setSeleccionado(f.id)} aria-pressed={seleccionado === f.id}>
            Abrir
          </Button>
        )}
      />
      {seleccionado ? <DetalleLotePanel key={seleccionado} loteId={seleccionado} alCambiar={() => recargar(BASE)} /> : null}
    </>
  );
}

function ArchivoHistorico() {
  const sistemas = useQuery({
    queryKey: ['importacion', 'sistemas'],
    queryFn: async () => (await api.get<{ sistemas: string[] }>(`${BASE}/sistemas`)).sistemas,
  });
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Filas del sistema anterior conservadas como histórico (acción «archivar»), con el sustento de su conciliación.</p>
      <TablaDatos<FilaArchivoHistorico>
        endpoint={`${BASE}/archivo`}
        claveFila={(f) => `${f.lote_id}|${f.entidad}|${f.clave_origen}`}
        placeholderBusqueda="Buscar por clave o contenido…"
        filtros={[
          { nombre: 'sistema', etiqueta: 'Sistema', tipo: 'select', opciones: (sistemas.data ?? []).map((s) => ({ valor: s, etiqueta: s })) },
          { nombre: 'entidad', etiqueta: 'Entidad', tipo: 'select', opciones: ENTIDADES_IMPORTACION.map((e) => ({ valor: e, etiqueta: NOMBRE_ENTIDAD[e] ?? e })) },
        ]}
        columnas={[
          {
            clave: 'origen',
            titulo: 'Origen',
            celda: (f) => (
              <div className="text-xs">
                <p className="font-medium">{f.sistema}</p>
                <p className="text-muted-foreground">Lote {f.lote_id}</p>
              </div>
            ),
          },
          { clave: 'entidad', titulo: 'Entidad', celda: (f) => NOMBRE_ENTIDAD[f.entidad] ?? f.entidad },
          { clave: 'clave_origen', titulo: 'Clave', celda: (f) => <span className="font-mono text-xs">{f.clave_origen}</span> },
          { clave: 'datos', titulo: 'Datos', ocultarEnMovil: true, celda: (f) => <VistaPreviaDatos datos={f.datos} /> },
          { clave: 'motivo', titulo: 'Sustento', ocultarEnMovil: true, celda: (f) => <span className="text-xs">{f.motivo}</span> },
          { clave: 'revisada_en', titulo: 'Revisada', ocultarEnMovil: true, celda: (f) => formatoFechaHora(f.revisada_en) },
        ]}
        acciones={(f) => (
          <VisorDatos titulo={`${NOMBRE_ENTIDAD[f.entidad] ?? f.entidad} · ${f.clave_origen}`} descripcion={`${f.sistema} · lote ${f.lote_id} · ${f.motivo}`} datos={f.datos} />
        )}
      />
    </>
  );
}

export function ClienteImportacion() {
  return (
    <>
      <EncabezadoPagina
        titulo="Importación histórica"
        descripcion="Lotes de datos de sistemas anteriores: la base verifica el manifiesto, rechaza credenciales y registra cada decisión de conciliación."
      />
      <Tabs defaultValue="lotes">
        <TabsList>
          <TabsTrigger value="lotes">Lotes</TabsTrigger>
          <TabsTrigger value="archivo">Archivo histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="lotes" className="mt-4">
          <Lotes />
        </TabsContent>
        <TabsContent value="archivo" className="mt-4">
          <ArchivoHistorico />
        </TabsContent>
      </Tabs>
    </>
  );
}
