// Single source of truth: Architectural CAD 2D + Photorealistic Three.js 3D Engine
const PLAN = window.SATCHIDA_CAD_PLAN || { width: 40, depth: 35, rooms: [], walls: [], furniture: [] };

let state = { mode: "2d", showFurn: true, showDims: true, cutaway: false, sunHour: 10.5, autoOrbit: false, camType: "iso" };

function getPlanBounds() {
  let minX = 0, minZ = 0, maxX = Number(PLAN.width) || 40, maxZ = Number(PLAN.depth) || 35;
  for (const r of PLAN.rooms || []) {
    minX = Math.min(minX, r.x); minZ = Math.min(minZ, r.z);
    maxX = Math.max(maxX, r.x + r.w); maxZ = Math.max(maxZ, r.z + r.d);
  }
  for (const w of PLAN.walls || []) {
    minX = Math.min(minX, w.x1, w.x2); minZ = Math.min(minZ, w.z1, w.z2);
    maxX = Math.max(maxX, w.x1, w.x2); maxZ = Math.max(maxZ, w.z1, w.z2);
  }
  return { minX, minZ, maxX, maxZ, spanW: Math.max(10, maxX - minX), spanD: Math.max(10, maxZ - minZ) };
}

// ==================== 1. 2D ARCHITECTURAL CAD RENDERER ====================
const cadCanvas = document.getElementById("cad-2d");
const ctx = cadCanvas.getContext("2d");

function normOpenings(w) {
  const horiz = Math.abs(w.z1 - w.z2) < 0.01;
  const start = horiz ? Math.min(w.x1, w.x2) : Math.min(w.z1, w.z2);
  const end = horiz ? Math.max(w.x1, w.x2) : Math.max(w.z1, w.z2);
  return (w.openings || [])
    .map((op) => {
      const rawAt = Number(op.at) || 0;
      const rawLen = Number(op.len) || 0;
      const at = Math.max(start, rawAt < start - 0.01 ? start + rawAt : rawAt);
      const len = Math.max(0, Math.min(rawLen, end - at));
      return { ...op, at, len };
    })
    .filter((op) => op.len > 0.05)
    .sort((a, b) => a.at - b.at);
}

function splitWallSegments(w) {
  const horiz = Math.abs(w.z1 - w.z2) < 0.01;
  const start = horiz ? Math.min(w.x1, w.x2) : Math.min(w.z1, w.z2);
  const end = horiz ? Math.max(w.x1, w.x2) : Math.max(w.z1, w.z2);
  const ops = normOpenings(w);
  const segs = [];
  let cur = start;
  for (const op of ops) {
    if (op.at > cur) segs.push({ a: cur, b: op.at });
    cur = Math.max(cur, op.at + op.len);
  }
  if (cur < end) segs.push({ a: cur, b: end });
  return { horiz, fixed: horiz ? w.z1 : w.x1, segs, ops, start, end };
}

function getViewportSize() {
  const wrap = document.getElementById("stage-wrap");
  const w = (wrap && wrap.clientWidth) || window.innerWidth || 960;
  const h = (wrap && wrap.clientHeight) || window.innerHeight || 640;
  return { w: Math.max(w, 320), h: Math.max(h, 240) };
}

function draw2DFurniture(f, px, py, scale) {
  const fx = px(f.x), fy = py(f.z), fw = f.w * scale, fd = f.d * scale;
  ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
  ctx.strokeStyle = "#7dd3fc";
  ctx.lineWidth = 1.25;
  ctx.fillRect(fx, fy, fw, fd);
  ctx.strokeRect(fx, fy, fw, fd);

  if (f.type === "bed") {
    ctx.fillStyle = "rgba(248, 250, 252, 0.18)";
    ctx.fillRect(fx + 3, fy + 3, fw - 6, Math.max(4, fd * 0.12));
    ctx.strokeRect(fx + 4, fy + Math.max(6, fd * 0.14), fw * 0.41, fd * 0.2);
    ctx.strokeRect(fx + fw * 0.52, fy + Math.max(6, fd * 0.14), fw * 0.41, fd * 0.2);
  } else if (f.type === "sofa") {
    const arm = Math.max(3, Math.min(fw, fd) * 0.18);
    ctx.strokeRect(fx, fy, fw, arm);
    ctx.strokeRect(fx, fy, arm, fd);
    ctx.strokeRect(fx + fw - arm, fy, arm, fd);
  } else if (f.type === "dining") {
    const chairs = Math.max(2, Math.round(fw / (2.2 * scale)));
    for (let i = 0; i < chairs; i++) {
      const cx = fx + (i + 0.5) * (fw / chairs);
      ctx.beginPath(); ctx.arc(cx, fy - 4, 3.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, fy + fd + 4, 3.2, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (f.type === "kitchen") {
    ctx.strokeRect(fx + fw * 0.1, fy + fd * 0.2, fw * 0.28, fd * 0.6);
    const bx = fx + fw * 0.62, by = fy + fd * 0.3;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      ctx.beginPath(); ctx.arc(bx + c * 7, by + r * 7, 2.3, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (f.type === "bath") {
    ctx.beginPath(); ctx.ellipse(fx + fw * 0.3, fy + fd * 0.5, Math.max(3, fw * 0.18), Math.max(4, fd * 0.28), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(fx + fw * 0.58, fy + fd * 0.18, fw * 0.32, fd * 0.64);
  } else if (f.type === "desk") {
    ctx.strokeRect(fx + fw * 0.25, fy + 3, fw * 0.5, 4);
    ctx.beginPath(); ctx.arc(fx + fw * 0.5, fy + fd + 5, 4, 0, Math.PI * 2); ctx.stroke();
  }
}

function draw2D() {
  const dpr = window.devicePixelRatio || 1;
  const { w: W, h: H } = getViewportSize();
  cadCanvas.width = W * dpr; cadCanvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#07111f";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 28) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 28) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

  const bounds = getPlanBounds();
  const narrow = W < 760;
  const padLeft = narrow ? 48 : 90;
  const padRight = narrow ? 28 : 90;
  const padTop = narrow ? 225 : 96;
  const padBottom = 72;
  const scale = Math.min((W - padLeft - padRight) / bounds.spanW, (H - padTop - padBottom) / bounds.spanD);
  const ox = padLeft + ((W - padLeft - padRight) - bounds.spanW * scale) / 2 - bounds.minX * scale;
  const oy = padTop + ((H - padTop - padBottom) - bounds.spanD * scale) / 2 - bounds.minZ * scale;
  const px = (x) => ox + x * scale;
  const py = (z) => oy + z * scale;

  for (const r of PLAN.rooms || []) {
    ctx.fillStyle = r.tint || "rgba(56, 189, 248, 0.08)";
    ctx.fillRect(px(r.x), py(r.z), r.w * scale, r.d * scale);
    ctx.strokeStyle = "rgba(56,189,248,0.18)";
    ctx.strokeRect(px(r.x), py(r.z), r.w * scale, r.d * scale);
  }

  if (state.showFurn) {
    for (const f of PLAN.furniture || []) draw2DFurniture(f, px, py, scale);
  }

  for (const w of PLAN.walls || []) {
    const { horiz, fixed, segs, ops } = splitWallSegments(w);
    const thick = Math.max(2, (w.t || 0.4) * scale);
    if (w.kind === "rail") {
      ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(px(w.x1), py(w.z1)); ctx.lineTo(px(w.x2), py(w.z2)); ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    ctx.fillStyle = w.kind === "ext" ? "#e2e8f0" : "#94a3b8";
    for (const s of segs) {
      if (horiz) ctx.fillRect(px(s.a), py(fixed) - thick / 2, (s.b - s.a) * scale, thick);
      else ctx.fillRect(px(fixed) - thick / 2, py(s.a), thick, (s.b - s.a) * scale);
    }
    for (const op of ops) {
      if (op.kind === "win") {
        ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = Math.max(2, thick * 0.55); ctx.beginPath();
        if (horiz) { ctx.moveTo(px(op.at), py(fixed)); ctx.lineTo(px(op.at + op.len), py(fixed)); }
        else { ctx.moveTo(px(fixed), py(op.at)); ctx.lineTo(px(fixed), py(op.at + op.len)); }
        ctx.stroke();
      } else if (op.kind === "door") {
        const r = op.len * scale, dir = op.swing || 1;
        ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.4;
        if (horiz) {
          const hx = px(op.at), hy = py(fixed);
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + dir * r); ctx.stroke();
          ctx.setLineDash([4, 3]); ctx.beginPath();
          ctx.arc(hx, hy, r, dir > 0 ? 0 : -Math.PI / 2, dir > 0 ? Math.PI / 2 : 0); ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const hx = px(fixed), hy = py(op.at);
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dir * r, hy); ctx.stroke();
          ctx.setLineDash([4, 3]); ctx.beginPath();
          ctx.arc(hx, hy, r, dir > 0 ? 0 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  if (state.showDims) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const r of PLAN.rooms || []) {
      const rcx = px(r.x + r.w / 2), rcy = py(r.z + r.d / 2);
      const maxW = Math.max(38, r.w * scale - 8);
      const fTitle = Math.max(7.5, Math.min(10.5, Math.floor((r.w * scale) / 10)));
      const fSub = Math.max(7, Math.min(9, fTitle - 1.5));
      const subText = `${r.w}'×${r.d}' · ${Math.round(r.w * r.d)} sf`;
      ctx.font = `700 ${fTitle}px Inter, system-ui, sans-serif`;
      const tw = Math.min(maxW, Math.max(ctx.measureText(r.name).width, ctx.measureText(subText).width));
      ctx.fillStyle = "rgba(7, 17, 31, 0.82)";
      ctx.fillRect(rcx - tw / 2 - 4, rcy - fTitle - 3, tw + 8, fTitle + fSub + 10);
      ctx.fillStyle = "#f8fafc"; ctx.fillText(r.name, rcx, rcy - 4, maxW);
      ctx.font = `500 ${fSub}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#7dd3fc"; ctx.fillText(subText, rcx, rcy + fTitle * 0.65, maxW);
    }
    ctx.textBaseline = "alphabetic";
    ctx.strokeStyle = "#38bdf8"; ctx.fillStyle = "#7dd3fc"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px(0), py(bounds.minZ) - 18); ctx.lineTo(px(PLAN.width), py(bounds.minZ) - 18);
    ctx.moveTo(px(0), py(bounds.minZ) - 23); ctx.lineTo(px(0), py(bounds.minZ) - 13);
    ctx.moveTo(px(PLAN.width), py(bounds.minZ) - 23); ctx.lineTo(px(PLAN.width), py(bounds.minZ) - 13);
    ctx.moveTo(px(bounds.minX) - 18, py(0)); ctx.lineTo(px(bounds.minX) - 18, py(PLAN.depth));
    ctx.moveTo(px(bounds.minX) - 23, py(0)); ctx.lineTo(px(bounds.minX) - 13, py(0));
    ctx.moveTo(px(bounds.minX) - 23, py(PLAN.depth)); ctx.lineTo(px(bounds.minX) - 13, py(PLAN.depth));
    ctx.stroke();
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText(`${PLAN.width} ft (${(PLAN.width * 0.3048).toFixed(1)} m)`, px(PLAN.width / 2), py(bounds.minZ) - 25);
    ctx.save(); ctx.translate(px(bounds.minX) - 28, py(PLAN.depth / 2)); ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${PLAN.depth} ft (${(PLAN.depth * 0.3048).toFixed(1)} m)`, 0, 0); ctx.restore();
  }
}

// ==================== 2. PHOTOREALISTIC THREE.JS ARCHVIZ RENDERER ====================
const webglCanvas = document.getElementById("webgl-3d");
let renderer, scene, camera, controls, sunLight, interiorLight1, interiorLight2, ceilingGroup;
const wallMeshes = [], furnMeshes = [];

function makeWoodTexture(hexA, hexB, repX = 3, repY = 3) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = hexA; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 64; i++) {
    g.fillStyle = i % 2 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.025)";
    g.fillRect(0, i * 4, 256, 2);
  }
  g.strokeStyle = hexB; g.lineWidth = 1.6;
  for (let y = 0; y < 256; y += 32) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    const off = ((y / 32) % 2) ? 96 : 176;
    g.beginPath(); g.moveTo(off, y); g.lineTo(off, y + 32); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repX, repY);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makePlasterTexture(baseHex, speckAlpha) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = baseHex; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const x = (i * 73) % 256, y = (i * 137) % 256;
    g.fillStyle = i % 2 ? `rgba(0,0,0,${speckAlpha})` : `rgba(255,255,255,${speckAlpha})`;
    g.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeTileTexture(hexA, hexB) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = hexA; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = "rgba(0,0,0,0.025)";
    g.fillRect((i * 53) % 256, (i * 97) % 256, 3, 3);
  }
  g.strokeStyle = hexB; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
  if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function buildStudioEnvMap(renderer) {
  if (!THREE.PMREMGenerator) return null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x18263a);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(40, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x3b5370, side: THREE.BackSide })
  );
  envScene.add(sky);
  const keyPanel = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshBasicMaterial({ color: 0xfff5e4, side: THREE.DoubleSide }));
  keyPanel.position.set(18, 22, 16); keyPanel.lookAt(0, 0, 0); envScene.add(keyPanel);
  const fillPanel = new THREE.Mesh(new THREE.PlaneGeometry(28, 16), new THREE.MeshBasicMaterial({ color: 0xcbe4ff, side: THREE.DoubleSide }));
  fillPanel.position.set(-22, 14, -12); fillPanel.lookAt(0, 0, 0); envScene.add(fillPanel);
  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}

function addPart(group, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function createFurniture3D(f, cx, cz, sharedMats) {
  const group = new THREE.Group();
  const fw = Number(f.w) || 2, fd = Number(f.d) || 2, fh = Number(f.h) || 2.5;
  const { walnutMat, oakMat, linenMat, charcoalFabric, marbleMat, chromeMat, darkGlassMat, ceramicMat, lampGlowMat } = sharedMats;

  if (f.type === "sofa") {
    // Woven area rug under sofa
    addPart(group, new THREE.BoxGeometry(fw * 1.18, 0.04, fd * 1.75), sharedMats.rugMat, 0, 0.02, fd * 0.35);
    // Tapered walnut legs
    for (const lx of [-fw * 0.44, fw * 0.44]) for (const lz of [-fd * 0.4, fd * 0.4]) {
      addPart(group, new THREE.CylinderGeometry(0.11, 0.07, 0.38, 10), walnutMat, lx, 0.19, lz);
    }
    // Upholstered base deck
    addPart(group, new THREE.BoxGeometry(fw, 0.42, fd), charcoalFabric, 0, 0.58, 0);
    // 3 individual plush seat cushions
    const cw = (fw * 0.82) / 3;
    for (let i = -1; i <= 1; i++) {
      addPart(group, new THREE.BoxGeometry(cw - 0.08, 0.36, fd * 0.72), sharedMats.sofaSeatMat, i * cw, 0.96, fd * 0.08);
      addPart(group, new THREE.BoxGeometry(cw - 0.1, 0.92, fd * 0.2), sharedMats.sofaSeatMat, i * cw, 1.48, -fd * 0.28, -0.12, 0, 0);
    }
    // Back frame + sculpted armrests + throw pillows
    addPart(group, new THREE.BoxGeometry(fw, 1.38, fd * 0.18), charcoalFabric, 0, 1.28, -fd * 0.41);
    addPart(group, new THREE.BoxGeometry(fw * 0.1, 1.05, fd * 0.96), charcoalFabric, -fw * 0.45, 1.08, 0);
    addPart(group, new THREE.BoxGeometry(fw * 0.1, 1.05, fd * 0.96), charcoalFabric, fw * 0.45, 1.08, 0);
    addPart(group, new THREE.BoxGeometry(0.95, 0.75, 0.32), sharedMats.accentPillowMat, -fw * 0.32, 1.38, -fd * 0.15, 0, 0.35, 0.12);
    addPart(group, new THREE.BoxGeometry(0.95, 0.75, 0.32), sharedMats.accentPillowMat, fw * 0.32, 1.38, -fd * 0.15, 0, -0.35, -0.12);
  } else if (f.type === "bed") {
    // Upholstered platform frame + tufted headboard
    addPart(group, new THREE.BoxGeometry(fw * 1.15, 0.03, fd * 1.08), sharedMats.rugMat, 0, 0.015, 0.2);
    addPart(group, new THREE.BoxGeometry(fw, 0.58, fd), walnutMat, 0, 0.36, 0);
    addPart(group, new THREE.BoxGeometry(fw * 1.04, 2.55, 0.32), charcoalFabric, 0, 1.35, -fd / 2 + 0.14);
    // Layered mattress + crisp linen sheet + folded duvet + 4 pillows
    addPart(group, new THREE.BoxGeometry(fw * 0.93, 0.56, fd * 0.92), linenMat, 0, 0.92, 0.1);
    addPart(group, new THREE.BoxGeometry(fw * 0.96, 0.24, fd * 0.58), sharedMats.duvetMat, 0, 1.22, fd * 0.19);
    addPart(group, new THREE.BoxGeometry(fw * 0.97, 0.12, fd * 0.16), sharedMats.accentPillowMat, 0, 1.32, fd * 0.38);
    for (const px of [-fw * 0.23, fw * 0.23]) {
      addPart(group, new THREE.BoxGeometry(fw * 0.36, 0.24, fd * 0.14), linenMat, px, 1.28, -fd * 0.31, 0.18, 0, 0);
      addPart(group, new THREE.BoxGeometry(fw * 0.32, 0.22, fd * 0.11), sharedMats.accentPillowMat, px, 1.34, -fd * 0.24, 0.32, 0, 0);
    }
    // Flanking nightstands with warm glowing lamps
    for (const sx of [-fw * 0.62, fw * 0.62]) {
      addPart(group, new THREE.BoxGeometry(1.4, 1.35, 1.3), walnutMat, sx, 0.68, -fd * 0.38);
      addPart(group, new THREE.CylinderGeometry(0.12, 0.18, 0.45, 10), chromeMat, sx, 1.58, -fd * 0.38);
      addPart(group, new THREE.CylinderGeometry(0.28, 0.42, 0.55, 14), lampGlowMat, sx, 2.02, -fd * 0.38);
    }
  } else if (f.type === "dining") {
    // Oak dining table with chamfered edge + angled mid-century legs + centerpiece
    addPart(group, new THREE.BoxGeometry(fw, 0.2, fd), oakMat, 0, fh - 0.1, 0);
    for (const lx of [-fw * 0.42, fw * 0.42]) for (const lz of [-fd * 0.38, fd * 0.38]) {
      addPart(group, new THREE.CylinderGeometry(0.14, 0.1, fh - 0.16, 10), walnutMat, lx, (fh - 0.16) / 2, lz);
    }
    // Centerpiece ceramic bowl
    addPart(group, new THREE.CylinderGeometry(0.65, 0.35, 0.28, 14), ceramicMat, 0, fh + 0.14, 0);
    const chairs = Math.max(2, Math.round(fw / 2.3));
    for (let i = 0; i < chairs; i++) {
      const cxOff = -fw * 0.36 + (chairs > 1 ? (i / (chairs - 1)) * fw * 0.72 : 0);
      for (const side of [-1, 1]) {
        const czOff = side * (fd * 0.5 + 0.85);
        addPart(group, new THREE.BoxGeometry(1.15, 0.16, 1.15), sharedMats.sofaSeatMat, cxOff, 1.46, czOff);
        addPart(group, new THREE.BoxGeometry(1.15, 1.25, 0.14), oakMat, cxOff, 2.08, czOff + side * 0.52);
        for (const clx of [-0.46, 0.46]) for (const clz of [-0.46, 0.46]) {
          addPart(group, new THREE.CylinderGeometry(0.06, 0.04, 1.4, 8), walnutMat, cxOff + clx, 0.7, czOff + clz);
        }
      }
    }
  } else if (f.type === "kitchen") {
    // Shaker cabinet base + Carrara marble counter + stainless sink + chrome faucet + induction cooktop
    addPart(group, new THREE.BoxGeometry(fw, fh - 0.22, fd), sharedMats.cabinetMat, 0, (fh - 0.22) / 2, 0);
    addPart(group, new THREE.BoxGeometry(fw + 0.16, 0.22, fd + 0.16), marbleMat, 0, fh - 0.11, 0);
    addPart(group, new THREE.BoxGeometry(fw * 0.28, 0.08, fd * 0.62), chromeMat, -fw * 0.26, fh + 0.02, 0);
    addPart(group, new THREE.CylinderGeometry(0.06, 0.06, 0.65, 8), chromeMat, -fw * 0.26, fh + 0.34, -fd * 0.22);
    addPart(group, new THREE.BoxGeometry(fw * 0.32, 0.06, fd * 0.65), darkGlassMat, fw * 0.24, fh + 0.02, 0);
  } else if (f.type === "desk") {
    // Walnut study desk + ultrawide monitor + desk lamp + ergonomic chair
    addPart(group, new THREE.BoxGeometry(fw, 0.18, fd), walnutMat, 0, fh - 0.09, 0);
    for (const lx of [-fw * 0.44, fw * 0.44]) for (const lz of [-fd * 0.4, fd * 0.4]) {
      addPart(group, new THREE.CylinderGeometry(0.09, 0.07, fh - 0.16, 8), chromeMat, lx, (fh - 0.16) / 2, lz);
    }
    addPart(group, new THREE.BoxGeometry(fw * 0.46, 1.25, 0.1), darkGlassMat, 0, fh + 0.78, -fd * 0.24);
    addPart(group, new THREE.BoxGeometry(0.22, 0.35, 0.22), chromeMat, 0, fh + 0.17, -fd * 0.24);
    addPart(group, new THREE.CylinderGeometry(0.18, 0.28, 0.38, 12), lampGlowMat, fw * 0.34, fh + 0.85, -fd * 0.2);
    addPart(group, new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), chromeMat, fw * 0.34, fh + 0.35, -fd * 0.2);
    // Ergonomic chair
    addPart(group, new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), chromeMat, 0, 0.7, fd * 0.78);
    addPart(group, new THREE.BoxGeometry(1.35, 0.18, 1.3), charcoalFabric, 0, 1.45, fd * 0.78);
    addPart(group, new THREE.BoxGeometry(1.3, 1.45, 0.16), charcoalFabric, 0, 2.2, fd * 1.36);
  } else if (f.type === "table") {
    // Marble coffee table + black steel frame + decorative book/tray
    addPart(group, new THREE.BoxGeometry(fw, 0.16, fd), marbleMat, 0, fh - 0.08, 0);
    for (const lx of [-fw * 0.42, fw * 0.42]) for (const lz of [-fd * 0.38, fd * 0.38]) {
      addPart(group, new THREE.CylinderGeometry(0.07, 0.06, fh - 0.14, 8), darkGlassMat, lx, (fh - 0.14) / 2, lz);
    }
    addPart(group, new THREE.BoxGeometry(fw * 0.3, 0.12, fd * 0.42), walnutMat, -fw * 0.15, fh + 0.06, 0);
  } else if (f.type === "bath") {
    // Ceramic WC + floating walnut vanity with vessel sink + backlit mirror
    addPart(group, new THREE.CylinderGeometry(0.62, 0.48, 1.35, 14), ceramicMat, -fw * 0.26, 0.68, 0.15);
    addPart(group, new THREE.BoxGeometry(1.2, 1.5, 0.65), ceramicMat, -fw * 0.26, 1.35, -fd * 0.28);
    addPart(group, new THREE.BoxGeometry(fw * 0.46, 1.45, fd * 0.72), walnutMat, fw * 0.24, 1.35, 0);
    addPart(group, new THREE.BoxGeometry(fw * 0.48, 0.14, fd * 0.74), marbleMat, fw * 0.24, 2.12, 0);
    addPart(group, new THREE.CylinderGeometry(0.48, 0.4, 0.35, 14), ceramicMat, fw * 0.24, 2.32, 0);
    addPart(group, new THREE.BoxGeometry(fw * 0.42, 2.4, 0.08), chromeMat, fw * 0.24, 4.1, -fd * 0.34);
  } else if (f.type === "wardrobe") {
    addPart(group, new THREE.BoxGeometry(fw, fh, fd), oakMat, 0, fh / 2, 0);
    addPart(group, new THREE.BoxGeometry(0.05, fh * 0.92, 0.06), walnutMat, 0, fh / 2, fd / 2 + 0.02);
    for (const hx of [-0.25, 0.25]) {
      addPart(group, new THREE.BoxGeometry(0.06, 1.1, 0.08), chromeMat, hx, fh * 0.5, fd / 2 + 0.05);
    }
  } else if (f.type === "planter") {
    addPart(group, new THREE.CylinderGeometry(fw * 0.42, fw * 0.3, fh * 0.48, 14), ceramicMat, 0, fh * 0.24, 0);
    addPart(group, new THREE.DodecahedronGeometry(fw * 0.46, 1), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 }), 0, fh * 0.76, 0);
  } else {
    addPart(group, new THREE.BoxGeometry(fw, fh, fd), oakMat, 0, fh / 2, 0);
  }

  group.position.set(f.x + fw / 2 - cx, 0.12, f.z + fd / 2 - cz);
  return group;
}

function init3D() {
  if (!window.THREE) return;
  const { w: W, h: H } = getViewportSize();
  renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
  }
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b1526");
  scene.fog = new THREE.Fog("#0b1526", 85, 190);

  const envTex = buildStudioEnvMap(renderer);
  if (envTex) scene.environment = envTex;

  camera = new THREE.PerspectiveCamera(44, W / H, 0.4, 220);
  camera.position.set(30, 34, 48);

  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, webglCanvas);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);
    controls.addEventListener("change", () => { if (state.mode === "3d") renderer.render(scene, camera); });
  }

  scene.add(new THREE.AmbientLight(0xeef6ff, 0.36));
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x2a241e, 0.52));
  sunLight = new THREE.DirectionalLight(0xfff4e0, 1.45);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.camera.left = -38; sunLight.shadow.camera.right = 38;
  sunLight.shadow.camera.top = 38; sunLight.shadow.camera.bottom = -38;
  scene.add(sunLight);

  interiorLight1 = new THREE.PointLight(0xffdfba, 0.0, 36, 1.4);
  interiorLight1.position.set(-8, 8.2, -5);
  scene.add(interiorLight1);
  interiorLight2 = new THREE.PointLight(0xfff1dc, 0.0, 34, 1.4);
  interiorLight2.position.set(8, 8.2, 6);
  scene.add(interiorLight2);

  updateSun(state.sunHour);

  const bounds = getPlanBounds();
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  const grid = new THREE.GridHelper(120, 60, 0x1e3a5f, 0x102036);
  grid.position.y = -0.06;
  scene.add(grid);

  const woodFloorTex = makeWoodTexture("#b88c5e", "#875f38", 3, 3);
  const stoneTileTex = makeTileTexture("#d2d6dc", "#9ca3af");
  const deckTex = makeWoodTexture("#78553a", "#523723", 4, 2);
  const plasterTex = makePlasterTexture("#ebe7df", 0.025);
  const concreteTex = makePlasterTexture("#b8bec7", 0.035);

  for (const r of PLAN.rooms || []) {
    const id = (r.id || r.name || "").toLowerCase();
    const isTile = /bath|kitchen|foyer|servant/.test(id);
    const isDeck = /balcony|deck|porch/.test(id);
    const mat = new THREE.MeshStandardMaterial({
      color: isDeck ? 0xd6bfa9 : isTile ? 0xe5e7eb : 0xf3e5d3,
      map: isDeck ? deckTex : isTile ? stoneTileTex : woodFloorTex,
      roughness: isTile ? 0.35 : 0.62,
      metalness: 0.04,
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.24, r.d), mat);
    slab.position.set(r.x + r.w / 2 - cx, 0, r.z + r.d / 2 - cz);
    slab.receiveShadow = true;
    scene.add(slab);
  }

  // Subtle architectural ceiling for First-Person Interior mode
  ceilingGroup = new THREE.Group();
  const ceilSlab = new THREE.Mesh(
    new THREE.BoxGeometry(PLAN.width, 0.2, PLAN.depth),
    new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 })
  );
  ceilSlab.position.set(PLAN.width / 2 - cx, 9.22, PLAN.depth / 2 - cz);
  ceilingGroup.add(ceilSlab);
  for (const [lx, lz] of [[8, 6], [16, 12], [6, 26], [30, 8]]) {
    const fixture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff5dc })
    );
    fixture.position.set(lx - cx, 9.1, lz - cz);
    ceilingGroup.add(fixture);
  }
  ceilingGroup.visible = false;
  scene.add(ceilingGroup);

  const wallExtMat = new THREE.MeshStandardMaterial({ color: 0xf2eee6, map: plasterTex, roughness: 0.82, metalness: 0.02 });
  const wallIntMat = new THREE.MeshStandardMaterial({ color: 0xdad7cf, map: concreteTex, roughness: 0.85, metalness: 0.02 });
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x3b2d23, roughness: 0.55 });
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x7c4d2b, map: woodFloorTex, roughness: 0.5 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
  const wallH = 9.0;

  function addWallBlock(x, y, z, bw, bh, bd, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
    m.position.set(x - cx, y, z - cz);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    wallMeshes.push({ mesh: m, fullH: bh, fullY: y });
  }

  for (const w of PLAN.walls || []) {
    const { horiz, fixed, segs, ops } = splitWallSegments(w);
    const mat = w.kind === "ext" ? wallExtMat : wallIntMat;
    if (w.kind === "rail") {
      const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.16, 3.2, horiz ? 0.16 : len), glassMat);
      rail.position.set((w.x1 + w.x2) / 2 - cx, 1.72, (w.z1 + w.z2) / 2 - cz);
      scene.add(rail); wallMeshes.push({ mesh: rail, fullH: 3.2, fullY: 1.72 });
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.22, 0.12, horiz ? 0.22 : len), mullionMat);
      topBar.position.set((w.x1 + w.x2) / 2 - cx, 3.35, (w.z1 + w.z2) / 2 - cz);
      scene.add(topBar); wallMeshes.push({ mesh: topBar, fullH: 0.12, fullY: 3.35 });
      continue;
    }
    for (const s of segs) {
      const len = s.b - s.a;
      if (len < 0.05) continue;
      const mx = horiz ? s.a + len / 2 : fixed, mz = horiz ? fixed : s.a + len / 2;
      addWallBlock(mx, wallH / 2 + 0.12, mz, horiz ? len : w.t, wallH, horiz ? w.t : len, mat);
      // Dark walnut baseboard trim
      addWallBlock(mx, 0.32, mz, horiz ? len : w.t + 0.08, 0.4, horiz ? w.t + 0.08 : len, baseboardMat);
    }
    for (const op of ops) {
      const mid = op.at + op.len / 2;
      if (op.kind === "win") {
        addWallBlock(horiz ? mid : fixed, 1.62, horiz ? fixed : mid, horiz ? op.len : w.t, 3.0, horiz ? w.t : op.len, mat);
        addWallBlock(horiz ? mid : fixed, 8.12, horiz ? fixed : mid, horiz ? op.len : w.t, 2.0, horiz ? w.t : op.len, mat);
        // Dark anodized aluminum window frame + glass pane
        addWallBlock(horiz ? mid : fixed, 3.16, horiz ? fixed : mid, horiz ? op.len : w.t + 0.1, 0.14, horiz ? w.t + 0.1 : op.len, mullionMat);
        addWallBlock(horiz ? mid : fixed, 7.08, horiz ? fixed : mid, horiz ? op.len : w.t + 0.1, 0.14, horiz ? w.t + 0.1 : op.len, mullionMat);
        const pane = new THREE.Mesh(new THREE.BoxGeometry(horiz ? op.len : 0.12, 3.85, horiz ? 0.12 : op.len), glassMat);
        pane.position.set((horiz ? mid : fixed) - cx, 5.12, (horiz ? fixed : mid) - cz);
        scene.add(pane); wallMeshes.push({ mesh: pane, fullH: 3.85, fullY: 5.12 });
      } else if (op.kind === "door") {
        addWallBlock(horiz ? mid : fixed, 8.12, horiz ? fixed : mid, horiz ? op.len : w.t, 2.0, horiz ? w.t : op.len, mat);
        const dir = op.swing || 1;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.18 : op.len, 7.0, horiz ? op.len : 0.18), doorMat);
        const lx = horiz ? op.at - cx : fixed + (dir * op.len) / 2 - cx;
        const lz = horiz ? fixed + (dir * op.len) / 2 - cz : op.at - cz;
        leaf.position.set(lx, 3.62, lz); leaf.castShadow = true;
        scene.add(leaf); wallMeshes.push({ mesh: leaf, fullH: 7.0, fullY: 3.62 });
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), brassMat);
        handle.position.set(horiz ? lx : lx + (dir * op.len) * 0.35, 3.4, horiz ? lz + (dir * op.len) * 0.35 : lz);
        scene.add(handle); wallMeshes.push({ mesh: handle, fullH: 0.12, fullY: 3.4 });
      } else if (op.kind === "open") {
        addWallBlock(horiz ? mid : fixed, 8.12, horiz ? fixed : mid, horiz ? op.len : w.t, 2.0, horiz ? w.t : op.len, mat);
      }
    }
  }

  const sharedMats = {
    walnutMat: new THREE.MeshStandardMaterial({ color: 0x5c3d28, map: woodFloorTex, roughness: 0.48 }),
    oakMat: new THREE.MeshStandardMaterial({ color: 0xb6895b, map: woodFloorTex, roughness: 0.52 }),
    linenMat: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.88 }),
    charcoalFabric: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.86 }),
    sofaSeatMat: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.84 }),
    accentPillowMat: new THREE.MeshStandardMaterial({ color: 0xc2784a, roughness: 0.8 }),
    duvetMat: new THREE.MeshStandardMaterial({ color: 0xd6d3cd, roughness: 0.85 }),
    rugMat: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.95 }),
    cabinetMat: new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.45 }),
    marbleMat: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, map: plasterTex, roughness: 0.22, metalness: 0.05 }),
    chromeMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }),
    darkGlassMat: new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.15 }),
    ceramicMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18 }),
    lampGlowMat: new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffd28a, emissiveIntensity: 0.85, roughness: 0.4 }),
  };

  for (const f of PLAN.furniture || []) {
    const group = createFurniture3D(f, cx, cz, sharedMats);
    scene.add(group);
    furnMeshes.push(group);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (state.mode !== "3d") return;
    let dirty = false;
    if (state.autoOrbit) { scene.rotation.y += 0.004; dirty = true; }
    if (controls && controls.update()) dirty = true;
    if (dirty) renderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  animate();
}

function applyCutaway(enabled) {
  wallMeshes.forEach((w) => {
    if (w.fullH > 4.5) {
      w.mesh.scale.y = enabled ? 0.42 : 1.0;
      w.mesh.position.y = enabled ? w.fullY * 0.42 : w.fullY;
    }
  });
}

function updateSun(hour) {
  if (!sunLight) return;
  const angle = ((hour - 6) / 13) * Math.PI;
  sunLight.position.set(-Math.cos(angle) * 42, Math.max(8, Math.sin(angle) * 45), 24);
}

function setViewMode(mode, camType) {
  state.mode = mode;
  state.camType = camType || state.camType;
  document.body.className = mode === "3d" ? "mode-3d" : "mode-2d";
  document.querySelectorAll(".cam-row button").forEach((b) => b.classList.remove("active"));
  if (mode === "2d") {
    document.getElementById("btn-2d").classList.add("active");
    document.getElementById("mode-subtitle").textContent = "2D Orthographic Architectural CAD Blueprint";
    if (ceilingGroup) ceilingGroup.visible = false;
    draw2D();
  } else if (camera && controls) {
    const { w: W, h: H } = getViewportSize();
    const aspect = W / H;
    const distMult = aspect < 1 ? Math.min(1.65, (1 / Math.max(aspect, 0.52)) * 0.85) : 1;
    const chkCut = document.getElementById("chk-cutaway");
    if (camType === "iso") {
      document.getElementById("btn-3d-iso").classList.add("active");
      document.getElementById("mode-subtitle").textContent = "3D Isometric Extruded Model (Full Walls & Shadows)";
      if (ceilingGroup) ceilingGroup.visible = false;
      if (interiorLight1) interiorLight1.intensity = 0.0;
      if (interiorLight2) interiorLight2.intensity = 0.0;
      applyCutaway(chkCut ? chkCut.checked : false);
      camera.fov = 42; camera.updateProjectionMatrix();
      camera.position.set(32 * distMult, 34 * distMult, 48 * distMult);
      controls.target.set(0, 1.5, 0);
    } else if (camType === "walk") {
      document.getElementById("btn-3d-walk").classList.add("active");
      document.getElementById("mode-subtitle").textContent = "3D First-Person Interior Walkthrough";
      if (ceilingGroup) ceilingGroup.visible = true;
      if (interiorLight1) interiorLight1.intensity = 1.25;
      if (interiorLight2) interiorLight2.intensity = 0.9;
      applyCutaway(false);
      camera.fov = 58; camera.updateProjectionMatrix();
      camera.position.set(-14, 5.4, -14);
      controls.target.set(4, 3.6, 8);
    } else {
      document.getElementById("btn-3d-top").classList.add("active");
      document.getElementById("mode-subtitle").textContent = "3D Cutaway Dollhouse Plan View";
      if (ceilingGroup) ceilingGroup.visible = false;
      if (interiorLight1) interiorLight1.intensity = 0.45;
      if (interiorLight2) interiorLight2.intensity = 0.45;
      applyCutaway(true);
      camera.fov = 38; camera.updateProjectionMatrix();
      camera.position.set(0, 64 * distMult, 10 * distMult);
      controls.target.set(0, 0, 0);
    }
    controls.update();
    if (renderer) renderer.render(scene, camera);
  }
}

document.getElementById("hud-toggle").onclick = () => {
  const panel = document.getElementById("hud-panel");
  const btn = document.getElementById("hud-toggle");
  panel.classList.toggle("collapsed");
  btn.textContent = panel.classList.contains("collapsed") ? "+" : "−";
};
document.getElementById("btn-2d").onclick = () => setViewMode("2d");
document.getElementById("btn-3d-iso").onclick = () => setViewMode("3d", "iso");
document.getElementById("btn-3d-walk").onclick = () => setViewMode("3d", "walk");
document.getElementById("btn-3d-top").onclick = () => setViewMode("3d", "top");
document.getElementById("chk-furn").onchange = (e) => {
  state.showFurn = e.target.checked;
  furnMeshes.forEach((m) => (m.visible = state.showFurn));
  draw2D();
  if (renderer && state.mode === "3d") renderer.render(scene, camera);
};
document.getElementById("chk-dims").onchange = (e) => { state.showDims = e.target.checked; draw2D(); };
document.getElementById("chk-cutaway").onchange = (e) => {
  state.cutaway = e.target.checked;
  applyCutaway(state.cutaway);
  if (renderer && state.mode === "3d") renderer.render(scene, camera);
};
document.getElementById("sun-slider").oninput = (e) => {
  state.sunHour = parseFloat(e.target.value);
  document.getElementById("sun-lbl").textContent = Math.floor(state.sunHour) + ":" + (state.sunHour % 1 ? "30" : "00");
  updateSun(state.sunHour);
  if (renderer && state.mode === "3d") renderer.render(scene, camera);
};
document.getElementById("btn-play").onclick = () => {
  state.autoOrbit = !state.autoOrbit;
  if (state.autoOrbit && state.mode !== "3d") setViewMode("3d", "iso");
};
document.getElementById("btn-restart").onclick = () => {
  if (scene) scene.rotation.y = 0;
  setViewMode(state.mode, state.camType || "iso");
};
document.getElementById("timeline-scrubber").oninput = (e) => {
  if (scene) {
    if (state.mode !== "3d") setViewMode("3d", "iso");
    scene.rotation.y = (parseFloat(e.target.value) / 100) * Math.PI * 2;
    if (renderer) renderer.render(scene, camera);
  }
};
function handleResize() {
  draw2D();
  if (renderer && camera) {
    const { w: W, h: H } = getViewportSize();
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
    if (state.mode === "3d") renderer.render(scene, camera);
  }
}
window.addEventListener("resize", handleResize);
if (window.ResizeObserver) new ResizeObserver(handleResize).observe(document.getElementById("stage-wrap"));
window.__SEEK_FRAME__ = (_t, progress) => {
  if (scene) {
    if (progress > 0.15 && state.mode !== "3d") setViewMode("3d", "iso");
    scene.rotation.y = progress * Math.PI * 1.5;
    renderer.render(scene, camera);
  }
};

draw2D();
init3D();
