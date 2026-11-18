import { z } from 'zod';
import { NIVELES_LOGRO, id, idOpcional, textoOpcional, type NivelLogro } from '../comunes';

/** Estados que el usuario puede registrar ('pendiente' solo existe como ausencia de registro). */
export const ESTADOS_REGISTRABLES = ['evaluada', 'no_desarrollada'] as const;

export const ETIQUETA_ESTADO_CALIFICACION: Record<string, string> = {
  evaluada: 'Evaluada',
  no_desarrollada: 'No desarrollada',
  pendiente: 'Pendiente',
};

export const esquemaCelda = z
  .object({
    matriculaId: id,
    competenciaId: id,
    estado: z.enum(ESTADOS_REGISTRABLES),
    nivelLogro: z.enum(NIVELES_LOGRO).nullable().optional(),
    conclusion: textoOpcional(2000),
  })
  .superRefine((c, ctx) => {
    if (c.estado === 'evaluada' && !c.nivelLogro) {
      ctx.addIssue({ code: 'custom', path: ['nivelLogro'], message: 'Indique el nivel de logro' });
    }
  })
  // Una competencia no desarrollada no lleva nivel ni conclusión (forma del dato, no regla de negocio).
  .transform((c) =>
    c.estado === 'no_desarrollada' ? { ...c, nivelLogro: null, conclusion: null } : { ...c, nivelLogro: c.nivelLogro ?? null },
  );

export type Celda = z.infer<typeof esquemaCelda>;

const celdas = z
  .array(esquemaCelda)
  .min(1, 'No hay calificaciones para guardar')
  .max(3000)
  .superRefine((lista, ctx) => {
    const vistas = new Set<string>();
    for (const c of lista) {
      const k = `${c.matriculaId}:${c.competenciaId}`;
      if (vistas.has(k)) ctx.addIssue({ code: 'custom', message: 'Hay celdas duplicadas en el envío' });
      vistas.add(k);
    }
  });

/** Motivo de la rectificación: obligatorio para cambiar notas existentes (lo exige la base). */
const motivo = textoOpcional(500);

export const consultaGrillaDocente = z.object({ cursoId: id, bimestreId: id });
export const consultaGrillaAdmin = z.object({ seccionId: id, bimestreId: id, cursoId: idOpcional });

export const esquemaGuardarDocente = z.object({ cursoId: id, bimestreId: id, celdas, motivo });
export const esquemaGuardarAdmin = z.object({ seccionId: id, bimestreId: id, cursoId: idOpcional, celdas, motivo });

export type GuardarDocente = z.infer<typeof esquemaGuardarDocente>;
export type GuardarAdmin = z.infer<typeof esquemaGuardarAdmin>;

export interface CalificacionGrilla {
  id: string;
  estado: string;
  nivel_logro: NivelLogro | null;
  conclusion: string | null;
  actualizado_en: string;
  motivo_cambio: string | null;
}

export interface CompetenciaGrilla {
  id: string;
  codigo: string;
  nombre: string;
  area: string | null;
}

export interface AlumnoGrilla {
  matriculaId: string;
  estudianteId: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  /** Está en la nómina al cierre del bimestre (sus notas son obligatorias para cerrar). */
  enNomina: boolean;
  calificaciones: Record<string, CalificacionGrilla>;
}

export interface GrillaCalificaciones {
  contexto: {
    seccionId: string;
    seccion: string;
    grado: number;
    nivel: string;
    nivelCodigo: 'primaria' | 'secundaria';
    anioId: string;
    planId: string | null;
    cursoId: string | null;
    asignatura: string | null;
    bimestre: { id: string; numero: number; inicio: string; fin: string };
    cierre: { id: string; estado: string } | null;
    /** El usuario puede guardar (cierre en borrador y, para docentes, ventana de registro abierta). */
    editable: boolean;
    aviso: string | null;
  };
  cursos: { id: string; asignatura: string }[];
  competencias: CompetenciaGrilla[];
  alumnos: AlumnoGrilla[];
}

export interface ResultadoGuardado {
  insertadas: number;
  rectificadas: number;
  sinCambios: number;
}

export interface FilaRevision {
  id: string;
  calificacion_id: string;
  matricula_id: string;
  alumno: string;
  competencia: string;
  anterior: { estado: string; nivel_logro: string | null; conclusion: string | null };
  nueva: { estado: string; nivel_logro: string | null; conclusion: string | null };
  autor: string;
  motivo: string;
  registrado_en: string;
}

export interface CursoDocente {
  cursoId: string;
  asignatura: string;
  seccionId: string;
  seccion: string;
  grado: number;
  nivel: string;
  anioId: string;
  anio: number;
}

/** Conclusión descriptiva obligatoria para cerrar (regla de validar_cierre_evaluacion, solo para avisar). */
export function requiereConclusion(nivel: NivelLogro | null | undefined, nivelCodigo: string): boolean {
  return nivel === 'C' || (nivel === 'B' && nivelCodigo === 'primaria');
}
