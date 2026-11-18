'use client';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, CopyPlus, Eye, FileUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { ResumenCriterios } from '@/components/evaluacion/resumen-criterios';
import { SelectorAnio, useAnioSeleccionado } from '@/components/evaluacion/selectores';
import { api, mensajeDeError } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFechaHora } from '@/lib/formato';
import { CRITERIOS_EJEMPLO } from '@/esquemas/evaluacion/criterios';
import { esquemaFormularioRegla, type FilaRegla, type FormularioRegla } from '@/esquemas/evaluacion/reglas';

const ENDPOINT = '/api/admin/evaluacion/reglas';
const JSON_EJEMPLO = JSON.stringify(CRITERIOS_EJEMPLO, null, 2);

function CamposRegla({ bloquearContexto }: { bloquearContexto?: boolean }) {
  const anios = useCatalogo('anios');
  const grados = useCatalogo('grados');
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelect nombre="anioId" etiqueta="Año académico" opciones={anios.data ?? []} deshabilitado={bloquearContexto} />
        <CampoSelect nombre="gradoId" etiqueta="Grado" opciones={grados.data ?? []} deshabilitado={bloquearContexto} />
      </div>
      <CampoTexto nombre="referenciaNormativa" etiqueta="Referencia normativa" placeholder="Ej.: RVM 094-2020-MINEDU, modificada por …" />
      <CampoArea
        nombre="criteriosJson"
        etiqueta="Criterios (JSON)"
        filas={16}
        descripcion="Esquema «seruna/criterios-evaluacion@1» documentado en docs/normativa.md. Verifique los umbrales contra el texto oficial antes de aprobar."
      />
    </div>
  );
}

const aCuerpo = (d: FormularioRegla) => ({
  anioId: d.anioId,
  gradoId: d.gradoId,
  referenciaNormativa: d.referenciaNormativa,
  criterios: JSON.parse(d.criteriosJson) as unknown,
});

export function ClienteReglas() {
  const recargar = useRecargarListado();
  const grados = useCatalogo('grados');
  const { anios, anioId, setAnioId } = useAnioSeleccionado();
  const [viendo, setViendo] = useState<FilaRegla | null>(null);
  const [editando, setEditando] = useState<FilaRegla | null>(null);
  const [versionando, setVersionando] = useState<FilaRegla | null>(null);
  const parametros = useMemo(() => ({ anioId }), [anioId]);

  return (
    <>
      <EncabezadoPagina
        titulo="Reglas de evaluación"
        descripcion="Criterios de promoción, recuperación y permanencia por año y grado. Una regla aprobada es inmutable: para cambiarla registre una nueva versión."
        acciones={
          <DialogoFormulario
            titulo="Nueva regla de evaluación"
            esquema={esquemaFormularioRegla}
            valores={{ anioId: anioId ?? undefined, referenciaNormativa: '', criteriosJson: JSON_EJEMPLO }}
            alEnviar={async (d) => {
              await api.post(ENDPOINT, aCuerpo(d));
              await recargar(ENDPOINT);
            }}
            mensajeExito="Regla registrada en borrador"
            ancho="lg"
            disparador={
              <Button>
                <Plus aria-hidden /> Nueva regla
              </Button>
            }
          >
            <CamposRegla />
          </DialogoFormulario>
        }
      />
      <div className="mb-4 max-w-xs">
        <SelectorAnio anios={anios} anioId={anioId} alCambiar={setAnioId} />
      </div>
      <TablaDatos<FilaRegla>
        endpoint={ENDPOINT}
        parametros={parametros}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar referencia…"
        filtros={[
          { nombre: 'gradoId', etiqueta: 'Grado', tipo: 'select', opciones: grados.data ?? [] },
          { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: [{ valor: 'borrador', etiqueta: 'Borrador' }, { valor: 'aprobada', etiqueta: 'Aprobada' }] },
        ]}
        alSeleccionarFila={setViendo}
        columnas={[
          { clave: 'grado', titulo: 'Grado', celda: (f) => <span className="font-medium">{`${f.grado}.º ${f.nivel}`}</span> },
          { clave: 'version', titulo: 'Versión', celda: (f) => `v${f.version}` },
          { clave: 'referencia_normativa', titulo: 'Referencia', celda: (f) => <span className="line-clamp-2 max-w-md">{f.referencia_normativa}</span>, ocultarEnMovil: true },
          {
            clave: 'aprobado_en',
            titulo: 'Estado',
            celda: (f) => (f.aprobado_en ? <Etiqueta tono="exito">Aprobada {formatoFechaHora(f.aprobado_en)}</Etiqueta> : <Etiqueta tono="alerta">Borrador</Etiqueta>),
          },
          { clave: 'usos', titulo: 'Cierres', ocultarEnMovil: true },
        ]}
        acciones={(f) => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Ver criterios v${f.version}`} onClick={() => setViendo(f)}>
              <Eye aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Nueva versión a partir de esta" onClick={() => setVersionando(f)}>
              <CopyPlus aria-hidden />
            </Button>
            {!f.aprobado_en ? (
              <>
                <Button variant="ghost" size="icon-sm" aria-label="Editar borrador" onClick={() => setEditando(f)}>
                  <Pencil aria-hidden />
                </Button>
                <Confirmar
                  titulo={`¿Aprobar la versión ${f.version}?`}
                  descripcion="Una vez aprobada la regla no se puede modificar ni eliminar. Verifique los criterios contra la norma vigente."
                  textoConfirmar="Aprobar"
                  mensajeExito="Regla aprobada"
                  alConfirmar={async () => {
                    await api.post(`${ENDPOINT}/${f.id}/aprobar`);
                    await recargar(ENDPOINT);
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label="Aprobar regla">
                      <BadgeCheck aria-hidden />
                    </Button>
                  }
                />
                <Confirmar
                  titulo="¿Eliminar el borrador?"
                  destructivo
                  textoConfirmar="Eliminar"
                  mensajeExito="Borrador eliminado"
                  alConfirmar={async () => {
                    await api.delete(`${ENDPOINT}/${f.id}`);
                    await recargar(ENDPOINT);
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label="Eliminar borrador">
                      <Trash2 aria-hidden />
                    </Button>
                  }
                />
              </>
            ) : null}
          </>
        )}
      />

      <DialogoFormulario<FormularioRegla>
        titulo={`Editar regla v${editando?.version ?? ''}`}
        esquema={esquemaFormularioRegla}
        valores={
          editando
            ? { anioId: editando.anio_id, gradoId: editando.grado_id, referenciaNormativa: editando.referencia_normativa, criteriosJson: JSON.stringify(editando.criterios, null, 2) }
            : {}
        }
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        ancho="lg"
        alEnviar={async (d) => {
          const c = aCuerpo(d);
          await api.put(`${ENDPOINT}/${editando?.id}`, { referenciaNormativa: c.referenciaNormativa, criterios: c.criterios });
          await recargar(ENDPOINT);
        }}
      >
        <CamposRegla bloquearContexto />
      </DialogoFormulario>

      <DialogoFormulario<FormularioRegla>
        titulo="Nueva versión de la regla"
        descripcion="Se registra como borrador con el siguiente número de versión del año y grado."
        esquema={esquemaFormularioRegla}
        valores={
          versionando
            ? { anioId: versionando.anio_id, gradoId: versionando.grado_id, referenciaNormativa: versionando.referencia_normativa, criteriosJson: JSON.stringify(versionando.criterios, null, 2) }
            : {}
        }
        abierto={versionando !== null}
        alCambiarAbierto={(v) => !v && setVersionando(null)}
        ancho="lg"
        mensajeExito="Nueva versión registrada"
        alEnviar={async (d) => {
          await api.post(ENDPOINT, aCuerpo(d));
          await recargar(ENDPOINT);
        }}
      >
        <CamposRegla />
      </DialogoFormulario>

      <Dialog open={viendo !== null} onOpenChange={(v) => !v && setViendo(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viendo ? `${viendo.grado}.º ${viendo.nivel} · ${viendo.anio} · v${viendo.version}` : 'Regla'}
            </DialogTitle>
            <DialogDescription>{viendo?.referencia_normativa}</DialogDescription>
          </DialogHeader>
          {viendo ? (
            <div className="grid gap-4">
              <ResumenCriterios criterios={viendo.criterios} />
              <details>
                <summary className="cursor-pointer text-sm font-medium">Ver JSON</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(viendo.criterios, null, 2)}</pre>
              </details>
              <Evidencia regla={viendo} alSubir={() => recargar(ENDPOINT)} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Evidencia({ regla, alSubir }: { regla: FilaRegla; alSubir: () => unknown }) {
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  if (regla.aprobado_en) {
    return <p className="text-sm text-muted-foreground">{regla.evidencia_id ? 'Evidencia adjunta.' : 'Sin evidencia adjunta.'}</p>;
  }
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = archivo.current?.files?.[0];
        if (!f) return toast.error('Seleccione un archivo');
        const datos = new FormData();
        datos.set('archivo', f);
        setSubiendo(true);
        try {
          await api.post(`${ENDPOINT}/${regla.id}/evidencia`, datos);
          toast.success('Evidencia adjunta');
          await alSubir();
        } catch (err) {
          toast.error(mensajeDeError(err));
        } finally {
          setSubiendo(false);
        }
      }}
    >
      <Label htmlFor="evidencia-regla">Evidencia (PDF de la norma o acta){regla.evidencia_id ? ' · ya tiene una; puede reemplazarla' : ''}</Label>
      <div className="flex gap-2">
        <Input id="evidencia-regla" ref={archivo} type="file" accept="application/pdf,image/*" />
        <Button type="submit" variant="outline" disabled={subiendo}>
          <FileUp aria-hidden /> Subir
        </Button>
      </div>
    </form>
  );
}
