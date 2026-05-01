/**
 * URLs do Ambiente de Dados Nacional (ADN) da NFS-e.
 * Portal: https://www.nfse.gov.br
 *
 * A NFS-e padrao nacional usa API REST (nao SOAP).
 * Todos os municipios aderentes usam o mesmo endpoint nacional.
 */

export type NFSeEnvironment = 'homologacao' | 'producao';

const ADN_URLS: Record<NFSeEnvironment, string> = {
  homologacao: 'https://sefin.nfse.gov.br/sefinnacional',
  producao: 'https://sefin.nfse.gov.br/sefinnacional'
};

/**
 * URL base da API REST do ADN (Ambiente de Dados Nacional).
 */
export function getAdnBaseUrl(environment: NFSeEnvironment): string {
  return ADN_URLS[environment];
}

/**
 * Endpoints da API REST do ADN.
 */
export const ADN_ENDPOINTS = {
  /** Enviar DPS (Declaracao de Prestacao de Servicos) para gerar NFS-e */
  enviarDps: '/dps',
  /** Consultar NFS-e por chave de acesso */
  consultarPorChave: '/nfse',
  /** Consultar NFS-e por numero do RPS */
  consultarPorRps: '/nfse/rps',
  /** Cancelar NFS-e */
  cancelar: '/nfse/cancelar',
  /** Substituir NFS-e */
  substituir: '/nfse/substituir',
  /** Consultar DANFSe (PDF) */
  danfse: '/danfse',
  /** Eventos da NFS-e */
  eventos: '/nfse/eventos'
} as const;
