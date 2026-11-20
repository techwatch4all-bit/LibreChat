with open('client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add imports for useToastContext, mainTextareaId, Check, Send
import_target = """import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Download,
  Video,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  Film,
  FastForward,
  Rewind,
  Sliders,
  Layers,
  Wand2,
} from 'lucide-react';"""

import_replacement = """import {
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Download,
  Video,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  Film,
  FastForward,
  Rewind,
  Sliders,
  Layers,
  Wand2,
  Send,
  Check,
} from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { mainTextareaId } from '~/common';"""

text = text.replace(import_target, import_replacement)

# 2. Add suggested prompt banner state
state_target = """  const [showBrowserNotice, setShowBrowserNotice] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.userAgent.toLowerCase().includes('firefox');
  });"""

state_replacement = """  const [showBrowserNotice, setShowBrowserNotice] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.userAgent.toLowerCase().includes('firefox');
  });
  const { showToast } = useToastContext();
  const [suggestedPrompt, setSuggestedPrompt] = useState<{ effectName: string; prompt: string } | null>(null);"""

text = text.replace(state_target, state_replacement)

# 3. Handle OPENFILM_STUDIO_SUGGEST_PROMPT in handleMessage
msg_target = """    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'FILM_METADATA') {
        if (typeof e.data.duration === 'number' && e.data.duration > 0) {
          setDuration(e.data.duration);
        }
      }
    };"""

msg_replacement = """    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'FILM_METADATA') {
        if (typeof e.data.duration === 'number' && e.data.duration > 0) {
          setDuration(e.data.duration);
        }
      } else if (e.data && e.data.type === 'OPENFILM_STUDIO_SUGGEST_PROMPT') {
        const { effectName, prompt } = e.data;
        if (prompt) {
          setSuggestedPrompt({ effectName: effectName || 'Effect', prompt });
          // Auto-stage into chat textarea so student can review or hit Enter
          const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
          if (textarea) {
            textarea.value = prompt;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (showToast) {
            showToast({
              message: `Suggested prompt staged for ${effectName || 'selected effect'}!`,
              status: 'info',
            });
          }
        }
      }
    };"""

text = text.replace(msg_target, msg_replacement)

# 4. Render interactive banner at the bottom of OpenFilm Studio Workbench
bench_target = """          {studioUrl ? (
            <iframe
              src={studioUrl}
              title="OpenFilm Studio 4-Editor Suite"
              allow="autoplay; fullscreen; clipboard-read; clipboard-write"
              className="h-full w-full border-0"
              onLoad={() => setIsStudioLoading(false)}
            />
          ) : ("""

bench_replacement = """          {/* Student Prompt Suggestions Floating Card */}
          {suggestedPrompt && (
            <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-3 rounded-xl border border-violet-500/50 bg-[#0f172a]/95 p-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-2.5 overflow-hidden">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-600/30 text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400">
                      Suggested Edit Prompt · {suggestedPrompt.effectName}
                    </span>
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                      Click to Apply in Chat
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-slate-200">
                    "{suggestedPrompt.prompt}"
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
                    if (textarea) {
                      textarea.value = suggestedPrompt.prompt;
                      textarea.dispatchEvent(new Event('input', { bubbles: true }));
                      textarea.focus();
                    }
                    if (showToast) {
                      showToast({
                        message: 'Prompt applied to message box! Hit send anytime.',
                        status: 'success',
                      });
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  <span>Use in Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestedPrompt(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {studioUrl ? (
            <iframe
              src={studioUrl}
              title="OpenFilm Studio 4-Editor Suite"
              allow="autoplay; fullscreen; clipboard-read; clipboard-write"
              className="h-full w-full border-0"
              onLoad={() => setIsStudioLoading(false)}
            />
          ) : ("""

text = text.replace(bench_target, bench_replacement)

with open('client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated OpenFilmStudio.tsx with interactive prompt suggestion listener and banner!")
