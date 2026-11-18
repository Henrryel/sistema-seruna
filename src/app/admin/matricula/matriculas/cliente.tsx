'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardPlus, Eye, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoSolicitud } from '@/components/matricula/dialogo-solicitud';
import { ENDPOINTS } from '@/components/matricula/utilidades';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { ESTADOS_MATRICULA, etiqueta, opciones, TIPOS_INGRESO } from '@/esquemas/matricula/comunes';
import type { FilaMatricula, FilaNomina } from '@/esquemas/matricula/matriculas';

const TODOS = '__todos__';

export function ClienteMatriculas() {
  const router = useRouter();
  const recargar = useRecargarListado();
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  const opcionesAnio = anios.data ?? [];
  const opcionesGrado = grados.data ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Matrículas"
        descripcion="Solicitud, confirmación con sección, cambios de sección, retiros, traslados, reincorporaciones y anulaciones."
        acciones={
          <DialogoSolicitud
            disparador={
              <Button>
                <ClipboardPlus aria-hidden /> Nueva solicitud
              </Button>
            }
            alSolicitar={async (r) => {
              await recargar(ENDPOINTS.matriculas);
              router.push(`/admin/matricula/matriculas/${r.id}`);
            }}
          />
        }
      />
      <Tabs defaultValue="matriculas" className="gap-4">
        <TabsList>
          <TabsTrigger value="matriculas">Matrículas</TabsTrigger>
          <TabsTrigger value="nomina">Nómina por sección</TabsTrigger>
        </TabsList>
        <TabsContent value="matriculas">
          {anios.isPending ? null : (
            <TablaDatos<FilaMatricula>
              endpoint={ENDPOINTS.matriculas}
              claveFila={(f) => f.id}
              placeholderBusqueda="Estudiante o código…"
              filtros={[
                { nombre: 'anioId', etiqueta: 'Año', tipo: 'select', opciones: opcionesAnio, valor: opcionesAnio[0]?.valor },
                { nombre: 'gradoId', etiqueta: 'Grado', tipo: 'select', opciones: opcionesGrado },
                { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: opciones(ESTADOS_MATRICULA) },
                { nombre: 'tipoIngreso', etiqueta: 'Ingreso', tipo: 'select', opciones: opciones(TIPOS_INGRESO) },
              ]}
              alSeleccionarFila={(f) => router.push(`/admin/matricula/matriculas/${f.id}`)}
              vacio={<EstadoVacio titulo="Sin matrículas" descripcion="Registre una solicitud o ajuste los filtros." />}
              columnas={[
                {
                  clave: 'estudiante',
                  titulo: 'Estudiante',
                  celda: (f) => (
                    <span>
                      <span className="font-medium">
                        {f.apellidos}, {f.nombres}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">{f.codigo}</span>
                    </span>
                  ),
                },
                { clave: 'anio', titulo: 'Año', ocultarEnMovil: true },
                { clave: 'grado', titulo: 'Grado', celda: (f) => `${f.grado}${f.seccion ? ` "${f.seccion}"` : ''}` },
                { clave: 'tipo_ingreso', titulo: 'Ingreso', celda: (f) => etiqueta(f.tipo_ingreso), ocultarEnMovil: true },
                { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} /> },
                { clave: 'solicitada_en', titulo: 'Solicitada', celda: (f) => formatoFechaHora(f.solicitada_en), ocultarEnMovil: true },
              ]}
              acciones={(f) => (
                <>
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={`${ENDPOINTS.matriculas}/${f.id}/ficha`} download aria-label={`Ficha de matrícula de ${f.apellidos}, ${f.nombres}`}>
                      <FileDown aria-hidden />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link href={`/admin/matricula/matriculas/${f.id}`} aria-label={`Gestionar matrícula de ${f.apellidos}, ${f.nombres}`}>
                      <Eye aria-hidden />
                    </Link>
                  </Button>
                </>
              )}
            />
          )}
        </TabsContent>
        <TabsContent value="nomina">
          {anios.isPending ? null : <Nomina anios={opcionesAnio} grados={opcionesGrado} />}
        </TabsContent>
      </Tabs>
    </>
  );
}

function Nomina(props: { anios: { valor: string; etiqueta: string }[]; grados: { valor: string; etiqueta: string }[] }) {
  const [anioId, setAnioId] = useState(props.anios[0]?.valor ?? '');
  const [gradoId, setGradoId] = useState('');
  const [fecha, setFecha] = useState('');
  const secciones = useCatalogo('secciones', { anioId, gradoId: gradoId || undefined }, Boolean(anioId));
  const parametros = useMemo(() => ({ anioId, gradoId: gradoId || undefined, fecha: fecha || undefined }), [anioId, gradoId, fecha]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="nomina-anio">Año académico</Label>
          <Select value={anioId || undefined} onValueChange={setAnioId}>
            <SelectTrigger id="nomina-anio" className="w-full">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {props.anios.map((a) => (
                <SelectItem key={a.valor} value={a.valor}>
                  {a.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nomina-grado">Grado</Label>
          <Select value={gradoId || TODOS} onValueChange={(v) => setGradoId(v === TODOS ? '' : v)}>
            <SelectTrigger id="nomina-grado" className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los grados</SelectItem>
              {props.grados.map((g) => (
                <SelectItem key={g.valor} value={g.valor}>
                  {g.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nomina-fecha">Ubicación al (opcional)</Label>
          <Input id="nomina-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Sin fecha se muestra la última sección de cada matrícula. Los estados retirada/trasladada conservan su última sección con la fecha de salida.
        </p>
      </div>
      {!anioId ? (
        <EstadoVacio titulo="Seleccione un año académico" />
      ) : (
        <TablaDatos<FilaNomina>
          key={`${anioId}-${gradoId}`}
          endpoint={ENDPOINTS.nomina}
          parametros={parametros}
          claveFila={(f) => f.matricula_id}
          porPagina={50}
          placeholderBusqueda="Apellidos, código o SIAGIE…"
          filtros={[
            { nombre: 'seccionId', etiqueta: 'Sección', tipo: 'select', opciones: secciones.data ?? [] },
            { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: opciones(ESTADOS_MATRICULA), valor: 'activa' },
          ]}
          vacio={<EstadoVacio titulo="Nómina vacía" descripcion="No hay matrículas con esos filtros." />}
          columnas={[
            { clave: 'numero', titulo: 'N.º', className: 'w-10 tabular-nums' },
            {
              clave: 'estudiante',
              titulo: 'Estudiante',
              celda: (f) => (
                <span>
                  <span className="font-medium">
                    {f.apellidos}, {f.nombres}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {f.codigo}
                    {f.codigo_siagie ? ` · SIAGIE ${f.codigo_siagie}` : ''}
                  </span>
                </span>
              ),
            },
            { clave: 'grado', titulo: 'Grado', celda: (f) => `${f.grado}.º ${f.nivel}` },
            { clave: 'seccion', titulo: 'Sección', celda: (f) => f.seccion ?? '—' },
            { clave: 'estado', titulo: 'Estado', celda: (f) => <BadgeEstado estado={f.estado} />, ocultarEnMovil: true },
            {
              clave: 'vigencia',
              titulo: 'Vigencia',
              ocultarEnMovil: true,
              celda: (f) => (f.desde ? `${formatoFecha(f.desde)} – ${formatoFecha(f.hasta)}` : '—'),
            },
          ]}
        />
      )}
    </div>
  );
}
