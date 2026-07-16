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

export type CancelarResult = {
  readonly registrado: boolean;   // evento aceito pelo ADN
  readonly chaveAcesso: string;   // 50 dígitos da NFS-e cancelada
  readonly xmlEvento: string;     // XML do evento retornado (descomprimido); vazio se ausente
  readonly statusHttp: number;
};

export type ConsultaDpsResult = {
  readonly encontrada: boolean;   // DPS já processada numa NFS-e?
  readonly chaveAcesso: string;   // chave da NFS-e gerada (vazio se não encontrada)
  readonly statusHttp: number;
};

export type ConsultaEventosResult = {
  readonly eventos: string[];     // XMLs de evento (descomprimidos) retornados pelo ADN
  readonly body: string;          // corpo bruto da resposta (JSON)
  readonly statusHttp: number;
};
