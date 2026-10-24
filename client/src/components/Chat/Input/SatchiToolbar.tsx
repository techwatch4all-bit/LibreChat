import React, { memo, useCallback, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  TooltipAnchor,
  useToastContext,
} from '@librechat/client';
import {
  Globe,
  Brain,
  BrainCircuit,
  Wand2,
  Sparkles,
  Image as ImageIcon,
  HelpCircle,
  Layers,
  Network,
  Code2,
  Sigma,
  Lock,
  ChevronDown,
  Wrench,
  BookOpen,
} from 'lucide-react';
import {
  satchiModeAtom,
  satchiWebSearchAtom,
  satchiThinkAtom,
  satchiResearchAtom,
  satchiImageGenAtom,
  heuristicEnhance,
  generateStudyQuizPrompt,
  generateStudyFlashcardPrompt,
  generateMathRibbonPrompt,
  generateVibeCodingPrompt,
  generateMermaidDiagramPrompt,
} from '~/store/satchiStore';
import { Tools } from 'librechat-data-provider';
import { useLocalize, useAuthContext } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';
import SatchiUpgradeModal from './SatchiUpgradeModal';
import { cn } from '~/utils';

interface SatchiToolbarProps {
  getText?: () => string;
  setText?: (text: string) => void;
  disabled?: boolean;
}

function SatchiToolbar({ getText, setText, disabled = false }: SatchiToolbarProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { user } = useAuthContext();

  const mode = useAtomValue(satchiModeAtom);
  const [webSearch, setWebSearch] = useAtom(satchiWebSearchAtom);
  const [think, setThink] = useAtom(satchiThinkAtom);
  const [research, setResearch] = useAtom(satchiResearchAtom);
  const [imageGen, setImageGen] = useAtom(satchiImageGenAtom);

  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    feature: 'vibecoding' | 'research';
  }>({ open: false, feature: 'vibecoding' });

  // Plan entitlement check
  const isPro = Boolean(
    user?.role === 'ADMIN' ||
      ['pro', 'pro_family', 'enterprise'].includes(
        ((user as any)?.plan || (user as any)?.subscription || user?.role || '').toLowerCase(),
      ),
  );

  const isThinkingActive = think !== 'off';

  const badgeContext = useBadgeRowContext();

  const toggleWebSearch = useCallback(() => {
    if (disabled) return;
    setWebSearch((prev) => {
      const next = !prev;
      if (badgeContext?.webSearch?.debouncedChange) {
        // The hook's change handler takes the tool value, not a bare boolean.
        badgeContext.webSearch.debouncedChange({ value: next });
      }
      return next;
    });
  }, [disabled, setWebSearch, badgeContext]);

  const toggleThinking = useCallback(() => {
    if (disabled) return;
    setThink((prev) => (prev === 'off' ? 'medium' : 'off'));
  }, [disabled, setThink]);

  const toggleResearch = useCallback(() => {
    if (disabled) return;
    if (!isPro) {
      setUpgradeModal({ open: true, feature: 'research' });
      return;
    }
    setResearch((prev) => !prev);
  }, [disabled, isPro, setResearch]);

  const toggleImageGen = useCallback(() => {
    if (disabled) return;
    setImageGen((prev) => !prev);
  }, [disabled, setImageGen]);

  const handleEnhancePrompt = useCallback(() => {
    if (disabled || !getText || !setText) return;
    const current = getText();
    const enhanced = heuristicEnhance(current);
    setText(enhanced);
    showToast({
      message: current.trim()
        ? 'Prompt expanded to expert format!'
        : 'Loaded Satchida executive prompt template!',
      status: 'info',
    });
  }, [disabled, getText, setText, showToast]);

  // STUDY Quick-Tools
  const handleCreateQuiz = useCallback(() => {
    if (disabled || !getText || !setText) return;
    const current = getText();
    setText(generateStudyQuizPrompt(current));
    showToast({
      message: 'Generated Socratic Comprehension Quiz template!',
      status: 'info',
    });
  }, [disabled, getText, setText, showToast]);

  const handleCreateFlashcards = useCallback(() => {
    if (disabled || !getText || !setText) return;
    const current = getText();
    setText(generateStudyFlashcardPrompt(current));
    showToast({
      message: 'Generated Active Recall Flashcards template!',
      status: 'info',
    });
  }, [disabled, getText, setText, showToast]);

  const handleCreateDiagram = useCallback(() => {
    if (disabled || !getText || !setText) return;
    const current = getText();
    setText(generateMermaidDiagramPrompt(current));
    showToast({
      message: 'Generated Mermaid Architecture/Concept Diagram template!',
      status: 'info',
    });
  }, [disabled, getText, setText, showToast]);

  const handleCreateMathRibbon = useCallback(() => {
    if (disabled || !getText || !setText) return;
    const current = getText();
    setText(generateMathRibbonPrompt(current));
    showToast({
      message: 'Loaded KaTeX Formula & TeX Ribbon derivation template!',
      status: 'info',
    });
  }, [disabled, getText, setText, showToast]);

  // WORK Quick-Tools
  const handleVibeCoding = useCallback(() => {
    if (disabled || !getText || !setText) return;
    if (!isPro) {
      setUpgradeModal({ open: true, feature: 'vibecoding' });
      return;
    }
    const current = getText();
    setText(generateVibeCodingPrompt(current));
    showToast({
      message: 'Loaded Vibe-Coding Staff Architect Blueprint template!',
      status: 'info',
    });
  }, [disabled, getText, setText, showToast, isPro]);

  return (
    <>
      <div
        role="toolbar"
        aria-label="Satchida AI Assistant Controls"
        className={cn('flex items-center gap-1 shrink-0', disabled && 'pointer-events-none opacity-50')}
      >
        {/* 🌐 Web Search */}
        <TooltipAnchor
          description={
            webSearch
              ? 'Web Search Enabled (Live Web & News Knowledge)'
              : 'Web Search Disabled — Click to enable live web search'
          }
          side="top"
          render={
            <button
              type="button"
              aria-pressed={webSearch}
              aria-label="Toggle Web Search"
              disabled={disabled}
              onClick={toggleWebSearch}
              className={cn(
                'relative inline-flex h-8 w-8 items-center justify-center rounded-full border p-0 transition-all shadow-xs shrink-0',
                webSearch
                  ? 'border-sky-500/60 bg-sky-950/40 text-sky-400 ring-1 ring-sky-500/50'
                  : 'border-border-light bg-surface-secondary/70 text-text-secondary hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              <Globe className="h-4 w-4" />
            </button>
          }
        />

        {/* 🧠 Reasoning Toggle (Disabled by default) */}
        <TooltipAnchor
          description={
            isThinkingActive
              ? `Reasoning Active (${think}) — Click to turn off for fast instant response`
              : 'Reasoning Disabled (Fast Instant Responses) — Click to enable deep thinking'
          }
          side="top"
          render={
            <button
              type="button"
              aria-pressed={isThinkingActive}
              aria-label="Toggle Thinking Reasoning"
              disabled={disabled}
              onClick={toggleThinking}
              className={cn(
                'relative inline-flex h-8 w-8 items-center justify-center rounded-full border p-0 transition-all shadow-xs shrink-0',
                isThinkingActive
                  ? 'border-amber-500/60 bg-amber-950/40 text-amber-300 ring-1 ring-amber-500/50'
                  : 'border-border-light bg-surface-secondary/70 text-text-secondary hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              {isThinkingActive ? (
                <BrainCircuit className="h-4 w-4 text-amber-400 animate-pulse" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
            </button>
          }
        />

        {/* 🎨 Creative Tools Dropdown (Magic Prompt Enhancer, Deep Research, Image Gen) */}
        <DropdownMenu>
          <TooltipAnchor
            description="Assistant Capabilities (Enhance Prompt, Deep Research, Image Gen)"
            side="top"
            render={
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Assistant Capabilities"
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-full border border-border-light bg-surface-secondary/70 px-2 text-xs font-medium text-text-secondary shadow-xs transition-all',
                    'hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring',
                    (research || imageGen) && 'border-violet-500/50 bg-violet-950/20 text-violet-400',
                  )}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3 text-text-tertiary" />
                </button>
              </DropdownMenuTrigger>
            }
          />
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-60 rounded-xl border border-border-light bg-surface-primary p-1.5 shadow-xl"
          >
            {/* ✨ Magic Prompt Enhancer */}
            <DropdownMenuItem
              onClick={handleEnhancePrompt}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
            >
              <Wand2 className="h-4 w-4 text-violet-400 shrink-0" />
              <div>
                <div className="font-semibold text-text-primary">Enhance Prompt</div>
                <div className="text-[11px] text-text-secondary leading-tight">Expand draft to expert specification</div>
              </div>
            </DropdownMenuItem>

            {/* 🔬 Deep Research */}
            <DropdownMenuItem
              onClick={toggleResearch}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
            >
              <div className="relative shrink-0">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                {!isPro && <Lock className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-500" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">Deep Research</span>
                  {research && <span className="text-[10px] text-indigo-400 font-medium">ON</span>}
                </div>
                <div className="text-[11px] text-text-secondary leading-tight">Exhaustive multi-angle intelligence dossier</div>
              </div>
            </DropdownMenuItem>

            {/* 🖼️ Image Generation */}
            <DropdownMenuItem
              onClick={toggleImageGen}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
            >
              <ImageIcon className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">Image Generation</span>
                  {imageGen && <span className="text-[10px] text-emerald-400 font-medium">ON</span>}
                </div>
                <div className="text-[11px] text-text-secondary leading-tight">Photorealistic visual synthesis</div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 📚 STUDY / WORK MODE SPECIALIZED TOOLS DROPDOWN */}
        {(mode === 'Study' || mode === 'Work') && (
          <DropdownMenu>
            <TooltipAnchor
              description={mode === 'Study' ? 'Study Studio Tools (Quiz, Flashcards, Formulas)' : 'Work Studio Tools (Vibe-Coding, Architecture)'}
              side="top"
              render={
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`${mode} Studio Tools`}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium shadow-xs transition-all',
                      mode === 'Study'
                        ? 'border-sky-500/40 bg-sky-950/20 text-sky-400 hover:border-sky-500 hover:bg-sky-950/40'
                        : 'border-teal-500/40 bg-teal-950/20 text-teal-400 hover:border-teal-500 hover:bg-teal-950/40',
                    )}
                  >
                    {mode === 'Study' ? <BookOpen className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                    <span>{mode === 'Study' ? 'Study Studio' : 'Work Studio'}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
              }
            />
            <DropdownMenuContent
              align="start"
              side="top"
              className="w-64 rounded-xl border border-border-light bg-surface-primary p-1.5 shadow-xl"
            >
              {mode === 'Study' && (
                <>
                  {/* Quiz Generator */}
                  <DropdownMenuItem
                    onClick={handleCreateQuiz}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
                  >
                    <HelpCircle className="h-4 w-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-text-primary">Create Socratic Quiz</div>
                      <div className="text-[11px] text-text-secondary leading-tight">5-question quiz with spoiler answers</div>
                    </div>
                  </DropdownMenuItem>

                  {/* Flashcards */}
                  <DropdownMenuItem
                    onClick={handleCreateFlashcards}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
                  >
                    <Layers className="h-4 w-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-text-primary">Generate Flashcards</div>
                      <div className="text-[11px] text-text-secondary leading-tight">8 spaced-repetition active recall cards</div>
                    </div>
                  </DropdownMenuItem>

                  {/* Concept Diagram */}
                  <DropdownMenuItem
                    onClick={handleCreateDiagram}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
                  >
                    <Network className="h-4 w-4 text-teal-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-text-primary">Concept Diagram</div>
                      <div className="text-[11px] text-text-secondary leading-tight">Syntactically valid Mermaid flowchart</div>
                    </div>
                  </DropdownMenuItem>

                  {/* KaTeX Math / Physics Ribbon */}
                  <DropdownMenuItem
                    onClick={handleCreateMathRibbon}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
                  >
                    <Sigma className="h-4 w-4 text-rose-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-text-primary">Formula & TeX Ribbon</div>
                      <div className="text-[11px] text-text-secondary leading-tight">Rigorous KaTeX mathematical derivations</div>
                    </div>
                  </DropdownMenuItem>
                </>
              )}

              {mode === 'Work' && (
                <>
                  {/* Architecture Diagram */}
                  <DropdownMenuItem
                    onClick={handleCreateDiagram}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
                  >
                    <Network className="h-4 w-4 text-teal-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-text-primary">Architecture Diagram</div>
                      <div className="text-[11px] text-text-secondary leading-tight">System architecture Mermaid diagram</div>
                    </div>
                  </DropdownMenuItem>

                  {/* Vibe-Coding */}
                  <DropdownMenuItem
                    onClick={handleVibeCoding}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover outline-hidden"
                  >
                    <div className="relative shrink-0">
                      <Code2 className="h-4 w-4 text-emerald-400" />
                      {!isPro && <Lock className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-500" />}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary">Vibe-Coding</div>
                      <div className="text-[11px] text-text-secondary leading-tight">Staff engineer full-stack scaffolding</div>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Upgrade Upsell Modal */}
      <SatchiUpgradeModal
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal((prev) => ({ ...prev, open }))}
        featureName={upgradeModal.feature}
      />
    </>
  );
}

export default memo(SatchiToolbar);
