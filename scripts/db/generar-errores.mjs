#!/usr/bin/env node
// Genera src/server/errores/mensajes-db.ts con todos los mensajes RAISE EXCEPTION de la base.
// Uso: node scripts/db/generar-errores.mjs docs/db/catalogo.json src/server/errores/mensajes-db.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { clasificar, erroresDe } from './clasificacion.mjs';

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
  console.error('Uso: node scripts/db/generar-errores.mjs <catalogo.json> <salida.ts>');
  process.exit(1);
}
const cat = JSON.parse(readFileSync(entrada, 'utf8').replace(/^﻿/, ''));
const exactos = new Map();
const patrones = new Map();
for (const f of cat.funciones) {
  for (const msg of erroresDe(f.cuerpo)) {
    const destino = msg.includes('%') ? patrones : exactos;
    const previo = destino.get(msg);
    destino.set(msg, { tipo: clasificar(msg), funciones: [...(previo?.funciones ?? []), f.nombre] });
  }
}
const esc = (s) => JSON.stringify(s);
const lineas = [
  '// Archivo generado por scripts/db/generar-errores.mjs desde docs/db/catalogo.json. No editar a mano.',
  '// Mensajes RAISE EXCEPTION (SQLSTATE P0001) de la base y su traducción a errores de dominio.',
  "import type { TipoErrorDb } from './tipos';",
  '',
  'export const MENSAJES_DB: Readonly<Record<string, TipoErrorDb>> = {',
  ...[...exactos].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([m, v]) => `  ${esc(m)}: ${esc(v.tipo)}, // ${v.funciones.join(', ')}`),
  '};',
  '',
  '/** Mensajes con parámetros (%): se comparan por prefijo. */',
  'export const PATRONES_DB: ReadonlyArray<{ prefijo: string; tipo: TipoErrorDb }> = [',
  ...[...patrones].map(([m, v]) => `  { prefijo: ${esc(m.split('%')[0])}, tipo: ${esc(v.tipo)} }, // ${v.funciones.join(', ')}`),
  '];',
  '',
];
writeFileSync(salida, lineas.join('\n'));
console.log(`mensajes-db.ts: ${exactos.size} mensajes exactos, ${patrones.size} patrones.`);
