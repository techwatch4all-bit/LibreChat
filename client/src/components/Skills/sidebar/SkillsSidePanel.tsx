import { useState, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { Spinner, Button, useToastContext } from '@librechat/client';
import { Trash2, RotateCcw, ChevronRight } from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { TSkillListResponse } from 'librechat-data-provider';
import { useLocalize, useDebounce, useNavScrolling, useAuthContext } from '~/hooks';
import SkillListSkeleton from '../lists/SkillListSkeleton';
import { useSkillsInfiniteQuery, useRestoreSkillMutation } from '~/data-provider';
import SkillListPanel from '../lists/SkillList';
import { PanelContent, Collapse } from '~/components/ui';
import FilterSkills from './FilterSkills';
import { cn } from '~/utils';
import store from '~/store';

interface SkillsSidePanelProps {
  className?: string;
}

/**
 * Skills sidebar panel.
 * Header: filter input + create menu, matching the other side panels.
 * Includes Trash / Deleted Skills view for Admins with 1-click restore.
 */
export default function SkillsSidePanel({ className }: SkillsSidePanelProps) {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
  const { skillId: activeSkillId } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionOpen, setSectionOpen] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 250);

  const listQuery = useSkillsInfiniteQuery({ search: debouncedSearch || undefined, limit: 20 });

  const pages = useMemo(() => listQuery.data?.pages ?? [], [listQuery.data]);
  const skills = useMemo(() => pages.flatMap((page) => page.skills), [pages]);

  const lastPage = pages[pages.length - 1];
  const nextCursor = lastPage?.has_more === true ? lastPage.after : null;

  // Deleted skills query for administrators
  const trashQuery = useSkillsInfiniteQuery(
    { search: debouncedSearch || undefined, limit: 20, deleted: true },
    { enabled: isAdmin },
  );

  const trashPages = useMemo(() => trashQuery.data?.pages ?? [], [trashQuery.data]);
  const deletedSkills = useMemo(() => trashPages.flatMap((page) => page.skills), [trashPages]);

  const restoreMutation = useRestoreSkillMutation({
    onSuccess: (restoredSkill) => {
      showToast({
        status: 'success',
        message: `Restored skill "${restoredSkill.name}" successfully!`,
      });
      trashQuery.refetch();
    },
    onError: (err: any) => {
      showToast({
        status: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to restore skill.',
      });
    },
  });

  /** A collapsed sidebar keeps this panel mounted, so stop draining pages into it */
  const sidebarExpanded = useRecoilValue(store.sidebarExpanded);

  const { containerRef } = useNavScrolling<TSkillListResponse>({
    nextCursor,
    isFetchingNext: listQuery.isFetchingNextPage,
    fetchNextPage: listQuery.fetchNextPage,
    enabled: sidebarExpanded && sectionOpen,
  });

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-hidden border-r border-border-light pt-2',
        className,
      )}
    >
      <FilterSkills
        className="shrink-0 px-3 pb-2"
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Only the list scrolls */}
      <PanelContent
        ref={containerRef}
        isLoading={listQuery.isLoading}
        skeleton={<SkillListSkeleton />}
        className="px-3 pb-3"
      >
        <SkillListPanel
          skills={skills}
          activeSkillId={activeSkillId}
          sectionOpen={sectionOpen}
          onSectionOpenChange={setSectionOpen}
        />
        {/* Appending the next page, so the loaded rows stay put */}
        {listQuery.isFetchingNextPage && (
          <div className="flex shrink-0 justify-center py-2">
            <Spinner className="size-4" />
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {localize('com_ui_loading')}
            </span>
          </div>
        )}

        {/* Administrator Trash & Restore Section */}
        {isAdmin && (
          <div className="mt-4 flex flex-col gap-px border-t border-border-light pt-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <button
                type="button"
                onClick={() => setTrashOpen(!trashOpen)}
                className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
                aria-expanded={trashOpen}
              >
                <ChevronRight
                  className={cn(
                    'size-3 shrink-0 text-text-secondary transition-transform duration-200',
                    trashOpen && 'rotate-90',
                  )}
                  aria-hidden="true"
                />
                <Trash2 className="size-3.5 text-text-secondary" />
                <span>Deleted Skills ({deletedSkills.length})</span>
              </button>
            </div>

            <Collapse open={trashOpen}>
              <div className="flex flex-col gap-1.5 pt-1">
                {deletedSkills.length === 0 ? (
                  <p className="px-3 py-2 text-center text-xs text-text-secondary">
                    No deleted skills in trash
                  </p>
                ) : (
                  deletedSkills.map((dSkill) => (
                    <div
                      key={dSkill._id}
                      className="flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary/40 px-2.5 py-1.5 text-xs"
                    >
                      <div className="min-w-0 flex-1 truncate pr-2">
                        <span className="font-medium text-text-primary line-through opacity-75">
                          {dSkill.name}
                        </span>
                        <div className="text-[10px] text-text-secondary">
                          by {dSkill.authorName}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 gap-1 px-2 text-[11px] hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/50"
                        disabled={restoreMutation.isLoading}
                        onClick={() => restoreMutation.mutate({ id: dSkill._id })}
                        title="Restore this skill"
                      >
                        <RotateCcw className="size-3" />
                        <span>Restore</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Collapse>
          </div>
        )}
      </PanelContent>
    </div>
  );
}
