// Core
export { NFSeCore } from './core/NFSeCore';
export type { NFSeCoreConfig, NFSeAmbiente } from './core/NFSeCore';
export type {
  EmitirResult,
  ConsultarResult,
  CancelarResult,
  ConsultaDpsResult,
  ConsultaEventosResult
} from './core/types';

// Domínio (DPS)
export type {
  DPSProps,
  DPSAmbiente,
  PrestadorDPS,
  TomadorDPS,
  ServicoDPS,
  ValoresDPS
} from './domain/dps';

// Domínio (eventos)
export type { CancelamentoInput, MotivoCancelamento } from './domain/evento';

// Contratos
export type { NFSeXmlBuilder } from './contracts/NFSeXmlBuilder';
export type { NFSeTransport, NFSeHttpResponse, NFSeBinaryResponse } from './contracts/NFSeTransport';

// Infra
export { DefaultNFSeXmlBuilder } from './infra/xml/NFSeXmlBuilder';
export { NFSeXmlSigner } from './infra/xml/NFSeXmlSigner';
export { CancelamentoEventoBuilder } from './infra/xml/CancelamentoEventoBuilder';
export { NFSeHttpTransport } from './infra/http/NFSeHttpTransport';

// Helpers
export { gerarIdDps } from './shared/helpers/dps-id';
export type { DpsIdParams } from './shared/helpers/dps-id';
export { gerarIdEvento, normalizeNPedRegEvento, TP_EVENTO_CANCELAMENTO } from './shared/helpers/evento-id';
export type { EventoIdParams } from './shared/helpers/evento-id';
export { gzipBase64, gunzipBase64 } from './shared/helpers/compression';

// URLs ADN
export { getAdnBaseUrl, ADN_ENDPOINTS } from './shared/constants/adn-urls';
export type { NFSeEnvironment } from './shared/constants/adn-urls';

// Erros
export { NFSeRejectError } from './shared/errors/NFSeRejectError';
export type { NFSeErro } from './shared/errors/NFSeRejectError';

// Re-export core utilities
export {
  A1CertificateProvider,
  DefaultXmlSigner,
  NodeHttpSefazTransport,
  DFeError,
  CertificateError,
  SefazRejectError
} from '@brasil-fiscal/core';
export type {
  CertificateProvider,
  CertificateData,
  SefazTransport,
  XmlSigner
} from '@brasil-fiscal/core';
