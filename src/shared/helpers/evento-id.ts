/** Código do tipo de evento de cancelamento da NFS-e Nacional (e101101). */
export const TP_EVENTO_CANCELAMENTO = '101101';

/**
 * Normaliza o número do pedido de registro de evento para 3 dígitos
 * (mesma forma usada no Id do PRE e no elemento <nPedRegEvento>).
 */
export function normalizeNPedRegEvento(n: string | number): string {
  return String(n).replace(/\D/g, '').padStart(3, '0');
}

export type EventoIdParams = {
  readonly chaveAcesso: string; // 50 dígitos da NFS-e
  readonly tipoEvento: string; // ex.: TP_EVENTO_CANCELAMENTO
  readonly nPedRegEvento: string | number;
};

/**
 * Gera o atributo Id do pedido de registro de evento (infPedReg):
 * "PRE" + chave(50) + tpEvento + nPedRegEvento(3).
 *
 * OBS: o formato exato (largura de tpEvento) deve ser confirmado contra o
 * XSD oficial / homologação do ADN.
 */
export function gerarIdEvento(params: EventoIdParams): string {
  const chave = String(params.chaveAcesso).replace(/\D/g, '');
  const nPedReg = normalizeNPedRegEvento(params.nPedRegEvento);
  return `PRE${chave}${params.tipoEvento}${nPedReg}`;
}
