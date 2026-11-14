import React, { memo, useState } from 'react';
import type { TFlashcard } from '~/utils/flashcards';
import { useLocalize } from '~/hooks';

type TFlashcardsProps = {
  cards: TFlashcard[];
};

const SingleCard = memo(function SingleCard({ card }: { card: TFlashcard }) {
  const localize = useLocalize();
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="group relative h-48 w-full cursor-pointer select-none [perspective:1000px]"
      onClick={() => setFlipped((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlipped((prev) => !prev);
        }
      }}
      aria-label={`${card.cardNum}: ${flipped ? card.back : card.front}`}
    >
      <div
        className={`relative h-full w-full rounded-xl shadow-sm transition-all duration-500 [transform-style:preserve-3d] hover:shadow-md ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Front Face */}
        <div className="absolute inset-0 flex flex-col justify-between rounded-xl border border-sky-500/20 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950/40 p-4 text-slate-100 [backface-visibility:hidden]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
              🎴 {card.cardNum}
            </span>
            <span className="text-[11px] text-slate-400 transition-colors group-hover:text-sky-300">
              {localize('com_satchida_flashcard_click_to_flip')}
            </span>
          </div>
          <div className="my-auto py-2 text-center text-sm font-medium leading-snug text-slate-100 md:text-base">
            {card.front}
          </div>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all group-hover:border-sky-500/40 group-hover:text-white">
              <span>{localize('com_satchida_flashcard_tap_to_reveal')}</span>
              <span className="text-xs">{localize('com_satchida_flashcard_arrow')}</span>
            </span>
          </div>
        </div>

        {/* Back Face */}
        <div className="absolute inset-0 flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950/40 p-4 text-slate-100 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              {localize('com_satchida_flashcard_core_takeaway')}
            </span>
            <span className="text-[11px] text-slate-400 transition-colors group-hover:text-emerald-300">
              {localize('com_satchida_flashcard_flip_back')}
            </span>
          </div>
          <div className="my-auto max-h-[105px] overflow-y-auto py-1 text-center text-xs font-normal leading-relaxed text-emerald-50 md:text-sm">
            {card.back}
          </div>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-1 text-[11px] font-medium text-emerald-300 group-hover:border-emerald-400">
              <span>{localize('com_satchida_flashcard_active_recall')}</span>
              <span className="text-xs">{localize('com_satchida_flashcard_check')}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

const Flashcards = memo(function Flashcards({ cards }: TFlashcardsProps) {
  const localize = useLocalize();
  if (!cards || cards.length === 0) return null;

  return (
    <div className="my-4 rounded-2xl border border-slate-700/40 bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-200 md:text-sm">
          <span>🎴</span>
          <span>{localize('com_satchida_flashcard_interactive_title')}</span>
        </h4>
        <span className="text-[11px] text-slate-400">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <SingleCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
});

Flashcards.displayName = 'Flashcards';

export default Flashcards;
