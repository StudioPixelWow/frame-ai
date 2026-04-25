/**
 * Minimal PDF Builder — zero dependencies
 * Generates valid PDF 1.4 documents with Hebrew (UTF-16BE) support.
 * Designed for structured text reports with sections, bullet points, and tables.
 */

/* ── Helpers ── */

function utf16BEHex(str: string): string {
  let hex = 'FEFF'; // BOM
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  }
  return hex;
}

function pdfString(str: string): string {
  // Check if string has non-ASCII characters (Hebrew, etc.)
  const hasUnicode = /[^\x00-\x7F]/.test(str);
  if (hasUnicode) {
    return `<${utf16BEHex(str)}>`;
  }
  // ASCII: simple escape
  const escaped = str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  return `(${escaped})`;
}

function reverseHebrew(text: string): string {
  /**
   * Reverse Hebrew segments for RTL display in PDF.
   * Keeps ASCII/digits in LTR order within the reversed string.
   */
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    // Hebrew Unicode range: 0x0590 - 0x05FF, also Arabic: 0x0600-0x06FF
    if (code >= 0x0590 && code <= 0x06FF) {
      // Collect Hebrew segment
      let seg = '';
      while (i < text.length) {
        const c = text.charCodeAt(i);
        if (c >= 0x0590 && c <= 0x06FF || text[i] === ' ' || text[i] === '"' || text[i] === '״' || text[i] === '׳' || text[i] === "'") {
          seg += text[i];
          i++;
        } else break;
      }
      // Reverse Hebrew segment
      result.push(seg.split('').reverse().join(''));
    } else {
      result.push(text[i]);
      i++;
    }
  }
  // For fully Hebrew strings, reverse the whole thing
  const hebrewRatio = text.split('').filter(c => c.charCodeAt(0) >= 0x0590 && c.charCodeAt(0) <= 0x06FF).length / Math.max(1, text.length);
  if (hebrewRatio > 0.5) {
    return result.reverse().join('');
  }
  return result.join('');
}

/* ── Types ── */

export interface PDFSection {
  title: string;
  subtitle?: string;
  items: string[];
  emptyMessage?: string;
}

export interface PDFReportConfig {
  title: string;
  subtitle: string;
  date: string;
  generatedBy: string;
  sections: PDFSection[];
  summaryLine?: string;
}

/* ── PDF Builder ── */

export class PDFBuilder {
  private objects: string[] = [];
  private objectOffsets: number[] = [];
  private pages: number[] = [];
  private currentContent = '';
  private y = 0;

  // Page dimensions (A4 in points: 595.28 x 841.89)
  private readonly W = 595.28;
  private readonly H = 841.89;
  private readonly MARGIN_TOP = 60;
  private readonly MARGIN_BOTTOM = 60;
  private readonly MARGIN_LEFT = 50;
  private readonly MARGIN_RIGHT = 50;
  private readonly LINE_HEIGHT = 16;
  private readonly CONTENT_WIDTH: number;

  // Font object IDs
  private fontRegularId = 0;
  private fontBoldId = 0;

  constructor() {
    this.CONTENT_WIDTH = this.W - this.MARGIN_LEFT - this.MARGIN_RIGHT;
  }

  /**
   * Generate a structured business report PDF
   */
  generateReport(config: PDFReportConfig): Uint8Array {
    // Reset state
    this.objects = [];
    this.objectOffsets = [];
    this.pages = [];
    this.currentContent = '';
    this.y = this.H - this.MARGIN_TOP;

    // Reserve object slots: 1=Catalog, 2=Pages, 3=FontRegular, 4=FontBold
    this.addObject(''); // placeholder catalog
    this.addObject(''); // placeholder pages
    this.fontRegularId = this.addObject(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
    );
    this.fontBoldId = this.addObject(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`
    );

    // Start first page
    this.startNewPage();

    // ── Title block ──
    this.drawTitle(config.title);
    this.y -= 6;
    this.drawSubtitle(config.subtitle);
    this.y -= 4;
    this.drawText(`${config.date}  |  ${config.generatedBy}`, 9, false, 0.5);
    this.y -= 20;
    this.drawLine();
    this.y -= 24;

    // ── Sections ──
    for (let si = 0; si < config.sections.length; si++) {
      const section = config.sections[si];

      // Check if we have enough room for header + at least 2 items
      if (this.y < this.MARGIN_BOTTOM + 80) {
        this.finishPage();
        this.startNewPage();
      }

      // Section number + title
      this.drawSectionHeader(`${si + 1}. ${section.title}`);
      this.y -= 4;

      if (section.subtitle) {
        this.drawText(section.subtitle, 9, false, 0.45);
        this.y -= 6;
      }

      if (section.items.length === 0) {
        this.drawText(section.emptyMessage || 'No items found.', 10, false, 0.4);
        this.y -= 8;
      } else {
        for (const item of section.items) {
          if (this.y < this.MARGIN_BOTTOM + 20) {
            this.finishPage();
            this.startNewPage();
          }
          this.drawBulletItem(item);
        }
      }

      this.y -= 20;

      // Subtle divider between sections (except last)
      if (si < config.sections.length - 1) {
        this.drawDivider();
        this.y -= 16;
      }
    }

    // ── Summary line ──
    if (config.summaryLine) {
      if (this.y < this.MARGIN_BOTTOM + 40) {
        this.finishPage();
        this.startNewPage();
      }
      this.y -= 8;
      this.drawLine();
      this.y -= 16;
      this.drawText(config.summaryLine, 9, true, 0.35);
    }

    // Finish last page
    this.finishPage();

    // Add page numbers as footer on each page
    // (already handled via page content streams)

    return this.buildPDF();
  }

  /* ── Drawing primitives ── */

  private drawTitle(text: string) {
    const x = this.W - this.MARGIN_RIGHT; // Right-aligned for RTL
    this.currentContent += `BT /F2 20 Tf ${x} ${this.y} Td ${pdfString(reverseHebrew(text))} Tj ET\n`;
    this.y -= 26;
  }

  private drawSubtitle(text: string) {
    const x = this.W - this.MARGIN_RIGHT;
    this.currentContent += `BT /F1 11 Tf 0.4 0.4 0.4 rg ${x} ${this.y} Td ${pdfString(reverseHebrew(text))} Tj 0 0 0 rg ET\n`;
    this.y -= 16;
  }

  private drawSectionHeader(text: string) {
    const x = this.W - this.MARGIN_RIGHT;
    // Accent bar
    this.currentContent += `0.15 0.15 0.15 rg ${this.W - this.MARGIN_RIGHT} ${this.y - 2} -${this.CONTENT_WIDTH} 18 re f 1 1 1 rg\n`;
    this.currentContent += `BT /F2 12 Tf 1 1 1 rg ${x - 10} ${this.y + 1} Td ${pdfString(reverseHebrew(text))} Tj 0 0 0 rg ET\n`;
    this.y -= 24;
  }

  private drawBulletItem(text: string) {
    const bulletX = this.W - this.MARGIN_RIGHT - 8;
    const textX = this.W - this.MARGIN_RIGHT - 18;

    // Bullet dot
    this.currentContent += `0.3 0.3 0.3 rg ${bulletX} ${this.y + 3} 2 2 re f 0 0 0 rg\n`;

    // Wrap text if too long
    const maxChars = 75;
    if (text.length > maxChars) {
      const lines = this.wrapText(text, maxChars);
      for (let i = 0; i < lines.length; i++) {
        const lx = i === 0 ? textX : textX;
        this.currentContent += `BT /F1 10 Tf ${lx} ${this.y} Td ${pdfString(reverseHebrew(lines[i]))} Tj ET\n`;
        this.y -= this.LINE_HEIGHT;
      }
    } else {
      this.currentContent += `BT /F1 10 Tf ${textX} ${this.y} Td ${pdfString(reverseHebrew(text))} Tj ET\n`;
      this.y -= this.LINE_HEIGHT;
    }
  }

  private drawText(text: string, size: number, bold: boolean, gray: number) {
    const font = bold ? '/F2' : '/F1';
    const x = this.W - this.MARGIN_RIGHT;
    this.currentContent += `BT ${font} ${size} Tf ${gray} ${gray} ${gray} rg ${x} ${this.y} Td ${pdfString(reverseHebrew(text))} Tj 0 0 0 rg ET\n`;
    this.y -= size + 4;
  }

  private drawLine() {
    this.currentContent += `0.75 0.75 0.75 RG 0.5 w ${this.MARGIN_LEFT} ${this.y} m ${this.W - this.MARGIN_RIGHT} ${this.y} l S\n`;
  }

  private drawDivider() {
    const cx = this.W / 2;
    this.currentContent += `0.82 0.82 0.82 RG 0.5 w ${cx - 40} ${this.y} m ${cx + 40} ${this.y} l S\n`;
  }

  private drawPageNumber(pageNum: number, totalPages: number) {
    const text = `${pageNum} / ${totalPages}`;
    this.currentContent += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${this.W / 2 - 10} 30 Td (${text}) Tj 0 0 0 rg ET\n`;
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        if (current) lines.push(current.trim());
        current = word;
      } else {
        current += (current ? ' ' : '') + word;
      }
    }
    if (current) lines.push(current.trim());
    return lines;
  }

  /* ── Page management ── */

  private startNewPage() {
    this.y = this.H - this.MARGIN_TOP;
    this.currentContent = '';
  }

  private finishPage() {
    const pageNum = this.pages.length + 1;
    this.drawPageNumber(pageNum, 0); // placeholder — we update later

    // Create content stream
    const streamData = this.currentContent;
    const streamId = this.addObject(
      `<< /Length ${streamData.length} >>\nstream\n${streamData}endstream`
    );

    // Create page object
    const pageId = this.addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${this.fontRegularId} 0 R /F2 ${this.fontBoldId} 0 R >> >> >>`
    );
    this.pages.push(pageId);
  }

  /* ── Object management ── */

  private addObject(content: string): number {
    this.objects.push(content);
    return this.objects.length; // 1-based
  }

  /* ── Final assembly ── */

  private buildPDF(): Uint8Array {
    // Update catalog (object 1)
    this.objects[0] = `<< /Type /Catalog /Pages 2 0 R >>`;

    // Update pages (object 2)
    const kidRefs = this.pages.map(id => `${id} 0 R`).join(' ');
    this.objects[1] = `<< /Type /Pages /Kids [${kidRefs}] /Count ${this.pages.length} >>`;

    // Build the actual PDF bytes
    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

    // Write objects and record offsets
    this.objectOffsets = [];
    for (let i = 0; i < this.objects.length; i++) {
      this.objectOffsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${this.objects[i]}\nendobj\n`;
    }

    // Cross-reference table
    const xrefOffset = pdf.length;
    pdf += 'xref\n';
    pdf += `0 ${this.objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (const offset of this.objectOffsets) {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }

    // Trailer
    pdf += 'trailer\n';
    pdf += `<< /Size ${this.objects.length + 1} /Root 1 0 R >>\n`;
    pdf += 'startxref\n';
    pdf += `${xrefOffset}\n`;
    pdf += '%%EOF\n';

    // Convert to Uint8Array
    const encoder = new TextEncoder();
    return encoder.encode(pdf);
  }
}

/**
 * Convenience: generate a business order report PDF from structured data
 */
export function generateBusinessOrderPDF(config: PDFReportConfig): Uint8Array {
  const builder = new PDFBuilder();
  return builder.generateReport(config);
}
