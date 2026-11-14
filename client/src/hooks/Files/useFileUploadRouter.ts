import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { Constants, EToolResources } from 'librechat-data-provider';
import type { UploadLifecycleCallbacks } from './useFileHandling';
import { useChatContext } from '~/Providers/ChatContext';
import store, { ephemeralAgentByConvoId } from '~/store';
import {
  excelBufferToUniverSnapshot,
  docxBufferToUniverDocSnapshot,
  UNIVER_SHEET_MIME,
  UNIVER_DOC_MIME,
} from '~/components/Artifacts/Univer';
import useFileHandling from './useFileHandling';

/**
 * Returns a function that attaches files to a chosen upload destination, enabling the
 * matching ephemeral-agent capability first (file search is left for explicit opt-in to
 * preserve legacy behavior). Shared by the paste, drag, and modal flows. Resolves to
 * whether the files were accepted, so callers can gate success messaging on it.
 */
export default function useFileUploadRouter() {
  const { handleFiles } = useFileHandling();
  const { conversation } = useChatContext();
  const setEphemeralAgent = useSetRecoilState(
    ephemeralAgentByConvoId(conversation?.conversationId ?? Constants.NEW_CONVO),
  );
  const setArtifacts = useSetRecoilState(store.artifactsState);
  const setCurrentArtifactId = useSetRecoilState(store.currentArtifactId);
  const setArtifactsVisible = useSetRecoilState(store.artifactsVisibility);

  return useCallback(
    (files: File[], toolResource?: EToolResources, uploadLifecycle?: UploadLifecycleCallbacks) => {
      // Check for Office files (.xlsx, .xls, .csv, .docx) to auto-dock in Univer
      if (files && files.length > 0) {
        const firstFile = files[0];
        const lowerName = (firstFile.name || '').toLowerCase();

        if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
          firstFile.arrayBuffer().then((buf) => {
            const snapshot = excelBufferToUniverSnapshot(buf, firstFile.name);
            const artifactId = `univer-sheet-${Date.now()}`;
            setArtifacts((prev) => ({
              ...(prev || {}),
              [artifactId]: {
                id: artifactId,
                title: firstFile.name,
                type: UNIVER_SHEET_MIME,
                content: JSON.stringify(snapshot),
                lastUpdateTime: Date.now(),
              },
            }));
            setCurrentArtifactId(artifactId);
            setArtifactsVisible(true);
          }).catch((err) => {
            console.error('Failed to parse excel in browser:', err);
          });
        } else if (lowerName.endsWith('.docx')) {
          firstFile.arrayBuffer().then(async (buf) => {
            const snapshot = await docxBufferToUniverDocSnapshot(buf, firstFile.name);
            const artifactId = `univer-doc-${Date.now()}`;
            setArtifacts((prev) => ({
              ...(prev || {}),
              [artifactId]: {
                id: artifactId,
                title: firstFile.name,
                type: UNIVER_DOC_MIME,
                content: JSON.stringify(snapshot),
                lastUpdateTime: Date.now(),
              },
            }));
            setCurrentArtifactId(artifactId);
            setArtifactsVisible(true);
          }).catch((err) => {
            console.error('Failed to parse docx in browser:', err);
          });
        }
      }

      if (toolResource && toolResource !== EToolResources.file_search) {
        setEphemeralAgent((prev) => ({
          ...prev,
          [toolResource]: true,
        }));
      }
      return handleFiles(files, toolResource, uploadLifecycle);
    },
    [handleFiles, setEphemeralAgent, setArtifacts, setCurrentArtifactId, setArtifactsVisible],
  );
}
