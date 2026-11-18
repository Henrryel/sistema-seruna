import { describe, expect, it } from 'vitest';
import { db } from '@/server/db';
import { sumarDias, hoyLima } from '@/lib/formato';
import * as estudiantes from '@/server/services/matricula/estudiantes';
import * as apoderados from '@/server/services/matricula/apoderados';
import { hijosDelApoderado } from '@/server/autorizacion/alcance';
import { esquemaEstudianteNuevo } from '@/esquemas/matricula/estudiantes';
import { esquemaVinculo } from '@/esquemas/matricula/apoderados';
import { enPrueba, esperarError } from '@tests/helpers/db';
import { actorDe, crearAdmin, crearPersona, crearUsuario, sufijo } from '@tests/fixtures/base';
import { archivoPrueba } from '@tests/fixtures/matricula';

const dniAleatorio = () => String(10_000_000 + Math.floor(Math.random() * 89_999_999));

describe('estudiantes', () => {
  it('alta con persona nueva y DNI; código único; persona existente', () =>
    enPrueba(async () => {
      const { actor } = await crearAdmin();
      const codigo = `E-${sufijo()}`;
      const dni = dniAleatorio();
      const datos = esquemaEstudianteNuevo.parse({
        codigo,
        codigoSiagie: '',
        activo: true,
        persona: { nombres: 'Lucía', apellidos: 'Quispe Mamani', fechaNacimiento: '2019-04-10', documentoTipo: 'DNI', documentoNumero: dni },
      });
      const r = await estudiantes.crearEstudiante(actor, datos);
      const ficha = await estudiantes.fichaEstudiante(r.id);
      expect(ficha.estudiante).toMatchObject({ codigo, codigo_siagie: null, activo: true, nombres: 'Lucía', fecha_nacimiento: '2019-04-10' });
      expect(ficha.documentos).toMatchObject([{ tipo: 'DNI', numero: dni, pais_emisor: 'PE' }]);
      expect(ficha.usuario).toBeNull();

      // Búsqueda por DNI
      const encontrados = await estudiantes.listarEstudiantes({ q: dni }, { limite: 10, desplazamiento: 0 });
      expect(encontrados.filas.map((f) => f.id)).toEqual([r.id]);

      // Código duplicado: lo rechaza la base (UNIQUE)
      const otra = await crearPersona();
      await esperarError(
        estudiantes.crearEstudiante(actor, esquemaEstudianteNuevo.parse({ personaId: otra.id, codigo, activo: true })),
        'Conflict',
        'Ya existe un estudiante con ese código',
      );
      // Persona existente (los campos de persona nueva se ignoran)
      const existente = await estudiantes.crearEstudiante(actor, esquemaEstudianteNuevo.parse({ personaId: otra.id, codigo: `E-${sufijo()}`, persona: { nombres: '' } }));
      expect((await estudiantes.obtenerEstudiante(existente.id)).persona_id).toBe(otra.id);
      // DNI inválido: lo valida la base (CHECK)
      await esperarError(
        estudiantes.agregarDocumentoIdentidad(actor, { estudianteId: existente.id }, { tipo: 'DNI', numero: '123', paisEmisor: 'PE' }),
        'Validation',
        /8 dígitos/,
      );
    }));
});

describe('apoderados', () => {
  it('sin verificar no puede recibir accesos; verificado sí; terminar cierra la vigencia', () =>
    enPrueba(async () => {
      const { actor } = await crearAdmin();
      const est = await estudiantes.crearEstudiante(actor, esquemaEstudianteNuevo.parse({ codigo: `E-${sufijo()}`, persona: { nombres: 'Mateo', apellidos: `Huamán ${sufijo()}` } }));
      const padre = await crearUsuario({ roles: ['apoderado'] });
      const desde = sumarDias(hoyLima(), -30);
      const v = await apoderados.vincularApoderado(actor, est.id, esquemaVinculo.parse({ personaId: padre.personaId, parentesco: 'padre', desde }));

      await esperarError(
        apoderados.actualizarAccesos(actor, v.id, { accesoAcademico: true, accesoEconomico: false }),
        'Validation',
        'Verifique el vínculo antes de otorgar acceso académico o económico',
      );
      // Mismo apoderado con vigencia solapada: EXCLUDE
      await esperarError(apoderados.vincularApoderado(actor, est.id, esquemaVinculo.parse({ personaId: padre.personaId, parentesco: 'padre', desde })), 'Conflict', /ya tiene un vínculo/);

      const verif = await apoderados.verificarVinculo(actor, v.id, archivoPrueba('dni-padre.pdf'));
      expect(verif.evidenciaId).not.toBeNull();
      await esperarError(apoderados.verificarVinculo(actor, v.id), 'Conflict');
      await apoderados.actualizarAccesos(actor, v.id, { accesoAcademico: true, accesoEconomico: true });
      const [fila] = await apoderados.listarApoderados(est.id);
      expect(fila).toMatchObject({ vigente: true, acceso_academico: true, acceso_economico: true, verificado_por: actor.login, hasta: null, usuario_login: padre.login });

      const actorPadre = await actorDe(padre);
      expect((await hijosDelApoderado(actorPadre)).map((h) => h.estudianteId)).toEqual([est.id]);

      await esperarError(apoderados.terminarVinculo(actor, v.id, sumarDias(desde, -1)), 'Validation');
      await apoderados.terminarVinculo(actor, v.id, sumarDias(hoyLima(), -1));
      expect(await hijosDelApoderado(actorPadre)).toEqual([]);
      const [cerrado] = await apoderados.listarApoderados(est.id);
      expect(cerrado).toMatchObject({ vigente: false, desde, hasta: sumarDias(hoyLima(), -1) });

      // Apoderado nuevo (persona + DNI) en un período posterior
      const otro = await apoderados.vincularApoderado(
        actor,
        est.id,
        esquemaVinculo.parse({ parentesco: 'madre', desde: hoyLima(), persona: { nombres: 'Rosa', apellidos: 'Huamán', documentoTipo: 'DNI', documentoNumero: dniAleatorio() } }),
      );
      const ficha = await estudiantes.fichaEstudiante(est.id);
      expect(ficha.apoderados.map((a) => a.id).sort()).toEqual([v.id, otro.id].sort());
      const auditoria = await db().selectFrom('bitacora').select('accion').where('entidad', '=', 'estudiante_apoderado').where('registro_id', '=', v.id).execute();
      expect(auditoria.map((a) => a.accion)).toEqual(['vincular_apoderado', 'verificar', 'actualizar_accesos', 'terminar_vinculo']);
    }));
});
