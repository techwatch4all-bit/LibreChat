import { memo } from 'react';
import { Sidebar as SidebarIcon } from 'lucide-react';
import type { NavLink } from '~/common';
import { useActivePanel, resolveActivePanel } from '~/Providers';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function PanelStrip({
  links,
  panelOpen,
  onSelectPanel,
  onClose,
  onLeaveInsights,
  routeActiveId,
}: {
  links: NavLink[];
  panelOpen: boolean;
  onSelectPanel: (id: string) => void;
  onClose: () => void;
  onLeaveInsights?: () => void;
  routeActiveId?: string;
}) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const activeId = routeActiveId ?? resolveActivePanel(active, links);

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={localize('com_nav_control_panel')}
      className="no-scrollbar pointer-events-auto flex h-full w-14 flex-shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-border-light bg-surface-primary-alt py-2.5"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={localize('com_nav_close_sidebar')}
        title={localize('com_nav_close_sidebar')}
        className="mb-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <SidebarIcon className="size-4" aria-hidden="true" />
      </button>
      {links.map((link) => {
        const isActive = panelOpen && link.id === activeId;
        const Icon = link.icon;
        const label = localize(link.title);
        return (
          <button
            key={link.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            title={label}
            onClick={() => {
              if (link.onClick) {
                link.onClick();
                onClose();
                return;
              }
              setActive(link.id);
              if (routeActiveId) {
                onLeaveInsights?.();
              }
              onSelectPanel(link.id);
            }}
            className={cn(
              'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors',
              isActive
                ? 'bg-surface-active-alt text-text-primary shadow-sm ring-1 ring-border-medium'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default memo(PanelStrip);
