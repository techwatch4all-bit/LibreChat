import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button, TooltipAnchor, useToastContext } from '@librechat/client';
import { Pencil, Pin, User, Calendar, EarthIcon, Sparkles, ShieldAlert } from 'lucide-react';
import { InvocationMode } from 'librechat-data-provider';
import type { TSkill } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import { useLocalize, useAuthContext } from '~/hooks';
import { useUpdateSkillMutation } from '~/data-provider';
import DeleteSkill from '../dialogs/DeleteSkill';
import { ShareSkill } from '../buttons';

const invocationLabelMap: Record<InvocationMode, TranslationKeys> = {
  [InvocationMode.auto]: 'com_ui_invocation_auto',
  [InvocationMode.manual]: 'com_ui_invocation_manual',
  [InvocationMode.both]: 'com_ui_invocation_both',
};

interface SkillDetailHeaderProps {
  skill: TSkill;
  showActions?: boolean;
}

const SkillDetailHeader = ({ skill, showActions = true }: SkillDetailHeaderProps) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const updateSkillMutation = useUpdateSkillMutation();
  const formattedDate = skill.createdAt ? format(new Date(skill.createdAt), 'MMM d, yyyy') : null;
  const isOwner = skill.author === user?.id;
  const isShared = !isOwner && Boolean(skill.authorName);
  const isPublic = skill.isPublic === true;

  return (
    <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-xl font-bold text-text-primary" title={skill.name}>
            {skill.name}
          </h2>
          {isPublic && !skill.adminOnly && (
            <TooltipAnchor
              description="Status: Public (Available to standard tenant users)"
              side="top"
              render={
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <EarthIcon
                    className="h-4 w-4 shrink-0 text-accent-primary"
                    aria-label="Public Skill"
                  />
                  <span>Public</span>
                </span>
              }
            />
          )}
          {skill.adminOnly === true && (
            <TooltipAnchor
              description="Admin-Only Skill (Hidden from standard users)"
              side="top"
              render={
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-500">
                  <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Admin Only
                </span>
              }
            />
          )}
          {skill.alwaysApply === true && (
            <TooltipAnchor
              description={localize('com_ui_skills_always_apply_pin_title')}
              side="top"
              render={
                <Pin
                  className="h-5 w-5 shrink-0 text-status-info"
                  aria-label={localize('com_ui_skills_always_apply_pin_title')}
                />
              }
            />
          )}
        </div>
        {skill.description && (
          <p className="text-sm text-text-secondary sm:truncate">{skill.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          {isShared && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3 text-text-secondary" aria-hidden="true" />
              {localize('com_ui_by_author', { 0: skill.authorName })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {localize('com_ui_invoked_by')}:{' '}
            {localize(invocationLabelMap[skill.invocationMode ?? InvocationMode.auto])}
          </span>
          {formattedDate && (
            <time className="flex items-center gap-1" dateTime={skill.createdAt}>
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {formattedDate}
            </time>
          )}
        </div>
      </div>
      {showActions && (
        <div className="flex shrink-0 items-center gap-2">
          {user?.role === 'ADMIN' && (
            <TooltipAnchor
              description={skill.adminOnly ? 'Make available to all users' : 'Restrict to Administrators only'}
              side="bottom"
              render={
                <Button
                  variant={skill.adminOnly ? 'destructive' : 'outline'}
                  size="sm"
                  className="h-9 gap-1.5 px-3 text-xs font-medium"
                  aria-label="Toggle Admin Only status"
                  onClick={() => {
                    const newAdminOnly = !skill.adminOnly;
                    updateSkillMutation.mutate(
                      {
                        id: skill._id,
                        expectedVersion: skill.version ?? 1,
                        payload: {
                          adminOnly: newAdminOnly,
                        },
                      },
                      {
                        onSuccess: () => {
                          showToast({
                            message: newAdminOnly
                              ? 'Skill is now restricted to Administrators only.'
                              : 'Skill is now available to standard users.',
                            status: 'success',
                          });
                        },
                        onError: (error: any) => {
                          showToast({
                            message: error?.response?.data?.message || error?.message || 'Failed to update skill access.',
                            status: 'error',
                          });
                        },
                      },
                    );
                  }}
                >
                  <ShieldAlert className="size-4" aria-hidden="true" />
                  {skill.adminOnly ? 'Admin Only: Active' : 'Make Admin Only'}
                </Button>
              }
            />
          )}
          <ShareSkill skill={skill} />
          {isOwner && (
            <>
              <TooltipAnchor
                description={localize('com_ui_edit')}
                side="bottom"
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9"
                    aria-label={localize('com_ui_edit_skill')}
                    onClick={() => navigate(`/skills/${skill._id}/edit`)}
                  >
                    <Pencil className="size-5" aria-hidden="true" />
                  </Button>
                }
              />
              <DeleteSkill
                skillId={skill._id}
                skillName={skill.name}
                onDelete={() => navigate('/skills')}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillDetailHeader;
