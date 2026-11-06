import type { CertificateProvider } from '@brasil-fiscal/core';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { ConsultaEventosResult } from '../../core/types';
import { NFSeRejectError } from '../../shared/errors/NFSeRejectError';
import { extractGzipXmlValues, parseAdnErros } from '../../shared/helpers/adn-response';

export type ConsultarEventosDeps = {
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

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

    const corpo = res.body;
    throw new NFSeRejectError(res.statusCode, parseAdnErros(corpo), corpo.slice(0, 2000));
  }
}
