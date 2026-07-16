# @brasil-fiscal/nfse

Lib open-source em TypeScript para emissao de **NFSe (Nota Fiscal de Servico Eletronica)** no Brasil. Padrao Nacional (ADN / SEFIN Nacional). Parte do ecossistema [`@brasil-fiscal`](https://github.com/brasil-fiscal).

> **Status: Beta.** Emissao, consulta, cancelamento e download do DANFSe implementados e cobertos por testes. Os detalhes de leiaute (formato exato de alguns campos e do Id do evento) devem ser validados contra o ambiente de producao restrita do ADN antes do uso em producao.

## O que eh a NFS-e Padrao Nacional?

A NFS-e Padrao Nacional eh o sistema unificado de notas fiscais de servico do Brasil, gerenciado pela Receita Federal atraves do portal [nfse.gov.br](https://www.nfse.gov.br). Diferente do modelo antigo (onde cada prefeitura tinha seu proprio sistema), o padrao nacional centraliza tudo em um unico ambiente:

- **Um unico webservice** — Ambiente de Dados Nacional (ADN) / SEFIN Nacional
- **Um unico layout** — leiaute DPS/NFS-e da RFB (namespace `http://www.sped.fazenda.gov.br/nfse`)
- **API REST** — JSON nas rotas; o documento fiscal (XML) trafega assinado, comprimido em GZip e codificado em Base64
- **Certificado digital A1** — mesmo certificado usado para NFe; conexao com mTLS

## Instalacao

```bash
npm install @brasil-fiscal/nfse
```

## Uso

```typescript
import { NFSeCore } from '@brasil-fiscal/nfse';
import { readFileSync, writeFileSync } from 'node:fs';

const nfse = NFSeCore.create({
  pfx: readFileSync('./certificado.pfx'),
  senha: 'senha-do-certificado',
  ambiente: 'homologacao',      // 'homologacao' (producao restrita) | 'producao'
  codigoMunicipio: '3106200'    // codigo IBGE do municipio emissor
});
```

### Emitir

Monta a DPS, assina (XMLDSig SHA-256), comprime e envia ao ADN.

```typescript
const resultado = await nfse.emitir({
  serie: 1,
  numero: 1,
  prestador: {
    cnpj: '50516724000160',
    inscricaoMunicipal: '14701490012',
    optanteSimplesNacional: 3        // 1=Nao, 2=MEI, 3=ME/EPP
  },
  tomador: {
    cnpj: '19678493000141',
    nome: 'Cliente da Silva',
    email: 'cliente@exemplo.com'
  },
  servico: {
    codigoMunicipioPrestacao: '3106200',
    codigoTributacaoNacional: '010501',
    descricao: 'Assinatura de software (SaaS)'
  },
  valores: {
    valorServico: 169.0,
    tributacaoISSQN: 1,              // 1=Operacao tributavel
    percentualTotalTributosSN: 6.0
  }
});

console.log(resultado.autorizada);   // true
console.log(resultado.chaveAcesso);  // 50 digitos gerados pelo ADN
writeFileSync('./nfse.xml', resultado.xmlNfse);
```

`tpAmb` (ambiente) e `cLocEmi` (municipio emissor) sao preenchidos a partir da configuracao do `NFSeCore` quando omitidos.

### Consultar

```typescript
const consulta = await nfse.consultar(resultado.chaveAcesso);
if (consulta.encontrada) {
  console.log(consulta.xmlNfse);
}
// consulta.encontrada === false quando o ADN responde 404
```

### Cancelar

Registra o evento de cancelamento (e101101).

```typescript
const cancelamento = await nfse.cancelar({
  chaveAcesso: resultado.chaveAcesso,
  cMotivo: 1,                        // 1=Erro na emissao, 2=Servico nao prestado, 9=Outros
  xMotivo: 'Cancelamento por erro na emissao da nota',  // 15 a 255 caracteres
  autorCnpj: '50516724000160'
});
console.log(cancelamento.registrado); // true
```

### DANFSe (PDF)

```typescript
const pdf = await nfse.danfse(resultado.chaveAcesso); // Buffer
writeFileSync('./danfse.pdf', pdf);
```

> O endpoint do DANFSe do ADN e instavel (502/503). O **XML** (via `consultar`) e o documento legalmente valido; o PDF e apenas representacao.

## API

| Metodo | Descricao | Retorno |
|--------|-----------|---------|
| `NFSeCore.create(config)` | Cria a instancia com certificado, ambiente e municipio | `NFSeCore` |
| `emitir(dps)` | Emite a NFS-e a partir da DPS | `EmitirResult` |
| `consultar(chave)` | Consulta a NFS-e por chave de acesso (50 digitos) | `ConsultarResult` |
| `cancelar(input)` | Registra o evento de cancelamento (e101101) | `CancelarResult` |
| `danfse(chave)` | Baixa o PDF do DANFSe | `Buffer` |

Respostas nao-2xx (fora 404 na consulta) lancam `NFSeRejectError` com `statusCode` e a lista de `erros` do ADN.

## Modelo de dados (DPS)

| Tipo | Descricao |
|------|-----------|
| `DPSProps` | Declaracao de Prestacao de Servicos: serie, numero, competencia, prestador, tomador, servico, valores |
| `PrestadorDPS` | Prestador (CNPJ/CPF, inscricao municipal, regime do Simples) |
| `TomadorDPS` | Tomador (CNPJ/CPF, nome, contato) |
| `ServicoDPS` | Servico (municipio de prestacao, codigo de tributacao nacional, descricao) |
| `ValoresDPS` | Valores e tributacao do ISSQN |
| `CancelamentoInput` | Dados do evento de cancelamento |

## Conceitos-chave

| Termo | Descricao |
|-------|-----------|
| **ADN** | Ambiente de Dados Nacional — webservice centralizado da NFS-e |
| **SEFIN Nacional** | API REST de emissao/consulta/eventos do padrao nacional |
| **DPS** | Declaracao de Prestacao de Servicos — documento enviado ao ADN para gerar a NFS-e |
| **DANFSe** | Documento Auxiliar da NFS-e — representacao em PDF |
| **e101101** | Evento de cancelamento da NFS-e |
| **ISS/ISSQN** | Imposto Sobre Servicos — tributo municipal |

## Dependencias

- [`@brasil-fiscal/core`](https://github.com/brasil-fiscal/core) — certificado digital, canonicalizacao/assinatura XML, helpers

## Ecossistema @brasil-fiscal

| Pacote | Status | Descricao |
|--------|--------|-----------|
| [@brasil-fiscal/core](https://github.com/brasil-fiscal/core) | Estavel | Infraestrutura compartilhada |
| [@brasil-fiscal/nfe](https://github.com/brasil-fiscal/nfe) | Estavel | NFe e NFC-e |
| **@brasil-fiscal/nfse** | Beta | NFSe (este pacote) |
| [@brasil-fiscal/cte](https://github.com/brasil-fiscal/cte) | Em desenvolvimento | CTe |
| [@brasil-fiscal/mdfe](https://github.com/brasil-fiscal/mdfe) | Em desenvolvimento | MDFe |

## Requisitos

- Node.js >= 18
- Certificado digital A1 (.pfx ou .p12)

## Contribuindo

Contribuicoes sao muito bem-vindas — em especial validacao do leiaute contra a producao restrita do ADN, substituicao de NFS-e, consulta de eventos e geracao local do DANFSe.

## Licenca

[MIT](LICENSE)
