import { A1CertificateProvider } from '@brasil-fiscal/core';
import type { CertificateProvider, XmlSigner } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../contracts/NFSeXmlBuilder';
import { NFSeTransport } from '../contracts/NFSeTransport';
import { DefaultNFSeXmlBuilder } from '../infra/xml/NFSeXmlBuilder';
import { NFSeXmlSigner } from '../infra/xml/NFSeXmlSigner';
import { NFSeHttpTransport } from '../infra/http/NFSeHttpTransport';
import { EmitirNFSeUseCase } from '../application/use-cases/EmitirNFSeUseCase';
import { ConsultarNFSeUseCase } from '../application/use-cases/ConsultarNFSeUseCase';
import { ConsultarDpsUseCase } from '../application/use-cases/ConsultarDpsUseCase';
import { ConsultarEventosUseCase } from '../application/use-cases/ConsultarEventosUseCase';
import { CancelarNFSeUseCase } from '../application/use-cases/CancelarNFSeUseCase';
import { BaixarDanfseUseCase } from '../application/use-cases/BaixarDanfseUseCase';
import { CancelamentoEventoBuilder } from '../infra/xml/CancelamentoEventoBuilder';
import { getAdnBaseUrl, NFSeEnvironment } from '../shared/constants/adn-urls';
import { DPSProps, SubstituicaoDPS } from '../domain/dps';
import { CancelamentoInput } from '../domain/evento';
import {
  EmitirResult,
  ConsultarResult,
  CancelarResult,
  ConsultaDpsResult,
  ConsultaEventosResult
} from './types';

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

  /**
   * Substitui uma NFS-e: emite uma nova DPS com o grupo `subst` (chSubstda)
   * referenciando a nota substituída. Ao processar, o ADN cancela a original.
   * Retorna o `EmitirResult` da nota substituta.
   */
  async substituir(dps: DPSProps, substituicao: SubstituicaoDPS): Promise<EmitirResult> {
    return this.emitir({ ...dps, substituicao });
  }

  /**
   * Consulta uma NFS-e no ADN pela chave de acesso (50 dígitos).
   * Retorna `encontrada: false` quando o ADN responde 404.
   */
  async consultar(chaveAcesso: string): Promise<ConsultarResult> {
    const useCase = new ConsultarNFSeUseCase({
      certificate: this.certificate,
      transport: this.transport,
      baseUrl: getAdnBaseUrl(this.ambiente)
    });

    return useCase.execute(chaveAcesso);
  }

  /**
   * Consulta, pelo Id da DPS, a chave da NFS-e gerada (GET /dps/{id}).
   * Retorna `encontrada: false` quando o ADN responde 404.
   */
  async consultarPorDps(idDps: string): Promise<ConsultaDpsResult> {
    const useCase = new ConsultarDpsUseCase({
      certificate: this.certificate,
      transport: this.transport,
      baseUrl: getAdnBaseUrl(this.ambiente)
    });

    return useCase.execute(idDps);
  }

  /**
   * Lista os eventos vinculados a uma NFS-e (GET /nfse/{chave}/eventos).
   */
  async consultarEventos(chaveAcesso: string): Promise<ConsultaEventosResult> {
    const useCase = new ConsultarEventosUseCase({
      certificate: this.certificate,
      transport: this.transport,
      baseUrl: getAdnBaseUrl(this.ambiente)
    });

    return useCase.execute(chaveAcesso);
  }

  /**
   * Cancela uma NFS-e registrando o evento de cancelamento (e101101) no ADN.
   * `input.ambiente` (tpAmb) é preenchido a partir do ambiente do NFSeCore quando omitido.
   */
  async cancelar(input: CancelamentoInput): Promise<CancelarResult> {
    const inputComDefaults: CancelamentoInput = {
      ...input,
      ambiente: input.ambiente ?? (this.ambiente === 'producao' ? 1 : 2)
    };

    const useCase = new CancelarNFSeUseCase({
      builder: new CancelamentoEventoBuilder(),
      signer: new NFSeXmlSigner('infPedReg', 'pedidoRegistroEvento'),
      certificate: this.certificate,
      transport: this.transport,
      baseUrl: getAdnBaseUrl(this.ambiente)
    });

    return useCase.execute(inputComDefaults);
  }

  /**
   * Baixa o PDF do DANFSe no ADN pela chave de acesso. Retorna os bytes do PDF.
   * O endpoint é instável (502/503); prefira o XML (via `consultar`) como cópia legal.
   */
  async danfse(chaveAcesso: string): Promise<Buffer> {
    const useCase = new BaixarDanfseUseCase({
      certificate: this.certificate,
      transport: this.transport,
      baseUrl: getAdnBaseUrl(this.ambiente)
    });

    return useCase.execute(chaveAcesso);
  }
}
