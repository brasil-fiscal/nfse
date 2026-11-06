import type { CertificateProvider } from '@brasil-fiscal/core';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { NFSeRejectError } from '../../shared/errors/NFSeRejectError';
import { parseAdnErros } from '../../shared/helpers/adn-response';

export type BaixarDanfseDeps = {
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

/**
 * Baixa o PDF do DANFSe no ADN pela chave de acesso (GET /danfse/{chave}).
 * Retorna os bytes do PDF; lança NFSeRejectError em resposta não-2xx.
 *
 * OBS: o endpoint do DANFSe é instável (502/503); o XML da NFS-e (via
 * consultar()) é o documento legalmente válido.
 */
export class BaixarDanfseUseCase {
  constructor(private readonly deps: BaixarDanfseDeps) {}

  async execute(chaveAcesso: string): Promise<Buffer> {
    const { certificate, transport, baseUrl } = this.deps;

    const cert = await certificate.load();
    const res = await transport.getBinary(`${baseUrl}/danfse/${chaveAcesso}`, cert);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.body;
    }

    throw new NFSeRejectError(res.statusCode, parseAdnErros(res.body.toString('utf-8')));
  }
}
