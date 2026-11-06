import { tag, tagGroup, formatNumber, formatDate } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../../contracts/NFSeXmlBuilder';
import { DPSProps, EnderecoTomadorDPS } from '../../domain/dps';
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

// toma.end (TCEndereco): (endNac(cMun, CEP) | endExt) xLgr nro [xCpl] xBairro.
// O choice endNac|endExt é obrigatório dentro de <end>: sem IBGE (7) + CEP (8) válidos
// o grupo inteiro é omitido (end é opcional no toma) — <end> sem endNac dá E1235 no ADN.
function buildEnderecoTomador(e?: EnderecoTomadorDPS): string {
  const lgr = e?.logradouro?.trim();
  const bairro = e?.bairro?.trim();
  if (!e || !lgr || !bairro) return '';
  const cMun = onlyDigits(e.codigoMunicipio ?? '');
  const cep = onlyDigits(e.cep ?? '');
  if (cMun.length !== 7 || cep.length !== 8) return '';
  return tagGroup(
    'end',
    tagGroup('endNac', tag('cMun', cMun) + tag('CEP', cep)) +
      tag('xLgr', lgr) +
      tag('nro', e.numero?.trim() || 'S/N') +
      tag('xCpl', e.complemento?.trim()) +
      tag('xBairro', bairro)
  );
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
              buildEnderecoTomador(dps.tomador.endereco) +
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
      this.buildIBSCBS(dps) +
      `</infDPS>`;

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<DPS xmlns="${DPS_NAMESPACE}" versao="${DPS_VERSAO}">` +
      infDPS +
      `</DPS>`
    );
  }

  private buildIBSCBS(dps: DPSProps): string {
    const ibs = dps.ibsCbs;
    if (!ibs) return '';
    const gIBSCBS = tagGroup('gIBSCBS', tag('CST', ibs.cst) + tag('cClassTrib', ibs.cClassTrib));
    const valores = tagGroup('valores', tagGroup('trib', gIBSCBS));
    return tagGroup(
      'IBSCBS',
      tag('finNFSe', ibs.finNFSe) + tag('cIndOp', ibs.cIndOp) + tag('indDest', ibs.indDest) + valores
    );
  }
}
