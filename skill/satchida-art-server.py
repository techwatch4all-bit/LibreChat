"""
Satchida Art MCP Server (satchida-art-server.py)
-------------------------------------------------
Structured MCP bridge between LibreChat agents and the two in-repo art skills:

1. `skill/satchida-procedural-art` - 82 procedural painting styles
   (numpy + Pillow, deterministic seeds, staged snapshots).
2. `skill/satchida-motion-art` - kinetic motion grammars (deterministic
   timeline contract, storyboard discipline, foley cues).

Tools
-----
- generate_procedural_art(style, prompt, palette, seed, scene_py, ...)
      Renders a picture with the procedural-art library and publishes it to the
      stable Studio artifact home (/generated/...) with a Studio Library
      manifest entry. The agent may supply its own scene script (scene_py) or
      let the tool pick a matching reference scene from examples/.
- create_kinetic_motion_clip(grammar, spec_json, audio_cues, ...)
      Compiles a deterministic HTML motion clip from a motion-art grammar and a
      JSON spec, honoring the OpenFilmStudio iframe contract
      (window.film.frame(t) / setMuted). Returns the artifact-wrapped HTML for
      inline chat display plus a saved /generated copy; can also render MP4
      through the Satchida motion render pipeline (headless Chromium + FFmpeg).
- list_procedural_art_styles() / list_motion_grammars()
      Discovery helpers so agents can pick valid style ids and grammars.

All paths are strictly inside the LibreChat repository (tenant-portable) except
the stable artifact home, which is the shared Studio exports directory already
served by the server at /generated. 100% local, sovereign, zero-cloud.
Compatible with MCP SDK 2.x (MCPServer) and the Satchida Unified Hub
(auto-discovered as `*-server.py`; tool names are unique across the hub).
"""
import os
import sys
import re
import json
import time
import uuid
import shutil
import tempfile
import datetime
import subprocess
import importlib.util
from pathlib import Path
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-art")

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ART_SKILL_ROOT = os.path.join(WORKSPACE_ROOT, "skill", "satchida-procedural-art")
ART_LIB_DIR = os.path.join(ART_SKILL_ROOT, "lib")
ART_EXAMPLES_DIR = os.path.join(ART_SKILL_ROOT, "examples")
MOTION_SKILL_ROOT = os.path.join(WORKSPACE_ROOT, "skill", "satchida-motion-art")

# Stable studio artifact home, served by LibreChat at /generated (see
# api/server/index.js). Outside client/dist so client rebuilds never 404 it.
_IN_REPO_GEN = Path(WORKSPACE_ROOT) / "storage" / "exports" / "generated"
STABLE_GENERATED_DIR = _IN_REPO_GEN if _IN_REPO_GEN.exists() else Path(r"D:\LAN-AI-Infra\Satchida-Studio\exports\generated")

PYTHON_BIN = sys.executable or "python"

GRAMMARS = [
    "3b1b", "keynote_ui", "finance_chart", "kurzgesagt", "vox",
    "whiteboard", "storytime", "kinetic_type", "presenter_explainer",
    "living_landscape", "atmospheric_art",
]

# ---------------------------------------------------------------------------
# Publishing (same contract as satchida-montage-server._publish_artifact)
# ---------------------------------------------------------------------------

def _validate_render(out_path: str) -> dict:
    """Post-render quality gate: the file must decode, have sane dimensions,
    and not be a blank/solid frame. Returns a small report dict."""
    report = {"ok": False, "width": 0, "height": 0, "std": 0.0, "warning": ""}
    try:
        from PIL import Image
        import numpy as np

        with Image.open(out_path) as im:
            im.load()
            w, h = im.size
            report["width"], report["height"] = w, h
            sample = np.asarray(im.convert("L").resize((min(w, 256), min(h, 256))))
        std = float(sample.std())
        report["std"] = round(std, 2)
        if std < 4.0:
            report["warning"] = (
                "Render looks nearly blank/solid (pixel std %.1f < 4.0). Check the scene "
                "composition, palette contrast, or seed before delivering." % std)
        report["ok"] = True
    except Exception as e:
        report["warning"] = f"Quality check failed: {e}"
    return report


def _publish_artifact(path: Path, user: str = "") -> str:
    """Copy a finished artifact into the stable /generated home and register it
    in the Studio Library manifest. An existing library file is NEVER
    overwritten: a colliding name is republished under a suffixed name."""
    try:
        STABLE_GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        name = path.name
        dest = STABLE_GENERATED_DIR / name
        if dest.exists() and dest.stat().st_size != path.stat().st_size:
            name = f"{Path(name).stem}_{uuid.uuid4().hex[:8]}{Path(name).suffix}"
            dest = STABLE_GENERATED_DIR / name
        shutil.copyfile(path, dest)
        web_url = f"/generated/{name}"
        manifest_path = STABLE_GENERATED_DIR / "manifest.json"
        try:
            entries = []
            if manifest_path.exists():
                entries = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not any(e.get("name") == name for e in entries):
                kind = "video" if name.lower().endswith((".mp4", ".webm")) else (
                    "image" if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif"))
                    else "file")
                entries.append({
                    "name": name,
                    "kind": kind,
                    "url": web_url,
                    "thumb": web_url if kind == "image" else "",
                    "download": web_url,
                    "created": datetime.datetime.now(datetime.timezone.utc).strftime(
                        "%Y-%m-%d %H:%M"),
                    "size": dest.stat().st_size,
                    **({"user": user.strip()[:64]} if user.strip() else {}),
                })
            entries.sort(key=lambda e: e.get("created", ""), reverse=True)
            manifest_path.write_text(json.dumps(entries, indent=1), encoding="utf-8")
        except Exception as me:  # manifest is best-effort; the file itself is the deliverable
            print(f"[satchida-art] manifest update skipped: {me}", file=sys.stderr)
        return web_url
    except Exception as e:
        print(f"[satchida-art] artifact publish failed: {e}", file=sys.stderr)
        return ""


def _list_styles() -> dict:
    """style id -> list of reference example scripts."""
    styles = {}
    if os.path.isdir(ART_LIB_DIR):
        for f in sorted(os.listdir(ART_LIB_DIR)):
            if f.endswith(".py") and f != "__init__.py":
                styles[f[:-3]] = []
    if os.path.isdir(ART_EXAMPLES_DIR):
        for f in sorted(os.listdir(ART_EXAMPLES_DIR)):
            if f.endswith(".py"):
                for style in styles:
                    if f.startswith(style + "_") or f == style + ".py":
                        styles[style].append(f)
                        break
    return styles


# Styles whose reference scenes do not share the module-name prefix.
STYLE_EXAMPLE_ALIASES = {
    "inkpaint": ["moon_river.py", "bawansiqian.py"],
    "oilpaint": ["oil_wheatfield.py"],
}


def _pick_example(style: str, prompt: str) -> str:
    """Choose the reference scene best matching the prompt, else the first."""
    examples = _list_styles().get(style, [])
    if not examples:
        for alias in STYLE_EXAMPLE_ALIASES.get(style, []):
            if os.path.exists(os.path.join(ART_EXAMPLES_DIR, alias)):
                return alias
        return ""
    if prompt:
        words = [w for w in re.split(r"[^a-zA-Z0-9]+", prompt.lower()) if len(w) > 2]
        best, best_score = "", 0
        for ex in examples:
            hay = ex.lower()
            score = sum(1 for w in words if w in hay)
            if score > best_score:
                best, best_score = ex, score
        if best:
            return best
    return examples[0]


def _patch_seed(scene_text: str, seed: int) -> str:
    """Deterministically override the first `seed=<int>` in a scene script."""
    return re.sub(r"seed\s*=\s*\d+", f"seed={int(seed)}", scene_text, count=1)


def _load_motion_renderer():
    """Load the Satchida motion server module (same directory) and return its
    render_motion_to_video tool function, or None when unavailable."""
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "satchida-motion-server.py")
        spec = importlib.util.spec_from_file_location("satchida_art_motion_renderer", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return getattr(module, "render_motion_to_video", None)
    except Exception as e:
        print(f"[satchida-art] motion renderer unavailable: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Film HTML template (deterministic, OpenFilmStudio-compatible)
# ---------------------------------------------------------------------------

FILM_TEMPLATE = r"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>__TITLE__</title>
<style>
  html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden;
    background:__BG__; font-family:'Segoe UI',system-ui,sans-serif; }
  canvas { width:100%; height:100%; object-fit:contain; display:block; }
</style>
</head>
<body>
<canvas id="film" width="__W__" height="__H__"></canvas>
<script>
/* Satchida Motion Art - deterministic kinetic clip (grammar: __GRAMMAR__)
   Contract: window.film = { frame(t), duration, width, height, setMuted }
   - frame(t) re-renders the exact same picture for the same t (pure function).
   - setMuted(v) silences the WebAudio foley bus.
   The OpenFilmStudio bridge (SEEK_FRAME / AUDIO_MUTE postMessages) drives it. */
(function(){
  var W=__W__, H=__H__, DURATION=__DUR__;
  var SPEC=__SPEC__;
  var CUES=__CUES__;
  var canvas=document.getElementById('film');
  var ctx=canvas.getContext('2d');

  function ease(t){ return t<0?0:t>1?1:(t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2); }
  function clamp01(v){ return v<0?0:v>1?1:v; }
  function sceneAt(t){
    for (var i=0;i<SPEC.scenes.length;i++){
      var s=SPEC.scenes[i];
      var start = (typeof s.t === 'number') ? s.t : 0;
      var dur = s.dur || 4;
      if (t >= start && t < start + dur) return {s:s, local:t-start, dur:dur};
    }
    var last=SPEC.scenes[SPEC.scenes.length-1]||{};
    return {s:last, local:(last.dur||4), dur:(last.dur||4)};
  }
  var PAL=(SPEC.theme&&SPEC.theme.palette)||['#f59e0b','#38bdf8','#a3e635','#f472b6'];
  var ACCENT=(SPEC.theme&&SPEC.theme.accent)||PAL[0];
  var BG=(SPEC.theme&&SPEC.theme.bg)||'__BG__';
  var INK=(SPEC.theme&&SPEC.theme.ink)||'#e5e7eb';
  function pal(i){ return PAL[i%PAL.length]; }

  // ---- grammar renderers (all deterministic in local time u = local/dur) --
  function gKineticType(c,s,u){
    var words=(s.words&&s.words.length?s.words:['Satchida']);
    var size=Math.round(H/(s.style==='stack'? (words.length+1.6):4));
    ctx.textAlign=s.style==='center'?'center':'left';
    ctx.textBaseline='middle';
    ctx.fillStyle=INK;
    var reveal=Math.floor(ease(u)*words.length+0.0001);
    for(var i=0;i<words.length;i++){
      if(i>reveal) break;
      var y=H/2+(i-words.length/2+0.5)*size*1.18;
      var x=s.style==='center'?W/2:W*0.09;
      var pop=clamp01((ease(u)*words.length)-i);
      ctx.save(); ctx.globalAlpha=0.15+0.85*pop;
      ctx.font='700 '+Math.round(size*(0.9+0.1*pop))+'px sans-serif';
      ctx.fillStyle=i===words.length-1?ACCENT:INK;
      ctx.fillText(words[i],x,y);
      ctx.restore();
    }
    var bar=Math.round(W*0.09+ctx.measureText(words[0]||'').width*u);
    ctx.fillStyle=ACCENT; ctx.fillRect(W*0.09,H/2-size*0.62,Math.max(0,bar-W*0.09),size*0.08);
  }
  function gFinanceChart(c,s,u){
    var ch=s.chart||{}; var data=ch.data||[3,5,4,8,7,10,12];
    var labels=ch.labels||[]; var type=ch.type||'line';
    var x0=W*0.1,y0=H*0.16,x1=W*0.9,y1=H*0.78;
    ctx.strokeStyle='rgba(148,163,184,0.25)'; ctx.lineWidth=1;
    for(var g=0;g<=4;g++){var gy=y0+(y1-y0)*g/4;ctx.beginPath();ctx.moveTo(x0,gy);ctx.lineTo(x1,gy);ctx.stroke();}
    var n=data.length,max=Math.max.apply(null,data)*1.1||1;
    ctx.strokeStyle=ACCENT;ctx.lineWidth=4;ctx.lineJoin='round';
    var shown=Math.max(2,Math.ceil(data.length*ease(u)));
    ctx.beginPath();
    for(var i=0;i<shown;i++){
      var px=x0+(x1-x0)*i/(data.length-1),py=y1-(y1-y0)*data[i]/max;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    if(type==='line'){ctx.stroke();
      var lx=x0+(x1-x0)*(shown-1)/(data.length-1),ly=y1-(y1-y0)*data[shown-1]/max;
      ctx.fillStyle=ACCENT;ctx.beginPath();ctx.arc(lx,ly,7,0,6.3);ctx.fill();
    } else {
      var bw=(x1-x0)/data.length*0.55;
      for(var b=0;b<shown;b++){
        var bx=x0+(x1-x0)*b/(data.length-1)-bw/2,by=y1-(y1-y0)*data[b]/max;
        ctx.fillStyle=pal(b);ctx.fillRect(bx,by,bw,y1-by);
      }
    }
    ctx.fillStyle=INK;ctx.font='600 '+Math.round(H*0.032)+'px sans-serif';ctx.textAlign='left';
    ctx.fillText(s.caption||(labels[0]||''),x0,H*0.11);
    var val=Math.round((data[shown-1]||0)*ease(u)*100)/100;
    ctx.fillStyle=ACCENT;ctx.font='800 '+Math.round(H*0.085)+'px sans-serif';
    ctx.fillText(String(val),x0,y1+H*0.09);
  }
  function gKeynoteUI(c,s,u){
    var win=s.window||{};
    var wx=W*0.08,wy=H*0.12,ww=W*0.84,wh=H*0.72;
    ctx.fillStyle=(SPEC.theme&&SPEC.theme.card)||'#111827';
    ctx.strokeStyle='rgba(255,255,255,0.12)';
    roundRect(wx,wy,ww,wh,14);ctx.fill();ctx.stroke();
    [' #ef4444','#f59e0b','#22c55e'].forEach(function(col,i){
      ctx.fillStyle=col.trim();ctx.beginPath();ctx.arc(wx+22+i*26,wy+22,7,0,6.3);ctx.fill();});
    ctx.fillStyle=INK;ctx.font='700 '+Math.round(H*0.045)+'px sans-serif';ctx.textAlign='left';
    ctx.fillText(win.title||SPEC.title||'',wx+30,wy+64);
    var bullets=s.bullets||[];
    var rev=Math.floor(ease(u)*bullets.length+0.0001);
    bullets.forEach(function(b,i){
      if(i>rev)return;
      var by=wy+wh*0.28+i*wh*0.16;
      var pop=clamp01((ease(u)*bullets.length)-i);
      ctx.globalAlpha=0.2+0.8*pop;
      ctx.fillStyle=ACCENT;ctx.beginPath();ctx.arc(wx+40,by-8,7*pop+2,0,6.3);ctx.fill();
      ctx.fillStyle=INK;ctx.font='500 '+Math.round(H*0.038)+'px sans-serif';
      ctx.fillText(b,wx+62,by);ctx.globalAlpha=1;
    });
  }
  function g3b1b(c,s,u){
    ctx.strokeStyle=ACCENT;ctx.lineWidth=3;ctx.lineCap='round';
    var cx=W/2,cy=H/2,r=Math.min(W,H)*0.3;
    var prog=ease(u);
    ctx.beginPath();
    var segs=(s.shape==='square')?4:(s.shape==='spiral'?3:64);
    if(s.shape==='square'){
      var p=[[-r,-r],[r,-r],[r,r],[-r,r],[-r,-r]];
      var total=prog*4;
      for(var i=0;i<4;i++){var f=clamp01(total-i);
        if(f<=0)break;
        ctx.moveTo(cx+p[i][0],cy+p[i][1]);
        ctx.lineTo(cx+p[i][0]+(p[i+1][0]-p[i][0])*f,cy+p[i][1]+(p[i+1][1]-p[i][1])*f);}
    } else {
      var end=prog*Math.PI*2*(s.turns||2);
      for(var a=0;a<=end;a+=0.05){
        var rr=r*(a/(Math.PI*2*(s.turns||2))*0.9+0.15);
        var px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;
        if(a===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    }
    ctx.stroke();
    if(s.label){ctx.fillStyle=INK;ctx.font='500 '+Math.round(H*0.04)+'px sans-serif';
      ctx.textAlign='center';ctx.fillText(s.label,cx,H*0.88);}
  }
  function gKurzgesagt(c,s,u){
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    var items=s.shapes||[
      {k:'circle',x:0.3,y:0.42,r:0.14,c:0},{k:'rect',x:0.55,y:0.35,w:0.2,h:0.2,c:1},
      {k:'triangle',x:0.75,y:0.6,r:0.12,c:2}];
    items.forEach(function(it,i){
      var pop=clamp01(ease(u)*items.length-i);
      ctx.globalAlpha=pop;ctx.fillStyle=pal(it.c!=null?it.c:i);
      var x=it.x*W,y=it.y*H;
      if(it.k==='circle'){ctx.beginPath();ctx.arc(x,y,it.r*W*pop,0,6.3);ctx.fill();}
      else if(it.k==='rect'){roundRect(x,y,it.w*W*pop,it.h*H,it.w*W*0.12*pop);ctx.fill();}
      else{ctx.beginPath();ctx.moveTo(x,y-it.r*W*pop);ctx.lineTo(x+it.r*W*pop,y+it.r*W*pop);
        ctx.lineTo(x-it.r*W*pop,y+it.r*W*pop);ctx.closePath();ctx.fill();}
      ctx.globalAlpha=1;});
    if(s.caption){ctx.fillStyle=INK;ctx.textAlign='center';
      ctx.font='700 '+Math.round(H*0.05)+'px sans-serif';ctx.fillText(s.caption,W/2,H*0.86);}
  }
  function gVox(c,s,u){
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    var lines=(s.lines||['One idea per screen.']).slice(0,4);
    var rev=Math.floor(ease(u)*lines.length+0.0001);
    lines.forEach(function(ln,i){
      if(i>rev)return;
      var pop=clamp01((ease(u)*lines.length)-i);
      var y=H*0.24+i*H*0.14;
      ctx.fillStyle=pal(i);ctx.globalAlpha=0.25*pop;ctx.fillRect(W*0.08,y-H*0.055,ctx.measureText(ln).width||W*0.6,H*0.075);
      ctx.globalAlpha=1;ctx.fillStyle=INK;ctx.textAlign='left';
      ctx.font='800 '+Math.round(H*0.052)+'px sans-serif';ctx.fillText(ln,W*0.08,y);
    });
    ctx.fillStyle=ACCENT;ctx.fillRect(W*0.08,H*0.82,W*0.84*ease(u),H*0.012);
  }
  function gWhiteboard(c,s,u){
    ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#1e293b';ctx.lineWidth=4;ctx.lineCap='round';
    var text=s.text||'Sketch it out';
    var n=Math.floor(text.length*ease(u));
    ctx.font='600 '+Math.round(H*0.07)+'px sans-serif';ctx.fillStyle='#0f172a';ctx.textAlign='left';
    var x=W*0.1,y=H*0.42;
    for(var i=0;i<text.length;i++){ if(i>n)break;
      var jx=(i%3-1)*2.4, jy=((i*7)%3-1)*2.2;
      ctx.fillText(text[i],x+jx,y+jy);
      x+=ctx.measureText(text[i]).width*1.02;}
    ctx.setLineDash([12,10]);ctx.strokeStyle=ACCENT;
    ctx.strokeRect(W*0.08,H*0.3,W*0.84,H*0.2+Math.sin(u*6.28)*6);ctx.setLineDash([]);
  }
  function gStorytime(c,s,u){
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    var hy=H*0.62;
    ctx.fillStyle=pal(1);ctx.beginPath();ctx.moveTo(0,hy);
    for(var x=0;x<=W;x+=W/12){ctx.lineTo(x,hy+Math.sin(x/W*6.3+1)*H*0.05);}
    ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
    var cx=W*0.5+Math.sin(u*3.14)*W*0.04, cy=hy-H*0.12;
    ctx.fillStyle=pal(0);ctx.beginPath();ctx.arc(cx,cy,H*0.09,0,6.3);ctx.fill();
    ctx.fillStyle='#0f172a';
    var blink=(u%1)<0.92?1:0.15;
    ctx.beginPath();ctx.arc(cx-H*0.03,cy-H*0.01,H*0.012*blink,0,6.3);ctx.fill();
    ctx.beginPath();ctx.arc(cx+H*0.03,cy-H*0.01,H*0.012*blink,0,6.3);ctx.fill();
    ctx.strokeStyle='#0f172a';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(cx,cy+H*0.03,H*0.028,0.3,2.8);ctx.stroke();
    if(s.caption){ctx.fillStyle=INK;ctx.textAlign='center';
      ctx.font='500 '+Math.round(H*0.042)+'px sans-serif';ctx.fillText(s.caption,W/2,H*0.9);}
  }
  function gPresenter(c,s,u){
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    ctx.fillStyle=(SPEC.theme&&SPEC.theme.card)||'#111827';
    roundRect(W*0.06,H*0.08,W*0.6,H*0.78,16);ctx.fill();
    var cap=(s.caption||SPEC.title||'');
    var n=Math.floor(cap.length*ease(u*1.4));
    ctx.fillStyle=INK;ctx.textAlign='left';
    wrapText(cap.slice(0,n),W*0.09,H*0.2,W*0.54,H*0.075,'500 '+Math.round(H*0.05)+'px sans-serif');
    ctx.fillStyle=ACCENT;roundRect(W*0.68,H*0.3,W*0.26,H*0.34,16);ctx.fill();
    ctx.fillStyle=BG;ctx.font='800 '+Math.round(H*0.05)+'px sans-serif';ctx.textAlign='center';
    ctx.fillText('Satchida',W*0.81,H*0.5);
  }
  // ---- Living Landscape / Procedural Art Animator Grammar -----------------
  var bgImg = null;
  if (SPEC.image_url) {
    bgImg = new Image();
    bgImg.onload = function() {
      if (typeof window.film === 'object' && typeof window.film.frame === 'function') {
        window.film.frame(window.__CURRENT_T__ || 0);
      }
    };
    bgImg.src = SPEC.image_url;
  }
  function gLivingLandscape(c, s, u) {
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, W, H);
    } else if (SPEC.image_url) {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      if (!bgImg) { bgImg = new Image(); bgImg.src = SPEC.image_url; }
    } else {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    }

    var globalT = (window.__CURRENT_T__ != null) ? window.__CURRENT_T__ : (u * DURATION);

    // 1. Drifting Atmospheric Mountain Mist (Multi-layered translucent bands)
    for (var m = 0; m < 4; m++) {
      var speed = 18 + m * 14;
      var mistX = ((globalT * speed + m * 480) % (W + 600)) - 300;
      var mistY = H * 0.32 + m * (H * 0.08) + Math.sin(globalT * 0.5 + m) * 15;
      var mistGrad = ctx.createRadialGradient(mistX, mistY, 40, mistX, mistY, W * 0.45);
      mistGrad.addColorStop(0, 'rgba(235, 240, 248, 0.22)');
      mistGrad.addColorStop(0.5, 'rgba(225, 235, 245, 0.12)');
      mistGrad.addColorStop(1, 'rgba(220, 230, 240, 0)');
      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.ellipse(mistX, mistY, W * 0.45, H * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Realistic Mountain Rain Droplets & Splash Ripples
    var rainCount = 140;
    ctx.strokeStyle = 'rgba(215, 228, 242, 0.42)';
    ctx.lineWidth = 1.2;
    for (var r = 0; r < rainCount; r++) {
      var seedR = (r * 997.3) % 1;
      var speedR = 680 + seedR * 420;
      var rx = ((seedR * W + globalT * 120) % (W + 200)) - 100;
      var ry = ((globalT * speedR + seedR * H * 1.8) % (H * 1.15)) - 20;
      var rLen = 16 + seedR * 22;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + rLen);
      ctx.stroke();

      // Splashes on lake surface
      if (ry > H * 0.58 && ry < H * 0.96 && (r % 3 === 0)) {
        var splashU = (globalT * 3 + seedR * 10) % 1;
        var sR = splashU * 14;
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.35 * (1 - splashU)) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(rx, ry, sR, sR * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3. Gliding Himalayan Birds (Dynamic flapping & gliding across ridge)
    for (var b = 0; b < 4; b++) {
      var bSeed = b * 137.5;
      var bSpeed = 48 + b * 16;
      var bx = ((globalT * bSpeed + bSeed * 3.5) % (W + 300)) - 150;
      var by = H * 0.24 + b * 28 + Math.sin(globalT * 0.8 + b) * 12;
      var flap = Math.sin(globalT * 6.5 + b * 2);
      var bSpan = 14 + b * 2;

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(bx - bSpan, by - flap * 6);
      ctx.quadraticCurveTo(bx - bSpan * 0.4, by + flap * 2, bx, by);
      ctx.quadraticCurveTo(bx + bSpan * 0.4, by + flap * 2, bx + bSpan, by - flap * 6);
      ctx.stroke();
    }

    // 4. Subtle Ambient Water Shimmer & Floating Vignette
    var waterGrad = ctx.createLinearGradient(0, H * 0.58, 0, H);
    waterGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    waterGrad.addColorStop(0.5, 'rgba(200, 220, 240, 0.08)');
    waterGrad.addColorStop(1, 'rgba(15, 23, 42, 0.15)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, H * 0.58, W, H * 0.42);

    if (s.caption) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '600 ' + Math.round(H * 0.038) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(s.caption, W / 2, H * 0.92);
      ctx.shadowBlur = 0;
    }
  }

  var GRAMMAR_FN={
    kinetic_type:gKineticType, finance_chart:gFinanceChart, keynote_ui:gKeynoteUI,
    '3b1b':g3b1b, kurzgesagt:gKurzgesagt, vox:gVox, whiteboard:gWhiteboard,
    storytime:gStorytime, presenter_explainer:gPresenter,
    living_landscape:gLivingLandscape, atmospheric_art:gLivingLandscape
  };

  function roundRect(x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function wrapText(text,x,y,maxW,lh,font){
    ctx.font=font;
    var words=text.split(' '),line='',yy=y;
    for(var i=0;i<words.length;i++){
      var t=line+words[i]+' ';
      if(ctx.measureText(t).width>maxW&&line){ctx.fillText(line,x,yy);line=words[i]+' ';yy+=lh;}
      else line=t;
    }
    ctx.fillText(line,x,yy);
  }

  function frame(t){
    t=Math.max(0,Math.min(t,DURATION));
    window.__CURRENT_T__ = t;
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    var at=sceneAt(t);
    var u=at.dur>0?at.local/at.dur:1;
    var fn=GRAMMAR_FN[at.s.grammar]||GRAMMAR_FN.kinetic_type;
    fn(ctx,at.s,u);
    if(SPEC.title){
      ctx.fillStyle='rgba(148,163,184,0.85)';ctx.font='500 '+Math.round(H*0.026)+'px sans-serif';
      ctx.textAlign='left';ctx.fillText(SPEC.title,W*0.03,H*0.965);
    }
    var p=t/DURATION;
    ctx.fillStyle='rgba(148,163,184,0.4)';ctx.fillRect(W*0.03,H*0.94,W*0.94,H*0.008);
    ctx.fillStyle=ACCENT;ctx.fillRect(W*0.03,H*0.94,W*0.94*p,H*0.008);
  }

  // ---- WebAudio foley bus -------------------------------------------------
  var actx=null,muted=false,master=null;
  function audio(){
    if(!actx){
      try{actx=new (window.AudioContext||window.webkitAudioContext)();
        master=actx.createGain();master.gain.value=muted?0:0.8;master.connect(actx.destination);
      }catch(e){actx=null;}
    }
    return actx;
  }
  function playCue(cue){
    var a=audio(); if(!a)return;
    var t0=a.currentTime+(cue.at||0);
    var g=a.createGain();g.connect(master);
    function env(v,dur){g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(v,t0+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);}
    var o=a.createOscillator();o.connect(g);
    var k=cue.sound;
    if(k==='pop'){o.type='sine';o.frequency.setValueAtTime(520,t0);
      o.frequency.exponentialRampToValueAtTime(180,t0+0.12);env(0.5,0.14);o.start(t0);o.stop(t0+0.16);}
    else if(k==='click'){o.type='square';o.frequency.value=1400;env(0.18,0.05);o.start(t0);o.stop(t0+0.06);}
    else if(k==='whoosh'){o.type='sawtooth';o.frequency.setValueAtTime(140,t0);
      o.frequency.exponentialRampToValueAtTime(900,t0+0.28);env(0.16,0.3);o.start(t0);o.stop(t0+0.32);}
    else if(k==='chime'){o.type='sine';o.frequency.value=1318;env(0.35,0.9);o.start(t0);o.stop(t0+0.95);
      var o2=a.createOscillator();o2.type='sine';o2.frequency.value=1760;o2.connect(g);
      o2.start(t0+0.06);o2.stop(t0+0.8);}
    else if(k==='tick'){o.type='square';o.frequency.value=900;env(0.12,0.03);o.start(t0);o.stop(t0+0.04);}
    else{ /* success */ o.type='triangle';o.frequency.setValueAtTime(660,t0);
      o.frequency.setValueAtTime(880,t0+0.09);env(0.3,0.35);o.start(t0);o.stop(t0+0.4);}
  }
  var bgAudio = null;
  if (SPEC.audio_url) {
    try {
      bgAudio = document.createElement('audio');
      bgAudio.id = 'bgm';
      bgAudio.src = SPEC.audio_url;
      bgAudio.loop = true;
      bgAudio.preload = 'auto';
      bgAudio.volume = muted ? 0 : 0.85;
      document.body.appendChild(bgAudio);
    } catch(e) {}
  }

  function setMuted(v){
    muted=!!v;
    if(master)master.gain.value=muted?0:0.8;
    if(bgAudio)bgAudio.muted=muted;
  }

  // Schedule cues relative to playhead; reschedule on seek.
  var scheduled=[], playT0=null, playBase=0;
  function scheduleFrom(base){
    scheduled.forEach(function(id){clearTimeout(id);});scheduled=[];
    CUES.forEach(function(c){
      var dt=(c.t||0)-base;
      if(dt<=0.02)return;
      scheduled.push(setTimeout(function(){
        playCue({sound:c.sound||'pop',at:0});
      },dt*1000));
    });
  }
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='FILM_PLAY'){
      playBase=e.data.time||0;
      playT0=performance.now();
      scheduleFrom(playBase);
      if(bgAudio){
        try{
          if(typeof e.data.time==='number'){ bgAudio.currentTime=e.data.time; }
          bgAudio.play().catch(function(err){});
        }catch(err){}
      }
    }
    else if(e.data&&e.data.type==='FILM_PAUSE'){
      scheduled.forEach(function(id){clearTimeout(id);});scheduled=[];
      if(bgAudio){ try{ bgAudio.pause(); }catch(err){} }
    }
    else if(e.data&&e.data.type==='SEEK_FRAME'){
      playT0=null;
      scheduled.forEach(function(id){clearTimeout(id);});scheduled=[];
      if(typeof e.data.time==='number'){
        frame(e.data.time);
      }
      if(bgAudio){
        if(typeof e.data.time==='number'){
          try{ bgAudio.currentTime=e.data.time; }catch(err){}
        }
        if(bgAudio.paused){
          bgAudio.play().then(function(){
            console.log('[bgAudio] Auto-resumed on seek!');
          }).catch(function(err){
            console.warn('[bgAudio] Auto-resume blocked:', err);
          });
        }
      }
    }
    else if(e.data&&e.data.type==='AUDIO_MUTE'){setMuted(e.data.muted);}
  });

  window.film={frame:frame,duration:DURATION,width:W,height:H,setMuted:setMuted};
  window.__TIMELINE__={pause:function(t){if(t!=null)frame(t);},seek:function(t){frame(t);}};
  window.__SEEK_FRAME__=frame;
  frame(0);
  try {
    window.parent.postMessage({
      type: 'FILM_METADATA',
      duration: DURATION,
      width: W,
      height: H
    }, '*');
  } catch(e) {}
})();
</script>
</body>
</html>
"""


def _build_film_html(spec: dict, cues: list, duration: float, width: int, height: int) -> str:
    title = str(spec.get("title", "Satchida Motion Clip"))[:120]
    grammar = str(spec.get("grammar", "kinetic_type"))
    if grammar not in GRAMMARS:
        grammar = "kinetic_type"
    scenes = spec.get("scenes") or []
    if not isinstance(scenes, list) or not scenes:
        scenes = [{"t": 0, "dur": duration, "grammar": grammar,
                   "words": [str(title).split()[:3] or ["Satchida"]]}]
    safe_spec = {
        "title": title,
        "grammar": grammar,
        "theme": spec.get("theme") or {},
        "scenes": scenes,
        "image_url": spec.get("image_url") or "",
        "audio_url": spec.get("audio_url") or "",
    }
    html = (FILM_TEMPLATE
            .replace("__TITLE__", title)
            .replace("__GRAMMAR__", grammar)
            .replace("__W__", str(width))
            .replace("__H__", str(height))
            .replace("__DUR__", str(duration))
            .replace("__BG__", str((spec.get("theme") or {}).get("bg", "#0b1020")))
            .replace("__SPEC__", json.dumps(safe_spec, ensure_ascii=False))
            .replace("__CUES__", json.dumps(cues)))
    return html


def _wrap_artifact(identifier: str, title: str, html: str) -> str:
    return (
        f'Deliver this motion clip exactly as below inside your reply so it mounts in the Studio panel:\n'
        f':::artifact{{identifier="{identifier}" type="application/vnd.satchida.film" title="{title}"}}\n'
        f'````html\n{html}\n````\n'
        f':::'
    )


# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------

@mcp.tool()
def list_procedural_art_styles() -> str:
    """List every Satchida procedural-art style id with its available reference
    example scenes. Use a returned style id in generate_procedural_art.
    
    [MEDIA OUTPUT TIP]: Deterministic 1920x1080 NumPy/Pillow code paintings (82 fine-art
    styles including Watercolor, Guohua Ink Wash, Ukiyo-e, Synthwave, Pixel Art, Stained Glass,
    and Bauhaus). Pure code execution with zero hallucination or cloud model costs."""
    styles = _list_styles()
    rows = [{"style": k, "examples": v} for k, v in styles.items()]
    return json.dumps({"status": "ok", "count": len(rows), "styles": rows})


@mcp.tool()
def list_motion_grammars() -> str:
    """List the Satchida motion-art grammar ids accepted by
    create_kinetic_motion_clip, with a one-line description of each.
    
    [MEDIA OUTPUT TIP]: Explainer video grammars including 3B1B mathematical proofs,
    kinetic typography, financial charts, Vox paper cutouts, and whiteboard sketches.
    Generates interactive HTML5/SVG animations with optional 30/60fps H.264 MP4 export."""
    descriptions = {
        "3b1b": "Math-style construction: strokes draw circles/squares/spirals with a label",
        "keynote_ui": "macOS-style window card with bullet reveals and accent dots",
        "finance_chart": "Animated line/bar chart with rolling value counter and caption",
        "kurzgesagt": "Flat rounded illustration shapes popping in with a caption",
        "vox": "Highlight-box text lines over paper background with progress bar",
        "whiteboard": "Hand-drawn wobble text sketching itself inside a dashed frame",
        "storytime": "Storybook hill scene with a bouncy round character and caption",
        "kinetic_type": "Stacked kinetic typography, word-by-word reveal with underline sweep",
        "presenter_explainer": "Presenter card + caption typewriter + branded side panel",
        "living_landscape": "Living artwork animator: brings procedural painting/image alive with rain drizzle, mist drift, splashes, birds, and ambient audio",
        "atmospheric_art": "Living artwork animator: brings procedural painting/image alive with rain drizzle, mist drift, splashes, birds, and ambient audio",
    }
    return json.dumps({"status": "ok", "grammars": [
        {"id": g, "description": descriptions.get(g, "Kinetic motion grammar")} for g in GRAMMARS]})


@mcp.tool()
def generate_procedural_art(
    style: str = "",
    prompt: str = "",
    palette: str = "",
    seed: int = 0,
    scene_py: str = "",
    width: int = 1920,
    height: int = 1080,
    filename: str = "",
    user: str = "",
) -> str:
    """[MEDIA TYPE: Deterministic 1920x1080 High-Res Code Painting - PNG File].
    Generates deterministic fine-art paintings through pure Python mathematical rendering
    (NumPy + Pillow) with zero AI diffusion models or cloud APIs.

    [LEARNER TIP - WHEN TO USE]:
    Use this tool whenever a user or art learner requests fine-art painting, traditional media
    recreation (cold-press watercolor, Guohua ink wash, Japanese ukiyo-e woodblock, oil impasto,
    synthwave, anime cells, pixel art), book illustrations, or mathematical geometry.
    Supports 82 historical and modern fine-art styles.
    
    [CODE SYNTHESIS VS REFERENCE SCENES]:
    When the user requests specific scene elements (e.g. specific subjects, buildings, animals,
    or custom compositions), provide complete custom scene code in `scene_py` importing the
    chosen style class from `lib/` so the exact scene is rendered, rather than defaulting
    to a static reference example.
    
    Publishes the rendered PNG directly to the user's Studio Library (/generated/) and returns
    the in-app URL for instant inline embedding in chat and right-panel inspection.

    :param style: a style id from list_procedural_art_styles (e.g. watercolor, inkpaint, synthwave).
    :param prompt: what the picture should show; also used to pick the best reference example.
    :param palette: optional comma-separated hex colours (e.g. '#1a4fb8,#4c9be6') passed to the scene via SATCHIDA_PALETTE.
    :param seed: deterministic seed override (same seed -> same picture).
    :param scene_py: OPTIONAL complete Python scene script (SKILL.md scene contract: import the style class from lib/, compose, save to sys.argv[1]). When empty, the tool runs the best-matching reference example for the style.
    :param width: canvas width hint (scenes may use their own fixed size).
    :param height: canvas height hint.
    :param filename: optional output base name.
    :param user: optional user display name for the Studio Library entry.
    """
    started = time.time()
    styles = _list_styles()
    if not style or style not in styles:
        return json.dumps({"status": "error", "code": "unknown_style",
                           "message": f"Unknown style '{style}'. Call list_procedural_art_styles first."})
    if not os.path.isdir(ART_LIB_DIR):
        return json.dumps({"status": "error", "code": "skill_missing",
                           "message": f"Procedural art skill lib not found at {ART_LIB_DIR}"})

    scene_path = ""
    temp_scene = ""
    if scene_py and scene_py.strip():
        # Agent scenes are run from a neutral temp dir with an explicit lib
        # path header (python -I ignores PYTHONPATH, so the header is required).
        header = (f"import sys, os\nsys.path.insert(0, {ART_LIB_DIR!r})\n"
                  f"sys.path.insert(0, os.path.join({ART_EXAMPLES_DIR!r}, '..', 'lib'))\n")
        fd, scene_path = tempfile.mkstemp(suffix=".py", prefix="satchida_scene_")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(header + scene_py)
        temp_scene = scene_path
    else:
        chosen = _pick_example(style, prompt)
        if not chosen:
            return json.dumps({"status": "error", "code": "no_example",
                               "message": f"No reference example scene found for style '{style}'. Provide scene_py."})
        src = os.path.join(ART_EXAMPLES_DIR, chosen)
        if seed > 0:
            # Copy the patched scene to a TEMP SIBLING inside examples/ so the
            # example's own `../lib` sys.path resolution keeps working under -I.
            patched = _patch_seed(Path(src).read_text(encoding="utf-8"), seed)
            scene_path = os.path.join(ART_EXAMPLES_DIR, f"_seedrun_{uuid.uuid4().hex[:8]}_{chosen}")
            Path(scene_path).write_text(patched, encoding="utf-8")
            temp_scene = scene_path
        else:
            scene_path = src

    out_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", filename.strip()) if filename.strip() else ""
    if not out_name:
        out_name = f"{style}_{int(time.time())}"
    workdir = tempfile.mkdtemp(prefix="satchida_art_")
    out_path = os.path.join(workdir, out_name + ".png")

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    env["SATCHIDA_PALETTE"] = palette or ""
    env["SATCHIDA_WIDTH"] = str(max(256, min(int(width), 4096)))
    env["SATCHIDA_HEIGHT"] = str(max(256, min(int(height), 4096)))
    if seed > 0:
        env["SATCHIDA_SEED"] = str(int(seed))
    # Scenes import style modules from ../lib relative to the examples dir.
    env["INKPAINT_LIB"] = ART_LIB_DIR

    # NOTE: deliberately NOT running with python -I: isolated mode also hides
    # the user site-packages where Pillow/numpy live on this deployment, and
    # every reference scene needs them. The working directory is an empty temp
    # dir and the script path is explicit, so there is no cwd-import surface.
    cmd = [PYTHON_BIN, scene_path, out_path]
    # Example scenes locate lib via their own sys.path insertion; agent scenes
    # may rely on INKPAINT_LIB, so add lib to PYTHONPATH as a convenience.
    env["PYTHONPATH"] = ART_LIB_DIR + os.pathsep + env.get("PYTHONPATH", "")
    try:
        proc = subprocess.run(cmd, cwd=workdir, env=env, timeout=300,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.TimeoutExpired:
        return json.dumps({"status": "error", "code": "timeout",
                           "message": "Scene render exceeded 300s.", "scene": scene_path})
    finally:
        if temp_scene and os.path.exists(temp_scene):
            try:
                os.remove(temp_scene)
            except OSError:
                pass

    if proc.returncode != 0 or not os.path.exists(out_path):
        err = proc.stderr.decode("utf-8", "replace")[-2000:]
        return json.dumps({"status": "error", "code": "render_failed",
                           "message": "Scene script failed.", "stderr_tail": err,
                           "scene": scene_path if not scene_py else "(agent scene)"})

    quality = _validate_render(out_path)
    url = _publish_artifact(Path(out_path), user=user)
    elapsed = round((time.time() - started) * 1000)
    return json.dumps({
        "status": "ok",
        "style": style,
        "url": url,
        "file": out_name + ".png",
        "seed": int(seed) if seed > 0 else None,
        "palette": palette or None,
        "width": quality.get("width") or width,
        "height": quality.get("height") or height,
        "quality": quality,
        "elapsed_ms": elapsed,
        "message": ("Picture published to the Studio Library. Embed it in your reply with a "
                    f"markdown image pointing at {url} so it renders inside the chat."
                    + (" " + quality["warning"] if quality.get("warning") else "")),
    })


@mcp.tool()
def create_kinetic_motion_clip(
    grammar: str = "kinetic_type",
    spec_json: str = "",
    audio_cues: str = "",
    render_mp4: bool = False,
    filename: str = "",
    duration_seconds: float = 8.0,
    fps: int = 30,
    width: int = 1280,
    height: int = 720,
    user: str = "",
) -> str:
    """[MEDIA TYPE: Interactive HTML5/SVG Motion Graphics & 30/60fps H.264 MP4 Explainer Video].
    Compiles deterministic kinetic motion sequences from Satchida Motion Art grammars and a JSON spec.

    [LEARNER TIP - WHEN TO USE]:
    Use this tool whenever a user or student asks for animated educational explainers, mathematical
    vector proofs (3B1B style), kinetic typography lyric/quote reveals, animated financial charts,
    macOS-style Keynote card presentations, Kurzgesagt-style flat vector shapes, or whiteboard
    doodle animations.
    
    Generates an artifact-ready HTML film that mounts inside the LibreChat Studio panel
    (with Play/Pause, Scrubber, Mute/Unmute, and aspect ratio controls). When `render_mp4=True`,
    renders a crisp 60fps H.264 MP4 export through Playwright + FFmpeg and publishes the file
    to the Studio Library (/generated/).

    :param grammar: one of list_motion_grammars ids (default scene grammar).
    :param spec_json: JSON spec: {"title": str, "grammar": str, "theme": {"bg","accent","ink","card","palette":[...]}, "scenes": [{"t": sec, "dur": sec, "grammar": str, ...scene fields}]}. Scene fields per grammar: kinetic_type{words,style}; keynote_ui{window:{title},bullets}; finance_chart{chart:{type:'line'|'bar',data:[..],labels:[..]},caption}; 3b1b{shape:'circle'|'square'|'spiral',turns,label}; kurzgesagt{shapes:[{k:'circle'|'rect'|'triangle',x,y,r|w,h,c}],caption}; vox{lines:[..]}; whiteboard{text}; storytime{caption}; presenter_explainer{caption}.
    :param audio_cues: JSON array of foley cues [{"t": seconds, "sound": "pop"|"click"|"whoosh"|"chime"|"tick"|"success"}].
    :param render_mp4: also render an MP4 (slower; Playwright + FFmpeg).
    :param filename: optional base name for saved copies.
    :param duration_seconds: total clip duration (1-60s).
    :param fps: MP4 frame rate 10-60 (60 = buttery export).
    :param width: canvas width (320-2560).
    :param height: canvas height (320-2560).
    :param user: optional user name for the Studio Library entry.
    """
    started = time.time()
    if not spec_json or not str(spec_json).strip():
        return json.dumps({"status": "error", "code": "no_spec",
                           "message": "spec_json is required: {title, grammar, theme, scenes:[...]}. Call list_motion_grammars for grammar ids."})
    try:
        spec = json.loads(spec_json)
        if not isinstance(spec, dict):
            raise ValueError("spec must be a JSON object")
    except Exception as e:
        return json.dumps({"status": "error", "code": "bad_spec",
                           "message": f"spec_json is not valid JSON: {e}"})
    cues = []
    if audio_cues and str(audio_cues).strip():
        try:
            cues = json.loads(audio_cues)
            if not isinstance(cues, list):
                raise ValueError("audio_cues must be a JSON array")
        except Exception as e:
            return json.dumps({"status": "error", "code": "bad_cues",
                               "message": f"audio_cues is not valid JSON: {e}"})

    duration_seconds = max(1.0, min(float(duration_seconds), 60.0))
    width = max(320, min(int(width), 2560)) - max(320, min(int(width), 2560)) % 2
    height = max(320, min(int(height), 2560)) - max(320, min(int(height), 2560)) % 2

    html = _build_film_html(spec, cues, duration_seconds, width, height)
    slug = re.sub(r"[^a-z0-9\-]+", "-", str(spec.get("title", grammar)).lower()).strip("-") or grammar
    base = re.sub(r"[^a-zA-Z0-9_\-]", "_", filename.strip()) if filename.strip() else f"motion_{slug}_{int(time.time())}"

    # Save a stable HTML copy so the clip has a permalink in the Studio Library.
    html_path = Path(tempfile.mkdtemp(prefix="satchida_film_")) / (base + ".html")
    html_path.write_text(html, encoding="utf-8")
    html_url = _publish_artifact(html_path, user=user)

    # Small, robust in-chat embed: the model emits this 2-line artifact wrapper
    # using application/vnd.satchida.film so OpenFilmStudio mounts it directly.
    embed_html = (
        f':::artifact{{identifier="motion-{slug}" type="application/vnd.satchida.film" '
        f'title="{spec.get("title", "Satchida Motion Clip")}"}}\n'
        f'````html\n<!DOCTYPE html>\n<html><head><meta charset="utf-8">\n'
        f'<style>html,body{{margin:0;height:100%;background:#000}}\n'
        f'iframe{{width:100%;height:100%;border:0;display:block}}</style></head>\n'
        f'<body><iframe src="{html_url}" allow="autoplay"></iframe></body></html>\n'
        f'````\n:::'
    )

    result = {
        "status": "ok",
        "grammar": grammar,
        "title": spec.get("title", ""),
        "duration_seconds": duration_seconds,
        "html_url": html_url,
        "elapsed_ms": round((time.time() - started) * 1000),
        "embed_artifact": embed_html,
        "artifact_html": _wrap_artifact(f"motion-{slug}", str(spec.get("title", "Satchida Motion Clip")), html),
        "message": (
            "PREFERRED DELIVERY: copy `embed_artifact` into your reply verbatim so the clip mounts "
            "inside the Studio side panel (the iframe streams the saved film and stays fully "
            "interactive). Only if the user explicitly needs the standalone source, wrap "
            "`artifact_html` instead."
        ),
    }

    if render_mp4:
        renderer = _load_motion_renderer()
        if renderer is None:
            result["mp4"] = {"status": "error", "code": "renderer_unavailable",
                             "message": "satchida-motion-server.py could not be loaded."}
        else:
            try:
                mp4_json = renderer(html_content=html, filename=base,
                                    duration_seconds=duration_seconds,
                                    fps=max(10, min(int(fps), 60)),
                                    width=width, height=height)
                mp4 = json.loads(mp4_json)
                mp4_file = mp4.get("filename") or mp4.get("file") or mp4.get("output") or ""
                mp4_status = mp4.get("status")
                mp4_url = ""
                if mp4_status == "ok":
                    candidate = Path(r"D:\LAN-AI-Infra\LibreChat\client\public\motion") / str(mp4_file)
                    if mp4_file and candidate.exists():
                        mp4_url = _publish_artifact(candidate, user=user)
                result["mp4"] = {"status": mp4_status, "url": mp4_url,
                                 "raw": mp4 if mp4_status != "ok" else None}
            except Exception as e:
                result["mp4"] = {"status": "error", "code": "render_failed",
                                 "message": str(e)[:500]}
    return json.dumps(result)

@mcp.tool()
def generate_ambient_music(
    prompt: str = 'calm ambient soundscape',
    genre: str = '',
    audio_file: str = '',
    duration_seconds: float = 30.0,
    mood: str = 'meditative',
    filename: str = '',
    user: str = '',
) -> str:
    '''Generate high-fidelity acoustic background music or ambient soundscapes (MP3 file).'''
    import numpy as np, wave

    started = time.time()
    dur = max(5.0, min(float(duration_seconds), 180.0))
    sr = 44100
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    p_lower = (prompt + ' ' + genre + ' ' + mood).lower()

    if audio_file and str(audio_file).strip():
        candidate_paths = [
            Path(audio_file),
            Path(r'd:\LAN-AI-Infra\LibreChat\music_library') / Path(audio_file).name,
            STABLE_GENERATED_DIR / Path(audio_file).name,
            Path(r'd:\LAN-AI-Infra\LibreChat\uploads') / Path(audio_file).name,
        ]
        resolved_file = None
        for cp in candidate_paths:
            if cp.exists() and cp.is_file() and cp.stat().st_size > 1000:
                resolved_file = cp
                break
        if not resolved_file and str(audio_file).startswith('/generated/'):
            gen_p = STABLE_GENERATED_DIR / str(audio_file).replace('/generated/', '')
            if gen_p.exists() and gen_p.is_file():
                resolved_file = gen_p

        if resolved_file:
            try:
                base_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', filename.strip()) if filename.strip() else f'user_audio_{int(time.time())}'
                final_mp3 = Path(tempfile.gettempdir()) / f'{base_name}.mp3'
                fade_start = max(0.0, dur - 2.5)
                subprocess.run([
                    'ffmpeg', '-y', '-i', str(resolved_file),
                    '-t', str(dur), '-af', f'afade=t=out:st={fade_start}:d=2.5',
                    '-b:a', '192k', str(final_mp3)
                ], capture_output=True, timeout=30)
                if final_mp3.exists() and final_mp3.stat().st_size > 1000:
                    url = _publish_artifact(final_mp3, user=user)
                    try:
                        final_mp3.unlink()
                    except OSError:
                        pass
                    return json.dumps({
                        'status': 'ok',
                        'url': url,
                        'duration_seconds': dur,
                        'source': 'user_uploaded_file',
                        'original_file': resolved_file.name,
                        'elapsed_ms': round((time.time() - started) * 1000),
                        'message': f'User-selected audio track mastered and published to Studio Library at {url}.'
                    })
            except Exception as ue:
                print(f'[satchida-art] User audio processing failed: {ue}', file=sys.stderr)

    f_root = 136.1
    if any(k in p_lower for k in ['jazz', 'piano', 'lofi']):
        f_root = 130.81
    elif any(k in p_lower for k in ['zen', 'japanese', 'bamboo']):
        f_root = 146.83
    elif any(k in p_lower for k in ['sitar', 'indian', 'classical', 'himalayan', 'temple', 'shivalik']):
        f_root = 138.59

    drone = (
        0.26 * np.sin(2 * np.pi * f_root * t) +
        0.18 * np.sin(2 * np.pi * (f_root * 1.5) * t) +
        0.12 * np.sin(2 * np.pi * (f_root * 2.0) * t) +
        0.20 * np.sin(2 * np.pi * (f_root * 0.5) * t)
    )
    drone += 0.08 * np.sin(2 * np.pi * (f_root * 3.0) * t)
    drone *= (1.0 + 0.08 * np.sin(2 * np.pi * 0.2 * t))

    pentatonic = [f_root * 2.0, f_root * 2.25, f_root * 2.5, f_root * 3.0, f_root * 3.375, f_root * 4.0]
    melody = np.zeros_like(t)
    curr_t = 1.0
    rng = np.random.RandomState(42)
    while curr_t < dur - 2.0:
        note_dur = float(rng.uniform(1.8, 3.2))
        freq = float(rng.choice(pentatonic))
        mask = (t >= curr_t) & (t < curr_t + note_dur)
        if np.any(mask):
            nt = t[mask] - curr_t
            env = np.sin(np.pi * (nt / note_dur)) ** 1.3
            vib = 1.0 + 0.012 * np.sin(2 * np.pi * 5.4 * nt)
            tone = (
                np.sin(2 * np.pi * freq * vib * nt) +
                0.35 * np.sin(2 * np.pi * freq * 2.0 * vib * nt) +
                0.12 * np.sin(2 * np.pi * freq * 3.0 * vib * nt) +
                0.03 * rng.normal(0, 0.1, len(nt))
            )
            melody[mask] += tone * env * 0.28
        curr_t += note_dur + float(rng.uniform(0.4, 1.2))

    nature = np.zeros_like(t)
    if any(k in p_lower for k in ['rain', 'water', 'lake', 'mist', 'river', 'stream', 'ocean']):
        noise = rng.normal(0, 0.05, len(t))
        w = 12
        nature += np.convolve(noise, np.ones(w)/w, mode='same') * 0.25

    bells = np.zeros_like(t)
    if any(k in p_lower for k in ['bell', 'chime', 'temple', 'bowl', 'shikara', 'himalayan', 'morning']):
        bell_times = np.arange(2.0, dur - 1.0, float(rng.uniform(4.5, 7.5)))
        for bt in bell_times:
            bf = float(rng.choice([587.33, 880.0, 1174.66, 659.25]))
            mask = (t >= bt) & (t < bt + 4.0)
            if np.any(mask):
                b_nt = t[mask] - bt
                b_env = np.exp(-b_nt * 0.9)
                b_tone = (
                    np.sin(2 * np.pi * bf * b_nt) +
                    0.45 * np.sin(2 * np.pi * (bf * 2.76) * b_nt) +
                    0.20 * np.sin(2 * np.pi * (bf * 5.4) * b_nt)
                )
                bells[mask] += b_tone * b_env * 0.16

    master = drone + melody + nature + bells
    max_val = np.max(np.abs(master)) + 1e-6
    master = (master / max_val * 0.9)
    master_i16 = (master * 32767).astype(np.int16)

    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as wf_tmp:
        wav_path = wf_tmp.name
    with wave.open(wav_path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(master_i16.tobytes())

    base_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', filename.strip()) if filename.strip() else f'soundscape_{int(time.time())}'
    out_mp3 = Path(tempfile.gettempdir()) / f'{base_name}.mp3'
    fade_start = max(0.0, dur - 2.5)
    subprocess.run([
        'ffmpeg', '-y', '-i', wav_path,
        '-af', f'afade=t=out:st={fade_start}:d=2.5',
        '-b:a', '192k', str(out_mp3)
    ], capture_output=True, timeout=30)
    try:
        os.remove(wav_path)
    except OSError:
        pass

    url = _publish_artifact(out_mp3, user=user)
    try:
        out_mp3.unlink()
    except OSError:
        pass

    return json.dumps({
        'status': 'ok',
        'url': url,
        'duration_seconds': dur,
        'mood': mood,
        'provider': 'acoustic_physical_synthesis',
        'elapsed_ms': round((time.time() - started) * 1000),
        'message': f'Synthesized mastered acoustic soundscape published to Studio Library at {url}.'
    })

if __name__ == '__main__':
    mcp.run()
