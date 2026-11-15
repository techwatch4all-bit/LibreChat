import React from 'react';
import { render, screen } from '@testing-library/react';
import UniverOffice, {
  isUniverArtifact,
  UNIVER_SHEET_MIME,
  UNIVER_DOC_MIME,
} from '../UniverOffice';
import {
  excelBufferToUniverSnapshot,
  univerSnapshotToExcelBuffer,
  docxBufferToUniverDocSnapshot,
} from '../converter';
import type { Artifact } from '~/common';

jest.mock('@univerjs/presets', () => ({
  createUniver: jest.fn(() => ({
    univer: { dispose: jest.fn() },
    univerAPI: {
      createWorkbook: jest.fn(),
      createUniverDoc: jest.fn(),
      getActiveWorkbook: jest.fn(),
      getActiveDocument: jest.fn(),
      onCommandExecuted: jest.fn(),
    },
  })),
}));

jest.mock('@univerjs/preset-sheets-core', () => ({
  UniverSheetsCorePreset: jest.fn(() => ({})),
}));

jest.mock('@univerjs/preset-docs-core', () => ({
  UniverDocsCorePreset: jest.fn(() => ({})),
}));

jest.mock('@univerjs/preset-sheets-core/locales/en-US', () => ({}));
jest.mock('@univerjs/preset-docs-core/locales/en-US', () => ({}));

describe('UniverOffice Component & Satchida Rebranding', () => {
  it('correctly identifies Satchida/Univer artifact MIME types', () => {
    expect(isUniverArtifact(UNIVER_SHEET_MIME)).toBe(true);
    expect(isUniverArtifact(UNIVER_DOC_MIME)).toBe(true);
    expect(isUniverArtifact('application/vnd.librechat.univer-sheet')).toBe(true);
    expect(isUniverArtifact('application/vnd.librechat.univer-doc')).toBe(true);
    expect(isUniverArtifact('application/vnd.mermaid')).toBe(false);
    expect(isUniverArtifact(undefined)).toBe(false);
  });

  it('renders Satchida Sheet with rebranded header and Open File button', () => {
    const sheetArtifact: Artifact = {
      id: 'test-sheet-1',
      title: 'Monthly Household Budget',
      type: UNIVER_SHEET_MIME,
      content: '',
      lastUpdateTime: Date.now(),
    };

    render(<UniverOffice artifact={sheetArtifact} />);

    expect(screen.getByText('📊 Satchida Sheet')).toBeInTheDocument();
    expect(screen.getByText('Native Client Canvas')).toBeInTheDocument();
    expect(screen.getByText('📂 Open File')).toBeInTheDocument();
    expect(screen.getByText('📥 Export .xlsx')).toBeInTheDocument();
    expect(screen.getByText('🖨️ PDF')).toBeInTheDocument();
    expect(screen.getByText('💾 Save JSON')).toBeInTheDocument();

    // Verify Univer is NOT in the rendered UI
    expect(screen.queryByText(/Univer/i)).toBeNull();
  });

  it('renders Satchida Doc with rebranded header and no export xlsx button', () => {
    const docArtifact: Artifact = {
      id: 'test-doc-1',
      title: 'Employment Agreement',
      type: UNIVER_DOC_MIME,
      content: '',
      lastUpdateTime: Date.now(),
    };

    render(<UniverOffice artifact={docArtifact} />);

    expect(screen.getByText('📝 Satchida Doc')).toBeInTheDocument();
    expect(screen.getByText('📂 Open File')).toBeInTheDocument();
    expect(screen.queryByText('📥 Export .xlsx')).toBeNull();
    expect(screen.getByText('🖨️ PDF')).toBeInTheDocument();

    // Verify Univer is NOT in the rendered UI
    expect(screen.queryByText(/Univer/i)).toBeNull();
  });
});

describe('Satchida Office Converters', () => {
  it('converts snapshot to Excel buffer and parses back into snapshot', () => {
    const originalSnapshot = {
      id: 'test-wb',
      name: 'Financial Ledger',
      sheetOrder: ['sheet-1'],
      sheets: {
        'sheet-1': {
          id: 'sheet-1',
          name: 'Ledger',
          cellData: {
            0: {
              0: { v: 'Date', t: 1 },
              1: { v: 'Amount', t: 1 },
            },
            1: {
              0: { v: '2026-11-15', t: 1 },
              1: { v: 5000, t: 2 },
            },
          },
          rowCount: 50,
          columnCount: 26,
        },
      },
    };

    const excelBuffer = univerSnapshotToExcelBuffer(originalSnapshot);
    expect(excelBuffer).toBeInstanceOf(Uint8Array);
    expect(excelBuffer.length).toBeGreaterThan(0);

    const reimported = excelBufferToUniverSnapshot(excelBuffer, 'Ledger.xlsx');
    expect(reimported.name).toBe('Ledger');
    expect(reimported.sheetOrder).toContain('sheet-1');
    expect(reimported.sheets['sheet-1'].name).toBe('Ledger');
    expect(reimported.sheets['sheet-1'].cellData[0][0].v).toBe('Date');
    expect(reimported.sheets['sheet-1'].cellData[1][1].v).toBe(5000);
  });

  it('converts docx text into Satchida doc snapshot', async () => {
    const snapshot = await docxBufferToUniverDocSnapshot(new ArrayBuffer(0), 'Letter.docx');
    expect(snapshot.id).toMatch(/^univer-doc-/);
    expect(snapshot.title).toBe('Letter');
    expect(snapshot.body.dataStream).toBeTruthy();
  });
});
