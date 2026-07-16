import { createSign, createHash } from 'node:crypto';
import { canonicalize } from '@brasil-fiscal/core';
import type { XmlSigner, CertificateData } from '@brasil-fiscal/core';

const SIGNATURE_NS = 'http://www.w3.org/2000/09/xmldsig#';
const C14N_ALGORITHM = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED_SIGNATURE = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SHA256_ALGORITHM = 'http://www.w3.org/2001/04/xmlenc#sha256';
const RSA_SHA256_ALGORITHM = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

/**
 * Assinador XMLDSig SHA-256 da NFS-e Nacional.
 * Assina um elemento (enveloped) e insere a <Signature> como irmã, logo após
 * o fechamento do elemento, dentro do elemento pai.
 *
 * Por padrão assina a DPS (<infDPS> dentro de <DPS>). Para eventos, instancie
 * com ('infPedReg', 'pedidoRegistroEvento').
 */
export class NFSeXmlSigner implements XmlSigner {
  constructor(
    private readonly elementName: string = 'infDPS',
    private readonly parentElement: string = 'DPS'
  ) {}

  sign(xml: string, certificate: CertificateData): string {
    const { elementName, parentElement } = this;
    const match = xml.match(new RegExp(`<${elementName}[^>]*>[\\s\\S]*<\\/${elementName}>`));
    if (!match) {
      throw new Error(`Elemento <${elementName}> não encontrado no XML`);
    }
    const idMatch = match[0].match(/Id="([^"]+)"/);
    if (!idMatch) {
      throw new Error(`Atributo Id não encontrado em <${elementName}>`);
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
      `</${elementName}></${parentElement}>`,
      `</${elementName}>${signature}</${parentElement}>`
    );
  }

  /**
   * Propaga os namespaces declarados no elemento pai para o elemento assinado,
   * de modo que a canonicalização inclua os namespaces efetivos no digest.
   */
  private propagateNamespaces(xml: string, element: string): string {
    const { elementName, parentElement } = this;
    const nsRegex = /xmlns(?::[\w]+)?="[^"]+"/g;
    const parentMatch = xml.match(new RegExp(`<${parentElement}[^>]*>`));
    const parentNs: string[] = [];
    if (parentMatch) {
      let m: RegExpExecArray | null;
      while ((m = nsRegex.exec(parentMatch[0])) !== null) {
        parentNs.push(m[0]);
      }
    }
    if (parentNs.length === 0) return element;

    const openMatch = element.match(new RegExp(`^<${elementName}([^>]*)>`));
    if (!openMatch) return element;
    const existing = openMatch[1];
    const missing = parentNs.filter((ns) => !existing.includes(ns));
    if (missing.length === 0) return element;

    return element.replace(new RegExp(`^<${elementName}`), `<${elementName} ${missing.join(' ')}`);
  }
}
