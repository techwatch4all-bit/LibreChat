import React, { useMemo, useState } from 'react';
import { Play, Info } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Label,
  OGDialog,
  OGDialogTrigger,
  Button,
  TooltipAnchor,
} from '@librechat/client';
import {
  Constants,
  QueryKeys,
  EModelEndpoint,
  LocalStorageKeys,
  PermissionBits,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import type { AgentListResponse } from 'librechat-data-provider';
import Description, { getPlainDescription } from '~/components/ui/Description';
import { useLocalize, TranslationKeys, useAgentCategories } from '~/hooks';
import useGetConversation from '~/hooks/Conversations/useGetConversation';
import useDefaultConvo from '~/hooks/Conversations/useDefaultConvo';
import { clearMessagesCache, specDisplayFieldReset, cn, renderAgentAvatar } from '~/utils';
import useNewConvo from '~/hooks/useNewConvo';
import AgentDetailContent from './AgentDetailContent';
import AgentContact from './AgentContact';

interface AgentCardProps {
  agent: t.Agent;
  onSelect?: (agent: t.Agent) => void;
  className?: string;
}

/**
 * Card component to display agent information with integrated detail dialog
 */
const AgentCard: React.FC<AgentCardProps> = ({ agent, onSelect, className = '' }) => {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { categories } = useAgentCategories();
  const getDefaultConversation = useDefaultConvo();
  const { newConversation } = useNewConvo();
  const getConversation = useGetConversation(0);

  const [isOpen, setIsOpen] = useState(false);
  const description = useMemo(() => getPlainDescription(agent.description), [agent.description]);

  const categoryLabel = useMemo(() => {
    if (!agent.category) return '';

    const category = categories.find((cat) => cat.value === agent.category);
    if (category) {
      if (category.label && category.label.startsWith('com_')) {
        return localize(category.label as TranslationKeys);
      }
      return category.label;
    }

    return agent.category.charAt(0).toUpperCase() + agent.category.slice(1);
  }, [agent.category, categories, localize]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && onSelect) {
      onSelect(agent);
    }
  };

  const handleLaunchAgent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const conversation = await getConversation();
    if (agent) {
      const keys = [QueryKeys.agents, { requiredPermission: PermissionBits.EDIT }];
      const listResp = queryClient.getQueryData<AgentListResponse>(keys);
      if (listResp != null) {
        if (!listResp.data.some((a) => a.id === agent.id)) {
          const currentAgents = [agent, ...JSON.parse(JSON.stringify(listResp.data))];
          queryClient.setQueryData<AgentListResponse>(keys, { ...listResp, data: currentAgents });
        }
      }

      localStorage.setItem(`${LocalStorageKeys.AGENT_ID_PREFIX}0`, agent.id);

      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);

      /** Template with agent configuration */
      const template = {
        conversationId: Constants.NEW_CONVO as string,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        title: localize('com_agents_chat_with', { name: agent.name || localize('com_ui_agent') }),
        ...specDisplayFieldReset,
      };

      const currentConvo = getDefaultConversation({
        conversation: { ...(conversation ?? {}), ...template },
        preset: template,
      });

      newConversation({
        template: currentConvo,
        preset: template,
      });
    }
  };

  return (
    <OGDialog open={isOpen} onOpenChange={handleOpenChange}>
      <OGDialogTrigger asChild>
        <div
          className={cn(
            'group relative flex h-32 gap-5 overflow-hidden rounded-xl',
            'cursor-pointer select-none px-6 py-4',
            'bg-surface-tertiary transition-colors duration-150 hover:bg-surface-hover',
            'md:h-36 lg:h-40',
            '[&_*]:cursor-pointer',
            className,
          )}
          aria-label={localize('com_agents_agent_card_label', {
            name: agent.name,
            description,
          })}
          aria-describedby={description ? `agent-${agent.id}-description` : undefined}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
        >
          {/* Category badge & quick actions - top right */}
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {categoryLabel && (
              <span className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-text-secondary">
                {categoryLabel}
              </span>
            )}
            <TooltipAnchor
              description={localize('com_agents_start_chat')}
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleLaunchAgent}
                  aria-label={localize('com_agents_start_chat')}
                  className="size-7 rounded-lg bg-surface-primary/70 text-text-secondary shadow-sm hover:bg-surface-submit hover:text-white"
                >
                  <Play className="size-3.5 fill-current" />
                </Button>
              }
            />
          </div>

          {/* Avatar */}
          <div className="flex-shrink-0 self-center">
            <div className="overflow-hidden rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)] dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              {renderAgentAvatar(agent, { size: 'sm', showBorder: false })}
            </div>
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
            {/* Agent name */}
            <Label className="line-clamp-2 text-base font-semibold text-text-primary md:text-lg">
              {agent.name}
            </Label>

            {/* Agent description */}
            {description && (
              <Description
                as="p"
                id={`agent-${agent.id}-description`}
                className="mt-0.5 line-clamp-2 text-sm leading-snug text-text-secondary md:line-clamp-5"
                aria-label={localize('com_agents_description_card', {
                  description,
                })}
                description={description}
                plainText
              />
            )}

            <AgentContact
              agent={agent}
              className="mt-1 text-xs text-text-secondary [&_a]:font-normal [&_a]:text-text-secondary"
            />
          </div>
        </div>
      </OGDialogTrigger>

      <AgentDetailContent agent={agent} />
    </OGDialog>
  );
};

export default AgentCard;
