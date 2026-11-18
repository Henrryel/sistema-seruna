import { z } from 'zod';
import { idOpcional } from '../comunes';

/** Valor del ítem "ninguno" en selects (Radix Select no admite valores vacíos). */
export const SIN_SELECCION = 'ninguna';

/** Id opcional que acepta el valor "ninguna" de un select como ausencia de valor. */
export const idSeleccionOpcional = z.preprocess((v) => (v === SIN_SELECCION ? undefined : v), idOpcional);
