import { tag, tagGroup, formatDate } from '@brasil-fiscal/core';
import { CancelamentoInput } from '../../domain/evento';
import { gerarIdEvento, TP_EVENTO_CANCELAMENTO } from '../../shared/helpers/evento-id';

const NFSE_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
const EVENTO_VERSAO = '1.00';
const XDESC_CANCELAMENTO = 'Cancelamento de NFS-e';

function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

/**
 * Monta o XML do pedido de registro de evento de cancelamento (e101101) da
 * NFS-e Nacional, conforme pedRegEvento_v1.00/1.01.xsd: raiz <pedRegEvento>,
 * infPedReg = tpAmb, verAplic, dhEvento, CNPJAutor|CPFAutor, chNFSe, e101101. Assina-se o elemento <infPedReg>; a <Signature> entra como
 * irmã, logo após </infPedReg>.
 */
export class CancelamentoEventoBuilder {
  build(input: CancelamentoInput): string {
    const xMotivo = input.xMotivo ?? '';
    if (xMotivo.length < 15 || xMotivo.length > 255) {
      throw new Error('xMotivo deve ter entre 15 e 255 caracteres');
    }

    const chave = onlyDigits(input.chaveAcesso);
    const ambiente = input.ambiente ?? 2;
    const dhEvento = input.dataEvento ?? new Date();
    const id = gerarIdEvento({ chaveAcesso: chave, tipoEvento: TP_EVENTO_CANCELAMENTO });

    const autor = input.autorCnpj
      ? tag('CNPJAutor', onlyDigits(input.autorCnpj))
      : tag('CPFAutor', onlyDigits(input.autorCpf ?? ''));

    const e101101 = tagGroup(
      'e101101',
      tag('xDesc', XDESC_CANCELAMENTO) + tag('cMotivo', input.cMotivo) + tag('xMotivo', xMotivo)
    );

    const infPedReg =
      `<infPedReg Id="${id}">` +
      tag('tpAmb', ambiente) +
      tag('verAplic', input.versaoAplicativo ?? EVENTO_VERSAO) +
      tag('dhEvento', formatDate(dhEvento)) +
      autor +
      tag('chNFSe', chave) +
      e101101 +
      `</infPedReg>`;

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<pedRegEvento xmlns="${NFSE_NAMESPACE}" versao="${EVENTO_VERSAO}">` +
      infPedReg +
      `</pedRegEvento>`
    );
  }
}
