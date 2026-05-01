import { PrestadorProps } from './Prestador';
import { TomadorProps } from './Tomador';
import { ServicoProps, ValoresServicoProps } from './Servico';

export type NFSeIdentificacao = {
  readonly numero?: number;
  readonly serie?: string;
  readonly tipo: 1 | 2;
  readonly dataEmissao?: Date;
  readonly competencia: string;
  readonly naturezaOperacao: 1 | 2 | 3 | 4 | 5 | 6;
  readonly optanteSimplesNacional: boolean;
  readonly incentivadorCultural: boolean;
  readonly ambiente?: 1 | 2;
};

export type NFSeProps = {
  readonly identificacao: NFSeIdentificacao;
  readonly prestador: PrestadorProps;
  readonly tomador?: TomadorProps;
  readonly servico: ServicoProps;
  readonly valores: ValoresServicoProps;
  readonly informacoesComplementares?: string;
};

export class NFSe {
  public readonly identificacao: NFSeIdentificacao;
  public readonly prestador: PrestadorProps;
  public readonly tomador?: TomadorProps;
  public readonly servico: ServicoProps;
  public readonly valores: ValoresServicoProps;
  public readonly informacoesComplementares?: string;

  constructor(props: NFSeProps) {
    this.identificacao = {
      ...props.identificacao,
      dataEmissao: props.identificacao.dataEmissao ?? new Date()
    };
    this.prestador = props.prestador;
    this.tomador = props.tomador;
    this.servico = props.servico;
    this.valores = props.valores;
    this.informacoesComplementares = props.informacoesComplementares;
  }
}
