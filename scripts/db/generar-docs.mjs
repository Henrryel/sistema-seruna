#!/usr/bin/env node
// Genera la documentación de docs/db a partir del catálogo REAL de la base (scripts/db/catalogo.sql).
// Uso: node scripts/db/generar-docs.mjs <catalogo.json> [carpeta_salida=docs/db]
// Archivos generados (no editar a mano): dominios/*.md, funciones.md, triggers-y-vistas.md, permisos.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOMINIOS, TABLAS, FUNCIONES, VISTAS, REFERENCIAS_OMITIDAS_EN_ER, FUNCIONES_REVOCADAS_EN_DUMP,
} from './anotaciones.mjs';
import { clasificar, erroresDe, HTTP } from './clasificacion.mjs';

const [, , rutaCatalogo, salida = 'docs/db'] = process.argv;
if (!rutaCatalogo) {
  console.error('Uso: node scripts/db/generar-docs.mjs <catalogo.json> [docs/db]');
  process.exit(1);
}

const cat = JSON.parse(readFileSync(rutaCatalogo, 'utf8').replace(/^﻿/, ''));
const tablas = new Map(cat.tablas.map((t) => [t.nombre, t]));
const vistas = new Map(cat.vistas.map((v) => [v.nombre, v]));
const funciones = cat.funciones;
const AVISO = '<!-- Archivo generado por scripts/db/generar-docs.mjs a partir del catálogo real. No editar a mano. -->';

// ---------- Cobertura de anotaciones ----------
const problemas = [];
const dominioDeTabla = new Map();
for (const d of DOMINIOS) {
  for (const t of d.tablas) {
    if (dominioDeTabla.has(t)) problemas.push(`Tabla ${t} asignada a dos dominios`);
    dominioDeTabla.set(t, d);
    if (!tablas.has(t)) problemas.push(`Tabla ${t} anotada pero no existe en la base`);
  }
  for (const g of d.diagramas ?? []) {
    for (const t of g.tablas) if (!d.tablas.includes(t)) problemas.push(`Diagrama "${g.titulo}" usa ${t} fuera de su dominio`);
  }
}
for (const t of tablas.keys()) {
  if (!dominioDeTabla.has(t)) problemas.push(`Tabla ${t} sin dominio en anotaciones.mjs`);
  if (!TABLAS[t]) problemas.push(`Tabla ${t} sin descripción en anotaciones.mjs`);
}
for (const f of funciones) if (!FUNCIONES[f.nombre]) problemas.push(`Función ${f.nombre} sin anotación`);
for (const v of vistas.keys()) if (!VISTAS[v]) problemas.push(`Vista ${v} sin anotación`);
if (problemas.length) {
  console.error('Anotaciones incompletas:\n - ' + problemas.join('\n - '));
  process.exit(1);
}

// ---------- Utilidades ----------
const celda = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const codigo = (s) => '`' + String(s).replace(/`/g, "'") + '`';
const sinCasts = (s) => s.replace(/::(text|bigint|integer|numeric|bpchar|time without time zone)\b/g, '');
const tipoCorto = (t) => t.replace('timestamp with time zone', 'timestamptz').replace('time without time zone', 'time');
const tipoMermaid = (t) => {
  const base = tipoCorto(t).replace(/\(.*\)/, '').trim();
  return ({ character: 'char', 'character varying': 'varchar' })[base] ?? base.replace(/\W+/g, '_');
};
const mismoConjunto = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const VOLATILIDAD = { v: 'VOLATILE', s: 'STABLE', i: 'IMMUTABLE' };

function analizar(t) {
  const r = { pk: [], uniq: [], fks: [], checks: [], excl: [] };
  for (const k of t.restricciones) {
    const cols = (k.def.match(/^(?:PRIMARY KEY|UNIQUE|FOREIGN KEY) \(([^)]*)\)/) || [])[1]?.split(', ');
    if (k.tipo === 'p') r.pk = cols;
    else if (k.tipo === 'u') r.uniq.push({ nombre: k.nombre, cols });
    else if (k.tipo === 'c') r.checks.push(k);
    else if (k.tipo === 'x') r.excl.push(k);
    else if (k.tipo === 'f') {
      const m = k.def.match(/^FOREIGN KEY \(([^)]*)\) REFERENCES (?:\w+\.)?(\w+)\(([^)]*)\)(.*)$/);
      r.fks.push({ nombre: k.nombre, cols: m[1].split(', '), ref: m[2], refCols: m[3].split(', '), extra: m[4].trim() });
    }
  }
  return r;
}

function parsearTrigger(def) {
  const m = def.match(/^CREATE (?:CONSTRAINT )?TRIGGER (\w+) (BEFORE|AFTER|INSTEAD OF) (.+?) ON (\S+) FOR EACH (ROW|STATEMENT)(?: WHEN \((.*)\))? EXECUTE FUNCTION (?:\w+\.)?(\w+)\(\)$/);
  if (!m) throw new Error('Trigger no reconocido: ' + def);
  return { nombre: m[1], momento: m[2], eventos: m[3], nivel: m[5], cuando: m[6] ?? '', funcion: m[7] };
}

const todosLosTriggers = cat.tablas.flatMap((t) => t.triggers.map((g) => ({ tabla: t.nombre, ...parsearTrigger(g.def) })));
const nombresRelaciones = [...tablas.keys(), ...vistas.keys()].sort((a, b) => b.length - a.length);

// ---------- Errores de las funciones (clasificación compartida con generar-errores.mjs) ----------
function relacionesEn(cuerpo) {
  const escribe = new Set();
  for (const m of cuerpo.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/gi)) {
    if (tablas.has(m[1])) escribe.add(m[1]);
  }
  const lee = new Set();
  for (const n of nombresRelaciones) {
    if (!escribe.has(n) && new RegExp(`\\b${n}\\b`).test(cuerpo)) lee.add(n);
  }
  return { escribe: [...escribe].sort(), lee: [...lee].sort() };
}

// enDominios: el enlace se escribe desde docs/db/dominios/*.md (rutas relativas distintas).
const linkTabla = (n, enDominios = false) => {
  if (vistas.has(n)) return `[${codigo(n)}](${enDominios ? '../' : ''}triggers-y-vistas.md#vista-${n})`;
  const d = dominioDeTabla.get(n);
  return d ? `[${codigo(n)}](${enDominios ? '' : 'dominios/'}${d.slug}.md#${n})` : codigo(n);
};

// ---------- Dominios: ER + diccionario ----------
function mermaid(nombres) {
  const set = new Set(nombres);
  const out = ['erDiagram'];
  for (const n of nombres) {
    const t = tablas.get(n);
    const a = analizar(t);
    out.push(`  ${n} {`);
    for (const c of t.columnas) {
      const claves = [];
      if (a.pk.includes(c.nombre)) claves.push('PK');
      if (a.fks.some((f) => f.cols.includes(c.nombre))) claves.push('FK');
      if (a.uniq.some((u) => u.cols.length === 1 && u.cols[0] === c.nombre)) claves.push('UK');
      out.push(`    ${tipoMermaid(c.tipo)} ${c.nombre}${claves.length ? ' ' + claves.join(', ') : ''}`);
    }
    out.push('  }');
  }
  for (const n of nombres) {
    const t = tablas.get(n);
    const a = analizar(t);
    for (const f of a.fks) {
      if (REFERENCIAS_OMITIDAS_EN_ER.includes(f.ref) && !set.has(f.ref)) continue;
      const obligatoria = f.cols.every((c) => !t.columnas.find((x) => x.nombre === c).nulo);
      const unica = mismoConjunto(a.pk, f.cols) || a.uniq.some((u) => mismoConjunto(u.cols, f.cols));
      out.push(`  ${f.ref} ${obligatoria ? '||' : '|o'}--${unica ? 'o|' : 'o{'} ${n} : "${f.cols.join(', ')}"`);
    }
  }
  return out.join('\n');
}

function diccionarioTabla(n) {
  const t = tablas.get(n);
  const a = analizar(t);
  const o = [`### ${n}`, '', TABLAS[n]];
  if (Number(t.filas) > 0) o.push('', `Filas sembradas en el dump: **${t.filas}**.`);
  o.push('', '| Columna | Tipo | Nulo | Defecto / generada | Clave / referencia |', '|---|---|---|---|---|');
  for (const c of t.columnas) {
    let defecto = '';
    if (c.identidad) defecto = c.identidad === 'a' ? 'identity (always)' : 'identity';
    else if (c.generada) defecto = `generada: ${codigo(sinCasts(c.defecto))}`;
    else if (c.defecto) defecto = codigo(sinCasts(c.defecto));
    const claves = new Set();
    if (a.pk.includes(c.nombre)) claves.add('PK');
    for (const f of a.fks.filter((x) => x.cols.includes(c.nombre))) {
      claves.add(f.cols.length === 1 ? `→ ${linkTabla(f.ref, true)}.${f.refCols[0]}` : `→ ${linkTabla(f.ref, true)} (FK compuesta)`);
    }
    if (a.uniq.some((u) => u.cols.length === 1 && u.cols[0] === c.nombre)) claves.add('UNIQUE');
    o.push(`| ${codigo(c.nombre)} | ${celda(tipoCorto(c.tipo))} | ${c.nulo ? 'sí' : 'no'} | ${celda(defecto)} | ${celda([...claves].join(' · '))} |`);
  }
  const r = [];
  if (a.pk.length) r.push(`- **PK** (${a.pk.join(', ')})`);
  for (const u of a.uniq) r.push(`- **UNIQUE** (${u.cols.join(', ')}) — ${codigo(u.nombre)}`);
  for (const f of a.fks.filter((x) => x.cols.length > 1 || x.extra)) {
    r.push(`- **FK** (${f.cols.join(', ')}) → ${linkTabla(f.ref, true)} (${f.refCols.join(', ')})${f.extra ? ' ' + f.extra : ''}`);
  }
  for (const k of a.checks) r.push(`- **CHECK** ${codigo(k.nombre)}: ${codigo(sinCasts(k.def.replace(/^CHECK /, '')))}`);
  for (const k of a.excl) r.push(`- **EXCLUDE** ${codigo(k.nombre)}: ${codigo(sinCasts(k.def.replace(/^EXCLUDE /, '')))}`);
  if (r.length) o.push('', '**Restricciones**', '', ...r);
  if (t.indices.length) {
    o.push('', '**Índices adicionales**', '');
    for (const i of t.indices) o.push(`- ${codigo(i.nombre)}: ${codigo(sinCasts(i.def.replace(/^CREATE (UNIQUE )?INDEX \w+ ON \S+ /, '$1')))}`);
  }
  const tg = todosLosTriggers.filter((x) => x.tabla === n);
  if (tg.length) {
    o.push('', '**Triggers**', '');
    for (const x of tg) {
      o.push(`- ${codigo(x.nombre)} — ${x.momento} ${x.eventos}${x.cuando ? ` WHEN ${codigo(x.cuando)}` : ''} → [${codigo(x.funcion + '()')}](../funciones.md#${x.funcion})`);
    }
  }
  return o.join('\n');
}

mkdirSync(join(salida, 'dominios'), { recursive: true });
for (const d of DOMINIOS) {
  const o = [AVISO, '', `# ${d.titulo}`, '', `Tablas (${d.tablas.length}): ${d.tablas.map((t) => `[${codigo(t)}](#${t})`).join(', ')}.`, ''];
  o.push('## Diagrama ER', '');
  o.push(`> Para legibilidad se omiten las referencias de auditoría/evidencia hacia ${REFERENCIAS_OMITIDAS_EN_ER.map(codigo).join(' y ')} cuando esas tablas no pertenecen al diagrama; sí figuran en el diccionario.`);
  for (const g of d.diagramas ?? [{ titulo: null, tablas: d.tablas }]) {
    if (g.titulo) o.push('', `### ${g.titulo}`);
    o.push('', '```mermaid', mermaid(g.tablas), '```');
  }
  o.push('', '## Diccionario', '');
  for (const t of d.tablas) o.push(diccionarioTabla(t), '');
  writeFileSync(join(salida, 'dominios', `${d.slug}.md`), o.join('\n'));
}

// ---------- Funciones ----------
const catalogoErrores = new Map();
{
  const o = [AVISO, '', '# Catálogo de funciones (43)', ''];
  o.push('Todas las excepciones de negocio usan `RAISE EXCEPTION` **sin `ERRCODE`**, es decir SQLSTATE `P0001` (`raise_exception`). La app debe traducirlas por el texto del mensaje (ver [catálogo de mensajes](#catalogo-de-mensajes-de-error)). `SELECT ... INTO STRICT` lanza `P0002` (`no_data_found`) cuando el registro no existe.', '');
  o.push('Ninguna función es `SECURITY DEFINER`: se ejecutan con los privilegios del rol que llama (el rol de la app necesita privilegios sobre todas las tablas que tocan).', '');
  o.push(`En el dump original se revoca \`EXECUTE\` a \`PUBLIC\` en: ${FUNCIONES_REVOCADAS_EN_DUMP.map(codigo).join(', ')}. Al restaurar con \`--no-privileges\` ese REVOKE se pierde.`, '');
  o.push('## Índice', '', '| Función | Tipo | Dominio | Usada por |', '|---|---|---|---|');
  const orden = [...funciones].sort((a, b) => (FUNCIONES[a.nombre].dominio + a.nombre).localeCompare(FUNCIONES[b.nombre].dominio + b.nombre));
  for (const f of orden) {
    const usos = todosLosTriggers.filter((x) => x.funcion === f.nombre).map((x) => `${x.tabla}.${x.nombre}`);
    const tipo = f.retorno === 'trigger' ? 'trigger' : 'invocable';
    o.push(`| [${codigo(f.nombre)}](#${f.nombre}) | ${tipo} | ${FUNCIONES[f.nombre].dominio} | ${celda(usos.join(', ') || 'app / otras funciones')} |`);
  }
  o.push('');
  for (const f of orden) {
    const usos = todosLosTriggers.filter((x) => x.funcion === f.nombre);
    const llamadores = funciones.filter((g) => g.nombre !== f.nombre && new RegExp(`\\b${f.nombre}\\s*\\(`).test(g.cuerpo)).map((g) => g.nombre);
    const { escribe, lee } = relacionesEn(f.cuerpo);
    const errores = erroresDe(f.cuerpo);
    o.push(`## ${f.nombre}`, '');
    o.push('```sql', `${f.nombre}(${f.args}) RETURNS ${f.retorno}`, '```', '');
    o.push(`- **Tipo:** ${f.retorno === 'trigger' ? 'función de trigger' : 'invocable desde la app'} · **Lenguaje:** ${f.lenguaje} · **Volatilidad:** ${VOLATILIDAD[f.volatilidad]}${f.config ? ` · **Config:** ${codigo(f.config.join(', '))}` : ' · **search_path:** no fijado'}`);
    if (FUNCIONES_REVOCADAS_EN_DUMP.includes(f.nombre)) o.push('- **Privilegios en el dump:** `REVOKE ALL ... FROM PUBLIC` (no aplicado por `--no-privileges`).');
    o.push(`- **Propósito:** ${FUNCIONES[f.nombre].proposito}`);
    if (usos.length) o.push(`- **Triggers:** ${usos.map((x) => `${codigo(x.tabla)}.${codigo(x.nombre)} (${x.momento} ${x.eventos})`).join('; ')}`);
    if (llamadores.length) o.push(`- **Invocada por:** ${llamadores.map((x) => `[${codigo(x)}](#${x})`).join(', ')}`);
    if (escribe.length) o.push(`- **Escribe o bloquea:** ${escribe.map((n) => linkTabla(n)).join(', ')}`);
    if (lee.length) o.push(`- **Lee:** ${lee.map((n) => linkTabla(n)).join(', ')}`);
    if (/INTO STRICT/i.test(f.cuerpo)) o.push('- **`INTO STRICT`:** lanza `P0002` si el registro buscado no existe (→ NotFound).');
    if (errores.length) {
      o.push('- **Errores (`P0001`):**');
      for (const e of errores) {
        const tipo = clasificar(e);
        o.push(`  - ${codigo(e)} → ${tipo} (${HTTP[tipo]})`);
        if (!catalogoErrores.has(e)) catalogoErrores.set(e, { tipo, funciones: [] });
        catalogoErrores.get(e).funciones.push(f.nombre);
      }
    } else if (f.retorno === 'trigger' || errores.length === 0) {
      o.push('- **Errores:** no lanza excepciones propias.');
    }
    o.push('');
  }
  o.push('<a id="catalogo-de-mensajes-de-error"></a>', '## Catálogo de mensajes de error', '');
  o.push(`${catalogoErrores.size} mensajes distintos. La columna "Dominio" es una **propuesta inicial** de traducción a errores tipados (Validation 422, Conflict 409, Forbidden 403, NotFound 404) que se fija en la Fase 1.`, '');
  o.push('| Mensaje | Dominio | HTTP | Funciones |', '|---|---|---|---|');
  for (const [msg, v] of [...catalogoErrores].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
    o.push(`| ${celda(msg)} | ${v.tipo} | ${HTTP[v.tipo]} | ${celda(v.funciones.join(', '))} |`);
  }
  o.push('', '### SQLSTATE de restricciones', '', '| SQLSTATE | Origen | Dominio propuesto |', '|---|---|---|');
  o.push('| `23505` unique_violation | UNIQUE / PK (p. ej. `pagos.clave_idempotencia`, `marcaciones.evento_uuid`) | Conflict (409) |');
  o.push('| `23P01` exclusion_violation | EXCLUDE (solapes de vigencias, horarios, jornadas, contratos) | Conflict (409) |');
  o.push('| `23503` foreign_key_violation | FK (incluidas las compuestas con anio_id/grado_id) | Validation (422) |');
  o.push('| `23514` check_violation | CHECK | Validation (422) |');
  o.push('| `23502` not_null_violation | NOT NULL | Validation (422) |');
  o.push('| `P0002` no_data_found | `INTO STRICT` | NotFound (404) |');
  o.push('| `40001` / `40P01` | serialización / deadlock | reintentar la transacción |');
  writeFileSync(join(salida, 'funciones.md'), o.join('\n'));
}

// ---------- Triggers y vistas ----------
{
  const o = [AVISO, '', '# Triggers (58) y vistas (13)', ''];
  o.push('PostgreSQL ejecuta los triggers de una misma tabla y momento en **orden alfabético por nombre**. Los `BEFORE` validan o normalizan (`controlar_*`, `preservar_*`, `conservar_*`, `proteger_*`); los `AFTER` auditan en `bitacora` o propagan (`aplicar_justificacion`).', '');
  o.push('## Triggers por dominio', '');
  for (const d of DOMINIOS) {
    const lista = todosLosTriggers.filter((x) => d.tablas.includes(x.tabla));
    if (!lista.length) continue;
    o.push(`### ${d.titulo}`, '', '| Tabla | Trigger | Momento | Eventos | Condición | Función | Propósito |', '|---|---|---|---|---|---|---|');
    for (const x of lista.sort((a, b) => (a.tabla + a.nombre).localeCompare(b.tabla + b.nombre))) {
      o.push(`| ${linkTabla(x.tabla)} | ${codigo(x.nombre)} | ${x.momento} | ${celda(x.eventos)} | ${celda(x.cuando ? codigo(x.cuando) : '')} | [${codigo(x.funcion)}](funciones.md#${x.funcion}) | ${celda(FUNCIONES[x.funcion].proposito)} |`);
    }
    o.push('');
  }
  o.push('## Vistas', '');
  for (const [n, v] of [...vistas].sort()) {
    const usadaPor = funciones.filter((f) => new RegExp(`\\b${n}\\b`).test(f.cuerpo)).map((f) => f.nombre);
    const base = [...new Set([...v.def.matchAll(/excelencia_seruna\.(\w+)/g)].map((m) => m[1]))].sort();
    o.push(`<a id="vista-${n}"></a>`, `### ${n}`, '', VISTAS[n], '');
    o.push(`- **Columnas:** ${v.columnas.map((c) => `${codigo(c.nombre)} ${tipoCorto(c.tipo)}`).join(', ')}`);
    o.push(`- **Fuentes:** ${base.map((n) => linkTabla(n)).join(', ')}`);
    if (usadaPor.length) o.push(`- **Usada por:** ${usadaPor.map((x) => `[${codigo(x)}](funciones.md#${x})`).join(', ')}`);
    o.push('', '<details><summary>Definición</summary>', '', '```sql', v.def.trim(), '```', '', '</details>', '');
  }
  writeFileSync(join(salida, 'triggers-y-vistas.md'), o.join('\n'));
}

// ---------- Permisos ----------
{
  const s = cat.semillas;
  const roles = s.roles;
  const tiene = new Set(s.rol_permisos.map((x) => `${x.rol_id}:${x.permiso_id}`));
  const o = [AVISO, '', '# Matriz rol → permiso', ''];
  o.push(`Roles sembrados: ${roles.map((r) => `${codigo(r.codigo)} (${r.nombre})`).join(', ')}. ${s.permisos.length} permisos y ${s.rol_permisos.length} asignaciones.`, '');
  o.push(`| Permiso | Descripción | ${roles.map((r) => r.codigo).join(' | ')} |`, `|---|---|${roles.map(() => ':---:').join('|')}|`);
  let grupo = '';
  for (const p of [...s.permisos].sort((a, b) => a.codigo.localeCompare(b.codigo))) {
    const g = p.codigo.split('.')[0];
    if (g !== grupo) { grupo = g; o.push(`| **${g}** | | ${roles.map(() => '').join(' | ')} |`); }
    o.push(`| ${codigo(p.codigo)} | ${celda(p.descripcion)} | ${roles.map((r) => (tiene.has(`${r.id}:${p.id}`) ? '✔' : '·')).join(' | ')} |`);
  }
  o.push('', '## Totales por rol', '');
  for (const r of roles) o.push(`- ${codigo(r.codigo)}: ${s.rol_permisos.filter((x) => x.rol_id === r.id).length} permisos`);
  o.push('', '## Tipos de reporte y permiso requerido', '', '| Tipo | Nombre | Permiso |', '|---|---|---|');
  for (const t of s.tipos_reporte) o.push(`| ${codigo(t.codigo)} | ${celda(t.nombre)} | ${codigo(t.permiso)} |`);
  o.push('', '## Permisos verificados dentro de la base', '');
  o.push('- `preparar_documento_reporte` exige que el actor sea usuario **activo** con el permiso de `tipos_reporte.permiso` del tipo de la plantilla.');
  o.push('- `validar_operador_importacion` (usada por `avanzar_lote_historico` y `conciliar_fila_historica`) exige `datos.conciliar_historico`.');
  o.push('- `registrar_marcacion` solo exige un usuario activo como operador (no verifica `asistencia.marcar`): la app debe verificarlo.');
  o.push('- El resto de reglas de autorización y de **alcance de datos** (alumno, apoderado, docente) es responsabilidad de la capa de servicios.');
  writeFileSync(join(salida, 'permisos.md'), o.join('\n'));
}

console.log(`Documentación generada en ${salida}: ${DOMINIOS.length} dominios, ${tablas.size} tablas, ${funciones.length} funciones, ${todosLosTriggers.length} triggers, ${vistas.size} vistas, ${catalogoErrores.size} mensajes de error.`);
