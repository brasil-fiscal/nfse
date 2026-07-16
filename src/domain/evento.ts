/** Motivo do cancelamento: 1=Erro na emissão, 2=Serviço não prestado, 9=Outros. */
export type MotivoCancelamento = 1 | 2 | 9;

export type CancelamentoInput = {
  readonly chaveAcesso: string; // 50 dígitos da NFS-e a cancelar
  readonly cMotivo: MotivoCancelamento;
  readonly xMotivo: string; // descrição do motivo (15 a 255 caracteres)
  readonly autorCnpj?: string; // CNPJ do autor do evento
  readonly autorCpf?: string; // CPF do autor do evento (alternativa ao CNPJ)
  readonly nPedRegEvento?: number; // sequência do pedido (default 1)
  readonly ambiente?: 1 | 2; // tpAmb (default preenchido pelo NFSeCore)
  readonly dataEvento?: Date; // dhEvento (default: agora)
  readonly versaoAplicativo?: string; // verAplic (default '1.00')
};
