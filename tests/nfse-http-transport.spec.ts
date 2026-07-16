import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NFSeHttpTransport } from '../src/infra/http/NFSeHttpTransport';
import type { CertificateData } from '@brasil-fiscal/core';

const fakeCert: CertificateData = {
  pfx: Buffer.alloc(0),
  password: '',
  notAfter: new Date('2030-01-01'),
  privateKey: '',
  certPem: ''
};

function startServer(handler: (method: string, ctype: string, body: string) => { status: number; body: string }): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const out = handler(req.method ?? '', String(req.headers['content-type'] ?? ''), Buffer.concat(chunks).toString('utf-8'));
        res.writeHead(out.status, { 'Content-Type': 'application/json' });
        res.end(out.body);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, url: `http://127.0.0.1:${port}/SefinNacional` });
    });
  });
}

test('postJson envia POST com JSON e retorna status/corpo', async () => {
  let seen = { method: '', ctype: '', body: '' };
  const { server, url } = await startServer((method, ctype, body) => {
    seen = { method, ctype, body };
    return { status: 201, body: JSON.stringify({ chaveAcesso: '123', idDps: 'NFS1', nfseXmlGZipB64: 'x' }) };
  });

  try {
    const res = await new NFSeHttpTransport().postJson(`${url}/nfse`, { dpsXmlGZipB64: 'ABC' }, fakeCert);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body).chaveAcesso, '123');
    assert.equal(seen.method, 'POST');
    assert.match(seen.ctype, /application\/json/);
    assert.deepEqual(JSON.parse(seen.body), { dpsXmlGZipB64: 'ABC' });
  } finally {
    server.close();
  }
});

test('postJson propaga status de erro sem lançar', async () => {
  const { server, url } = await startServer(() => ({ status: 400, body: JSON.stringify({ erros: [{ Codigo: 'E0712' }] }) }));
  try {
    const res = await new NFSeHttpTransport().postJson(`${url}/nfse`, {}, fakeCert);
    assert.equal(res.statusCode, 400);
    assert.match(res.body, /E0712/);
  } finally {
    server.close();
  }
});

test('get envia GET no path informado e retorna status/corpo', async () => {
  const seen: { method?: string; path?: string } = {};
  const server = createServer((req, res) => {
    seen.method = req.method;
    seen.path = req.url;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ chaveAcesso: '9'.repeat(50), nfseXmlGZipB64: 'x' }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const chave = '9'.repeat(50);

  try {
    const res = await new NFSeHttpTransport().get(`http://127.0.0.1:${port}/SefinNacional/nfse/${chave}`, fakeCert);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).chaveAcesso, chave);
    assert.equal(seen.method, 'GET');
    assert.equal(seen.path, `/SefinNacional/nfse/${chave}`);
  } finally {
    server.close();
  }
});
