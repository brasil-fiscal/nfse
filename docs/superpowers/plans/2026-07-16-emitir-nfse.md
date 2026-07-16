# Emissão de NFS-e Nacional (`emitir()`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo `NFSeCore.emitir()` ponta-a-ponta: montar a DPS em XML, assinar com XMLDSig SHA-256, comprimir (GZip+Base64) e enviar via REST/mTLS ao ADN (SEFIN Nacional), retornando a NFS-e autorizada.

**Architecture:** Arquitetura limpa igual ao pacote `nfe`: `NFSeCore` injeta dependências e delega a `EmitirNFSeUseCase`, que orquestra builder → signer → compressão → transport. Infra específica da NFS-e (signer SHA-256 e transporte REST) é **local a este pacote**; do `@brasil-fiscal/core` reutilizamos apenas `canonicalize`, helpers de XML, `CertificateProvider`/`A1CertificateProvider`, `CertificateData`, `XmlSigner` (tipo) e `DFeError`.

**Tech Stack:** TypeScript (CommonJS, target ES2022), Node >= 18, `node:crypto`/`node:zlib`/`node:https`, `@brasil-fiscal/core` ^1.0.0, testes com `tsx --test`.

## Global Constraints

- **Imports internos são relativos** (ex.: `../../contracts/...`), seguindo a convenção já existente em `src/`. NÃO usar o alias `@nfse/*` no código-fonte.
- **Namespace da DPS:** `http://www.sped.fazenda.gov.br/nfse`, atributo `versao="1.00"`.
- **Assinatura:** XMLDSig **enveloped**, `SignatureMethod` = `http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`, `DigestMethod` = `http://www.w3.org/2001/04/xmlenc#sha256`, C14N = `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`. Assina o elemento `<infDPS>`; a `<Signature>` fica como **irmã** de `<infDPS>`, dentro de `<DPS>`, logo após `</infDPS>`.
- **Id da DPS:** atributo `Id` **apenas** em `<infDPS>`, formato `DPS` + cMun(7) + tpInsc(1) + doc(14) + série(5) + nDPS(15) → regex `DPS[0-9]{42}` (tpInsc: 1=CPF, 2=CNPJ).
- **Endpoint de emissão:** `POST {baseUrl}/nfse`, corpo `{ "dpsXmlGZipB64": "<XML assinado → gzip → base64>" }`. Sucesso HTTP 2xx com `{ chaveAcesso, idDps, nfseXmlGZipB64, alertas }`; erro com `{ erros: [{ Codigo, Descricao, Complemento }] }`.
- **URLs ADN:** produção `https://sefin.nfse.gov.br/SefinNacional`; homologação (produção restrita) `https://sefin.producaorestrita.nfse.gov.br/SefinNacional`.
- **Valores monetários** no XML: string com 2 casas (`formatNumber(v, 2)`).
- **Nenhum teste faz chamada real ao ADN.** Testes de rede usam servidor HTTP local (`node:http`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/shared/helpers/dps-id.ts` | Gera o `Id` da DPS (`DPS[0-9]{42}`) |
| `src/shared/helpers/compression.ts` | `gzipBase64` / `gunzipBase64` |
| `src/shared/constants/adn-urls.ts` | (corrigir) URLs distintas homolog/produção |
| `src/domain/dps.ts` | Tipos de entrada da DPS (`DPSProps` e sub-tipos) |
| `src/contracts/NFSeXmlBuilder.ts` | Interface do builder |
| `src/contracts/NFSeTransport.ts` | Interface do transporte REST |
| `src/infra/xml/NFSeXmlBuilder.ts` | Monta o XML da DPS na ordem do XSD |
| `src/infra/xml/NFSeXmlSigner.ts` | Assinatura XMLDSig SHA-256 em `infDPS` |
| `src/infra/http/NFSeHttpTransport.ts` | POST REST + mTLS + JSON |
| `src/shared/errors/NFSeRejectError.ts` | Erro de rejeição do ADN |
| `src/core/types.ts` | `EmitirResult` |
| `src/application/use-cases/EmitirNFSeUseCase.ts` | Orquestra o fluxo de emissão |
| `src/core/NFSeCore.ts` | (reescrever) implementa `emitir()` |
| `src/index.ts` | (atualizar) exports públicos |
| `tests/*.spec.ts` | testes por componente |

---

## Task 1: Setup + helper do Id da DPS

**Files:**
- Create: `src/shared/helpers/dps-id.ts`
- Test: `tests/dps-id.spec.ts`

**Interfaces:**
- Produces: `gerarIdDps(params: DpsIdParams): string` e `type DpsIdParams = { codigoMunicipio: string; tipoInscricao: 1 | 2; documento: string; serie: string | number; numeroDps: string | number }`

- [ ] **Step 1: Instalar dependências e criar pasta de testes**

Run:
```bash
cd /Users/raphaelserafim/Documents/Jobs/brasil-fiscal/nfse
npm install
mkdir -p tests
```
Expected: `node_modules/` criado, incluindo `@brasil-fiscal/core` e `tsx`. Se o registro público falhar para `@brasil-fiscal/core`, rodar `npm install file:../core` e depois `npm install`.

- [ ] **Step 2: Escrever o teste que falha**

Create `tests/dps-id.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarIdDps } from '../src/shared/helpers/dps-id';

test('gerarIdDps monta Id no formato DPS[0-9]{42} com CNPJ', () => {
  const id = gerarIdDps({
    codigoMunicipio: '3106200',
    tipoInscricao: 2,
    documento: '50516724000160',
    serie: 1,
    numeroDps: 1
  });
  assert.match(id, /^DPS[0-9]{42}$/);
  assert.equal(id, 'DPS3106200250516724000160' + '00001' + '000000000000001');
});

test('gerarIdDps faz padding de CPF (11) para 14 e usa tpInsc=1', () => {
  const id = gerarIdDps({
    codigoMunicipio: '3550308',
    tipoInscricao: 1,
    documento: '12345678909',
    serie: '2',
    numeroDps: '99'
  });
  assert.match(id, /^DPS[0-9]{42}$/);
  assert.equal(id, 'DPS3550308' + '1' + '00012345678909' + '00002' + '000000000000099');
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/dps-id.spec.ts`
Expected: FAIL — `Cannot find module '../src/shared/helpers/dps-id'`.

- [ ] **Step 4: Implementar o helper**

Create `src/shared/helpers/dps-id.ts`:
```ts
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
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx tsx --test tests/dps-id.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add package-lock.json src/shared/helpers/dps-id.ts tests/dps-id.spec.ts
git commit -m "feat: helper gerarIdDps para o Id da DPS"
```

---

## Task 2: Corrigir URLs do ADN

**Files:**
- Modify: `src/shared/constants/adn-urls.ts`
- Test: `tests/adn-urls.spec.ts`

**Interfaces:**
- Consumes: `getAdnBaseUrl(environment: NFSeEnvironment): string`, `type NFSeEnvironment = 'homologacao' | 'producao'` (já existentes).
- Produces: URLs distintas por ambiente.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/adn-urls.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAdnBaseUrl } from '../src/shared/constants/adn-urls';

test('produção aponta para sefin.nfse.gov.br', () => {
  assert.equal(getAdnBaseUrl('producao'), 'https://sefin.nfse.gov.br/SefinNacional');
});

test('homologação aponta para produção restrita', () => {
  assert.equal(
    getAdnBaseUrl('homologacao'),
    'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
  );
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/adn-urls.spec.ts`
Expected: FAIL — homologação retorna a URL de produção (valor atual incorreto).

- [ ] **Step 3: Corrigir o mapa de URLs**

In `src/shared/constants/adn-urls.ts`, substituir o objeto `ADN_URLS`:
```ts
const ADN_URLS: Record<NFSeEnvironment, string> = {
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
  producao: 'https://sefin.nfse.gov.br/SefinNacional'
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx tsx --test tests/adn-urls.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants/adn-urls.ts tests/adn-urls.spec.ts
git commit -m "fix: separar URLs de homologação e produção do ADN"
```

---

## Task 3: Helpers de compressão (GZip + Base64)

**Files:**
- Create: `src/shared/helpers/compression.ts`
- Test: `tests/compression.spec.ts`

**Interfaces:**
- Produces: `gzipBase64(text: string): string`, `gunzipBase64(b64: string): string`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/compression.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipBase64, gunzipBase64 } from '../src/shared/helpers/compression';

test('gzipBase64 seguido de gunzipBase64 preserva o conteúdo', () => {
  const xml = '<DPS><infDPS Id="DPS000000000000000000000000000000000000000001">x</infDPS></DPS>';
  const compressed = gzipBase64(xml);
  assert.notEqual(compressed, xml);
  assert.match(compressed, /^[A-Za-z0-9+/=]+$/); // base64
  assert.equal(gunzipBase64(compressed), xml);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/compression.spec.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar os helpers**

Create `src/shared/helpers/compression.ts`:
```ts
import { gzipSync, gunzipSync } from 'node:zlib';

/** Comprime uma string UTF-8 em GZip e devolve em Base64. */
export function gzipBase64(text: string): string {
  return gzipSync(Buffer.from(text, 'utf-8')).toString('base64');
}

/** Inverte gzipBase64: decodifica Base64 e descomprime GZip para string UTF-8. */
export function gunzipBase64(b64: string): string {
  return gunzipSync(Buffer.from(b64, 'base64')).toString('utf-8');
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx tsx --test tests/compression.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/helpers/compression.ts tests/compression.spec.ts
git commit -m "feat: helpers gzipBase64/gunzipBase64"
```

---

## Task 4: Modelo da DPS + builder de XML

**Files:**
- Create: `src/domain/dps.ts`
- Create: `src/contracts/NFSeXmlBuilder.ts`
- Create: `src/infra/xml/NFSeXmlBuilder.ts`
- Test: `tests/nfse-xml-builder.spec.ts`

**Interfaces:**
- Consumes: `gerarIdDps` (Task 1); `tag`, `tagGroup`, `formatNumber`, `formatDate` de `@brasil-fiscal/core`.
- Produces:
  - `type DPSProps` e sub-tipos (`PrestadorDPS`, `TomadorDPS`, `ServicoDPS`, `ValoresDPS`, `DPSAmbiente`) em `src/domain/dps.ts`.
  - `interface NFSeXmlBuilder { build(dps: DPSProps): string }` em `src/contracts/NFSeXmlBuilder.ts`.
  - `class DefaultNFSeXmlBuilder implements NFSeXmlBuilder` em `src/infra/xml/NFSeXmlBuilder.ts`.

- [ ] **Step 1: Definir os tipos da DPS**

Create `src/domain/dps.ts`:
```ts
export type DPSAmbiente = 1 | 2; // 1=Produção, 2=Homologação (tpAmb)

export type PrestadorDPS = {
  readonly cnpj?: string;
  readonly cpf?: string;
  readonly inscricaoMunicipal?: string;          // IM
  readonly optanteSimplesNacional?: 1 | 2 | 3;   // regTrib.opSimpNac (1=Não, 2=MEI, 3=ME/EPP)
};

export type TomadorDPS = {
  readonly cnpj?: string;
  readonly cpf?: string;
  readonly nome?: string;      // xNome
  readonly telefone?: string;  // fone
  readonly email?: string;     // email
};

export type ServicoDPS = {
  readonly codigoMunicipioPrestacao: string;   // serv.locPrest.cLocPrestacao
  readonly codigoTributacaoNacional: string;   // serv.cServ.cTribNac
  readonly descricao: string;                  // serv.cServ.xDescServ
};

export type ValoresDPS = {
  readonly valorServico: number;                 // valores.vServPrest.vServ
  readonly tributacaoISSQN?: 1 | 2 | 3 | 4;      // valores.trib.tribMun.tribISSQN (default 1)
  readonly retencaoISSQN?: 1 | 2;                // valores.trib.tribMun.tpRetISSQN
  readonly percentualTotalTributosSN?: number;   // valores.trib.totTrib.pTotTribSN
};

export type DPSProps = {
  readonly ambiente?: DPSAmbiente;               // tpAmb (default preenchido pelo NFSeCore)
  readonly dataEmissao?: Date;                   // dhEmi (default: agora)
  readonly versaoAplicativo?: string;            // verAplic (default '1.00')
  readonly serie: string | number;              // serie
  readonly numero: string | number;             // nDPS
  readonly competencia?: string;                // dCompet YYYY-MM-DD (default: data de dhEmi)
  readonly tipoEmitente?: 1 | 2 | 3;            // tpEmit (default 1)
  readonly codigoMunicipioEmissor?: string;      // cLocEmi (default: codigoMunicipio do NFSeCore)
  readonly prestador: PrestadorDPS;
  readonly tomador?: TomadorDPS;
  readonly servico: ServicoDPS;
  readonly valores: ValoresDPS;
};
```

- [ ] **Step 2: Definir o contrato do builder**

Create `src/contracts/NFSeXmlBuilder.ts`:
```ts
import { DPSProps } from '../domain/dps';

export interface NFSeXmlBuilder {
  build(dps: DPSProps): string;
}
```

- [ ] **Step 3: Escrever o teste que falha**

Create `tests/nfse-xml-builder.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DefaultNFSeXmlBuilder } from '../src/infra/xml/NFSeXmlBuilder';
import { DPSProps } from '../src/domain/dps';

const dps: DPSProps = {
  ambiente: 1,
  dataEmissao: new Date('2026-04-28T22:34:48Z'),
  serie: 1,
  numero: 1,
  codigoMunicipioEmissor: '3106200',
  prestador: { cnpj: '50516724000160', inscricaoMunicipal: '14701490012', optanteSimplesNacional: 3 },
  tomador: { cnpj: '19678493000141', nome: 'Cliente da Silva', email: 'x@y.com' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Assinatura SaaS' },
  valores: { valorServico: 169, tributacaoISSQN: 1, retencaoISSQN: 1, percentualTotalTributosSN: 6 }
};

test('build monta DPS com namespace, versao e infDPS com Id', () => {
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  assert.match(xml, /<DPS xmlns="http:\/\/www\.sped\.fazenda\.gov\.br\/nfse" versao="1\.00">/);
  assert.match(xml, /<infDPS Id="DPS[0-9]{42}">/);
  // Id NÃO aparece na raiz DPS
  assert.doesNotMatch(xml, /<DPS[^>]*Id=/);
});

test('build respeita a ordem do XSD e mapeia os campos', () => {
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  // ordem: tpAmb ... cLocEmi < prest < serv < valores
  assert.ok(xml.indexOf('<tpAmb>') < xml.indexOf('<dhEmi>'));
  assert.ok(xml.indexOf('<cLocEmi>') < xml.indexOf('<prest>'));
  assert.ok(xml.indexOf('<prest>') < xml.indexOf('<serv>'));
  assert.ok(xml.indexOf('<serv>') < xml.indexOf('<valores>'));
  assert.match(xml, /<prest><CNPJ>50516724000160<\/CNPJ><IM>14701490012<\/IM><regTrib><opSimpNac>3<\/opSimpNac><\/regTrib><\/prest>/);
  assert.match(xml, /<cServ><cTribNac>010501<\/cTribNac><xDescServ>Assinatura SaaS<\/xDescServ><\/cServ>/);
  assert.match(xml, /<vServPrest><vServ>169\.00<\/vServ><\/vServPrest>/);
  assert.match(xml, /<tribMun><tribISSQN>1<\/tribISSQN><tpRetISSQN>1<\/tpRetISSQN><\/tribMun>/);
  assert.match(xml, /<totTrib><pTotTribSN>6\.00<\/pTotTribSN><\/totTrib>/);
  // </infDPS></DPS> adjacentes (necessário para o signer)
  assert.match(xml, /<\/infDPS><\/DPS>$/);
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/nfse-xml-builder.spec.ts`
Expected: FAIL — `DefaultNFSeXmlBuilder` inexistente.

- [ ] **Step 5: Implementar o builder**

Create `src/infra/xml/NFSeXmlBuilder.ts`:
```ts
import { tag, tagGroup, formatNumber, formatDate } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../../contracts/NFSeXmlBuilder';
import { DPSProps } from '../../domain/dps';
import { gerarIdDps } from '../../shared/helpers/dps-id';

const DPS_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
const DPS_VERSAO = '1.00';

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

function dataCompetencia(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export class DefaultNFSeXmlBuilder implements NFSeXmlBuilder {
  build(dps: DPSProps): string {
    const dhEmi = dps.dataEmissao ?? new Date();
    const ambiente = dps.ambiente ?? 2;
    const cLocEmi = dps.codigoMunicipioEmissor ?? '';
    const prestDoc = dps.prestador.cnpj ?? dps.prestador.cpf ?? '';
    const tpInsc: 1 | 2 = dps.prestador.cnpj ? 2 : 1;

    const id = gerarIdDps({
      codigoMunicipio: cLocEmi,
      tipoInscricao: tpInsc,
      documento: prestDoc,
      serie: dps.serie,
      numeroDps: dps.numero
    });

    const prest = tagGroup(
      'prest',
      (dps.prestador.cnpj
        ? tag('CNPJ', onlyDigits(dps.prestador.cnpj))
        : tag('CPF', onlyDigits(dps.prestador.cpf ?? ''))) +
        tag('IM', dps.prestador.inscricaoMunicipal) +
        (dps.prestador.optanteSimplesNacional !== undefined
          ? tagGroup('regTrib', tag('opSimpNac', dps.prestador.optanteSimplesNacional))
          : '')
    );

    const toma = dps.tomador
      ? tagGroup(
          'toma',
          (dps.tomador.cnpj
            ? tag('CNPJ', onlyDigits(dps.tomador.cnpj))
            : dps.tomador.cpf
              ? tag('CPF', onlyDigits(dps.tomador.cpf))
              : '') +
            tag('xNome', dps.tomador.nome) +
            tag('fone', dps.tomador.telefone) +
            tag('email', dps.tomador.email)
        )
      : '';

    const serv = tagGroup(
      'serv',
      tagGroup('locPrest', tag('cLocPrestacao', dps.servico.codigoMunicipioPrestacao)) +
        tagGroup(
          'cServ',
          tag('cTribNac', dps.servico.codigoTributacaoNacional) +
            tag('xDescServ', dps.servico.descricao)
        )
    );

    const tribMun = tagGroup(
      'tribMun',
      tag('tribISSQN', dps.valores.tributacaoISSQN ?? 1) +
        (dps.valores.retencaoISSQN !== undefined ? tag('tpRetISSQN', dps.valores.retencaoISSQN) : '')
    );
    const totTrib =
      dps.valores.percentualTotalTributosSN !== undefined
        ? tagGroup('totTrib', tag('pTotTribSN', formatNumber(dps.valores.percentualTotalTributosSN, 2)))
        : '';
    const valores = tagGroup(
      'valores',
      tagGroup('vServPrest', tag('vServ', formatNumber(dps.valores.valorServico, 2))) +
        tagGroup('trib', tribMun + totTrib)
    );

    const infDPS =
      `<infDPS Id="${id}">` +
      tag('tpAmb', ambiente) +
      tag('dhEmi', formatDate(dhEmi)) +
      tag('verAplic', dps.versaoAplicativo ?? DPS_VERSAO) +
      tag('serie', String(dps.serie).replace(/\D/g, '').padStart(5, '0')) +
      tag('nDPS', String(dps.numero)) +
      tag('dCompet', dps.competencia ?? dataCompetencia(dhEmi)) +
      tag('tpEmit', dps.tipoEmitente ?? 1) +
      tag('cLocEmi', cLocEmi) +
      prest +
      toma +
      serv +
      valores +
      `</infDPS>`;

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<DPS xmlns="${DPS_NAMESPACE}" versao="${DPS_VERSAO}">` +
      infDPS +
      `</DPS>`
    );
  }
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx tsx --test tests/nfse-xml-builder.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 7: Commit**

```bash
git add src/domain/dps.ts src/contracts/NFSeXmlBuilder.ts src/infra/xml/NFSeXmlBuilder.ts tests/nfse-xml-builder.spec.ts
git commit -m "feat: modelo DPSProps e builder de XML da DPS"
```

---

## Task 5: Assinador XMLDSig SHA-256

**Files:**
- Create: `src/infra/xml/NFSeXmlSigner.ts`
- Test: `tests/nfse-xml-signer.spec.ts`

**Interfaces:**
- Consumes: `canonicalize`, tipos `XmlSigner` e `CertificateData` de `@brasil-fiscal/core`; `DefaultNFSeXmlBuilder` (Task 4).
- Produces: `class NFSeXmlSigner implements XmlSigner` com `sign(xml: string, certificate: CertificateData): string`.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/nfse-xml-signer.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { canonicalize } from '@brasil-fiscal/core';
import { NFSeXmlSigner } from '../src/infra/xml/NFSeXmlSigner';
import { DefaultNFSeXmlBuilder } from '../src/infra/xml/NFSeXmlBuilder';
import { DPSProps } from '../src/domain/dps';

function makeCert() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    cert: {
      pfx: Buffer.alloc(0),
      password: '',
      notAfter: new Date('2030-01-01'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      certPem: '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----'
    }
  };
}

const dps: DPSProps = {
  ambiente: 2,
  dataEmissao: new Date('2026-04-28T22:34:48Z'),
  serie: 1,
  numero: 1,
  codigoMunicipioEmissor: '3106200',
  prestador: { cnpj: '50516724000160' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Servico' },
  valores: { valorServico: 100 }
};

test('sign insere Signature SHA-256 irmã de infDPS', () => {
  const { cert } = makeCert();
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  const signed = new NFSeXmlSigner().sign(xml, cert);

  assert.match(signed, /<SignatureMethod Algorithm="http:\/\/www\.w3\.org\/2001\/04\/xmldsig-more#rsa-sha256"\/>/);
  assert.match(signed, /<DigestMethod Algorithm="http:\/\/www\.w3\.org\/2001\/04\/xmlenc#sha256"\/>/);
  assert.match(signed, /<Reference URI="#DPS[0-9]{42}">/);
  // Signature vem depois de </infDPS> e antes de </DPS>
  assert.ok(signed.indexOf('</infDPS>') < signed.indexOf('<Signature'));
  assert.ok(signed.indexOf('<Signature') < signed.indexOf('</DPS>'));
});

test('a assinatura é criptograficamente válida', () => {
  const { cert, publicKeyPem } = makeCert();
  const xml = new DefaultNFSeXmlBuilder().build(dps);
  const signed = new NFSeXmlSigner().sign(xml, cert);

  const signedInfo = signed.match(/<SignedInfo[\s\S]*?<\/SignedInfo>/)![0];
  const signatureValue = signed.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)![1];

  const verifier = createVerify('RSA-SHA256');
  verifier.update(canonicalize(signedInfo));
  assert.equal(verifier.verify(publicKeyPem, signatureValue, 'base64'), true);
});

test('sign lança erro se não houver infDPS', () => {
  const { cert } = makeCert();
  assert.throws(() => new NFSeXmlSigner().sign('<DPS></DPS>', cert), /infDPS/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/nfse-xml-signer.spec.ts`
Expected: FAIL — `NFSeXmlSigner` inexistente.

- [ ] **Step 3: Implementar o assinador**

Create `src/infra/xml/NFSeXmlSigner.ts`:
```ts
import { createSign, createHash } from 'node:crypto';
import { canonicalize } from '@brasil-fiscal/core';
import type { XmlSigner, CertificateData } from '@brasil-fiscal/core';

const SIGNATURE_NS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N_ALGORITHM = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED_SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SHA256_ALGORITHM = 'http://www.w3.org/2001/04/xmlenc#sha256';
const RSA_SHA256_ALGORITHM = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

const ELEMENT_NAME = 'infDPS';
const PARENT_ELEMENT = 'DPS';

/**
 * Assinador XMLDSig SHA-256 para a DPS da NFS-e Nacional.
 * Assina o elemento <infDPS> (enveloped) e insere a <Signature> como irmã,
 * logo após </infDPS>, dentro de <DPS>.
 */
export class NFSeXmlSigner implements XmlSigner {
  sign(xml: string, certificate: CertificateData): string {
    const match = xml.match(new RegExp(`<${ELEMENT_NAME}[^>]*>[\\s\\S]*<\\/${ELEMENT_NAME}>`));
    if (!match) {
      throw new Error(`Elemento <${ELEMENT_NAME}> não encontrado no XML da DPS`);
    }
    const idMatch = match[0].match(/Id="([^"]+)"/);
    if (!idMatch) {
      throw new Error(`Atributo Id não encontrado em <${ELEMENT_NAME}>`);
    }
    const id = idMatch[1];

    const elementContent = this.propagateNamespaces(xml, match[0]);
    const canonicalized = canonicalize(elementContent);
    const digest = createHash('sha256').update(canonicalized).digest('base64');

    const signedInfo =
      `<SignedInfo xmlns="${SIGNATURE_NS}">` +
      `<CanonicalizationMethod Algorithm="${C14N_ALGORITHM}"/>` +
      `<SignatureMethod Algorithm="${RSA_SHA256_ALGORITHM}"/>` +
      `<Reference URI="#${id}">` +
      `<Transforms>` +
      `<Transform Algorithm="${ENVELOPED_SIGNATURE}"/>` +
      `<Transform Algorithm="${C14N_ALGORITHM}"/>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="${SHA256_ALGORITHM}"/>` +
      `<DigestValue>${digest}</DigestValue>` +
      `</Reference>` +
      `</SignedInfo>`;

    const signer = createSign('RSA-SHA256');
    signer.update(canonicalize(signedInfo));
    const signatureValue = signer.sign(certificate.privateKey, 'base64');

    const x509 = certificate.certPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    const signature =
      `<Signature xmlns="${SIGNATURE_NS}">` +
      signedInfo +
      `<SignatureValue>${signatureValue}</SignatureValue>` +
      `<KeyInfo><X509Data><X509Certificate>${x509}</X509Certificate></X509Data></KeyInfo>` +
      `</Signature>`;

    return xml.replace(
      `</${ELEMENT_NAME}></${PARENT_ELEMENT}>`,
      `</${ELEMENT_NAME}>${signature}</${PARENT_ELEMENT}>`
    );
  }

  /**
   * Propaga os namespaces declarados em <DPS ...> para o elemento <infDPS>,
   * de modo que a canonicalização inclua os namespaces efetivos no digest.
   */
  private propagateNamespaces(xml: string, element: string): string {
    const nsRegex = /xmlns(?::[\w]+)?="[^"]+"/g;
    const parentMatch = xml.match(new RegExp(`<${PARENT_ELEMENT}[^>]*>`));
    const parentNs: string[] = [];
    if (parentMatch) {
      let m: RegExpExecArray | null;
      while ((m = nsRegex.exec(parentMatch[0])) !== null) {
        parentNs.push(m[0]);
      }
    }
    if (parentNs.length === 0) return element;

    const openMatch = element.match(new RegExp(`^<${ELEMENT_NAME}([^>]*)>`));
    if (!openMatch) return element;
    const existing = openMatch[1];
    const missing = parentNs.filter((ns) => !existing.includes(ns));
    if (missing.length === 0) return element;

    return element.replace(new RegExp(`^<${ELEMENT_NAME}`), `<${ELEMENT_NAME} ${missing.join(' ')}`);
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx tsx --test tests/nfse-xml-signer.spec.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/infra/xml/NFSeXmlSigner.ts tests/nfse-xml-signer.spec.ts
git commit -m "feat: assinador XMLDSig SHA-256 da DPS (NFSeXmlSigner)"
```

---

## Task 6: Transporte REST (mTLS)

**Files:**
- Create: `src/contracts/NFSeTransport.ts`
- Create: `src/infra/http/NFSeHttpTransport.ts`
- Test: `tests/nfse-http-transport.spec.ts`

**Interfaces:**
- Consumes: tipo `CertificateData` de `@brasil-fiscal/core`.
- Produces:
  - `type NFSeHttpResponse = { statusCode: number; body: string }` e `interface NFSeTransport { postJson(url: string, body: unknown, cert: CertificateData): Promise<NFSeHttpResponse> }` em `src/contracts/NFSeTransport.ts`.
  - `class NFSeHttpTransport implements NFSeTransport` em `src/infra/http/NFSeHttpTransport.ts`.

- [ ] **Step 1: Definir o contrato do transporte**

Create `src/contracts/NFSeTransport.ts`:
```ts
import type { CertificateData } from '@brasil-fiscal/core';

export type NFSeHttpResponse = {
  readonly statusCode: number;
  readonly body: string;
};

export interface NFSeTransport {
  postJson(url: string, body: unknown, cert: CertificateData): Promise<NFSeHttpResponse>;
}
```

- [ ] **Step 2: Escrever o teste que falha**

Create `tests/nfse-http-transport.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NFSeHttpTransport } from '../src/infra/http/NFSeHttpTransport';
import type { CertificateData } from '@brasil-fiscal/core';

const fakeCert: CertificateData = {
  pfx: Buffer.alloc(0),
  password: '',
  notAfter: new Date('2030-01-01'),
  privateKey: '',
  certPem: ''
};

function startServer(handler: (method: string, ctype: string, body: string) => { status: number; body: string }): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const out = handler(req.method ?? '', String(req.headers['content-type'] ?? ''), Buffer.concat(chunks).toString('utf-8'));
        res.writeHead(out.status, { 'Content-Type': 'application/json' });
        res.end(out.body);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, url: `http://127.0.0.1:${port}/SefinNacional` });
    });
  });
}

test('postJson envia POST com JSON e retorna status/corpo', async () => {
  let seen = { method: '', ctype: '', body: '' };
  const { server, url } = await startServer((method, ctype, body) => {
    seen = { method, ctype, body };
    return { status: 201, body: JSON.stringify({ chaveAcesso: '123', idDps: 'NFS1', nfseXmlGZipB64: 'x' }) };
  });

  try {
    const res = await new NFSeHttpTransport().postJson(`${url}/nfse`, { dpsXmlGZipB64: 'ABC' }, fakeCert);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body).chaveAcesso, '123');
    assert.equal(seen.method, 'POST');
    assert.match(seen.ctype, /application\/json/);
    assert.deepEqual(JSON.parse(seen.body), { dpsXmlGZipB64: 'ABC' });
  } finally {
    server.close();
  }
});

test('postJson propaga status de erro sem lançar', async () => {
  const { server, url } = await startServer(() => ({ status: 400, body: JSON.stringify({ erros: [{ Codigo: 'E0712' }] }) }));
  try {
    const res = await new NFSeHttpTransport().postJson(`${url}/nfse`, {}, fakeCert);
    assert.equal(res.statusCode, 400);
    assert.match(res.body, /E0712/);
  } finally {
    server.close();
  }
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/nfse-http-transport.spec.ts`
Expected: FAIL — `NFSeHttpTransport` inexistente.

- [ ] **Step 4: Implementar o transporte**

Create `src/infra/http/NFSeHttpTransport.ts`:
```ts
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import type { CertificateData } from '@brasil-fiscal/core';
import { NFSeTransport, NFSeHttpResponse } from '../../contracts/NFSeTransport';

/**
 * Transporte REST do ADN. Usa HTTPS com mTLS (certificado A1 via pfx) em produção.
 * Para URLs http:// (uso em testes locais) o certificado é ignorado.
 */
export class NFSeHttpTransport implements NFSeTransport {
  postJson(url: string, body: unknown, cert: CertificateData): Promise<NFSeHttpResponse> {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const payload = Buffer.from(JSON.stringify(body), 'utf-8');

    const options: Record<string, unknown> = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': payload.length
      }
    };
    if (isHttps) {
      options.pfx = cert.pfx;
      options.passphrase = cert.password;
    }

    const doRequest = isHttps ? httpsRequest : httpRequest;

    return new Promise<NFSeHttpResponse>((resolve, reject) => {
      const req = doRequest(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
        );
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx tsx --test tests/nfse-http-transport.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add src/contracts/NFSeTransport.ts src/infra/http/NFSeHttpTransport.ts tests/nfse-http-transport.spec.ts
git commit -m "feat: transporte REST mTLS do ADN (NFSeHttpTransport)"
```

---

## Task 7: Erro de rejeição + use case de emissão

**Files:**
- Create: `src/shared/errors/NFSeRejectError.ts`
- Create: `src/core/types.ts`
- Create: `src/application/use-cases/EmitirNFSeUseCase.ts`
- Test: `tests/emitir-use-case.spec.ts`

**Interfaces:**
- Consumes: `NFSeXmlBuilder` (Task 4), `XmlSigner`/`CertificateProvider`/`CertificateData`/`DFeError` (core), `NFSeTransport` (Task 6), `gzipBase64`/`gunzipBase64` (Task 3), `DPSProps` (Task 4).
- Produces:
  - `type NFSeErro` e `class NFSeRejectError extends DFeError` (com `statusCode: number`, `erros: NFSeErro[]`).
  - `type EmitirResult` em `src/core/types.ts`.
  - `class EmitirNFSeUseCase` com `execute(dps: DPSProps): Promise<EmitirResult>` e construtor `new EmitirNFSeUseCase({ builder, signer, certificate, transport, baseUrl })`.

- [ ] **Step 1: Definir o erro de rejeição**

Create `src/shared/errors/NFSeRejectError.ts`:
```ts
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
```

- [ ] **Step 2: Definir o tipo de resultado**

Create `src/core/types.ts`:
```ts
export type EmitirResult = {
  readonly autorizada: boolean;
  readonly chaveAcesso: string; // 50 dígitos, gerada pelo ADN
  readonly idDps: string;
  readonly xmlNfse: string;     // NFS-e autorizada (descomprimida)
  readonly xmlDps: string;      // DPS assinada enviada
  readonly statusHttp: number;
  readonly alertas?: unknown;
};
```

- [ ] **Step 3: Escrever o teste que falha**

Create `tests/emitir-use-case.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { EmitirNFSeUseCase } from '../src/application/use-cases/EmitirNFSeUseCase';
import { DefaultNFSeXmlBuilder } from '../src/infra/xml/NFSeXmlBuilder';
import { NFSeXmlSigner } from '../src/infra/xml/NFSeXmlSigner';
import { NFSeRejectError } from '../src/shared/errors/NFSeRejectError';
import { gzipBase64, gunzipBase64 } from '../src/shared/helpers/compression';
import type { NFSeTransport, NFSeHttpResponse } from '../src/contracts/NFSeTransport';
import type { CertificateProvider, CertificateData } from '@brasil-fiscal/core';
import { DPSProps } from '../src/domain/dps';

function fakeCertProvider(): CertificateProvider {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const cert: CertificateData = {
    pfx: Buffer.alloc(0),
    password: '',
    notAfter: new Date('2030-01-01'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    certPem: '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----'
  };
  return { load: async () => cert };
}

const dps: DPSProps = {
  ambiente: 2,
  dataEmissao: new Date('2026-04-28T22:34:48Z'),
  serie: 1,
  numero: 1,
  codigoMunicipioEmissor: '3106200',
  prestador: { cnpj: '50516724000160' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Servico' },
  valores: { valorServico: 100 }
};

function makeDeps(transport: NFSeTransport) {
  return {
    builder: new DefaultNFSeXmlBuilder(),
    signer: new NFSeXmlSigner(),
    certificate: fakeCertProvider(),
    transport,
    baseUrl: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
  };
}

test('execute envia DPS assinada em gzip+base64 e parseia a NFS-e autorizada', async () => {
  let sentUrl = '';
  let sentBody: any = null;
  const transport: NFSeTransport = {
    async postJson(url, body): Promise<NFSeHttpResponse> {
      sentUrl = url;
      sentBody = body;
      return {
        statusCode: 201,
        body: JSON.stringify({ chaveAcesso: '3'.repeat(50), idDps: 'NFS123', nfseXmlGZipB64: gzipBase64('<NFSe>ok</NFSe>'), alertas: null })
      };
    }
  };

  const result = await new EmitirNFSeUseCase(makeDeps(transport)).execute(dps);

  assert.equal(sentUrl, 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse');
  // o corpo é { dpsXmlGZipB64 } e, ao descomprimir, é o XML assinado
  const enviado = gunzipBase64(sentBody.dpsXmlGZipB64);
  assert.match(enviado, /<Signature/);
  assert.match(enviado, /<infDPS Id="DPS[0-9]{42}">/);
  // resultado
  assert.equal(result.autorizada, true);
  assert.equal(result.chaveAcesso, '3'.repeat(50));
  assert.equal(result.idDps, 'NFS123');
  assert.equal(result.xmlNfse, '<NFSe>ok</NFSe>');
  assert.equal(result.statusHttp, 201);
});

test('execute lança NFSeRejectError em resposta 400', async () => {
  const transport: NFSeTransport = {
    async postJson(): Promise<NFSeHttpResponse> {
      return { statusCode: 400, body: JSON.stringify({ erros: [{ Codigo: 'E0712', Descricao: 'indicador inválido' }] }) };
    }
  };
  await assert.rejects(
    () => new EmitirNFSeUseCase(makeDeps(transport)).execute(dps),
    (err: unknown) => {
      assert.ok(err instanceof NFSeRejectError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.erros[0].codigo, 'E0712');
      return true;
    }
  );
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/emitir-use-case.spec.ts`
Expected: FAIL — `EmitirNFSeUseCase` inexistente.

- [ ] **Step 5: Implementar o use case**

Create `src/application/use-cases/EmitirNFSeUseCase.ts`:
```ts
import type { CertificateProvider, XmlSigner } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../../contracts/NFSeXmlBuilder';
import { NFSeTransport } from '../../contracts/NFSeTransport';
import { DPSProps } from '../../domain/dps';
import { EmitirResult } from '../../core/types';
import { NFSeRejectError, NFSeErro } from '../../shared/errors/NFSeRejectError';
import { gzipBase64, gunzipBase64 } from '../../shared/helpers/compression';

export type EmitirNFSeDeps = {
  readonly builder: NFSeXmlBuilder;
  readonly signer: XmlSigner;
  readonly certificate: CertificateProvider;
  readonly transport: NFSeTransport;
  readonly baseUrl: string;
};

type AdnSuccess = {
  chaveAcesso?: string;
  idDps?: string;
  nfseXmlGZipB64?: string;
  alertas?: unknown;
};

type AdnError = {
  erros?: Array<{ Codigo?: string; Descricao?: string; Complemento?: string }>;
};

export class EmitirNFSeUseCase {
  constructor(private readonly deps: EmitirNFSeDeps) {}

  async execute(dps: DPSProps): Promise<EmitirResult> {
    const { builder, signer, certificate, transport, baseUrl } = this.deps;

    const xml = builder.build(dps);
    const cert = await certificate.load();
    const signedXml = signer.sign(xml, cert);
    const dpsXmlGZipB64 = gzipBase64(signedXml);

    const res = await transport.postJson(`${baseUrl}/nfse`, { dpsXmlGZipB64 }, cert);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const parsed = JSON.parse(res.body) as AdnSuccess;
      return {
        autorizada: true,
        chaveAcesso: parsed.chaveAcesso ?? '',
        idDps: parsed.idDps ?? '',
        xmlNfse: parsed.nfseXmlGZipB64 ? gunzipBase64(parsed.nfseXmlGZipB64) : '',
        xmlDps: signedXml,
        statusHttp: res.statusCode,
        alertas: parsed.alertas ?? undefined
      };
    }

    let erros: NFSeErro[] = [];
    try {
      const body = JSON.parse(res.body) as AdnError;
      erros = (body.erros ?? []).map((e) => ({
        codigo: e.Codigo,
        descricao: e.Descricao,
        complemento: e.Complemento ?? undefined
      }));
    } catch {
      // corpo não-JSON: mantém lista vazia
    }
    throw new NFSeRejectError(res.statusCode, erros);
  }
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx tsx --test tests/emitir-use-case.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 7: Commit**

```bash
git add src/shared/errors/NFSeRejectError.ts src/core/types.ts src/application/use-cases/EmitirNFSeUseCase.ts tests/emitir-use-case.spec.ts
git commit -m "feat: EmitirNFSeUseCase e NFSeRejectError"
```

---

## Task 8: Fiação no NFSeCore + exports + limpeza

**Files:**
- Modify (reescrever): `src/core/NFSeCore.ts`
- Modify: `src/index.ts`
- Delete: `src/domain/entities/NFSe.ts`, `Prestador.ts`, `Tomador.ts`, `Servico.ts`, `index.ts` (modelo ABRASF legado, substituído por `domain/dps.ts`)
- Test: `tests/nfse-core.spec.ts`

**Interfaces:**
- Consumes: todos os componentes anteriores.
- Produces: `NFSeCore.emitir(dps: DPSProps): Promise<EmitirResult>`; construtor `NFSeCore.create(config)` com `config.transport?: NFSeTransport`, `config.xmlBuilder?: NFSeXmlBuilder`, `config.xmlSigner?: XmlSigner`.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/nfse-core.spec.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { NFSeCore } from '../src/core/NFSeCore';
import { gzipBase64 } from '../src/shared/helpers/compression';
import type { NFSeTransport, NFSeHttpResponse } from '../src/contracts/NFSeTransport';
import type { CertificateProvider, CertificateData } from '@brasil-fiscal/core';
import { DPSProps } from '../src/domain/dps';

function fakeCertProvider(): CertificateProvider {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const cert: CertificateData = {
    pfx: Buffer.alloc(0),
    password: '',
    notAfter: new Date('2030-01-01'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    certPem: '-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----'
  };
  return { load: async () => cert };
}

const dps: DPSProps = {
  serie: 1,
  numero: 1,
  prestador: { cnpj: '50516724000160' },
  servico: { codigoMunicipioPrestacao: '3106200', codigoTributacaoNacional: '010501', descricao: 'Servico' },
  valores: { valorServico: 100 }
};

test('emitir usa a URL de homologação e preenche defaults (tpAmb, cLocEmi)', async () => {
  let sentUrl = '';
  const transport: NFSeTransport = {
    async postJson(url): Promise<NFSeHttpResponse> {
      sentUrl = url;
      return { statusCode: 201, body: JSON.stringify({ chaveAcesso: '9'.repeat(50), idDps: 'NFS1', nfseXmlGZipB64: gzipBase64('<NFSe/>') }) };
    }
  };

  const core = NFSeCore.create({
    pfx: Buffer.alloc(0),
    senha: '',
    ambiente: 'homologacao',
    codigoMunicipio: '3106200',
    certificate: fakeCertProvider(),
    transport
  });

  const result = await core.emitir(dps);
  assert.equal(sentUrl, 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse');
  assert.equal(result.autorizada, true);
  assert.equal(result.chaveAcesso, '9'.repeat(50));
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx tsx --test tests/nfse-core.spec.ts`
Expected: FAIL — `core.emitir` inexistente (ou erro de tipo em `transport`).

- [ ] **Step 3: Reescrever o NFSeCore**

Replace o conteúdo de `src/core/NFSeCore.ts` por:
```ts
import { A1CertificateProvider } from '@brasil-fiscal/core';
import type { CertificateProvider, XmlSigner } from '@brasil-fiscal/core';
import { NFSeXmlBuilder } from '../contracts/NFSeXmlBuilder';
import { NFSeTransport } from '../contracts/NFSeTransport';
import { DefaultNFSeXmlBuilder } from '../infra/xml/NFSeXmlBuilder';
import { NFSeXmlSigner } from '../infra/xml/NFSeXmlSigner';
import { NFSeHttpTransport } from '../infra/http/NFSeHttpTransport';
import { EmitirNFSeUseCase } from '../application/use-cases/EmitirNFSeUseCase';
import { getAdnBaseUrl, NFSeEnvironment } from '../shared/constants/adn-urls';
import { DPSProps } from '../domain/dps';
import { EmitirResult } from './types';

export type NFSeAmbiente = NFSeEnvironment; // 'homologacao' | 'producao'

export type NFSeCoreConfig = {
  readonly pfx: Buffer;
  readonly senha: string;
  readonly ambiente: NFSeAmbiente;
  readonly codigoMunicipio: string;
  readonly xmlBuilder?: NFSeXmlBuilder;
  readonly xmlSigner?: XmlSigner;
  readonly transport?: NFSeTransport;
  readonly certificate?: CertificateProvider;
};

export class NFSeCore {
  private readonly certificate: CertificateProvider;
  private readonly xmlBuilder: NFSeXmlBuilder;
  private readonly xmlSigner: XmlSigner;
  private readonly transport: NFSeTransport;
  private readonly ambiente: NFSeAmbiente;
  private readonly codigoMunicipio: string;

  private constructor(config: NFSeCoreConfig) {
    this.certificate = config.certificate ?? new A1CertificateProvider(config.pfx, config.senha);
    this.xmlBuilder = config.xmlBuilder ?? new DefaultNFSeXmlBuilder();
    this.xmlSigner = config.xmlSigner ?? new NFSeXmlSigner();
    this.transport = config.transport ?? new NFSeHttpTransport();
    this.ambiente = config.ambiente;
    this.codigoMunicipio = config.codigoMunicipio;
  }

  static create(config: NFSeCoreConfig): NFSeCore {
    return new NFSeCore(config);
  }

  /**
   * Emite uma NFS-e: monta a DPS, assina (SHA-256), comprime e envia ao ADN,
   * retornando a NFS-e autorizada.
   */
  async emitir(dps: DPSProps): Promise<EmitirResult> {
    const dpsComDefaults: DPSProps = {
      ...dps,
      ambiente: dps.ambiente ?? (this.ambiente === 'producao' ? 1 : 2),
      codigoMunicipioEmissor: dps.codigoMunicipioEmissor ?? this.codigoMunicipio
    };

    const useCase = new EmitirNFSeUseCase({
      builder: this.xmlBuilder,
      signer: this.xmlSigner,
      certificate: this.certificate,
      transport: this.transport,
      baseUrl: getAdnBaseUrl(this.ambiente)
    });

    return useCase.execute(dpsComDefaults);
  }

  // TODO: consultar() — GET /nfse/{chave}
  // TODO: cancelar() — evento de cancelamento
  // TODO: danfse() — PDF do DANFSe
}
```

- [ ] **Step 4: Remover o modelo ABRASF legado**

Run:
```bash
cd /Users/raphaelserafim/Documents/Jobs/brasil-fiscal/nfse
git rm src/domain/entities/NFSe.ts src/domain/entities/Prestador.ts src/domain/entities/Tomador.ts src/domain/entities/Servico.ts src/domain/entities/index.ts
```

- [ ] **Step 5: Atualizar os exports públicos**

Replace o conteúdo de `src/index.ts` por:
```ts
// Core
export { NFSeCore } from './core/NFSeCore';
export type { NFSeCoreConfig, NFSeAmbiente } from './core/NFSeCore';
export type { EmitirResult } from './core/types';

// Domínio (DPS)
export type {
  DPSProps,
  DPSAmbiente,
  PrestadorDPS,
  TomadorDPS,
  ServicoDPS,
  ValoresDPS
} from './domain/dps';

// Contratos
export type { NFSeXmlBuilder } from './contracts/NFSeXmlBuilder';
export type { NFSeTransport, NFSeHttpResponse } from './contracts/NFSeTransport';

// Infra
export { DefaultNFSeXmlBuilder } from './infra/xml/NFSeXmlBuilder';
export { NFSeXmlSigner } from './infra/xml/NFSeXmlSigner';
export { NFSeHttpTransport } from './infra/http/NFSeHttpTransport';

// Helpers
export { gerarIdDps } from './shared/helpers/dps-id';
export type { DpsIdParams } from './shared/helpers/dps-id';
export { gzipBase64, gunzipBase64 } from './shared/helpers/compression';

// URLs ADN
export { getAdnBaseUrl, ADN_ENDPOINTS } from './shared/constants/adn-urls';
export type { NFSeEnvironment } from './shared/constants/adn-urls';

// Erros
export { NFSeRejectError } from './shared/errors/NFSeRejectError';
export type { NFSeErro } from './shared/errors/NFSeRejectError';

// Re-export core utilities
export {
  A1CertificateProvider,
  DefaultXmlSigner,
  NodeHttpSefazTransport,
  DFeError,
  CertificateError,
  SefazRejectError
} from '@brasil-fiscal/core';
export type {
  CertificateProvider,
  CertificateData,
  SefazTransport,
  XmlSigner
} from '@brasil-fiscal/core';
```

- [ ] **Step 6: Rodar o teste do NFSeCore e confirmar que passa**

Run: `npx tsx --test tests/nfse-core.spec.ts`
Expected: PASS.

- [ ] **Step 7: Rodar toda a suíte e o build**

Run:
```bash
npx tsx --test 'tests/**/*.spec.ts'
npm run build
```
Expected: todos os testes PASS; `tsc` compila sem erros e gera `dist/`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: NFSeCore.emitir() e exports; remove modelo ABRASF legado"
```

---

## Notas de validação futura (fora do escopo deste plano)

Estes pontos só podem ser confirmados contra a produção restrita real do ADN e/ou o XSD oficial `DPS_v1.00.xsd`; deixados sinalizados no código:

- Nomes/casing exatos dos campos de resposta (`chaveAcesso`, `idDps`, `nfseXmlGZipB64`, `alertas`) e de erro (`erros[].Codigo/Descricao/Complemento`).
- Ordem e obrigatoriedade completas dos elementos do `<infDPS>` (o builder cobre o subconjunto essencial; campos adicionais como `serie`/`nDPS` de outros regimes, `vDescIncond`, `vDedRed`, etc. entram em iterações futuras).
- Detalhes de canonicalização/namespaces do `infDPS` para o digest bater no ADN (validar em homologação com uma nota real).
- Formato de data/hora (`dhEmi` com offset) e casas decimais exigidas pelo XSD.
