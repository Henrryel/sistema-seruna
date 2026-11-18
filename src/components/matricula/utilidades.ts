'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';

export function useDebounce<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/** Objeto plano → FormData (omite vacíos; los File se adjuntan tal cual). */
export function aFormData(datos: Record<string, unknown>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof File !== 'undefined' && v instanceof File) f.append(k, v);
    else f.append(k, String(v));
  }
  return f;
}

const esArchivo = (v: unknown): v is File => typeof File !== 'undefined' && v instanceof File;

/** Archivo obligatorio en formularios del cliente (el servidor vuelve a validarlo). */
export const archivoRequerido = z.custom<File>((v) => esArchivo(v) && v.size > 0, 'Adjunte un archivo');
export const archivoOpcional = z.custom<File | null | undefined>((v) => v === undefined || v === null || esArchivo(v)).optional();

export const ENDPOINTS = {
  estudiantes: '/api/admin/matricula/estudiantes',
  personas: '/api/admin/matricula/personas',
  apoderados: '/api/admin/matricula/apoderados',
  reglas: '/api/admin/matricula/reglas',
  tiposDocumento: '/api/admin/matricula/tipos-documento',
  matriculas: '/api/admin/matricula/matriculas',
  nomina: '/api/admin/matricula/nomina',
  expedientes: '/api/admin/matricula/expedientes',
  documentos: '/api/admin/matricula/documentos',
  archivos: '/api/admin/matricula/archivos',
} as const;

export const urlArchivo = (id: string) => `${ENDPOINTS.archivos}/${id}`;
