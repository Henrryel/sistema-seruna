'use client';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, UserRound, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CampoSelect, CampoTexto } from '@/components/formularios/campos';
import { Etiqueta } from '@/components/datos/badges';
import { api, conConsulta } from '@/lib/api';
import { opciones, TIPOS_DOCUMENTO_IDENTIDAD, type PersonaEncontrada } from '@/esquemas/matricula/comunes';
import { ENDPOINTS, useDebounce } from './utilidades';

/** Valores iniciales de `persona` (evita mensajes de "Required" en campos no tocados). */
export const PERSONA_VACIA = {
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  correo: '',
  telefono: '',
  direccion: '',
  documentoTipo: 'DNI' as const,
  documentoNumero: '',
  documentoPais: 'PE',
};

/**
 * Elige una persona existente (campo `personaId`) o registra una nueva (`persona.*`) dentro de un
 * formulario con el esquema `conPersona(...)`.
 */
export function SelectorPersona(props: { titulo?: string; avisoEstudiante?: boolean }) {
  const form = useFormContext();
  const [modo, setModo] = useState<'nueva' | 'existente'>('nueva');
  const [seleccionada, setSeleccionada] = useState<PersonaEncontrada | null>(null);
  const [q, setQ] = useState('');
  const qd = useDebounce(q.trim());
  const consulta = useQuery({
    queryKey: ['buscar-personas', qd],
    queryFn: () => api.get<{ personas: PersonaEncontrada[] }>(conConsulta(ENDPOINTS.personas, { q: qd })),
    enabled: modo === 'existente' && qd.length >= 2,
  });
  const errores = form.formState.errors as { persona?: { nombres?: { message?: string } } };
  const errorSeleccion = modo === 'existente' && !seleccionada ? errores.persona?.nombres?.message : undefined;

  const cambiarModo = (v: string) => {
    const nuevo = v === 'existente' ? 'existente' : 'nueva';
    setModo(nuevo);
    if (nuevo === 'nueva') {
      setSeleccionada(null);
      form.setValue('personaId', undefined);
    }
  };

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{props.titulo ?? 'Persona'}</legend>
      <Tabs value={modo} onValueChange={cambiarModo}>
        <TabsList className="w-full">
          <TabsTrigger value="nueva">Registrar nueva</TabsTrigger>
          <TabsTrigger value="existente">Buscar existente</TabsTrigger>
        </TabsList>
        <TabsContent value="nueva" className="grid gap-3 pt-2 sm:grid-cols-2">
          <CampoTexto nombre="persona.apellidos" etiqueta="Apellidos" autoComplete="off" />
          <CampoTexto nombre="persona.nombres" etiqueta="Nombres" autoComplete="off" />
          <CampoSelect nombre="persona.documentoTipo" etiqueta="Tipo de documento" opciones={opciones(TIPOS_DOCUMENTO_IDENTIDAD)} placeholder="Sin documento" />
          <CampoTexto nombre="persona.documentoNumero" etiqueta="N.º de documento" autoComplete="off" />
          <CampoTexto nombre="persona.fechaNacimiento" etiqueta="Fecha de nacimiento" tipo="date" />
          <CampoTexto nombre="persona.documentoPais" etiqueta="País emisor" placeholder="PE" descripcion="Código de 2 letras (PE por defecto)." />
          <CampoTexto nombre="persona.telefono" etiqueta="Teléfono" tipo="tel" autoComplete="off" />
          <CampoTexto nombre="persona.correo" etiqueta="Correo" tipo="email" autoComplete="off" />
          <CampoTexto nombre="persona.direccion" etiqueta="Dirección" className="sm:col-span-2" autoComplete="off" />
        </TabsContent>
        <TabsContent value="existente" className="grid gap-2 pt-2">
          {seleccionada ? (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">
                  {seleccionada.apellidos}, {seleccionada.nombres}
                  {seleccionada.documentos ? <span className="text-muted-foreground"> · {seleccionada.documentos}</span> : null}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Quitar selección"
                onClick={() => {
                  setSeleccionada(null);
                  form.setValue('personaId', undefined);
                }}
              >
                <X aria-hidden />
              </Button>
            </div>
          ) : (
            <>
              <Label htmlFor="buscar-persona">Buscar por apellidos, nombres o N.º de documento</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="buscar-persona" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Mínimo 2 caracteres" aria-invalid={Boolean(errorSeleccion) || undefined} />
                {consulta.isFetching ? <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden /> : null}
              </div>
              {qd.length >= 2 && consulta.data ? (
                <ul className="max-h-56 overflow-y-auto rounded-md border" aria-label="Personas encontradas">
                  {consulta.data.personas.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias: regístrela como nueva.</li> : null}
                  {consulta.data.personas.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        onClick={() => {
                          setSeleccionada(p);
                          form.setValue('personaId', p.id, { shouldValidate: true });
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {p.apellidos}, {p.nombres}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{p.documentos ?? 'Sin documento registrado'}</span>
                        </span>
                        {props.avisoEstudiante && p.estudiante_id ? <Etiqueta tono="alerta">Ya es estudiante</Etiqueta> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          {errorSeleccion ? (
            <p role="alert" className="text-sm text-destructive">
              {errorSeleccion}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </fieldset>
  );
}
