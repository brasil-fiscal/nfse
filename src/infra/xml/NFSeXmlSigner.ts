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
