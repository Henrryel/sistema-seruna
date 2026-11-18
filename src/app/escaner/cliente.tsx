'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { IScannerControls } from '@zxing/browser';
import { ArrowLeft, Camera, CameraOff, CheckCircle2, CloudOff, Keyboard, LogIn, LogOut, Maximize, RefreshCw, TriangleAlert, Wifi, WifiOff, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatoHora } from '@/lib/formato';
import { contarPendientes, encolar, eventosPendientes, quitarDeCola } from '@/components/asistencia/cola-offline';
import { prepararAudio, sonar } from '@/components/asistencia/sonido';
import type { EventoOffline, LectorEscaner, ResultadoMarcacion, ResultadoSincronizacion, TipoMarcacion } from '@/esquemas/asistencia/marcaciones';

type Tono = 'ok' | 'aviso' | 'error' | 'offline';

interface Lectura {
  id: string;
  tono: Tono;
  titulo: string;
  detalle: string;
  hora: string;
}

const CLAVE_LECTOR = 'seruna.escaner.lector';
const CLAVE_TIPO = 'seruna.escaner.tipo';
const CLAVE_LECTORES = 'seruna.escaner.lectores';
const REPETICION_MS = 3000;
const LOTE = 100;

const ESTILO: Record<Tono, string> = {
  ok: 'border-emerald-600 bg-emerald-600 text-white',
  aviso: 'border-amber-500 bg-amber-400 text-amber-950',
  error: 'border-red-700 bg-red-600 text-white',
  offline: 'border-sky-700 bg-sky-600 text-white',
};
const ICONO: Record<Tono, typeof CheckCircle2> = { ok: CheckCircle2, aviso: TriangleAlert, error: XCircle, offline: CloudOff };

function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function guardarLocal(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** POST con la cabecera anti-CSRF, sin redirigir al login (el escáner encola si la sesión venció). */
async function enviar(url: string, cuerpo: unknown): Promise<{ status: number; datos: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-seruna': '1', 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  return { status: res.status, datos: texto ? (JSON.parse(texto) as unknown) : null };
}
const mensajeError = (d: unknown, porDefecto: string) => (d as { error?: { mensaje?: string } } | null)?.error?.mensaje ?? porDefecto;

function describir(r: ResultadoMarcacion): { tono: Tono; titulo: string; detalle: string } {
  const quien = [r.persona.detalle, r.persona.codigo].filter(Boolean).join(' · ');
  if (r.asistencia.registrada) {
    const estado = r.asistencia.estado === 'tarde' ? ' · TARDE' : '';
    return { tono: 'ok', titulo: r.persona.nombre, detalle: `${r.asistencia.mensaje}${estado}${quien ? ` — ${quien}` : ''}` };
  }
  return { tono: 'aviso', titulo: r.persona.nombre, detalle: `Marcación guardada, asistencia no registrada: ${r.asistencia.mensaje}` };
}

export function ClienteEscaner(props: { lectoresIniciales: LectorEscaner[]; operador: string }) {
  const [lectores, setLectores] = useState<LectorEscaner[]>(props.lectoresIniciales);
  const [lectorId, setLectorId] = useState('');
  const [tipo, setTipo] = useState<TipoMarcacion>('entrada');
  const [codigo, setCodigo] = useState('');
  const [ultima, setUltima] = useState<Lectura | null>(null);
  const [historial, setHistorial] = useState<Lectura[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [enLinea, setEnLinea] = useState(true);
  const [sesionVencida, setSesionVencida] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [camaras, setCamaras] = useState<MediaDeviceInfo[]>([]);
  const [camaraId, setCamaraId] = useState('');
  const [errorCamara, setErrorCamara] = useState<string | null>(null);

  const entradaRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlesRef = useRef<IScannerControls | null>(null);
  const estadoRef = useRef({ lectorId: '', tipo: 'entrada' as TipoMarcacion });
  const recienteRef = useRef<{ codigo: string; t: number } | null>(null);
  const sincronizandoRef = useRef(false);

  // La cámara llama a `procesar` desde un callback de larga vida: lector y tipo se leen de una ref.
  useEffect(() => {
    estadoRef.current = { lectorId, tipo };
  }, [lectorId, tipo]);
  const lector = lectores.find((l) => l.id === lectorId);

  const mostrar = useCallback((l: Omit<Lectura, 'id' | 'hora'>, sonido = true) => {
    const lectura = { ...l, id: crypto.randomUUID(), hora: new Date().toISOString() };
    setUltima(lectura);
    setHistorial((h) => [lectura, ...h].slice(0, 15));
    if (sonido) sonar(l.tono);
  }, []);

  const actualizarPendientes = useCallback(async () => {
    try {
      setPendientes(await contarPendientes());
    } catch {
      setPendientes(0);
    }
  }, []);

  // ── Sincronización de la cola offline ──────────────────────────────────────
  const sincronizar = useCallback(async () => {
    if (sincronizandoRef.current || !navigator.onLine) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      const lista = await eventosPendientes();
      for (let i = 0; i < lista.length; i += LOTE) {
        const lote = lista.slice(i, i + LOTE);
        const r = await enviar('/api/escaner/sincronizar', { eventos: lote });
        if (r.status === 401) {
          setSesionVencida(true);
          break;
        }
        if (r.status === 422 && lote.length > 1) {
          // Un evento mal formado no debe bloquear la cola: se reintenta uno por uno.
          for (const ev of lote) {
            const u = await enviar('/api/escaner/sincronizar', { eventos: [ev] });
            if (u.status === 422) await quitarDeCola([ev.eventoUuid]);
            else if (u.status === 200) await procesarResultados((u.datos as { resultados: ResultadoSincronizacion[] }).resultados);
          }
          continue;
        }
        if (r.status !== 200) break;
        await procesarResultados((r.datos as { resultados: ResultadoSincronizacion[] }).resultados);
      }
    } catch {
      /* sin red: se reintentará */
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
      await actualizarPendientes();
    }

    async function procesarResultados(resultados: ResultadoSincronizacion[]) {
      await quitarDeCola(resultados.filter((x) => x.definitivo).map((x) => x.eventoUuid));
      for (const x of resultados) {
        if (x.ok && x.resultado) {
          const d = describir(x.resultado);
          mostrar({ tono: d.tono, titulo: `Sincronizado: ${d.titulo}`, detalle: `${d.detalle} (leído ${formatoHora(x.resultado.instante)})` }, false);
        } else if (x.definitivo) {
          mostrar({ tono: 'error', titulo: 'Lectura sin conexión rechazada', detalle: x.error ?? 'Rechazada' }, false);
        }
      }
    }
  }, [actualizarPendientes, mostrar]);

  // ── Procesar una lectura (cámara o lector USB) ─────────────────────────────
  const procesar = useCallback(
    async (texto: string) => {
      const limpio = texto.trim();
      if (limpio.length < 4) return;
      const ahora = Date.now();
      if (recienteRef.current && recienteRef.current.codigo === limpio && ahora - recienteRef.current.t < REPETICION_MS) return;
      recienteRef.current = { codigo: limpio, t: ahora };
      const { lectorId: lid, tipo: t } = estadoRef.current;
      if (!lid) {
        mostrar({ tono: 'error', titulo: 'Elija el lector', detalle: 'Seleccione el punto de lectura antes de escanear.' });
        return;
      }
      const evento: EventoOffline = { eventoUuid: crypto.randomUUID(), tipo: t, lectorId: lid, codigo: limpio, capturadoEn: new Date().toISOString() };
      const guardarSinConexion = async (motivo: string) => {
        try {
          await encolar(evento);
          await actualizarPendientes();
          mostrar({ tono: 'offline', titulo: 'Guardado sin conexión', detalle: `${motivo} Se enviará automáticamente al reconectar.` });
        } catch {
          mostrar({ tono: 'error', titulo: 'No se pudo guardar', detalle: 'Sin conexión y sin almacenamiento local disponible.' });
        }
      };
      if (!navigator.onLine) {
        await guardarSinConexion('No hay conexión.');
        return;
      }
      try {
        const r = await enviar('/api/escaner/marcar', { eventoUuid: evento.eventoUuid, tipo: t, lectorId: lid, codigo: limpio });
        if (r.status === 200) {
          setSesionVencida(false);
          mostrar(describir(r.datos as ResultadoMarcacion));
        } else if (r.status === 401) {
          setSesionVencida(true);
          await guardarSinConexion('La sesión venció.');
        } else if (r.status >= 500) {
          await guardarSinConexion('El servidor no respondió.');
        } else {
          mostrar({ tono: 'error', titulo: 'No registrado', detalle: mensajeError(r.datos, `Error ${r.status}`) });
        }
      } catch {
        // Falla de red: la lectura se guarda con su instante y el MISMO UUID (idempotencia).
        await guardarSinConexion('Se perdió la conexión.');
      }
    },
    [actualizarPendientes, mostrar],
  );

  // ── Inicio: preferencias, estado de red, sincronización y service worker ──
  useEffect(() => {
    const guardado = leerLocal(CLAVE_LECTOR);
    const listaGuardada = leerLocal(CLAVE_LECTORES);
    let lista = props.lectoresIniciales;
    if (lista.length === 0 && listaGuardada) {
      try {
        lista = JSON.parse(listaGuardada) as LectorEscaner[];
        setLectores(lista);
      } catch {
        /* ignorar */
      }
    } else {
      guardarLocal(CLAVE_LECTORES, JSON.stringify(lista));
    }
    if (guardado && lista.some((l) => l.id === guardado)) setLectorId(guardado);
    else if (lista.length === 1) setLectorId(lista[0]!.id);
    if (leerLocal(CLAVE_TIPO) === 'salida') setTipo('salida');
    setEnLinea(navigator.onLine);
    void actualizarPendientes().then(() => sincronizar());

    const online = () => {
      setEnLinea(true);
      void sincronizar();
    };
    const offline = () => setEnLinea(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const intervalo = window.setInterval(() => void sincronizar(), 20_000);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/escaner' }).catch(() => undefined);
    }
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantener el foco en el campo del lector USB (teclado + Enter) mientras no se use otro control.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.activeElement === document.body || document.activeElement === null) entradaRef.current?.focus({ preventScroll: true });
    }, 800);
    return () => window.clearInterval(t);
  }, []);

  // Detener la cámara al salir.
  useEffect(() => () => controlesRef.current?.stop(), []);

  async function iniciarCamara(dispositivo?: string) {
    prepararAudio();
    setErrorCamara(null);
    controlesRef.current?.stop();
    try {
      const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser');
      const lectorCodigos = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120 });
      lectorCodigos.possibleFormats = [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128];
      const video = videoRef.current ?? undefined;
      const alLeer = (resultado: { getText(): string } | undefined) => {
        if (resultado) void procesar(resultado.getText());
      };
      controlesRef.current = dispositivo
        ? await lectorCodigos.decodeFromVideoDevice(dispositivo, video, (r) => alLeer(r))
        : await lectorCodigos.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (r) => alLeer(r));
      setCamaraActiva(true);
      const lista = await BrowserMultiFormatReader.listVideoInputDevices();
      setCamaras(lista);
    } catch (e) {
      setCamaraActiva(false);
      const nombre = (e as { name?: string }).name;
      setErrorCamara(
        nombre === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilítelo en el navegador o use el lector USB.'
          : nombre === 'NotFoundError'
            ? 'No se encontró una cámara. Use el lector USB.'
            : 'No se pudo iniciar la cámara (requiere HTTPS).',
      );
    }
  }

  function detenerCamara() {
    controlesRef.current?.stop();
    controlesRef.current = null;
    setCamaraActiva(false);
  }

  const IconoUltima = ultima ? ICONO[ultima.tono] : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-3 p-3 sm:p-4" onPointerDown={prepararAudio}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild aria-label="Volver al portal">
            <Link href="/admin">
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg leading-tight font-semibold">Escáner de asistencia</h1>
            <p className="text-xs text-muted-foreground">Operador: {props.operador}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', enLinea ? 'bg-exito text-exito-foreground' : 'bg-alerta text-alerta-foreground')}
            role="status"
          >
            {enLinea ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
            {enLinea ? 'En línea' : 'Sin conexión'}
          </span>
          <Button variant="outline" size="sm" onClick={() => void sincronizar()} disabled={!enLinea || sincronizando || pendientes === 0} aria-label="Sincronizar lecturas pendientes">
            <RefreshCw className={cn(sincronizando && 'animate-spin')} aria-hidden /> {pendientes} pendiente(s)
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Pantalla completa"
            onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen().catch(() => undefined))}
          >
            <Maximize aria-hidden />
          </Button>
        </div>
      </header>

      {sesionVencida ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-alerta px-3 py-2 text-sm text-alerta-foreground">
          La sesión venció: las lecturas se guardan en este equipo y se enviarán al volver a iniciar sesión.
          <Button size="sm" variant="outline" asChild>
            <a href="/login?siguiente=/escaner">
              <LogIn aria-hidden /> Iniciar sesión
            </a>
          </Button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-[1fr_auto]" aria-label="Configuración del punto de lectura">
        <div className="grid gap-1.5">
          <Label htmlFor="lector">Lector / punto de lectura</Label>
          <Select
            value={lectorId || undefined}
            onValueChange={(v) => {
              setLectorId(v);
              guardarLocal(CLAVE_LECTOR, v);
            }}
          >
            <SelectTrigger id="lector" className="h-11 w-full">
              <SelectValue placeholder={lectores.length ? 'Seleccione el lector' : 'No hay lectores activos'} />
            </SelectTrigger>
            <SelectContent>
              {lectores.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.codigo} · {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <span id="tipo-marcacion" className="text-sm font-medium">
            Registrar
          </span>
          <div role="radiogroup" aria-labelledby="tipo-marcacion" className="grid grid-cols-2 gap-2">
            {(['entrada', 'salida'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                onClick={() => {
                  setTipo(t);
                  guardarLocal(CLAVE_TIPO, t);
                  entradaRef.current?.focus();
                }}
                className={cn(
                  'inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-base font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  tipo === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
                )}
              >
                {t === 'entrada' ? <LogIn aria-hidden className="size-5" /> : <LogOut aria-hidden className="size-5" />}
                {t === 'entrada' ? 'Entrada' : 'Salida'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          'flex min-h-36 flex-col items-center justify-center gap-1 rounded-2xl border-4 p-4 text-center transition-colors sm:min-h-44',
          ultima ? ESTILO[ultima.tono] : 'border-dashed text-muted-foreground',
        )}
      >
        {ultima && IconoUltima ? (
          <>
            <IconoUltima className="size-10 sm:size-12" aria-hidden />
            <p className="text-2xl font-bold sm:text-3xl">{ultima.titulo}</p>
            <p className="text-base sm:text-lg">{ultima.detalle}</p>
            <p className="text-xs opacity-80">{formatoHora(ultima.hora)}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">Listo para leer</p>
            <p className="text-sm">
              Acerque el carnet a la cámara o al lector USB · {tipo === 'entrada' ? 'Entrada' : 'Salida'}
              {lector ? ` · ${lector.codigo}` : ''}
            </p>
          </>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="grid content-start gap-2" aria-label="Lectura por cámara">
          <div className="flex flex-wrap items-center gap-2">
            {camaraActiva ? (
              <Button variant="outline" onClick={detenerCamara}>
                <CameraOff aria-hidden /> Detener cámara
              </Button>
            ) : (
              <Button onClick={() => void iniciarCamara(camaraId || undefined)}>
                <Camera aria-hidden /> Usar cámara
              </Button>
            )}
            {camaras.length > 1 ? (
              <Select
                value={camaraId || undefined}
                onValueChange={(v) => {
                  setCamaraId(v);
                  void iniciarCamara(v);
                }}
              >
                <SelectTrigger className="w-56" aria-label="Elegir cámara">
                  <SelectValue placeholder="Cambiar cámara" />
                </SelectTrigger>
                <SelectContent>
                  {camaras.map((c, i) => (
                    <SelectItem key={c.deviceId || i} value={c.deviceId || String(i)}>
                      {c.label || `Cámara ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          {errorCamara ? (
            <p role="alert" className="text-sm text-destructive">
              {errorCamara}
            </p>
          ) : null}
          <div className={cn('relative overflow-hidden rounded-xl border bg-black', !camaraActiva && 'hidden')}>
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" />
          </div>
        </section>

        <section className="grid content-start gap-2" aria-label="Lectura con lector USB o teclado">
          <form
            className="grid gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const valor = codigo;
              setCodigo('');
              recienteRef.current = null;
              void procesar(valor);
            }}
          >
            <Label htmlFor="codigo-usb" className="flex items-center gap-1">
              <Keyboard className="size-4" aria-hidden /> Lector USB / código manual
            </Label>
            <Input
              id="codigo-usb"
              ref={entradaRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                prepararAudio();
                if (e.key === 'Tab' && codigo.trim()) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              className="h-11 font-mono text-lg tracking-wider"
              placeholder="Escanee aquí (termina con Enter)"
              aria-describedby="ayuda-usb"
            />
            <p id="ayuda-usb" className="text-xs text-muted-foreground">
              El lector USB «teclea» el código y presiona Enter. Mantenga el cursor en este campo.
            </p>
          </form>

          <h2 className="mt-2 text-sm font-semibold">Últimas lecturas</h2>
          <ul className="grid gap-1" aria-label="Últimas lecturas">
            {historial.length === 0 ? <li className="text-sm text-muted-foreground">Aún no hay lecturas.</li> : null}
            {historial.map((h) => {
              const I = ICONO[h.tono];
              return (
                <li key={h.id} className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-sm">
                  <I
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      h.tono === 'ok' ? 'text-emerald-600' : h.tono === 'error' ? 'text-red-600' : h.tono === 'offline' ? 'text-sky-600' : 'text-amber-600',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{h.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatoHora(h.hora)} · {h.detalle}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
