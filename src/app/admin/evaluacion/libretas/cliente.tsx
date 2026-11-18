'use client';
import { useMemo, useState } from 'react';
import { FileDown, Files } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablaDatos } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { BadgeSituacion } from '@/components/evaluacion/resumen-criterios';
import { SelectorAnio, SelectorSeccion, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { conConsulta } from '@/lib/api';
import type { FilaLibreta } from '@/esquemas/evaluacion/notas';

const ENDPOINT = '/api/admin/evaluacion/libretas';

export function ClienteLibretas() {
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [seccionId, setSeccionId] = useState<string | null>(null);
  const parametros = useMemo(() => ({ anioId, seccionId }), [anioId, seccionId]);
  return (
    <>
      <EncabezadoPagina
        titulo="Libretas de notas"
        descripcion="Informe de progreso por estudiante con los bimestres publicados, conclusiones descriptivas y situación final. Cada emisión queda auditada."
        acciones={
          seccionId ? (
            <Button variant="outline" asChild>
              <a href={conConsulta(`${ENDPOINT}/seccion`, { seccionId })} download>
                <Files aria-hidden /> Libretas de la sección (PDF)
              </a>
            </Button>
          ) : null
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <SelectorAnio
          anios={anios}
          anioId={anioId}
          alCambiar={(v) => {
            setAnioId(v);
            setSeccionId(null);
          }}
        />
        <SelectorSeccion anioId={anioId} valor={seccionId} alCambiar={setSeccionId} />
      </div>
      {seccionId ? (
        <TablaDatos<FilaLibreta>
          endpoint={ENDPOINT}
          parametros={parametros}
          claveFila={(f) => f.matricula_id}
          placeholderBusqueda="Buscar estudiante o código…"
          columnas={[
            { clave: 'codigo', titulo: 'Código', ocultarEnMovil: true },
            { clave: 'alumno', titulo: 'Estudiante', celda: (f) => <span className="font-medium">{f.alumno}</span> },
            { clave: 'estado', titulo: 'Matrícula', celda: (f) => <BadgeEstado estado={f.estado} />, ocultarEnMovil: true },
            { clave: 'bimestres_publicados', titulo: 'Bimestres', celda: (f) => `${f.bimestres_publicados} / 4` },
            { clave: 'situacion', titulo: 'Situación final', celda: (f) => (f.situacion ? <BadgeSituacion situacion={f.situacion} /> : '—'), ocultarEnMovil: true },
          ]}
          acciones={(f) => (
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={`${ENDPOINT}/${f.matricula_id}`} download aria-label={`Descargar libreta de ${f.alumno}`}>
                <FileDown aria-hidden />
              </a>
            </Button>
          )}
        />
      ) : (
        <EstadoVacio titulo="Seleccione una sección" descripcion="Elija el año y la sección para listar las libretas." />
      )}
    </>
  );
}
