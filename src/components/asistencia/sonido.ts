'use client';

// Retroalimentación sonora con WebAudio (sin archivos de audio). El AudioContext se crea/reanuda tras un
// gesto del usuario (clic o tecla; el lector USB "teclea", lo que también cuenta como gesto).

export type TipoSonido = 'ok' | 'aviso' | 'error' | 'offline';

let contexto: AudioContext | null = null;

export function prepararAudio(): void {
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  contexto ??= new Ctor();
  if (contexto.state === 'suspended') void contexto.resume();
}

function tono(frecuencia: number, inicio: number, duracion: number, tipo: OscillatorType = 'sine') {
  if (!contexto) return;
  const osc = contexto.createOscillator();
  const vol = contexto.createGain();
  osc.type = tipo;
  osc.frequency.value = frecuencia;
  const t0 = contexto.currentTime + inicio;
  vol.gain.setValueAtTime(0.0001, t0);
  vol.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
  vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
  osc.connect(vol).connect(contexto.destination);
  osc.start(t0);
  osc.stop(t0 + duracion + 0.02);
}

export function sonar(tipo: TipoSonido): void {
  prepararAudio();
  if (!contexto) return;
  switch (tipo) {
    case 'ok':
      tono(880, 0, 0.12);
      tono(1320, 0.1, 0.12);
      break;
    case 'aviso':
      tono(660, 0, 0.18, 'triangle');
      break;
    case 'offline':
      tono(520, 0, 0.1, 'triangle');
      tono(520, 0.16, 0.1, 'triangle');
      break;
    case 'error':
      tono(220, 0, 0.18, 'square');
      tono(180, 0.22, 0.25, 'square');
      break;
  }
  if ('vibrate' in navigator) navigator.vibrate(tipo === 'error' ? [80, 60, 80] : 60);
}
