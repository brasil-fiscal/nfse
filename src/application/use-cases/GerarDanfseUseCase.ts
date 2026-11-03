import { DFeError } from '@brasil-fiscal/core';
import { parseNFSeXml } from '../../infra/danfse/xml-parser';
import { DanfseGenerator } from '../../infra/danfse/DanfseGenerator';
import type { DanfseOptions } from '../../infra/danfse/DanfseGenerator';

export type { DanfseData, DanfsePessoa } from '../../infra/danfse/xml-parser';
export type { DanfseOptions } from '../../infra/danfse/DanfseGenerator';

/**
 * Gera o PDF do DANFSe (leiaute v2.0 do Sistema Nacional) a partir do XML da
 * NFS-e autorizada, sem depender do endpoint /danfse do ADN (instável).
 * Não precisa de certificado. Requer `pdfkit`; `qrcode` é opcional (sem ele a
 * URL de consulta sai em texto no lugar do QR Code).
 */
export class GerarDanfseUseCase {
  private readonly generator = new DanfseGenerator();

  async execute(xmlNfse: string, options?: DanfseOptions): Promise<Buffer> {
    if (!xmlNfse || !xmlNfse.includes('<infNFSe')) {
      throw new DFeError('XML inválido: deve conter o elemento <infNFSe> da NFS-e autorizada');
    }
    return this.generator.generate(parseNFSeXml(xmlNfse), options);
  }
}
