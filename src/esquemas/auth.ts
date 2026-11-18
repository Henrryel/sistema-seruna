import { z } from 'zod';

export const esquemaLogin = z.object({
  login: z.string().trim().min(1, 'Ingrese su usuario').max(80),
  contrasena: z.string().min(1, 'Ingrese su contraseña').max(200),
});

export const esquemaNuevaContrasena = z
  .object({
    contrasena: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(200)
      .regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, 'Debe incluir letras')
      .regex(/\d/, 'Debe incluir números'),
    confirmacion: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmacion, { message: 'Las contraseñas no coinciden', path: ['confirmacion'] });

export const esquemaCanjeToken = z.object({
  token: z.string().min(20).max(100),
  contrasena: z.string().min(8).max(200),
});

export const esquemaCambioContrasena = z.object({
  actual: z.string().min(1, 'Ingrese su contraseña actual').max(200),
  nueva: z.string().min(8, 'Mínimo 8 caracteres').max(200),
});

export const esquemaRecuperar = z.object({ login: z.string().trim().min(1, 'Ingrese su usuario').max(80) });

export const esquemaPortal = z.object({ portal: z.enum(['admin', 'docente', 'estudiante', 'padre']) });
