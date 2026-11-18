'use client';
import { Etiqueta, type Tono } from '@/components/datos/badges';
import { ETIQUETA_COMPARADOR, ETIQUETA_SITUACION, leerCriterios, type CondicionCriterio, type Situacion } from '@/esquemas/evaluacion/criterios';

export const TONO_SITUACION: Record<Situacion, Tono> = { promovido: 'exito', recuperacion: 'alerta', permanencia: 'peligro' };

export function BadgeSituacion({ situacion }: { situacion: string | null | undefined }) {
  if (!situacion) return <Etiqueta>Sin situación</Etiqueta>;
  const s = situacion as Situacion;
  return <Etiqueta tono={TONO_SITUACION[s] ?? 'neutro'}>{ETIQUETA_SITUACION[s] ?? situacion}</Etiqueta>;
}

function textoCondicion(c: CondicionCriterio) {
  const umbral = c.cantidad !== undefined ? String(c.cantidad) : `${Math.round((c.proporcion ?? 0) * 100)} %`;
  const niveles = c.niveles.join(' o ');
  if (c.ambito === 'competencias') return `${ETIQUETA_COMPARADOR[c.comparador]} ${umbral} de las competencias en ${niveles}`;
  const area = c.umbralArea ? `${ETIQUETA_COMPARADOR[c.umbralArea.comparador]} el ${Math.round(c.umbralArea.proporcion * 100)} % de sus competencias` : '';
  return `${ETIQUETA_COMPARADOR[c.comparador]} ${umbral} áreas con ${area} en ${niveles}`;
}

/** Lectura humana del JSON de criterios (si no cumple el esquema se indica el error). */
export function ResumenCriterios({ criterios }: { criterios: unknown }) {
  const r = leerCriterios(criterios);
  if (!r.ok) return <p className="text-sm text-destructive">Los criterios no cumplen el esquema: {r.error}</p>;
  const c = r.criterios;
  return (
    <div className="grid gap-3 text-sm">
      {c.descripcion ? <p className="text-muted-foreground">{c.descripcion}</p> : null}
      <ol className="grid gap-2">
        {c.reglas.map((regla, i) => (
          <li key={i} className="rounded-md border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{i + 1}.</span>
              <BadgeSituacion situacion={regla.situacion} />
              <span className="font-medium">{regla.descripcion}</span>
            </div>
            <p className="mt-1 text-xs">
              Si se cumple{regla.condiciones.length > 1 ? (regla.combinar === 'todas' ? 'n todas' : ' alguna') : ''}:{' '}
              {regla.condiciones.map(textoCondicion).join(regla.combinar === 'todas' ? ' y ' : ' o ')}.
            </p>
          </li>
        ))}
      </ol>
      <p>
        Si ninguna regla se cumple: <BadgeSituacion situacion={c.situacionPorDefecto} />
      </p>
      <p>
        Pendientes de recuperación: competencias en {c.recuperacion.nivelesPendientes.join(', ')}. Si tras la recuperación persiste:{' '}
        <BadgeSituacion situacion={c.recuperacion.situacionSiPersiste} />
      </p>
      {c.areasExcluidas.length ? <p>Áreas excluidas: {c.areasExcluidas.join(', ')}</p> : null}
    </div>
  );
}
