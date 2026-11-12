import React, { memo, useCallback } from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { useSubmitMessage } from '~/hooks';
import { useChatFormContext, useMessageContext } from '~/Providers';
import { mainTextareaId } from '~/common';
import { forceResize } from '~/utils/textarea';

type SuggestedQuestionsProps = {
  questions: string[];
};

export const SuggestedQuestions = memo(function SuggestedQuestions({
  questions,
}: SuggestedQuestionsProps) {
  const { submitMessage } = useSubmitMessage();
  const methods = useChatFormContext();
  const { isSubmitting = false } = useMessageContext() ?? {};

  const handleQuestionClick = useCallback(
    (questionText: string) => {
      const cleanPrompt = questionText.trim();
      if (!cleanPrompt) return;

      const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.value = cleanPrompt;
        if (methods?.setValue) {
          methods.setValue('text', cleanPrompt, { shouldDirty: true, shouldValidate: true });
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        forceResize(textarea);
        textarea.focus();
      }

      if (!isSubmitting) {
        submitMessage({ text: cleanPrompt });
      }
    },
    [isSubmitting, methods, submitMessage],
  );

  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-3 border-t border-border-light/60 flex flex-col gap-2.5 not-prose">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary select-none">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Suggested Follow-up Questions</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
        {questions.map((question, idx) => (
          <button
            key={`sq-${idx}`}
            type="button"
            onClick={() => handleQuestionClick(question)}
            title={`Ask: "${question}"`}
            className="group relative flex items-center justify-between gap-2.5 rounded-xl border border-border-light bg-surface-secondary/60 hover:bg-surface-secondary px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium text-text-primary transition-all duration-200 hover:border-border-medium hover:shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <span className="flex-1 line-clamp-2 leading-snug">{question}</span>
            <ArrowUpRight className="w-4 h-4 text-text-tertiary group-hover:text-text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-150 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
});

export default SuggestedQuestions;
