import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { canonicalize } from '@brasil-fiscal/core';
import { NFSeXmlSigner } from '../src/infra/xml/NFSeXmlSigner';
import { DefaultNFSeXmlBuilder } from '../src/infra/xml/NFSeXmlBuilder';
import { DPSProps } from '../src/domain/dps';

function makeCert() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    cert: {
      pfx: Buffer.alloc(0),
      password: '',
      notAfter: new Date('2030-01-01'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      certPem: '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----'
    }
  };
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

test('sign insere Signature SHA-256 irmã de infDPS', () => {
  const { cert } = makeCert();
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  const signed = new NFSeXmlSigner().sign(xml, cert);

  assert.match(signed, /<SignatureMethod Algorithm="http:\/\/www\.w3\.org\/2001\/04\/xmldsig-more#rsa-sha256"\/>/);
  assert.match(signed, /<DigestMethod Algorithm="http:\/\/www\.w3\.org\/2001\/04\/xmlenc#sha256"\/>/);
  assert.match(signed, /<Reference URI="#DPS[0-9]{42}">/);
  // Signature vem depois de </infDPS> e antes de </DPS>
  assert.ok(signed.indexOf('</infDPS>') < signed.indexOf('<Signature'));
  assert.ok(signed.indexOf('<Signature') < signed.indexOf('</DPS>'));
});

test('a assinatura é criptograficamente válida', () => {
  const { cert, publicKeyPem } = makeCert();
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  const signed = new NFSeXmlSigner().sign(xml, cert);

  const signedInfo = signed.match(/<SignedInfo[\s\S]*?<\/SignedInfo>/)![0];
  const signatureValue = signed.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)![1];

  const verifier = createVerify('RSA-SHA256');
  verifier.update(canonicalize(signedInfo));
  assert.equal(verifier.verify(publicKeyPem, signatureValue, 'base64'), true);
});

test('sign lança erro se não houver infDPS', () => {
  const { cert } = makeCert();
  assert.throws(() => new NFSeXmlSigner().sign('<DPS></DPS>', cert), /infDPS/);
});
