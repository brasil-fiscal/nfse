import { DFeError } from '@brasil-fiscal/core';
import type { DanfseData, DanfsePessoa } from './xml-parser';
import { LOGO_NFSE_PNG_BASE64 } from './logo';

interface PdfDoc {
  on(event: string, handler: (...args: unknown[]) => void): PdfDoc;
  end(): void;
  fontSize(size: number): PdfDoc;
  font(name: string): PdfDoc;
  fillColor(color: string): PdfDoc;
  strokeColor(color: string): PdfDoc;
  lineWidth(width: number): PdfDoc;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): PdfDoc;
  rect(x: number, y: number, w: number, h: number): PdfDoc;
  stroke(): PdfDoc;
  fill(color?: string): PdfDoc;
  moveTo(x: number, y: number): PdfDoc;
  lineTo(x: number, y: number): PdfDoc;
  image(src: Buffer, x: number, y: number, options?: Record<string, unknown>): PdfDoc;
  widthOfString(text: string): number;
  heightOfString(text: string, options?: Record<string, unknown>): number;
  save(): PdfDoc;
  restore(): PdfDoc;
  rotate(angle: number, options?: Record<string, unknown>): PdfDoc;
  fillOpacity(opacity: number): PdfDoc;
}

type QrLib = { toBuffer: (text: string, options?: Record<string, unknown>) => Promise<Buffer> };

export type DanfseOptions = {
  /** Carimba "CANCELADA" (o cancelamento é evento: o XML da NFS-e não o traz). */
  readonly cancelada?: boolean;
};

// Geometria medida do DANFSe v2.0 oficial (A4, pt).
const PW = 595.28;
const PH = 841.89;
const M = 7; // moldura
const W = PW - M * 2;
const COL = W / 4;
const PAD = 4.9;
const ROW = 19.1;
const GRAY = '#EEEEEE';
const BOLD = 'Helvetica-Bold';
const REG = 'Helvetica';

const colX = (i: number) => M + COL * i;

async function loadPdfKit(): Promise<new (options: Record<string, unknown>) => PdfDoc> {
  try {
    const mod = await import('pdfkit');
    return (mod as { default?: unknown }).default as new (options: Record<string, unknown>) => PdfDoc;
  } catch {
    throw new DFeError('pdfkit não está instalado. Instale com: npm install pdfkit');
  }
}

async function loadQrCode(): Promise<QrLib | null> {
  try {
    const mod = (await import('qrcode')) as unknown as QrLib & { default?: QrLib };
    return mod.default ?? mod;
  } catch {
    return null; // sem qrcode, a URL de consulta sai em texto
  }
}

type Cell = { label: string; value: string; span?: number };

export class DanfseGenerator {
  async generate(data: DanfseData, options: DanfseOptions = {}): Promise<Buffer> {
    const PDFDocument = await loadPdfKit();
    const qr = await loadQrCode();
    const qrPng = qr ? await qr.toBuffer(data.urlConsulta, { margin: 0, width: 300, errorCorrectionLevel: 'M' }) : null;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: { Title: `DANFSe ${data.numeroNfse}`, Subject: data.chaveAcesso, Creator: '@brasil-fiscal/nfse' }
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: unknown) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        this.render(doc, data, qrPng, options);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private render(doc: PdfDoc, d: DanfseData, qrPng: Buffer | null, opts: DanfseOptions): void {
    doc.lineWidth(0.75).strokeColor('#000000');
    let y = this.cabecalho(doc, d);
    y = this.identificacao(doc, d, qrPng, y);

    y = this.secao(doc, 'PRESTADOR / FORNECEDOR', y, [
      ...this.linhasPessoa(d.prestador),
      [
        { label: 'Simples Nacional na Data de Competência', value: d.simplesNacional },
        { label: 'Regime de Apuração Tributária pelo SN', value: d.regimeApuracaoSN, span: 3 }
      ]
    ]);
    y = this.pessoaOuAusente(doc, 'TOMADOR / ADQUIRENTE', d.tomador, y);
    y = this.pessoaOuAusente(doc, 'DESTINATÁRIO DA OPERAÇÃO', d.destinatario, y);
    y = this.pessoaOuAusente(doc, 'INTERMEDIÁRIO DA OPERAÇÃO', d.intermediario, y);

    y = this.secao(doc, 'SERVIÇO PRESTADO', y, [
      [
        { label: 'Código de Tributação Nacional/Municipal', value: d.servico.codigoTributacao },
        { label: 'Código da NBS', value: d.servico.codigoNbs },
        { label: 'Local da Prestação / Sigla UF / País', value: d.servico.localPrestacao }
      ]
    ]);
    y = this.textoLivre(doc, d.servico.descricaoTributacao, y, 1);
    y = this.secaoSemTitulo(doc, y, [[{ label: 'Descrição do Serviço', value: d.servico.descricao, span: 4 }]]);

    y = this.secao(doc, 'TRIBUTAÇÃO MUNICIPAL (ISSQN)', y, [
      [
        { label: 'Tipo de Tributação do ISSQN', value: d.issqn.tipoTributacao },
        { label: 'Município / Sigla UF / País de Incidência do ISSQN', value: d.issqn.municipioIncidencia, span: 2 }
      ],
      [
        { label: 'BC ISSQN', value: d.issqn.baseCalculo },
        { label: 'Alíquota Aplicada', value: d.issqn.aliquota },
        { label: 'Retenção do ISSQN', value: d.issqn.retencao },
        { label: 'ISSQN Apurado', value: d.issqn.valor }
      ]
    ]);
    y = this.secao(doc, 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)', y, [
      [
        { label: 'IRRF', value: d.federal.irrf },
        { label: 'Contribuição Previdenciária - Retida', value: d.federal.contribuicaoPrevidenciaria },
        { label: 'Contribuições Sociais - Retidas', value: d.federal.contribuicoesSociais }
      ],
      [
        { label: 'PIS - Débito Apuração Própria', value: d.federal.pis },
        { label: 'COFINS - Débito Apuração Própria', value: d.federal.cofins },
        { label: 'Descrição Contrib. Sociais - Retidas', value: '-', span: 2 }
      ]
    ]);
    const t = d.ibsCbs;
    y = this.secao(doc, 'TRIBUTAÇÃO IBS/CBS', y, [
      [
        { label: 'CST / cClassTrib', value: t.cstClassTrib },
        {
          label: 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF',
          value: t.indicadorOperacao,
          span: 2
        }
      ],
      [
        { label: 'Exclusões e Reduções da Base de Cálculo', value: t.exclusoesReducoes },
        { label: 'Base de Cálculo Após Exclusões e Reduções', value: t.baseCalculo },
        { label: 'Red. Alíquota IBS / Red. Alíquota CBS', value: t.reducaoAliquotas },
        { label: 'Alíquota - IBS UF / IBS Mun', value: t.aliquotasIbs }
      ],
      [
        { label: 'Alíq. Efetiva Municipal - IBS', value: t.aliqEfetivaMun },
        { label: 'Valor Apurado Municipal - IBS', value: t.valorMun },
        { label: 'Alíq. Efetiva Estadual - IBS', value: t.aliqEfetivaUf },
        { label: 'Valor Apurado Estadual - IBS', value: t.valorUf }
      ],
      [
        { label: 'Valor Total Apurado - IBS', value: t.totalIbs },
        { label: 'Alíquota - CBS', value: t.aliquotaCbs },
        { label: 'Alíquota Efetiva - CBS', value: t.aliqEfetivaCbs },
        { label: 'Valor Total Apurado - CBS', value: t.totalCbs }
      ]
    ]);
    const v = d.totais;
    y = this.secao(doc, 'VALOR TOTAL DA NFS-e', y, [
      [
        { label: 'VALOR DA OPERAÇÃO / SERVIÇO', value: v.valorServico },
        { label: 'Desconto Incondicionado', value: v.descontoIncondicionado },
        { label: 'Desconto Condicionado', value: v.descontoCondicionado }
      ],
      [
        { label: 'Total das Retenções (ISSQN / Federais)', value: v.totalRetencoes },
        { label: 'VALOR LÍQUIDO DA NFS-e', value: v.valorLiquido },
        { label: 'Total do IBS/CBS', value: v.totalIbsCbs },
        { label: 'VALOR LÍQUIDO DA NFS-e + IBS/CBS', value: v.valorLiquidoComIbsCbs }
      ]
    ]);

    const rodapeY = PH - M - 34;
    this.informacoesComplementares(doc, d.informacoesComplementares, y, rodapeY);
    this.rodape(doc, d, rodapeY);
    doc.rect(M, M, W, PH - M * 2).stroke();

    // Com as duas marcas, cada uma fica de um lado do centro para não se sobreporem.
    const duas = d.homologacao && opts.cancelada;
    if (opts.cancelada) this.marcaDagua(doc, 'CANCELADA', 56, duas ? -55 : 0);
    if (d.homologacao) {
      this.marcaDagua(doc, 'SEM VALIDADE JURÍDICA', 32, duas ? 55 : 0, 'NFS-e emitida em ambiente de homologação');
    }
  }

  // ── blocos ──

  private cabecalho(doc: PdfDoc, d: DanfseData): number {
    const h = 34;
    doc.rect(M, M, W, h).fill(GRAY);
    doc.fillColor('#000000');
    doc.image(Buffer.from(LOGO_NFSE_PNG_BASE64, 'base64'), M + 5, M + 4, { height: 26 });
    doc.font(BOLD).fontSize(9);
    doc.text('DANFSe v2.0', colX(1), M + 6, { width: COL * 2, align: 'center' });
    doc.text('Documento Auxiliar da NFS-e', colX(1), M + 16.5, { width: COL * 2, align: 'center' });
    doc.font(REG).fontSize(8).text(this.fit(doc, `Município: ${d.municipioEmissor}`, COL - PAD), colX(3) + PAD, M + 4.5);
    doc.fontSize(6);
    doc.text(`Ambiente Gerador: ${d.ambienteGerador}`, colX(3) + PAD, M + 14);
    doc.text(`Tipo de Ambiente: ${d.tipoAmbiente}`, colX(3) + PAD, M + 21);
    this.hline(doc, M + h);
    return M + h;
  }

  private identificacao(doc: PdfDoc, d: DanfseData, qrPng: Buffer | null, y: number): number {
    const top = y;
    const campo = (label: string, value: string, col: number, yy: number, w = COL) => {
      doc.font(BOLD).fontSize(7).fillColor('#000000').text(label, colX(col) + PAD, yy + 3.7);
      doc.font(REG).fontSize(7).text(this.fit(doc, value, w - PAD * 2), colX(col) + PAD, yy + 11.5);
    };
    campo('CHAVE DE ACESSO DA NFS-e', d.chaveAcesso, 0, y, COL * 3);
    y += 20.2;
    campo('NÚMERO DA NFS-e', d.numeroNfse, 0, y);
    campo('COMPETÊNCIA DA NFS-e', d.competencia, 1, y);
    campo('DATA E HORA DA EMISSÃO DA NFS-e', d.dataEmissaoNfse, 2, y);
    y += 20.2;
    campo('NÚMERO DA DPS', d.numeroDps, 0, y);
    campo('SÉRIE DA DPS', d.serieDps, 1, y);
    campo('DATA E HORA DA EMISSÃO DA DPS', d.dataEmissaoDps, 2, y);
    y += 20.2;
    doc.rect(colX(0), y, COL, 20.2).fill(GRAY);
    campo('EMITENTE DA NFS-e', d.emitenteNfse, 0, y);
    campo('SITUAÇÃO DA NFS-e', d.situacao, 1, y);
    campo('FINALIDADE', d.finalidade, 2, y);
    y += 20.2;

    const qrSize = 45;
    const qrX = colX(3) + (COL - qrSize) / 2;
    if (qrPng) {
      doc.image(qrPng, qrX, top + 3, { width: qrSize, height: qrSize });
    } else {
      doc.font(REG).fontSize(5).fillColor('#000000').text(d.urlConsulta, colX(3) + PAD, top + 5, { width: COL - PAD * 2 });
    }
    doc.font(REG).fontSize(6).fillColor('#000000').text(
      'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e',
      colX(3) + PAD,
      top + 51,
      { width: COL - PAD * 2, lineGap: -0.6 }
    );
    this.hline(doc, y);
    return y;
  }

  private linhasPessoa(p: DanfsePessoa): Cell[][] {
    return [
      [
        { label: 'CNPJ / CPF / NIF', value: p.documento },
        { label: 'Indicador Municipal (Inscrição)', value: p.inscricaoMunicipal },
        { label: 'Telefone', value: p.telefone }
      ],
      [
        { label: 'Nome / Nome Empresarial', value: p.nome, span: 2 },
        { label: 'Município / Sigla UF', value: p.municipioUf },
        { label: 'Código IBGE / CEP', value: p.ibgeCep }
      ],
      [
        { label: 'Endereço', value: p.endereco, span: 2 },
        { label: 'E-mail', value: p.email, span: 2 }
      ]
    ];
  }

  private pessoaOuAusente(doc: PdfDoc, titulo: string, p: DanfsePessoa | undefined, y: number): number {
    if (p) return this.secao(doc, titulo, y, this.linhasPessoa(p));
    const h = 8.5;
    doc.font(REG).fontSize(7).fillColor('#000000').text(`${titulo} NÃO IDENTIFICADO NA NFS-e`, M, y + 1, {
      width: W,
      align: 'center'
    });
    this.hline(doc, y + h);
    return y + h;
  }

  /**
   * Seção do DANFSe: a 1ª linha tem o título na coluna 0 (fundo cinza) e as células
   * nas colunas 1–3; as linhas seguintes usam as 4 colunas.
   */
  private secao(
    doc: PdfDoc,
    titulo: string,
    y: number,
    linhas: Cell[][]
  ): number {
    doc.rect(colX(0), y, COL, ROW).fill(GRAY);
    doc.font(BOLD).fontSize(7).fillColor('#000000').text(titulo, colX(0) + PAD, y + 2.6, { width: COL - PAD * 2 });
    linhas.forEach((linha, i) => this.linha(doc, linha, y + ROW * i, i === 0 ? 1 : 0));
    const fim = y + ROW * linhas.length;
    this.hline(doc, fim);
    return fim;
  }

  private secaoSemTitulo(doc: PdfDoc, y: number, linhas: Cell[][]): number {
    linhas.forEach((linha, i) => this.linha(doc, linha, y + ROW * i, 0));
    const fim = y + ROW * linhas.length;
    this.hline(doc, fim);
    return fim;
  }

  private linha(doc: PdfDoc, cells: Cell[], y: number, colInicial: number): void {
    let col = colInicial;
    for (const c of cells) {
      const span = c.span ?? 1;
      const w = COL * span - PAD * 2;
      const x = colX(col) + PAD;
      doc.font(BOLD).fontSize(6).fillColor('#000000').text(this.fit(doc, c.label, w), x, y + 2.5);
      doc.font(REG).fontSize(7).text(this.fit(doc, c.value, w), x, y + 9.2);
      col += span;
    }
  }

  /** Texto corrido de uma linha (ex.: descrição do código de tributação nacional). */
  private textoLivre(doc: PdfDoc, texto: string, y: number, maxLinhas: number): number {
    doc.font(REG).fontSize(7).fillColor('#000000');
    const t = maxLinhas === 1 ? this.fit(doc, texto, W - PAD * 2) : texto;
    doc.text(t, M + PAD, y + 3.5, { width: W - PAD * 2 });
    return y + 12;
  }

  private informacoesComplementares(doc: PdfDoc, texto: string, y: number, limite: number): void {
    doc.font(BOLD).fontSize(7).fillColor('#000000').text('INFORMAÇÕES COMPLEMENTARES', colX(0) + PAD, y + 2.6);
    doc.font(REG).fontSize(7).text(texto, M + PAD, y + 20, {
      width: W - PAD * 2,
      height: Math.max(0, limite - (y + 20) - 4),
      ellipsis: true
    });
  }

  private rodape(doc: PdfDoc, d: DanfseData, y: number): void {
    const h = 20;
    const by = y + 6;
    doc.rect(M + 3, by, W - 6, h).stroke();
    doc.moveTo(colX(1), by).lineTo(colX(1), by + h).stroke();
    doc.moveTo(colX(2), by).lineTo(colX(2), by + h).stroke();
    doc.font(BOLD).fontSize(6).fillColor('#000000');
    doc.text('DATA CIENTIFICAÇÃO:', colX(0) + PAD + 1, by + 3);
    doc.text('IDENTIFICAÇÃO E ASSINATURA', colX(1) + PAD + 1, by + 3);
    doc.text('N° NFS-e / CHAVE NFS-e', colX(2) + PAD + 1, by + 3);
    doc.font(REG).fontSize(7).text(`${d.numeroNfse} / ${d.chaveAcesso}`, colX(2) + PAD + 1, by + 9.7);
  }

  private marcaDagua(doc: PdfDoc, texto: string, tamanho: number, dy: number, subtitulo?: string): void {
    const largura = PW * 1.4; // texto girado: área maior que a página para não quebrar linha
    const x = (PW - largura) / 2;
    doc.save();
    doc.rotate(-40, { origin: [PW / 2, PH / 2] });
    doc.fillOpacity(0.16).fillColor('#B00000').font(BOLD).fontSize(tamanho);
    doc.text(texto, x, PH / 2 + dy - tamanho / 2, { width: largura, align: 'center', lineBreak: false });
    if (subtitulo) {
      doc.fontSize(13).text(subtitulo, x, PH / 2 + dy + tamanho / 2 + 4, { width: largura, align: 'center', lineBreak: false });
    }
    doc.restore();
    doc.fillOpacity(1).fillColor('#000000');
  }

  // ── utilitários ──

  private hline(doc: PdfDoc, y: number): void {
    doc.moveTo(M, y).lineTo(M + W, y).stroke();
  }

  /** Corta com reticências para caber em uma linha de largura `w` (fonte atual). */
  private fit(doc: PdfDoc, text: string, w: number): string {
    if (doc.widthOfString(text) <= w) return text;
    let t = text;
    while (t.length > 1 && doc.widthOfString(t + '...') > w) t = t.slice(0, -1);
    return t.trimEnd() + '...';
  }
}
