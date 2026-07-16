export type DpsIdParams = {
  readonly codigoMunicipio: string;
  readonly tipoInscricao: 1 | 2; // 1=CPF, 2=CNPJ
  readonly documento: string;
  readonly serie: string | number;
  readonly numeroDps: string | number;
};

/**
 * Gera o atributo Id da DPS: "DPS" + cMun(7) + tpInsc(1) + doc(14) + serie(5) + nDPS(15).
 * Resultado sempre casa com a regex DPS[0-9]{42}.
 */
export function gerarIdDps(params: DpsIdParams): string {
  const cMun = String(params.codigoMunicipio).replace(/\D/g, '').padStart(7, '0');
  const tpInsc = String(params.tipoInscricao);
  const doc = String(params.documento).replace(/\D/g, '').padStart(14, '0');
  const serie = String(params.serie).replace(/\D/g, '').padStart(5, '0');
  const nDPS = String(params.numeroDps).replace(/\D/g, '').padStart(15, '0');
  return `DPS${cMun}${tpInsc}${doc}${serie}${nDPS}`;
}
