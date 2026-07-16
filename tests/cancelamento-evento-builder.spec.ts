import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CancelamentoEventoBuilder } from '../src/infra/xml/CancelamentoEventoBuilder';
import { CancelamentoInput } from '../src/domain/evento';

const CHAVE = '3'.repeat(50);

const input: CancelamentoInput = {
  chaveAcesso: CHAVE,
  cMotivo: 1,
  xMotivo: 'Cancelamento por erro na emissao da nota',
  autorCnpj: '50516724000160',
  ambiente: 2,
  dataEvento: new Date('2026-04-28T22:34:48Z'),
  nPedRegEvento: 1
};

test('build monta pedidoRegistroEvento com namespace e infPedReg com Id PRE', () => {
  const xml = new CancelamentoEventoBuilder().build(input);
  assert.match(xml, /<pedidoRegistroEvento xmlns="http:\/\/www\.sped\.fazenda\.gov\.br\/nfse" versao="1\.00">/);
  assert.match(xml, /<infPedReg Id="PRE[0-9]+">/);
  // Id não aparece na raiz
  assert.doesNotMatch(xml, /<pedidoRegistroEvento[^>]*Id=/);
});

test('build respeita a ordem do infPedReg e mapeia o e101101', () => {
  const xml = new CancelamentoEventoBuilder().build(input);
  assert.ok(xml.indexOf('<tpAmb>') < xml.indexOf('<verAplic>'));
  assert.ok(xml.indexOf('<dhEvento>') < xml.indexOf('<CNPJAutor>'));
  assert.ok(xml.indexOf('<CNPJAutor>') < xml.indexOf('<chNFSe>'));
  assert.ok(xml.indexOf('<chNFSe>') < xml.indexOf('<nPedRegEvento>'));
  assert.ok(xml.indexOf('<nPedRegEvento>') < xml.indexOf('<e101101>'));
  assert.match(xml, new RegExp(`<chNFSe>${CHAVE}</chNFSe>`));
  assert.match(xml, /<CNPJAutor>50516724000160<\/CNPJAutor>/);
  assert.match(xml, /<e101101><xDesc>[^<]+<\/xDesc><cMotivo>1<\/cMotivo><xMotivo>Cancelamento por erro na emissao da nota<\/xMotivo><\/e101101>/);
  // </infPedReg></pedidoRegistroEvento> adjacentes (necessário para o signer)
  assert.match(xml, /<\/infPedReg><\/pedidoRegistroEvento>$/);
});

test('build usa CPFAutor quando não há CNPJ', () => {
  const xml = new CancelamentoEventoBuilder().build({ ...input, autorCnpj: undefined, autorCpf: '12345678909' });
  assert.match(xml, /<CPFAutor>12345678909<\/CPFAutor>/);
  assert.doesNotMatch(xml, /<CNPJAutor>/);
});

test('nPedRegEvento do elemento é idêntico ao trecho final do Id', () => {
  const xml = new CancelamentoEventoBuilder().build({ ...input, nPedRegEvento: 1 });
  const id = xml.match(/<infPedReg Id="(PRE[0-9]+)">/)![1];
  const nPedId = id.slice(-3);
  assert.equal(nPedId, '001');
  assert.match(xml, new RegExp(`<nPedRegEvento>${nPedId}</nPedRegEvento>`));
});

test('build rejeita xMotivo fora da faixa 15-255 caracteres', () => {
  assert.throws(() => new CancelamentoEventoBuilder().build({ ...input, xMotivo: 'curto' }), /xMotivo/);
});
