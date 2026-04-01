/* eslint-env node */
/* global process, Buffer, console */

import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';
import PDFDocument from 'pdfkit';

const ROOT = path.resolve(process.cwd(), '..');
const TMP_DIR = path.resolve(process.cwd(), 'tmp');

const ALIGNMENT_MAX_FILES = 2;
const SIGNAL_MAX_FILES = 5;

function toBase64(buf) {
  return Buffer.from(buf).toString('base64');
}

async function filePayload(filePath, mimeType) {
  const fileName = path.basename(filePath);
  const raw = await fs.readFile(filePath);
  const binaryMime = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/tiff',
    'image/bmp',
  ]);

  const encoding = binaryMime.has(mimeType) ? 'base64' : 'utf8';
  const content = encoding === 'base64' ? toBase64(raw) : raw.toString('utf8');

  return {
    fileName,
    mimeType,
    content,
    encoding,
    rawBytes: raw.byteLength,
  };
}

async function createImageOnlyPdf(imagePath, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const stat = await fs.stat(imagePath);
  if (!stat.isFile()) throw new Error(`Image not found: ${imagePath}`);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true, size: 'A4', margin: 40 });
    const stream = doc.pipe(createWriteStream(outputPath));
    stream.on('finish', resolve);
    stream.on('error', reject);

    doc.image(imagePath, 40, 80, { fit: [515, 700], align: 'center', valign: 'center' });
    doc.end();
  });
}

async function runPdfOcrFallback(pdfPath) {
  const raw = await fs.readFile(pdfPath);
  const parser = new PDFParse({ data: raw });

  let nativeTextWords = 0;
  let extractedImages = 0;
  let ocrWords = 0;

  try {
    const textResult = await parser.getText();
    const nativeText = (textResult.text || '').replace(/\s+/g, ' ').trim();
    nativeTextWords = nativeText ? nativeText.split(/\s+/).length : 0;

    const imageResult = await parser.getImage({ imageBuffer: true, imageThreshold: 300 });
    const images = imageResult.pages.flatMap((page) => page.images || []);
    extractedImages = images.length;

    if (images.length > 0) {
      const topImages = images
        .sort((a, b) => (b.width * b.height) - (a.width * a.height))
        .slice(0, 3);

      const ocrChunks = [];
      for (const img of topImages) {
        const result = await Tesseract.recognize(Buffer.from(img.data), 'eng', { logger: () => undefined });
        const text = (result.data?.text || '').replace(/\s+/g, ' ').trim();
        if (text) ocrChunks.push(text);
      }

      const merged = ocrChunks.join(' ').trim();
      ocrWords = merged ? merged.split(/\s+/).length : 0;
    }
  } finally {
    await parser.destroy();
  }

  return { nativeTextWords, extractedImages, ocrWords };
}

function evaluateBatchLimits(alignmentFiles, signalFiles) {
  return {
    alignment: {
      requested: alignmentFiles.length,
      maxAllowed: ALIGNMENT_MAX_FILES,
      passes: alignmentFiles.length <= ALIGNMENT_MAX_FILES,
    },
    signal: {
      requested: signalFiles.length,
      maxAllowed: SIGNAL_MAX_FILES,
      passes: signalFiles.length <= SIGNAL_MAX_FILES,
    },
  };
}

async function main() {
  const sampleText = path.join(ROOT, 'client', 'public', 'robots.txt');
  const sampleMd = path.join(ROOT, 'client', 'public', 'nike-analysis.md');
  const sampleImg = path.join(ROOT, 'client', 'public', 'images', 'aivis-logo-hero.png');
  const generatedPdf = path.join(TMP_DIR, 'smoke-image-only.pdf');

  await createImageOnlyPdf(sampleImg, generatedPdf);

  const fileA = await filePayload(sampleText, 'text/plain');
  const fileB = await filePayload(sampleMd, 'text/markdown');
  const fileC = await filePayload(sampleImg, 'image/png');
  const fileD = await filePayload(generatedPdf, 'application/pdf');

  const alignmentBatch = [fileA, fileB];
  const signalBatch = [fileA, fileB, fileC, fileD, fileA];

  const limits = evaluateBatchLimits(alignmentBatch, signalBatch);
  const pdfOcr = await runPdfOcrFallback(generatedPdf);

  const report = {
    timestamp: new Date().toISOString(),
    batches: {
      alignment2Files: limits.alignment,
      signal5Files: limits.signal,
    },
    scannedPdfFallback: {
      generatedPdf,
      nativeTextWords: pdfOcr.nativeTextWords,
      extractedImages: pdfOcr.extractedImages,
      ocrWords: pdfOcr.ocrWords,
      passed: pdfOcr.extractedImages > 0 && pdfOcr.ocrWords > 0,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('[upload-smoke] failed:', err?.message || err);
  process.exit(1);
});
