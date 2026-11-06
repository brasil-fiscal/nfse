import type { CertificateProvider, XmlSigner } from '@brasil-fiscal/core';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { CancelamentoEventoBuilder } from '../../infra/xml/CancelamentoEventoBuilder';
import { CancelamentoInput } from '../../domain/evento';
import { CancelarResult } from '../../core/types';
import { NFSeRejectError } from '../../shared/errors/NFSeRejectError';
import { parseAdnErros } from '../../shared/helpers/adn-response';
import { gzipBase64, gunzipBase64 } from '../../shared/helpers/compression';

export type CancelarNFSeDeps = {
  readonly builder: CancelamentoEventoBuilder;
  readonly signer: XmlSigner;
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

/** Extrai e descomprime o primeiro campo de resposta terminado em "XmlGZipB64". */
function extractXmlEvento(body: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return '';
  }
  const key = Object.keys(parsed).find(
    (k) => k.endsWith('XmlGZipB64') && typeof parsed[k] === 'string'
  );
  return key ? gunzipBase64(parsed[key] as string) : '';
}

export class CancelarNFSeUseCase {
  constructor(private readonly deps: CancelarNFSeDeps) {}

  async execute(input: CancelamentoInput): Promise<CancelarResult> {
    const { builder, signer, certificate, transport, baseUrl } = this.deps;

    const xml = builder.build(input);
    const cert = await certificate.load();
    const signedXml = signer.sign(xml, cert);
    const pedidoRegistroEventoXmlGZipB64 = gzipBase64(signedXml);

    const res = await transport.postJson(
      `${baseUrl}/nfse/${input.chaveAcesso}/eventos`,
      { pedidoRegistroEventoXmlGZipB64 },
      cert
    );

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return {
        registrado: true,
        chaveAcesso: input.chaveAcesso,
        xmlEvento: extractXmlEvento(res.body),
        statusHttp: res.statusCode
      };
    }

    throw new NFSeRejectError(res.statusCode, parseAdnErros(res.body));
  }
}
