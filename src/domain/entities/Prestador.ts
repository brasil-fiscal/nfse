export type PrestadorProps = {
  readonly cnpj: string;
  readonly inscricaoMunicipal?: string;
  readonly nome: string;
  readonly nomeFantasia?: string;
  readonly endereco?: {
    readonly logradouro: string;
    readonly numero: string;
    readonly complemento?: string;
    readonly bairro: string;
    readonly codigoMunicipio: string;
    readonly municipio: string;
    readonly uf: string;
    readonly cep: string;
    readonly codigoPais?: string;
    readonly telefone?: string;
    readonly email?: string;
  };
};
