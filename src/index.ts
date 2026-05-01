// Core
export { NFSeCore } from './core/NFSeCore';
export type { NFSeCoreConfig, NFSeAmbiente } from './core/NFSeCore';

// Domain entities
export { NFSe } from './domain/entities/NFSe';
export type { NFSeProps, NFSeIdentificacao } from './domain/entities/NFSe';
export type { PrestadorProps } from './domain/entities/Prestador';
export type { TomadorProps } from './domain/entities/Tomador';
export type { ServicoProps, ValoresServicoProps } from './domain/entities/Servico';

// URLs ADN
export { getAdnBaseUrl, ADN_ENDPOINTS } from './shared/constants/adn-urls';
export type { NFSeEnvironment } from './shared/constants/adn-urls';

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
