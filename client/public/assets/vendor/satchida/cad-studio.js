// Single source of truth: 40ft x 35ft (1,400 sq ft) 3BHK Floor Plan
    const PLAN = window.SATCHIDA_CAD_PLAN || { width: 40, depth: 35, rooms: [], walls: [], furniture: [] };

    let state = { mode: "2d", showFurn: true, showDims: true, cutaway: false, sunHour: 10.5, autoOrbit: false };

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

    function draw2D() {
      const dpr = window.devicePixelRatio || 1;
      const { w: W, h: H } = getViewportSize();
      cadCanvas.width = W * dpr; cadCanvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#07111f";
      ctx.fillRect(0, 0, W, H);

      // Drafting grid
      ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 28) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 28) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      const narrow = W < 760;
      const padLeft = narrow ? 56 : 100;
      const padRight = narrow ? 32 : 100;
      const padTop = narrow ? 245 : 100;
      const padBottom = 72;
      const scale = Math.min((W - padLeft - padRight) / PLAN.width, (H - padTop - padBottom) / PLAN.depth);
      const ox = padLeft + ((W - padLeft - padRight) - PLAN.width * scale) / 2;
      const oy = padTop + ((H - padTop - padBottom) - PLAN.depth * scale) / 2;
      const px = (x) => ox + x * scale;
      const py = (z) => oy + z * scale;

      // Room floor fills
      for (const r of PLAN.rooms) {
        ctx.fillStyle = r.tint;
        ctx.fillRect(px(r.x), py(r.z), r.w * scale, r.d * scale);
        ctx.strokeStyle = "rgba(56,189,248,0.16)";
        ctx.strokeRect(px(r.x), py(r.z), r.w * scale, r.d * scale);
      }

      // Furniture 2D CAD blocks
      if (state.showFurn) {
        for (const f of PLAN.furniture) {
          const fx = px(f.x), fy = py(f.z), fw = f.w * scale, fd = f.d * scale;
          ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
          ctx.strokeStyle = "#7dd3fc";
          ctx.lineWidth = 1.3;
          ctx.fillRect(fx, fy, fw, fd);
          ctx.strokeRect(fx, fy, fw, fd);
          if (f.type === "bed") {
            ctx.strokeRect(fx + 4, fy + 4, fw * 0.42, fd * 0.25);
            ctx.strokeRect(fx + fw * 0.52, fy + 4, fw * 0.42, fd * 0.25);
          } else if (f.type === "dining") {
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.arc(fx + (i + 0.5) * (fw / 3), fy - 5, 4, 0, Math.PI * 2);
              ctx.arc(fx + (i + 0.5) * (fw / 3), fy + fd + 5, 4, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
      }

      // Solid walls, windows & door swing arcs
      for (const w of PLAN.walls) {
        const { horiz, fixed, segs, ops } = splitWallSegments(w);
        const thick = w.t * scale;
        ctx.fillStyle = w.kind === "rail" ? "#38bdf8" : "#e2e8f0";
        for (const s of segs) {
          if (horiz) ctx.fillRect(px(s.a), py(fixed) - thick / 2, (s.b - s.a) * scale, thick);
          else ctx.fillRect(px(fixed) - thick / 2, py(s.a), thick, (s.b - s.a) * scale);
        }
        for (const op of ops) {
          if (op.kind === "win") {
            ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1.6;
            if (horiz) {
              ctx.fillRect(px(op.at), py(fixed) - thick / 2, op.len * scale, thick);
              ctx.strokeRect(px(op.at), py(fixed) - thick / 2, op.len * scale, thick);
            } else {
              ctx.fillRect(px(fixed) - thick / 2, py(op.at), thick, op.len * scale);
              ctx.strokeRect(px(fixed) - thick / 2, py(op.at), thick, op.len * scale);
            }
          } else if (op.kind === "door") {
            const r = op.len * scale;
            const dir = op.swing || 1;
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 1.4;
            if (horiz) {
              const hx = px(op.at), hy = py(fixed);
              ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + dir * r); ctx.stroke();
              ctx.setLineDash([4, 3]);
              ctx.beginPath();
              ctx.arc(hx, hy, r, dir > 0 ? 0 : -Math.PI / 2, dir > 0 ? Math.PI / 2 : 0);
              ctx.stroke();
              ctx.setLineDash([]);
            } else {
              const hx = px(fixed), hy = py(op.at);
              ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + dir * r, hy); ctx.stroke();
              ctx.setLineDash([4, 3]);
              ctx.beginPath();
              ctx.arc(hx, hy, r, dir > 0 ? 0 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }
      }

      // Dimensions & room labels
      if (state.showDims) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const r of PLAN.rooms) {
          const rcx = px(r.x + r.w / 2);
          const rcy = py(r.z + r.d / 2);
          const maxW = Math.max(40, r.w * scale - 10);
          const fTitle = Math.max(8, Math.min(11, Math.floor((r.w * scale) / 11)));
          const fSub = Math.max(7.5, Math.min(9.5, fTitle - 1.5));
          const subText = `${r.w}'×${r.d}' · ${r.w * r.d} sf`;
          ctx.font = `700 ${fTitle}px Inter, system-ui, sans-serif`;
          const tw = Math.min(maxW, Math.max(ctx.measureText(r.name).width, ctx.measureText(subText).width));
          ctx.fillStyle = "rgba(7, 17, 31, 0.78)";
          ctx.fillRect(rcx - tw / 2 - 5, rcy - fTitle - 4, tw + 10, fTitle + fSub + 12);
          ctx.fillStyle = "#f8fafc";
          ctx.fillText(r.name, rcx, rcy - 5, maxW);
          ctx.font = `500 ${fSub}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = "#7dd3fc";
          ctx.fillText(subText, rcx, rcy + fTitle * 0.65, maxW);
        }
        ctx.textBaseline = "alphabetic";
        // Exterior dimension chains
        ctx.strokeStyle = "#38bdf8";
        ctx.fillStyle = "#7dd3fc";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px(0), py(0) - 22); ctx.lineTo(px(PLAN.width), py(0) - 22);
        ctx.moveTo(px(0), py(0) - 27); ctx.lineTo(px(0), py(0) - 17);
        ctx.moveTo(px(PLAN.width), py(0) - 27); ctx.lineTo(px(PLAN.width), py(0) - 17);
        ctx.moveTo(px(0) - 22, py(0)); ctx.lineTo(px(0) - 22, py(PLAN.depth));
        ctx.moveTo(px(0) - 27, py(0)); ctx.lineTo(px(0) - 17, py(0));
        ctx.moveTo(px(0) - 27, py(PLAN.depth)); ctx.lineTo(px(0) - 17, py(PLAN.depth));
        ctx.stroke();
        ctx.font = "600 11px Inter, system-ui, sans-serif";
        ctx.fillText(`${PLAN.width} ft (${(PLAN.width * 0.3048).toFixed(1)} m)`, px(PLAN.width / 2), py(0) - 29);
        ctx.save();
        ctx.translate(px(0) - 32, py(PLAN.depth / 2));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${PLAN.depth} ft (${(PLAN.depth * 0.3048).toFixed(1)} m)`, 0, 0);
        ctx.restore();
      }
    }

    // ==================== 2. TRUE 3D THREE.JS ARCHITECTURAL RENDERER ====================
    const webglCanvas = document.getElementById("webgl-3d");
    let renderer, scene, camera, controls, sunLight;
    const wallMeshes = [], furnMeshes = [];

    function init3D() {
      if (!window.THREE) return;
      const { w: W, h: H } = getViewportSize();
      renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      scene = new THREE.Scene();
      scene.background = new THREE.Color("#07111f");
      scene.fog = new THREE.Fog("#07111f", 60, 140);

      camera = new THREE.PerspectiveCamera(45, W / H, 0.5, 200);
      camera.position.set(22, 34, 48);

      if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, webglCanvas);
        controls.enableDamping = true;
        controls.target.set(0, 2, 0);
        controls.addEventListener("change", () => { if (state.mode === "3d") renderer.render(scene, camera); });
      }

      scene.add(new THREE.AmbientLight(0xdbeafe, 0.55));
      scene.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.45));
      sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.shadow.camera.left = -30; sunLight.shadow.camera.right = 30;
      sunLight.shadow.camera.top = 30; sunLight.shadow.camera.bottom = -30;
      scene.add(sunLight);
      updateSun(state.sunHour);

      const cx = PLAN.width / 2, cz = PLAN.depth / 2;
      const grid = new THREE.GridHelper(90, 45, 0x1e3a5f, 0x0f223a);
      grid.position.y = -0.35;
      scene.add(grid);

      // Base architectural concrete plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(PLAN.width + 1.2, 0.6, PLAN.depth + 1.2),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
      );
      plinth.position.set(0, -0.3, 0);
      plinth.receiveShadow = true;
      scene.add(plinth);

      // Room floors
      for (const r of PLAN.rooms) {
        const floor = new THREE.Mesh(
          new THREE.BoxGeometry(r.w - 0.1, 0.12, r.d - 0.1),
          new THREE.MeshStandardMaterial({ color: r.floor, roughness: 0.72 })
        );
        floor.position.set(r.x + r.w / 2 - cx, 0.06, r.z + r.d / 2 - cz);
        floor.receiveShadow = true;
        scene.add(floor);
      }

      // 3D Extruded Walls with real window sills/headers and door headers
      const wallH = 9.0;
      const extMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 });
      const intMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.2 });

      function addWallBox(x, y, z, w, h, d, mat, isGlass = false) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x - cx, y, z - cz);
        m.castShadow = !isGlass;
        m.receiveShadow = true;
        scene.add(m);
        if (!isGlass) wallMeshes.push({ mesh: m, fullY: y, fullH: h });
      }

      for (const w of PLAN.walls) {
        const mat = w.kind === "ext" ? extMat : intMat;
        const { horiz, fixed, segs, ops, start, end } = splitWallSegments(w);
        if (w.kind === "rail") {
          const rLen = Math.max(1, end - start);
          const rMid = (start + end) / 2;
          addWallBox(horiz ? rMid : fixed, 1.8, horiz ? fixed : rMid, horiz ? rLen : 0.2, 3.4, horiz ? 0.2 : rLen, glassMat, true);
          continue;
        }
        for (const s of segs) {
          const len = s.b - s.a;
          const mid = (s.a + s.b) / 2;
          addWallBox(horiz ? mid : fixed, wallH / 2, horiz ? fixed : mid, horiz ? len : w.t, wallH, horiz ? w.t : len, mat);
        }
        for (const op of ops) {
          const mid = op.at + op.len / 2;
          if (op.kind === "win") {
            addWallBox(horiz ? mid : fixed, 1.5, horiz ? fixed : mid, horiz ? op.len : w.t, 3.0, horiz ? w.t : op.len, mat);
            addWallBox(horiz ? mid : fixed, 8.25, horiz ? fixed : mid, horiz ? op.len : w.t, 1.5, horiz ? w.t : op.len, mat);
            addWallBox(horiz ? mid : fixed, 5.25, horiz ? fixed : mid, horiz ? op.len : 0.15, 4.5, horiz ? 0.15 : op.len, glassMat, true);
          } else if (op.kind === "door") {
            addWallBox(horiz ? mid : fixed, 8.0, horiz ? fixed : mid, horiz ? op.len : w.t, 2.0, horiz ? w.t : op.len, mat);
          }
        }
      }

      // 3D Furniture
      for (const f of PLAN.furniture) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(f.w, f.h, f.d),
          new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.65 })
        );
        mesh.position.set(f.x + f.w / 2 - cx, f.h / 2 + 0.12, f.z + f.d / 2 - cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        furnMeshes.push(mesh);
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

    function updateSun(hour) {
      if (!sunLight) return;
      const angle = ((hour - 6) / 13) * Math.PI;
      sunLight.position.set(-Math.cos(angle) * 38, Math.max(8, Math.sin(angle) * 42), 22);
    }

    function setViewMode(mode, camType) {
      state.mode = mode;
      document.body.className = mode === "3d" ? "mode-3d" : "mode-2d";
      document.querySelectorAll(".cam-row button").forEach((b) => b.classList.remove("active"));
      if (mode === "2d") {
        document.getElementById("btn-2d").classList.add("active");
        document.getElementById("mode-subtitle").textContent = "2D Orthographic Architectural CAD Blueprint";
        draw2D();
      } else {
        document.getElementById("mode-subtitle").textContent = "3D WebGL Extruded Structure (Orbit / Zoom / Shadows)";
        if (camera && controls) {
          const { w: W, h: H } = getViewportSize();
          const aspect = W / H;
          const distMult = aspect < 1 ? Math.min(1.65, (1 / Math.max(aspect, 0.52)) * 0.85) : 1;
          if (camType === "iso") {
            document.getElementById("btn-3d-iso").classList.add("active");
            camera.fov = 45;
            camera.updateProjectionMatrix();
            camera.position.set(22 * distMult, 36 * distMult, 46 * distMult);
            controls.target.set(0, 1.5, 0);
          } else if (camType === "walk") {
            document.getElementById("btn-3d-walk").classList.add("active");
            camera.fov = 58;
            camera.updateProjectionMatrix();
            camera.position.set(-15, 5.4, -14);
            controls.target.set(8, 3.8, 12);
          } else {
            document.getElementById("btn-3d-top").classList.add("active");
            camera.fov = 45;
            camera.updateProjectionMatrix();
            camera.position.set(0, 58 * distMult, 8 * distMult);
            controls.target.set(0, 0, 0);
          }
          controls.update();
          if (renderer) renderer.render(scene, camera);
        }
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
    };
    document.getElementById("chk-dims").onchange = (e) => { state.showDims = e.target.checked; draw2D(); };
    document.getElementById("chk-cutaway").onchange = (e) => {
      state.cutaway = e.target.checked;
      wallMeshes.forEach((w) => {
        if (w.fullH > 4.5) {
          w.mesh.scale.y = state.cutaway ? 0.5 : 1.0;
          w.mesh.position.y = state.cutaway ? w.fullY * 0.5 : w.fullY;
        }
      });
    };
    document.getElementById("sun-slider").oninput = (e) => {
      state.sunHour = parseFloat(e.target.value);
      document.getElementById("sun-lbl").textContent = Math.floor(state.sunHour) + ":" + (state.sunHour % 1 ? "30" : "00");
      updateSun(state.sunHour);
    };
    document.getElementById("btn-play").onclick = () => {
      state.autoOrbit = !state.autoOrbit;
      if (state.autoOrbit && state.mode !== "3d") setViewMode("3d", "iso");
    };
    document.getElementById("btn-restart").onclick = () => {
      if (scene) scene.rotation.y = 0;
      setViewMode(state.mode, "iso");
    };
    document.getElementById("timeline-scrubber").oninput = (e) => {
      if (scene) {
        if (state.mode !== "3d") setViewMode("3d", "iso");
        scene.rotation.y = (parseFloat(e.target.value) / 100) * Math.PI * 2;
      }
    };
    function handleResize() {
      draw2D();
      if (renderer && camera) {
        const { w: W, h: H } = getViewportSize();
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        renderer.setSize(W, H, false);
        if (state.mode === "3d") renderer.render(scene, camera);
      }
    }
    window.addEventListener("resize", handleResize);
    if (window.ResizeObserver) {
      new ResizeObserver(handleResize).observe(document.getElementById("stage-wrap"));
    }
    window.__SEEK_FRAME__ = (_t, progress) => {
      if (scene) {
        if (progress > 0.15 && state.mode !== "3d") setViewMode("3d", "iso");
        scene.rotation.y = progress * Math.PI * 1.5;
        renderer.render(scene, camera);
      }
    };

    draw2D();
    init3D();
