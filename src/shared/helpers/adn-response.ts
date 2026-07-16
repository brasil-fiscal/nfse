import { gunzipBase64 } from './compression';

/**
 * Percorre um JSON de resposta do ADN e descomprime todos os valores string
 * cujo campo termina em "XmlGZipB64" (inclusive dentro de arrays/objetos aninhados).
 * Útil para respostas de lista, como a consulta de eventos.
 */
export function extractGzipXmlValues(value: unknown): string[] {
  const out: string[] = [];

  const walk = (v: unknown, key?: string): void => {
    if (typeof v === 'string') {
      if (key && key.endsWith('XmlGZipB64')) {
        try {
          out.push(gunzipBase64(v));
        } catch {
          // valor não é gzip+base64 válido: ignora
        }
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item) => walk(item, key));
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) walk(val, k);
    }
  };

  walk(value);
  return out;
}
