import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefaultNFSeXmlBuilder } from '../src/infra/xml/NFSeXmlBuilder';
import { DPSProps } from '../src/domain/dps';

const base: DPSProps = {
  ambiente: 1,
  dataEmissao: new Date('2026-04-28T22:34:48Z'),
  serie: 1,
  numero: 1,
  codigoMunicipioEmissor: '3106200',
  prestador: { cnpj: '50516724000160', inscricaoMunicipal: '14701490012', optanteSimplesNacional: 3 },
  tomador: { cnpj: '19678493000141', nome: 'Cliente da Silva', email: 'x@y.com' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Assinatura SaaS' },
  valores: { valorServico: 169, tributacaoISSQN: 1, retencaoISSQN: 1, percentualTotalTributosSN: 6 },
};

test('emite grupo IBSCBS após valores, na ordem do XSD', () => {
  const dps: DPSProps = { ...base, ibsCbs: { finNFSe: '0', cIndOp: '000000', indDest: 0, cst: '000', cClassTrib: '000001' } };
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  assert.match(xml, /<\/valores><IBSCBS><finNFSe>0<\/finNFSe><cIndOp>000000<\/cIndOp><indDest>0<\/indDest><valores><trib><gIBSCBS><CST>000<\/CST><cClassTrib>000001<\/cClassTrib><\/gIBSCBS><\/trib><\/valores><\/IBSCBS><\/infDPS>/);
});

test('sem ibsCbs não emite o grupo (retrocompat)', () => {
  const xml = new DefaultNFSeXmlBuilder().build(base);
  assert.doesNotMatch(xml, /<IBSCBS>/);
  assert.match(xml, /<\/infDPS><\/DPS>$/);
});
