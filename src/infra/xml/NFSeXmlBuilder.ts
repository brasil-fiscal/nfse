import { tag, tagGroup, formatNumber, formatDate } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../../contracts/NFSeXmlBuilder';
import { DPSProps } from '../../domain/dps';
import { gerarIdDps, normalizeSerieDps, normalizeNumeroDps } from '../../shared/helpers/dps-id';

const DPS_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
const DPS_VERSAO = '1.00';

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

function dataCompetencia(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export class DefaultNFSeXmlBuilder implements NFSeXmlBuilder {
  build(dps: DPSProps): string {
    const dhEmi = dps.dataEmissao ?? new Date();
    const ambiente = dps.ambiente ?? 2;
    const cLocEmi = dps.codigoMunicipioEmissor ?? '';
    const prestDoc = dps.prestador.cnpj ?? dps.prestador.cpf ?? '';
    const tpInsc: 1 | 2 = dps.prestador.cnpj ? 2 : 1;

    const id = gerarIdDps({
      codigoMunicipio: cLocEmi,
      tipoInscricao: tpInsc,
      documento: prestDoc,
      serie: dps.serie,
      numeroDps: dps.numero
    });

    const prest = tagGroup(
      'prest',
      (dps.prestador.cnpj
        ? tag('CNPJ', onlyDigits(dps.prestador.cnpj))
        : tag('CPF', onlyDigits(dps.prestador.cpf ?? ''))) +
        tag('IM', dps.prestador.inscricaoMunicipal) +
        (dps.prestador.optanteSimplesNacional !== undefined
          ? tagGroup('regTrib', tag('opSimpNac', dps.prestador.optanteSimplesNacional))
          : '')
    );

    const toma = dps.tomador
      ? tagGroup(
          'toma',
          (dps.tomador.cnpj
            ? tag('CNPJ', onlyDigits(dps.tomador.cnpj))
            : dps.tomador.cpf
              ? tag('CPF', onlyDigits(dps.tomador.cpf))
              : '') +
            tag('xNome', dps.tomador.nome) +
            tag('fone', dps.tomador.telefone) +
            tag('email', dps.tomador.email)
        )
      : '';

    const serv = tagGroup(
      'serv',
      tagGroup('locPrest', tag('cLocPrestacao', dps.servico.codigoMunicipioPrestacao)) +
        tagGroup(
          'cServ',
          tag('cTribNac', dps.servico.codigoTributacaoNacional) +
            tag('xDescServ', dps.servico.descricao)
        )
    );

    const tribMun = tagGroup(
      'tribMun',
      tag('tribISSQN', dps.valores.tributacaoISSQN ?? 1) +
        (dps.valores.retencaoISSQN !== undefined ? tag('tpRetISSQN', dps.valores.retencaoISSQN) : '')
    );
    const totTrib =
      dps.valores.percentualTotalTributosSN !== undefined
        ? tagGroup('totTrib', tag('pTotTribSN', formatNumber(dps.valores.percentualTotalTributosSN, 2)))
        : '';
    const valores = tagGroup(
      'valores',
      tagGroup('vServPrest', tag('vServ', formatNumber(dps.valores.valorServico, 2))) +
        tagGroup('trib', tribMun + totTrib)
    );

    const infDPS =
      `<infDPS Id="${id}">` +
      tag('tpAmb', ambiente) +
      tag('dhEmi', formatDate(dhEmi)) +
      tag('verAplic', dps.versaoAplicativo ?? DPS_VERSAO) +
      tag('serie', normalizeSerieDps(dps.serie)) +
      tag('nDPS', normalizeNumeroDps(dps.numero)) +
      tag('dCompet', dps.competencia ?? dataCompetencia(dhEmi)) +
      tag('tpEmit', dps.tipoEmitente ?? 1) +
      tag('cLocEmi', cLocEmi) +
      prest +
      toma +
      serv +
      valores +
      `</infDPS>`;

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<DPS xmlns="${DPS_NAMESPACE}" versao="${DPS_VERSAO}">` +
      infDPS +
      `</DPS>`
    );
  }
}
