// @ts-ignore - pdf-parse commonjs export
import pdf from 'pdf-parse';

/**
 * Extracts plain text and basic tabular streams from a PDF buffer
 * using 100% pure JavaScript (zero external system binaries).
 */
export async function pdfBufferToUniverDocSnapshot(buffer: Buffer, filename = 'PDF Document') {
  const data = await pdf(buffer);
  const text = data.text || '';
  const cleanDataStream = (text.endsWith('\n') ? text : `${text}\n`).replace(/\n/g, '\r\n');

  return {
    id: `univer-doc-pdf-${Date.now()}`,
    title: filename.replace(/\.[^/.]+$/, ''),
    body: {
      dataStream: cleanDataStream || 'Empty PDF document...\r\n',
    },
    meta: {
      totalPages: data.numpages || 1,
      info: data.info || {},
    },
  };
}
