import { A1CertificateProvider } from '@brasil-fiscal/core';
import type { CertificateProvider, XmlSigner } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../contracts/NFSeXmlBuilder';
import { NFSeTransport } from '../contracts/NFSeTransport';
import { DefaultNFSeXmlBuilder } from '../infra/xml/NFSeXmlBuilder';
import { NFSeXmlSigner } from '../infra/xml/NFSeXmlSigner';
import { NFSeHttpTransport } from '../infra/http/NFSeHttpTransport';
import { EmitirNFSeUseCase } from '../application/use-cases/EmitirNFSeUseCase';
import { getAdnBaseUrl, NFSeEnvironment } from '../shared/constants/adn-urls';
import { DPSProps } from '../domain/dps';
import { EmitirResult } from './types';

export type NFSeAmbiente = NFSeEnvironment; // 'homologacao' | 'producao'

export type NFSeCoreConfig = {
  readonly pfx: Buffer;
  readonly senha: string;
  readonly ambiente: NFSeAmbiente;
  readonly codigoMunicipio: string;
  readonly xmlBuilder?: NFSeXmlBuilder;
  readonly xmlSigner?: XmlSigner;
  readonly transport?: NFSeTransport;
  readonly certificate?: CertificateProvider;
};

export class NFSeCore {
  private readonly certificate: CertificateProvider;
  private readonly xmlBuilder: NFSeXmlBuilder;
  private readonly xmlSigner: XmlSigner;
  private readonly transport: NFSeTransport;
  private readonly ambiente: NFSeAmbiente;
  private readonly codigoMunicipio: string;

  private constructor(config: NFSeCoreConfig) {
    this.certificate = config.certificate ?? new A1CertificateProvider(config.pfx, config.senha);
    this.xmlBuilder = config.xmlBuilder ?? new DefaultNFSeXmlBuilder();
    this.xmlSigner = config.xmlSigner ?? new NFSeXmlSigner();
    this.transport = config.transport ?? new NFSeHttpTransport();
    this.ambiente = config.ambiente;
    this.codigoMunicipio = config.codigoMunicipio;
  }

  static create(config: NFSeCoreConfig): NFSeCore {
    return new NFSeCore(config);
  }

  /**
   * Emite uma NFS-e: monta a DPS, assina (SHA-256), comprime e envia ao ADN,
   * retornando a NFS-e autorizada.
   */
  async emitir(dps: DPSProps): Promise<EmitirResult> {
    const dpsComDefaults: DPSProps = {
      ...dps,
      ambiente: dps.ambiente ?? (this.ambiente === 'producao' ? 1 : 2),
      codigoMunicipioEmissor: dps.codigoMunicipioEmissor ?? this.codigoMunicipio
    };

    const useCase = new EmitirNFSeUseCase({
      builder: this.xmlBuilder,
      signer: this.xmlSigner,
      certificate: this.certificate,
      transport: this.transport,
      baseUrl: getAdnBaseUrl(this.ambiente)
    });

    return useCase.execute(dpsComDefaults);
  }

  // TODO: consultar() — GET /nfse/{chave}
  // TODO: cancelar() — evento de cancelamento
  // TODO: danfse() — PDF do DANFSe
}
