import React, { memo, useCallback, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useSetRecoilState } from 'recoil';
import store from '~/store';
import {
  UNIVER_SHEET_MIME,
  UNIVER_DOC_MIME,
  excelBufferToUniverSnapshot,
  docxBufferToUniverDocSnapshot,
} from '~/components/Artifacts/Univer';
import { SATCHIDA_FILM_ARTIFACT_TYPE } from '~/common/artifacts';
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
  Volume2,
  Table2,
  SlidersHorizontal,
  Film,
  Video,
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
        (
          (user as any)?.plan ||
          (user as any)?.accountType ||
          (user as any)?.subscription ||
          user?.role ||
          ''
        ).toLowerCase(),
      ),
  );

  const isThinkingActive = think !== 'off';

  const badgeContext = useBadgeRowContext();
  const { conversation } = useChatContext();
  const convoKey = conversation?.conversationId ?? Constants.NEW_CONVO;
  const [, setMCPValues] = useAtom(mcpValuesAtomFamily(convoKey));

  const setArtifacts = useSetRecoilState(store.artifactsState);
  const setCurrentArtifactId = useSetRecoilState(store.currentArtifactId);
  const setArtifactsVisible = useSetRecoilState(store.artifactsVisibility);

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
        pdf: `Generate an authoritative, publication-grade Visual Report as a PDF file named "Learning_Dossier_${Date.now()}.pdf". Follow the Satchida Gold Standard:
1. Executive Header & Core Concept Analogy (highlighted in a > callout block)
2. Detailed Technical Breakdown & Mathematical Equations (clean formulas)
3. Multi-Modal Diagram Embeds: MUST include relevant Markdown images: ![Figure Caption](/assets/study/media/...)
4. Structured Comparative Matrix Table (| Parameter | Category A | Category B |)
5. Real-Life Use Cases & Hardware Devices Section
6. Further Reading & Authoritative Reference Sources with clickable Markdown links
Ingest into my private AnythingLLM vault upon completion. Context:\n${current || 'Topic analysis, comparative architecture, and verified reference sources.'}`,
        docx: `Compile an exhaustive, professionally formatted Microsoft Word document (.docx) named "Technical_Brief_${Date.now()}.docx". Include structured numbered headings (#, ##, ###), an executive summary callout block (> ...), full data comparison tables, embedded visual diagrams (![Figure](/assets/study/media/...)), practical device implementations, and curated reference citations based on:\n${current || 'Technical specification, architectural trade-offs, and verified evidence.'}`,
        xlsx: `Build an Excel spreadsheet (.xlsx) named "Data_Matrix_${Date.now()}.xlsx" with clean tabular matrix data, formatted column headers, numerical formulas, and categorized summaries for:\n${current || 'Quantitative benchmark data, performance metrics, and comparison parameters.'}`,
        pptx: `Create an executive, visual presentation slide deck (.pptx) in 16:9 widescreen layout named "Presentation_Deck_${Date.now()}.pptx". Strictly enforce rich content density across every slide (no empty containers):
- Separate every slide with '---'
- Slide 1: Hero Title Slide with kicker subtitle and metadata
- Slide 2: Core Concept & Intuition (use :::cards with 3 distinct '### Card Title' pillars and 2-3 bullets each)
- Slide 3: Comparative Trade-Off Matrix (use :::comparison with left and right cards)
- Slide 4: Real-Life Use Cases & Consumer Devices (use :::cards or :::stats with KPI metrics)
- Slide 5: Strategic Roadmap & Key Takeaways (use :::timeline with Phase 1, Phase 2, Phase 3)
Context:\n${current || 'Core problem, technical comparison, real-life devices, and strategic roadmap.'}`,
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

  // SATCHIDA OFFICE SUITE: Direct File Actions
  const handleNewSheet = useCallback(() => {
    if (disabled) return;
    const artifactId = `satchida-sheet-${Date.now()}`;
    const blankWorkbook = {
      id: `wb-${Date.now()}`,
      name: 'Untitled Spreadsheet',
      sheetOrder: ['sheet1'],
      sheets: {
        sheet1: {
          id: 'sheet1',
          name: 'Sheet 1',
          rowCount: 50,
          columnCount: 26,
        },
      },
    };
    setArtifacts((prev) => ({
      ...(prev || {}),
      [artifactId]: {
        id: artifactId,
        title: 'Untitled Spreadsheet',
        type: UNIVER_SHEET_MIME,
        content: JSON.stringify(blankWorkbook),
        lastUpdateTime: Date.now(),
      },
    }));
    setCurrentArtifactId(artifactId);
    setArtifactsVisible(true);
    showToast({
      message: 'Created new Satchida Spreadsheet!',
      status: 'success',
    });
  }, [disabled, setArtifacts, setCurrentArtifactId, setArtifactsVisible, showToast]);

  const handleNewDoc = useCallback(() => {
    if (disabled) return;
    const artifactId = `satchida-doc-${Date.now()}`;
    const blankDoc = {
      id: `doc-${Date.now()}`,
      title: 'Untitled Document',
      body: {
        dataStream: 'Start typing your document here...\r\n\r\n',
      },
    };
    setArtifacts((prev) => ({
      ...(prev || {}),
      [artifactId]: {
        id: artifactId,
        title: 'Untitled Document',
        type: UNIVER_DOC_MIME,
        content: JSON.stringify(blankDoc),
        lastUpdateTime: Date.now(),
      },
    }));
    setCurrentArtifactId(artifactId);
    setArtifactsVisible(true);
    showToast({
      message: 'Created new Satchida Document!',
      status: 'success',
    });
  }, [disabled, setArtifacts, setCurrentArtifactId, setArtifactsVisible, showToast]);

  // SATCHIDA STUDIO (OPENFILM): Direct Launch & Template Actions
  const handleOpenFilmStudio = useCallback(
    (templateType: 'blank' | 'nature' | 'metropolis' = 'blank') => {
      if (disabled) return;
      const artifactId = `satchida-film-${Date.now()}`;
      let initialFilm = '';
      if (templateType === 'nature') {
        initialFilm = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#020617; }
    iframe { width:100%; height:100%; border:none; }
  </style>
</head>
<body>
  <iframe src="/motion/omni_studio.html?env=nature&engine=ai_diffusion&track=ambient_nature" allow="autoplay; fullscreen"></iframe>
  <script>
    window.film = {
      duration: 15,
      width: 1920,
      height: 1080,
      frame: function(t) {}
    };
  </script>
</body>
</html>`;
      } else if (templateType === 'metropolis') {
        initialFilm = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#020617; }
    iframe { width:100%; height:100%; border:none; }
  </style>
</head>
<body>
  <iframe src="/motion/omni_studio.html?env=city&engine=ai_diffusion&track=ambient_city" allow="autoplay; fullscreen"></iframe>
  <script>
    window.film = {
      duration: 15,
      width: 1920,
      height: 1080,
      frame: function(t) {}
    };
  </script>
</body>
</html>`;
      } else {
        initialFilm = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      overflow: hidden; background: #020617;
      display: flex; align-items: center; justify-content: center;
    }
    canvas {
      width: 100%; height: 100%; object-fit: contain;
      background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
    }
  </style>
</head>
<body>
  <canvas id="stage" width="1920" height="1080"></canvas>
  <script>
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');
    window.film = {
      duration: 10,
      width: 1920,
      height: 1080,
      frame: function(t) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, 1920, 1080);
        const glow = ctx.createRadialGradient(960, 540, 50, 960, 540, 600);
        glow.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
        glow.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Satchida Studio · OpenFilm', 960, 500);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px system-ui, -apple-system, sans-serif';
        ctx.fillText('Time: ' + t.toFixed(2) + 's / 10.00s · 60 FPS Deterministic Pure Frame', 960, 580);
      }
    };
  </script>
</body>
</html>`;
      }
      setArtifacts((prev) => ({
        ...(prev || {}),
        [artifactId]: {
          id: artifactId,
          title:
            templateType === 'nature'
              ? 'Alpine Nature Valley (OpenFilm Studio)'
              : templateType === 'metropolis'
              ? 'Metropolis Night (OpenFilm Studio)'
              : 'New Film Project (OpenFilm)',
          type: SATCHIDA_FILM_ARTIFACT_TYPE,
          content: initialFilm,
          lastUpdateTime: Date.now(),
        },
      }));
      setCurrentArtifactId(artifactId);
      setArtifactsVisible(true);
      showToast({
        message: 'Opened Satchida Studio (OpenFilm)!',
        status: 'success',
      });
    },
    [disabled, setArtifacts, setCurrentArtifactId, setArtifactsVisible, showToast],
  );

  const handleOpenOfficeFile = useCallback(async () => {
    if (disabled) return;
    const processFile = async (file: File) => {
      const lower = file.name.toLowerCase();
      const buffer = await file.arrayBuffer();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
        const snapshot = excelBufferToUniverSnapshot(buffer, file.name);
        const artifactId = `satchida-sheet-${Date.now()}`;
        setArtifacts((prev) => ({
          ...(prev || {}),
          [artifactId]: {
            id: artifactId,
            title: file.name,
            type: UNIVER_SHEET_MIME,
            content: JSON.stringify(snapshot),
            lastUpdateTime: Date.now(),
          },
        }));
        setCurrentArtifactId(artifactId);
        setArtifactsVisible(true);
        showToast({
          message: `Opened ${file.name} in Satchida Sheet!`,
          status: 'success',
        });
      } else if (lower.endsWith('.docx')) {
        const snapshot = await docxBufferToUniverDocSnapshot(buffer, file.name);
        const artifactId = `satchida-doc-${Date.now()}`;
        setArtifacts((prev) => ({
          ...(prev || {}),
          [artifactId]: {
            id: artifactId,
            title: file.name,
            type: UNIVER_DOC_MIME,
            content: JSON.stringify(snapshot),
            lastUpdateTime: Date.now(),
          },
        }));
        setCurrentArtifactId(artifactId);
        setArtifactsVisible(true);
        showToast({
          message: `Opened ${file.name} in Satchida Doc!`,
          status: 'success',
        });
      } else {
        showToast({
          message: 'Unsupported format. Please select an .xlsx, .csv, or .docx file.',
          status: 'warning',
        });
      }
    };

    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as unknown as {
          showOpenFilePicker: (options: unknown) => Promise<Array<{
            getFile: () => Promise<File>;
          }>>;
        }).showOpenFilePicker({
          types: [
            {
              description: 'Office Files (.xlsx, .csv, .docx)',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/vnd.ms-excel': ['.xls'],
                'text/csv': ['.csv'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              },
            },
          ],
          multiple: false,
        });
        const file = await handle.getFile();
        await processFile(file);
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv,.docx';
    input.style.display = 'none';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      await processFile(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }, [disabled, setArtifacts, setCurrentArtifactId, setArtifactsVisible, showToast]);

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
              <span className="hidden sm:inline">{localize('com_satchida_research')}</span>
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
              {localize('com_satchida_section_prompt_enhancement')}
            </div>

            {/* ✨ Magic Auto-Enhance */}
            <DropdownMenuItem
              onClick={handleEnhancePrompt}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Wand2 className="h-4 w-4 shrink-0 text-violet-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_auto_enhance')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_auto_enhance_desc')}
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
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_blueprint')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_blueprint_desc')}
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
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_adversarial')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_adversarial_desc')}
                </div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border-light/60" />

            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              {localize('com_satchida_section_creative')}
            </div>

            {/* 🖼️ Image Generation */}
            <DropdownMenuItem
              onClick={toggleImageGen}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <ImageIcon className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">
                    {localize('com_satchida_image_gen')}
                  </span>
                  {imageGen && <span className="text-[10px] font-medium text-emerald-400">ON</span>}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_image_gen_desc')}
                </div>
              </div>
            </DropdownMenuItem>

            {/* 🎬 Satchida Studio (OpenFilm) */}
            <DropdownMenuItem
              onClick={() => {
                handleOpenFilmStudio('blank');
                handleApplyPersonaPrompt(
                  'Act as Satchida Motion Studio (OpenFilm). Choreograph a cinema-grade photorealistic video using Wan 2.1 (14B) & Kling 2.5 with native audio. Produce both Option A (Neural Video Diffusion) and Option B (Satchida Omni-Studio 3D simulation).',
                  'Satchida Studio (OpenFilm)',
                );
              }}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Film className="h-4 w-4 shrink-0 text-violet-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  Satchida Studio (OpenFilm) 🎬
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Launch visual timeline, canvas stage & MP4 video exporter
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
                  <span className="font-semibold">{localize('com_satchida_vault')}</span>
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
              {localize('com_satchida_section_vault')}
            </div>

            {/* 🔍 Query Vault RAG */}
            <DropdownMenuItem
              onClick={handleVaultSearch}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <FolderLock className="h-4 w-4 shrink-0 text-purple-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_vault_search')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_vault_search_desc')}
                </div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border-light/60" />

            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              {localize('com_satchida_section_office')}
            </div>

            {/* 📊 New Satchida Sheet */}
            <DropdownMenuItem
              onClick={handleNewSheet}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Table2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_new_sheet')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_new_sheet_desc')}
                </div>
              </div>
            </DropdownMenuItem>

            {/* 📝 New Satchida Doc */}
            <DropdownMenuItem
              onClick={handleNewDoc}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <FileText className="h-4 w-4 shrink-0 text-blue-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_new_doc')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_new_doc_desc')}
                </div>
              </div>
            </DropdownMenuItem>

            {/* 📂 Open Local Office File */}
            <DropdownMenuItem
              onClick={handleOpenOfficeFile}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <FolderLock className="h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_open_office_file')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_open_office_file_desc')}
                </div>
              </div>
            </DropdownMenuItem>

            {/* 🎬 New Film Project (OpenFilm Studio) */}
            <DropdownMenuItem
              onClick={() => handleOpenFilmStudio('blank')}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Film className="h-4 w-4 shrink-0 text-violet-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  New Film Project (OpenFilm)
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  Open visual timeline, canvas stage & MP4 exporter
                </div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border-light/60" />

            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              {localize('com_satchida_section_documents')}
            </div>

            {/* 📄 PDF Report */}
            <DropdownMenuItem
              onClick={() => handleDocSynthesis('pdf')}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <FileText className="h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_doc_pdf')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_doc_pdf_desc')}
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
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_doc_pptx')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_doc_pptx_desc')}
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
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_doc_xlsx')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_doc_xlsx_desc')}
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
                <div className="font-semibold text-text-primary">
                  {localize('com_satchida_doc_docx')}
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  {localize('com_satchida_doc_docx_desc')}
                </div>
              </div>
            </DropdownMenuItem>

            {/* 🎙️ Audio Podcast Explanation */}
            <DropdownMenuItem
              onClick={() => {
                if (disabled || !getText || !setText) return;
                const current = getText();
                setText(
                  `Act as an elite educational audio educator and podcast host. Deliver a high-quality, conversational audio masterclass breakdown titled "Audio_Masterclass_${Date.now()}":\n1. Hook: Start with a real-world mystery or vivid physical analogy (no robotic greetings).\n2. Core Mechanics: Explain the principles intuitively using conversational spoken language (do not read raw algebraic equations).\n3. Tangible Hardware: Contrast how engineers use this in real everyday consumer devices.\n4. Memorable Takeaway: End with a punchy 2-sentence mental anchor.\n\nSubject to explain:\n${current || 'Provide a compelling, crystal-clear spoken explanation of the concept and its real-world significance.'}`
                );
                showToast({
                  message: 'Prepared High-Yield Audio Masterclass Prompt!',
                  status: 'info',
                });
              }}
              className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
            >
              <Volume2 className="h-4 w-4 shrink-0 text-purple-400" />
              <div>
                <div className="font-semibold text-text-primary">
                  Audio Masterclass / Podcast Explainer 🎙️
                </div>
                <div className="text-[11px] leading-tight text-text-secondary">
                  High-yield conversational audio explanation tailored for listening
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
                    <span>
                      {mode === 'Study'
                        ? localize('com_satchida_study_studio')
                        : localize('com_satchida_work_studio')}
                    </span>
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
                      <div className="font-semibold text-text-primary">
                        {localize('com_satchida_quiz')}
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        {localize('com_satchida_quiz_desc')}
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
                      <div className="font-semibold text-text-primary">
                        {localize('com_satchida_flashcards')}
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        {localize('com_satchida_flashcards_desc')}
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
                      <div className="font-semibold text-text-primary">
                        {localize('com_satchida_concept_diagram')}
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        {localize('com_satchida_concept_diagram_desc')}
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
                      <div className="font-semibold text-text-primary">
                        {localize('com_satchida_formula')}
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        {localize('com_satchida_formula_desc')}
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
                      <div className="font-semibold text-text-primary">
                        {localize('com_satchida_arch_diagram')}
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        {localize('com_satchida_arch_diagram_desc')}
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
                      <div className="font-semibold text-text-primary">
                        {localize('com_satchida_vibe')}
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        {localize('com_satchida_vibe_desc')}
                      </div>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 bg-border-light/60" />

                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Satchida Studio (OpenFilm)
                  </div>

                  {/* OpenFilm Studio Canvas */}
                  <DropdownMenuItem
                    onClick={() => handleOpenFilmStudio('blank')}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <Film className="h-4 w-4 shrink-0 text-violet-400" />
                    <div>
                      <div className="font-semibold text-text-primary">
                        OpenFilm Studio
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        Interactive timeline, playhead & MP4 exporter
                      </div>
                    </div>
                  </DropdownMenuItem>

                  {/* Alpine Nature Simulation */}
                  <DropdownMenuItem
                    onClick={() => handleOpenFilmStudio('nature')}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-text-primary">
                        Alpine Nature Simulation
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        Procedural 3D terrain, river flow & birdsong
                      </div>
                    </div>
                  </DropdownMenuItem>

                  {/* Metropolis Night Simulation */}
                  <DropdownMenuItem
                    onClick={() => handleOpenFilmStudio('metropolis')}
                    className="outline-hidden flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-surface-hover"
                  >
                    <Video className="h-4 w-4 shrink-0 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-text-primary">
                        Metropolis Night Boulevard
                      </div>
                      <div className="text-[11px] leading-tight text-text-secondary">
                        Volumetric traffic lighting & city audio
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
