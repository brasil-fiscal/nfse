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
  assert.match(xml, /<prest><CNPJ>50516724000160<\/CNPJ><IM>14701490012<\/IM><regTrib><opSimpNac>3<\/opSimpNac><regEspTrib>0<\/regEspTrib><\/regTrib><\/prest>/);
  assert.match(xml, /<cServ><cTribNac>010501<\/cTribNac><xDescServ>Assinatura SaaS<\/xDescServ><\/cServ>/);
  assert.match(xml, /<vServPrest><vServ>169\.00<\/vServ><\/vServPrest>/);
  assert.match(xml, /<tribMun><tribISSQN>1<\/tribISSQN><tpRetISSQN>1<\/tpRetISSQN><\/tribMun>/);
  assert.match(xml, /<totTrib><pTotTribSN>6\.00<\/pTotTribSN><\/totTrib>/);
  // </infDPS></DPS> adjacentes (necessário para o signer)
  assert.match(xml, /<\/infDPS><\/DPS>$/);
});

test('Id mantém zero-padding, mas o elemento nDPS vai SEM zero à esquerda (TSNumDPS: [1-9]{1}[0-9]{0,14})', () => {
  const xml = new DefaultNFSeXmlBuilder().build({ ...dps, serie: 1, numero: 1 });

  const id = xml.match(/<infDPS Id="(DPS[0-9]{42})">/)![1];
  const serieId = id.slice(25, 30); // após DPS(3)+cMun(7)+tpInsc(1)+doc(14) = índice 25, 5 dígitos
  const nDpsId = id.slice(30); // últimos 15 dígitos

  // o Id é de posição fixa: serie(5) + nDPS(15) zero-padded
  assert.equal(serieId, '00001');
  assert.equal(nDpsId, '000000000000001');

  // serie: elemento pode manter o zero-padding (TSSerieDPS é string 1..5)
  assert.match(xml, /<serie>00001<\/serie>/);
  // nDPS: elemento NÃO aceita zero à esquerda — vai o número cru
  assert.match(xml, /<nDPS>1<\/nDPS>/);
});

test('sem Simples Nacional/retenção: emite regEspTrib=0, tpRetISSQN=1 e totTrib com indTotTrib=0', () => {
  const xml = new DefaultNFSeXmlBuilder().build({
    ...dps,
    prestador: { cnpj: '50516724000160', inscricaoMunicipal: '14701490012' },
    valores: { valorServico: 74 }
  });
  assert.match(xml, /<regTrib><opSimpNac>1<\/opSimpNac><regEspTrib>0<\/regEspTrib><\/regTrib>/);
  assert.match(xml, /<tribMun><tribISSQN>1<\/tribISSQN><tpRetISSQN>1<\/tpRetISSQN><\/tribMun>/);
  assert.match(xml, /<totTrib><indTotTrib>0<\/indTotTrib><\/totTrib>/);
});

test('tomador sem CPF/CNPJ (só nome): OMITE o grupo toma (XSD exige identificação)', () => {
  const xml = new DefaultNFSeXmlBuilder().build({
    ...dps,
    tomador: { nome: 'Consumidor sem doc', telefone: '5566999105172' }
  });
  assert.doesNotMatch(xml, /<toma>/);
  // segue direto de </prest> para <serv>
  assert.ok(xml.indexOf('</prest>') < xml.indexOf('<serv>'));
});

test('tomador com CPF vazio/inválido: OMITE o grupo toma', () => {
  const xml = new DefaultNFSeXmlBuilder().build({
    ...dps,
    tomador: { cpf: '', nome: 'Sem doc' }
  });
  assert.doesNotMatch(xml, /<toma>/);
});

test('tomador com CPF: emite toma com <CPF>', () => {
  const xml = new DefaultNFSeXmlBuilder().build({
    ...dps,
    tomador: { cpf: '12345678909', nome: 'Fulano' }
  });
  assert.match(xml, /<toma><CPF>12345678909<\/CPF><xNome>Fulano<\/xNome><\/toma>/);
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
