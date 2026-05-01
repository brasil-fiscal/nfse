# @brasil-fiscal/nfse

Lib open-source em TypeScript para emissao de **NFSe (Nota Fiscal de Servico Eletronica)** no Brasil. Padrao Nacional (ADN/ABRASF). Parte do ecossistema [`@brasil-fiscal`](https://github.com/brasil-fiscal).

> **Status: Em desenvolvimento.** Entidades base e estrutura criadas. Use cases e transmissao ainda nao implementados.

## O que eh a NFS-e Padrao Nacional?

A NFS-e Padrao Nacional eh o sistema unificado de notas fiscais de servico do Brasil, gerenciado pela Receita Federal atraves do portal [nfse.gov.br](https://www.nfse.gov.br). Diferente do modelo antigo (onde cada prefeitura tinha seu proprio sistema), o padrao nacional centraliza tudo em um unico ambiente:

- **Um unico webservice** — Ambiente de Dados Nacional (ADN)
- **Um unico layout** — padrao ABRASF 2.04
- **API REST** — mais moderno que SOAP
- **Certificado digital A1** — mesmo certificado usado para NFe

## Instalacao

```bash
npm install @brasil-fiscal/nfse
```

## Estrutura planejada

```typescript
import { NFSeCore } from '@brasil-fiscal/nfse';
import { readFileSync } from 'node:fs';

const nfse = NFSeCore.create({
  pfx: readFileSync('./certificado.pfx'),
  senha: 'senha-do-certificado',
  ambiente: 'homologacao',
  codigoMunicipio: '5103403'  // Cuiaba-MT (codigo IBGE)
});

// TODO: Em desenvolvimento
// await nfse.emitir({ ... });
// await nfse.consultar('chave-acesso');
// await nfse.cancelar({ ... });
```

## Entidades disponiveis

| Entidade | Descricao |
|----------|-----------|
| `NFSe` | Documento principal com identificacao, prestador, tomador, servico, valores |
| `PrestadorProps` | Dados do prestador de servico (CNPJ, inscricao municipal, endereco) |
| `TomadorProps` | Dados do tomador do servico (CPF/CNPJ, endereco) |
| `ServicoProps` | Dados do servico (item lista, CNAE, discriminacao, exigibilidade ISS) |
| `ValoresServicoProps` | Valores e tributos (ISS, PIS, COFINS, IR, CSLL, INSS) |

## Conceitos-chave

| Termo | Descricao |
|-------|-----------|
| **ADN** | Ambiente de Dados Nacional — webservice centralizado da NFS-e |
| **DPS** | Declaracao de Prestacao de Servicos — documento enviado ao ADN para gerar a NFS-e |
| **DANFSe** | Documento Auxiliar da NFS-e — representacao impressa |
| **RPS** | Recibo Provisorio de Servicos — documento temporario antes da NFS-e ser processada |
| **ISS** | Imposto Sobre Servicos — tributo municipal |
| **Item Lista** | Codigo do servico na lista de servicos da LC 116/2003 |

## Dependencias

- [`@brasil-fiscal/core`](https://github.com/brasil-fiscal/core) — certificado digital, assinatura XML, transporte mTLS

## Ecossistema @brasil-fiscal

| Pacote | Status | Descricao |
|--------|--------|-----------|
| [@brasil-fiscal/core](https://github.com/brasil-fiscal/core) | Estavel | Infraestrutura compartilhada |
| [@brasil-fiscal/nfe](https://github.com/brasil-fiscal/nfe) | Estavel | NFe e NFC-e |
| **@brasil-fiscal/nfse** | Em desenvolvimento | NFSe (este pacote) |
| [@brasil-fiscal/cte](https://github.com/brasil-fiscal/cte) | Em desenvolvimento | CTe |
| [@brasil-fiscal/mdfe](https://github.com/brasil-fiscal/mdfe) | Em desenvolvimento | MDFe |

## Requisitos

- Node.js >= 18
- Certificado digital A1 (.pfx ou .p12)
- OpenSSL instalado

## Contribuindo

Contribuicoes sao muito bem-vindas, especialmente para implementar os use cases de emissao, consulta e cancelamento via API REST do ADN.

## Licenca

[MIT](LICENSE)
