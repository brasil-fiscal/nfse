import type { CertificateData } from '@brasil-fiscal/core';

export type NFSeHttpResponse = {
  readonly statusCode: number;
  readonly body: string;
};

export interface NFSeTransport {
  postJson(url: string, body: unknown, cert: CertificateData): Promise<NFSeHttpResponse>;
}
