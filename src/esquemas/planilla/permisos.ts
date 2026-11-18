import type { Permiso } from '@/lib/permisos';

// Combinaciones de permisos del módulo de planilla (autorización SIEMPRE por permiso, nunca por rol).

export const PERMISOS_PLANILLA: readonly Permiso[] = [
  'planilla.contratos',
  'planilla.horas',
  'planilla.aprobar_horas',
  'planilla.liquidar',
  'planilla.pagar',
  'planilla.revertir_pago',
];

export const PERMISOS_VER_HORAS: readonly Permiso[] = ['planilla.horas', 'planilla.aprobar_horas'];

export const PERMISOS_VER_LIQUIDACIONES: readonly Permiso[] = [
  'planilla.liquidar',
  'planilla.pagar',
  'planilla.revertir_pago',
];

/** Selects de contratos (registrar horas, crear liquidaciones, filtros). */
export const PERMISOS_OPCIONES_CONTRATO: readonly Permiso[] = [
  'planilla.contratos',
  'planilla.horas',
  'planilla.aprobar_horas',
  'planilla.liquidar',
];
