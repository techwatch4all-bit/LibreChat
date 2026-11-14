import {
  a1ToCoords,
  parseA1Range,
  getSheetSummary,
  getSheetRange,
  setSheetValues,
  insertDocText,
} from './tools';

describe('Univer MCP Office Tools', () => {
  test('a1ToCoords maps cells accurately', () => {
    expect(a1ToCoords('A1')).toEqual({ col: 0, row: 0 });
    expect(a1ToCoords('B2')).toEqual({ col: 1, row: 1 });
    expect(a1ToCoords('Z26')).toEqual({ col: 25, row: 25 });
    expect(a1ToCoords('AA1')).toEqual({ col: 26, row: 0 });
  });

  test('parseA1Range calculates bounding box', () => {
    const box = parseA1Range('A1:C3');
    expect(box).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 2,
      endRow: 2,
    });
  });

  test('getSheetSummary extracts structural overview without data dump', () => {
    const mockSnapshot = {
      name: 'Budget 2026',
      sheets: {
        s1: {
          name: 'Q1',
          rowCount: 100,
          columnCount: 20,
          cellData: { 0: { 0: { v: 'Revenue' } } },
        },
      },
    };
    const summary = getSheetSummary(mockSnapshot);
    expect(summary.title).toBe('Budget 2026');
    expect(summary.sheetCount).toBe(1);
    expect(summary.sheets[0].name).toBe('Q1');
  });

  test('setSheetValues and getSheetRange perform surgical updates', () => {
    const snapshot: Record<string, any> = {
      sheets: {
        sheet1: {
          name: 'Main',
          cellData: {},
        },
      },
    };

    setSheetValues(snapshot, 'B2', [
      ['Sales', 1500],
      ['COGS', 900],
    ]);

    const range = getSheetRange(snapshot, 'B2:C3', 'sheet1');
    expect(range.values).toEqual([
      ['Sales', 1500],
      ['COGS', 900],
    ]);
  });

  test('insertDocText appends and prepends paragraphs cleanly', () => {
    const docSnapshot: Record<string, any> = {
      body: { dataStream: 'First paragraph\r\n' },
    };

    insertDocText(docSnapshot, 'Second paragraph');
    expect(docSnapshot.body.dataStream).toBe('First paragraph\r\nSecond paragraph\r\n');

    insertDocText(docSnapshot, 'Header', 'prepend');
    expect(docSnapshot.body.dataStream).toBe('Header\r\nFirst paragraph\r\nSecond paragraph\r\n');
  });
});
