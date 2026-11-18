'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { RegistroAlumnos } from '@/components/asistencia/registro-alumnos';
import { ListaSesiones } from '@/components/asistencia/lista-sesiones';
import { api, conConsulta } from '@/lib/api';
import { hoyLima } from '@/lib/formato';
import type { FilaSesion } from '@/esquemas/asistencia/registro';

export function ClienteAsistenciaDocente() {
  const [fecha, setFecha] = useState(hoyLima());
  const [seccionId, setSeccionId] = useState('');
  const [sesionId, setSesionId] = useState('');
  const secciones = useQuery({
    queryKey: ['docente-secciones', fecha],
    queryFn: () => api.get<{ secciones: { id: string; etiqueta: string }[] }>(conConsulta('/api/docente/asistencia/secciones', { fecha })),
    enabled: Boolean(fecha),
  });
  const sesiones = useQuery({
    queryKey: ['docente-sesiones', fecha],
    queryFn: () => api.get<{ sesiones: FilaSesion[] }>(conConsulta('/api/docente/asistencia/sesiones', { fecha })),
    enabled: Boolean(fecha),
  });
  const lista = secciones.data?.secciones ?? [];
  const seccionActual = lista.some((s) => s.id === seccionId) ? seccionId : (lista[0]?.id ?? '');

  return (
    <>
      <EncabezadoPagina titulo="Asistencia de mis secciones" descripcion="Registre o corrija la asistencia diaria de sus secciones o la de sus sesiones de clase." />
      <div className="mb-4 grid max-w-xs gap-1.5">
        <Label htmlFor="fecha-asistencia">Fecha</Label>
        <Input
          id="fecha-asistencia"
          type="date"
          value={fecha}
          max={hoyLima()}
          onChange={(e) => {
            setFecha(e.target.value);
            setSesionId('');
          }}
        />
      </div>
      <Tabs defaultValue="seccion">
        <TabsList>
          <TabsTrigger value="seccion">Diaria por sección</TabsTrigger>
          <TabsTrigger value="sesion">Por sesión de clase</TabsTrigger>
        </TabsList>
        <TabsContent value="seccion" className="grid gap-4">
          {secciones.isPending ? (
            <Skeleton className="h-9 w-64" />
          ) : lista.length === 0 ? (
            <EstadoVacio titulo="Sin secciones asignadas" descripcion="No tiene cursos asignados vigentes en esa fecha." />
          ) : (
            <>
              <div className="grid max-w-sm gap-1.5">
                <Label>Sección</Label>
                <Select value={seccionActual} onValueChange={setSeccionId}>
                  <SelectTrigger aria-label="Sección" className="w-full">
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    {lista.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {seccionActual ? (
                <RegistroAlumnos key={`${seccionActual}-${fecha}`} modo="diaria" endpoint="/api/docente/asistencia/diaria" parametros={{ seccionId: seccionActual, fecha }} />
              ) : null}
            </>
          )}
        </TabsContent>
        <TabsContent value="sesion" className="grid gap-4">
          <ListaSesiones sesiones={sesiones.data?.sesiones} cargando={sesiones.isPending} seleccionada={sesionId} alSeleccionar={setSesionId} />
          {sesionId ? <RegistroAlumnos key={sesionId} modo="sesion" endpoint={`/api/docente/asistencia/sesiones/${sesionId}`} /> : null}
        </TabsContent>
      </Tabs>
    </>
  );
}
