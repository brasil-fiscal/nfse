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

type NFSeErroLike = { codigo?: string; descricao?: string; complemento?: string };

function pick(o: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const [k, v] of Object.entries(o)) {
    if (names.includes(k.toLowerCase()) && v != null && v !== '') return String(v);
  }
  return undefined;
}

/**
 * Extrai a lista de erros de uma resposta não-2xx do ADN. Aceita "erros"/"Erros"/"erro"
 * (array ou objeto único) com chaves em qualquer caixa. Se nada for reconhecido, devolve
 * o corpo cru (truncado) como descrição, para o motivo real nunca ser descartado.
 */
export function parseAdnErros(body: string): NFSeErroLike[] {
  const raw = body.trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // página HTML de erro (gateway) não ajuda o usuário: mantém só o HTTP
    return raw.startsWith('<') ? [] : [{ descricao: raw.slice(0, 500) }];
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const key = Object.keys(obj).find((k) => ['erros', 'erro'].includes(k.toLowerCase()));
    const val = key ? obj[key] : undefined;
    const list = Array.isArray(val) ? val : val && typeof val === 'object' ? [val] : [];
    const erros = list
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e) => ({
        codigo: pick(e, 'codigo'),
        descricao: pick(e, 'descricao', 'mensagem', 'message'),
        complemento: pick(e, 'complemento')
      }))
      .filter((e) => e.codigo || e.descricao);
    if (erros.length) return erros;
    const msg = pick(obj, 'descricao', 'mensagem', 'message', 'title', 'detail');
    if (msg) return [{ descricao: msg }];
  }
  return [{ descricao: raw.slice(0, 500) }];
}
