import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsultarDpsUseCase } from '../src/application/use-cases/ConsultarDpsUseCase';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';
import type { NFSeTransport, NFSeHttpResponse, NFSeBinaryResponse } from '../src/contracts/NFSeTransport';
import type { CertificateProvider, CertificateData } from '@brasil-fiscal/core';

const ID_DPS = 'DPS' + '3'.repeat(42);
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

test('execute faz GET /dps/{id} e retorna a chave da NFS-e', async () => {
  let sentUrl = '';
  const transport = transportWithGet((url) => {
    sentUrl = url;
    return { statusCode: 200, body: JSON.stringify({ chaveAcesso: CHAVE }) };
  });

  const result = await new ConsultarDpsUseCase(makeDeps(transport)).execute(ID_DPS);
  assert.equal(sentUrl, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/dps/${ID_DPS}`);
  assert.equal(result.encontrada, true);
  assert.equal(result.chaveAcesso, CHAVE);
  assert.equal(result.statusHttp, 200);
});

test('execute retorna encontrada=false em 404', async () => {
  const transport = transportWithGet(() => ({ statusCode: 404, body: '{}' }));
  const result = await new ConsultarDpsUseCase(makeDeps(transport)).execute(ID_DPS);
  assert.equal(result.encontrada, false);
  assert.equal(result.chaveAcesso, '');
  assert.equal(result.statusHttp, 404);
});

test('execute lança NFSeRejectError em erro não-2xx diferente de 404', async () => {
  const transport = transportWithGet(() => ({
    statusCode: 500,
    body: JSON.stringify({ erros: [{ Codigo: 'E9999', Descricao: 'erro' }] })
  }));
  await assert.rejects(
    () => new ConsultarDpsUseCase(makeDeps(transport)).execute(ID_DPS),
    (err: unknown) => {
      assert.ok(err instanceof NFSeRejectError);
      assert.equal(err.statusCode, 500);
      return true;
    }
  );
});
