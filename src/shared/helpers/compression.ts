import { gzipSync, gunzipSync } from 'node:zlib';

/** Comprime uma string UTF-8 em GZip e devolve em Base64. */
export function gzipBase64(text: string): string {
  return gzipSync(Buffer.from(text, 'utf-8')).toString('base64');
}

/** Inverte gzipBase64: decodifica Base64 e descomprime GZip para string UTF-8. */
export function gunzipBase64(b64: string): string {
  return gunzipSync(Buffer.from(b64, 'base64')).toString('utf-8');
}
