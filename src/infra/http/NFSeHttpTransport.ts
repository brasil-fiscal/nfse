import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import type { CertificateData } from '@brasil-fiscal/core';
import { NFSeTransport, NFSeHttpResponse } from '../../contracts/NFSeTransport';

/**
 * Transporte REST do ADN. Usa HTTPS com mTLS (certificado A1 via pfx) em produção.
 * Para URLs http:// (uso em testes locais) o certificado é ignorado.
 */
export class NFSeHttpTransport implements NFSeTransport {
  postJson(url: string, body: unknown, cert: CertificateData): Promise<NFSeHttpResponse> {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const payload = Buffer.from(JSON.stringify(body), 'utf-8');

    const options: Record<string, unknown> = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': payload.length
      }
    };
    if (isHttps) {
      options.pfx = cert.pfx;
      options.passphrase = cert.password;
    }

    const doRequest = isHttps ? httpsRequest : httpRequest;

    return new Promise<NFSeHttpResponse>((resolve, reject) => {
      const req = doRequest(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
        );
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
