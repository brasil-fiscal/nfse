import type { CertificateProvider } from '@brasil-fiscal/core';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { ConsultaDpsResult } from '../../core/types';
import { NFSeRejectError } from '../../shared/errors/NFSeRejectError';
import { parseAdnErros } from '../../shared/helpers/adn-response';

export type ConsultarDpsDeps = {
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

type AdnConsultaDps = { chaveAcesso?: string };

/**
 * Consulta, pelo Id da DPS, a chave da NFS-e correspondente (GET /dps/{id}).
 * Retorna `encontrada: false` quando o ADN responde 404.
 */
export class ConsultarDpsUseCase {
  constructor(private readonly deps: ConsultarDpsDeps) {}

  async execute(idDps: string): Promise<ConsultaDpsResult> {
    const { certificate, transport, baseUrl } = this.deps;

    const cert = await certificate.load();
    const res = await transport.get(`${baseUrl}/dps/${idDps}`, cert);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const parsed = JSON.parse(res.body) as AdnConsultaDps;
      return { encontrada: true, chaveAcesso: parsed.chaveAcesso ?? '', statusHttp: res.statusCode };
    }

    if (res.statusCode === 404) {
      return { encontrada: false, chaveAcesso: '', statusHttp: res.statusCode };
    }

    throw new NFSeRejectError(res.statusCode, parseAdnErros(res.body));
  }
}
