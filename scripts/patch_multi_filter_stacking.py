with open('client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update handleMessage to intelligently append/combine multiple effect prompts
msg_target = """      } else if (e.data && e.data.type === 'OPENFILM_STUDIO_SUGGEST_PROMPT') {
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
      }"""

msg_replacement = """      } else if (e.data && e.data.type === 'OPENFILM_STUDIO_SUGGEST_PROMPT') {
        const { effectName, prompt } = e.data;
        if (prompt) {
          setSuggestedPrompt({ effectName: effectName || 'Effect', prompt });
          // Intelligently append or combine into chat textarea so multiple filters/effects layer cleanly!
          const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
          if (textarea) {
            const currentVal = (textarea.value || '').trim();
            if (!currentVal) {
              textarea.value = prompt;
            } else if (!currentVal.toLowerCase().includes(prompt.toLowerCase())) {
              // Combine cleanly: "..., and also add..." or separate sentence
              if (currentVal.endsWith('.')) {
                textarea.value = `${currentVal} Also, ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}`;
              } else {
                textarea.value = `${currentVal}. In addition, ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}`;
              }
            }
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (showToast) {
            showToast({
              message: `Layered ${effectName || 'effect'} into chat prompt!`,
              status: 'info',
            });
          }
        }
      }"""

text = text.replace(msg_target, msg_replacement)

# 2. Update "Use in Chat" button click handler to also append/combine
btn_target = """                <button
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
                >"""

btn_replacement = """                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.getElementById(mainTextareaId) as HTMLTextAreaElement | null;
                    if (textarea) {
                      const currentVal = (textarea.value || '').trim();
                      if (!currentVal) {
                        textarea.value = suggestedPrompt.prompt;
                      } else if (!currentVal.toLowerCase().includes(suggestedPrompt.prompt.toLowerCase())) {
                        if (currentVal.endsWith('.')) {
                          textarea.value = `${currentVal} Also, ${suggestedPrompt.prompt.charAt(0).toLowerCase()}${suggestedPrompt.prompt.slice(1)}`;
                        } else {
                          textarea.value = `${currentVal}. In addition, ${suggestedPrompt.prompt.charAt(0).toLowerCase()}${suggestedPrompt.prompt.slice(1)}`;
                        }
                      }
                      textarea.dispatchEvent(new Event('input', { bubbles: true }));
                      textarea.focus();
                    }
                    if (showToast) {
                      showToast({
                        message: 'Layered effect prompt into message box!',
                        status: 'success',
                      });
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500 transition-colors"
                >"""

text = text.replace(btn_target, btn_replacement)

with open('client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated OpenFilmStudio.tsx for multi-filter prompt stacking successfully!")
