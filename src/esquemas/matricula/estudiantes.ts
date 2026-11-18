import { z } from 'zod';
import { booleano, consultaListado, textoOpcional, textoRequerido } from '../comunes';
import { conPersona, esquemaPersonaBasica } from './comunes';

export const esquemaEstudianteNuevo = conPersona({
  codigo: textoRequerido(30),
  codigoSiagie: textoOpcional(30),
  activo: booleano.default(true),
});

export type DatosEstudianteNuevo = z.infer<typeof esquemaEstudianteNuevo>;

export const esquemaEstudianteEdicion = esquemaPersonaBasica.extend({
  codigo: textoRequerido(30),
  codigoSiagie: textoOpcional(30),
  activo: booleano,
});

export type DatosEstudianteEdicion = z.infer<typeof esquemaEstudianteEdicion>;

export const consultaEstudiantes = consultaListado.extend({ activo: z.enum(['true', 'false']).optional() });

export interface FilaEstudiante {
  id: string;
  persona_id: string;
  codigo: string;
  codigo_siagie: string | null;
  activo: boolean;
  nombres: string;
  apellidos: string;
  documento: string | null;
  ultima_matricula: string | null;
  estado_matricula: string | null;
}

export interface DocumentoIdentidad {
  id: string;
  tipo: string;
  numero: string;
  pais_emisor: string;
  verificado_en: string | null;
}

export interface FichaEstudiante {
  estudiante: {
    id: string;
    persona_id: string;
    codigo: string;
    codigo_siagie: string | null;
    activo: boolean;
    nombres: string;
    apellidos: string;
    fecha_nacimiento: string | null;
    correo_contacto: string | null;
    telefono: string | null;
    direccion: string | null;
  };
  documentos: DocumentoIdentidad[];
  usuario: { id: string; login: string; estado: string } | null;
  apoderados: import('./apoderados').FilaApoderado[];
  matriculas: import('./matriculas').FilaMatricula[];
  responsables: import('./matriculas').FilaResponsable[];
}
