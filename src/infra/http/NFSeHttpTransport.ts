import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import type { CertificateData } from '@brasil-fiscal/core';
import { NFSeTransport, NFSeHttpResponse, NFSeBinaryResponse } from '../../contracts/NFSeTransport';

/**
 * Transporte REST do ADN. Usa HTTPS com mTLS (certificado A1 via pfx) em produção.
 * Para URLs http:// (uso em testes locais) o certificado é ignorado.
 */
export class NFSeHttpTransport implements NFSeTransport {
  async postJson(url: string, body: unknown, cert: CertificateData): Promise<NFSeHttpResponse> {
    const res = await this.send('POST', url, cert, Buffer.from(JSON.stringify(body), 'utf-8'));
    return { statusCode: res.statusCode, body: res.body.toString('utf-8') };
  }

  async get(url: string, cert: CertificateData): Promise<NFSeHttpResponse> {
    const res = await this.send('GET', url, cert);
    return { statusCode: res.statusCode, body: res.body.toString('utf-8') };
  }

  getBinary(url: string, cert: CertificateData): Promise<NFSeBinaryResponse> {
    return this.send('GET', url, cert);
  }

  private send(
    method: 'POST' | 'GET',
    url: string,
    cert: CertificateData,
    payload?: Buffer
  ): Promise<NFSeBinaryResponse> {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';

    const headers: Record<string, string | number> = { Accept: 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }

    const options: Record<string, unknown> = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      headers
    };
    if (isHttps) {
      options.pfx = cert.pfx;
      options.passphrase = cert.password;
    }

    const doRequest = isHttps ? httpsRequest : httpRequest;

    return new Promise<NFSeBinaryResponse>((resolve, reject) => {
      const req = doRequest(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks) })
        );
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }
}
