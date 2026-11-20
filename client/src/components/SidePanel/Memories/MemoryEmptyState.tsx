import { Brain, Plus, Sparkles } from 'lucide-react';
import { EmptyState, useToastContext } from '@librechat/client';
import { useCreateMemoryMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

interface MemoryEmptyStateProps {
  isFiltered?: boolean;
}

const SMART_MEMORY_TEMPLATES = [
  {
    key: 'user_preferences',
    label: 'Concise & Actionable Answers',
    value: 'Provide concise, direct, and actionable answers with clear steps and zero filler.',
  },
  {
    key: 'user_profile',
    label: 'My Role & Domain',
    value: 'Product and technology leader building full-stack applications and AI workflows.',
  },
  {
    key: 'user_context',
    label: 'Preferred Tech Stack',
    value: 'Primary stack: TypeScript, Node.js, React, Python, and self-contained modern web apps.',
  },
  {
    key: 'user_goals',
    label: 'Current Project Goals',
    value: 'Deliver production-grade, privacy-preserving, cost-optimized applications.',
  },
];

export default function MemoryEmptyState({ isFiltered = false }: MemoryEmptyStateProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { mutate: createMemory, isLoading } = useCreateMemoryMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_memory_created'),
        status: 'success',
      });
    },
  });

  if (isFiltered) {
    return <EmptyState icon={Brain} description={localize('com_ui_no_memories_match')} />;
  }

  return (
    <div className="space-y-3">
      <EmptyState
        icon={Brain}
        title={localize('com_ui_no_memories_title')}
        description={localize('com_ui_no_memories')}
      />
      <div className="rounded-xl border border-border-light bg-surface-secondary/50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Sparkles className="size-3.5 text-text-secondary" aria-hidden="true" />
          <span>{localize('com_ui_smart_memory_starters')}</span>
        </div>
        <p className="mb-2.5 text-[11px] text-text-secondary">
          {localize('com_ui_smart_memory_desc')}
        </p>
        <div className="space-y-1.5">
          {SMART_MEMORY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              disabled={isLoading}
              onClick={() => createMemory({ key: tpl.key, value: tpl.value })}
              className="flex w-full items-start gap-2 rounded-lg border border-border-light bg-surface-primary p-2 text-left text-xs transition-colors hover:border-border-heavy hover:bg-surface-hover disabled:opacity-50"
            >
              <Plus className="mt-0.5 size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text-primary">{tpl.label}</div>
                <div className="truncate text-[11px] text-text-secondary">{tpl.value}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
