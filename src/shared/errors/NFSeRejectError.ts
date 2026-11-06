import { DFeError } from '@brasil-fiscal/core';

export type NFSeErro = {
  readonly codigo?: string;
  readonly descricao?: string;
  readonly complemento?: string;
};

export class NFSeRejectError extends DFeError {
  constructor(
    public readonly statusCode: number,
    public readonly erros: NFSeErro[],
    /** Corpo cru da resposta do ADN (truncado), para log/diagnóstico. */
    public readonly corpo?: string
  ) {
    const first = erros[0];
    const detalhe = first ? `: [${first.codigo ?? ''}] ${first.descricao ?? ''}`.trimEnd() : '';
    super(`ADN rejeitou a DPS (HTTP ${statusCode})${detalhe}`);
    this.name = 'NFSeRejectError';
  }
}
