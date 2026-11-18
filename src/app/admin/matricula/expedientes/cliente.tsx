'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { BadgeCheck, FileDown, FileUp, MessageSquareWarning, Replace } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect } from '@/components/formularios/campos';
import { BuscadorEstudiante, CampoArchivo, CampoCatalogo, CampoEstudiante } from '@/components/matricula/campos';
import { ChecklistMatricula } from '@/components/matricula/checklist';
import { aFormData, archivoRequerido, ENDPOINTS, urlArchivo } from '@/components/matricula/utilidades';
import { api, conConsulta } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFechaHora } from '@/lib/formato';
import { esquemaCargaExpediente, esquemaRevision, type FilaDocumentoExpediente } from '@/esquemas/matricula/expedientes';
import { ESTADOS_DOCUMENTO_EXPEDIENTE, etiqueta, opciones } from '@/esquemas/matricula/comunes';
import type { RespuestaListado } from '@/esquemas/comunes';
import type { FilaMatricula } from '@/esquemas/matricula/matriculas';

type Seleccion = { id: string; etiqueta: string } | null;

const esquemaCargaCliente = esquemaCargaExpediente.extend({ archivo: archivoRequerido });
const esquemaReemplazo = z.object({ archivo: archivoRequerido });

function useMatriculasDe(estudianteId: string | undefined) {
  return useQuery({
    queryKey: ['matriculas-de', estudianteId],
    queryFn: () => api.get<RespuestaListado<FilaMatricula>>(conConsulta(ENDPOINTS.matriculas, { estudianteId, porPagina: 50 })),
    enabled: Boolean(estudianteId),
  });
}

/** Matrícula del estudiante elegido en el formulario de carga (opcional). */
function CampoMatriculaDelEstudiante() {
  const { watch, setValue } = useFormContext();
  const estudianteId = (watch('estudianteId') as string | undefined) || undefined;
  const m = useMatriculasDe(estudianteId);
  const anterior = useRef(estudianteId);
  useEffect(() => {
    // Al cambiar de estudiante, la matrícula elegida ya no le corresponde.
    if (anterior.current !== estudianteId) setValue('matriculaId', '');
    anterior.current = estudianteId;
  }, [estudianteId, setValue]);
  return (
    <CampoSelect
      nombre="matriculaId"
      etiqueta="Matrícula"
      placeholder={estudianteId ? 'Documento general (sin matrícula)' : 'Elija primero al estudiante'}
      deshabilitado={!estudianteId}
      opciones={(m.data?.filas ?? []).map((x) => ({ valor: x.id, etiqueta: `${x.anio} · ${x.grado} · ${etiqueta(x.estado)}` }))}
      descripcion="Los documentos sin matrícula (DNI, partida) valen para todos los años."
    />
  );
}

export function ClienteExpedientes(props: { estudianteInicial: Seleccion; matriculaInicial: string | null }) {
  const qc = useQueryClient();
  const recargar = useRecargarListado();
  const [estudiante, setEstudiante] = useState<Seleccion>(props.estudianteInicial);
  const [matriculaId, setMatriculaId] = useState<string | null>(props.matriculaInicial);
  const [revisando, setRevisando] = useState<{ fila: FilaDocumentoExpediente; estado: 'validado' | 'observado' } | null>(null);
  const [reemplazando, setReemplazando] = useState<FilaDocumentoExpediente | null>(null);
  const tipos = useCatalogo('tipos-documento');
  const matriculas = useMatriculasDe(estudiante?.id);

  useEffect(() => {
    const filas = matriculas.data?.filas;
    if (!filas) return;
    if (!matriculaId || !filas.some((f) => f.id === matriculaId)) setMatriculaId(filas[0]?.id ?? null);
  }, [matriculas.data, matriculaId]);

  const parametros = useMemo(() => ({ estudianteId: estudiante?.id }), [estudiante]);
  const refrescar = async () => {
    await recargar(ENDPOINTS.expedientes);
    await qc.invalidateQueries({ queryKey: ['checklist'] });
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Expedientes"
        descripcion="Documentos de los estudiantes: carga, revisión (validar u observar), reemplazo y avance de requisitos de la matrícula."
        acciones={
          <DialogoFormulario
            titulo="Cargar documento"
            esquema={esquemaCargaCliente}
            valores={{ estudianteId: estudiante?.id ?? '', matriculaId: estudiante ? (matriculaId ?? '') : '' }}
            mensajeExito="Documento cargado"
            alEnviar={async (d) => {
              await api.post(ENDPOINTS.expedientes, aFormData(d));
              await refrescar();
            }}
            disparador={
              <Button>
                <FileUp aria-hidden /> Cargar documento
              </Button>
            }
          >
            <CampoEstudiante nombre="estudianteId" etiqueta="Estudiante" inicial={estudiante} />
            <CampoMatriculaDelEstudiante />
            <CampoCatalogo nombre="tipoDocumentoId" etiqueta="Tipo de documento" tipo="tipos-documento" />
            <CampoArchivo nombre="archivo" etiqueta="Archivo" />
          </DialogoFormulario>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Estudiante</CardTitle>
            <CardDescription>Filtre el expediente y vea el avance de requisitos de su matrícula.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <BuscadorEstudiante
              valor={estudiante}
              alCambiar={(v) => {
                setEstudiante(v);
                setMatriculaId(null);
              }}
            />
            {estudiante ? (
              <div className="grid gap-1.5">
                <Label htmlFor="exp-matricula">Matrícula</Label>
                {matriculas.data && matriculas.data.filas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">El estudiante no tiene matrículas.</p>
                ) : (
                  <Select value={matriculaId ?? undefined} onValueChange={setMatriculaId}>
                    <SelectTrigger id="exp-matricula" className="w-full">
                      <SelectValue placeholder={matriculas.isFetching ? 'Cargando…' : 'Seleccione'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(matriculas.data?.filas ?? []).map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.anio} · {x.grado} · {etiqueta(x.estado)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          {estudiante && matriculaId ? (
            <ChecklistMatricula matriculaId={matriculaId} />
          ) : (
            <EstadoVacio titulo="Elija un estudiante" descripcion="Verá los requisitos de la regla de su matrícula frente a los documentos presentados." />
          )}
        </div>
      </div>

      <TablaDatos<FilaDocumentoExpediente>
        key={estudiante?.id ?? 'todos'}
        endpoint={ENDPOINTS.expedientes}
        parametros={parametros}
        claveFila={(f) => f.id}
        placeholderBusqueda="Estudiante, código o documento…"
        filtros={[
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: opciones(ESTADOS_DOCUMENTO_EXPEDIENTE), valor: estudiante ? undefined : 'pendiente' },
          { nombre: 'tipoDocumentoId', etiqueta: 'Documento', tipo: 'select', opciones: tipos.data ?? [] },
        ]}
        vacio={<EstadoVacio titulo="Sin documentos" descripcion="No hay documentos con esos filtros." />}
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
          {
            clave: 'tipo_documento',
            titulo: 'Documento',
            celda: (f) => (
              <span>
                {f.tipo_documento}
                <span className="block text-xs text-muted-foreground">{f.anio ? `Matrícula ${f.anio}` : 'General'}</span>
              </span>
            ),
          },
          { clave: 'cargado_en', titulo: 'Cargado', celda: (f) => formatoFechaHora(f.cargado_en), ocultarEnMovil: true },
          {
            clave: 'estado',
            titulo: 'Estado',
            celda: (f) => (
              <span>
                <BadgeEstado estado={f.estado} />
                {f.observacion ? <span className="block max-w-56 truncate text-xs text-muted-foreground" title={f.observacion}>{f.observacion}</span> : null}
              </span>
            ),
          },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={urlArchivo(f.archivo_id)} aria-label={`Descargar ${f.nombre_archivo}`}>
                <FileDown aria-hidden />
              </a>
            </Button>
            {f.estado !== 'reemplazado' ? (
              <>
                <Button variant="ghost" size="icon-sm" aria-label="Validar documento" onClick={() => setRevisando({ fila: f, estado: 'validado' })} disabled={f.estado === 'validado'}>
                  <BadgeCheck aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Observar documento" onClick={() => setRevisando({ fila: f, estado: 'observado' })}>
                  <MessageSquareWarning aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Reemplazar archivo" onClick={() => setReemplazando(f)}>
                  <Replace aria-hidden />
                </Button>
              </>
            ) : null}
          </>
        )}
      />

      <DialogoFormulario
        titulo={revisando?.estado === 'validado' ? 'Validar documento' : 'Observar documento'}
        descripcion={revisando ? `${revisando.fila.tipo_documento} de ${revisando.fila.apellidos}, ${revisando.fila.nombres}` : undefined}
        esquema={esquemaRevision}
        valores={{ estado: revisando?.estado ?? 'validado', observacion: revisando?.fila.observacion ?? '' }}
        abierto={revisando !== null}
        alCambiarAbierto={(v) => !v && setRevisando(null)}
        textoEnviar={revisando?.estado === 'validado' ? 'Validar' : 'Registrar observación'}
        mensajeExito="Revisión registrada"
        alEnviar={async (d) => {
          await api.put(`${ENDPOINTS.expedientes}/${revisando?.fila.id}`, d);
          await refrescar();
        }}
      >
        <CampoSelect
          nombre="estado"
          etiqueta="Resultado"
          opciones={[
            { valor: 'validado', etiqueta: 'Validado' },
            { valor: 'observado', etiqueta: 'Observado' },
          ]}
        />
        <CampoArea nombre="observacion" etiqueta="Observación" descripcion="Obligatoria si se observa: indique qué debe corregirse." />
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Reemplazar archivo"
        descripcion="El documento actual queda como reemplazado y el nuevo pasa a revisión."
        esquema={esquemaReemplazo}
        valores={{}}
        abierto={reemplazando !== null}
        alCambiarAbierto={(v) => !v && setReemplazando(null)}
        textoEnviar="Reemplazar"
        mensajeExito="Archivo reemplazado"
        alEnviar={async (d) => {
          await api.post(`${ENDPOINTS.expedientes}/${reemplazando?.id}/reemplazar`, aFormData(d));
          await refrescar();
        }}
      >
        <CampoArchivo nombre="archivo" etiqueta="Nuevo archivo" />
      </DialogoFormulario>
    </>
  );
}
