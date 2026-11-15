import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createUniver } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import { LocaleType } from '@univerjs/core';
import sheetsEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import docsEnUS from '@univerjs/preset-docs-core/locales/en-US';
import type { FUniver } from '@univerjs/core/facade';
import type { Artifact } from '~/common';
import {
  univerSnapshotToExcelBuffer,
  excelBufferToUniverSnapshot,
  docxBufferToUniverDocSnapshot,
} from './converter';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-docs-core/lib/index.css';

export const UNIVER_SHEET_MIME = 'application/vnd.univer-sheet' as const;
export const UNIVER_DOC_MIME = 'application/vnd.univer-doc' as const;

export function isUniverArtifact(type?: string): boolean {
  if (!type) {
    return false;
  }
  return (
    type === UNIVER_SHEET_MIME ||
    type === UNIVER_DOC_MIME ||
    type === 'application/vnd.librechat.univer-sheet' ||
    type === 'application/vnd.librechat.univer-doc'
  );
}

interface UniverOfficeProps {
  artifact: Artifact;
  currentCode?: string;
  onSnapshotChange?: (snapshotJson: string) => void;
}

export default function UniverOffice({
  artifact,
  currentCode,
  onSnapshotChange,
}: UniverOfficeProps) {
  const containerId = useRef(`univer-container-${artifact.id || Math.random().toString(36).slice(2)}`).current;
  const univerApiRef = useRef<FUniver | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const isDoc =
    artifact.type === UNIVER_DOC_MIME ||
    artifact.type === 'application/vnd.librechat.univer-doc';

  // Persistence handler: save directly to client's local disk via HTML5 File System Access API
  const handleSaveToDevice = useCallback(async () => {
    try {
      const api = univerApiRef.current;
      if (!api) {
        return;
      }
      let snapshot: unknown = null;
      let defaultFileName = `${artifact.title || 'untitled-document'}.json`;

      if (isDoc) {
        const doc = api.getActiveDocument();
        snapshot = doc ? (doc as any).getSnapshot() : null;
        defaultFileName = `${artifact.title || 'document'}.satchida.doc.json`;
      } else {
        const workbook = api.getActiveWorkbook();
        snapshot = workbook ? (workbook as any).getSnapshot() : null;
        defaultFileName = `${artifact.title || 'spreadsheet'}.satchida.sheet.json`;
      }

      if (!snapshot) {
        return;
      }

      const jsonStr = JSON.stringify(snapshot, null, 2);

      // Desktop: HTML5 File System Access API if available
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as unknown as {
            showSaveFilePicker: (options: unknown) => Promise<{
              createWritable: () => Promise<{
                write: (data: string) => Promise<void>;
                close: () => Promise<void>;
              }>;
            }>;
          }).showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [
              {
                description: 'Satchida Office Document',
                accept: { 'application/json': ['.json'] },
              },
            ],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(jsonStr);
          await writable.close();
          return;
        } catch (err: unknown) {
          // If user cancels file picker, do nothing
          if ((err as Error)?.name === 'AbortError') {
            return;
          }
        }
      }

      // Android / Fallback: Standard browser blob download
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error saving document to local device:', err);
    }
  }, [artifact.title, isDoc]);

  const handleExportXlsx = useCallback(() => {
    try {
      const api = univerApiRef.current;
      if (!api || isDoc) {
        return;
      }
      const workbook = api.getActiveWorkbook();
      if (!workbook) {
        return;
      }
      const snapshot = (workbook as any).getSnapshot();
      const xlsxBuffer = univerSnapshotToExcelBuffer(snapshot);
      const blob = new Blob([xlsxBuffer as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.title || 'spreadsheet'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting xlsx:', err);
    }
  }, [artifact.title, isDoc]);

  const handlePrintPdf = useCallback(() => {
    window.print();
  }, []);

  const handleOpenLocalFile = useCallback(async () => {
    try {
      const processBuffer = async (name: string, buffer: ArrayBuffer) => {
        const lower = name.toLowerCase();
        const api = univerApiRef.current;
        if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
          const snapshot = excelBufferToUniverSnapshot(buffer, name);
          if (api && !isDoc) {
            try {
              (api as any).createWorkbook(snapshot);
            } catch (err) {
              console.error('Failed to mount workbook snapshot:', err);
            }
          }
          if (onSnapshotChange) {
            onSnapshotChange(JSON.stringify(snapshot));
          }
        } else if (lower.endsWith('.docx')) {
          const snapshot = await docxBufferToUniverDocSnapshot(buffer, name);
          if (api && isDoc) {
            try {
              (api as any).createUniverDoc(snapshot);
            } catch (err) {
              console.error('Failed to mount document snapshot:', err);
            }
          }
          if (onSnapshotChange) {
            onSnapshotChange(JSON.stringify(snapshot));
          }
        }
      };

      if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
        try {
          const [fileHandle] = await (window as unknown as {
            showOpenFilePicker: (options: unknown) => Promise<
              Array<{
                getFile: () => Promise<File>;
              }>
            >;
          }).showOpenFilePicker({
            types: [
              {
                description: 'Office Files (.xlsx, .csv, .docx)',
                accept: {
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                  'application/vnd.ms-excel': ['.xls'],
                  'text/csv': ['.csv'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                },
              },
            ],
            multiple: false,
          });
          const file = await fileHandle.getFile();
          const buffer = await file.arrayBuffer();
          await processBuffer(file.name, buffer);
          return;
        } catch (err: unknown) {
          if ((err as Error)?.name === 'AbortError') {
            return;
          }
        }
      }

      // Android / iOS / Firefox file picker fallback
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv,.docx';
      input.style.display = 'none';
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        await processBuffer(file.name, buffer);
      };
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    } catch (err) {
      console.error('Error opening local office file:', err);
    }
  }, [isDoc, onSnapshotChange]);

  useEffect(() => {
    let isDisposed = false;
    let localUniver: ReturnType<typeof createUniver> | null = null;

    const timer = setTimeout(() => {
      try {
        const container = document.getElementById(containerId);
        if (!container || isDisposed) {
          return;
        }

        const preset = isDoc
          ? UniverDocsCorePreset({
              container: containerId,
              header: true,
              toolbar: true,
            })
          : UniverSheetsCorePreset({
              container: containerId,
              header: true,
              footer: { sheetBar: true } as any,
              toolbar: true,
              formulaBar: true,
            });

        const enLocale = isDoc ? docsEnUS : sheetsEnUS;

        const { univer, univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: enLocale,
          },
          presets: [preset],
        });

        localUniver = { univer, univerAPI };
        univerApiRef.current = univerAPI;

        // Parse content snapshot or create default blank unit
        let initialData: unknown = null;
        const sourceData = currentCode || artifact.content || '';

        if (sourceData.trim().startsWith('{')) {
          try {
            initialData = JSON.parse(sourceData);
          } catch {
            initialData = null;
          }
        }

        if (isDoc) {
          if (initialData && typeof initialData === 'object') {
            (univerAPI as any).createUniverDoc(initialData);
          } else {
            (univerAPI as any).createUniverDoc({
              id: 'doc-1',
              title: artifact.title || 'Untitled Document',
              body: {
                dataStream: (sourceData || 'Start typing your document here...\r\n') + '\r\n',
              },
            });
          }
        } else {
          if (initialData && typeof initialData === 'object') {
            (univerAPI as any).createWorkbook(initialData);
          } else {
            (univerAPI as any).createWorkbook({
              id: 'workbook-1',
              name: artifact.title || 'Untitled Spreadsheet',
              sheetOrder: ['sheet1'],
              sheets: {
                sheet1: {
                  id: 'sheet1',
                  name: 'Sheet 1',
                  rowCount: 50,
                  columnCount: 26,
                },
              },
            });
          }
        }

        setIsReady(true);

        // Bi-directional state hook (throttled)
        if (onSnapshotChange) {
          const notifyChange = () => {
            try {
              if (isDoc) {
                const doc = univerAPI.getActiveDocument();
                if (doc) {
                  onSnapshotChange(JSON.stringify((doc as any).getSnapshot()));
                }
              } else {
                const workbook = univerAPI.getActiveWorkbook();
                if (workbook) {
                  onSnapshotChange(JSON.stringify((workbook as any).getSnapshot()));
                }
              }
            } catch {
              // Ignore snapshot extraction errors during active typing
            }
          };

          // Univer API command event listener
          (univerAPI as any).onCommandExecuted?.(() => {
            notifyChange();
          });
        }
      } catch (err: unknown) {
        if (!isDisposed) {
          setInitError((err as Error)?.message || 'Failed to initialize Satchida Office workspace');
        }
      }
    }, 50);

    return () => {
      isDisposed = true;
      clearTimeout(timer);
      try {
        if (localUniver?.univer) {
          localUniver.univer.dispose();
        }
      } catch {
        // Safe disposal
      }
      univerApiRef.current = null;
    };
  }, [containerId, isDoc, artifact.title, currentCode, artifact.content, onSnapshotChange]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white text-slate-800 dark:bg-[#1f2937] dark:text-slate-100">
      {/* Top micro-toolbar for client-edge persistence */}
      <div className="flex h-9 items-center justify-between border-b border-border-light bg-surface-primary px-3 text-xs text-text-secondary dark:border-border-medium">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-text-primary">
            {isDoc ? '📝 Satchida Doc' : '📊 Satchida Sheet'}
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            Native Client Canvas
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleOpenLocalFile}
            className="flex items-center space-x-1 rounded px-2 py-1 font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
            title="Open local .xlsx, .csv, or .docx file directly into this canvas"
          >
            <span>📂 Open File</span>
          </button>
          {!isDoc && (
            <button
              type="button"
              onClick={handleExportXlsx}
              className="flex items-center space-x-1 rounded px-2 py-1 font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
              title="Download clean .xlsx spreadsheet directly to your device"
            >
              <span>📥 Export .xlsx</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center space-x-1 rounded px-2 py-1 font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
            title="Print or save as PDF"
          >
            <span>🖨️ PDF</span>
          </button>
          <button
            type="button"
            onClick={handleSaveToDevice}
            className="flex items-center space-x-1 rounded px-2 py-1 font-medium text-text-primary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
            title="Save copy directly to your computer / phone storage"
          >
            <span>💾 Save JSON</span>
          </button>
        </div>
      </div>

      {initError && (
        <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-red-500">
          <div>
            <p className="font-semibold">Unable to load Satchida Office Workspace</p>
            <p className="mt-1 text-xs opacity-80">{initError}</p>
          </div>
        </div>
      )}

      {/* The DOM mount point for the Univer canvas engine */}
      <div
        id={containerId}
        className={`h-full w-full flex-grow overflow-hidden ${isReady ? 'opacity-100' : 'opacity-0'}`}
        style={{ minHeight: '300px' }}
      />
    </div>
  );
}
