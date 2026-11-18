'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { api } from '@/lib/api';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { ESTADOS_ANIO, esquemaAnio, esquemaBimestre, type FilaAnio, type FilaBimestre } from '@/esquemas/academico/anios';

const ENDPOINT = '/api/admin/academico/anios';
const OPCIONES_ESTADO = ESTADOS_ANIO.map((e) => ({ valor: e, etiqueta: e.charAt(0).toUpperCase() + e.slice(1) }));

function CamposAnio() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoTexto nombre="anio" etiqueta="Año" tipo="number" />
      <CampoSelect nombre="estado" etiqueta="Estado" opciones={OPCIONES_ESTADO} />
      <CampoTexto nombre="inicio" etiqueta="Inicio" tipo="date" />
      <CampoTexto nombre="fin" etiqueta="Fin" tipo="date" />
    </div>
  );
}

export function ClienteAnios() {
  const recargar = useRecargarListado();
  const [seleccionado, setSeleccionado] = useState<FilaAnio | null>(null);
  const [editando, setEditando] = useState<FilaAnio | null>(null);
  const anioActual = new Date().getFullYear();

  return (
    <>
      <EncabezadoPagina
        titulo="Años académicos y bimestres"
        descripcion="El año escolar se organiza en 4 bimestres sin solapes (la base lo valida)."
        acciones={
          <DialogoFormulario
            titulo="Nuevo año académico"
            esquema={esquemaAnio}
            valores={{ anio: anioActual + 1, inicio: `${anioActual + 1}-03-01`, fin: `${anioActual + 1}-12-20`, estado: 'borrador' }}
            alEnviar={async (d) => {
              await api.post(ENDPOINT, d);
              await recargar(ENDPOINT);
            }}
            mensajeExito="Año académico creado"
            disparador={
              <Button>
                <Plus aria-hidden /> Nuevo año
              </Button>
            }
          >
            <CamposAnio />
          </DialogoFormulario>
        }
      />
      <TablaDatos<FilaAnio>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por año…"
        filtros={[{ nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: OPCIONES_ESTADO }]}
        alSeleccionarFila={setSeleccionado}
        columnas={[
          { clave: 'anio', titulo: 'Año', celda: (f) => <span className="font-medium">{f.anio}</span> },
          { clave: 'inicio', titulo: 'Inicio', celda: (f) => formatoFecha(f.inicio) },
          { clave: 'fin', titulo: 'Fin', celda: (f) => formatoFecha(f.fin) },
          { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
          { clave: 'bimestres', titulo: 'Bimestres', celda: (f) => `${f.bimestres} / 4`, ocultarEnMovil: true },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Ver bimestres de ${f.anio}`} onClick={() => setSeleccionado(f)}>
              <CalendarRange aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${f.anio}`} onClick={() => setEditando(f)}>
              <Pencil aria-hidden />
            </Button>
          </>
        )}
      />
      <DialogoFormulario
        titulo={`Editar año ${editando?.anio ?? ''}`}
        esquema={esquemaAnio}
        valores={editando ? { anio: editando.anio, inicio: editando.inicio, fin: editando.fin, estado: editando.estado as 'borrador' } : {}}
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${editando?.id}`, d);
          await recargar(ENDPOINT);
        }}
      >
        <CamposAnio />
      </DialogoFormulario>
      {seleccionado ? <PanelBimestres anio={seleccionado} /> : null}
    </>
  );
}

function CamposBimestre() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="numero" etiqueta="Bimestre" opciones={[1, 2, 3, 4].map((n) => ({ valor: String(n), etiqueta: `${n}.º bimestre` }))} />
      <div />
      <CampoTexto nombre="inicio" etiqueta="Inicio" tipo="date" />
      <CampoTexto nombre="fin" etiqueta="Fin" tipo="date" />
      <CampoTexto nombre="registroInicio" etiqueta="Registro de notas desde" tipo="date" descripcion="Opcional" />
      <CampoTexto nombre="registroFin" etiqueta="Registro de notas hasta" tipo="date" descripcion="Opcional" />
    </div>
  );
}

function PanelBimestres({ anio }: { anio: FilaAnio }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const clave = ['bimestres', anio.id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => api.get<{ bimestres: FilaBimestre[] }>(`${ENDPOINT}/${anio.id}/bimestres`) });
  const [editando, setEditando] = useState<FilaBimestre | null>(null);
  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: clave });
    await recargar(ENDPOINT);
  };
  const bimestres = consulta.data?.bimestres ?? [];
  const siguiente = ([1, 2, 3, 4].find((n) => !bimestres.some((b) => b.numero === n)) ?? 1).toString();

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Bimestres {anio.anio}</CardTitle>
          <CardDescription>
            Del {formatoFecha(anio.inicio)} al {formatoFecha(anio.fin)}
          </CardDescription>
        </div>
        {bimestres.length < 4 ? (
          <DialogoFormulario
            titulo="Nuevo bimestre"
            esquema={esquemaBimestre}
            valores={{ numero: Number(siguiente), inicio: anio.inicio, fin: anio.inicio }}
            alEnviar={async (d) => {
              await api.post(`${ENDPOINT}/${anio.id}/bimestres`, d);
              await refrescar();
            }}
            mensajeExito="Bimestre creado"
            disparador={
              <Button size="sm">
                <Plus aria-hidden /> Bimestre
              </Button>
            }
          >
            <CamposBimestre />
          </DialogoFormulario>
        ) : null}
      </CardHeader>
      <CardContent>
        {consulta.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : bimestres.length === 0 ? (
          <EstadoVacio titulo="Sin bimestres" descripcion="Registre los 4 bimestres del año." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bimestre</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="hidden md:table-cell">Registro de notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bimestres.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.numero}.º</TableCell>
                    <TableCell>{formatoFecha(b.inicio)}</TableCell>
                    <TableCell>{formatoFecha(b.fin)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {b.registro_inicio ? `${formatoFechaHora(b.registro_inicio)} – ${formatoFechaHora(b.registro_fin)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar bimestre ${b.numero}`} onClick={() => setEditando(b)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Confirmar
                        titulo={`¿Eliminar el ${b.numero}.º bimestre?`}
                        descripcion="Solo es posible si aún no tiene registros asociados."
                        destructivo
                        textoConfirmar="Eliminar"
                        mensajeExito="Bimestre eliminado"
                        alConfirmar={async () => {
                          await api.delete(`/api/admin/academico/bimestres/${b.id}`);
                          await refrescar();
                        }}
                        disparador={
                          <Button variant="ghost" size="icon-sm" aria-label={`Eliminar bimestre ${b.numero}`}>
                            <Trash2 aria-hidden />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <DialogoFormulario
        titulo={`Editar ${editando?.numero ?? ''}.º bimestre`}
        esquema={esquemaBimestre}
        valores={
          editando
            ? {
                numero: editando.numero,
                inicio: editando.inicio,
                fin: editando.fin,
                registroInicio: editando.registro_inicio?.slice(0, 10) ?? null,
                registroFin: editando.registro_fin?.slice(0, 10) ?? null,
              }
            : {}
        }
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        alEnviar={async (d) => {
          await api.put(`/api/admin/academico/bimestres/${editando?.id}`, d);
          await refrescar();
        }}
      >
        <CamposBimestre />
      </DialogoFormulario>
    </Card>
  );
}
