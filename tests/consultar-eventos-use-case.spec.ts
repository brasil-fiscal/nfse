import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsultarEventosUseCase } from '../src/application/use-cases/ConsultarEventosUseCase';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';
import { gzipBase64 } from '../src/shared/helpers/compression';
import type { NFSeTransport, NFSeHttpResponse, NFSeBinaryResponse } from '../src/contracts/NFSeTransport';
import type { CertificateProvider, CertificateData } from '@brasil-fiscal/core';

const CHAVE = '7'.repeat(50);

function fakeCertProvider(): CertificateProvider {
  const cert: CertificateData = {
    pfx: Buffer.alloc(0),
    password: '',
    notAfter: new Date('2030-01-01'),
    privateKey: '',
    certPem: ''
  };
  return { load: async () => cert };
}

function makeDeps(transport: NFSeTransport) {
  return {
    certificate: fakeCertProvider(),
    transport,
    baseUrl: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
  };
}

function transportWithGet(fn: (url: string) => NFSeHttpResponse): NFSeTransport {
  return {
    async postJson(): Promise<NFSeHttpResponse> {
      throw new Error('n/a');
    },
    async get(url): Promise<NFSeHttpResponse> {
      return fn(url);
    },
    async getBinary(): Promise<NFSeBinaryResponse> {
      throw new Error('n/a');
    }
  };
}

test('execute faz GET /nfse/{chave}/eventos e descomprime os XMLs de evento', async () => {
  let sentUrl = '';
  const transport = transportWithGet((url) => {
    sentUrl = url;
    return {
      statusCode: 200,
      body: JSON.stringify({
        eventos: [
          { eventoXmlGZipB64: gzipBase64('<evento>1</evento>') },
          { eventoXmlGZipB64: gzipBase64('<evento>2</evento>') }
        ]
      })
    };
  });

  const result = await new ConsultarEventosUseCase(makeDeps(transport)).execute(CHAVE);
  assert.equal(sentUrl, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/${CHAVE}/eventos`);
  assert.deepEqual(result.eventos, ['<evento>1</evento>', '<evento>2</evento>']);
  assert.equal(result.statusHttp, 200);
});

test('execute retorna lista vazia em 404', async () => {
  const transport = transportWithGet(() => ({ statusCode: 404, body: '{}' }));
  const result = await new ConsultarEventosUseCase(makeDeps(transport)).execute(CHAVE);
  assert.deepEqual(result.eventos, []);
  assert.equal(result.statusHttp, 404);
});

test('execute lança NFSeRejectError em erro não-2xx diferente de 404', async () => {
  const transport = transportWithGet(() => ({
    statusCode: 500,
    body: JSON.stringify({ erros: [{ Codigo: 'E9999', Descricao: 'erro' }] })
  }));
  await assert.rejects(
    () => new ConsultarEventosUseCase(makeDeps(transport)).execute(CHAVE),
    (err: unknown) => {
      assert.ok(err instanceof NFSeRejectError);
      assert.equal(err.statusCode, 500);
      return true;
    }
  );
});
