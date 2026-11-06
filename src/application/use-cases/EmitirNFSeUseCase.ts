import type { CertificateProvider, XmlSigner } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../../contracts/NFSeXmlBuilder';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { DPSProps } from '../../domain/dps';
import { EmitirResult } from '../../core/types';
import { NFSeRejectError } from '../../shared/errors/NFSeRejectError';
import { parseAdnErros } from '../../shared/helpers/adn-response';
import { gzipBase64, gunzipBase64 } from '../../shared/helpers/compression';

export type EmitirNFSeDeps = {
  readonly builder: NFSeXmlBuilder;
  readonly signer: XmlSigner;
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

type AdnSuccess = {
  chaveAcesso?: string;
  idDps?: string;
  nfseXmlGZipB64?: string;
  alertas?: unknown;
};

export class EmitirNFSeUseCase {
  constructor(private readonly deps: EmitirNFSeDeps) {}

  async execute(dps: DPSProps): Promise<EmitirResult> {
    const { builder, signer, certificate, transport, baseUrl } = this.deps;

    const xml = builder.build(dps);
    const cert = await certificate.load();
    const signedXml = signer.sign(xml, cert);
    const dpsXmlGZipB64 = gzipBase64(signedXml);

    const res = await transport.postJson(`${baseUrl}/nfse`, { dpsXmlGZipB64 }, cert);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const parsed = JSON.parse(res.body) as AdnSuccess;
      return {
        autorizada: true,
        chaveAcesso: parsed.chaveAcesso ?? '',
        idDps: parsed.idDps ?? '',
        xmlNfse: parsed.nfseXmlGZipB64 ? gunzipBase64(parsed.nfseXmlGZipB64) : '',
        xmlDps: signedXml,
        statusHttp: res.statusCode,
        alertas: parsed.alertas ?? undefined
      };
    }

    const corpo = res.body;
    throw new NFSeRejectError(res.statusCode, parseAdnErros(corpo), corpo.slice(0, 2000));
  }
}
