import 'server-only';
import bwipjs from 'bwip-js';

// Imágenes PNG (data URI) del QR y del Code 128 del MISMO token, generadas con bwip-js.

async function png(opciones: bwipjs.RenderOptions & Record<string, unknown>): Promise<string> {
  const buffer = await bwipjs.toBuffer(opciones);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/** QR (modo alfanumérico, corrección M) del token. */
export function imagenQr(token: string): Promise<string> {
  return png({ bcid: 'qrcode', text: token, scale: 6, eclevel: 'M', paddingwidth: 2, paddingheight: 2, backgroundcolor: 'FFFFFF' });
}

/** Code 128 del token, sin texto legible (minimización: el carnet no muestra el token en claro). */
export function imagenCode128(token: string): Promise<string> {
  return png({ bcid: 'code128', text: token, scale: 3, height: 9, includetext: false, paddingwidth: 6, backgroundcolor: 'FFFFFF' });
}
