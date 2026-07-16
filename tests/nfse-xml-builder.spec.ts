import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefaultNFSeXmlBuilder } from '../src/infra/xml/NFSeXmlBuilder';
import { DPSProps } from '../src/domain/dps';

const dps: DPSProps = {
  ambiente: 1,
  dataEmissao: new Date('2026-04-28T22:34:48Z'),
  serie: 1,
  numero: 1,
  codigoMunicipioEmissor: '3106200',
  prestador: { cnpj: '50516724000160', inscricaoMunicipal: '14701490012', optanteSimplesNacional: 3 },
  tomador: { cnpj: '19678493000141', nome: 'Cliente da Silva', email: 'x@y.com' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Assinatura SaaS' },
  valores: { valorServico: 169, tributacaoISSQN: 1, retencaoISSQN: 1, percentualTotalTributosSN: 6 }
};

test('build monta DPS com namespace, versao e infDPS com Id', () => {
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  assert.match(xml, /<DPS xmlns="http:\/\/www\.sped\.fazenda\.gov\.br\/nfse" versao="1\.00">/);
  assert.match(xml, /<infDPS Id="DPS[0-9]{42}">/);
  // Id NÃO aparece na raiz DPS
  assert.doesNotMatch(xml, /<DPS[^>]*Id=/);
});

test('build respeita a ordem do XSD e mapeia os campos', () => {
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  // ordem: tpAmb ... cLocEmi < prest < serv < valores
  assert.ok(xml.indexOf('<tpAmb>') < xml.indexOf('<dhEmi>'));
  assert.ok(xml.indexOf('<cLocEmi>') < xml.indexOf('<prest>'));
  assert.ok(xml.indexOf('<prest>') < xml.indexOf('<serv>'));
  assert.ok(xml.indexOf('<serv>') < xml.indexOf('<valores>'));
  assert.match(xml, /<prest><CNPJ>50516724000160<\/CNPJ><IM>14701490012<\/IM><regTrib><opSimpNac>3<\/opSimpNac><\/regTrib><\/prest>/);
  assert.match(xml, /<cServ><cTribNac>010501<\/cTribNac><xDescServ>Assinatura SaaS<\/xDescServ><\/cServ>/);
  assert.match(xml, /<vServPrest><vServ>169\.00<\/vServ><\/vServPrest>/);
  assert.match(xml, /<tribMun><tribISSQN>1<\/tribISSQN><tpRetISSQN>1<\/tpRetISSQN><\/tribMun>/);
  assert.match(xml, /<totTrib><pTotTribSN>6\.00<\/pTotTribSN><\/totTrib>/);
  // </infDPS></DPS> adjacentes (necessário para o signer)
  assert.match(xml, /<\/infDPS><\/DPS>$/);
});

test('serie e nDPS dos elementos são idênticos aos do Id (zero-padding igual, exigência do ADN)', () => {
  const xml = new DefaultNFSeXmlBuilder().build({ ...dps, serie: 1, numero: 1 });

  const id = xml.match(/<infDPS Id="(DPS[0-9]{42})">/)![1];
  const serieId = id.slice(25, 30); // após DPS(3)+cMun(7)+tpInsc(1)+doc(14) = índice 25, 5 dígitos
  const nDpsId = id.slice(30); // últimos 15 dígitos

  assert.equal(serieId, '00001');
  assert.equal(nDpsId, '000000000000001');

  // os elementos precisam bater EXATAMENTE com os trechos do Id
  assert.match(xml, new RegExp(`<serie>${serieId}</serie>`));
  assert.match(xml, new RegExp(`<nDPS>${nDpsId}</nDPS>`));
});

test('build sem substituicao não emite o grupo subst', () => {
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  assert.doesNotMatch(xml, /<subst>/);
});

test('build emite o grupo subst (chSubstda) após cLocEmi na NFS-e substituta', () => {
  const chSubst = '4'.repeat(50);
  const xml = new DefaultNFSeXmlBuilder().build({
    ...dps,
    substituicao: { chaveSubstituida: chSubst, cMotivo: 1, xMotivo: 'Correcao de valores' }
  });
  assert.match(xml, new RegExp(`<subst><chSubstda>${chSubst}</chSubstda><cMotivo>1</cMotivo><xMotivo>Correcao de valores</xMotivo></subst>`));
  // subst vem depois de cLocEmi e antes de prest
  assert.ok(xml.indexOf('<cLocEmi>') < xml.indexOf('<subst>'));
  assert.ok(xml.indexOf('<subst>') < xml.indexOf('<prest>'));
});
