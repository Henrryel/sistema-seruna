'use client';
import { useState } from 'react';
import { CopyPlus, Download, Pencil, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoArea, CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Confirmar } from '@/components/formularios/confirmar';
import { useCatalogo } from '@/lib/catalogos';
import { api } from '@/lib/api';
import { formatoFechaHora } from '@/lib/formato';
import { FORMATOS_DOCUMENTO, esquemaPlantilla, type DatosPlantilla, type FilaPlantilla } from '@/esquemas/reportes/plantillas';

const ENDPOINT = '/api/admin/reportes/plantillas';
const OPCIONES_FORMATO = FORMATOS_DOCUMENTO.map((f) => ({ valor: f, etiqueta: f === 'pdf' ? 'PDF' : 'Excel (XLSX)' }));
const EJEMPLO_CONFIG = '{\n  "columnas": ["apellidos", "nombres", {"clave": "saldo", "titulo": "Saldo", "formato": "moneda"}],\n  "horizontal": true\n}';

function aFormData(d: DatosPlantilla, archivo: File | null) {
  const f = new FormData();
  f.set('tipo', d.tipo);
  f.set('anioId', d.anioId);
  f.set('formato', d.formato);
  if (d.version !== undefined) f.set('version', String(d.version));
  f.set('nombre', d.nombre);
  f.set('configuracion', JSON.stringify(d.configuracion ?? {}));
  if (archivo) f.set('archivo', archivo);
  return f;
}

function CamposPlantilla({ archivo, alCambiarArchivo, archivoActual }: { archivo: File | null; alCambiarArchivo: (f: File | null) => void; archivoActual?: string | null }) {
  const tipos = useCatalogo('tipos-reporte');
  const anios = useCatalogo('anios');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect nombre="tipo" etiqueta="Tipo de reporte" opciones={tipos.data ?? []} />
      <CampoSelect nombre="anioId" etiqueta="Año académico" opciones={anios.data ?? []} />
      <CampoSelect nombre="formato" etiqueta="Formato" opciones={OPCIONES_FORMATO} />
      <CampoTexto nombre="version" etiqueta="Versión" tipo="number" descripcion="Vacío: siguiente versión libre" />
      <CampoTexto nombre="nombre" etiqueta="Nombre (título del documento)" className="sm:col-span-2" />
      <CampoArea
        nombre="configuracion"
        etiqueta="Configuración (JSON)"
        filas={6}
        className="font-mono sm:col-span-2"
        placeholder={EJEMPLO_CONFIG}
        descripcion="Opcional: columnas, titulo, subtitulo, horizontal, excluir, incluirIds. Vacío = todas las columnas de los datos."
      />
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="archivo-plantilla">Archivo de la plantilla (opcional)</Label>
        <Input
          id="archivo-plantilla"
          type="file"
          accept="image/png,image/jpeg,application/pdf,.xlsx"
          onChange={(e) => alCambiarArchivo(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          {archivo ? `Seleccionado: ${archivo.name}` : archivoActual ? `Actual: ${archivoActual}` : 'Un logo PNG o JPG se imprime en el encabezado de los PDF.'}
        </p>
      </div>
    </div>
  );
}

export function ClientePlantillas() {
  const recargar = useRecargarListado();
  const tipos = useCatalogo('tipos-reporte');
  const anios = useCatalogo('anios');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [editando, setEditando] = useState<FilaPlantilla | null>(null);
  const anioPorDefecto = anios.data?.[0]?.valor;

  return (
    <>
      <EncabezadoPagina
        titulo="Plantillas de documento"
        descripcion="Versionadas por tipo, año y formato. Al publicarse quedan inmutables: para cambiarlas cree una versión nueva."
        acciones={
          <DialogoFormulario
            titulo="Nueva plantilla"
            esquema={esquemaPlantilla}
            ancho="lg"
            valores={{ tipo: '', anioId: anioPorDefecto ?? '', formato: 'pdf', nombre: '', configuracion: '' }}
            alEnviar={async (d) => {
              await api.post(ENDPOINT, aFormData(d, archivo));
              setArchivo(null);
              await recargar(ENDPOINT);
            }}
            mensajeExito="Plantilla creada como borrador"
            disparador={
              <Button onClick={() => setArchivo(null)}>
                <Plus aria-hidden /> Nueva plantilla
              </Button>
            }
          >
            <CamposPlantilla archivo={archivo} alCambiarArchivo={setArchivo} />
          </DialogoFormulario>
        }
      />
      <TablaDatos<FilaPlantilla>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por nombre o tipo…"
        filtros={[
          { nombre: 'anioId', etiqueta: 'Año', tipo: 'select', opciones: anios.data ?? [] },
          { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: tipos.data ?? [] },
          { nombre: 'formatoDocumento', etiqueta: 'Formato', tipo: 'select', opciones: OPCIONES_FORMATO },
          {
            nombre: 'estado',
            etiqueta: 'Estado',
            tipo: 'select',
            opciones: [
              { valor: 'borrador', etiqueta: 'Borrador' },
              { valor: 'publicada', etiqueta: 'Publicada' },
            ],
          },
        ]}
        columnas={[
          {
            clave: 'nombre',
            titulo: 'Plantilla',
            celda: (f) => (
              <div className="min-w-40">
                <p className="font-medium">{f.nombre}</p>
                <p className="text-xs text-muted-foreground">{f.tipo_nombre}</p>
              </div>
            ),
          },
          { clave: 'anio', titulo: 'Año' },
          { clave: 'formato', titulo: 'Formato', celda: (f) => f.formato.toUpperCase() },
          { clave: 'version', titulo: 'Versión', celda: (f) => `v${f.version}` },
          {
            clave: 'estado',
            titulo: 'Estado',
            celda: (f) => (
              <div className="grid gap-0.5">
                <BadgeEstado estado={f.publicada_en ? 'publicado' : 'borrador'} />
                {f.publicada_en ? <span className="text-xs text-muted-foreground">{formatoFechaHora(f.publicada_en)}</span> : null}
              </div>
            ),
          },
          { clave: 'documentos', titulo: 'Documentos', ocultarEnMovil: true },
          { clave: 'creada_por_login', titulo: 'Creada por', ocultarEnMovil: true, celda: (f) => f.creada_por_login ?? '—' },
        ]}
        acciones={(f) => (
          <>
            {f.archivo_id ? (
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={`${ENDPOINT}/${f.id}/archivo`} aria-label={`Descargar archivo de ${f.nombre}`} download>
                  <Download aria-hidden />
                </a>
              </Button>
            ) : null}
            {f.publicada_en ? (
              <Confirmar
                titulo={`¿Crear la versión ${f.version + 1}?`}
                descripcion="Se copia esta plantilla como un nuevo borrador del mismo tipo, año y formato."
                textoConfirmar="Crear versión"
                mensajeExito="Nueva versión creada"
                alConfirmar={async () => {
                  await api.post(`${ENDPOINT}/${f.id}/version`);
                  await recargar(ENDPOINT);
                }}
                disparador={
                  <Button variant="ghost" size="icon-sm" aria-label={`Nueva versión de ${f.nombre}`}>
                    <CopyPlus aria-hidden />
                  </Button>
                }
              />
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${f.nombre}`}
                  onClick={() => {
                    setArchivo(null);
                    setEditando(f);
                  }}
                >
                  <Pencil aria-hidden />
                </Button>
                <Confirmar
                  titulo={`¿Publicar "${f.nombre}" v${f.version}?`}
                  descripcion="Una vez publicada la plantilla no se puede modificar y queda disponible para solicitar documentos."
                  textoConfirmar="Publicar"
                  mensajeExito="Plantilla publicada"
                  alConfirmar={async () => {
                    await api.post(`${ENDPOINT}/${f.id}/publicar`);
                    await recargar(ENDPOINT);
                  }}
                  disparador={
                    <Button variant="ghost" size="icon-sm" aria-label={`Publicar ${f.nombre}`}>
                      <Send aria-hidden />
                    </Button>
                  }
                />
              </>
            )}
          </>
        )}
      />
      <DialogoFormulario
        titulo={`Editar plantilla v${editando?.version ?? ''}`}
        esquema={esquemaPlantilla}
        ancho="lg"
        abierto={editando !== null}
        alCambiarAbierto={(v) => !v && setEditando(null)}
        valores={
          editando
            ? {
                tipo: editando.tipo,
                anioId: editando.anio_id,
                formato: editando.formato as 'pdf',
                version: editando.version,
                nombre: editando.nombre,
                configuracion: Object.keys(editando.configuracion ?? {}).length ? JSON.stringify(editando.configuracion, null, 2) : '',
              }
            : {}
        }
        alEnviar={async (d) => {
          await api.put(`${ENDPOINT}/${editando?.id}`, aFormData(d, archivo));
          setArchivo(null);
          await recargar(ENDPOINT);
        }}
        mensajeExito="Plantilla actualizada"
      >
        <CamposPlantilla archivo={archivo} alCambiarArchivo={setArchivo} archivoActual={editando?.archivo_nombre} />
      </DialogoFormulario>
    </>
  );
}
