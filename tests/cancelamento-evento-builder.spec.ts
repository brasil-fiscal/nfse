import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  dataEvento: new Date('2026-04-28T22:34:48Z')
};

test('build monta pedRegEvento com namespace e infPedReg com Id PRE + chave + 101101', () => {
  const xml = new CancelamentoEventoBuilder().build(input);
  assert.match(xml, /<pedRegEvento xmlns="http:\/\/www\.sped\.fazenda\.gov\.br\/nfse" versao="1\.00">/);
  assert.match(xml, new RegExp(`<infPedReg Id="PRE${CHAVE}101101">`));
  assert.doesNotMatch(xml, /pedidoRegistroEvento/);
  assert.doesNotMatch(xml, /<pedRegEvento[^>]*Id=/);
});

test('build respeita a ordem do infPedReg (sem nPedRegEvento) e mapeia o e101101', () => {
  const xml = new CancelamentoEventoBuilder().build(input);
  assert.ok(xml.indexOf('<tpAmb>') < xml.indexOf('<verAplic>'));
  assert.ok(xml.indexOf('<dhEvento>') < xml.indexOf('<CNPJAutor>'));
  assert.ok(xml.indexOf('<CNPJAutor>') < xml.indexOf('<chNFSe>'));
  assert.ok(xml.indexOf('<chNFSe>') < xml.indexOf('<e101101>'));
  assert.doesNotMatch(xml, /nPedRegEvento/);
  assert.match(xml, new RegExp(`<chNFSe>${CHAVE}</chNFSe>`));
  assert.match(xml, /<CNPJAutor>50516724000160<\/CNPJAutor>/);
  assert.match(xml, /<e101101><xDesc>Cancelamento de NFS-e<\/xDesc><cMotivo>1<\/cMotivo><xMotivo>Cancelamento por erro na emissao da nota<\/xMotivo><\/e101101>/);
  // </infPedReg></pedRegEvento> adjacentes (necessário para o signer)
  assert.match(xml, /<\/infPedReg><\/pedRegEvento>$/);
});

test('build usa CPFAutor quando não há CNPJ', () => {
  const xml = new CancelamentoEventoBuilder().build({ ...input, autorCnpj: undefined, autorCpf: '12345678909' });
  assert.match(xml, /<CPFAutor>12345678909<\/CPFAutor>/);
  assert.doesNotMatch(xml, /<CNPJAutor>/);
});

for (const versao of ['1.00', '1.01']) {
  test(`XML gerado valida no XSD oficial pedRegEvento_v${versao}`, (t) => {
    if (spawnSync('xmllint', ['--version']).error) return t.skip('xmllint indisponível');
    const dir = mkdtempSync(join(tmpdir(), 'pedreg-'));
    const file = join(dir, 'evento.xml');
    // chave com 50 dígitos no formato real (cMun + ... ) — o XSD só exige [0-9]{50}
    writeFileSync(file, new CancelamentoEventoBuilder().build({ ...input, chaveAcesso: '51056062221952249000177000000000000826118798593760' }));
    const xsd = join(__dirname, '..', 'schemas', versao, `pedRegEvento_v${versao}.xsd`);
    const r = spawnSync('xmllint', ['--noout', '--schema', xsd, file], { encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
  });
}

test('build rejeita xMotivo fora da faixa 15-255 caracteres', () => {
  assert.throws(() => new CancelamentoEventoBuilder().build({ ...input, xMotivo: 'curto' }), /xMotivo/);
});
