import { DFeError } from '@brasil-fiscal/core';

export type NFSeErro = {
  readonly codigo?: string;
  readonly descricao?: string;
  readonly complemento?: string;
};

export class NFSeRejectError extends DFeError {
  constructor(
    public readonly statusCode: number,
    public readonly erros: NFSeErro[]
  ) {
    const first = erros[0];
    const detalhe = first ? `: [${first.codigo ?? ''}] ${first.descricao ?? ''}`.trimEnd() : '';
    super(`ADN rejeitou a DPS (HTTP ${statusCode})${detalhe}`);
    this.name = 'NFSeRejectError';
  }
}
