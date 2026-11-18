'use client';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeNivelLogro, Etiqueta } from '@/components/datos/badges';
import { EstadoVacio } from '@/components/datos/basicos';
import { BadgeSituacion } from '@/components/evaluacion/resumen-criterios';
import { SelectorCampo } from '@/components/evaluacion/selectores';
import { formatoFecha } from '@/lib/formato';
import type { CompetenciaBoleta, RespuestaNotasPortal } from '@/esquemas/evaluacion/notas';

const BIMESTRES = [1, 2, 3, 4];

function Celda({ competencia, numero, publicado }: { competencia: CompetenciaBoleta; numero: number; publicado: boolean }) {
  const l = competencia.bimestres[String(numero)];
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border px-1 py-1.5">
      <span className="text-[11px] text-muted-foreground">{numero}.º bim.</span>
      {l ? l.estado === 'no_desarrollada' ? <Etiqueta>ND</Etiqueta> : <BadgeNivelLogro nivel={l.nivel} /> : <span className="text-xs text-muted-foreground">{publicado ? '—' : 'Pendiente'}</span>}
    </div>
  );
}

/** Logros publicados por bimestre, agrupados por área, con conclusiones descriptivas y situación final. */
export function BoletaLogros(props: { datos: RespuestaNotasPortal; matriculaId: string | null; alCambiarMatricula: (id: string) => void; urlLibreta: string | null }) {
  const { matriculas, boleta } = props.datos;
  if (!matriculas.length || !boleta) return <EstadoVacio titulo="Sin matrícula" descripcion="No hay matrículas registradas para mostrar logros." />;
  const publicados = new Set(boleta.bimestres.map((b) => b.numero));
  const conAnual = boleta.areas.some((a) => a.competencias.some((c) => c.anual));
  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {matriculas.length > 1 ? (
          <SelectorCampo
            className="sm:w-72"
            etiqueta="Año escolar"
            valor={props.matriculaId ?? boleta.matricula.id}
            alCambiar={(v) => v && props.alCambiarMatricula(v)}
            opciones={matriculas.map((m) => ({ valor: m.id, etiqueta: `${m.anio} · ${m.grado}.º ${m.nivel}${m.seccion ? ` ${m.seccion}` : ''}` }))}
          />
        ) : null}
        <div className="text-sm">
          <p className="font-medium">
            {boleta.matricula.estudiante.apellidos}, {boleta.matricula.estudiante.nombres}
          </p>
          <p className="text-muted-foreground">
            {boleta.matricula.anio} · {boleta.matricula.grado}.º de {boleta.matricula.nivel}
            {boleta.matricula.seccion ? ` · Sección ${boleta.matricula.seccion}` : ''}
          </p>
        </div>
        {props.urlLibreta ? (
          <Button variant="outline" className="sm:ml-auto" asChild>
            <a href={props.urlLibreta} download>
              <FileDown aria-hidden /> Descargar libreta (PDF)
            </a>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Bimestres publicados:</span>
        {boleta.bimestres.length ? (
          boleta.bimestres.map((b) => (
            <Etiqueta key={b.numero} tono="info">
              {b.numero}.º · {formatoFecha(b.publicadoEn)}
            </Etiqueta>
          ))
        ) : (
          <span className="text-muted-foreground">ninguno aún</span>
        )}
        {boleta.situacionFinal ? (
          <span className="flex items-center gap-1 sm:ml-auto">
            Situación final: <BadgeSituacion situacion={boleta.situacionFinal.situacion} />
          </span>
        ) : null}
      </div>

      {!boleta.areas.length ? (
        <EstadoVacio titulo="Aún no hay logros publicados" descripcion="Los niveles de logro se muestran cuando la institución publica cada bimestre." />
      ) : (
        boleta.areas.map((a) => (
          <Card key={a.area}>
            <CardHeader>
              <CardTitle className="text-base">{a.area}</CardTitle>
              <CardDescription>{a.competencias.length} competencia(s)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {a.competencias.map((c) => {
                const conclusiones = BIMESTRES.map((n) => ({ n, texto: c.bimestres[String(n)]?.conclusion })).filter((x) => x.texto);
                return (
                  <div key={c.id} className="grid gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                    <p className="font-medium">{c.nombre}</p>
                    <div className={`grid gap-1.5 ${conAnual ? 'grid-cols-5' : 'grid-cols-4'}`}>
                      {BIMESTRES.map((n) => (
                        <Celda key={n} competencia={c} numero={n} publicado={publicados.has(n)} />
                      ))}
                      {conAnual ? (
                        <div className="flex flex-col items-center gap-1 rounded-md border bg-muted/50 px-1 py-1.5">
                          <span className="text-[11px] text-muted-foreground">Final</span>
                          <BadgeNivelLogro nivel={c.anual?.nivel} />
                        </div>
                      ) : null}
                    </div>
                    {conclusiones.length ? (
                      <ul className="grid gap-1 text-sm">
                        {conclusiones.map((x) => (
                          <li key={x.n}>
                            <span className="font-medium">{x.n}.º bimestre:</span> {x.texto}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {c.anual?.requiereRecuperacion ? <Etiqueta tono="alerta">Pendiente de recuperación</Etiqueta> : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
      <p className="text-xs text-muted-foreground">AD: logro destacado · A: logro esperado · B: en proceso · C: en inicio · ND: no desarrollada en el bimestre.</p>
    </div>
  );
}
