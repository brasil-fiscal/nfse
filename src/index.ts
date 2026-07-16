// Core
export { NFSeCore } from './core/NFSeCore';
export type { NFSeCoreConfig, NFSeAmbiente } from './core/NFSeCore';
export type { EmitirResult } from './core/types';

// Domínio (DPS)
export type {
  DPSProps,
  DPSAmbiente,
  PrestadorDPS,
  TomadorDPS,
  ServicoDPS,
  ValoresDPS
} from './domain/dps';

// Contratos
export type { NFSeXmlBuilder } from './contracts/NFSeXmlBuilder';
export type { NFSeTransport, NFSeHttpResponse } from './contracts/NFSeTransport';

// Infra
export { DefaultNFSeXmlBuilder } from './infra/xml/NFSeXmlBuilder';
export { NFSeXmlSigner } from './infra/xml/NFSeXmlSigner';
export { NFSeHttpTransport } from './infra/http/NFSeHttpTransport';

// Helpers
export { gerarIdDps } from './shared/helpers/dps-id';
export type { DpsIdParams } from './shared/helpers/dps-id';
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
