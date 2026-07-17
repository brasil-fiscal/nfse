import { tag, tagGroup, formatNumber, formatDate } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../../contracts/NFSeXmlBuilder';
import { DPSProps } from '../../domain/dps';
import { gerarIdDps, normalizeSerieDps } from '../../shared/helpers/dps-id';

const DPS_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
const DPS_VERSAO = '1.00';

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

// Elemento nDPS não aceita zero à esquerda (TSNumDPS: [1-9]{1}[0-9]{0,14}).
// O zero-padding vale só para o Id; o elemento vai com o número "cru".
function numeroDpsElemento(v: string | number): string {
  const d = onlyDigits(String(v)).replace(/^0+/, '');
  return d === '' ? '0' : d;
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

    // regTrib é obrigatório no prest e exige opSimpNac + regEspTrib (regApTribSN é opcional).
    const regTrib = tagGroup(
      'regTrib',
      tag('opSimpNac', dps.prestador.optanteSimplesNacional ?? 1) +
        (dps.prestador.regimeApuracaoSN !== undefined
          ? tag('regApTribSN', dps.prestador.regimeApuracaoSN)
          : '') +
        tag('regEspTrib', dps.prestador.regimeEspecialTributacao ?? 0)
    );

    const prest = tagGroup(
      'prest',
      (dps.prestador.cnpj
        ? tag('CNPJ', onlyDigits(dps.prestador.cnpj))
        : tag('CPF', onlyDigits(dps.prestador.cpf ?? ''))) +
        tag('IM', dps.prestador.inscricaoMunicipal) +
        regTrib
    );

    // toma (TCInfoPessoa) exige identificação (CNPJ/CPF/NIF/cNaoNIF) como 1º
    // elemento no XSD. Sem documento válido, o grupo é OMITIDO — NFS-e a
    // consumidor não identificado — para não gerar <toma> sem id (rejeição E1235).
    const tomaId = dps.tomador
      ? dps.tomador.cnpj
        ? tag('CNPJ', onlyDigits(dps.tomador.cnpj))
        : dps.tomador.cpf
          ? tag('CPF', onlyDigits(dps.tomador.cpf))
          : ''
      : '';
    const toma =
      dps.tomador && tomaId
        ? tagGroup(
            'toma',
            tomaId +
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

    // tpRetISSQN é obrigatório (TCTribMunicipal); default 1 = Não retido.
    const tribMun = tagGroup(
      'tribMun',
      tag('tribISSQN', dps.valores.tributacaoISSQN ?? 1) +
        tag('tpRetISSQN', dps.valores.retencaoISSQN ?? 1)
    );
    // totTrib é obrigatório dentro de trib; sem pTotTribSN, usa indTotTrib=0 (não informar).
    const totTrib = tagGroup(
      'totTrib',
      dps.valores.percentualTotalTributosSN !== undefined
        ? tag('pTotTribSN', formatNumber(dps.valores.percentualTotalTributosSN, 2))
        : tag('indTotTrib', 0)
    );
    const valores = tagGroup(
      'valores',
      tagGroup('vServPrest', tag('vServ', formatNumber(dps.valores.valorServico, 2))) +
        tagGroup('trib', tribMun + totTrib)
    );

    const subst = dps.substituicao
      ? tagGroup(
          'subst',
          tag('chSubstda', onlyDigits(dps.substituicao.chaveSubstituida)) +
            (dps.substituicao.cMotivo !== undefined ? tag('cMotivo', dps.substituicao.cMotivo) : '') +
            tag('xMotivo', dps.substituicao.xMotivo)
        )
      : '';

    const infDPS =
      `<infDPS Id="${id}">` +
      tag('tpAmb', ambiente) +
      tag('dhEmi', formatDate(dhEmi)) +
      tag('verAplic', dps.versaoAplicativo ?? DPS_VERSAO) +
      tag('serie', normalizeSerieDps(dps.serie)) +
      tag('nDPS', numeroDpsElemento(dps.numero)) +
      tag('dCompet', dps.competencia ?? dataCompetencia(dhEmi)) +
      tag('tpEmit', dps.tipoEmitente ?? 1) +
      tag('cLocEmi', cLocEmi) +
      subst +
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
