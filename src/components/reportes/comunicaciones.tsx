'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { Paperclip, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { TablaDatos, useRecargarListado } from '@/components/datos/tabla-datos';
import { BadgeEstado } from '@/components/datos/badges';
import { EncabezadoPagina, EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { api, conConsulta } from '@/lib/api';
import { formatoFechaHora, hoyLima } from '@/lib/formato';
import {
  CANALES_COMUNICACION,
  NOMBRE_CANAL,
  NOMBRE_DOCUMENTO_INSTITUCIONAL,
  esquemaComunicacion,
  type DatosComunicacion,
  type FilaComunicacion,
  type OpcionDocumentoInstitucional,
} from '@/esquemas/reportes/comunicaciones';
import { ComboBusqueda } from './combo-busqueda';

const ENDPOINT = '/api/admin/reportes/comunicaciones';
const OPCIONES_CANAL = CANALES_COMUNICACION.map((c) => ({ valor: c, etiqueta: NOMBRE_CANAL[c] ?? c }));

function etiquetaDocumento(d: Pick<OpcionDocumentoInstitucional, 'tipo' | 'anio' | 'version'>) {
  return `${NOMBRE_DOCUMENTO_INSTITUCIONAL[d.tipo] ?? d.tipo} ${d.anio} · v${d.version}`;
}

function ahoraLocal() {
  const ahora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return `${hoyLima()}T${ahora}`;
}

function CamposComunicacion({ documentos, evidencia, alCambiarEvidencia }: { documentos: OpcionDocumentoInstitucional[]; evidencia: File | null; alCambiarEvidencia: (f: File | null) => void }) {
  const { control } = useFormContext<DatosComunicacion>();
  const [etiquetaPersona, setEtiquetaPersona] = useState<string | null>(null);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoSelect
        nombre="documentoId"
        etiqueta="Documento institucional"
        className="sm:col-span-2"
        opciones={documentos.map((d) => ({ valor: d.id, etiqueta: `${etiquetaDocumento(d)}${d.publicado_en ? '' : ' (sin publicar)'}` }))}
      />
      <FormField
        control={control}
        name="destinatarioId"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Destinatario (persona)</FormLabel>
            <FormControl>
              <ComboBusqueda
                valor={field.value}
                etiqueta={etiquetaPersona}
                minimo={2}
                placeholder="Buscar por apellidos, nombres o documento…"
                url={(q) => conConsulta(`${ENDPOINT}/personas`, { q })}
                alCambiar={(o) => {
                  field.onChange(o?.valor);
                  setEtiquetaPersona(o?.etiqueta ?? null);
                }}
              />
            </FormControl>
            <FormDescription>Indique una persona, un alcance o ambos.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <CampoTexto nombre="alcance" etiqueta="Alcance" placeholder="Ej.: Padres de familia de 1.º de secundaria" className="sm:col-span-2" />
      <CampoSelect nombre="canal" etiqueta="Canal" opciones={OPCIONES_CANAL} />
      <FormField
        control={control}
        name="comunicadoEn"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Fecha y hora</FormLabel>
            <FormControl>
              <Input type="datetime-local" {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="evidencia-comunicacion">Evidencia (opcional)</Label>
        <Input id="evidencia-comunicacion" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => alCambiarEvidencia(e.target.files?.[0] ?? null)} />
        <p className="text-xs text-muted-foreground">{evidencia ? `Seleccionado: ${evidencia.name}` : 'Cargo firmado, captura del envío, constancia, etc. (PDF o imagen, máx. 15 MB).'}</p>
      </div>
    </div>
  );
}

export function ClienteComunicaciones() {
  const recargar = useRecargarListado();
  const [evidencia, setEvidencia] = useState<File | null>(null);
  const documentos = useQuery({
    queryKey: ['reportes', 'documentos-institucionales'],
    queryFn: async () => (await api.get<{ documentos: OpcionDocumentoInstitucional[] }>(`${ENDPOINT}/documentos`)).documentos,
  });
  const sinDocumentos = documentos.isSuccess && documentos.data.length === 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Comunicación de documentos"
        descripcion="Registro de la entrega o difusión de reglamentos, contratos y condiciones económicas a personas o grupos."
        acciones={
          <DialogoFormulario
            titulo="Registrar comunicación"
            esquema={esquemaComunicacion}
            ancho="lg"
            valores={{ documentoId: documentos.data?.[0]?.id ?? '', canal: 'presencial', comunicadoEn: ahoraLocal(), alcance: '' }}
            alEnviar={async (d) => {
              const f = new FormData();
              f.set('documentoId', d.documentoId);
              if (d.destinatarioId) f.set('destinatarioId', d.destinatarioId);
              if (d.alcance) f.set('alcance', d.alcance);
              f.set('comunicadoEn', d.comunicadoEn);
              f.set('canal', d.canal);
              if (evidencia) f.set('evidencia', evidencia);
              await api.post(ENDPOINT, f);
              setEvidencia(null);
              await recargar(ENDPOINT);
            }}
            mensajeExito="Comunicación registrada"
            disparador={
              <Button disabled={!documentos.data?.length} onClick={() => setEvidencia(null)}>
                <Plus aria-hidden /> Registrar comunicación
              </Button>
            }
          >
            <CamposComunicacion documentos={documentos.data ?? []} evidencia={evidencia} alCambiarEvidencia={setEvidencia} />
          </DialogoFormulario>
        }
      />
      {sinDocumentos ? (
        <div className="mb-4">
          <EstadoVacio titulo="No hay documentos institucionales" descripcion="Registre primero el reglamento, contrato o condiciones económicas del año." />
        </div>
      ) : null}
      <TablaDatos<FilaComunicacion>
        endpoint={ENDPOINT}
        claveFila={(f) => f.id}
        placeholderBusqueda="Buscar por destinatario o alcance…"
        filtros={[
          { nombre: 'documentoId', etiqueta: 'Documento', tipo: 'select', opciones: (documentos.data ?? []).map((d) => ({ valor: d.id, etiqueta: etiquetaDocumento(d) })) },
          { nombre: 'canal', etiqueta: 'Canal', tipo: 'select', opciones: OPCIONES_CANAL },
        ]}
        columnas={[
          {
            clave: 'documento',
            titulo: 'Documento',
            celda: (f) => <span className="font-medium">{etiquetaDocumento({ tipo: f.documento_tipo, anio: f.anio, version: f.documento_version })}</span>,
          },
          {
            clave: 'destinatario',
            titulo: 'Destinatario / alcance',
            celda: (f) => (
              <div className="grid gap-0.5">
                {f.destinatario ? <span>{f.destinatario}</span> : null}
                {f.alcance ? <span className="text-xs text-muted-foreground">{f.alcance}</span> : null}
              </div>
            ),
          },
          { clave: 'canal', titulo: 'Canal', celda: (f) => <BadgeEstado estado={NOMBRE_CANAL[f.canal] ?? f.canal} /> },
          { clave: 'comunicado_en', titulo: 'Fecha', celda: (f) => formatoFechaHora(f.comunicado_en) },
          { clave: 'registrado_por_login', titulo: 'Registró', ocultarEnMovil: true, celda: (f) => f.registrado_por_login ?? '—' },
        ]}
        acciones={(f) =>
          f.evidencia_id ? (
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={`${ENDPOINT}/${f.id}/evidencia`} aria-label={`Descargar evidencia: ${f.evidencia_nombre ?? 'archivo'}`} download>
                <Paperclip aria-hidden />
              </a>
            </Button>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">Sin evidencia</span>
          )
        }
      />
    </>
  );
}
