import * as XLSX from 'xlsx';

export function excelBufferToUniverSnapshot(buffer: ArrayBuffer | Uint8Array, filename = 'Workbook') {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const sheets: Record<string, any> = {};

  sheetNames.forEach((sheetName, index) => {
    const sheetId = `sheet-${index + 1}`;
    const worksheet = workbook.Sheets[sheetName];
    const cellData: Record<number, Record<number, { v: any; t: number }>> = {};

    if (worksheet['!ref']) {
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v !== undefined) {
            if (!cellData[R]) {
              cellData[R] = {};
            }
            cellData[R][C] = {
              v: cell.v,
              t: typeof cell.v === 'number' ? 2 : 1,
            };
          }
        }
      }
    }

    sheets[sheetId] = {
      id: sheetId,
      name: sheetName,
      cellData,
      rowCount: Math.max(50, worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']).e.r + 10 : 50),
      columnCount: Math.max(26, worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']).e.c + 5 : 26),
    };
  });

  return {
    id: `univer-wb-${Date.now()}`,
    name: filename.replace(/\.[^/.]+$/, ''),
    sheetOrder: Object.keys(sheets),
    sheets,
  };
}

export function univerSnapshotToExcelBuffer(snapshot: Record<string, any>): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sheets = snapshot.sheets || {};
  const sheetOrder = snapshot.sheetOrder || Object.keys(sheets);

  sheetOrder.forEach((sheetId: string) => {
    const sheet = sheets[sheetId];
    if (!sheet) {
      return;
    }

    const cellData = sheet.cellData || {};
    const rows: any[][] = [];

    let maxRow = 0;
    let maxCol = 0;

    Object.keys(cellData).forEach((rStr) => {
      const r = parseInt(rStr, 10);
      if (r > maxRow) {
        maxRow = r;
      }
      const rowObj = cellData[r];
      Object.keys(rowObj).forEach((cStr) => {
        const c = parseInt(cStr, 10);
        if (c > maxCol) {
          maxCol = c;
        }
      });
    });

    for (let r = 0; r <= maxRow; r++) {
      const rowArr: any[] = [];
      const rowObj = cellData[r] || {};
      for (let c = 0; c <= maxCol; c++) {
        const cell = rowObj[c];
        rowArr.push(cell?.v !== undefined ? cell.v : '');
      }
      rows.push(rowArr);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name || sheetId);
  });

  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
