import { Sparkles } from 'lucide-react';
import { Input, Label } from '@librechat/client';
import { Controller, useWatch, useFormContext } from 'react-hook-form';
import type { AgentForm } from '~/common';
import AssistantConversationStarters from '~/components/SidePanel/Builder/AssistantConversationStarters';
import { ResolvedProviderIcon } from '~/components/Endpoints/ResolvedProviderIcon';
import AgentCategorySelector from './AgentCategorySelector';
import { useLocalize, useAgentCapabilities } from '~/hooks';
import { useAgentFileEntries } from './Tools/hooks';
import { useAgentPanelContext } from '~/Providers';
import { useProviderIcon } from '~/hooks/Endpoint';
import ToolsSection from './Tools/ToolsSection';
import { validateEmail, cn } from '~/utils';
import Instructions from './Instructions';
import FileContext from './FileContext';
import AgentAvatar from './AgentAvatar';
import { Panel } from '~/common';

const fieldClass = 'h-9';

const QUICK_AGENT_TEMPLATES = [
  {
    label: '🥇 Live Metals Ticker',
    name: 'Live Metals & Commodity Ticker',
    description:
      'Pulls live gold, silver, and metals prices/futures and formats clean market updates.',
    instructions:
      'You are a real-time commodities and metals analyst. Fetch and dump live spot, bid/ask, and futures settlement rates for Gold (XAU), Silver (XAG), Platinum, and Copper. Format output in clean, structured Markdown tables with 24h change, currency conversion (USD & INR), and market commentary.',
    starters: [
      'Dump live Gold & Silver spot prices with bid/ask and day change',
      'What are the latest gold futures contracts and settlement prices?',
      'Summarize today commodity price movements in USD and INR',
    ],
  },
  {
    label: '📰 News Alert Streamer',
    name: 'Live Breaking News & Intelligence Agent',
    description:
      'Extracts top stories, breaking alerts, and executive briefings with high signal-to-noise ratio.',
    instructions:
      'You are a real-time news intelligence monitor. Pull and extract the top stories across technology, business, and world markets. Deliver structured bullet briefings with headline, 2-line summary, impact assessment, and verifiable source references. Filter out clickbait and fluff.',
    starters: [
      'Extract top breaking news stories right now in bullet format',
      'Give me an executive briefing on today global market and tech headlines',
      'Set an alert summary for the latest AI and semiconductor developments',
    ],
  },
  {
    label: '🔍 Research Analyst',
    name: 'Deep Research & Insights Analyst',
    description: 'Synthesizes market, technical, and competitive research with clear takeaways.',
    instructions:
      'You are an executive research analyst. Break complex topics into structured findings, cite verifiable facts, compare trade-offs in tables, and end with actionable recommendations.',
    starters: [
      'Compare the top 3 solutions for this problem with pros, cons, and costs',
      'Summarize the latest trends and risks in this industry',
    ],
  },
  {
    label: '💻 Coding Partner',
    name: 'Full-Stack Architecture & Code Partner',
    description:
      'Designs, debugs, and reviews production TypeScript, Node.js, React, and Python code.',
    instructions:
      'You are a principal software architect. Write clean, modular, secure, production-ready code with explicit error handling and clear explanations.',
    starters: [
      'Review this code for bugs, security risks, and performance bottlenecks',
      'Design a clean full-stack architecture for a real-time web application',
    ],
  },
  {
    label: '📈 Business Ops',
    name: 'Business & Operations Strategist',
    description: 'Drafts SOPs, proposals, client communications, and financial/operational plans.',
    instructions:
      'You are a senior business operations advisor. Draft crisp, professional documents, SOPs, and proposals tailored for Indian and global SMB workflows.',
    starters: [
      'Draft a professional client proposal and project milestone schedule',
      'Create a step-by-step standard operating procedure (SOP) for our team',
    ],
  },
  {
    label: '🎓 Study Tutor',
    name: 'Interactive Concept & Exam Tutor',
    description: 'Explains complex subjects step-by-step with examples and practice quizzes.',
    instructions:
      'You are an encouraging master tutor. Explain concepts from first principles using analogies, worked examples, and short comprehension checks.',
    starters: [
      'Explain this topic step-by-step using a real-world analogy',
      'Quiz me with 5 progressive questions on this subject',
    ],
  },
];

export default function AgentConfig() {
  const localize = useLocalize();
  const methods = useFormContext<AgentForm>();
  const { setActivePanel, endpointsConfig, agentsConfig } = useAgentPanelContext();
  const { contextEnabled } = useAgentCapabilities(agentsConfig?.capabilities);

  const {
    control,
    formState: { errors },
  } = methods;
  const provider = useWatch({ control, name: 'provider' });
  const model = useWatch({ control, name: 'model' });
  const agent = useWatch({ control, name: 'agent' });
  const agent_id = useWatch({ control, name: 'id' });
  const { contextFiles } = useAgentFileEntries();

  const providerValue = typeof provider === 'string' ? provider : provider?.value;
  const { provider: providerId, imageURL } = useProviderIcon({
    endpoint: providerValue as string,
    endpointsConfig,
  });

  const applyQuickTemplate = (tpl: (typeof QUICK_AGENT_TEMPLATES)[number]) => {
    methods.setValue('name', tpl.name, { shouldDirty: true, shouldValidate: true });
    methods.setValue('description', tpl.description, { shouldDirty: true });
    methods.setValue('instructions', tpl.instructions, { shouldDirty: true });
    methods.setValue('conversation_starters', tpl.starters, { shouldDirty: true });
    if (!providerValue) {
      methods.setValue('provider', 'Satchida', { shouldDirty: true });
    }
    if (!model) {
      methods.setValue('model', 'Work', { shouldDirty: true });
    }
    if (!methods.getValues('category')) {
      methods.setValue('category', 'general', { shouldDirty: true });
    }
  };

  return (
    <div className="h-auto pt-1">
      {/* 1-CLICK SMART AGENT TEMPLATES */}
      <div className="mb-3 rounded-xl border border-border-light bg-surface-secondary/50 p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Sparkles className="size-3.5 text-text-secondary" aria-hidden="true" />
          <span>{localize('com_ui_smart_agent_templates')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_AGENT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => applyQuickTemplate(tpl)}
              className="rounded-lg border border-border-light bg-surface-primary px-2.5 py-1 text-[11px] font-medium text-text-primary transition-colors hover:border-border-heavy hover:bg-surface-hover"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* IDENTITY — flat header, always visible, avatar inline */}
      <div className="mb-3 mt-1 flex items-center gap-3">
        <div className="flex-shrink-0">
          <AgentAvatar avatar={agent?.['avatar'] ?? null} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Controller
            name="name"
            rules={{ required: localize('com_ui_agent_name_is_required') }}
            control={control}
            render={({ field }) => (
              <div className="flex flex-col">
                <Input
                  {...field}
                  value={field.value ?? ''}
                  maxLength={256}
                  className={cn(fieldClass, 'font-medium')}
                  id="name"
                  type="text"
                  placeholder={localize('com_agents_name_placeholder')}
                  aria-label={localize('com_ui_agent_name')}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'agent-name-error' : undefined}
                />
                {errors.name && (
                  <div
                    id="agent-name-error"
                    className="mt-1 text-xs text-text-destructive"
                    role="alert"
                  >
                    {errors.name.message}
                  </div>
                )}
              </div>
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ''}
                maxLength={512}
                className={fieldClass}
                id="description"
                type="text"
                placeholder={localize('com_agents_description_placeholder')}
                aria-label={localize('com_ui_agent_description')}
              />
            )}
          />
        </div>
      </div>

      {/* MODEL + CATEGORY — balanced 2-column grid */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col">
          <Label
            className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-secondary"
            htmlFor="provider"
          >
            {localize('com_ui_model')} <span className="text-text-destructive">*</span>
          </Label>
          <button
            id="provider"
            type="button"
            onClick={() => setActivePanel(Panel.model)}
            title={model || undefined}
            className={cn(
              'relative flex h-9 w-full min-w-0 items-center overflow-hidden rounded-lg border border-border-light bg-surface-secondary text-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
              model != null && model ? 'px-1' : 'px-3',
            )}
          >
            <div className="flex w-full min-w-0 items-center gap-2">
              {providerValue !== undefined && (
                <div className="shadow-stroke relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-black dark:bg-white">
                  <ResolvedProviderIcon
                    provider={providerId}
                    imageURL={imageURL}
                    size={16}
                    className="h-2/3 w-2/3"
                  />
                </div>
              )}
              <span className="truncate">
                {model != null && model ? model : localize('com_ui_select_model')}
              </span>
            </div>
          </button>
        </div>
        <div className="flex flex-col">
          <Label
            className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-secondary"
            htmlFor="category-selector"
          >
            {localize('com_ui_category')} <span className="text-text-destructive">*</span>
          </Label>
          <AgentCategorySelector className="w-full rounded-lg" />
        </div>
      </div>

      {/* INSTRUCTIONS */}
      <Instructions />

      {/* CONVERSATION STARTERS / ONE-CLICK ACTIONS */}
      <div className="mb-3">
        <Controller
          name="conversation_starters"
          control={control}
          render={({ field }) => (
            <AssistantConversationStarters
              field={{
                value: Array.isArray(field.value) ? field.value : [],
                onChange: field.onChange,
              }}
              inputClass={cn(
                'w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none focus:ring-0',
              )}
              labelClass="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-secondary"
            />
          )}
        />
      </div>

      {/* TOOLS — unified built-ins / tools / actions / mcp / skills */}
      <ToolsSection agentId={agent_id} />

      {/* FILE CONTEXT — standalone section, separate from the tool library */}
      {contextEnabled && (
        <div className="mb-3">
          <FileContext agent_id={agent_id} files={contextFiles} />
        </div>
      )}

      {/* SUPPORT CONTACT */}
      <div className="mb-3 flex flex-col">
        <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          {localize('com_ui_support_contact')}
        </Label>
        <div className="space-y-2">
          <Controller
            name="support_contact.name"
            control={control}
            rules={{
              minLength: {
                value: 3,
                message: localize('com_ui_support_contact_name_min_length', { minLength: 3 }),
              },
            }}
            render={({ field, fieldState: { error } }) => (
              <div className="flex flex-col">
                <Input
                  {...field}
                  value={field.value ?? ''}
                  className={cn(fieldClass, error && 'border-2 border-border-destructive')}
                  id="support-contact-name"
                  type="text"
                  placeholder={localize('com_ui_support_contact_name_placeholder')}
                  aria-label={localize('com_ui_support_contact_name')}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'support-contact-name-error' : undefined}
                />
                {error && (
                  <span
                    id="support-contact-name-error"
                    className="mt-1 text-xs text-text-destructive"
                    role="alert"
                    aria-live="polite"
                  >
                    {error.message}
                  </span>
                )}
              </div>
            )}
          />
          <Controller
            name="support_contact.email"
            control={control}
            rules={{
              validate: (value) =>
                validateEmail(value ?? '', localize('com_ui_support_contact_email_invalid')),
            }}
            render={({ field, fieldState: { error } }) => (
              <div className="flex flex-col">
                <Input
                  {...field}
                  value={field.value ?? ''}
                  className={cn(fieldClass, error && 'border-2 border-border-destructive')}
                  id="support-contact-email"
                  type="email"
                  placeholder={localize('com_ui_support_contact_email_placeholder')}
                  aria-label={localize('com_ui_support_contact_email')}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'support-contact-email-error' : undefined}
                />
                {error && (
                  <span
                    id="support-contact-email-error"
                    className="mt-1 text-xs text-text-destructive"
                    role="alert"
                    aria-live="polite"
                  >
                    {error.message}
                  </span>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
