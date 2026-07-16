import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BaixarDanfseUseCase } from '../src/application/use-cases/BaixarDanfseUseCase';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';
import type { NFSeTransport, NFSeHttpResponse, NFSeBinaryResponse } from '../src/contracts/NFSeTransport';
import type { CertificateProvider, CertificateData } from '@brasil-fiscal/core';

const CHAVE = '3'.repeat(50);

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

test('execute faz GET binário em /danfse/{chave} e retorna os bytes do PDF', async () => {
  const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]);
  let sentUrl = '';
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      throw new Error('n/a');
    },
    async get(): Promise<NFSeHttpResponse> {
      throw new Error('n/a');
    },
    async getBinary(url): Promise<NFSeBinaryResponse> {
      sentUrl = url;
      return { statusCode: 200, body: pdf };
    }
  };

  const result = await new BaixarDanfseUseCase(makeDeps(transport)).execute(CHAVE);

  assert.equal(sentUrl, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/danfse/${CHAVE}`);
  assert.ok(Buffer.isBuffer(result));
  assert.deepEqual(result, pdf);
});

test('execute lança NFSeRejectError em resposta não-2xx', async () => {
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      throw new Error('n/a');
    },
    async get(): Promise<NFSeHttpResponse> {
      throw new Error('n/a');
    },
    async getBinary(): Promise<NFSeBinaryResponse> {
      return { statusCode: 503, body: Buffer.from(JSON.stringify({ erros: [{ Codigo: 'E9998', Descricao: 'serviço indisponível' }] }), 'utf-8') };
    }
  };

  await assert.rejects(
    () => new BaixarDanfseUseCase(makeDeps(transport)).execute(CHAVE),
    (err: unknown) => {
      assert.ok(err instanceof NFSeRejectError);
      assert.equal(err.statusCode, 503);
      assert.equal(err.erros[0].codigo, 'E9998');
      return true;
    }
  );
});
