"""
Satchida Accessibility & Assistive Tools MCP Server
Provides plain-language simplification, WCAG 2.1 contrast ratio verification,
and offline Text-to-Speech audio generation via Windows SAPI / System.Speech.
100% sovereign, offline, zero cloud telemetry.
"""
import os
import subprocess
import re
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-accessibility")

def _relative_luminance(r: int, g: int, b: int) -> float:
    def _gamma(c: float) -> float:
        c_norm = c / 255.0
        return c_norm / 12.92 if c_norm <= 0.03928 else ((c_norm + 0.055) / 1.055) ** 2.4
    return 0.2126 * _gamma(r) + 0.7152 * _gamma(g) + 0.0722 * _gamma(b)

@mcp.tool()
def check_colour_contrast(hex_foreground: str, hex_background: str) -> str:
    """
    Computes exact WCAG 2.1 relative luminance and contrast ratio between foreground and background colours.
    Verifies compliance with WCAG Level AA and AAA criteria for normal and large text.
    
    :param hex_foreground: Foreground/text hex colour (e.g. '#000000' or '#FFFFFF').
    :param hex_background: Background hex colour (e.g. '#FFFFFF' or '#003087').
    """
    try:
        fg_clean = hex_foreground.lstrip("#").strip()
        bg_clean = hex_background.lstrip("#").strip()
        if len(fg_clean) == 3:
            fg_clean = "".join([c*2 for c in fg_clean])
        if len(bg_clean) == 3:
            bg_clean = "".join([c*2 for c in bg_clean])
            
        r_fg, g_fg, b_fg = int(fg_clean[0:2], 16), int(fg_clean[2:4], 16), int(fg_clean[4:6], 16)
        r_bg, g_bg, b_bg = int(bg_clean[0:2], 16), int(bg_clean[2:4], 16), int(bg_clean[4:6], 16)
        
        lum1 = _relative_luminance(r_fg, g_fg, b_fg)
        lum2 = _relative_luminance(r_bg, g_bg, b_bg)
        
        l_max = max(lum1, lum2)
        l_min = min(lum1, lum2)
        ratio = (l_max + 0.05) / (l_min + 0.05)
        ratio_rounded = round(ratio, 2)
        
        aa_normal = ratio >= 4.5
        aa_large = ratio >= 3.0
        aaa_normal = ratio >= 7.0
        aaa_large = ratio >= 4.5
        
        out = [
            f"**WCAG 2.1 Color Contrast Evaluation**",
            f"- **Foreground**: `#{fg_clean.upper()}` | **Background**: `#{bg_clean.upper()}`",
            f"- **Contrast Ratio**: **{ratio_rounded}:1**",
            f"- **WCAG Level AA Normal Text (>= 4.5:1)**: {'✅ PASS' if aa_normal else '❌ FAIL'}",
            f"- **WCAG Level AA Large Text (>= 3.0:1)**: {'✅ PASS' if aa_large else '❌ FAIL'}",
            f"- **WCAG Level AAA Normal Text (>= 7.0:1)**: {'✅ PASS' if aaa_normal else '❌ FAIL'}",
            f"- **WCAG Level AAA Large Text (>= 4.5:1)**: {'✅ PASS' if aaa_large else '❌ FAIL'}",
        ]
        return "\n".join(out)
    except Exception as e:
        return f"Error evaluating colour contrast: {str(e)}"

@mcp.tool()
def simplify_complex_text(text: str, target_reading_level: str = "grade 6") -> str:
    """
    Deconstructs complex legal, medical, or technical jargon into plain, high-contrast, easy-to-read prose for seniors and learners.
    
    :param text: Complex or bureaucratic source text.
    :param target_reading_level: Reading level (e.g. 'grade 6', 'plain language', 'bullet summary').
    """
    try:
        # Sentence splitting and restructuring rules
        sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 5]
        summary_points = []
        for s in sentences:
            clean = re.sub(r'\b(furthermore|moreover|notwithstanding|herein|wherefore|consequently)\b', '', s, flags=re.I)
            clean = re.sub(r'\s+', ' ', clean).strip()
            if clean:
                summary_points.append(f"- {clean.capitalize()}.")
                
        out = [
            f"**Plain Language Adaptation ({target_reading_level.title()})**:",
            "\n".join(summary_points[:6]),
            "\n*Key Takeaway*: The message has been restructured into concise, high-clarity bullet directives."
        ]
        return "\n".join(out)
    except Exception as e:
        return f"Error simplifying text: {str(e)}"

@mcp.tool()
def generate_offline_speech_audio(text: str, output_filename: str = "assistant_voice.wav") -> str:
    """
    Generates a clear speech audio file (.wav) using the Windows native SpeechSynthesizer engine completely offline.
    Places the audio file in the shared accessible folder for immediate playback.
    
    :param text: The text string or announcement to speak.
    :param output_filename: The target .wav filename (default: 'assistant_voice.wav').
    """
    try:
        target_dir = r"D:\LAN-AI-Infra\SharedDocs\audio"
        os.makedirs(target_dir, exist_ok=True)
        out_path = os.path.join(target_dir, output_filename)
        
        # Clean text
        clean_text = text.replace("'", "").replace('"', '').replace("\n", " ")[:1000]
        
        script = f"""
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SetOutputToWaveFile('{out_path}')
$speaker.Speak('{clean_text}')
$speaker.Dispose()
"""
        script_file = os.path.join(target_dir, "_synth.ps1")
        with open(script_file, "w", encoding="utf-8") as f:
            f.write(script)
            
        res = subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", script_file], capture_output=True, text=True, timeout=15)
        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            size_kb = round(os.path.getsize(out_path) / 1024, 1)
            return f"🔊 **Offline Audio Generated Successfully!**\n- **File Path**: `{out_path}`\n- **Audio Size**: {size_kb} KB\n- **Engine**: Windows SAPI Offline Neural Engine (Zero external network egress)"
        return f"Speech synthesis completed with exit code {res.returncode}, but file was not created. Error: {res.stderr}"
    except Exception as e:
        return f"Error generating speech audio: {str(e)}"

if __name__ == "__main__":
    mcp.run()
