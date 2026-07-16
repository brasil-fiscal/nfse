import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsultarNFSeUseCase } from '../src/application/use-cases/ConsultarNFSeUseCase';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';
import { gzipBase64 } from '../src/shared/helpers/compression';
import type { NFSeTransport, NFSeHttpResponse } from '../src/contracts/NFSeTransport';
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

test('execute faz GET /nfse/{chave} e parseia a NFS-e encontrada', async () => {
  let sentUrl = '';
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      throw new Error('não deveria usar postJson');
    },
    async get(url): Promise<NFSeHttpResponse> {
      sentUrl = url;
      return { statusCode: 200, body: JSON.stringify({ chaveAcesso: CHAVE, nfseXmlGZipB64: gzipBase64('<NFSe>ok</NFSe>') }) };
    }
  };

  const result = await new ConsultarNFSeUseCase(makeDeps(transport)).execute(CHAVE);

  assert.equal(sentUrl, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/${CHAVE}`);
  assert.equal(result.encontrada, true);
  assert.equal(result.chaveAcesso, CHAVE);
  assert.equal(result.xmlNfse, '<NFSe>ok</NFSe>');
  assert.equal(result.statusHttp, 200);
});

test('execute retorna encontrada=false em 404 (sem lançar)', async () => {
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      throw new Error('n/a');
    },
    async get(): Promise<NFSeHttpResponse> {
      return { statusCode: 404, body: JSON.stringify({ erros: [{ Codigo: 'E0001', Descricao: 'não encontrada' }] }) };
    }
  };

  const result = await new ConsultarNFSeUseCase(makeDeps(transport)).execute(CHAVE);
  assert.equal(result.encontrada, false);
  assert.equal(result.chaveAcesso, CHAVE);
  assert.equal(result.xmlNfse, '');
  assert.equal(result.statusHttp, 404);
});

test('execute lança NFSeRejectError em erro não-2xx que não seja 404', async () => {
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      throw new Error('n/a');
    },
    async get(): Promise<NFSeHttpResponse> {
      return { statusCode: 500, body: JSON.stringify({ erros: [{ Codigo: 'E9999', Descricao: 'erro interno' }] }) };
    }
  };

  await assert.rejects(
    () => new ConsultarNFSeUseCase(makeDeps(transport)).execute(CHAVE),
    (err: unknown) => {
      assert.ok(err instanceof NFSeRejectError);
      assert.equal(err.statusCode, 500);
      assert.equal(err.erros[0].codigo, 'E9999');
      return true;
    }
  );
});
