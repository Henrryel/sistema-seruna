import 'server-only';
import { NotFoundError, ValidationError } from '@/server/errores';
import * as repoMarcaciones from '@/server/repositories/asistencia/marcaciones';
import * as repoCredenciales from '@/server/repositories/asistencia/credenciales';
import * as repoConfiguracion from '@/server/repositories/asistencia/configuracion';
import type { FilaMarcacion } from '@/server/repositories/asistencia/marcaciones';
import type { TipoMarcacion } from '@/esquemas/asistencia/marcaciones';
import { hashCodigoLeido } from './tokens';

/**
 * Proveedor de identificación para la asistencia.
 *
 * Un proveedor convierte una LECTURA del dispositivo (texto de un QR/Code 128, una plantilla facial, …)
 * en una marcación de la base (`marcaciones`) mediante `registrar_marcacion`, que es idempotente por
 * `evento_uuid`. El proveedor NO crea la asistencia: eso lo hace el servicio de marcaciones a partir de
 * la marcación devuelta (jornada del día, presente/tarde con la fórmula de `validar_asistencia`).
 *
 * La base solo conoce dos métodos (`marcaciones.metodo IN ('qr','manual')`):
 *  - 'qr'     → credencial (hash del token) + lector; persona y hora las pone la base (en línea).
 *  - 'manual' → persona + instante + motivo explícitos, sin lector ni credencial.
 */
export interface LecturaEnLinea {
  eventoUuid: string;
  tipo: TipoMarcacion;
  lectorId: string;
  /** Dato leído por el dispositivo (para QR: el texto del código). */
  dato: string;
  /** Operador (usuario) que registra; debe tener `asistencia.marcar`. */
  actorId: string;
}

export interface LecturaDiferida extends LecturaEnLinea {
  /** Instante en que el dispositivo capturó la lectura sin conexión (ISO 8601). */
  capturadoEn: string;
}

export type MarcacionRegistrada = FilaMarcacion;

export interface AttendanceProvider {
  readonly id: 'qr' | 'facial';
  readonly nombre: string;
  /** Lectura en línea: identidad y hora las resuelve el servidor/base en el momento. */
  registrarEnLinea(lectura: LecturaEnLinea): Promise<MarcacionRegistrada>;
  /** Lectura capturada sin conexión: se registra con el instante capturado (método manual con motivo). */
  registrarDiferida(lectura: LecturaDiferida): Promise<MarcacionRegistrada>;
}

/** Antigüedad máxima de una lectura offline aceptada al sincronizar. */
export const MAX_DIAS_DIFERIDA = 7;

/**
 * Proveedor QR / Code 128 (implementado).
 * - En línea: `registrar_marcacion` en modo QR con `hashToken(token)` y el lector.
 * - Diferido: la hora de una lectura QR la pone el SERVIDOR, así que una lectura capturada sin conexión
 *   no puede enviarse como QR (quedaría con la hora de sincronización). Se resuelve la credencial por
 *   hash (no revocada y vigente en el instante capturado) y se registra en modo MANUAL con la persona,
 *   el instante capturado y el motivo "Lectura QR sin conexión en lector <código>" (p_lector NULL, como
 *   exige la base). Requiere que la política de asistencia ADMITA MANUAL; si no, la marcación queda
 *   registrada pero `validar_asistencia` rechaza usarla para la asistencia (se informa el motivo).
 */
export const proveedorQr: AttendanceProvider = {
  id: 'qr',
  nombre: 'Credencial QR / Code 128',

  async registrarEnLinea(l) {
    return repoMarcaciones.registrarMarcacionQr({
      eventoUuid: l.eventoUuid,
      tipo: l.tipo,
      actorId: l.actorId,
      tokenHash: hashCodigoLeido(l.dato),
      lectorId: l.lectorId,
    });
  },

  async registrarDiferida(l) {
    const capturado = Date.parse(l.capturadoEn);
    if (Number.isNaN(capturado)) throw new ValidationError('Instante de captura inválido');
    const ahora = Date.now();
    if (capturado > ahora) throw new ValidationError('La lectura tiene una hora futura: revise el reloj del dispositivo');
    if (ahora - capturado > MAX_DIAS_DIFERIDA * 86_400_000) {
      throw new ValidationError(`La lectura tiene más de ${MAX_DIAS_DIFERIDA} días y ya no puede sincronizarse`);
    }
    const lector = await repoConfiguracion.obtenerLector(l.lectorId);
    if (!lector) throw new NotFoundError('El lector QR no existe');
    const credencial = await repoCredenciales.credencialVigenteEn(hashCodigoLeido(l.dato), l.capturadoEn);
    if (!credencial) throw new ValidationError('Credencial QR inválida, vencida o revocada');
    return repoMarcaciones.registrarMarcacionManual({
      eventoUuid: l.eventoUuid,
      tipo: l.tipo,
      actorId: l.actorId,
      personaId: credencial.persona_id,
      instante: l.capturadoEn,
      motivo: `Lectura QR sin conexión en lector ${lector.codigo}`,
    });
  },
};

/*
 * ── Proveedor FACIAL (documentado, NO implementado) ───────────────────────────────────────────────
 *
 * Un `proveedorFacial: AttendanceProvider` con `id: 'facial'` podría reemplazar o complementar al QR:
 *
 * 1. Base legal (Perú, Ley 29733 y su reglamento D.S. 016-2024-JUS): la plantilla facial es un DATO
 *    BIOMÉTRICO, dato SENSIBLE. Los alumnos son menores de edad: se requiere consentimiento previo,
 *    expreso, informado y por escrito de padres/tutores, revocable, con alternativa no biométrica (QR).
 *    Ver docs/privacidad.md (finalidad, minimización, retención, banco de datos inscrito en la ANPD).
 * 2. Minimización: nunca guardar fotos; solo plantillas cifradas, fuera de la base `excelencia_seruna`
 *    (que no tiene tablas para ello y no se modifica). Comparación 1:N en el dispositivo o en un servicio
 *    aislado; a la app solo le llega `persona_id` + puntaje, nunca la imagen.
 * 3. Registro en la base: `marcaciones.metodo` solo admite 'qr' | 'manual' y el modo QR exige una
 *    credencial; por tanto el reconocimiento facial se registraría en modo MANUAL con persona, instante
 *    del reconocimiento y motivo "Reconocimiento facial en lector <código> (puntaje ≥ umbral)". La
 *    política de asistencia debe admitir manual.
 * 4. Interfaz: `registrarEnLinea({ dato })` recibiría el identificador opaco que devuelve el motor
 *    (no la imagen); `registrarDiferida` igual que el QR (instante capturado, máximo 7 días).
 * 5. Retención: borrar plantillas al retirarse el alumno o al revocarse el consentimiento; registros de
 *    acceso a las plantillas auditados en `bitacora`.
 */
