/**
 * PDF text extraction wrapper using pdf-parse.
 * Takes a PDF buffer and returns the raw text string.
 */

import { PDFParse } from "pdf-parse";

/**
 * Extract all text from a PDF buffer.
 * @param buffer - Raw PDF file bytes
 * @returns Concatenated text content from all pages
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}
