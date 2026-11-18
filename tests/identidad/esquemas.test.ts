import { describe, expect, it } from 'vitest';
import { esquemaCrearPersona } from '@/esquemas/identidad/personas';
import { esquemaCrearUsuario, esquemaEstadoUsuario } from '@/esquemas/identidad/usuarios';
import { esquemaAsignatura } from '@/esquemas/academico/curriculo';
import { esquemaBloque, esquemaGenerarSesiones } from '@/esquemas/academico/horarios';
import { esquemaSeccion } from '@/esquemas/academico/secciones';

// Contratos Zod compartidos por formularios y API (normalización, no reglas de la base).
describe('esquemas de identidad y estructura académica', () => {
  it('normaliza login, documento y nombre de sección; exige elegir persona', () => {
    const u = esquemaCrearUsuario.parse({ personaId: 7, login: '  R.Quispe ', roles: ['docente'] });
    expect(u).toEqual({ personaId: '7', login: 'r.quispe', roles: ['docente'], generarEnlace: true });
    const sinPersona = esquemaCrearUsuario.safeParse({ personaId: '', login: 'abc', roles: ['docente'] });
    expect(sinPersona.success).toBe(false);
    expect(sinPersona.error?.flatten().fieldErrors.personaId?.[0]).toBe('Seleccione una persona');
    expect(esquemaCrearUsuario.safeParse({ personaId: '1', login: 'con espacio', roles: ['x'] }).success).toBe(false);

    const p = esquemaCrearPersona.parse({ nombres: ' Ana ', apellidos: 'Pérez', documento: { tipo: 'CE', numero: ' abc123 ' } });
    expect(p.documento).toEqual({ tipo: 'CE', paisEmisor: 'PE', numero: 'ABC123', verificado: false });
    expect(esquemaCrearPersona.parse({ nombres: 'Ana', apellidos: 'Pérez', documento: { tipo: 'DNI', numero: '' } }).documento).toBeUndefined();

    expect(esquemaSeccion.parse({ anioId: '1', gradoId: '2', nombre: ' b ', turno: 'Tarde', cupo: '30' }).nombre).toBe('B');
    expect(esquemaEstadoUsuario.safeParse({ estado: 'suspendido', motivo: '' }).success).toBe(false);
  });

  it('los selects opcionales aceptan "ninguna" y se validan rangos que la base no puede traducir', () => {
    expect(esquemaAsignatura.parse({ codigo: 'mat', nombre: 'Matemática', areaId: 'ninguna' }).areaId).toBeUndefined();
    const bloque = { cursoId: '1', asignacionId: '2', aulaId: 'ninguna', diaIso: '1', horaInicio: '08:00', horaFin: '09:00', inicio: '2100-03-01', fin: '2100-12-20' };
    expect(esquemaBloque.parse(bloque)).toMatchObject({ aulaId: undefined, diaIso: 1 });
    expect(esquemaBloque.safeParse({ ...bloque, horaFin: '07:00' }).success).toBe(false);
    expect(esquemaBloque.safeParse({ ...bloque, fin: '2100-01-01' }).success).toBe(false);
    expect(esquemaGenerarSesiones.safeParse({ seccionId: '1', desde: '2100-03-01', hasta: '2100-12-31' }).success).toBe(false);
  });
});
