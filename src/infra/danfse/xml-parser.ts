import { DFeError } from '@brasil-fiscal/core';

/**
 * Dados do DANFSe v2.0 extraídos do XML da NFS-e autorizada (leiaute NFSe v1.01).
 * Valores já formatados para impressão; ausência = '-'.
 */
export type DanfsePessoa = {
  readonly documento: string; // CNPJ/CPF formatado ou NIF
  readonly inscricaoMunicipal: string;
  readonly telefone: string;
  readonly nome: string;
  readonly municipioUf: string;
  readonly ibgeCep: string;
  readonly endereco: string;
  readonly email: string;
};

export type DanfseData = {
  readonly chaveAcesso: string;
  readonly urlConsulta: string;
  readonly municipioEmissor: string; // "Matupá - MT"
  readonly ambienteGerador: string; // ambGer
  readonly tipoAmbiente: string; // tpAmb (1=Produção, 2=Homologação)
  readonly homologacao: boolean;

  readonly numeroNfse: string;
  readonly competencia: string;
  readonly dataEmissaoNfse: string;
  readonly numeroDps: string;
  readonly serieDps: string;
  readonly dataEmissaoDps: string;
  readonly emitenteNfse: string;
  readonly situacao: string;
  readonly finalidade: string;

  readonly prestador: DanfsePessoa;
  readonly simplesNacional: string;
  readonly regimeApuracaoSN: string;
  readonly tomador?: DanfsePessoa;
  readonly destinatario?: DanfsePessoa;
  readonly intermediario?: DanfsePessoa;

  readonly servico: {
    readonly codigoTributacao: string; // "14.01.01 / -"
    readonly codigoNbs: string;
    readonly localPrestacao: string;
    readonly descricaoTributacao: string; // xTribNac
    readonly descricao: string; // xDescServ
  };

  readonly issqn: {
    readonly tipoTributacao: string;
    readonly municipioIncidencia: string;
    readonly baseCalculo: string;
    readonly aliquota: string;
    readonly retencao: string;
    readonly valor: string;
  };

  readonly federal: {
    readonly irrf: string;
    readonly contribuicaoPrevidenciaria: string;
    readonly contribuicoesSociais: string;
    readonly pis: string;
    readonly cofins: string;
  };

  readonly ibsCbs: {
    readonly cstClassTrib: string;
    readonly indicadorOperacao: string;
    readonly exclusoesReducoes: string;
    readonly baseCalculo: string;
    readonly reducaoAliquotas: string;
    readonly aliquotasIbs: string;
    readonly aliqEfetivaMun: string;
    readonly valorMun: string;
    readonly aliqEfetivaUf: string;
    readonly valorUf: string;
    readonly totalIbs: string;
    readonly aliquotaCbs: string;
    readonly aliqEfetivaCbs: string;
    readonly totalCbs: string;
  };

  readonly totais: {
    readonly valorServico: string;
    readonly descontoIncondicionado: string;
    readonly descontoCondicionado: string;
    readonly totalRetencoes: string;
    readonly valorLiquido: string;
    readonly totalIbsCbs: string;
    readonly valorLiquidoComIbsCbs: string;
  };

  readonly informacoesComplementares: string;
};

const URL_CONSULTA = 'https://www.nfse.gov.br/ConsultaPublica?tpc=1&chave=';

const AMBIENTE_GERADOR: Record<string, string> = { '1': 'Prefeitura', '2': 'Sistema Nacional da NFS-e' };
const SITUACAO: Record<string, string> = {
  '100': 'NFS-e Gerada',
  '102': 'NFS-e de Decisão Judicial',
  '103': 'NFS-e Avulsa',
  '107': 'NFS-e MEI'
};
const EMITENTE_DPS: Record<string, string> = { '1': 'Prestador', '2': 'Tomador', '3': 'Intermediário' };
const OP_SIMP_NAC: Record<string, string> = {
  '1': 'Não Optante',
  '2': 'Optante - Microempreendedor Individual (MEI)',
  '3': 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)'
};
const REG_AP_TRIB_SN: Record<string, string> = {
  '1': 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
  '2': 'Regime de apuração dos tributos federais pelo Simples Nacional e o ISSQN pela NFS-e conforme respectiva legislação municipal do tributo',
  '3': 'Regime de apuração dos tributos federais e municipal pela NFS-e conforme respectivas legislações federal e municipal de cada tributo'
};
const TRIB_ISSQN: Record<string, string> = {
  '1': 'Operação Tributável',
  '2': 'Imunidade',
  '3': 'Exportação de Serviço',
  '4': 'Não Incidência'
};
const RET_ISSQN: Record<string, string> = {
  '1': 'Não Retido',
  '2': 'Retido pelo Tomador',
  '3': 'Retido pelo Intermediário'
};
const FIN_NFSE: Record<string, string> = { '0': 'NFS-e regular' };

// ── helpers de XML (regex: o XML vem do ADN, sem prefixo de namespace) ──

function unescapeXml(v: string): string {
  return v
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Conteúdo de <tag>…</tag> (só nome exato: <end> não casa <endNac>). */
function tag(xml: string, name: string): string | undefined {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`));
  return m ? unescapeXml(m[1]).trim() || undefined : undefined;
}

/** Bloco <tag …>…</tag> (primeira ocorrência, com o próprio elemento). */
function block(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`));
  return m ? m[0] : '';
}

function attr(xml: string, name: string, attribute: string): string | undefined {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]+)"`));
  return m?.[1];
}

// ── formatação ──

const dash = (v?: string) => (v && v.trim() ? v : '-');

function money(v?: string): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(v?: string): string {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
}

/** "2026-11-03T14:27:18-03:00" → "03/11/2026 14:27:18" (no fuso em que veio). */
function dateTime(v?: string): string {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : '-';
}

function date(v?: string): string {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
}

function documento(xml: string): string {
  const cnpj = tag(xml, 'CNPJ');
  if (cnpj) return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  const cpf = tag(xml, 'CPF');
  if (cpf) return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return dash(tag(xml, 'NIF'));
}

const cep = (v?: string) => (v ? v.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : undefined);
const ibge = (v?: string) => (v ? v.replace(/^(\d{2})(\d{5})$/, '$1.$2') : undefined);
const joinDash = (...parts: (string | undefined)[]) => parts.map(dash).join(' / ');

/** "140101" → "14.01.01" */
const codTribNac = (v?: string) => (v ? v.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3') : undefined);

function pessoa(xml: string, municipio: (cMun?: string) => string | undefined): DanfsePessoa {
  const end = block(xml, 'end');
  const endNac = block(end, 'endNac');
  const cMun = tag(endNac, 'cMun');
  const logradouro = [tag(end, 'xLgr'), tag(end, 'nro'), tag(end, 'xCpl'), tag(end, 'xBairro')].filter(Boolean).join(', ');
  return {
    documento: documento(xml),
    inscricaoMunicipal: dash(tag(xml, 'IM')),
    telefone: dash(tag(xml, 'fone')),
    nome: dash(tag(xml, 'xNome')),
    municipioUf: municipio(cMun) ?? '-',
    ibgeCep: cMun || tag(endNac, 'CEP') ? joinDash(ibge(cMun), cep(tag(endNac, 'CEP'))) : '-',
    endereco: dash(logradouro),
    email: dash(tag(xml, 'email'))
  };
}

const sum = (...v: (string | undefined)[]) => {
  const nums = v.filter((x): x is string => x != null && x !== '').map(Number);
  return nums.length ? String(nums.reduce((a, b) => a + b, 0)) : undefined;
};

export function parseNFSeXml(xml: string): DanfseData {
  const infNFSe = block(xml, 'infNFSe');
  if (!infNFSe) throw new DFeError('XML inválido: elemento <infNFSe> não encontrado');

  const chaveAcesso = (attr(xml, 'infNFSe', 'Id') ?? '').replace(/^NFS/, '');
  if (!/^\d{50}$/.test(chaveAcesso)) {
    throw new DFeError('XML inválido: chave de acesso não encontrada em infNFSe[@Id]');
  }

  // A DPS assinada vem embutida: separa para não confundir <valores>/<IBSCBS> das duas.
  const dps = block(infNFSe, 'DPS');
  const nfse = dps ? infNFSe.replace(dps, '') : infNFSe;
  const infDPS = block(dps, 'infDPS');

  const emit = block(nfse, 'emit');
  const enderEmit = block(emit, 'enderNac');
  const valNfse = block(nfse, 'valores');
  const ibsNfse = block(nfse, 'IBSCBS');

  const prest = block(infDPS, 'prest');
  const regTrib = block(prest, 'regTrib');
  const toma = block(infDPS, 'toma');
  const interm = block(infDPS, 'interm');
  const serv = block(infDPS, 'serv');
  const cServ = block(serv, 'cServ');
  const valDps = block(infDPS, 'valores');
  const tribMun = block(valDps, 'tribMun');
  const tribFed = block(valDps, 'tribFed');
  const piscofins = block(tribFed, 'piscofins');
  const totTrib = block(valDps, 'totTrib');
  const ibsDps = block(infDPS, 'IBSCBS');
  const dest = block(ibsDps, 'dest');
  const gIBSCBS = block(ibsDps, 'gIBSCBS');

  const ufEmit = tag(enderEmit, 'UF');
  const cMunEmit = tag(enderEmit, 'cMun');
  const xLocEmi = tag(nfse, 'xLocEmi');
  // O XML só traz nome de município para emissão, prestação e incidência; os demais saem pelo código.
  const nomes = new Map<string, string>();
  const cLocEmi = tag(infDPS, 'cLocEmi');
  if (cLocEmi && xLocEmi) nomes.set(cLocEmi, xLocEmi);
  const cLocPrest = tag(block(serv, 'locPrest'), 'cLocPrestacao');
  const xLocPrest = tag(nfse, 'xLocPrestacao');
  if (cLocPrest && xLocPrest) nomes.set(cLocPrest, xLocPrest);
  const cLocIncid = tag(nfse, 'cLocIncid');
  const xLocIncid = tag(nfse, 'xLocIncid');
  if (cLocIncid && xLocIncid) nomes.set(cLocIncid, xLocIncid);
  // UF só é conhecida para municípios da mesma UF do emitente (mesmo prefixo IBGE).
  const ufDe = (cMun?: string) => (cMun && cMunEmit && cMun.slice(0, 2) === cMunEmit.slice(0, 2) ? ufEmit : undefined);
  const municipio = (cMun?: string) => {
    if (!cMun) return undefined;
    const nome = nomes.get(cMun);
    return nome ? `${nome} / ${dash(ufDe(cMun))}` : undefined;
  };

  const tpAmb = tag(infDPS, 'tpAmb') ?? '1';
  const logrEmit = [tag(enderEmit, 'xLgr'), tag(enderEmit, 'nro'), tag(enderEmit, 'xCpl'), tag(enderEmit, 'xBairro')]
    .filter(Boolean)
    .join(', ');

  const vIBSUF = tag(block(ibsNfse, 'gIBSUFTot'), 'vIBSUF');
  const vIBSMun = tag(block(ibsNfse, 'gIBSMunTot'), 'vIBSMun');
  const vIBSTot = tag(block(ibsNfse, 'gIBS'), 'vIBSTot');
  const vCBS = tag(block(ibsNfse, 'gCBS'), 'vCBS');
  const valIbs = block(ibsNfse, 'valores');
  const ibsUf = block(valIbs, 'uf');
  const ibsMun = block(valIbs, 'mun');
  const cbsFed = block(valIbs, 'fed');
  const vServ = tag(block(valDps, 'vServPrest'), 'vServ');
  const vBCIbs = tag(valIbs, 'vBC');

  return {
    chaveAcesso,
    urlConsulta: URL_CONSULTA + chaveAcesso,
    municipioEmissor: `${dash(xLocEmi)} - ${dash(ufEmit)}`,
    ambienteGerador: dash(tag(nfse, 'ambGer')),
    tipoAmbiente: tpAmb,
    homologacao: tpAmb === '2',

    numeroNfse: dash(tag(nfse, 'nNFSe')),
    competencia: date(tag(infDPS, 'dCompet')),
    dataEmissaoNfse: dateTime(tag(nfse, 'dhProc')),
    numeroDps: dash(tag(infDPS, 'nDPS')),
    serieDps: dash(tag(infDPS, 'serie')?.replace(/^0+(?=\d)/, '')),
    dataEmissaoDps: dateTime(tag(infDPS, 'dhEmi')),
    emitenteNfse: dash(EMITENTE_DPS[tag(infDPS, 'tpEmit') ?? '']),
    situacao: dash(SITUACAO[tag(nfse, 'cStat') ?? '']),
    finalidade: dash(FIN_NFSE[tag(ibsDps, 'finNFSe') ?? '']),

    prestador: {
      documento: documento(emit),
      inscricaoMunicipal: dash(tag(emit, 'IM')),
      telefone: dash(tag(emit, 'fone')),
      nome: dash(tag(emit, 'xNome')),
      municipioUf: cMunEmit && nomes.has(cMunEmit) ? `${nomes.get(cMunEmit)} / ${dash(ufEmit)}` : dash(ufEmit),
      ibgeCep: joinDash(ibge(cMunEmit), cep(tag(enderEmit, 'CEP'))),
      endereco: dash(logrEmit),
      email: dash(tag(emit, 'email'))
    },
    simplesNacional: dash(OP_SIMP_NAC[tag(regTrib, 'opSimpNac') ?? '']),
    regimeApuracaoSN: dash(REG_AP_TRIB_SN[tag(regTrib, 'regApTribSN') ?? '']),
    tomador: toma ? pessoa(toma, municipio) : undefined,
    destinatario: dest ? pessoa(dest, municipio) : undefined,
    intermediario: interm ? pessoa(interm, municipio) : undefined,

    servico: {
      codigoTributacao: joinDash(codTribNac(tag(cServ, 'cTribNac')), tag(cServ, 'cTribMun')),
      codigoNbs: dash(tag(cServ, 'cNBS')),
      localPrestacao: cLocPrest
        ? joinDash(xLocPrest, ufDe(cLocPrest), undefined)
        : joinDash(undefined, undefined, tag(block(serv, 'locPrest'), 'cPaisPrestacao')),
      descricaoTributacao: dash(tag(nfse, 'xTribNac')),
      descricao: dash(tag(cServ, 'xDescServ'))
    },

    issqn: {
      tipoTributacao: dash(TRIB_ISSQN[tag(tribMun, 'tribISSQN') ?? '']),
      municipioIncidencia: cLocIncid ? joinDash(xLocIncid, ufDe(cLocIncid), undefined) : '-',
      baseCalculo: money(tag(valNfse, 'vBC')),
      aliquota: percent(tag(valNfse, 'pAliqAplic')),
      retencao: dash(RET_ISSQN[tag(tribMun, 'tpRetISSQN') ?? '']),
      valor: money(tag(valNfse, 'vISSQN'))
    },

    federal: {
      irrf: money(tag(tribFed, 'vRetIRRF')),
      contribuicaoPrevidenciaria: money(tag(tribFed, 'vRetCP')),
      contribuicoesSociais: money(tag(tribFed, 'vRetCSLL')),
      pis: money(tag(piscofins, 'vPis')),
      cofins: money(tag(piscofins, 'vCofins'))
    },

    ibsCbs: {
      cstClassTrib: joinDash(tag(gIBSCBS, 'CST'), tag(gIBSCBS, 'cClassTrib')),
      indicadorOperacao: joinDash(
        tag(ibsDps, 'cIndOp'),
        ibge(tag(ibsNfse, 'cLocalidadeIncid')),
        tag(ibsNfse, 'xLocalidadeIncid'),
        ufDe(tag(ibsNfse, 'cLocalidadeIncid'))
      ),
      exclusoesReducoes: vServ && vBCIbs ? money(String(Number(vServ) - Number(vBCIbs))) : '-',
      baseCalculo: money(vBCIbs),
      reducaoAliquotas: joinDash(
        tag(ibsUf, 'pRedAliqUF') ?? tag(ibsMun, 'pRedAliqMun'),
        tag(cbsFed, 'pRedAliqCBS')
      ),
      aliquotasIbs: joinDash(tag(ibsUf, 'pIBSUF'), tag(ibsMun, 'pIBSMun')),
      aliqEfetivaMun: percent(tag(ibsMun, 'pAliqEfetMun')),
      valorMun: money(vIBSMun),
      aliqEfetivaUf: percent(tag(ibsUf, 'pAliqEfetUF')),
      valorUf: money(vIBSUF),
      totalIbs: money(vIBSTot),
      aliquotaCbs: percent(tag(cbsFed, 'pCBS')),
      aliqEfetivaCbs: percent(tag(cbsFed, 'pAliqEfetCBS')),
      totalCbs: money(vCBS)
    },

    totais: {
      valorServico: money(vServ),
      descontoIncondicionado: money(tag(valDps, 'vDescIncond')),
      descontoCondicionado: money(tag(valDps, 'vDescCond')),
      totalRetencoes: money(tag(valNfse, 'vTotalRet')),
      valorLiquido: money(tag(valNfse, 'vLiq')),
      totalIbsCbs: money(sum(vIBSTot, vCBS)),
      valorLiquidoComIbsCbs: money(tag(block(ibsNfse, 'totCIBS'), 'vTotNF'))
    },

    informacoesComplementares: [
      tag(block(serv, 'infoCompl'), 'xInfComp'),
      tag(nfse, 'xOutInf'),
      totaisAproximados(totTrib)
    ]
      .filter(Boolean)
      .join('\n')
  };
}

/** Linha da Lei 12.741/2012 a partir do grupo totTrib da DPS. */
function totaisAproximados(totTrib: string): string {
  const prefixo = 'Totais aproximados dos Tributos cfe. Lei n° 12.741/2012:';
  const vTot = block(totTrib, 'vTotTrib');
  if (vTot) {
    return `${prefixo} Federais: ${money(tag(vTot, 'vTotTribFed'))}; Estaduais: ${money(tag(vTot, 'vTotTribEst'))}; Municipais: ${money(tag(vTot, 'vTotTribMun'))};`;
  }
  const pTot = block(totTrib, 'pTotTrib');
  if (pTot) {
    return `${prefixo} Federais: ${percent(tag(pTot, 'pTotTribFed'))}; Estaduais: ${percent(tag(pTot, 'pTotTribEst'))}; Municipais: ${percent(tag(pTot, 'pTotTribMun'))};`;
  }
  const pSN = tag(totTrib, 'pTotTribSN');
  if (pSN) return `${prefixo} ${percent(pSN)} (Simples Nacional);`;
  return `${prefixo} Federais: -; Estaduais: -; Municipais: -;`;
}
