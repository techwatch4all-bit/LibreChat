import { memo, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { useParams } from 'react-router-dom';
import { Constants, buildTree } from 'librechat-data-provider';
import type { TChatProject } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import {
  useScrollbarGutterSeed,
  useAddedResponse,
  useResumeOnLoad,
  useAdaptiveSSE,
  useChatHelpers,
  useQueueDrain,
  useQueuedTurnReveal,
  useLocalize,
} from '~/hooks';
import { ChatContext, AddedChatContext, ChatFormProvider, useFileMapContext } from '~/Providers';
import { QueuedTurnPortalProvider } from './Steering/QueuedTurnPortal';
import ApprovalProvider from './Messages/Content/ApprovalContext';
import ConversationStartersMobile from './Input/ConversationStartersMobile';
import ConversationStarters from './Input/ConversationStarters';
import { pendingApprovalActionFamily } from './approval/state';
import { useGetMessagesByConvoId } from '~/data-provider';
import Footer, { useConfiguredFooter } from './Footer';
import { AskAnswerHostProvider } from './ask/state';
import DeviceLayoutSync from './DeviceLayoutSync';
import MessagesView from './Messages/MessagesView';
import MobileFooter from './MobileFooter';
import MobileLanding from './MobileLanding';
import TabletLanding from './TabletLanding';
import Presentation from './Presentation';
import TokenOfferBanner from './TokenOfferBanner';
import ChatForm from './Input/ChatForm';
import { TraceSurface } from './Trace';
import Landing from './Landing';
import Header from './Header';
import { deviceLayoutAtom } from '~/store/layout';
import { cn } from '~/utils';
import store from '~/store';

function LoadingSpinner() {
  let landingContainerClass = 'h-full overflow-y-auto';
  if (isLandingPage) {
    landingContainerClass = isPhone
      ? 'min-h-full flex-1 flex-col items-center justify-between overflow-y-auto bg-black px-2 pb-2 pt-14'
      : 'scrollbar-gutter-spacer min-h-full flex-1 flex-col items-center justify-center overflow-y-auto px-2 pb-3 pt-12 sm:py-4';
  }

  return (
    <div className="relative flex-1 overflow-hidden overflow-y-auto">
      <div className="relative flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    </div>
  );
}

function ChatView({ index = 0, project }: { index?: number; project?: TChatProject }) {
  const { conversationId } = useParams();
  const localize = useLocalize();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(index));
  const saveDrafts = useRecoilValue(store.saveDrafts);
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);
  const { isPhone, isTablet, isLandscape } = useAtomValue(deviceLayoutAtom);
  const pendingAction = useAtomValue(
    pendingApprovalActionFamily(conversationId ?? Constants.NEW_CONVO),
  );

  /** The welcome screen reserves the message column's scrollbar band before any
   *  column exists to measure it (see the column's class list below). */
  useScrollbarGutterSeed();

  /** A conversation carries a footer only for configured content, and the
   *  composer's clearance has to account for the bar when it does — including
   *  before the config answers, so a cold load does not jump. */
  const configuredFooter = useConfiguredFooter();

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  const fileMap = useFileMapContext();

  const {
    data: messages = null,
    isLoading,
    isFetching,
  } = useGetMessagesByConvoId(
    conversationId ?? '',
    {
      enabled: !!conversationId && conversationId !== Constants.SEARCH,
      /** Refetch stale caches on mount: navigation invalidates (not removes)
       * messages now, so a warm conversation renders instantly from cache and
       * reconciles in the background instead of unmounting into a spinner. */
      refetchOnMount: true,
    },
    { isStreaming: isSubmitting },
  );
  const messagesTree = useMemo(() => {
    const dataTree = buildTree({ messages, fileMap });
    return dataTree?.length === 0 ? null : (dataTree ?? null);
  }, [messages, fileMap]);

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse();

  const activeConversation =
    chatHelpers.conversation?.conversationId === conversationId
      ? chatHelpers.conversation
      : undefined;
  const activeSubagentThread = activeConversation?.subagentThread;

  useAdaptiveSSE(rootSubmission, chatHelpers, false, index);

  // Auto-resume if navigating back to conversation with active job.
  // Wait for messages to load AND the warm-cache background revalidation to
  // settle: a stale invalidated cache mounts with isLoading false while the
  // refetch is in flight, and resume must not build from (or race) it.
  useResumeOnLoad(conversationId, chatHelpers.getMessages, index, !isLoading && !isFetching);

  // Show a server-owned queued follow-up as the next user turn as soon as its
  // predecessor completes, ahead of the receipt and active-job polls.
  const revealQueuedTurn = useQueuedTurnReveal(conversationId, index);

  // Auto-send queued follow-up messages once a run finishes cleanly.
  useQueueDrain(index, conversationId, chatHelpers.ask, revealQueuedTurn);

  let content: JSX.Element | null | undefined;
  const isLandingPage =
    (!messagesTree || messagesTree.length === 0) &&
    (conversationId === Constants.NEW_CONVO || !conversationId);

  /** A footer bar renders beneath the composer on the welcome screen always, and
   *  in a conversation when the deployment configured one. The shell already
   *  carried that answer, so this is the same value before and after the config
   *  resolves. */
  const footerBelow = isLandingPage || configuredFooter;
  const isNavigating = (!messagesTree || messagesTree.length === 0) && conversationId != null;
  const isProjectLandingPage = isLandingPage && project != null;

  if (isLoading && conversationId !== Constants.NEW_CONVO) {
    content = <LoadingSpinner />;
  } else if ((isLoading || isNavigating) && !isLandingPage) {
    content = <LoadingSpinner />;
  } else if (!isLandingPage) {
    content = <MessagesView messagesTree={messagesTree} messages={messages} />;
  } else if (isPhone) {
    content = <MobileLanding />;
  } else if (isTablet) {
    content = <TabletLanding />;
  } else {
    content = <Landing centerFormOnLanding={centerFormOnLanding} />;
  }

  const chatFormPlaceholder =
    isProjectLandingPage && project
      ? localize('com_ui_new_chat_in_project', { name: project.name })
      : undefined;

  // Recoil conversation can lag the route during navigation; only announce a
  // title that belongs to the conversation currently in the URL.
  const conversationTitle =
    chatHelpers.conversation?.conversationId === conversationId
      ? chatHelpers.conversation?.title?.trim()
      : undefined;
  const pageHeading =
    isLandingPage || !conversationTitle ? localize('com_ui_new_chat') : conversationTitle;
  const parentConversationId = activeSubagentThread?.parentConversationId;
  /** Durable child threads are an execution record owned by their parent agent.
   * Human continuation is a separate future fork/promotion flow, never an
   * in-place mutation of this canonical child transcript. */
  const isSubagentThreadReadOnly = activeSubagentThread != null;

  let landingContainerClass = 'h-full overflow-y-auto';
  if (isLandingPage) {
    landingContainerClass = isPhone
      ? 'min-h-full flex-1 flex-col items-center justify-between overflow-y-auto bg-black px-2 pb-2 pt-14'
      : 'scrollbar-gutter-spacer min-h-full flex-1 flex-col items-center justify-center overflow-y-auto px-2 pb-3 pt-12 sm:py-4';
  }

  return (
    <AskAnswerHostProvider saveDrafts={saveDrafts}>
      <ChatFormProvider {...methods}>
        <ChatContext.Provider value={chatHelpers}>
          <AddedChatContext.Provider value={addedChatHelpers}>
            <ApprovalProvider pendingAction={pendingAction}>
              <QueuedTurnPortalProvider>
                <DeviceLayoutSync>
                  <Presentation isLandingPage={isLandingPage}>
                  <TraceSurface conversationId={conversationId}>
                    <h1 className="sr-only">{pageHeading}</h1>
                    <Header
                      parentConversationId={parentConversationId}
                      readOnly={isSubagentThreadReadOnly}
                    />
                    <>
                      <div
                        data-mobile-landing={isLandingPage && isPhone ? 'true' : undefined}
                        className={cn('flex flex-col', landingContainerClass)}
                      >
                        {isLandingPage && isPhone ? (
                          <div className="flex w-full flex-1 flex-col items-center justify-start gap-4 pt-6">
                            {content}
                            <ConversationStartersMobile />
                          </div>
                        ) : (
                          content
                        )}
                        {/* Named + opaque so a view transition (the ask_user_question
                        popover ⇄ chat-card morph) paints the whole composer band
                        over the travelling card instead of letting it show
                        through below the composer. The background matches the
                        page, so normal rendering is unchanged. The named surface
                        is a stacking context; keep it above positioned tool glyphs
                        so they cannot paint through the approval preview. */}
                        <div
                          className={cn(
                            'relative z-10 w-full bg-presentation [view-transition-name:chat-form]',
                            !isLandingPage && 'scrollbar-gutter-spacer',
                            isLandingPage &&
                              'mx-auto w-full max-w-3xl transition-all duration-200 sm:max-w-4xl lg:max-w-5xl',
                          )}
                        >
                          {isLandingPage && !isPhone &&
                          (isTablet ? (
                            <ConversationStartersMobile />
                          ) : (
                            <ConversationStarters />
                          ))}
                          {isSubagentThreadReadOnly ? (
                            <div
                              className="mx-auto w-full max-w-3xl px-4 py-3 text-center text-sm text-text-secondary xl:max-w-4xl"
                              role="note"
                            >
                              {localize('com_ui_subagent_thread_read_only')}
                            </div>
                          ) : (
                            <ChatForm
                              index={index}
                              placeholder={chatFormPlaceholder}
                              project={isProjectLandingPage ? project : undefined}
                              isLandingPage={isLandingPage}
                              footerBelow={footerBelow}
                              centerFormOnLanding={centerFormOnLanding}
                            />
                          )}
                          {/* The generic disclaimer is the welcome screen's; a
                            deployment's own footer, privacy policy and terms
                            stay with the conversation that always showed them. */}
                          {!isLandingPage && configuredFooter && <Footer configuredOnly />}
                        </div>
                        {isLandingPage &&
                          (isPhone ? !isLandscape && <MobileFooter /> : <Footer />)}
                        <TokenOfferBanner />
                      </div>
                    </>
                  </TraceSurface>
                </Presentation>
              </DeviceLayoutSync>
              </QueuedTurnPortalProvider>
            </ApprovalProvider>
          </AddedChatContext.Provider>
        </ChatContext.Provider>
      </ChatFormProvider>
    </AskAnswerHostProvider>
  );
}

export default memo(ChatView);
