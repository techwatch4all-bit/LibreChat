import React, { memo, useMemo, useRef, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { getRemarkPlugins, getRehypePlugins, getMarkdownComponents } from './markdownConfig';
import { normalizeArtifactDirectives } from '~/utils/artifactDirective';
import useSmoothStreaming from '~/hooks/Messages/useSmoothStreaming';
import MarkdownErrorBoundary from './MarkdownErrorBoundary';
import SuggestedQuestions from './SuggestedQuestions';
import { FADE_HYDRATION_THRESHOLD } from './animate';
import { useMessageContext } from '~/Providers';
import MarkdownBlocks from './MarkdownBlocks';
import store from '~/store';

type TContentProps = {
  content: string;
  isLatestMessage: boolean;
};

const SUGGESTED_QUESTIONS_REGEX =
  /(?:^|\n)(?:[-*_]{3,}\s*\n)?\s*(?:#{1,4}\s*)?(?:\*\*)?(?:[\p{Emoji}\p{Extended_Pictographic}\u25A0-\u2BFF\s]*)(?:Suggested\s+(?:Next\s+|Follow-up\s+)?Questions?|Follow-up\s+Questions?|Next\s+Questions?|Related\s+Questions?)(?:\*\*)?:?[^\n]*\n([\s\S]*)$/iu;

const Markdown = memo(function Markdown({ content = '', isLatestMessage }: TContentProps) {
  const { isSubmitting = false } = useMessageContext() ?? {};
  const smoothStreaming = useSmoothStreaming();
  const LaTeXParsing = useRecoilValue<boolean>(store.LaTeXParsing);
  const isInitializing = content === '';

  const { mainContent, questions } = useMemo(() => {
    if (!content) return { mainContent: '', questions: [] };
    const match = content.match(SUGGESTED_QUESTIONS_REGEX);
    if (!match) return { mainContent: normalizeArtifactDirectives(content), questions: [] };

    let main = content.slice(0, match.index).trim();
    main = main.replace(/(?:^|\n)[-*_]{3,}\s*$/g, '').trim();
    const rawQuestions = match[1];
    const rawLines = rawQuestions.split('\n');
    const questionLines: string[] = [];
    const trailingLines: string[] = [];
    let inQuestions = true;

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (inQuestions) {
        if (/^[-*•\u2022]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
          questionLines.push(trimmed);
        } else if (trimmed === '') {
          continue;
        } else {
          inQuestions = false;
          trailingLines.push(line);
        }
      } else {
        trailingLines.push(line);
      }
    }

    const parsed = questionLines
      .map((line) =>
        line
          .replace(/^[\s*\d.•\u2022()–—-]+\s*/u, '')
          .replace(/^\[|\]$/g, '')
          .replace(/^\*\*|\*\*$/g, '')
          .trim(),
      )
      .filter((q) => q.length > 3 && !/^(?:Note|Disclaimer|Warning):/i.test(q));

    if (trailingLines.length > 0) {
      const trailingText = trailingLines.join('\n').trim();
      if (trailingText) {
        main = main ? `${main}\n\n${trailingText}` : trailingText;
      }
    }

    return { mainContent: normalizeArtifactDirectives(main), questions: parsed };
  }, [content]);

  const streaming = isLatestMessage && isSubmitting;
  const animate = smoothStreaming && streaming;

  // Hydration signal for the fade: substantial content already present at the
  // render where `animate` flips on means resumed/switched-to/follow-up
  // content, which becomes the fade baseline instead of re-animating. The flag
  // is cleared after that render commits, so blocks mounting later in the same
  // stream (new paragraphs, however large) always animate.
  const prevAnimateRef = useRef(false);
  const hydratedRef = useRef(false);
  if (animate && !prevAnimateRef.current) {
    hydratedRef.current = content.length > FADE_HYDRATION_THRESHOLD;
  }
  prevAnimateRef.current = animate;
  useEffect(() => {
    if (animate) {
      hydratedRef.current = false;
    }
  }, [animate]);

  if (isInitializing) {
    return (
      <div className="absolute">
        <p className="relative">
          <span className={isLatestMessage ? 'result-thinking' : ''} />
        </p>
      </div>
    );
  }

  return (
    <MarkdownErrorBoundary content={content} codeExecution={true}>
      <MarkdownBlocks
        content={mainContent}
        streaming={streaming && questions.length === 0}
        remarkPlugins={getRemarkPlugins(LaTeXParsing)}
        rehypePlugins={getRehypePlugins()}
        components={getMarkdownComponents()}
        animate={animate}
        hydrated={hydratedRef.current}
      />
      {questions.length > 0 && <SuggestedQuestions questions={questions} />}
    </MarkdownErrorBoundary>
  );
});
Markdown.displayName = 'Markdown';

export default Markdown;
