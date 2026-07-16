export type DpsIdParams = {
  readonly codigoMunicipio: string;
  readonly tipoInscricao: 1 | 2; // 1=CPF, 2=CNPJ
  readonly documento: string;
  readonly serie: string | number;
  readonly numeroDps: string | number;
};

/**
 * Normaliza a série da DPS para 5 dígitos (mesma forma usada no Id e no elemento <serie>).
 * A NFS-e Nacional exige série numérica (o Id casa com DPS[0-9]{42}).
 */
export function normalizeSerieDps(serie: string | number): string {
  return String(serie).replace(/\D/g, '').padStart(5, '0');
}

/**
 * Normaliza o número da DPS para 15 dígitos (mesma forma usada no Id e no elemento <nDPS>).
 * O ADN exige que o nDPS do Id seja idêntico ao conteúdo de <nDPS> — mesmo zero-padding.
 */
export function normalizeNumeroDps(numero: string | number): string {
  return String(numero).replace(/\D/g, '').padStart(15, '0');
}

/**
 * Gera o atributo Id da DPS: "DPS" + cMun(7) + tpInsc(1) + doc(14) + serie(5) + nDPS(15).
 * Resultado sempre casa com a regex DPS[0-9]{42}.
 */
export function gerarIdDps(params: DpsIdParams): string {
  const cMun = String(params.codigoMunicipio).replace(/\D/g, '').padStart(7, '0');
  const tpInsc = String(params.tipoInscricao);
  const doc = String(params.documento).replace(/\D/g, '').padStart(14, '0');
  const serie = normalizeSerieDps(params.serie);
  const nDPS = normalizeNumeroDps(params.numeroDps);
  return `DPS${cMun}${tpInsc}${doc}${serie}${nDPS}`;
}
