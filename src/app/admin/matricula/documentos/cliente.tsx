'use client';
import { useState } from 'react';
import { FileDown, FileUp, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { Etiqueta } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { CampoArchivo, CampoCatalogo } from '@/components/matricula/campos';
import { aFormData, archivoRequerido, ENDPOINTS, urlArchivo } from '@/components/matricula/utilidades';
import { api } from '@/lib/api';
import { useCatalogo } from '@/lib/catalogos';
import { formatoFecha, formatoFechaHora } from '@/lib/formato';
import { esquemaDocumentoInstitucional, esquemaPublicacionDocumento, type FilaDocumentoInstitucional } from '@/esquemas/matricula/documentos';
import { etiqueta, opciones, TIPOS_DOCUMENTO_INSTITUCIONAL } from '@/esquemas/matricula/comunes';

const esquemaCargaCliente = esquemaDocumentoInstitucional.extend({ archivo: archivoRequerido });

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function ClienteDocumentos() {
  const recargar = useRecargarListado();
  const anios = useCatalogo('anios');
  const [publicando, setPublicando] = useState<FilaDocumentoInstitucional | null>(null);
  const refrescar = () => recargar(ENDPOINTS.documentos);

  return (
    <>
      <EncabezadoPagina
        titulo="Documentos institucionales"
        descripcion="Reglamento interno, contrato y condiciones económicas versionados por año. Una versión publicada no se modifica: cargue una nueva."
        acciones={
          <DialogoFormulario
            titulo="Cargar nueva versión"
            descripcion="La versión se asigna correlativa por año y tipo. Solo PDF."
            esquema={esquemaCargaCliente}
            valores={{ anioId: anios.data?.[0]?.valor ?? '', tipo: 'reglamento', vigenteDesde: '' }}
            mensajeExito="Documento cargado"
            alEnviar={async (d) => {
              await api.post(ENDPOINTS.documentos, aFormData(d));
              await refrescar();
            }}
            disparador={
              <Button>
                <FileUp aria-hidden /> Cargar documento
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoCatalogo nombre="anioId" etiqueta="Año académico" tipo="anios" />
              <CampoSelect nombre="tipo" etiqueta="Tipo" opciones={opciones(TIPOS_DOCUMENTO_INSTITUCIONAL)} />
            </div>
            <CampoTexto nombre="vigenteDesde" etiqueta="Vigente desde" tipo="date" descripcion="Opcional ahora; obligatorio para publicar." />
            <CampoArchivo nombre="archivo" etiqueta="Archivo PDF" aceptar="application/pdf" descripcion="PDF, máximo 15 MB." />
          </DialogoFormulario>
        }
      />
      {anios.isPending ? null : (
        <TablaDatos<FilaDocumentoInstitucional>
          endpoint={ENDPOINTS.documentos}
          claveFila={(f) => f.id}
          placeholderBusqueda="Nombre del archivo…"
          filtros={[
            { nombre: 'anioId', etiqueta: 'Año', tipo: 'select', opciones: anios.data ?? [], valor: anios.data?.[0]?.valor },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: opciones(TIPOS_DOCUMENTO_INSTITUCIONAL) },
          ]}
          vacio={<EstadoVacio titulo="Sin documentos" descripcion="Cargue el reglamento, el contrato y las condiciones económicas del año." />}
          columnas={[
            {
              clave: 'documento',
              titulo: 'Documento',
              celda: (f) => (
                <span>
                  <span className="font-medium">
                    {etiqueta(f.tipo)} v{f.version}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {f.anio} · {f.nombre_archivo} · {kb(f.bytes)}
                  </span>
                </span>
              ),
            },
            { clave: 'vigente_desde', titulo: 'Vigente desde', celda: (f) => formatoFecha(f.vigente_desde), ocultarEnMovil: true },
            {
              clave: 'publicado_en',
              titulo: 'Estado',
              celda: (f) =>
                f.publicado_en ? (
                  <Etiqueta tono="exito">Publicado {formatoFechaHora(f.publicado_en)}</Etiqueta>
                ) : (
                  <Etiqueta tono="alerta">Borrador</Etiqueta>
                ),
            },
            { clave: 'aceptaciones', titulo: 'Aceptaciones', className: 'tabular-nums', ocultarEnMovil: true },
          ]}
          acciones={(f) => (
            <>
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={urlArchivo(f.archivo_id)} aria-label={`Descargar ${etiqueta(f.tipo)} versión ${f.version}`}>
                  <FileDown aria-hidden />
                </a>
              </Button>
              {!f.publicado_en ? (
                <Button variant="ghost" size="icon-sm" aria-label={`Publicar ${etiqueta(f.tipo)} versión ${f.version}`} onClick={() => setPublicando(f)}>
                  <Send aria-hidden />
                </Button>
              ) : null}
            </>
          )}
        />
      )}
      <DialogoFormulario
        titulo="Publicar documento"
        descripcion={publicando ? `${etiqueta(publicando.tipo)} v${publicando.version} (${publicando.anio}). Una vez publicado queda disponible para aceptaciones y para los planes de cobro.` : undefined}
        esquema={esquemaPublicacionDocumento}
        valores={{ vigenteDesde: publicando?.vigente_desde ?? '' }}
        abierto={publicando !== null}
        alCambiarAbierto={(v) => !v && setPublicando(null)}
        ancho="sm"
        textoEnviar="Publicar"
        mensajeExito="Documento publicado"
        alEnviar={async (d) => {
          await api.post(`${ENDPOINTS.documentos}/${publicando?.id}/publicar`, d);
          await refrescar();
        }}
      >
        <CampoTexto nombre="vigenteDesde" etiqueta="Vigente desde" tipo="date" />
      </DialogoFormulario>
    </>
  );
}
