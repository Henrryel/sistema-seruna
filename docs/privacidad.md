# Privacidad y protección de datos — Asistencia (QR y futura biometría)

Marco: **Ley N.º 29733, Ley de Protección de Datos Personales** (Perú) y su reglamento vigente (D.S. 016-2024-JUS,
que reemplazó al D.S. 003-2013-JUS). Autoridad: Autoridad Nacional de Protección de Datos Personales (ANPD,
MINJUSDH). Este documento describe cómo el módulo de asistencia aplica esos principios; **no es asesoría legal**:
la institución debe validarlo con su área legal antes de operar.

## 1. Datos que trata el módulo

| Dato | Dónde | Finalidad | Sensibilidad |
|---|---|---|---|
| Identidad del alumno/docente (nombre, código, sección) | `personas`, `estudiantes`, `docentes` | Identificar en la jornada | Personal (menores de edad) |
| Huella del token de la credencial (SHA-256, 32 bytes) | `credenciales_qr.token_hash` | Validar el carnet | Personal; el token **no** se guarda |
| Marcaciones (instante, entrada/salida, lector, operador) | `marcaciones` | Probar la asistencia | Personal |
| Estado de asistencia y motivo | `asistencia_estudiantes`, `asistencia_docentes` | Registro académico/laboral | Personal |
| Justificaciones y evidencia (constancias, certificados) | `justificaciones_asistencia`, `archivos` | Sustentar faltas/tardanzas | Puede contener **datos de salud = sensibles** |
| Cola offline del escáner (evento, texto leído, instante) | IndexedDB del dispositivo del lector | Registrar sin conexión | Personal; se borra al sincronizar |

## 2. Credenciales QR / Code 128 (implementado)

- **Minimización:** el carnet lleva un código aleatorio de 20 caracteres (100 bits) sin datos personales
  codificados; el QR y el Code 128 contienen el **mismo** código. El código no se imprime en claro.
- **Solo hash en la base:** se guarda `SHA-256(código)`; nadie (ni la institución) puede recuperar el código.
  Por eso los carnets se imprimen en el mismo momento de la emisión; reimprimir = **reemitir** (la credencial
  anterior queda revocada con `revocada_en/revocada_por`, auditado en `bitacora`).
- **Vigencia corta:** cada credencial tiene `expira_en` (por defecto fin del año académico).
- **Pérdida o robo:** revocar de inmediato en *Credenciales y carnets*; la revocación es efectiva en la siguiente
  lectura en línea. Las lecturas sin conexión solo se aceptan si la credencial **no está revocada** al sincronizar.
- **Lecturas sin conexión:** se guardan en el dispositivo (IndexedDB) hasta sincronizar, máximo 7 días; se
  registran como marcación *manual* con motivo "Lectura QR sin conexión en lector …" (la base no admite que el
  dispositivo fije la hora de una marcación QR). Los dispositivos de lectura deben tener bloqueo de pantalla y
  sesión de un operador con el permiso `asistencia.marcar`.
- **Acceso por alcance:** alumno → solo su asistencia; apoderado → hijos con vínculo vigente y acceso académico;
  docente → sus secciones y sesiones; administración → por permiso y siempre auditado.

## 3. Justificaciones y evidencias

- Pedir solo lo necesario: constancia de atención, no diagnóstico detallado (la interfaz lo recuerda).
- Las evidencias se guardan fuera de la base (`archivos`, almacenamiento con SHA-256) y solo las ven quien
  resuelve (`asistencia.resolver`), quien la solicitó y quienes tienen alcance sobre esa asistencia.
- Una evidencia médica es **dato sensible** (salud): tratamiento con consentimiento del titular o de sus padres y
  acceso restringido.

## 4. Biometría (reconocimiento facial) — NO implementada

La interfaz `AttendanceProvider` (`src/server/asistencia/proveedor.ts`) permite agregar un proveedor facial sin
cambiar el resto del módulo. Antes de hacerlo, la institución debe cumplir lo siguiente:

1. **Dato sensible.** Los datos biométricos que identifican a una persona son **datos sensibles** según la Ley
   29733. Su tratamiento exige **consentimiento previo, expreso, informado, inequívoco y por escrito**.
2. **Menores de edad.** Para alumnos, el consentimiento lo otorgan **padres o tutores**; debe poder **revocarse**
   en cualquier momento sin perjuicio para el alumno. Se debe ofrecer siempre la **alternativa no biométrica**
   (carnet QR): la biometría no puede ser condición para asistir.
3. **Finalidad y proporcionalidad.** Usar la plantilla solo para registrar asistencia; prohibido reutilizarla
   para vigilancia, conducta, marketing u otra finalidad. Evaluar si el QR ya cumple la finalidad (en general sí).
4. **Minimización.** No almacenar fotografías; solo plantillas matemáticas **cifradas**, fuera de la base
   `excelencia_seruna` (que no se modifica y no tiene tablas para ello). La app recibiría solo `persona_id`
   + puntaje; la marcación se registra en modo *manual* con motivo "Reconocimiento facial en lector …".
5. **Retención.** Eliminar la plantilla al retirarse el alumno o docente, al revocarse el consentimiento o al
   terminar el año si no se renueva. Documentar el procedimiento de borrado y registrar los accesos.
6. **Seguridad y registro.** Evaluación de impacto previa, inscripción/actualización del banco de datos ante la
   ANPD, contratos de encargo con proveedores, cifrado en tránsito y reposo, y prohibición de transferencias
   internacionales sin las garantías de ley.
7. **Derechos ARCO.** Canal para que padres, alumnos y docentes ejerzan acceso, rectificación, cancelación y
   oposición.

## 5. Retención sugerida (a validar por la institución)

| Registro | Plazo | Motivo |
|---|---|---|
| Asistencia, marcaciones, justificaciones | Según normativa educativa y laboral aplicable | Historial inmutable exigido por la base |
| Evidencias de justificación | Año académico + plazo de reclamos | Sustento |
| Credenciales vencidas/revocadas (solo hash) | Mientras existan marcaciones que las referencian | Integridad referencial |
| Cola offline del dispositivo | Hasta sincronizar (máx. 7 días) | Operación sin conexión |
| Plantillas biométricas (si se implementa) | Mientras dure el consentimiento y la matrícula/contrato | Ley 29733 |
