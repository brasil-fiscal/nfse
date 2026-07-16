export type EmitirResult = {
  readonly autorizada: boolean;
  readonly chaveAcesso: string; // 50 dígitos, gerada pelo ADN
  readonly idDps: string;
  readonly xmlNfse: string;     // NFS-e autorizada (descomprimida)
  readonly xmlDps: string;      // DPS assinada enviada
  readonly statusHttp: number;
  readonly alertas?: unknown;
};
