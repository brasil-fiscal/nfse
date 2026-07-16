import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { EmitirNFSeUseCase } from '../src/application/use-cases/EmitirNFSeUseCase';
import { DefaultNFSeXmlBuilder } from '../src/infra/xml/NFSeXmlBuilder';
import { NFSeXmlSigner } from '../src/infra/xml/NFSeXmlSigner';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';
import { gzipBase64, gunzipBase64 } from '../src/shared/helpers/compression';
import type { NFSeTransport, NFSeHttpResponse } from '../src/contracts/NFSeTransport';
import type { CertificateProvider, CertificateData } from '@brasil-fiscal/core';
import { DPSProps } from '../src/domain/dps';

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

const dps: DPSProps = {
  ambiente: 2,
  dataEmissao: new Date('2026-04-28T22:34:48Z'),
  serie: 1,
  numero: 1,
  codigoMunicipioEmissor: '3106200',
  prestador: { cnpj: '50516724000160' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Servico' },
  valores: { valorServico: 100 }
};

function makeDeps(transport: NFSeTransport) {
  return {
    builder: new DefaultNFSeXmlBuilder(),
    signer: new NFSeXmlSigner(),
    certificate: fakeCertProvider(),
    transport,
    baseUrl: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
  };
}

test('execute envia DPS assinada em gzip+base64 e parseia a NFS-e autorizada', async () => {
  let sentUrl = '';
  let sentBody: any = null;
  const transport: NFSeTransport = {
    async postJson(url, body): Promise<NFSeHttpResponse> {
      sentUrl = url;
      sentBody = body;
      return {
        statusCode: 201,
        body: JSON.stringify({ chaveAcesso: '3'.repeat(50), idDps: 'NFS123', nfseXmlGZipB64: gzipBase64('<NFSe>ok</NFSe>'), alertas: null })
      };
    },
    async get(): Promise<NFSeHttpResponse> {
      throw new Error('não usado neste teste');
    }
  };

  const result = await new EmitirNFSeUseCase(makeDeps(transport)).execute(dps);

  assert.equal(sentUrl, 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse');
  // o corpo é { dpsXmlGZipB64 } e, ao descomprimir, é o XML assinado
  const enviado = gunzipBase64(sentBody.dpsXmlGZipB64);
  assert.match(enviado, /<Signature/);
  assert.match(enviado, /<infDPS Id="DPS[0-9]{42}">/);
  // resultado
  assert.equal(result.autorizada, true);
  assert.equal(result.chaveAcesso, '3'.repeat(50));
  assert.equal(result.idDps, 'NFS123');
  assert.equal(result.xmlNfse, '<NFSe>ok</NFSe>');
  assert.equal(result.statusHttp, 201);
});

test('execute lança NFSeRejectError em resposta 400', async () => {
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      return { statusCode: 400, body: JSON.stringify({ erros: [{ Codigo: 'E0712', Descricao: 'indicador inválido' }] }) };
    },
    async get(): Promise<NFSeHttpResponse> {
      throw new Error('não usado neste teste');
    }
  };
  await assert.rejects(
    () => new EmitirNFSeUseCase(makeDeps(transport)).execute(dps),
    (err: unknown) => {
      assert.ok(err instanceof NFSeRejectError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.erros[0].codigo, 'E0712');
      return true;
    }
  );
});
