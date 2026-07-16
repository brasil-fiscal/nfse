import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { NFSeCore } from '../src/core/NFSeCore';
import { gzipBase64 } from '../src/shared/helpers/compression';
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
  serie: 1,
  numero: 1,
  prestador: { cnpj: '50516724000160' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Servico' },
  valores: { valorServico: 100 }
};

test('emitir usa a URL de homologação e preenche defaults (tpAmb, cLocEmi)', async () => {
  let sentUrl = '';
  const transport: NFSeTransport = {
    async postJson(url): Promise<NFSeHttpResponse> {
      sentUrl = url;
      return { statusCode: 201, body: JSON.stringify({ chaveAcesso: '9'.repeat(50), idDps: 'NFS1', nfseXmlGZipB64: gzipBase64('<NFSe/>') }) };
    },
    async get(): Promise<NFSeHttpResponse> {
      throw new Error('não usado neste teste');
    }
  };

  const core = NFSeCore.create({
    pfx: Buffer.alloc(0),
    senha: '',
    ambiente: 'homologacao',
    codigoMunicipio: '3106200',
    certificate: fakeCertProvider(),
    transport
  });

  const result = await core.emitir(dps);
  assert.equal(sentUrl, 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse');
  assert.equal(result.autorizada, true);
  assert.equal(result.chaveAcesso, '9'.repeat(50));
});

test('consultar faz GET na URL de homologação com a chave e retorna a NFS-e', async () => {
  const chave = '7'.repeat(50);
  let sentUrl = '';
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      throw new Error('não usado neste teste');
    },
    async get(url): Promise<NFSeHttpResponse> {
      sentUrl = url;
      return { statusCode: 200, body: JSON.stringify({ chaveAcesso: chave, nfseXmlGZipB64: gzipBase64('<NFSe>x</NFSe>') }) };
    }
  };

  const core = NFSeCore.create({
    pfx: Buffer.alloc(0),
    senha: '',
    ambiente: 'homologacao',
    codigoMunicipio: '3106200',
    certificate: fakeCertProvider(),
    transport
  });

  const result = await core.consultar(chave);
  assert.equal(sentUrl, `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/${chave}`);
  assert.equal(result.encontrada, true);
  assert.equal(result.xmlNfse, '<NFSe>x</NFSe>');
});
