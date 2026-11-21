import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import type {
  OpenCodeDiffDto,
  OpenCodeEventEnvelope,
  OpenCodeMessageInfoDto,
  OpenCodePartDto,
  OpenCodePermissionRequestDto,
  OpenCodeQuestionRequestDto,
  OpenCodeTodoDto,
} from 'librechat-data-provider';
import {
  openCodeDiffsAtom,
  openCodeMessagesAtom,
  openCodePermissionsAtom,
  openCodeQuestionsAtom,
  openCodeRunStateAtom,
  openCodeSessionErrorAtom,
  openCodeStreamStateAtom,
  openCodeTodosAtom,
} from './atoms';

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 15_000;

export function extractOpenCodeErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof error !== 'object') {
    return null;
  }
  const obj = error as {
    name?: unknown;
    message?: unknown;
    data?: { message?: unknown; statusCode?: unknown; code?: unknown };
  };
  const dataMsg = typeof obj.data?.message === 'string' ? obj.data.message.trim() : '';
  const topMsg = typeof obj.message === 'string' ? obj.message.trim() : '';
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const statusCode =
    typeof obj.data?.statusCode === 'number' && Number.isFinite(obj.data.statusCode)
      ? obj.data.statusCode
      : null;

  const coreMessage = dataMsg || topMsg;
  if (coreMessage) {
    if (name && name !== 'Error' && !coreMessage.startsWith(name)) {
      return statusCode ? `${name} (${statusCode}): ${coreMessage}` : `${name}: ${coreMessage}`;
    }
    return statusCode ? `HTTP ${statusCode}: ${coreMessage}` : coreMessage;
  }
  if (name) {
    return statusCode ? `${name} (${statusCode})` : name;
  }
  return null;
}

interface UseOpenCodeEventsOptions {
  projectId: string;
  sessionId: string | null;
  token?: string;
  enabled: boolean;
}

export function useOpenCodeEvents({
  projectId,
  sessionId,
  token,
  enabled,
}: UseOpenCodeEventsOptions) {
  const queryClient = useQueryClient();
  const setStreamState = useSetAtom(openCodeStreamStateAtom);
  const setRunState = useSetAtom(openCodeRunStateAtom);
  const setSessionError = useSetAtom(openCodeSessionErrorAtom);
  const setMessages = useSetAtom(openCodeMessagesAtom);
  const setDiffs = useSetAtom(openCodeDiffsAtom);
  const setTodos = useSetAtom(openCodeTodosAtom);
  const setPermissions = useSetAtom(openCodePermissionsAtom);
  const setQuestions = useSetAtom(openCodeQuestionsAtom);
  const lastEventIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !projectId || !token) {
      setStreamState('disconnected');
      return;
    }

    let cancelled = false;
    let backoffMs = INITIAL_BACKOFF_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | undefined;

    const applyEvent = (event: OpenCodeEventEnvelope) => {
      const props = (event.properties ?? {}) as Record<string, unknown>;
      switch (event.type) {
        case 'server.connected':
          setStreamState('connected');
          setSessionError(null);
          break;

        case 'session.status': {
          const statusObj = props.status as { type?: string } | undefined;
          if (statusObj?.type === 'busy' || statusObj?.type === 'retry') {
            setRunState(statusObj.type);
          } else {
            setRunState('idle');
          }
          break;
        }

        case 'session.idle':
          setRunState('idle');
          if (sessionId) {
            queryClient.invalidateQueries([QueryKeys.opencodeMessages, projectId, sessionId]);
            queryClient.invalidateQueries([QueryKeys.opencodeDiff, projectId, sessionId]);
          }
          queryClient.invalidateQueries([QueryKeys.opencodeTree, projectId]);
          queryClient.invalidateQueries([QueryKeys.opencodeFile, projectId]);
          queryClient.invalidateQueries([QueryKeys.opencodeVcs, projectId]);
          queryClient.invalidateQueries([QueryKeys.opencodePreviewStatus, projectId]);
          break;

        case 'session.error': {
          setRunState('idle');
          setSessionError(extractOpenCodeErrorMessage(props.error) || 'Request failed');
          break;
        }

        case 'message.updated': {
          const info = props.info as OpenCodeMessageInfoDto | undefined;
          if (!info?.id) {
            break;
          }
          setMessages((prev) => {
            const idx = prev.findIndex((item) => item.info.id === info.id);
            if (idx === -1) {
              return [...prev, { info, parts: [] }];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], info };
            return next;
          });
          break;
        }

        case 'message.part.updated': {
          const part = props.part as OpenCodePartDto | undefined;
          if (!part?.id || !part.messageID) {
            break;
          }
          setMessages((prev) => {
            const msgIdx = prev.findIndex((item) => item.info.id === part.messageID);
            if (msgIdx === -1) {
              return [
                ...prev,
                {
                  info: {
                    id: part.messageID,
                    sessionID: part.sessionID,
                    role: 'assistant',
                  },
                  parts: [part],
                },
              ];
            }
            const next = [...prev];
            const existingParts = next[msgIdx].parts;
            const partIdx = existingParts.findIndex((p) => p.id === part.id);
            const updatedParts =
              partIdx === -1
                ? [...existingParts, part]
                : existingParts.map((p, i) => (i === partIdx ? part : p));
            next[msgIdx] = { ...next[msgIdx], parts: updatedParts };
            return next;
          });
          break;
        }

        case 'message.part.delta': {
          const messageID = typeof props.messageID === 'string' ? props.messageID : '';
          const partID = typeof props.partID === 'string' ? props.partID : '';
          const field = typeof props.field === 'string' ? props.field : 'text';
          const delta = typeof props.delta === 'string' ? props.delta : '';
          if (!messageID || !partID || !delta) {
            break;
          }
          setMessages((prev) =>
            prev.map((envelope) => {
              if (envelope.info.id !== messageID) {
                return envelope;
              }
              const hasPart = envelope.parts.some((p) => p.id === partID);
              const updatedParts = hasPart
                ? envelope.parts.map((p) => {
                    if (p.id !== partID) {
                      return p;
                    }
                    const current = typeof p[field] === 'string' ? (p[field] as string) : '';
                    return { ...p, [field]: current + delta };
                  })
                : [
                    ...envelope.parts,
                    {
                      id: partID,
                      sessionID: envelope.info.sessionID,
                      messageID,
                      type: field === 'text' ? 'text' : field,
                      [field]: delta,
                    },
                  ];
              return { ...envelope, parts: updatedParts };
            }),
          );
          break;
        }

        case 'session.diff': {
          const diff = Array.isArray(props.diff) ? (props.diff as OpenCodeDiffDto[]) : [];
          setDiffs(diff);
          break;
        }

        case 'file.edited':
          queryClient.invalidateQueries([QueryKeys.opencodeTree, projectId]);
          queryClient.invalidateQueries([QueryKeys.opencodeFile, projectId]);
          queryClient.invalidateQueries([QueryKeys.opencodeVcs, projectId]);
          if (sessionId) {
            queryClient.invalidateQueries([QueryKeys.opencodeDiff, projectId, sessionId]);
          }
          break;

        case 'todo.updated': {
          const todos = Array.isArray(props.todos) ? (props.todos as OpenCodeTodoDto[]) : [];
          setTodos(todos);
          break;
        }

        case 'permission.asked': {
          const req = props as unknown as OpenCodePermissionRequestDto;
          if (!req?.id) {
            break;
          }
          setPermissions((prev) =>
            prev.some((item) => item.id === req.id) ? prev : [...prev, req],
          );
          break;
        }

        case 'permission.replied': {
          const requestId = typeof props.requestID === 'string' ? props.requestID : '';
          if (requestId) {
            setPermissions((prev) => prev.filter((item) => item.id !== requestId));
          }
          break;
        }

        case 'question.asked': {
          const req = props as unknown as OpenCodeQuestionRequestDto;
          if (!req?.id) {
            break;
          }
          setQuestions((prev) => (prev.some((item) => item.id === req.id) ? prev : [...prev, req]));
          break;
        }

        default:
          break;
      }
    };

    const connect = async () => {
      if (cancelled) {
        return;
      }
      setStreamState('connecting');
      activeController = new AbortController();

      const params = new URLSearchParams();
      if (sessionId) {
        params.set('sessionId', sessionId);
      }
      const query = params.toString();
      const url = `/api/opencode/${encodeURIComponent(projectId)}/events${query ? `?${query}` : ''}`;

      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      };
      if (lastEventIdRef.current) {
        headers['Last-Event-ID'] = lastEventIdRef.current;
      }

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: activeController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE HTTP ${response.status}`);
        }

        setStreamState('connected');
        backoffMs = INITIAL_BACKOFF_MS;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const lines = frame.split(/\r?\n/);
            const dataLines: string[] = [];
            for (const line of lines) {
              if (line.startsWith('id:')) {
                lastEventIdRef.current = line.slice(3).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
              }
            }
            if (dataLines.length === 0) {
              continue;
            }
            try {
              const parsed = JSON.parse(dataLines.join('\n')) as OpenCodeEventEnvelope;
              applyEvent(parsed);
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      } catch {
        if (!cancelled) {
          setStreamState('error');
        }
      }

      if (!cancelled) {
        reconnectTimer = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
          void connect();
        }, backoffMs);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      activeController?.abort();
      setStreamState('disconnected');
    };
  }, [
    enabled,
    projectId,
    sessionId,
    token,
    queryClient,
    setStreamState,
    setRunState,
    setSessionError,
    setMessages,
    setDiffs,
    setTodos,
    setPermissions,
    setQuestions,
  ]);
}
