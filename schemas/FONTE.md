# Schemas oficiais NFS-e Nacional (SEFIN/ADN)

Fonte: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
Pacote: NFSe-ESQUEMAS_XSD-v1.01-20260209.zip (baixado 2026-07-29)

- `1.01/` — layout com Reforma Tributária (IBS/CBS): grupo `trib` = tribMun + tribFed + IBSCBS + totTrib (tiposComplexos_v1.01.xsd). Ref. NT SE/CGNFS-e nº 007/2026 (LeiautesRN_RTC_IBSCBS V1.03.00).
- `1.00/` — layout anterior (pré-reforma).

Referência de bibliotecas fiscais: https://github.com/nfephp-org (sped-nfe tem o RTC IBS/CBS compartilhado; NFS-e nacional não tem lib no nfephp — schema só no gov.br).

## Implementado
- Grupo IBSCBS no DPS (filho de infDPS, apos <valores>) — tributacao integral: finNFSe/cIndOp/indDest + valores/trib/gIBSCBS(CST,cClassTrib). NT 007/2026, validado contra 1.01.
