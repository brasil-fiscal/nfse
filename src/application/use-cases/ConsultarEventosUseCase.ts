import type { CertificateProvider } from '@brasil-fiscal/core';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { ConsultaEventosResult } from '../../core/types';
import { NFSeRejectError, NFSeErro } from '../../shared/errors/NFSeRejectError';
import { extractGzipXmlValues } from '../../shared/helpers/adn-response';

export type ConsultarEventosDeps = {
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

type AdnError = { erros?: Array<{ Codigo?: string; Descricao?: string; Complemento?: string }> };

/**
 * Lista os eventos vinculados a uma NFS-e (GET /nfse/{chave}/eventos).
 * Retorna os XMLs de evento descomprimidos; 404 resulta em lista vazia.
 */
export class ConsultarEventosUseCase {
  constructor(private readonly deps: ConsultarEventosDeps) {}

  async execute(chaveAcesso: string): Promise<ConsultaEventosResult> {
    const { certificate, transport, baseUrl } = this.deps;

    const cert = await certificate.load();
    const res = await transport.get(`${baseUrl}/nfse/${chaveAcesso}/eventos`, cert);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      let eventos: string[] = [];
      try {
        eventos = extractGzipXmlValues(JSON.parse(res.body));
      } catch {
        // corpo não-JSON: sem eventos extraídos
      }
      return { eventos, body: res.body, statusHttp: res.statusCode };
    }

    if (res.statusCode === 404) {
      return { eventos: [], body: res.body, statusHttp: res.statusCode };
    }

    let erros: NFSeErro[] = [];
    try {
      const body = JSON.parse(res.body) as AdnError;
      erros = (body.erros ?? []).map((e) => ({
        codigo: e.Codigo,
        descricao: e.Descricao,
        complemento: e.Complemento ?? undefined
      }));
    } catch {
      // corpo não-JSON
    }
    throw new NFSeRejectError(res.statusCode, erros);
  }
}
