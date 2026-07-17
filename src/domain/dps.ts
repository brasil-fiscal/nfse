export type DPSAmbiente = 1 | 2; // 1=Produção, 2=Homologação (tpAmb)

export type PrestadorDPS = {
  readonly cnpj?: string;
  readonly cpf?: string;
  readonly inscricaoMunicipal?: string;          // IM
  readonly optanteSimplesNacional?: 1 | 2 | 3;   // regTrib.opSimpNac (1=Não, 2=MEI, 3=ME/EPP) — default 1
  readonly regimeApuracaoSN?: 1 | 2 | 3;         // regTrib.regApTribSN (opcional, só opSimpNac=3)
  readonly regimeEspecialTributacao?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // regTrib.regEspTrib (obrigatório, default 0=Nenhum)
};

export type TomadorDPS = {
  readonly cnpj?: string;
  readonly cpf?: string;
  readonly nome?: string;      // xNome
  readonly telefone?: string;  // fone
  readonly email?: string;     // email
};

export type ServicoDPS = {
  readonly codigoMunicipioPrestacao: string;   // serv.locPrest.cLocPrestacao
  readonly codigoTributacaoNacional: string;   // serv.cServ.cTribNac
  readonly descricao: string;                  // serv.cServ.xDescServ
};

export type ValoresDPS = {
  readonly valorServico: number;                 // valores.vServPrest.vServ
  readonly tributacaoISSQN?: 1 | 2 | 3 | 4;      // valores.trib.tribMun.tribISSQN (default 1)
  readonly retencaoISSQN?: 1 | 2 | 3;            // valores.trib.tribMun.tpRetISSQN (obrigatório, default 1=Não retido)
  readonly percentualTotalTributosSN?: number;   // valores.trib.totTrib.pTotTribSN; sem ele → indTotTrib=0
};

/**
 * Grupo `subst` do infDPS: presente apenas na NFS-e substituta. Ao receber uma
 * DPS com `chSubstda` preenchida, o ADN cancela a nota original e gera a substituta.
 */
export type SubstituicaoDPS = {
  readonly chaveSubstituida: string; // chSubstda — chave (50) da NFS-e substituída
  readonly cMotivo?: number;         // cMotivo — código do motivo da substituição
  readonly xMotivo?: string;         // xMotivo — descrição do motivo
};

export type DPSProps = {
  readonly ambiente?: DPSAmbiente;               // tpAmb (default preenchido pelo NFSeCore)
  readonly dataEmissao?: Date;                   // dhEmi (default: agora)
  readonly versaoAplicativo?: string;            // verAplic (default '1.00')
  readonly serie: string | number;              // serie
  readonly numero: string | number;             // nDPS
  readonly competencia?: string;                // dCompet YYYY-MM-DD (default: data de dhEmi)
  readonly tipoEmitente?: 1 | 2 | 3;            // tpEmit (default 1)
  readonly codigoMunicipioEmissor?: string;      // cLocEmi (default: codigoMunicipio do NFSeCore)
  readonly substituicao?: SubstituicaoDPS;       // grupo subst (somente NFS-e substituta)
  readonly prestador: PrestadorDPS;
  readonly tomador?: TomadorDPS;
  readonly servico: ServicoDPS;
  readonly valores: ValoresDPS;
};
