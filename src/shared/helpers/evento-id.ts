/** Código do tipo de evento de cancelamento da NFS-e Nacional (e101101). */
export const TP_EVENTO_CANCELAMENTO = '101101';

/**
 * Normaliza o número do pedido de registro de evento para 3 dígitos.
 * @deprecated o pedido (pedRegEvento) não leva nPedRegEvento no leiaute 1.00/1.01;
 * o número só aparece no Id do evento registrado (EVT...), atribuído pelo ADN.
 */
export function normalizeNPedRegEvento(n: string | number): string {
  return String(n).replace(/\D/g, '').padStart(3, '0');
}

export type EventoIdParams = {
  readonly chaveAcesso: string; // 50 dígitos da NFS-e
  readonly tipoEvento: string; // ex.: TP_EVENTO_CANCELAMENTO
  /** @deprecated ignorado: o Id do pedido não carrega nPedRegEvento. */
  readonly nPedRegEvento?: string | number;
};

/**
 * Gera o atributo Id do pedido de registro de evento (infPedReg):
 * "PRE" + chave(50) + tpEvento(6) — 59 caracteres, pattern `PRE[0-9]{56}`
 * (TSIdPedRegEvt, tiposSimples_v1.00/1.01.xsd).
 */
export function gerarIdEvento(params: EventoIdParams): string {
  const chave = String(params.chaveAcesso).replace(/\D/g, '');
  return `PRE${chave}${params.tipoEvento}`;
}
