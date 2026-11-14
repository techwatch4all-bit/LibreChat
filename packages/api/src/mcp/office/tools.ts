import { z } from 'zod';

export const SheetGetSummarySchema = z.object({
  snapshot: z.string().describe('The Univer sheet snapshot JSON string'),
});

export const SheetGetRangeSchema = z.object({
  snapshot: z.string().describe('The Univer sheet snapshot JSON string'),
  sheetId: z.string().optional().describe('Target sheet ID; defaults to active sheet'),
  range: z.string().describe('A1 notation range to extract, e.g. "A1:D10" or "B2:B50"'),
});

export const SheetSetValuesSchema = z.object({
  snapshot: z.string().describe('The Univer sheet snapshot JSON string'),
  sheetId: z.string().optional().describe('Target sheet ID; defaults to active sheet'),
  startCell: z.string().describe('A1 notation starting cell, e.g. "A1" or "C5"'),
  values: z.array(z.array(z.any())).describe('2D array of rows and column cell values to set'),
});

export const DocInsertTextSchema = z.object({
  snapshot: z.string().describe('The Univer doc snapshot JSON string'),
  text: z.string().describe('The text paragraph or content to append or insert'),
  position: z.enum(['append', 'prepend']).default('append').describe('Position in document'),
});

/**
 * Parses an A1-style reference into zero-based column and row coordinates.
 */
export function a1ToCoords(a1: string): { col: number; row: number } {
  const match = a1.trim().toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) {
    return { col: 0, row: 0 };
  }
  const colStr = match[1];
  const rowStr = match[2];

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1; // 0-based
  const row = parseInt(rowStr, 10) - 1; // 0-based
  return { col, row };
}

/**
 * Parses an A1 range (e.g. "A1:C10") into bounding box.
 */
export function parseA1Range(rangeStr: string): {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
} {
  const parts = rangeStr.split(':');
  const start = a1ToCoords(parts[0]);
  const end = parts.length > 1 ? a1ToCoords(parts[1]) : start;
  return {
    startCol: Math.min(start.col, end.col),
    startRow: Math.min(start.row, end.row),
    endCol: Math.max(start.col, end.col),
    endRow: Math.max(start.row, end.row),
  };
}

/**
 * Returns structural metadata of a sheet snapshot without dumping the whole document.
 */
export function getSheetSummary(snapshot: Record<string, any>) {
  const sheets = snapshot.sheets || {};
  const sheetList = Object.keys(sheets).map((id) => {
    const s = sheets[id];
    return {
      sheetId: id,
      name: s.name,
      rowCount: s.rowCount || 0,
      columnCount: s.columnCount || 0,
      cellDataCount: s.cellData ? Object.keys(s.cellData).length : 0,
    };
  });
  return {
    title: snapshot.name || 'Workbook',
    sheetCount: sheetList.length,
    sheets: sheetList,
  };
}

/**
 * Extracts a specific range of values from cellData without exceeding LLM context.
 */
export function getSheetRange(
  snapshot: Record<string, any>,
  rangeStr: string,
  targetSheetId?: string,
) {
  const sheets = snapshot.sheets || {};
  const sheetId = targetSheetId || Object.keys(sheets)[0];
  const sheet = sheets[sheetId];
  if (!sheet) {
    return { error: `Sheet not found: ${sheetId}` };
  }

  const { startCol, startRow, endCol, endRow } = parseA1Range(rangeStr);
  const cellData = sheet.cellData || {};
  const matrix: any[][] = [];

  for (let r = startRow; r <= endRow; r++) {
    const rowValues: any[] = [];
    const rowObj = cellData[r] || {};
    for (let c = startCol; c <= endCol; c++) {
      const cell = rowObj[c];
      rowValues.push(cell?.v !== undefined ? cell.v : null);
    }
    matrix.push(rowValues);
  }

  return {
    sheetId,
    sheetName: sheet.name,
    range: rangeStr,
    values: matrix,
  };
}

/**
 * Applies a 2D matrix of values starting at `startCell` onto the snapshot.
 * Mutates and returns the modified snapshot.
 */
export function setSheetValues(
  snapshot: Record<string, any>,
  startCell: string,
  values: any[][],
  targetSheetId?: string,
) {
  const sheets = snapshot.sheets || {};
  const sheetId = targetSheetId || Object.keys(sheets)[0];
  const sheet = sheets[sheetId];
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetId}`);
  }

  if (!sheet.cellData) {
    sheet.cellData = {};
  }

  const { col: baseCol, row: baseRow } = a1ToCoords(startCell);

  for (let r = 0; r < values.length; r++) {
    const targetRow = baseRow + r;
    if (!sheet.cellData[targetRow]) {
      sheet.cellData[targetRow] = {};
    }
    const rowArr = values[r];
    for (let c = 0; c < rowArr.length; c++) {
      const targetCol = baseCol + c;
      const val = rowArr[c];
      sheet.cellData[targetRow][targetCol] = {
        v: val,
        t: typeof val === 'number' ? 2 : 1, // 2: number, 1: string
      };
    }
  }

  return snapshot;
}

/**
 * Appends or prepends paragraph text into a Univer doc dataStream.
 */
export function insertDocText(
  snapshot: Record<string, any>,
  text: string,
  position: 'append' | 'prepend' = 'append',
) {
  if (!snapshot.body) {
    snapshot.body = { dataStream: '\r\n' };
  }
  const cleanText = text.endsWith('\r\n') ? text : `${text}\r\n`;
  if (position === 'prepend') {
    snapshot.body.dataStream = cleanText + (snapshot.body.dataStream || '');
  } else {
    snapshot.body.dataStream = (snapshot.body.dataStream || '').replace(/\r\n$/, '') + '\r\n' + cleanText;
  }
  return snapshot;
}
