import React, { memo, useMemo, useRef, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { getRemarkPlugins, getRehypePlugins, getMarkdownComponents } from './markdownConfig';
import { normalizeArtifactDirectives } from '~/utils/artifactDirective';
import { parseSuggestedQuestions } from '~/utils/suggestedQuestions';
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

const Markdown = memo(function Markdown({ content = '', isLatestMessage }: TContentProps) {
  const { isSubmitting = false } = useMessageContext() ?? {};
  const smoothStreaming = useSmoothStreaming();
  const LaTeXParsing = useRecoilValue<boolean>(store.LaTeXParsing);
  const isInitializing = content === '';

  const { mainContent, questions } = useMemo(() => {
    if (!content) return { mainContent: '', questions: [] };
    const parsed = parseSuggestedQuestions(content);
    return {
      mainContent: normalizeArtifactDirectives(parsed.mainContent),
      questions: parsed.questions,
    };
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
