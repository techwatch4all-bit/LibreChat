import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import { useToastContext } from '@librechat/client';
import { PermissionTypes, Permissions, apiBaseUrl } from 'librechat-data-provider';
import {
  handleDoubleClick,
  triggerDownload,
  resolveInlineMedia,
  toAbsoluteFilePath,
} from '~/utils';
import Mermaid, { MermaidErrorBoundary } from '~/components/Messages/Content/Mermaid';
import { useCodeBlockContext, useMediaContext } from '~/Providers';
import CodeBlock from '~/components/Messages/Content/CodeBlock';
import useHasAccess from '~/hooks/Roles/useHasAccess';
import { useFileDownload } from '~/data-provider';
import { useLocalize } from '~/hooks';
import store from '~/store';

type TCodeProps = {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
};

const isSingleLineCode = (children: React.ReactNode): boolean => {
  if (typeof children === 'string') {
    return !children.includes('\n');
  }
  if (Array.isArray(children)) {
    return children.every((child) => typeof child === 'string' && !child.includes('\n'));
  }
  return false;
};

export const code: React.ElementType = memo(function MarkdownCode({
  className,
  children,
}: TCodeProps) {
  const canRunCode = useHasAccess({
    permissionType: PermissionTypes.RUN_CODE,
    permission: Permissions.USE,
  });
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match && match[1];
  const isMath = lang === 'math';
  const isMermaid = lang === 'mermaid';
  const isSingleLine = isSingleLineCode(children);

  const { getNextIndex, getNextMermaidIndex, resetCounter } = useCodeBlockContext();
  const blockIndex = useRef(getNextIndex(isMath || isMermaid || isSingleLine)).current;
  /* Mermaid fences do not consume a code-block index, so every one of them in a
   * message would otherwise share `blockIndex` and collapse onto a single
   * artifact id. They carry their own sequence instead. */
  const mermaidIndex = useRef(isMermaid ? getNextMermaidIndex() : -1).current;

  useEffect(() => {
    resetCounter();
  }, [children, resetCounter]);

  if (isMath) {
    return <>{children}</>;
  } else if (isMermaid) {
    const content = typeof children === 'string' ? children : String(children);
    return (
      <MermaidErrorBoundary code={content}>
        <Mermaid id={`mermaid-${mermaidIndex}`}>{content}</Mermaid>
      </MermaidErrorBoundary>
    );
  } else if (isSingleLine) {
    return (
      <code onDoubleClick={handleDoubleClick} className={className}>
        {children}
      </code>
    );
  } else {
    return (
      <CodeBlock
        lang={lang ?? 'text'}
        codeChildren={children}
        blockIndex={blockIndex}
        allowExecution={canRunCode}
      />
    );
  }
});
code.displayName = 'MarkdownCode';

export const codeNoExecution: React.ElementType = memo(function MarkdownCodeNoExecution({
  className,
  children,
}: TCodeProps) {
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match && match[1];

  if (lang === 'math') {
    return children;
  } else if (lang === 'mermaid') {
    const content = typeof children === 'string' ? children : String(children);
    return <Mermaid>{content}</Mermaid>;
  } else if (isSingleLineCode(children)) {
    return (
      <code onDoubleClick={handleDoubleClick} className={className}>
        {children}
      </code>
    );
  } else {
    return <CodeBlock lang={lang ?? 'text'} codeChildren={children} allowExecution={false} />;
  }
});
codeNoExecution.displayName = 'MarkdownCodeNoExecution';

type TAnchorProps = {
  href: string;
  children: React.ReactNode;
};

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

const YouTubeCard = memo(function YouTubeCard({
  videoId,
  title,
  href,
}: {
  videoId: string;
  title: string;
  href: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    return (
      <div className="my-3 w-full max-w-xl overflow-hidden rounded-xl border border-border-light bg-black shadow-md">
        <div className="relative w-full pt-[56.25%]">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={title || 'YouTube video player'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-sky-500/30 bg-surface-secondary/80 shadow-md transition-all duration-200 hover:border-sky-500/60">
      <div
        className="group relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden bg-slate-900"
        onClick={() => setIsPlaying(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsPlaying(true);
          }
        }}
        title="Click to play interactive lesson video"
      >
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt={title || 'Video lesson preview'}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // Graceful fallback for networks where ytimg is restricted
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition-all duration-200 group-hover:scale-110 group-hover:bg-red-500">
          <Play className="ml-1 h-6 w-6 fill-white" />
        </div>
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs font-semibold text-white">
          <span className="truncate drop-shadow-md">📺 {title || 'Watch Video Lesson'}</span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-sky-300">YouTube</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs text-text-secondary">
        <span className="truncate">{title || 'Curated educational video lesson'}</span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 flex items-center gap-1 font-semibold text-sky-400 hover:underline shrink-0"
        >
          <span>Open in YouTube</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
});

export const a: React.ElementType = memo(function MarkdownAnchor({ href, children }: TAnchorProps) {
  const user = useRecoilValue(store.user);
  const { showToast } = useToastContext();
  const localize = useLocalize();

  const ytMatch = useMemo(() => href.match(YOUTUBE_REGEX), [href]);

  const {
    file_id = '',
    filename = '',
    filepath,
  } = useMemo(() => {
    const pattern = new RegExp(`(?:files|outputs)/${user?.id}/([^\\s]+)`);
    const match = href.match(pattern);
    if (match && match[0]) {
      const path = match[0];
      const parts = path.split('/');
      const name = parts.pop();
      const file_id = parts.pop();
      return { file_id, filename: name, filepath: path };
    }
    return { file_id: '', filename: '', filepath: '' };
  }, [user?.id, href]);

  const { refetch: downloadFile } = useFileDownload(user?.id ?? '', file_id, { direct: false });
  const props: { target?: string; onClick?: React.MouseEventHandler } = { target: '_blank' };

  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    let title = 'Educational Video Lesson';
    if (typeof children === 'string') {
      title = children;
    } else if (React.isValidElement(children)) {
      const childProps = children.props as { alt?: string; title?: string };
      title = childProps.alt || childProps.title || 'Educational Video Lesson';
    }
    return <YouTubeCard videoId={videoId} title={title} href={href} />;
  }

  if (!file_id || !filename) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  const handleDownload = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      const stream = await downloadFile();
      if (stream.data == null || stream.data === '') {
        console.error('Error downloading file: No data found');
        showToast({
          status: 'error',
          message: localize('com_ui_download_error'),
        });
        return;
      }
      triggerDownload(stream.data, filename);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  props.onClick = handleDownload;
  props.target = '_blank';

  const domainServerBaseUrl = `${apiBaseUrl()}/api`;

  return (
    <a
      href={
        filepath?.startsWith('files/')
          ? `${domainServerBaseUrl}/${filepath}`
          : `${domainServerBaseUrl}/files/${filepath}`
      }
      {...props}
    >
      {children}
    </a>
  );
});
a.displayName = 'MarkdownAnchor';

type TParagraphProps = {
  children: React.ReactNode;
};

export const p: React.ElementType = memo(function MarkdownParagraph({ children }: TParagraphProps) {
  return <p className="mb-2 whitespace-pre-wrap">{children}</p>;
});
p.displayName = 'MarkdownParagraph';

type TTableProps = {
  children: React.ReactNode;
};

export const table: React.ElementType = memo(function MarkdownTable({ children }: TTableProps) {
  return (
    <div className="markdown-table-wrapper w-full max-w-full">
      <table>{children}</table>
    </div>
  );
});
table.displayName = 'MarkdownTable';

type TImageProps = {
  src?: string;
  alt?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
};

export const img: React.ElementType = memo(function MarkdownImage({
  src,
  alt,
  title,
  className,
  style,
}: TImageProps) {
  // Get the base URL from the API endpoints
  const baseURL = apiBaseUrl();
  /** A model writing `![DTI](5_dti.png)` is naming a file its run produced,
   *  not a path the browser can fetch. Resolving the reference against the
   *  turn's attachments is what turns those into the chart instead of a
   *  broken-image glyph; an unmatched source keeps its original behavior. */
  const { attachmentsByName } = useMediaContext();

  const fixedSrc = useMemo(() => {
    if (!src) return src;
    const resolved = resolveInlineMedia(src, attachmentsByName)?.filepath ?? src;
    return toAbsoluteFilePath(resolved, baseURL);
  }, [src, baseURL, attachmentsByName]);

  // Clean, responsive styling for illustrations & diagrams so they do not overpower chat
  const combinedClassName = [
    'my-3 max-h-72 max-w-full md:max-w-md rounded-lg border border-border-light object-contain shadow-sm transition-all hover:opacity-95',
    className ?? '',
  ]
    .join(' ')
    .trim();

  return (
    <span className="block my-2 overflow-hidden">
      <img src={fixedSrc} alt={alt} title={title} className={combinedClassName} style={style} loading="lazy" />
      {alt && (
        <span className="block mt-1 text-xs text-text-secondary italic">
          {alt}
        </span>
      )}
    </span>
  );
});
img.displayName = 'MarkdownImage';
