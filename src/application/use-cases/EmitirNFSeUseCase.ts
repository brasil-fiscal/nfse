import type { CertificateProvider, XmlSigner } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../../contracts/NFSeXmlBuilder';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { DPSProps } from '../../domain/dps';
import { EmitirResult } from '../../core/types';
import { NFSeRejectError, NFSeErro } from '../../shared/errors/NFSeRejectError';
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

type AdnError = {
  erros?: Array<{ Codigo?: string; Descricao?: string; Complemento?: string }>;
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

    let erros: NFSeErro[] = [];
    try {
      const body = JSON.parse(res.body) as AdnError;
      erros = (body.erros ?? []).map((e) => ({
        codigo: e.Codigo,
        descricao: e.Descricao,
        complemento: e.Complemento ?? undefined
      }));
    } catch {
      // corpo não-JSON: mantém lista vazia
    }
    throw new NFSeRejectError(res.statusCode, erros);
  }
}
