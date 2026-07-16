export type EmitirResult = {
  readonly autorizada: boolean;
  readonly chaveAcesso: string; // 50 dígitos, gerada pelo ADN
  readonly idDps: string;
  readonly xmlNfse: string;     // NFS-e autorizada (descomprimida)
  readonly xmlDps: string;      // DPS assinada enviada
  readonly statusHttp: number;
  readonly alertas?: unknown;
};

export type ConsultarResult = {
  readonly encontrada: boolean;   // false quando o ADN responde 404
  readonly chaveAcesso: string;   // 50 dígitos
  readonly xmlNfse: string;       // NFS-e (descomprimida); vazio se não encontrada
  readonly statusHttp: number;
};
