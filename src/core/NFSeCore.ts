import {
  A1CertificateProvider,
  DefaultXmlSigner,
  NodeHttpSefazTransport,
  CertificateProvider,
  XmlSigner,
  SefazTransport
} from '@brasil-fiscal/core';

export type NFSeAmbiente = 'homologacao' | 'producao';

export type NFSeCoreConfig = {
  readonly pfx: Buffer;
  readonly senha: string;
  readonly ambiente: NFSeAmbiente;
  readonly codigoMunicipio: string;
  readonly xmlSigner?: XmlSigner;
  readonly transport?: SefazTransport;
  readonly certificate?: CertificateProvider;
};

export class NFSeCore {
  private readonly certificate: CertificateProvider;
  private readonly xmlSigner: XmlSigner;
  private readonly transport: SefazTransport;
  private readonly ambiente: NFSeAmbiente;
  private readonly codigoMunicipio: string;

  private constructor(config: NFSeCoreConfig) {
    this.certificate = config.certificate ?? new A1CertificateProvider(config.pfx, config.senha);
    this.xmlSigner = config.xmlSigner ?? new DefaultXmlSigner();
    this.transport = config.transport ?? new NodeHttpSefazTransport();
    this.ambiente = config.ambiente;
    this.codigoMunicipio = config.codigoMunicipio;
  }

  static create(config: NFSeCoreConfig): NFSeCore {
    return new NFSeCore(config);
  }

  // TODO: emitir() — envia DPS para o ADN e retorna NFS-e autorizada
  // TODO: consultar() — consulta NFS-e por chave de acesso
  // TODO: consultarPorRps() — consulta NFS-e pelo numero do RPS
  // TODO: cancelar() — cancela NFS-e autorizada
  // TODO: substituir() — substitui NFS-e por nova
  // TODO: danfse() — gera PDF do DANFSe
}
