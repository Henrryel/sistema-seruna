'use client';
import { useState } from 'react';
import { z } from 'zod';
import { BadgeCheck, CalendarX2, FileDown, IdCard, KeyRound, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Etiqueta } from '@/components/datos/badges';
import { EstadoVacio } from '@/components/datos/basicos';
import { DialogoFormulario } from '@/components/formularios/dialogo-formulario';
import { CampoSelect, CampoSwitch, CampoTexto } from '@/components/formularios/campos';
import { SelectorPersona, PERSONA_VACIA } from '@/components/matricula/selector-persona';
import { CampoArchivo } from '@/components/matricula/campos';
import { aFormData, archivoOpcional, ENDPOINTS, urlArchivo } from '@/components/matricula/utilidades';
import { api } from '@/lib/api';
import { formatoFecha, formatoFechaHora, hoyLima } from '@/lib/formato';
import { esquemaAccesos, esquemaTerminarVinculo, esquemaVinculo, type FilaApoderado } from '@/esquemas/matricula/apoderados';
import { esquemaDocumentoIdentidad, etiqueta, opciones, PARENTESCOS, TIPOS_DOCUMENTO_IDENTIDAD } from '@/esquemas/matricula/comunes';

const esquemaVerificacion = z.object({ archivo: archivoOpcional });

type Dialogo = { tipo: 'verificar' | 'accesos' | 'terminar' | 'documento'; vinculo: FilaApoderado } | null;

export function PanelApoderados(props: { estudianteId: string; apoderados: FilaApoderado[]; alCambiar: () => Promise<unknown> }) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const v = dialogo?.vinculo;
  const cerrar = (abierto: boolean) => !abierto && setDialogo(null);
  const base = (id: string) => `${ENDPOINTS.apoderados}/${id}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Apoderados</CardTitle>
          <CardDescription>Los accesos académico y económico al portal de padres solo se otorgan a vínculos verificados.</CardDescription>
        </div>
        <DialogoFormulario
          titulo="Vincular apoderado"
          esquema={esquemaVinculo}
          valores={{ parentesco: 'madre', desde: hoyLima(), hasta: '', persona: PERSONA_VACIA }}
          ancho="lg"
          mensajeExito="Apoderado vinculado"
          alEnviar={async (d) => {
            await api.post(`${ENDPOINTS.estudiantes}/${props.estudianteId}/apoderados`, d);
            await props.alCambiar();
          }}
          disparador={
            <Button size="sm">
              <UserPlus aria-hidden /> Vincular
            </Button>
          }
        >
          <SelectorPersona titulo="Apoderado" />
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoSelect nombre="parentesco" etiqueta="Parentesco" opciones={opciones(PARENTESCOS)} />
            <CampoTexto nombre="desde" etiqueta="Vigente desde" tipo="date" />
            <CampoTexto nombre="hasta" etiqueta="Hasta" tipo="date" descripcion="Vacío = indefinido" />
          </div>
        </DialogoFormulario>
      </CardHeader>
      <CardContent>
        {props.apoderados.length === 0 ? (
          <EstadoVacio titulo="Sin apoderados" descripcion="Vincule al padre, madre o tutor legal." />
        ) : (
          <ul className="grid gap-3">
            {props.apoderados.map((a) => (
              <li key={a.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {a.apellidos}, {a.nombres} <span className="font-normal text-muted-foreground">· {etiqueta(a.parentesco)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.documento ?? 'Sin documento'} · {a.telefono ?? 'sin teléfono'}
                      {a.usuario_login ? ` · usuario ${a.usuario_login}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vigencia: {formatoFecha(a.desde)} – {a.hasta ? formatoFecha(a.hasta) : 'indefinida'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Etiqueta tono={a.vigente ? 'exito' : 'neutro'}>{a.vigente ? 'Vigente' : 'No vigente'}</Etiqueta>
                      {a.verificado_en ? (
                        <Etiqueta tono="info">
                          Verificado {formatoFechaHora(a.verificado_en)}
                          {a.verificado_por ? ` por ${a.verificado_por}` : ''}
                        </Etiqueta>
                      ) : (
                        <Etiqueta tono="alerta">Sin verificar</Etiqueta>
                      )}
                      <Etiqueta tono={a.acceso_academico ? 'exito' : 'neutro'}>Académico: {a.acceso_academico ? 'sí' : 'no'}</Etiqueta>
                      <Etiqueta tono={a.acceso_economico ? 'exito' : 'neutro'}>Económico: {a.acceso_economico ? 'sí' : 'no'}</Etiqueta>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 sm:justify-end">
                    {a.evidencia_id ? (
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={urlArchivo(a.evidencia_id)} aria-label="Descargar evidencia de verificación">
                          <FileDown aria-hidden />
                        </a>
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon-sm" aria-label="Agregar documento de identidad" onClick={() => setDialogo({ tipo: 'documento', vinculo: a })}>
                      <IdCard aria-hidden />
                    </Button>
                    {!a.verificado_en ? (
                      <Button variant="outline" size="sm" onClick={() => setDialogo({ tipo: 'verificar', vinculo: a })}>
                        <BadgeCheck aria-hidden /> Verificar
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => setDialogo({ tipo: 'accesos', vinculo: a })} disabled={!a.vigente}>
                      <KeyRound aria-hidden /> Accesos
                    </Button>
                    {a.vigente ? (
                      <Button variant="outline" size="sm" onClick={() => setDialogo({ tipo: 'terminar', vinculo: a })}>
                        <CalendarX2 aria-hidden /> Terminar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DialogoFormulario
        titulo="Verificar vínculo"
        descripcion={v ? `Confirma que ${v.nombres} ${v.apellidos} es ${etiqueta(v.parentesco).toLowerCase()} del estudiante. Puede adjuntar la evidencia (DNI, partida, resolución).` : undefined}
        esquema={esquemaVerificacion}
        valores={{}}
        abierto={dialogo?.tipo === 'verificar'}
        alCambiarAbierto={cerrar}
        textoEnviar="Verificar"
        mensajeExito="Vínculo verificado"
        alEnviar={async (d) => {
          await api.post(`${base(v?.id ?? '')}/verificar`, aFormData(d));
          await props.alCambiar();
        }}
      >
        <CampoArchivo nombre="archivo" etiqueta="Evidencia (opcional)" />
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Accesos al portal de padres"
        descripcion={v && !v.verificado_en ? 'El vínculo no está verificado: la base no permite otorgar accesos.' : undefined}
        esquema={esquemaAccesos}
        valores={{ accesoAcademico: v?.acceso_academico ?? false, accesoEconomico: v?.acceso_economico ?? false }}
        abierto={dialogo?.tipo === 'accesos'}
        alCambiarAbierto={cerrar}
        ancho="sm"
        mensajeExito="Accesos actualizados"
        alEnviar={async (d) => {
          await api.put(`${base(v?.id ?? '')}/accesos`, d);
          await props.alCambiar();
        }}
      >
        <CampoSwitch nombre="accesoAcademico" etiqueta="Acceso académico" descripcion="Notas, asistencia y horario." />
        <CampoSwitch nombre="accesoEconomico" etiqueta="Acceso económico" descripcion="Cuotas, pagos y recibos." />
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Terminar vínculo"
        descripcion="Se cierra la vigencia en la fecha indicada (inclusive); el historial se conserva."
        esquema={esquemaTerminarVinculo}
        valores={{ fin: hoyLima() }}
        abierto={dialogo?.tipo === 'terminar'}
        alCambiarAbierto={cerrar}
        ancho="sm"
        textoEnviar="Terminar vínculo"
        mensajeExito="Vínculo terminado"
        alEnviar={async (d) => {
          await api.post(`${base(v?.id ?? '')}/terminar`, d);
          await props.alCambiar();
        }}
      >
        <CampoTexto nombre="fin" etiqueta="Último día de vigencia" tipo="date" />
      </DialogoFormulario>

      <DialogoFormulario
        titulo="Documento de identidad del apoderado"
        esquema={esquemaDocumentoIdentidad}
        valores={{ tipo: 'DNI', numero: '', paisEmisor: 'PE' }}
        abierto={dialogo?.tipo === 'documento'}
        alCambiarAbierto={cerrar}
        ancho="sm"
        mensajeExito="Documento agregado"
        alEnviar={async (d) => {
          await api.post(`${base(v?.id ?? '')}/documentos`, d);
          await props.alCambiar();
        }}
      >
        <CampoSelect nombre="tipo" etiqueta="Tipo" opciones={opciones(TIPOS_DOCUMENTO_IDENTIDAD)} />
        <CampoTexto nombre="numero" etiqueta="Número" autoComplete="off" />
        <CampoTexto nombre="paisEmisor" etiqueta="País emisor" descripcion="Código de 2 letras" />
      </DialogoFormulario>
    </Card>
  );
}
