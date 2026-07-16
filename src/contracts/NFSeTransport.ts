import type { CertificateData } from '@brasil-fiscal/core';

export type NFSeHttpResponse = {
  readonly statusCode: number;
  readonly body: string;
};

export type NFSeBinaryResponse = {
  readonly statusCode: number;
  readonly body: Buffer;
};

export interface NFSeTransport {
  postJson(url: string, body: unknown, cert: CertificateData): Promise<NFSeHttpResponse>;
  get(url: string, cert: CertificateData): Promise<NFSeHttpResponse>;
  getBinary(url: string, cert: CertificateData): Promise<NFSeBinaryResponse>;
}
