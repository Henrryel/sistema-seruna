'use client';
// Gráficos del panel institucional (Recharts 3). Colores desde las variables --chart-1..5 del tema
// (claro/oscuro), ejes y rejilla discretos, tooltip al pasar el cursor y tabla oculta para lectores de pantalla.
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatoFecha, formatoMes, formatoMoneda } from '@/lib/formato';
import type { DistribucionNivel, PlanillaMes, RecaudacionDia, ResumenAsistencia } from '@/esquemas/dashboard/dashboard';

const EJE = { fontSize: 12, fill: 'var(--muted-foreground)' };
const numero = new Intl.NumberFormat('es-PE');
const monedaCorta = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', notation: 'compact', maximumFractionDigits: 1 });

/** Contenedor accesible: el gráfico es decorativo para lectores de pantalla; la tabla lleva los datos. */
function Figura(props: { titulo: string; alto?: number; tabla: { cabecera: string[]; filas: (string | number)[][] }; children: ReactNode }) {
  return (
    <figure className="m-0">
      <div aria-hidden className="w-full" style={{ height: props.alto ?? 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {props.children as React.ReactElement}
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{props.titulo}</figcaption>
      <table className="sr-only">
        <caption>{props.titulo}</caption>
        <thead>
          <tr>
            {props.tabla.cabecera.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.tabla.filas.map((f, i) => (
            <tr key={i}>
              {f.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function CajaTooltip({ titulo, lineas }: { titulo: string; lineas: { color?: string; nombre: string; valor: string }[] }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{titulo}</p>
      {lineas.map((l) => (
        <p key={l.nombre} className="flex items-center gap-2">
          {l.color ? <span className="inline-block size-2.5 rounded-sm" style={{ background: l.color }} aria-hidden /> : null}
          <span className="text-muted-foreground">{l.nombre}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{l.valor}</span>
        </p>
      ))}
    </div>
  );
}

function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.nombre} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.nombre}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ Asistencia

const SERIES_ASISTENCIA = [
  { clave: 'presentes', nombre: 'Presentes', color: 'var(--chart-2)' },
  { clave: 'tardanzas', nombre: 'Tardanzas', color: 'var(--chart-3)' },
  { clave: 'justificadas', nombre: 'Justificadas', color: 'var(--chart-1)' },
  { clave: 'ausencias', nombre: 'Ausencias', color: 'var(--chart-4)' },
  { clave: 'pendientes', nombre: 'Sin registro', color: 'color-mix(in oklch, var(--muted-foreground) 45%, transparent)' },
] as const;

/** Barras 100 % apiladas: composición de los estados diarios de alumnos y docentes. */
export function GraficoAsistencia({ alumnos, docentes }: { alumnos: ResumenAsistencia; docentes: ResumenAsistencia }) {
  const datos = [
    { grupo: 'Alumnos', ...alumnos },
    { grupo: 'Docentes', ...docentes },
  ];
  const pct = (v: number, total: number) => (total ? `${Math.round((100 * v) / total)} %` : '0 %');
  return (
    <>
      <Figura
        titulo="Asistencia diaria por estado"
        alto={150}
        tabla={{
          cabecera: ['Grupo', 'Esperadas', ...SERIES_ASISTENCIA.map((s) => s.nombre)],
          filas: datos.map((d) => [d.grupo, d.esperadas, ...SERIES_ASISTENCIA.map((s) => d[s.clave])]),
        }}
      >
        <BarChart data={datos} layout="vertical" stackOffset="expand" margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap={18}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" tick={EJE} tickFormatter={(v: number) => `${Math.round(v * 100)} %`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="grupo" tick={EJE} axisLine={false} tickLine={false} width={70} />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as (typeof datos)[number] | undefined;
              if (!active || !d) return null;
              return (
                <CajaTooltip
                  titulo={`${d.grupo} · ${numero.format(d.esperadas)} registro(s)`}
                  lineas={SERIES_ASISTENCIA.map((s) => ({ color: s.color, nombre: s.nombre, valor: `${numero.format(d[s.clave])} (${pct(d[s.clave], d.esperadas)})` }))}
                />
              );
            }}
          />
          {SERIES_ASISTENCIA.map((s) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.nombre} stackId="a" fill={s.color} stroke="var(--card)" strokeWidth={2} isAnimationActive={false} />
          ))}
        </BarChart>
      </Figura>
      <Leyenda items={SERIES_ASISTENCIA.map((s) => ({ nombre: s.nombre, color: s.color }))} />
    </>
  );
}

// ------------------------------------------------------------------ Recaudación

export function GraficoRecaudacion({ datos }: { datos: RecaudacionDia[] }) {
  const serie = datos.map((d) => ({ ...d, monto: Number(d.cobrado) }));
  return (
    <Figura
      titulo="Recaudación aplicada por día"
      tabla={{ cabecera: ['Fecha', 'Cobrado', 'Pagos'], filas: serie.map((d) => [formatoFecha(d.fecha), formatoMoneda(d.monto), d.pagos]) }}
    >
      <AreaChart data={serie} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="relleno-recaudacion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="fecha" tick={EJE} tickFormatter={(v: string) => formatoFecha(v).slice(0, 5)} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={EJE} tickFormatter={(v: number) => monedaCorta.format(v)} axisLine={false} tickLine={false} width={64} />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as (typeof serie)[number] | undefined;
            if (!active || !d) return null;
            return (
              <CajaTooltip
                titulo={formatoFecha(d.fecha)}
                lineas={[
                  { color: 'var(--chart-1)', nombre: 'Cobrado', valor: formatoMoneda(d.monto) },
                  { nombre: 'Pagos', valor: numero.format(d.pagos) },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="monto"
          name="Cobrado"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#relleno-recaudacion)"
          dot={serie.length <= 31 ? { r: 3, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 } : false}
          activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </Figura>
  );
}

// ------------------------------------------------------------------ Niveles de logro

const TEXTO_NIVEL: Record<string, string> = { AD: 'Logro destacado', A: 'Logro esperado', B: 'En proceso', C: 'En inicio' };

export function GraficoNiveles({ datos }: { datos: DistribucionNivel[] }) {
  const total = datos.reduce((s, d) => s + d.cantidad, 0);
  return (
    <Figura
      titulo="Distribución de niveles de logro publicados"
      alto={220}
      tabla={{ cabecera: ['Nivel', 'Descripción', 'Calificaciones'], filas: datos.map((d) => [d.nivel, TEXTO_NIVEL[d.nivel] ?? '', d.cantidad]) }}
    >
      <BarChart data={datos} margin={{ top: 20, right: 8, bottom: 0, left: 4 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="nivel" tick={EJE} axisLine={false} tickLine={false} />
        <YAxis tick={EJE} allowDecimals={false} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as DistribucionNivel | undefined;
            if (!active || !d) return null;
            return (
              <CajaTooltip
                titulo={`${d.nivel} · ${TEXTO_NIVEL[d.nivel] ?? ''}`}
                lineas={[{ color: 'var(--chart-1)', nombre: 'Calificaciones', valor: `${numero.format(d.cantidad)} (${total ? Math.round((100 * d.cantidad) / total) : 0} %)` }]}
              />
            );
          }}
        />
        <Bar dataKey="cantidad" name="Calificaciones" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          <LabelList dataKey="cantidad" position="top" style={{ fontSize: 12, fill: 'var(--foreground)' }} />
        </Bar>
      </BarChart>
    </Figura>
  );
}

// ------------------------------------------------------------------ Planilla

export function GraficoPlanilla({ datos }: { datos: PlanillaMes[] }) {
  const serie = datos.map((d) => ({ mes: d.mes, neto: Number(d.neto), abonado: Number(d.abonado) }));
  const series = [
    { clave: 'neto', nombre: 'Neto liquidado', color: 'var(--chart-1)' },
    { clave: 'abonado', nombre: 'Abonado', color: 'var(--chart-2)' },
  ] as const;
  return (
    <>
      <Figura
        titulo="Planilla docente por mes"
        alto={220}
        tabla={{ cabecera: ['Mes', 'Neto liquidado', 'Abonado'], filas: serie.map((d) => [formatoMes(d.mes), formatoMoneda(d.neto), formatoMoneda(d.abonado)]) }}
      >
        <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={EJE} tickFormatter={(v: string) => formatoMes(v).slice(0, 3)} axisLine={false} tickLine={false} />
          <YAxis tick={EJE} tickFormatter={(v: number) => monedaCorta.format(v)} axisLine={false} tickLine={false} width={64} />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as (typeof serie)[number] | undefined;
              if (!active || !d) return null;
              return <CajaTooltip titulo={formatoMes(d.mes)} lineas={series.map((s) => ({ color: s.color, nombre: s.nombre, valor: formatoMoneda(d[s.clave]) }))} />;
            }}
          />
          {series.map((s) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.nombre} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          ))}
        </BarChart>
      </Figura>
      <Leyenda items={series.map((s) => ({ nombre: s.nombre, color: s.color }))} />
    </>
  );
}
