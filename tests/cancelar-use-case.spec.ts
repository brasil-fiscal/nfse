import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { CancelarNFSeUseCase } from '../src/application/use-cases/CancelarNFSeUseCase';
import { CancelamentoEventoBuilder } from '../src/infra/xml/CancelamentoEventoBuilder';
import { NFSeXmlSigner } from '../src/infra/xml/NFSeXmlSigner';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';
import { gzipBase64, gunzipBase64 } from '../src/shared/helpers/compression';
import type { NFSeTransport, NFSeHttpResponse, NFSeBinaryResponse } from '../src/contracts/NFSeTransport';
import type { CertificateProvider, CertificateData } from '@brasil-fiscal/core';
import { CancelamentoInput } from '../src/domain/evento';

const CHAVE = '3'.repeat(50);

function fakeCertProvider(): CertificateProvider {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const cert: CertificateData = {
    pfx: Buffer.alloc(0),
    password: '',
    notAfter: new Date('2030-01-01'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    certPem: '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----'
  };
  return { load: async () => cert };
}

const input: CancelamentoInput = {
  chaveAcesso: CHAVE,
  cMotivo: 1,
  xMotivo: 'Cancelamento por erro na emissao da nota',
  autorCnpj: '50516724000160',
  ambiente: 2
};

function makeDeps(transport: NFSeTransport) {
  return {
    builder: new CancelamentoEventoBuilder(),
    signer: new NFSeXmlSigner('infPedReg', 'pedidoRegistroEvento'),
    certificate: fakeCertProvider(),
    transport,
    baseUrl: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
  };
}

test('execute assina infPedReg, envia ao endpoint de eventos e parseia o evento', async () => {
  let sentUrl = '';
  let sentBody: any = null;
  const transport: NFSeTransport = {
    async postJson(url, body): Promise<NFSeHttpResponse> {
      sentUrl = url;
      sentBody = body;
      return { statusCode: 200, body: JSON.stringify({ eventoXmlGZipB64: gzipBase64('<evento>ok</evento>') }) };
    },
    async get(): Promise<NFSeHttpResponse> {
      throw new Error('não usado');
    },
    async getBinary(): Promise<NFSeBinaryResponse> {
      throw new Error('não usado');
    }
  };

  const result = await new CancelarNFSeUseCase(makeDeps(transport)).execute(input);

  assert.equal(sentUrl, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/${CHAVE}/eventos`);
  const enviado = gunzipBase64(sentBody.pedidoRegistroEventoXmlGZipB64);
  assert.match(enviado, /<infPedReg Id="PRE[0-9]+">/);
  assert.match(enviado, /<Signature/);
  assert.equal(result.registrado, true);
  assert.equal(result.chaveAcesso, CHAVE);
  assert.equal(result.xmlEvento, '<evento>ok</evento>');
  assert.equal(result.statusHttp, 200);
});

test('execute lança NFSeRejectError em resposta não-2xx', async () => {
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      return { statusCode: 422, body: JSON.stringify({ erros: [{ Codigo: 'E0500', Descricao: 'evento inválido' }] }) };
    },
    async get(): Promise<NFSeHttpResponse> {
      throw new Error('não usado');
    },
    async getBinary(): Promise<NFSeBinaryResponse> {
      throw new Error('não usado');
    }
  };

  await assert.rejects(
    () => new CancelarNFSeUseCase(makeDeps(transport)).execute(input),
    (err: unknown) => {
      assert.ok(err instanceof NFSeRejectError);
      assert.equal(err.statusCode, 422);
      assert.equal(err.erros[0].codigo, 'E0500');
      return true;
    }
  );
});
