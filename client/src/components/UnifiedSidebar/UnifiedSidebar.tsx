import { useCallback, useState, useEffect, useRef, memo } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMediaQuery } from '@librechat/client';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ChatFormValues } from '~/common';
import {
  COLLAPSED_WIDTH,
  EXPANDED_MIN,
  TRANSITION_MS,
  EASING,
  MOBILE_DRAWER_TRANSITION,
  DRAWER_Z_INDEX,
  MOBILE_DRAWER_ID,
  MOBILE_DRAWER_WIDTH,
  DRAWER_UNPAINTED,
} from './constants';
import { ChatContext, ChatFormProvider, ActivePanelProvider } from '~/Providers';
import {
  MobileHeader,
  MobilePanelStrip,
  MobileBottomBar,
  MobileShortcutTargets,
} from './mobile';
import useUnifiedSidebarLinks from '~/hooks/Nav/useUnifiedSidebarLinks';
import useSidebarToggle from '~/hooks/Nav/useSidebarToggle';
import useSidebarState from '~/hooks/Nav/useSidebarState';
import { useChatHelpers, useLocalize } from '~/hooks';
import SidePanelNav from '~/components/SidePanel/Nav';
import Sidebar from './Sidebar';
import { cn } from '~/utils';

function getInitialWidth(): number {
  const saved = localStorage.getItem('side:width');
  return saved ? Math.max(Number(saved), EXPANDED_MIN) : EXPANDED_MIN;
}

/**
 * Isolates useChatHelpers Recoil subscriptions from the sidebar layout.
 * Atom changes (e.g. during streaming) only re-render this component
 * and the active panel — not the sidebar shell, resize logic, or icon strip.
 * This works because Recoil subscriptions don't propagate to parent components.
 */
function SidebarChatProvider({ children }: { children: ReactNode }) {
  const chatHelpers = useChatHelpers(0);
  const sidebarFormMethods = useForm<ChatFormValues>({ defaultValues: { text: '' } });
  return (
    <ChatFormProvider {...sidebarFormMethods}>
      <ChatContext.Provider value={chatHelpers}>{children}</ChatContext.Provider>
    </ChatFormProvider>
  );
}

function UnifiedSidebar({ isSliding = false }: { isSliding?: boolean }) {
  const localize = useLocalize();
  const location = useLocation();
  const navigate = useNavigate();
  const { isSmallScreen, expanded } = useSidebarState();
  const { setSidebarOpen } = useSidebarToggle();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [sidebarWidth, setSidebarWidth] = useState(getInitialWidth);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const resizeHandlers = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  useEffect(() => {
    if (!expanded) {
      setMobilePanelOpen(false);
    }
  }, [expanded]);

  const links = useUnifiedSidebarLinks();
  const isInsightsRoute = location.pathname.startsWith('/insights');
  const panelExpanded = expanded && !isInsightsRoute;

  /** The aside's max width is a viewport percentage, so the announced range has to track
   *  the viewport rather than a render-time snapshot of it. */
  useEffect(() => {
    const handleViewportResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, []);

  /** Mirrors the bounds the aside is rendered with, so the handle never announces a value
   *  outside its own range. CSS resolves a 40% that falls under `min-width` in favor of the
   *  minimum, and the resize handlers clamp the same way, so the floor belongs here too. */
  const resizeMax = Math.max(EXPANDED_MIN, Math.round(viewportWidth * 0.4));
  const resizeNow = panelExpanded
    ? Math.min(Math.max(sidebarWidth, EXPANDED_MIN), resizeMax)
    : COLLAPSED_WIDTH;

  const handleCollapse = useCallback(
    (afterSlide?: () => void) => {
      setSidebarOpen(false, afterSlide);
    },
    [setSidebarOpen],
  );

  const handleExpand = useCallback(() => {
    setSidebarOpen(true);
  }, [setSidebarOpen]);

  const handleLeaveInsights = useCallback(() => {
    navigate('/c/new');
  }, [navigate]);

  const handlePanelExpand = useCallback(() => {
    if (isInsightsRoute) {
      handleLeaveInsights();
    }
    handleExpand();
  }, [handleExpand, handleLeaveInsights, isInsightsRoute]);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    document.body.style.userSelect = 'none';
    const maxWidth = window.innerWidth * 0.4;
    let rafId: number | null = null;

    const move = (e: MouseEvent) => {
      if (rafId != null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const next = Math.max(EXPANDED_MIN, Math.min(e.clientX, maxWidth));
        setSidebarWidth(next);
      });
    };

    const up = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.body.style.userSelect = '';
      setIsResizing(false);
      resizeHandlers.current = null;
      setSidebarWidth((w) => {
        localStorage.setItem('side:width', String(Math.round(w)));
        return w;
      });
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };

    resizeHandlers.current = { move, up };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }, []);

  const handleResizeKeyboard = useCallback((direction: 'shrink' | 'grow') => {
    setSidebarWidth((w) => {
      const next =
        direction === 'shrink'
          ? Math.max(w - 20, EXPANDED_MIN)
          : Math.min(w + 20, window.innerWidth * 0.4);
      localStorage.setItem('side:width', String(Math.round(next)));
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resizeHandlers.current) {
        document.removeEventListener('mousemove', resizeHandlers.current.move);
        document.removeEventListener('mouseup', resizeHandlers.current.up);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSmallScreen || !expanded) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      /**
       * Menus opened from the drawer portal out of it, so their Escape still
       * reaches this listener. Dismissing the whole drawer would skip the level
       * the user meant to leave.
       *
       * Presence alone is not the signal: not every menu unmounts when closed —
       * the account menu stays mounted and merely `hidden` — so matching those
       * too would suppress Escape for the drawer permanently.
       */
      if (document.querySelector('[role="menu"]:not([hidden])') != null) {
        return;
      }
      handleCollapse();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isSmallScreen, expanded, handleCollapse]);

  if (isSmallScreen) {
    return (
      <SidebarChatProvider>
        <ActivePanelProvider>
          <div
            id={MOBILE_DRAWER_ID}
            className={cn(
              'pointer-events-none fixed inset-y-0 left-0 flex w-14 touch-pan-y touch-pinch-zoom flex-row shadow-2xl',
              expanded ? 'translate-x-0' : '-translate-x-full',
            )}
            style={{
              width: '56px',
              transition: prefersReducedMotion ? undefined : MOBILE_DRAWER_TRANSITION,
              zIndex: DRAWER_Z_INDEX,
              visibility: expanded || isSliding ? undefined : DRAWER_UNPAINTED,
            }}
            inert={!expanded ? '' : undefined}
          >
            <MobilePanelStrip
              links={links}
              panelOpen={mobilePanelOpen}
              onSelectPanel={() => setMobilePanelOpen(true)}
              onClose={handleCollapse}
              onLeaveInsights={handleLeaveInsights}
              routeActiveId={isInsightsRoute ? 'insights' : undefined}
            />
          </div>

          {expanded && mobilePanelOpen && (
            <div
              role="region"
              aria-label={localize('com_nav_control_panel')}
              className="fixed bottom-[148px] left-[60px] right-2 z-[120] flex h-[38dvh] flex-col overflow-hidden rounded-2xl border border-border-medium bg-surface-primary-alt shadow-2xl"
            >
              <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border-light px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <MobileHeader
                    links={links}
                    expanded={expanded}
                    onClose={() => setMobilePanelOpen(false)}
                    onLeaveInsights={handleLeaveInsights}
                    routeActiveId={isInsightsRoute ? 'insights' : undefined}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen(false)}
                  aria-label={localize('com_nav_close_sidebar')}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
              <nav
                id="chat-history-nav"
                className="min-h-0 flex-1 overflow-y-auto bg-surface-primary-alt px-1"
              >
                <SidePanelNav links={links} />
              </nav>
              <MobileShortcutTargets
                links={links}
                onLeaveInsights={handleLeaveInsights}
                routeActiveId={isInsightsRoute ? 'insights' : undefined}
              />
            </div>
          )}
        </ActivePanelProvider>
      </SidebarChatProvider>
    );
  }

  return (
    <SidebarChatProvider>
      <ActivePanelProvider>
        <aside
          className="relative flex h-full flex-shrink-0 overflow-hidden"
          style={{
            width: panelExpanded ? sidebarWidth : COLLAPSED_WIDTH,
            minWidth: panelExpanded ? EXPANDED_MIN : COLLAPSED_WIDTH,
            maxWidth: panelExpanded ? '40%' : COLLAPSED_WIDTH,
            transition: isResizing
              ? 'none'
              : `width ${TRANSITION_MS}ms ${EASING}, min-width ${TRANSITION_MS}ms ${EASING}, max-width ${TRANSITION_MS}ms ${EASING}`,
          }}
          aria-label={localize('com_nav_control_panel')}
        >
          <Sidebar
            links={links}
            expanded={panelExpanded}
            width={resizeNow}
            minWidth={panelExpanded ? EXPANDED_MIN : COLLAPSED_WIDTH}
            maxWidth={panelExpanded ? resizeMax : COLLAPSED_WIDTH}
            onCollapse={handleCollapse}
            onExpand={handlePanelExpand}
            onLeaveInsights={handleLeaveInsights}
            onResizeStart={handleResizeStart}
            onResizeKeyboard={handleResizeKeyboard}
          />
        </aside>
      </ActivePanelProvider>
    </SidebarChatProvider>
  );
}

export default memo(UnifiedSidebar);
