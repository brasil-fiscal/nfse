# Design — Emissão de NFS-e Nacional (`emitir()`)

**Data:** 2026-07-16
**Pacote:** `@brasil-fiscal/nfse`
**Escopo:** Fluxo `emitir()` ponta-a-ponta (DPS → NFS-e autorizada). Consulta, cancelamento e DANFSe ficam para iterações futuras.

## Objetivo

Implementar a emissão de NFS-e no padrão nacional (ADN / SEFIN Nacional): montar a DPS
(Declaração de Prestação de Serviços) em XML, assiná-la digitalmente, comprimir e enviar à
API REST nacional, e retornar a NFS-e autorizada.

## Contexto e fatos oficiais (fundamentam o design)

Fontes: [Manual Contribuinte API v1.2 (gov.br, out-2025)](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf),
[APIs Prod. Restrita e Produção (gov.br)](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao),
[Integração ADN — daash.IO](https://daash.io/doc/integracao-direta-com-o-sistema-nacional-nfs-e-adn-govbr-631ecb).

- **Endpoint de emissão:** `POST {base}/nfse` com corpo JSON `{ "dpsXmlGZipB64": "<XML DPS assinado → GZip → Base64>" }`.
- **Resposta síncrona:** JSON contendo `chaveAcesso` (50 posições) e `nfseXmlGZipB64` (NFS-e autorizada, GZip+Base64). Erros retornam status HTTP != 2xx com corpo de mensagens.
- **Ambientes (URLs distintas):**
  - Produção: `https://sefin.nfse.gov.br/SefinNacional`
  - Produção restrita (homologação): `https://sefin.producaorestrita.nfse.gov.br/SefinNacional`
- **Transporte:** HTTPS com **mTLS** usando certificado ICP-Brasil A1 (.pfx).
- **Assinatura:** XMLDSig **SHA-256** (SignatureMethod `rsa-sha256`, DigestMethod `sha256`),
  enveloped, aplicada sobre o elemento `<infDPS>`. **Diferente do core**, que assina com SHA-1.
- **Id da DPS:** atributo `Id` fica **apenas** em `<infDPS>` (não na raiz `<DPS>`).
  Padrão: `DPS` + cMun(7) + tpInsc(1) + CNPJ/CPF(14) + série(5) + nDPS(15) → regex `DPS[0-9]{42}`.
- **Ordem dos elementos importa:** o XSD usa `xs:sequence`; o builder deve respeitar a ordem.
- **Chave de acesso da NFS-e:** 50 dígitos, **gerada pelo ADN** e devolvida na resposta
  (não é calculada pelo cliente para o envio; o cliente só gera o `Id` da DPS).

## Decisões de arquitetura

Divergências da NFS-e Nacional em relação ao `@brasil-fiscal/core` (assinatura SHA-256 e
transporte REST) são resolvidas com **infra específica local a este pacote**, sem alterar o core.
Justificativa: mais rápido, isolado, sem risco de regressão em NFe/CTe/MDFe, e mantém o mesmo
padrão de arquitetura limpa do pacote `nfe`.

1. **Assinatura SHA-256:** novo `NFSeXmlSigner` local (não reutiliza `DefaultXmlSigner` SHA-1 do core).
   Reutiliza `canonicalize` do core para C14N.
2. **Transporte REST:** novo `NFSeHttpTransport` local (https + mTLS + gzip + JSON).
   Não reutiliza `NodeHttpSefazTransport` (SOAP) do core.
3. Reutiliza do core: `A1CertificateProvider`/`CertificateProvider`, `canonicalize`, helpers de
   CNPJ/CPF, e erros base (`DFeError`).

## Fluxo

```
NFSeCore.emitir(nfse: NFSeProps): Promise<EmitirResult>
   └─ EmitirNFSeUseCase.execute(nfse)
        1. NFSeXmlBuilder.build(nfse)      → <DPS><infDPS Id="DPS…(42)">…</infDPS></DPS>
        2. cert = certificate.load()
        3. NFSeXmlSigner.sign(xml, cert)   → Signature SHA-256 enveloped dentro de <DPS>, após </infDPS>
        4. dpsXmlGZipB64 = base64(gzip(signedXml))
        5. NFSeHttpTransport.postJson(url + '/nfse', { dpsXmlGZipB64 }, cert)  → mTLS
        6. parse resposta:
             - 2xx  → { chaveAcesso, nfseXmlGZipB64 } → xmlNfse = gunzip(base64Decode(nfseXmlGZipB64))
             - !2xx → NFSeRejectError(mensagens)
        └─ EmitirResult
```

## Componentes

| Camada | Arquivo | Responsabilidade | Depende de |
|--------|---------|------------------|------------|
| contracts | `src/contracts/NFSeXmlBuilder.ts` | interface `build(nfse): string` | `NFSeProps` |
| contracts | `src/contracts/NFSeTransport.ts` | interface `postJson(url, body, cert): Promise<HttpResponse>` | — |
| infra/xml | `src/infra/xml/NFSeXmlBuilder.ts` | monta XML da DPS na ordem do XSD; gera `Id` via helper | `xml-helper` (core), `dps-id` |
| infra/xml | `src/infra/xml/NFSeXmlSigner.ts` | XMLDSig **SHA-256** enveloped em `infDPS` | `canonicalize` (core), `node:crypto` |
| infra/http | `src/infra/http/NFSeHttpTransport.ts` | POST REST + mTLS + gzip/gunzip + JSON | `node:https`, `node:zlib` |
| application | `src/application/use-cases/EmitirNFSeUseCase.ts` | orquestra build→assina→comprime→envia→parseia | contracts acima |
| helpers | `src/shared/helpers/dps-id.ts` | gera `Id` `DPS[0-9]{42}` a partir dos dados da DPS | — |
| core | `src/core/NFSeCore.ts` | implementa `emitir()`, injeta dependências | use case |
| constants | `src/shared/constants/adn-urls.ts` | **corrigir**: separar URL homolog/produção | — |
| types | `src/core/types.ts` (novo) | `EmitirResult` (reutiliza `NFSeEnvironment` de `adn-urls.ts`, não duplica) | — |
| errors | `src/shared/errors/NFSeRejectError.ts` (novo) | rejeição do ADN (status + mensagens) | `DFeError` (core) |

### Contratos principais

```ts
// EmitirResult
type EmitirResult = {
  readonly autorizada: boolean;
  readonly chaveAcesso: string;       // 50 dígitos, do ADN
  readonly xmlNfse: string;           // NFS-e autorizada (descomprimida)
  readonly xmlDps: string;            // DPS assinada enviada
  readonly idDps: string;             // Id da DPS (DPS + 42 dígitos)
  readonly statusHttp: number;
  readonly dataProcessamento?: Date;
};

// NFSeTransport
interface NFSeTransport {
  postJson(url: string, body: unknown, cert: CertificateData): Promise<{
    statusCode: number;
    body: string;
  }>;
}
```

## Tratamento de erros

- **Rejeição do ADN (HTTP != 2xx):** `NFSeRejectError` com `statusCode` e lista de mensagens
  extraídas do corpo JSON (ex.: campo `erros`/`mensagens`).
- **Certificado inválido/expirado:** propaga `CertificateError` do core.
- **XML sem elemento assinável:** `NFSeXmlSigner` lança erro claro (`infDPS` ausente ou sem `Id`).
- **Falha de rede/timeout:** erro do transporte propagado com contexto.

## Testes (sem rede)

`tests/emitir.spec.ts` (e specs unitários por componente), rodados via `npm test` (`tsx --test`):

1. **`dps-id`**: gera Id no formato `DPS[0-9]{42}` com padding correto de cMun/CNPJ/série/nDPS.
2. **`NFSeXmlBuilder`**: dado um `NFSeProps` fixo, produz XML determinístico na ordem do XSD,
   com `Id` em `infDPS` e sem `Id` na raiz.
3. **`NFSeXmlSigner`**: insere `<Signature>` com `SignatureMethod` rsa-sha256 e `DigestMethod`
   sha256, `Reference URI="#DPS…"`, dentro de `<DPS>` após `</infDPS>`. Assinatura verificável
   com a chave pública de um certificado de teste gerado no próprio teste.
4. **`EmitirNFSeUseCase`**: com um `NFSeTransport` fake, verifica que o body enviado é
   `{ dpsXmlGZipB64 }` cujo conteúdo, ao descomprimir, é exatamente o XML assinado; e que uma
   resposta 2xx fake com `nfseXmlGZipB64` é parseada em `EmitirResult` com `chaveAcesso` e
   `xmlNfse` descomprimido. Resposta !2xx fake gera `NFSeRejectError`.

Nenhum teste faz chamada real ao ADN.

## Fora de escopo (iterações futuras)

- `consultar()` / `consultarPorRps()` (GET `/nfse/{chave}`, GET `/dps/{id}`)
- `cancelar()` / `substituir()` (eventos)
- `danfse()` (PDF)
- Validação de schema XSD dedicada (`SchemaValidator`)
- Cálculo automático de tributos/ISS

## Riscos / pontos a validar em homologação

- Nome exato do campo de resposta (`nfseXmlGZipB64` vs variações) e do corpo de erro —
  confirmar contra o Swagger oficial ao integrar na produção restrita.
- Detalhes do canonicalization/namespaces do `infDPS` para o digest bater no ADN.
- Formato de datas/decimais exigido pelo XSD da DPS.
