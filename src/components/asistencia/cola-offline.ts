'use client';
import { createStore, delMany, set, values, type UseStore } from 'idb-keyval';
import type { EventoOffline } from '@/esquemas/asistencia/marcaciones';

// Cola de lecturas capturadas sin conexión (IndexedDB vía idb-keyval), indexada por evento_uuid.
// El UUID se genera al capturar y es la clave de idempotencia en la base: reenviar no duplica.

let almacen: UseStore | null = null;
function store(): UseStore {
  almacen ??= createStore('seruna-escaner', 'cola');
  return almacen;
}

export async function encolar(evento: EventoOffline): Promise<void> {
  await set(evento.eventoUuid, evento, store());
}

export async function eventosPendientes(): Promise<EventoOffline[]> {
  const lista = (await values<EventoOffline>(store())).filter(Boolean);
  return lista.sort((a, b) => a.capturadoEn.localeCompare(b.capturadoEn));
}

export async function quitarDeCola(uuids: string[]): Promise<void> {
  if (uuids.length) await delMany(uuids, store());
}

export async function contarPendientes(): Promise<number> {
  return (await values(store())).length;
}
