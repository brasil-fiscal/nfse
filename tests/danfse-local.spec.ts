import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseNFSeXml } from '../src/infra/danfse/xml-parser';
import { GerarDanfseUseCase } from '../src/application/use-cases/GerarDanfseUseCase';

const xml = readFileSync(join(__dirname, 'fixtures', 'nfse-autorizada.xml'), 'utf-8');
const CHAVE = '51056062211222333000181000000000000126113842445389';

describe('parseNFSeXml (DANFSe v2.0)', () => {
  const d = parseNFSeXml(xml);

  it('identificação: chave, URL do QR, números e datas', () => {
    assert.equal(d.chaveAcesso, CHAVE);
    assert.equal(d.urlConsulta, `https://www.nfse.gov.br/ConsultaPublica?tpc=1&chave=${CHAVE}`);
    assert.equal(d.municipioEmissor, 'Matupá - MT');
    assert.equal(d.numeroNfse, '1');
    assert.equal(d.numeroDps, '30');
    assert.equal(d.serieDps, '1');
    assert.equal(d.competencia, '31/10/2026');
    assert.equal(d.dataEmissaoNfse, '03/11/2026 14:27:18');
    assert.equal(d.situacao, 'NFS-e Gerada');
    assert.equal(d.emitenteNfse, 'Prestador');
    assert.equal(d.homologacao, false);
  });

  it('prestador vem do <emit> da NFS-e e o regime do <regTrib> da DPS', () => {
    assert.equal(d.prestador.documento, '11.222.333/0001-81');
    assert.equal(d.prestador.nome, 'OFICINA EXEMPLO COMERCIO DE BICICLETAS LTDA');
    assert.equal(d.prestador.municipioUf, 'Matupá / MT');
    assert.equal(d.prestador.ibgeCep, '51.05606 / 78.525-000');
    assert.equal(d.prestador.endereco, 'RUA 23, 3408, CENTRO');
    assert.match(d.simplesNacional, /ME\/EPP/);
    assert.match(d.regimeApuracaoSN, /federais e municipal pelo Simples Nacional/);
  });

  it('tomador: CPF formatado, entidade XML decodificada, <end> sem confundir com <endNac>', () => {
    assert.equal(d.tomador?.documento, '529.982.247-25');
    assert.equal(d.tomador?.nome, 'Fulano de Tal & Cia');
    assert.equal(d.tomador?.endereco, 'AV. BRASIL, 100, JARDIM');
    assert.equal(d.tomador?.municipioUf, 'Matupá / MT');
    assert.equal(d.destinatario, undefined);
    assert.equal(d.intermediario, undefined);
  });

  it('valores do ISSQN saem da NFS-e (alíquota aplicada pelo município), não da DPS', () => {
    assert.equal(d.servico.codigoTributacao, '14.01.01 / -');
    assert.equal(d.servico.descricao, 'ALINHAMENTO DE GANCHEIRA');
    assert.match(d.servico.descricaoTributacao, /^Lubrificação, limpeza/);
    assert.equal(d.issqn.tipoTributacao, 'Operação Tributável');
    assert.equal(d.issqn.aliquota, '3,00 %');
    assert.equal(d.issqn.baseCalculo, 'R$ 20,00');
    assert.equal(d.issqn.valor, 'R$ 0,60');
    assert.equal(d.issqn.retencao, 'Não Retido');
    assert.equal(d.totais.valorServico, 'R$ 20,00');
    assert.equal(d.totais.valorLiquido, 'R$ 20,00');
  });

  it('pTotTribSN vira a linha da Lei 12.741', () => {
    assert.match(d.informacoesComplementares, /12\.741\/2012: 18,00 % \(Simples Nacional\)/);
  });

  it('homologação: tpAmb=2 liga a marca d\'água', () => {
    assert.equal(parseNFSeXml(xml.replace('<tpAmb>1</tpAmb>', '<tpAmb>2</tpAmb>')).homologacao, true);
  });

  it('sem tomador na DPS: tomador undefined', () => {
    assert.equal(parseNFSeXml(xml.replace(/<toma>[\s\S]*?<\/toma>/, '')).tomador, undefined);
  });

  it('rejeita XML sem infNFSe', () => {
    assert.throws(() => parseNFSeXml('<DPS/>'), /infNFSe/);
  });
});

describe('GerarDanfseUseCase', () => {
  it('gera um PDF A4 de uma página', async () => {
    const pdf = await new GerarDanfseUseCase().execute(xml);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const s = pdf.toString('latin1');
    assert.equal((s.match(/\/Type \/Page\b/g) ?? []).length, 1);
    assert.match(s, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  });

  it('rejeita o que não é XML de NFS-e', async () => {
    await assert.rejects(() => new GerarDanfseUseCase().execute('<NFe/>'), /infNFSe/);
  });
});
