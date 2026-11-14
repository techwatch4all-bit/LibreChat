import * as XLSX from 'xlsx';
import {
  excelBufferToUniverSnapshot,
  univerSnapshotToExcelBuffer,
} from './excelConverter';

describe('Office Spreadsheet Roundtrip', () => {
  test('Full roundtrip: generate XLSX -> parse into Univer snapshot -> edit cells -> export back to XLSX -> verify', () => {
    // 1. Create a test workbook
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Product', 'Revenue', 'Cost', 'Margin'],
      ['AI Assistant', 50000, 20000, 0.6],
      ['SaaS Platform', 80000, 30000, 0.625],
      ['Consulting', 15000, 10000, 0.333],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Financials');

    const initialXlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 2. Convert raw XLSX to Univer snapshot
    const univerSnapshot = excelBufferToUniverSnapshot(initialXlsxBuffer, 'financials.xlsx');

    expect(univerSnapshot.name).toBe('financials');
    expect(univerSnapshot.sheetOrder.length).toBe(1);
    const sheet = univerSnapshot.sheets[univerSnapshot.sheetOrder[0]];
    expect(sheet.name).toBe('Financials');

    // Verify cell values loaded in Univer format
    expect(sheet.cellData[0][0].v).toBe('Product');
    expect(sheet.cellData[1][1].v).toBe(50000);
    expect(sheet.cellData[2][1].v).toBe(80000);

    // 3. User & AI simulate editing cells in Univer
    sheet.cellData[1][1] = { v: 65000, t: 2 }; // Update revenue to 65000
    sheet.cellData[4] = {
      0: { v: 'Enterprise Fleet', t: 1 },
      1: { v: 120000, t: 2 },
      2: { v: 40000, t: 2 },
      3: { v: 0.667, t: 2 },
    };

    // 4. Export Univer snapshot back to clean XLSX buffer
    const exportedXlsxBuffer = univerSnapshotToExcelBuffer(univerSnapshot);
    expect(exportedXlsxBuffer.length).toBeGreaterThan(0);

    // 5. Read exported XLSX to verify values are preserved
    const verifyWb = XLSX.read(exportedXlsxBuffer, { type: 'buffer' });
    const verifySheet = verifyWb.Sheets['Financials'];
    const verifyAoa = XLSX.utils.sheet_to_json(verifySheet, { header: 1 }) as any[][];

    expect(verifyAoa[0][0]).toBe('Product');
    expect(verifyAoa[1][1]).toBe(65000); // Updated cell value verified!
    expect(verifyAoa[4][0]).toBe('Enterprise Fleet'); // New row verified!
    expect(verifyAoa[4][1]).toBe(120000);
  });
});

