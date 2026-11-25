import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import { HatGlasses } from 'lucide-react';
import { EModelEndpoint } from 'librechat-data-provider';
import { BirthdayIcon, TooltipAnchor } from '@librechat/client';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import Description, { isHtmlDescription } from '~/components/ui/Description';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import { getIconEndpoint, getEntity, getModelSpec } from '~/utils';
import { useLocalize, useAuthContext, useGreeting } from '~/hooks';
import AgentContact from '~/components/Agents/AgentContact';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import { deviceLayoutAtom } from '~/store/layout';
import temporaryStore from '~/store/temporary';

const containerClassName =
  'shadow-stroke relative flex h-full items-center justify-center rounded-full bg-presentation text-text-primary dark:after:shadow-none ';

export default function MobileLanding() {
  const { isLandscape } = useAtomValue(deviceLayoutAtom);
  const { conversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { user } = useAuthContext();
  const localize = useLocalize();
  const isTemporary = useRecoilValue(temporaryStore.isTemporary);

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (ep === EModelEndpoint.azureOpenAI) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { entity, isAgent, isAssistant } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const modelSpec = useMemo(
    () => getModelSpec({ specName: conversation?.spec, startupConfig }),
    [conversation?.spec, startupConfig],
  );

  const brandedSpecLabel = modelSpec?.showOnLanding ? modelSpec.label : '';
  const brandedSpecDescription = (modelSpec?.showOnLanding && modelSpec.description) || '';
  const name = isTemporary ? '' : (entity?.name ?? brandedSpecLabel);
  const description = isTemporary
    ? localize('com_ui_temporary_description')
    : ((entity?.description || brandedSpecDescription || conversation?.greeting) ?? '');
  const descriptionIsHTML = isHtmlDescription(description);
  const selectedAgent =
    isAgent && conversation?.agent_id != null ? agentsMap?.[conversation.agent_id] : undefined;

  const customWelcome =
    typeof startupConfig?.interface?.customWelcome === 'string'
      ? startupConfig.interface.customWelcome
      : undefined;

  const scheduledGreeting = useGreeting(user?.name);
  const resolvedWelcome =
    customWelcome != null && user?.name
      ? customWelcome.replace(/{{user.name}}/g, user.name)
      : customWelcome;

  const greetingText = isTemporary
    ? localize('com_ui_temporary')
    : (resolvedWelcome ?? scheduledGreeting);

  const displayTitle = ((isAgent || isAssistant) && name) || name ? name : greetingText;
  const showConvoIcon = isTemporary || isAgent || isAssistant;

  if (isLandscape) {
    return (
      <div className="satchida-landing-container mb-1 flex w-full shrink-0 flex-row items-center justify-center gap-2.5 px-2 text-left">
        <img
          src="/assets/satchida/satchida-splash-mandala-dark.png?v=clean6"
          alt="Satchida AI Mandala"
          className="pointer-events-none h-9 w-auto shrink-0 select-none object-contain drop-shadow-sm"
        />
        {showConvoIcon && (
          <div className="relative flex size-7 shrink-0 items-center justify-center">
            {isTemporary ? (
              <div className={containerClassName}>
                <HatGlasses className="h-2/3 w-2/3 text-text-primary" aria-hidden="true" />
              </div>
            ) : (
              <ConvoIcon
                agentsMap={agentsMap}
                assistantMap={assistantMap}
                conversation={conversation}
                endpointsConfig={endpointsConfig}
                containerClassName={containerClassName}
                context="landing"
                className="h-2/3 w-2/3 text-text-primary"
                size={28}
              />
            )}
          </div>
        )}
        <h2 className="truncate text-base font-semibold tracking-tight text-text-primary">
          {displayTitle}
        </h2>
      </div>
    );
  }

  return (
    <div className="satchida-landing-container mb-1.5 flex w-full shrink-0 flex-col items-center justify-center px-2 text-center">
      <div className="mb-1 flex shrink-0 items-center justify-center">
        <img
          src="/assets/satchida/satchida-splash-mandala-dark.png?v=clean6"
          alt="Satchida AI Mandala"
          className="pointer-events-none h-[clamp(44px,7vh,68px)] w-auto max-w-[44vw] select-none object-contain drop-shadow-md"
        />
      </div>
      <div className="flex w-full max-w-full flex-col items-center justify-center gap-1 text-center">
        {showConvoIcon && (
          <div className="relative flex size-8 shrink-0 items-center justify-center">
            {isTemporary ? (
              <div className={containerClassName}>
                <HatGlasses className="h-2/3 w-2/3 text-text-primary" aria-hidden="true" />
              </div>
            ) : (
              <ConvoIcon
                agentsMap={agentsMap}
                assistantMap={assistantMap}
                conversation={conversation}
                endpointsConfig={endpointsConfig}
                containerClassName={containerClassName}
                context="landing"
                className="h-2/3 w-2/3 text-text-primary"
                size={32}
              />
            )}
            {startupConfig?.showBirthdayIcon && (
              <TooltipAnchor
                className="absolute bottom-[20px] right-1"
                description={localize('com_ui_happy_birthday')}
                aria-label={localize('com_ui_happy_birthday')}
              >
                <BirthdayIcon />
              </TooltipAnchor>
            )}
          </div>
        )}
        <h2 className="line-clamp-2 max-w-full px-1 text-lg font-semibold tracking-tight text-text-primary">
          {displayTitle}
        </h2>
        {description && (
          <Description
            allowMedia
            description={description}
            className={
              descriptionIsHTML
                ? 'line-clamp-2 max-w-xs text-center text-xs font-normal text-text-secondary [&_img]:inline-block [&_img]:h-3.5 [&_img]:w-3.5'
                : `line-clamp-2 max-w-xs text-center text-xs font-normal ${isTemporary ? 'text-text-secondary' : 'text-text-secondary'}`
            }
          />
        )}
        {selectedAgent && !isTemporary && (
          <AgentContact
            agent={selectedAgent}
            className="mt-1 max-w-xs justify-center text-center text-xs"
          />
        )}
      </div>
    </div>
  );
}
