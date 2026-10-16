import * as pdfjsLib from 'pdfjs-dist';

export interface ExtractedPDF {
  title: string;
  numPages: number;
  pages: { pageNum: number; text: string }[];
  fullText: string;
}

export class PDFService {
  /**
   * Extract selectable text page by page from an uploaded PDF file buffer.
   */
  static async extractText(arrayBuffer: ArrayBuffer, fileName: string = 'Document.pdf'): Promise<ExtractedPDF> {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });

      const pdf = await loadingTask.promise;
      const pages: { pageNum: number; text: string }[] = [];
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (pageText) {
          pages.push({ pageNum: i, text: pageText });
          fullText += (fullText ? '\n\n' : '') + pageText;
        }
      }

      let title = fileName.replace(/\.[^/.]+$/, '');
      try {
        const metadata = await pdf.getMetadata();
        const docTitle = (metadata?.info as any)?.Title;
        if (docTitle && typeof docTitle === 'string' && docTitle.trim().length > 0) {
          title = docTitle.trim();
        }
      } catch {
        // use fallback title
      }

      return {
        title,
        numPages: pdf.numPages,
        pages,
        fullText
      };
    } catch (err: any) {
      console.warn('[LexiFlow] PDF.js extraction error, attempting fallback stream reader:', err);
      // Fallback simple stream text extraction
      const fallbackText = this.fallbackExtract(arrayBuffer);
      return {
        title: fileName.replace(/\.[^/.]+$/, ''),
        numPages: 1,
        pages: [{ pageNum: 1, text: fallbackText }],
        fullText: fallbackText
      };
    }
  }

  /**
   * Simple regex-based fallback for uncompressed or semi-structured PDF text streams
   */
  private static fallbackExtract(arrayBuffer: ArrayBuffer): string {
    try {
      const decoder = new TextDecoder('latin1');
      const raw = decoder.decode(arrayBuffer);
      const textChunks: string[] = [];
      const regex = /\(([^)]+)\)\s*Tj/g;
      let match;
      while ((match = regex.exec(raw)) !== null) {
        textChunks.push(match[1]);
      }
      return textChunks.join(' ').replace(/\s+/g, ' ').trim() || 'Could not extract text from this PDF file.';
    } catch {
      return 'Could not parse text from this PDF file.';
    }
  }
}
