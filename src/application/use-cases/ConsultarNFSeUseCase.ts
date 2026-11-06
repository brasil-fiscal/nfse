import type { CertificateProvider } from '@brasil-fiscal/core';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { ConsultarResult } from '../../core/types';
import { NFSeRejectError } from '../../shared/errors/NFSeRejectError';
import { parseAdnErros } from '../../shared/helpers/adn-response';
import { gunzipBase64 } from '../../shared/helpers/compression';

export type ConsultarNFSeDeps = {
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

type AdnConsulta = {
  chaveAcesso?: string;
  nfseXmlGZipB64?: string;
};

export class ConsultarNFSeUseCase {
  constructor(private readonly deps: ConsultarNFSeDeps) {}

  async execute(chaveAcesso: string): Promise<ConsultarResult> {
    const { certificate, transport, baseUrl } = this.deps;

    const cert = await certificate.load();
    const res = await transport.get(`${baseUrl}/nfse/${chaveAcesso}`, cert);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const parsed = JSON.parse(res.body) as AdnConsulta;
      return {
        encontrada: true,
        chaveAcesso: parsed.chaveAcesso ?? chaveAcesso,
        xmlNfse: parsed.nfseXmlGZipB64 ? gunzipBase64(parsed.nfseXmlGZipB64) : '',
        statusHttp: res.statusCode
      };
    }

    if (res.statusCode === 404) {
      return { encontrada: false, chaveAcesso, xmlNfse: '', statusHttp: res.statusCode };
    }

    throw new NFSeRejectError(res.statusCode, parseAdnErros(res.body));
  }
}
