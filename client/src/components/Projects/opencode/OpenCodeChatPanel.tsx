import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Button, Spinner } from '@librechat/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MutationKeys, QueryKeys, dataService } from 'librechat-data-provider';
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  ListTodo,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Wrench,
  X,
} from 'lucide-react';
import type {
  OpenCodeMessageEnvelope,
  OpenCodePartDto,
  OpenCodePermissionRequestDto,
  OpenCodePromptImageAttachment,
  OpenCodeQuestionRequestDto,
} from 'librechat-data-provider';
import {
  activeOpenCodeSessionIdAtom,
  openCodeDiffsAtom,
  openCodeMessagesAtom,
  openCodePendingAutoPromptAtom,
  openCodePermissionsAtom,
  openCodeQuestionsAtom,
  openCodeRunStateAtom,
  openCodeSessionErrorAtom,
  openCodeStreamStateAtom,
  openCodeTodosAtom,
  selectedOpenCodeAgentAtom,
  selectedOpenCodeModelAtom,
} from './atoms';
import { extractOpenCodeErrorMessage } from './useOpenCodeEvents';
import { useLocalize } from '~/hooks';

interface OpenCodeChatPanelProps {
  projectId: string;
  reachable: boolean;
  simpleMode?: boolean;
}

function ToolPartCard({ part }: { part: OpenCodePartDto }) {
  const localize = useLocalize();
  const state = part.state;
  const status = state?.status ?? 'pending';
  const title =
    state && 'title' in state && typeof state.title === 'string' && state.title.length > 0
      ? state.title
      : (part.tool ?? part.type);

  return (
    <details className="my-1.5 rounded-md border border-border-light bg-surface-secondary text-xs">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 truncate font-mono font-medium text-text-primary">
          <Wrench className="size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </span>
        <span className="shrink-0 rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">
          {status}
        </span>
      </summary>
      <div className="space-y-2 border-t border-border-light p-2.5 font-mono text-[11px]">
        {state && 'input' in state && state.input && Object.keys(state.input).length > 0 ? (
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-text-secondary">
              {localize('com_opencode_tool_input')}
            </div>
            <pre className="max-h-40 overflow-auto rounded bg-surface-primary p-2 text-text-primary">
              {JSON.stringify(state.input, null, 2)}
            </pre>
          </div>
        ) : null}
        {state && state.status === 'completed' && state.output ? (
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-text-secondary">
              {localize('com_opencode_tool_output')}
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-surface-primary p-2 text-text-primary">
              {state.output}
            </pre>
          </div>
        ) : null}
        {state && state.status === 'error' && state.error ? (
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-text-destructive">
              {localize('com_opencode_tool_error')}
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-primary p-2 text-text-destructive">
              {state.error}
            </pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function PartView({ part }: { part: OpenCodePartDto }) {
  const localize = useLocalize();

  if (part.type === 'step-start' || part.type === 'step-finish') {
    return null;
  }

  if (part.type === 'text') {
    const cleanText = (part.text ?? '')
      .split('\n\n[Workspace Runtime Contract')[0]
      .split('\n[Satchida-Context:')[0];
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
        {cleanText}
      </div>
    );
  }

  if (part.type === 'reasoning') {
    return (
      <details className="my-1 rounded-md border border-border-light bg-surface-secondary/60 px-2.5 py-1.5 text-xs text-text-secondary">
        <summary className="cursor-pointer font-medium">
          {localize('com_opencode_reasoning_label')}
        </summary>
        <div className="mt-1.5 whitespace-pre-wrap font-mono text-[11px]">{part.text ?? ''}</div>
      </details>
    );
  }

  if (part.type === 'tool') {
    return <ToolPartCard part={part} />;
  }

  if (part.type === 'file') {
    return (
      <div className="my-1 rounded border border-border-light bg-surface-secondary px-2.5 py-1 font-mono text-xs text-text-secondary">
        {part.filename ?? part.url ?? part.mime ?? 'file'}
      </div>
    );
  }

  return (
    <details className="my-1 rounded border border-border-light bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary">
      <summary className="cursor-pointer font-mono">{part.type}</summary>
      <pre className="mt-1 max-h-40 overflow-auto font-mono text-[11px]">
        {JSON.stringify(part, null, 2)}
      </pre>
    </details>
  );
}

function PermissionCard({
  request,
  isPending,
  onReply,
}: {
  request: OpenCodePermissionRequestDto;
  isPending: boolean;
  onReply: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
}) {
  const localize = useLocalize();

  return (
    <div
      role="alert"
      className="rounded-lg border border-border-medium bg-surface-secondary p-3 text-xs"
    >
      <div className="flex items-center gap-2 font-medium text-text-primary">
        <ShieldAlert className="size-4 shrink-0 text-text-primary" aria-hidden="true" />
        <span>
          {localize('com_opencode_permission_title')}:{' '}
          <code className="font-mono">{request.permission}</code>
        </span>
      </div>
      {request.patterns.length > 0 ? (
        <ul className="mt-1.5 list-inside list-disc font-mono text-[11px] text-text-secondary">
          {request.patterns.map((pattern, idx) => (
            <li key={idx}>{pattern}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={isPending}
          onClick={() => onReply(request.id, 'once')}
        >
          {localize('com_opencode_permission_allow_once')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => onReply(request.id, 'always')}
        >
          {localize('com_opencode_permission_allow_always')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => onReply(request.id, 'reject')}
        >
          {localize('com_opencode_permission_reject')}
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({
  request,
  isPending,
  onReply,
  onReject,
}: {
  request: OpenCodeQuestionRequestDto;
  isPending: boolean;
  onReply: (requestId: string, answers: string[][]) => void;
  onReject: (requestId: string) => void;
}) {
  const localize = useLocalize();
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [customText, setCustomText] = useState<Record<number, string>>({});

  const toggleOption = (qIdx: number, label: string, multiple?: boolean) => {
    setSelected((prev) => {
      const current = prev[qIdx] ?? [];
      if (multiple) {
        return {
          ...prev,
          [qIdx]: current.includes(label)
            ? current.filter((item) => item !== label)
            : [...current, label],
        };
      }
      return { ...prev, [qIdx]: [label] };
    });
  };

  const handleSubmit = () => {
    const answers = request.questions.map((_q, idx) => {
      const picks = [...(selected[idx] ?? [])];
      const custom = (customText[idx] ?? '').trim();
      if (custom) {
        picks.push(custom);
      }
      return picks;
    });
    onReply(request.id, answers);
  };

  return (
    <div
      role="region"
      aria-label={localize('com_opencode_question_title')}
      className="rounded-lg border border-border-medium bg-surface-secondary p-3 text-xs"
    >
      <div className="mb-2 font-medium text-text-primary">
        {localize('com_opencode_question_title')}
      </div>
      <div className="space-y-3">
        {request.questions.map((q, qIdx) => (
          <div key={qIdx} className="space-y-1.5">
            <div className="font-medium text-text-primary">{q.question}</div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const isPicked = (selected[qIdx] ?? []).includes(opt.label);
                return (
                  <Button
                    key={opt.label}
                    type="button"
                    size="sm"
                    variant={isPicked ? 'default' : 'outline'}
                    disabled={isPending}
                    onClick={() => toggleOption(qIdx, opt.label, q.multiple)}
                    title={opt.description}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
            {q.custom !== false ? (
              <input
                type="text"
                value={customText[qIdx] ?? ''}
                onChange={(e) => setCustomText((prev) => ({ ...prev, [qIdx]: e.target.value }))}
                placeholder={localize('com_opencode_question_custom_placeholder')}
                className="w-full rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-border-heavy"
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={isPending}
          onClick={handleSubmit}
        >
          {localize('com_opencode_question_submit')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => onReject(request.id)}
        >
          {localize('com_opencode_question_reject')}
        </Button>
      </div>
    </div>
  );
}

export default function OpenCodeChatPanel({
  projectId,
  reachable,
  simpleMode = false,
}: OpenCodeChatPanelProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useAtom(activeOpenCodeSessionIdAtom);
  const [selectedModel, setSelectedModel] = useAtom(selectedOpenCodeModelAtom);
  const [selectedAgent, setSelectedAgent] = useAtom(selectedOpenCodeAgentAtom);
  const [messages, setMessages] = useAtom(openCodeMessagesAtom);
  const [, setDiffs] = useAtom(openCodeDiffsAtom);
  const [permissions, setPermissions] = useAtom(openCodePermissionsAtom);
  const [questions, setQuestions] = useAtom(openCodeQuestionsAtom);
  const [sessionError, setSessionError] = useAtom(openCodeSessionErrorAtom);
  const streamState = useAtomValue(openCodeStreamStateAtom);
  const [runState, setRunState] = useAtom(openCodeRunStateAtom);
  const [pendingAutoPrompt, setPendingAutoPrompt] = useAtom(openCodePendingAutoPromptAtom);
  const todos = useAtomValue(openCodeTodosAtom);

  const [promptInput, setPromptInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<OpenCodePromptImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastSubmittedPromptRef = useRef<{
    text: string;
    images?: OpenCodePromptImageAttachment[];
  } | null>(null);

  const sessionsQuery = useQuery(
    [QueryKeys.opencodeSessions, projectId],
    () => dataService.listOpenCodeSessions(projectId),
    { enabled: reachable && Boolean(projectId), refetchOnWindowFocus: false },
  );

  const providersQuery = useQuery(
    [QueryKeys.opencodeProviders, projectId],
    () => dataService.getOpenCodeProviders(projectId),
    { enabled: reachable && Boolean(projectId), refetchOnWindowFocus: false },
  );

  const agentsQuery = useQuery(
    [QueryKeys.opencodeAgents, projectId],
    () => dataService.getOpenCodeAgents(projectId),
    { enabled: reachable && Boolean(projectId), refetchOnWindowFocus: false },
  );

  const messagesQuery = useQuery(
    [QueryKeys.opencodeMessages, projectId, activeSessionId],
    () => dataService.getOpenCodeSessionMessages(projectId, activeSessionId ?? ''),
    {
      enabled: reachable && Boolean(projectId) && Boolean(activeSessionId),
      refetchOnWindowFocus: false,
      onSuccess: (data) => setMessages(data),
    },
  );

  useQuery(
    [QueryKeys.opencodeDiff, projectId, activeSessionId],
    () => dataService.getOpenCodeSessionDiff(projectId, activeSessionId ?? ''),
    {
      enabled: reachable && Boolean(projectId) && Boolean(activeSessionId),
      refetchOnWindowFocus: false,
      onSuccess: (data) => setDiffs(data),
    },
  );

  useQuery(
    [QueryKeys.opencodePermissions, projectId],
    () => dataService.getOpenCodePermissions(projectId),
    {
      enabled: reachable && Boolean(projectId),
      refetchOnWindowFocus: false,
      onSuccess: (data) => setPermissions(data),
    },
  );

  useQuery(
    [QueryKeys.opencodeQuestions, projectId],
    () => dataService.getOpenCodeQuestions(projectId),
    {
      enabled: reachable && Boolean(projectId),
      refetchOnWindowFocus: false,
      onSuccess: (data) => setQuestions(data),
    },
  );

  useEffect(() => {
    setActiveSessionId(null);
    setMessages([]);
    setDiffs([]);
    setSessionError(null);
    setRunState('idle');
  }, [projectId, setActiveSessionId, setDiffs, setMessages, setRunState, setSessionError]);

  useEffect(() => {
    if (!sessionsQuery.isSuccess) {
      return;
    }
    const list = sessionsQuery.data ?? [];
    const currentValid = activeSessionId && list.some((s) => s.id === activeSessionId);
    if (!currentValid) {
      setActiveSessionId(list[0]?.id ?? null);
    }
  }, [sessionsQuery.isSuccess, sessionsQuery.data, activeSessionId, setActiveSessionId]);

  const modelOptions = useMemo(() => {
    const providers = providersQuery.data?.providers ?? [];
    const sortedProviders = [...providers].sort((a, b) => {
      if (a.id === 'satchida' && b.id !== 'satchida') {
        return -1;
      }
      if (b.id === 'satchida' && a.id !== 'satchida') {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    const options: Array<{ providerID: string; modelID: string; label: string }> = [];
    for (const provider of sortedProviders) {
      const entries = Object.entries(provider.models ?? {}).sort(([a], [b]) => {
        if (a === 'Vibecoding' && b !== 'Vibecoding') {
          return -1;
        }
        if (b === 'Vibecoding' && a !== 'Vibecoding') {
          return 1;
        }
        return a.localeCompare(b);
      });
      for (const [modelID, modelInfo] of entries) {
        options.push({
          providerID: provider.id,
          modelID,
          label: `${provider.name}: ${modelInfo?.name || modelID}`,
        });
      }
    }
    return options;
  }, [providersQuery.data]);

  const visibleAgents = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => !agent.hidden && agent.mode !== 'subagent'),
    [agentsQuery.data],
  );

  useEffect(() => {
    if (!selectedModel && modelOptions.length > 0) {
      setSelectedModel({
        providerID: modelOptions[0].providerID,
        modelID: modelOptions[0].modelID,
      });
    }
  }, [modelOptions, selectedModel, setSelectedModel]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages.length, permissions.length, questions.length]);

  const createSessionMutation = useMutation(
    [MutationKeys.opencodeCreateSession, projectId],
    () =>
      dataService.createOpenCodeSession(projectId, {
        ...(selectedAgent ? { agent: selectedAgent } : {}),
      }),
    {
      onSuccess: (created) => {
        setActiveSessionId(created.id);
        setMessages([]);
        setDiffs([]);
        setSessionError(null);
        queryClient.invalidateQueries([QueryKeys.opencodeSessions, projectId]);
      },
      onError: () => setSessionError(localize('com_opencode_error_generic')),
    },
  );

  const sendPromptMutation = useMutation(
    [MutationKeys.opencodeSendPrompt, projectId],
    async ({ text, images }: { text: string; images?: OpenCodePromptImageAttachment[] }) => {
      let sid = activeSessionId;
      if (!sid) {
        const created = await dataService.createOpenCodeSession(projectId, {
          ...(selectedAgent ? { agent: selectedAgent } : {}),
        });
        sid = created.id;
        setActiveSessionId(sid);
        queryClient.invalidateQueries([QueryKeys.opencodeSessions, projectId]);
      }
      return dataService.sendOpenCodePrompt(projectId, sid, {
        text,
        ...(selectedAgent ? { agent: selectedAgent } : {}),
        ...(selectedModel ? { model: selectedModel } : {}),
        ...(images && images.length > 0 ? { images } : {}),
      });
    },
    {
      onMutate: (vars) => {
        lastSubmittedPromptRef.current = { text: vars.text, images: vars.images };
        setSessionError(null);
        setRunState('busy');
      },
      onError: (err) => {
        setRunState('idle');
        setSessionError(extractOpenCodeErrorMessage(err) || localize('com_opencode_error_generic'));
      },
    },
  );

  useEffect(() => {
    if (pendingAutoPrompt && reachable && !sendPromptMutation.isLoading) {
      const promptToRun = pendingAutoPrompt;
      setPendingAutoPrompt(null);
      sendPromptMutation.mutate({ text: promptToRun });
    }
  }, [pendingAutoPrompt, reachable, sendPromptMutation, setPendingAutoPrompt]);

  const abortMutation = useMutation(
    [MutationKeys.opencodeAbortSession, projectId],
    async () => {
      if (!activeSessionId) {
        return { aborted: false };
      }
      return dataService.abortOpenCodeSession(projectId, activeSessionId);
    },
    {
      onSuccess: () => setRunState('idle'),
    },
  );

  const replyPermissionMutation = useMutation(
    [MutationKeys.opencodeReplyPermission, projectId],
    ({ requestId, reply }: { requestId: string; reply: 'once' | 'always' | 'reject' }) =>
      dataService.replyOpenCodePermission(projectId, requestId, { reply }),
    {
      onSuccess: (_res, vars) => {
        setPermissions((prev) => prev.filter((item) => item.id !== vars.requestId));
      },
    },
  );

  const replyQuestionMutation = useMutation(
    [MutationKeys.opencodeReplyQuestion, projectId],
    ({ requestId, answers }: { requestId: string; answers: string[][] }) =>
      dataService.replyOpenCodeQuestion(projectId, requestId, { answers }),
    {
      onSuccess: (_res, vars) => {
        setQuestions((prev) => prev.filter((item) => item.id !== vars.requestId));
      },
    },
  );

  const rejectQuestionMutation = useMutation(
    [MutationKeys.opencodeRejectQuestion, projectId],
    ({ requestId }: { requestId: string }) =>
      dataService.rejectOpenCodeQuestion(projectId, requestId),
    {
      onSuccess: (_res, vars) => {
        setQuestions((prev) => prev.filter((item) => item.id !== vars.requestId));
      },
    },
  );

  const readImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        setAttachedImages((prev) => [
          ...prev.slice(0, 2),
          { name: file.name || 'screenshot.png', mime: file.type, dataUrl },
        ]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) {
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          readImageFile(file);
        }
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      return;
    }
    for (let i = 0; i < files.length; i++) {
      readImageFile(files[i]);
    }
    e.target.value = '';
  };

  const handleSend = () => {
    const trimmed = promptInput.trim();
    if ((!trimmed && attachedImages.length === 0) || !reachable || sendPromptMutation.isLoading) {
      return;
    }
    const textToSend =
      trimmed || 'Please inspect the attached screenshot and fix or implement what is shown.';
    const imgsToSend = [...attachedImages];
    setPromptInput('');
    setAttachedImages([]);
    sendPromptMutation.mutate({ text: textToSend, images: imgsToSend });
  };

  const groupedMessages = useMemo(() => {
    if (!simpleMode) {
      return messages.map((m) => ({ type: 'single' as const, envelope: m }));
    }
    const groups: Array<
      | { type: 'single'; envelope: OpenCodeMessageEnvelope }
      | { type: 'assistant_group'; envelopes: OpenCodeMessageEnvelope[] }
    > = [];
    for (const msg of messages) {
      if (msg.info.role === 'user') {
        groups.push({ type: 'single', envelope: msg });
      } else {
        const prev = groups[groups.length - 1];
        if (prev && prev.type === 'assistant_group') {
          prev.envelopes.push(msg);
        } else {
          groups.push({ type: 'assistant_group', envelopes: [msg] });
        }
      }
    }
    return groups;
  }, [messages, simpleMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape' && runState !== 'idle') {
      abortMutation.mutate();
    }
  };

  const activePermissions = permissions.filter(
    (item) => !activeSessionId || item.sessionID === activeSessionId,
  );
  const activeQuestions = questions.filter(
    (item) => !activeSessionId || item.sessionID === activeSessionId,
  );

  const streamStatusKeyMap = {
    connected: 'com_opencode_status_connected',
    connecting: 'com_opencode_status_connecting',
    error: 'com_opencode_status_error',
    disconnected: 'com_opencode_status_disconnected',
  } as const;
  const statusLabel =
    runState !== 'idle'
      ? localize('com_opencode_status_streaming')
      : localize(streamStatusKeyMap[streamState]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-primary text-text-primary">
      {/* Toolbar: Sessions, Model picker, Agent picker, Status */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-light bg-surface-secondary px-3 py-2 text-xs">
        <select
          aria-label={localize('com_opencode_select_session')}
          value={activeSessionId ?? ''}
          onChange={(e) => {
            setActiveSessionId(e.target.value || null);
            setSessionError(null);
          }}
          className="max-w-[180px] rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary"
        >
          <option value="">{localize('com_opencode_select_session')}</option>
          {(sessionsQuery.data ?? []).map((sess) => (
            <option key={sess.id} value={sess.id}>
              {sess.title || sess.id}
            </option>
          ))}
        </select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!reachable || createSessionMutation.isLoading}
          onClick={() => createSessionMutation.mutate()}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {localize('com_opencode_new_session')}
        </Button>

        {!simpleMode ? (
          <>
            <select
              aria-label={localize('com_opencode_select_model')}
              value={selectedModel ? `${selectedModel.providerID}::${selectedModel.modelID}` : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setSelectedModel(null);
                  return;
                }
                const [providerID, modelID] = val.split('::');
                setSelectedModel({ providerID, modelID });
              }}
              className="max-w-[200px] rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary"
            >
              <option value="">
                {localize('com_opencode_select_model')}: {localize('com_opencode_default_option')}
              </option>
              {modelOptions.map((opt) => (
                <option
                  key={`${opt.providerID}::${opt.modelID}`}
                  value={`${opt.providerID}::${opt.modelID}`}
                >
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              aria-label={localize('com_opencode_select_agent')}
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="max-w-[140px] rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary"
            >
              <option value="">
                {localize('com_opencode_select_agent')}: {localize('com_opencode_default_option')}
              </option>
              {visibleAgents.map((agent) => (
                <option key={agent.name} value={agent.name}>
                  {agent.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <span className="ml-auto rounded bg-surface-tertiary px-2 py-0.5 text-[11px] text-text-secondary">
          {statusLabel}
        </span>
      </div>

      {/* Todos bar */}
      {todos.length > 0 ? (
        <div className="border-b border-border-light bg-surface-secondary/60 px-3 py-2 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-text-secondary">
            <ListTodo className="size-3.5" aria-hidden="true" />
            <span>{localize('com_opencode_todos_title')}</span>
          </div>
          <ul className="space-y-0.5">
            {todos.map((todo, idx) => (
              <li key={idx} className="flex items-center gap-1.5 text-text-primary">
                <CheckCircle2
                  className={`size-3 shrink-0 ${
                    todo.status === 'completed'
                      ? 'text-text-primary'
                      : 'text-text-secondary opacity-40'
                  }`}
                  aria-hidden="true"
                />
                <span className={todo.status === 'completed' ? 'line-through opacity-70' : ''}>
                  {todo.content}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Messages + Permissions + Questions */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        className="flex-1 space-y-3 overflow-y-auto p-3"
      >
        {Boolean(activeSessionId) && messagesQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
            <Spinner className="size-4" />
            <span>{localize('com_opencode_loading_messages')}</span>
          </div>
        ) : null}
        {!(Boolean(activeSessionId) && messagesQuery.isLoading) && messages.length === 0 ? (
          <div className="space-y-4 py-6 text-center text-sm text-text-secondary">
            <p>{localize('com_opencode_empty_messages')}</p>
            <div className="grid grid-cols-1 gap-2 text-left">
              {[
                {
                  title: '🌐 Live Web & Price Monitor',
                  prompt:
                    'Build a real-time web monitor and price tracker dashboard with live automatic updates, top stories extraction, and clean metrics.',
                },
                {
                  title: '📊 CRM & Lead Tracker',
                  prompt:
                    'Build a modern CRM dashboard to manage leads, status stages, notes, and instant search with a live backend.',
                },
                {
                  title: '📋 Team Kanban Board',
                  prompt:
                    'Build an interactive Kanban task board with To-Do, In Progress, and Completed columns and persistent server storage.',
                },
                {
                  title: '⚡ REST API & Live Analytics',
                  prompt:
                    'Build a live analytics dashboard with interactive charts, real-time metrics, and a REST API backend.',
                },
              ].map((tpl) => (
                <button
                  key={tpl.title}
                  type="button"
                  disabled={!reachable || sendPromptMutation.isLoading}
                  onClick={() => sendPromptMutation.mutate({ text: tpl.prompt })}
                  className="rounded-lg border border-border-light bg-surface-secondary p-2.5 text-left text-xs transition-colors hover:border-border-heavy hover:bg-surface-hover"
                >
                  <div className="font-semibold text-text-primary">{tpl.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">
                    {tpl.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {!(Boolean(activeSessionId) && messagesQuery.isLoading) && messages.length > 0
          ? groupedMessages.map((group, groupIdx) => {
              const isLastGroup = groupIdx === groupedMessages.length - 1;
              if (group.type === 'single') {
                const envelope = group.envelope;
                const envelopeError = extractOpenCodeErrorMessage(envelope.info.error);
                return (
                  <article
                    key={envelope.info.id}
                    className={`rounded-lg border p-3 ${
                      envelope.info.role === 'user'
                        ? 'ml-6 border-border-medium bg-surface-tertiary'
                        : 'mr-2 border-border-light bg-surface-primary'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-text-secondary">
                      <span>{envelope.info.role}</span>
                      {!simpleMode && envelope.info.modelID ? (
                        <span className="font-mono normal-case">{envelope.info.modelID}</span>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      {envelope.parts.map((part) => (
                        <PartView key={part.id} part={part} />
                      ))}
                    </div>
                    {envelopeError ? (
                      <div
                        role="alert"
                        className="mt-2 flex items-start gap-1.5 rounded-md border border-border-medium bg-surface-destructive/10 px-2.5 py-1.5 text-xs text-text-destructive"
                      >
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span className="break-words">{envelopeError}</span>
                      </div>
                    ) : null}
                  </article>
                );
              }

              // Normal mode ('simpleMode'): collapse intermediate tool calls, reasoning, and technical steps "in plain sight"
              const allParts = group.envelopes.flatMap((env) => env.parts);
              const groupError = group.envelopes
                .map((env) => extractOpenCodeErrorMessage(env.info.error))
                .find((msg): msg is string => Boolean(msg));
              const textParts = allParts.filter(
                (p) => p.type === 'text' && (p.text ?? '').trim().length > 0,
              );
              const finalTextPart = textParts.length > 0 ? textParts[textParts.length - 1] : null;
              const technicalParts = allParts.filter(
                (p) => p.type !== 'step-start' && p.type !== 'step-finish' && p !== finalTextPart,
              );
              const toolCount = allParts.filter((p) => p.type === 'tool').length;
              const hasToolError = allParts.some(
                (p) => p.type === 'tool' && p.state?.status === 'error',
              );
              const isInProgress = isLastGroup && runState !== 'idle';
              const stepLabel = toolCount === 1 ? 'step' : 'steps';

              let summaryLabel: string;
              if (groupError) {
                summaryLabel =
                  toolCount > 0
                    ? `Stopped with error (${toolCount} ${stepLabel} before failure) — View technical details`
                    : 'Stopped with error — View technical details';
              } else if (isInProgress) {
                summaryLabel =
                  toolCount > 0
                    ? `Working… (${toolCount} ${stepLabel} so far) — View technical details`
                    : `Working… (${technicalParts.length}) — View technical details`;
              } else if (hasToolError) {
                summaryLabel = `Finished with tool errors (${toolCount} ${stepLabel}) — View technical details`;
              } else if (!finalTextPart) {
                summaryLabel =
                  toolCount > 0
                    ? `Incomplete run (${toolCount} ${stepLabel} ran) — View technical details`
                    : `Thinking & intermediate steps (${technicalParts.length}) — View technical details`;
              } else if (toolCount > 0) {
                summaryLabel = `Built & verified (${toolCount} ${stepLabel} completed) — View technical details`;
              } else {
                summaryLabel = `Thinking & intermediate steps (${technicalParts.length}) — View technical details`;
              }

              return (
                <article
                  key={group.envelopes[0].info.id}
                  className="mr-2 space-y-2 rounded-lg border border-border-light bg-surface-primary p-3"
                >
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-text-secondary">
                    <span className="flex items-center gap-1 font-medium">
                      <Sparkles className="size-3 text-text-secondary" aria-hidden="true" />
                      {localize('com_opencode_brand_name')}
                    </span>
                  </div>

                  {technicalParts.length > 0 ? (
                    <details className="rounded-md border border-border-light bg-surface-secondary/60 text-xs">
                      <summary className="cursor-pointer select-none px-2.5 py-1.5 font-medium text-text-secondary hover:text-text-primary">
                        {summaryLabel}
                      </summary>
                      <div className="space-y-1.5 border-t border-border-light p-2.5">
                        {technicalParts.map((part) => (
                          <PartView key={part.id} part={part} />
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {groupError ? (
                    <div
                      role="alert"
                      className="flex items-start gap-1.5 rounded-md border border-border-medium bg-surface-destructive/10 px-2.5 py-1.5 text-xs text-text-destructive"
                    >
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span className="break-words">{groupError}</span>
                    </div>
                  ) : null}

                  {finalTextPart ? <PartView part={finalTextPart} /> : null}
                  {!finalTextPart && isInProgress ? (
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Spinner className="size-3.5" />
                      <span>{localize('com_opencode_building_changes')}</span>
                    </div>
                  ) : null}
                </article>
              );
            })
          : null}

        {activePermissions.map((req) => (
          <PermissionCard
            key={req.id}
            request={req}
            isPending={replyPermissionMutation.isLoading}
            onReply={(requestId, reply) => replyPermissionMutation.mutate({ requestId, reply })}
          />
        ))}

        {activeQuestions.map((req) => (
          <QuestionCard
            key={req.id}
            request={req}
            isPending={replyQuestionMutation.isLoading || rejectQuestionMutation.isLoading}
            onReply={(requestId, answers) => replyQuestionMutation.mutate({ requestId, answers })}
            onReject={(requestId) => rejectQuestionMutation.mutate({ requestId })}
          />
        ))}

        {sessionError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-lg border border-border-medium bg-surface-destructive/10 px-3 py-2 text-xs text-text-destructive"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{sessionError}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={sendPromptMutation.isLoading}
              onClick={() => {
                setSessionError(null);
                if (lastSubmittedPromptRef.current && reachable) {
                  sendPromptMutation.mutate(lastSubmittedPromptRef.current);
                  return;
                }
                const hasFailedTurn = messages.some((m) => Boolean(m.info.error));
                if (hasFailedTurn && activeSessionId && reachable) {
                  sendPromptMutation.mutate({
                    text: 'Please continue from where the previous turn failed and complete the request.',
                  });
                  return;
                }
                sessionsQuery.refetch();
                messagesQuery.refetch();
              }}
            >
              {localize('com_opencode_retry')}
            </Button>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {/* Composer with Screenshot Paste (Ctrl+V) & Image Upload */}
      <div className="border-t border-border-light bg-surface-secondary p-2.5">
        {attachedImages.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedImages.map((img, idx) => (
              <div
                key={idx}
                className="relative overflow-hidden rounded-md border border-border-medium bg-surface-primary p-1"
              >
                <img
                  src={img.dataUrl}
                  alt={img.name || 'Attached screenshot'}
                  className="h-14 w-20 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove screenshot"
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/80 p-0.5 text-white hover:bg-black"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
        <div className="flex items-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!reachable}
            onClick={() => fileInputRef.current?.click()}
            title="Attach or paste screenshot (Ctrl+V)"
            aria-label="Attach screenshot"
            className="size-9 shrink-0"
          >
            <ImagePlus className="size-4 text-text-secondary" aria-hidden="true" />
          </Button>
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={2}
            disabled={!reachable}
            placeholder={localize('com_opencode_prompt_placeholder')}
            aria-label={localize('com_opencode_prompt_placeholder')}
            className="min-h-[56px] flex-1 resize-none rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm leading-snug text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-border-heavy disabled:opacity-50"
          />
          {runState !== 'idle' ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={abortMutation.isLoading}
              onClick={() => abortMutation.mutate()}
              aria-label={localize('com_opencode_stop')}
              className="h-9 gap-1.5"
            >
              <Square className="size-3.5" aria-hidden="true" />
              {localize('com_opencode_stop')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={
                !reachable ||
                (!promptInput.trim() && attachedImages.length === 0) ||
                sendPromptMutation.isLoading
              }
              onClick={handleSend}
              aria-label={localize('com_opencode_send')}
              className="h-9 gap-1.5"
            >
              <Send className="size-3.5" aria-hidden="true" />
              {localize('com_opencode_send')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
