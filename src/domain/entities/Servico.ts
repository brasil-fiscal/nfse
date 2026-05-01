export type ServicoProps = {
  readonly codigoTributacaoMunicipio?: string;
  readonly itemListaServico: string;
  readonly codigoCnae?: string;
  readonly discriminacao: string;
  readonly codigoMunicipio: string;
  readonly codigoPais?: string;
  readonly exigibilidadeISS: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly municipioIncidencia?: string;
};

export type ValoresServicoProps = {
  readonly valorServicos: number;
  readonly valorDeducoes?: number;
  readonly valorPis?: number;
  readonly valorCofins?: number;
  readonly valorInss?: number;
  readonly valorIr?: number;
  readonly valorCsll?: number;
  readonly issRetido: boolean;
  readonly valorIss?: number;
  readonly valorIssRetido?: number;
  readonly outrasRetencoes?: number;
  readonly baseCalculo?: number;
  readonly aliquota?: number;
  readonly valorLiquidoNfse?: number;
  readonly descontoIncondicionado?: number;
  readonly descontoCondicionado?: number;
};
