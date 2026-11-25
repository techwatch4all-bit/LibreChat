import { atom } from 'jotai';
import type {
  CloudDriveProviderId,
  OpenCodeDiffDto,
  OpenCodeMessageEnvelope,
  OpenCodePermissionRequestDto,
  OpenCodeQuestionRequestDto,
  OpenCodeTodoDto,
} from 'librechat-data-provider';

export interface CloudDriveBrowserSession {
  accessToken: string;
  expiresAt: number;
}

export type OpenCodeStreamState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type OpenCodeRunState = 'idle' | 'busy' | 'retry';

export const activeOpenCodeSessionIdAtom = atom<string | null>(null);
export const selectedOpenCodeModelAtom = atom<{ providerID: string; modelID: string } | null>(null);
export const selectedOpenCodeAgentAtom = atom<string>('');
export const openCodeStreamStateAtom = atom<OpenCodeStreamState>('disconnected');
export const openCodeRunStateAtom = atom<OpenCodeRunState>('idle');
export const openCodeSessionErrorAtom = atom<string | null>(null);
export const openCodeMessagesAtom = atom<OpenCodeMessageEnvelope[]>([]);
export const openCodeDiffsAtom = atom<OpenCodeDiffDto[]>([]);
export const openCodeTodosAtom = atom<OpenCodeTodoDto[]>([]);
export const openCodePermissionsAtom = atom<OpenCodePermissionRequestDto[]>([]);
export const openCodeQuestionsAtom = atom<OpenCodeQuestionRequestDto[]>([]);
export const openCodePendingAutoPromptAtom = atom<string | null>(null);
export const openCodeLocalPrivacyAtom = atom<boolean>(false);

/**
 * Strictly in-memory browser-only Cloud Drive OAuth sessions.
 * Never persisted to localStorage, sessionStorage, MongoDB, or any server.
 */
export const cloudDriveSessionsAtom = atom<
  Record<CloudDriveProviderId, CloudDriveBrowserSession | null>
>({
  google_drive: null,
  onedrive: null,
});
