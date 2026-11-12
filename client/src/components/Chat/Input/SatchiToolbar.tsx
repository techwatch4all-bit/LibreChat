import React, { memo, useCallback, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Tools } from 'librechat-data-provider';
import { Constants } from 'librechat-data-provider';
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
  FlaskConical,
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
  FolderLock,
  FileText,
  Presentation,
  Table2,
  SlidersHorizontal,
  Film,
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
import { useBadgeRowContext, useChatContext } from '~/Providers';
import { useLocalize, useAuthContext } from '~/hooks';
import SatchiUpgradeModal from './SatchiUpgradeModal';
import { mcpValuesAtomFamily } from '~/store/mcp';
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
  const { conversation } = useChatContext();
  const convoKey = conversation?.conversationId ?? Constants.NEW_CONVO;
  const [, setMCPValues] = useAtom(mcpValuesAtomFamily(convoKey));

  const toggleWebSearch = useCallback(() => {
    if (disabled) return;
    setWebSearch((prev) => {
      const next = !prev;
      if (badgeContext?.webSearch?.debouncedChange) {
        badgeContext.webSearch.debouncedChange({ value: next });
      }
      // Also sync MCP server selection for web search & fetch so model doesn't invoke search when toggled off
      if (!next) {
        setMCPValues((current = []) =>
          current.filter((s) => s !== 'satchida-web-search' && s !== 'web-fetch'),
        );
        if (badgeContext?.mcpServerManager?.setMCPValues) {
          const curr = badgeContext.mcpServerManager.mcpValues ?? [];
          badgeContext.mcpServerManager.setMCPValues(
            curr.filter((s) => s !== 'satchida-web-search' && s !== 'web-fetch'),
          );
        }
      } else {
        setMCPValues((current = []) => Array.from(new Set([...current, 'satchida-web-search'])));
        if (badgeContext?.mcpServerManager?.setMCPValues) {
          const curr = badgeContext.mcpServerManager.mcpValues ?? [];
          badgeContext.mcpServerManager.setMCPValues(
            Array.from(new Set([...curr, 'satchida-web-search'])),
          );
        }
      }
      return next;
    });
  }, [disabled, setWebSearch, badgeContext, setMCPValues]);

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
    setResearch((prev) => {
      const next = !prev;
      if (next) {
        // Auto-enable web search and inject necessary MCP servers for research & file generation
        setWebSearch(true);
        if (badgeContext?.webSearch?.debouncedChange) {
          badgeContext.webSearch.debouncedChange({ value: true });
        }
        setMCPValues((current = []) =>
          Array.from(
            new Set([
              ...current,
              'satchida-web-search',
              'satchida-knowledge-vault',
              'academic-search',
              'arxiv-search',
            ]),
          ),
        );
        if (badgeContext?.mcpServerManager?.setMCPValues) {
          const curr = badgeContext.mcpServerManager.mcpValues ?? [];
          badgeContext.mcpServerManager.setMCPValues(
            Array.from(
              new Set([
                ...curr,
                'satchida-web-search',
                'satchida-knowledge-vault',
                'academic-search',
                'arxiv-search',
              ]),
            ),
          );
        }
        showToast({
          message:
            '🔬 HyperResearch Active: 6-phase deep sweep, contradiction matrix & PDF dossier enabled!',
          status: 'info',
        });
      } else {
        showToast({
          message: 'Deep Research deactivated.',
          status: 'info',
        });
      }
      return next;
    });
  }, [disabled, isPro, setResearch, setWebSearch, badgeContext, setMCPValues, showToast]);

  const handleApplyPersonaPrompt = useCallback(
    (prefix: string, label: string) => {
      if (disabled || !getText || !setText) return;
      const current = getText();
      const combined = current.trim() ? `${prefix}\n\nUser Task: ${current}` : prefix;
      setText(combined);
      showToast({
        message: `Applied ${label} specification!`,
        status: 'info',
      });
    },
    [disabled, getText, setText, showToast],
  );

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

  // Knowledge Vault & Document Synthesis Quick-Tools
  const handleDocSynthesis = useCallback(
    (format: 'pdf' | 'docx' | 'xlsx' | 'pptx') => {
      if (disabled || !getText || !setText) return;
      const current = getText();
      const formatNames = {
        pdf: 'Executive PDF Report',
        docx: 'Formatted Word Document (.docx)',
        xlsx: 'Financial/Data Spreadsheet (.xlsx)',
        pptx: 'Presentation Slide Deck (.pptx)',
      };
      const instructions = {
        pdf: `Generate a comprehensive, professionally formatted Executive Report as a PDF file named "Executive_Report_${Date.now()}.pdf". Ingest it into my private AnythingLLM vault upon completion. Body context:\n${current || 'Provide strategic industry analysis, SWOT evaluation, and executive milestones.'}`,
        docx: `Compile a complete Microsoft Word document (.docx) named "Project_Brief_${Date.now()}.docx" with structured headings, executive summary, and bullet points based on the following:\n${current || 'Scope of work, technical architecture, and risk mitigations.'}`,
        xlsx: `Build an Excel spreadsheet (.xlsx) named "Financial_Model_${Date.now()}.xlsx" with clean tabular matrix data, column headers, and financial summaries for:\n${current || 'Quarterly revenue, operational expenses, and net profit projections.'}`,
        pptx: `Create a PowerPoint slide presentation (.pptx) named "Pitch_Deck_${Date.now()}.pptx" with a title slide and structured bullet slides detailing:\n${current || 'Problem statement, proposed AI solution, system architecture, and go-to-market plan.'}`,
      };
      setText(instructions[format]);
      showToast({
        message: `Prepared ${formatNames[format]} prompt for AnythingLLM engine!`,
        status: 'info',
      });
    },
    [disabled, getText, setText, showToast],
  );

  const handleVaultSearch = useCallback(() => {
    if (disabled || !getText || !setText) return;
    const current = getText();
    setText(
      `Query my AnythingLLM private knowledge vault using semantic RAG for: "${current || 'latest uploaded reports and documentation'}" and synthesize the answer with exact source citations.`,
    );
    showToast({
      message: 'Configured Knowledge Vault RAG query!',
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
        className={cn(
          'flex shrink-0 items-center gap-1',
          disabled && 'pointer-events-none opacity-50',
        )}
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
                'shadow-xs relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border p-0 transition-all',
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
                'shadow-xs relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border p-0 transition-all',
                isThinkingActive
                  ? 'border-amber-500/60 bg-amber-950/40 text-amber-300 ring-1 ring-amber-500/50'
                  : 'border-border-light bg-surface-secondary/70 text-text-secondary hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              {isThinkingActive ? (
                <BrainCircuit className="h-4 w-4 animate-pulse text-amber-400" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
            </button>
          }
        />

        {/* 🔬 Sovereign HyperResearch Toggle Button */}
        <TooltipAnchor
          description={
            research
              ? 'HyperResearch Active (Exhaustive 6-Phase Investigation, Contradiction Analysis & PDF Dossier) — Click to disable'
              : 'Deep Research / HyperResearch — Click to enable autonomous deep investigation & PDF dossier creation'
          }
          side="top"
          render={
            <button
              type="button"
              aria-pressed={research}
              aria-label="Toggle Deep Research / HyperResearch"
              disabled={disabled}
              onClick={toggleResearch}
              className={cn(
                'shadow-xs relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-all',
                research
                  ? 'border-indigo-500/70 bg-indigo-950/40 text-indigo-300 shadow-indigo-500/20 ring-1 ring-indigo-500/50'
                  : 'border-border-light bg-surface-secondary/70 text-text-secondary hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary',
              )}
            >
              <div className="relative flex items-center">
                <FlaskConical
                  className={cn(
                    'h-3.5 w-3.5',
                    research ? 'text-indigo-400' : 'text-text-secondary',
                  )}
                />
                {!isPro && (
                  <Lock className="absolute -right-2 -top-1.5 h-2.5 w-2.5 text-amber-500" />
                )}
              </div>
              <span className="hidden sm:inline">Research</span>
              {research && (
                <span className="flex h-1.5 w-1.5 animate-ping rounded-full bg-indigo-400" />
              )}
            </button>
          }
        />

        {/* 🎨 Prompt Enhancement & Creative Tools Dropdown */}
        <DropdownMenu>
          <TooltipAnchor
            description="Prompt Enhancer & Creative Tools (Auto-Structure, Code Blueprint, Image Gen)"
            side="top"
            render={
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Prompt Enhancer & Creative Tools"
                  className={cn(
                    'shadow-xs inline-flex h-8 items-center gap-1 rounded-full border border-border-light bg-surface-secondary/70 px-2 text-xs font-medium text-text-secondary transition-all',
                    'focus-visible:outline-hidden focus-visible:ring-ring hover:border-border-medium hover:bg-surface-tertiary hover:text-text-primary focus-visible:ring-1',
                    imageGen && 'border-emerald-500/50 bg-emerald-950/20 text-emerald-400',
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
            className="w-68 select-none rounded-xl border border-border-light bg-surface-primary p-1.5 shadow-xl"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Prompt Enhancement
            </div>

            {/* ✨ Magic Auto-Enhance */}
            <DropdownMenuItem
              onClick={handleEnhancePrompt}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Wand2 className="h-4 w-4 shrink-0 text-violet-400" />
              <div>
                <div className="font-semibold text-text-primary">Auto-Enhance Draft</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Deconstruct into executive specification
                </div>
              </div>
            </DropdownMenuItem>

            {/* 🏗️ Architecture & Blueprint Formatter */}
            <DropdownMenuItem
              onClick={() =>
                handleApplyPersonaPrompt(
                  'Act as a Principal Staff Architect. Deconstruct the requirements from first principles into: (1) System Architecture & Component Diagram (```mermaid), (2) Failure Modes & Edge-Case Bottlenecks, (3) Data Flow & Concurrency Trade-Offs, and (4) Production Implementation Checklist.',
                  'Staff Architect Blueprint',
                )
              }
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-sky-400" />
              <div>
                <div className="font-semibold text-text-primary">Architectural Blueprint</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  First-principles system & trade-off spec
                </div>
              </div>
            </DropdownMenuItem>

            {/* 🔍 Critical Review & Edge-Case Auditor */}
            <DropdownMenuItem
              onClick={() =>
                handleApplyPersonaPrompt(
                  'Perform an exhaustive, adversarial peer-review of the following proposal/code: (1) Identify top 3 fatal assumptions or race conditions, (2) Benchmark performance regressions, (3) Security vulnerabilities & data leak vectors, and (4) Concrete refactored recommendations.',
                  'Adversarial Reviewer',
                )
              }
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <div className="font-semibold text-text-primary">Adversarial Reviewer</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Stress-test for fatal bugs & security holes
                </div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border-light/60" />

            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Creative Tools
            </div>

            {/* 🖼️ Image Generation */}
            <DropdownMenuItem
              onClick={toggleImageGen}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <ImageIcon className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">Image Generation</span>
                  {imageGen && <span className="text-[10px] font-medium text-emerald-400">ON</span>}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Photorealistic visual synthesis mode
                </div>
              </div>
            </DropdownMenuItem>

            {/* 🎬 Satchida Motion Animation */}
            <DropdownMenuItem
              onClick={() =>
                handleApplyPersonaPrompt(
                  'Act as an elite Motion Graphics Director. Transform the following report, document, or concept into a cinema-grade, single-file HTML motion graphic artifact using Satchida-Motion (HTML5, GSAP 3, fluid camera moves, kinetic typography, window.__TIMELINE__, and bottom playback scrubber). Never output static presentation slides or bullet points.',
                  'Satchida Motion Studio',
                )
              }
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Film className="h-4 w-4 shrink-0 text-violet-400" />
              <div>
                <div className="font-semibold text-text-primary">Satchida Motion Animation</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Interactive GSAP kinetic presentation & explainer
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 🏛️ Satchida Knowledge Vault (AnythingLLM MCP Trigger) */}
        <DropdownMenu>
          <TooltipAnchor
            description="Knowledge Vault (AnythingLLM Vector Search & Multi-Format Document Generation)"
            side="top"
            render={
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label="Knowledge Vault & Document Generation"
                  className={cn(
                    'shadow-xs inline-flex h-8 items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-950/20 px-2.5 text-xs font-medium text-purple-400 transition-all',
                    'focus-visible:outline-hidden focus-visible:ring-ring hover:border-purple-500 hover:bg-purple-950/40 hover:text-purple-300 focus-visible:ring-1',
                  )}
                >
                  <FolderLock className="h-3.5 w-3.5 text-purple-400" />
                  <span className="font-semibold">Vault</span>
                  <ChevronDown className="h-3 w-3 text-purple-400/70" />
                </button>
              </DropdownMenuTrigger>
            }
          />
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-68 select-none rounded-xl border border-border-light bg-surface-primary p-1.5 shadow-xl"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              AnythingLLM Sovereign Vault
            </div>

            {/* 🔍 Query Vault RAG */}
            <DropdownMenuItem
              onClick={handleVaultSearch}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <FolderLock className="h-4 w-4 shrink-0 text-purple-400" />
              <div>
                <div className="font-semibold text-text-primary">Search Knowledge Vault</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Semantic RAG & verified source citations
                </div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border-light/60" />

            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Generate Formatted Document
            </div>

            {/* 📄 PDF Report */}
            <DropdownMenuItem
              onClick={() => handleDocSynthesis('pdf')}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <FileText className="h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <div className="font-semibold text-text-primary">Generate PDF Report</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  ReportLab typographical layout
                </div>
              </div>
            </DropdownMenuItem>

            {/* 📊 PPTX Slides */}
            <DropdownMenuItem
              onClick={() => handleDocSynthesis('pptx')}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Presentation className="h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <div className="font-semibold text-text-primary">Generate PPTX Deck</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Multi-slide presentation deck
                </div>
              </div>
            </DropdownMenuItem>

            {/* 📈 Excel Spreadsheet */}
            <DropdownMenuItem
              onClick={() => handleDocSynthesis('xlsx')}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Table2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <div className="font-semibold text-text-primary">Generate Excel (.xlsx)</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Formatted data rows & formulas
                </div>
              </div>
            </DropdownMenuItem>

            {/* 📝 Word Document */}
            <DropdownMenuItem
              onClick={() => handleDocSynthesis('docx')}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <FileText className="h-4 w-4 shrink-0 text-blue-400" />
              <div>
                <div className="font-semibold text-text-primary">Generate Word (.docx)</div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Styled Microsoft Word document
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 📚 STUDY / WORK MODE SPECIALIZED TOOLS DROPDOWN */}
        {(mode === 'Study' || mode === 'Work') && (
          <DropdownMenu>
            <TooltipAnchor
              description={
                mode === 'Study'
                  ? 'Study Studio Tools (Quiz, Flashcards, Formulas)'
                  : 'Work Studio Tools (Vibe-Coding, Architecture)'
              }
              side="top"
              render={
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`${mode} Studio Tools`}
                    className={cn(
                      'shadow-xs inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all',
                      mode === 'Study'
                        ? 'border-sky-500/40 bg-sky-950/20 text-sky-400 hover:border-sky-500 hover:bg-sky-950/40'
                        : 'border-teal-500/40 bg-teal-950/20 text-teal-400 hover:border-teal-500 hover:bg-teal-950/40',
                    )}
                  >
                    {mode === 'Study' ? (
                      <BookOpen className="h-3.5 w-3.5" />
                    ) : (
                      <Wrench className="h-3.5 w-3.5" />
                    )}
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
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <HelpCircle className="h-4 w-4 shrink-0 text-sky-400" />
                    <div>
                      <div className="font-semibold text-text-primary">Create Socratic Quiz</div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        5-question quiz with spoiler answers
                      </div>
                    </div>
                  </DropdownMenuItem>

                  {/* Flashcards */}
                  <DropdownMenuItem
                    onClick={handleCreateFlashcards}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <Layers className="h-4 w-4 shrink-0 text-purple-400" />
                    <div>
                      <div className="font-semibold text-text-primary">Generate Flashcards</div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        8 spaced-repetition active recall cards
                      </div>
                    </div>
                  </DropdownMenuItem>

                  {/* Concept Diagram */}
                  <DropdownMenuItem
                    onClick={handleCreateDiagram}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <Network className="h-4 w-4 shrink-0 text-teal-400" />
                    <div>
                      <div className="font-semibold text-text-primary">Concept Diagram</div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        Syntactically valid Mermaid flowchart
                      </div>
                    </div>
                  </DropdownMenuItem>

                  {/* KaTeX Math / Physics Ribbon */}
                  <DropdownMenuItem
                    onClick={handleCreateMathRibbon}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <Sigma className="h-4 w-4 shrink-0 text-rose-400" />
                    <div>
                      <div className="font-semibold text-text-primary">Formula & TeX Ribbon</div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        Rigorous KaTeX mathematical derivations
                      </div>
                    </div>
                  </DropdownMenuItem>
                </>
              )}

              {mode === 'Work' && (
                <>
                  {/* Architecture Diagram */}
                  <DropdownMenuItem
                    onClick={handleCreateDiagram}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <Network className="h-4 w-4 shrink-0 text-teal-400" />
                    <div>
                      <div className="font-semibold text-text-primary">Architecture Diagram</div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        System architecture Mermaid diagram
                      </div>
                    </div>
                  </DropdownMenuItem>

                  {/* Vibe-Coding */}
                  <DropdownMenuItem
                    onClick={handleVibeCoding}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <div className="relative shrink-0">
                      <Code2 className="h-4 w-4 text-emerald-400" />
                      {!isPro && (
                        <Lock className="absolute -right-1 -top-1 h-2.5 w-2.5 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary">Vibe-Coding</div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        Staff engineer full-stack scaffolding
                      </div>
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
