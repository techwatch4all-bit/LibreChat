import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  MAX_CHAT_PROJECT_NAME_LENGTH,
  MAX_CHAT_PROJECT_DESCRIPTION_LENGTH,
} from 'librechat-data-provider';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogTemplate,
  Spinner,
  Textarea,
  useToastContext,
} from '@librechat/client';
import type { TChatProject } from 'librechat-data-provider';
import { useCreateProjectMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

type ProjectCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: TChatProject) => void;
  children?: ReactNode;
  triggerRef?: MutableRefObject<HTMLButtonElement | null>;
};

export default function ProjectCreateDialog({
  open,
  onOpenChange,
  onCreated,
  children,
  triggerRef,
}: ProjectCreateDialogProps) {
  const localize = useLocalize();
  const formId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localPath, setLocalPath] = useState('');
  const createProject = useCreateProjectMutation();
  const { showToast } = useToastContext();

  const handlePickDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (handle && handle.name) {
          if (!name) {
            setName(handle.name);
          }
          setLocalPath(handle.name);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Directory picker error:', err);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const frameId = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setLocalPath('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen && !createProject.isLoading) {
      resetForm();
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || createProject.isLoading) {
      return;
    }

    try {
      const trimmedDescription = description.trim();
      const project = await createProject.mutateAsync({
        name: trimmedName,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        ...(localPath.trim() ? { localPath: localPath.trim() } : {}),
      });
      resetForm();
      onOpenChange(false);
      onCreated?.(project);
    } catch {
      showToast({
        message: localize('com_ui_project_create_error'),
        status: 'error',
      });
    }
  };

  return (
    <OGDialog open={open} onOpenChange={handleOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate
        title={localize('com_ui_create_project')}
        showCloseButton={false}
        className="w-11/12 max-w-md"
        main={
          <form id={formId} onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-name`} className="text-sm font-medium text-text-primary">
                {localize('com_ui_project_name')}
              </Label>
              <Input
                id={`${formId}-name`}
                ref={inputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={localize('com_ui_project_name_placeholder')}
                maxLength={MAX_CHAT_PROJECT_NAME_LENGTH}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-localPath`} className="text-sm font-medium text-text-primary">
                Local Folder Path (Vibe Coding Workspace)
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`${formId}-localPath`}
                  value={localPath}
                  onChange={(event) => setLocalPath(event.target.value)}
                  placeholder="e.g. D:\MyProject or click Browse"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePickDirectory}
                  className="shrink-0"
                >
                  Browse...
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor={`${formId}-description`}
                className="text-sm font-medium text-text-primary"
              >
                {localize('com_ui_description')}{' '}
                <span className="font-normal text-text-secondary">
                  {localize('com_ui_optional')}
                </span>
              </Label>
              <Textarea
                id={`${formId}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={MAX_CHAT_PROJECT_DESCRIPTION_LENGTH}
                className="min-h-[4.5rem] bg-transparent"
              />
            </div>
          </form>
        }
        buttons={
          <Button
            type="submit"
            form={formId}
            variant="submit"
            disabled={!name.trim() || createProject.isLoading}
            aria-label={localize('com_ui_create_project')}
            className="active:scale-[0.96]"
          >
            {createProject.isLoading ? (
              <Spinner className="size-4" />
            ) : (
              localize('com_ui_create_project')
            )}
          </Button>
        }
      />
    </OGDialog>
  );
}
