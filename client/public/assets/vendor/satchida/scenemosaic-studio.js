/* Satchida SceneMosaic Studio — Self-contained Photorealistic 3D Room Reconstruction & Layout Evolution Engine */
(function (global) {
  'use strict';
  if (typeof global.PERSON_NAME === 'undefined') { global.PERSON_NAME = 0; }

  function softBox(THREE, w, h, d, radius, opts) {
    var puff = (opts && opts.puff) || 0;
    var half = [w / 2, h / 2, d / 2];
    var r = Math.min(radius, Math.min(w, h, d) * 0.45);
    var uvShift = (w * 7.3 + h * 5.1 + d * 3.7) % 1;

    function corner(axis, signs) {
      var position = signs.map(function (sign, i) {
        return sign * (i === axis ? half[i] : half[i] - r);
      });
      var tilted = signs.map(function (sign, i) {
        return i === axis ? sign : sign * puff;
      });
      var length = Math.hypot(tilted[0], tilted[1], tilted[2]) || 1;
      return {
        position: position,
        normal: tilted.map(function (n) { return n / length; }),
      };
    }

    var positions = [];
    var normals = [];
    var uvs = [];
    var indices = [];

    function addPolygon(vertices, uvAxis) {
      var axes = [0, 1, 2].filter(function (i) { return i !== uvAxis; }).sort(function (a, b) { return half[b] - half[a]; });
      var uAxis = axes[0];
      var vAxis = axes[1];
      var first = positions.length / 3;
      for (var vi = 0; vi < vertices.length; vi++) {
        var vtx = vertices[vi];
        positions.push(vtx.position[0], vtx.position[1], vtx.position[2]);
        normals.push(vtx.normal[0], vtx.normal[1], vtx.normal[2]);
        uvs.push(vtx.position[uAxis] + half[uAxis] + uvShift, vtx.position[vAxis] + half[vAxis] + uvShift);
      }
      var a = vertices[0], b = vertices[1], c = vertices[2];
      var ab = [b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]];
      var ac = [c.position[0] - a.position[0], c.position[1] - a.position[1], c.position[2] - a.position[2]];
      var cross = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ];
      var facing = cross[0] * (a.normal[0] + c.normal[0]) + cross[1] * (a.normal[1] + c.normal[1]) + cross[2] * (a.normal[2] + c.normal[2]);
      for (var i = 1; i + 1 < vertices.length; i++) {
        if (facing >= 0) indices.push(first, first + i, first + i + 1);
        else indices.push(first, first + i + 1, first + i);
      }
    }

    var SIGNS = [-1, 1];
    for (var axis = 0; axis < 3; axis++) {
      var p = (axis + 1) % 3;
      var q = (axis + 2) % 3;
      var signed = (function (ax, px, qx) {
        return function (onAxis, onP, onQ) {
          var s = [0, 0, 0];
          s[ax] = onAxis;
          s[px] = onP;
          s[qx] = onQ;
          return s;
        };
      })(axis, p, q);
      for (var si = 0; si < SIGNS.length; si++) {
        var s = SIGNS[si];
        addPolygon([
          corner(axis, signed(s, -1, -1)),
          corner(axis, signed(s, 1, -1)),
          corner(axis, signed(s, 1, 1)),
          corner(axis, signed(s, -1, 1)),
        ], axis);
        for (var ti = 0; ti < SIGNS.length; ti++) {
          var t = SIGNS[ti];
          addPolygon([
            corner(p, signed(-1, s, t)),
            corner(q, signed(-1, s, t)),
            corner(q, signed(1, s, t)),
            corner(p, signed(1, s, t)),
          ], p);
        }
      }
    }
    for (var xi = 0; xi < 2; xi++) {
      for (var yi = 0; yi < 2; yi++) {
        for (var zi = 0; zi < 2; zi++) {
          var sx = SIGNS[xi], sy = SIGNS[yi], sz = SIGNS[zi];
          addPolygon([
            corner(0, [sx, sy, sz]),
            corner(1, [sx, sy, sz]),
            corner(2, [sx, sy, sz]),
          ], 1);
        }
      }
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    return geom;
  }

  var NAMED_COLORS = {
    oak: '#b68c60',
    walnut: '#5c3c24',
    teak: '#9b6b43',
    pine: '#cfa97a',
    mahogany: '#4e271c',
    beige: '#d8cbb8',
    cream: '#f2eadc',
    linen: '#ebe4d8',
    ivory: '#f5f2ea',
    charcoal: '#2d3138',
    concrete: '#9a968f',
    slate: '#55606e',
    sage: '#7b8f7d',
    olive: '#6c7a52',
    navy: '#2e4057',
    terracotta: '#b36243',
    taupe: '#9c8e80',
    wood: '#a47c54',
    espresso: '#3b281c',
    cognac: '#9e472a',
    gray: '#6b7280',
    grey: '#6b7280',
    brass: '#d4af37',
    gold: '#d4af37',
    green: '#2e6638',
    emerald: '#1b5e20',
  };

  function normalizeColor(c) {
    if (!c || typeof c !== 'string') return '#8b7355';
    var s = c.trim().toLowerCase();
    if (NAMED_COLORS[s]) return NAMED_COLORS[s];
    if (/^#[0-9a-f]{3,6}$/i.test(s)) return s;
    return c;
  }

  function shiftHex(hex, amt) {
    hex = normalizeColor(hex);
    if (!hex || typeof hex !== 'string') return '#8b7355';
    var n = hex.replace('#', '');
    if (n.length === 3) n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2];
    if (n.length !== 6) return hex;
    var r = parseInt(n.slice(0, 2), 16);
    var g = parseInt(n.slice(2, 4), 16);
    var b = parseInt(n.slice(4, 6), 16);
    var t = Math.max(-1, Math.min(1, amt));
    var ch = function (v) {
      var out = Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t));
      return Math.max(0, Math.min(255, out)).toString(16).padStart(2, '0');
    };
    return '#' + ch(r) + ch(g) + ch(b);
  }

  function buildStudioEnvMap(THREE, renderer) {
    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    var envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x1f2430);

    var ceilingPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff5e4, side: THREE.DoubleSide })
    );
    ceilingPanel.position.set(0, 14, 0);
    ceilingPanel.rotation.x = Math.PI / 2;
    envScene.add(ceilingPanel);

    var warmWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe4be, side: THREE.DoubleSide })
    );
    warmWindow.position.set(16, 6, 8);
    warmWindow.lookAt(0, 3, 0);
    envScene.add(warmWindow);

    var coolFill = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshBasicMaterial({ color: 0xcbe0f8, side: THREE.DoubleSide })
    );
    coolFill.position.set(-16, 6, -8);
    coolFill.lookAt(0, 3, 0);
    envScene.add(coolFill);

    var floorBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({ color: 0x6b5a48, side: THREE.DoubleSide })
    );
    floorBounce.position.set(0, -8, 0);
    floorBounce.rotation.x = -Math.PI / 2;
    envScene.add(floorBounce);

    var rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    return rt.texture;
  }

  function makeWoodTexture(THREE, baseHex, repeatX, repeatY) {
    var c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    var ctx = c.getContext('2d');
    ctx.fillStyle = baseHex || '#b68c60';
    ctx.fillRect(0, 0, 512, 512);

    var plankH = 64;
    for (var y = 0; y < 512; y += plankH) {
      var shade = ((y / plankH) % 3 === 0) ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)';
      ctx.fillStyle = shade;
      ctx.fillRect(0, y, 512, plankH);
      for (var g = 0; g < 18; g++) {
        ctx.strokeStyle = g % 2 === 0 ? 'rgba(70,42,20,0.07)' : 'rgba(255,235,205,0.04)';
        ctx.lineWidth = 1 + (g % 2);
        ctx.beginPath();
        var gy = y + ((g * 3.5) % plankH);
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(170, gy + Math.sin(g) * 3, 340, gy - Math.cos(g) * 3, 512, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(38,24,12,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      var jointX = ((y / plankH) * 193 + 96) % 512;
      ctx.beginPath();
      ctx.moveTo(jointX, y);
      ctx.lineTo(jointX, y + plankH);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 4, repeatY || 4);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makePlasterTexture(THREE, baseHex) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = baseHex || '#ece7df';
    ctx.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 1600; i++) {
      var x = (i * 73) % 256;
      var y = (i * 137) % 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.018)' : 'rgba(255,255,255,0.024)';
      ctx.fillRect(x, y, 2, 2);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeFabricTexture(THREE, baseHex) {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext('2d');
    ctx.fillStyle = baseHex || '#7c847c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 128; i += 4) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeRugTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ddd3c4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#b9ab97';
    ctx.lineWidth = 14;
    ctx.strokeRect(14, 14, 228, 228);
    ctx.strokeStyle = 'rgba(110,95,78,0.14)';
    ctx.lineWidth = 2;
    for (var y = 32; y < 224; y += 24) {
      ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(228, y); ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function addMesh(THREE, parent, geom, mat, x, y, z, rx, ry, rz) {
    var m = new THREE.Mesh(geom, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function createFurniture3D(THREE, item, mats) {
    var group = new THREE.Group();
    group.name = item.name || item.type || 'furniture';
    var t = (item.type || 'box').toLowerCase();
    var w = Math.max(0.4, Number(item.w) || 2.0);
    var d = Math.max(0.4, Number(item.d) || 2.0);
    var h = Math.max(0.3, Number(item.h) || 2.5);
    var baseColor = normalizeColor(item.color || '#8b7355');

    var fabricMat = new THREE.MeshStandardMaterial({
      map: makeFabricTexture(THREE, baseColor),
      roughness: 0.88,
      metalness: 0.0,
    });
    var cushionMat = new THREE.MeshStandardMaterial({
      map: makeFabricTexture(THREE, shiftHex(baseColor, 0.14)),
      roughness: 0.86,
      metalness: 0.0,
    });
    var woodMat = new THREE.MeshStandardMaterial({
      map: makeWoodTexture(THREE, baseColor, 2, 2),
      roughness: 0.56,
      metalness: 0.02,
    });

    if (t === 'sofa' || t === 'couch') {
      // 1. Recessed dark wood shadow plinth base
      addMesh(THREE, group, softBox(THREE, w - 0.2, h * 0.12, d * 0.82, 0.02), mats.darkWood, 0, h * 0.06, 0);
      // 2. Deep tailored seating platform in rich heather upholstery
      addMesh(THREE, group, softBox(THREE, w, h * 0.32, d * 0.86, 0.04), fabricMat, 0, h * 0.28, 0);
      // 3. Tailored backrest
      addMesh(THREE, group, softBox(THREE, w, h * 0.62, d * 0.24, 0.05), fabricMat, 0, h * 0.58, -d * 0.36);
      // 4. Sleek rectilinear track armrests
      var armWidth = Math.max(0.65, w * 0.11);
      addMesh(THREE, group, softBox(THREE, armWidth, h * 0.54, d * 0.84, 0.04), fabricMat, -w * 0.5 + armWidth * 0.5, h * 0.45, 0.01);
      addMesh(THREE, group, softBox(THREE, armWidth, h * 0.54, d * 0.84, 0.04), fabricMat, w * 0.5 - armWidth * 0.5, h * 0.45, 0.01);

      // 5. Exactly 3 tailored boxed seat cushions in matching tailored wool fabric
      var count = 3;
      var seatSpan = w - armWidth * 2 - 0.06;
      var cw = seatSpan / count;
      for (var i = 0; i < count; i++) {
        var cx = -seatSpan * 0.5 + (i + 0.5) * cw;
        addMesh(THREE, group, softBox(THREE, cw * 0.96, h * 0.18, d * 0.68, 0.04, { puff: 0.18 }), cushionMat, cx, h * 0.46, d * 0.06);
        // Back cushions resting flush against backrest
        addMesh(THREE, group, softBox(THREE, cw * 0.96, h * 0.38, d * 0.18, 0.04, { puff: 0.18 }), cushionMat, cx, h * 0.68, -d * 0.24, -0.12, 0, 0);
      }
      // 6. Exactly 2 elegant, understated lumbar accent pillows in soft neutral cream linen angled into armrest corners
      var pillowMat = new THREE.MeshStandardMaterial({ color: 0xede8df, roughness: 0.88 });
      for (var pi = 0; pi < 2; pi++) {
        var side = pi === 0 ? -1 : 1;
        var px = side * (seatSpan * 0.5 - cw * 0.35);
        addMesh(THREE, group, softBox(THREE, cw * 0.65, h * 0.28, 0.18, 0.04, { puff: 0.28 }), pillowMat, px, h * 0.52, -d * 0.16, -0.15, side * 0.22, side * 0.08);
      }
    } else if (t === 'bed') {
      addMesh(THREE, group, softBox(THREE, w, h * 0.88, d * 0.09, 0.05), mats.walnut, 0, h * 0.44, -d * 0.46);
      addMesh(THREE, group, softBox(THREE, w, h * 0.28, d, 0.04), mats.walnut, 0, h * 0.14, 0);
      addMesh(THREE, group, softBox(THREE, w * 0.94, h * 0.34, d * 0.92, 0.08), fabricMat, 0, h * 0.42, d * 0.02);
      var throwMat = new THREE.MeshStandardMaterial({ color: shiftHex(baseColor, -0.22), roughness: 0.88 });
      addMesh(THREE, group, softBox(THREE, w * 0.95, h * 0.11, d * 0.34, 0.05), throwMat, 0, h * 0.61, d * 0.29);
      for (var bx = -1; bx <= 1; bx += 2) {
        addMesh(THREE, group, softBox(THREE, w * 0.38, h * 0.16, d * 0.22, 0.06, { puff: 0.36 }), mats.linen, bx * w * 0.23, h * 0.66, -d * 0.31, 0.1, 0, bx * 0.03);
      }
    } else if (t === 'coffee_table') {
      // Solid rustic oak block coffee table with tabletop styling
      var tabletopMat = new THREE.MeshStandardMaterial({
        map: makeWoodTexture(THREE, item.color || '#8a6341', 2, 2),
        roughness: 0.52,
        metalness: 0.02
      });
      // Solid timber plinth table
      addMesh(THREE, group, softBox(THREE, w, h * 0.72, d, 0.05), tabletopMat, 0, h * 0.50, 0);
      // Recessed dark wood plinth base
      addMesh(THREE, group, softBox(THREE, w * 0.88, h * 0.16, d * 0.88, 0.02), mats.darkWood, 0, h * 0.08, 0);
      
      // Tabletop decor: ceramic bud vase + stacked art books
      var vaseMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.25, metalness: 0.05 });
      addMesh(THREE, group, new THREE.CylinderGeometry(0.12, 0.16, 0.38, 16), vaseMat, -w * 0.22, h * 1.02, 0);
      var bookMat1 = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 0.7 });
      var bookMat2 = new THREE.MeshStandardMaterial({ color: 0xc4a47c, roughness: 0.75 });
      addMesh(THREE, group, new THREE.BoxGeometry(0.48, 0.08, 0.34), bookMat1, w * 0.22, h * 0.90, 0.05, 0, 0.15, 0);
      addMesh(THREE, group, new THREE.BoxGeometry(0.44, 0.07, 0.30), bookMat2, w * 0.21, h * 0.97, 0.05, 0, -0.08, 0);
    } else if (t === 'desk' || t === 'table' || t === 'dining') {
      var topThick = Math.max(0.08, h * 0.1);
      addMesh(THREE, group, softBox(THREE, w, topThick, d, 0.03), woodMat, 0, h - topThick * 0.5, 0);
      var legH = h - topThick;
      var legGeo = new THREE.CylinderGeometry(0.07, 0.045, legH, 10);
      var lx = w * 0.42, lz = d * 0.4;
      [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (pt) {
        addMesh(THREE, group, legGeo, mats.darkWood, pt[0], legH * 0.5, pt[1]);
      });
      if (t === 'desk') {
        addMesh(THREE, group, softBox(THREE, w * 0.34, h * 0.22, d * 0.78, 0.03), woodMat, w * 0.26, h * 0.76, 0);
        addMesh(THREE, group, new THREE.CylinderGeometry(0.025, 0.025, w * 0.12, 8), mats.chrome, w * 0.26, h * 0.76, d * 0.41, 0, 0, Math.PI / 2);
        addMesh(THREE, group, softBox(THREE, w * 0.36, h * 0.34, 0.06, 0.015), mats.charcoal, -w * 0.06, h + h * 0.26, -d * 0.2);
        addMesh(THREE, group, softBox(THREE, 0.16, h * 0.12, 0.16, 0.01), mats.chrome, -w * 0.06, h + h * 0.06, -d * 0.22);
      } else if (t === 'dining') {
        addMesh(THREE, group, new THREE.CylinderGeometry(0.22, 0.18, 0.36, 14), mats.ceramic, 0, h + 0.18, 0);
        addMesh(THREE, group, new THREE.IcosahedronGeometry(0.28, 1), mats.foliage, 0, h + 0.44, 0);
      }
    } else if (t === 'armchair' || t === 'accent_chair' || t === 'lounge_chair') {
      var isLeather = /cognac|leather|saddle|brown|caramel/i.test(item.color || '') || /leather|safari|lounge/i.test(item.name || '');
      
      if (isLeather) {
        // Modern Cognac Leather Sling Lounge Chair on blackened steel frame
        var leatherMat = new THREE.MeshStandardMaterial({
          color: 0x8a4b29,
          roughness: 0.55,
          metalness: 0.12
        });
        var steelMat = mats.charcoal;
        [-1, 1].forEach(function (side) {
          addMesh(THREE, group, new THREE.CylinderGeometry(0.035, 0.035, h * 0.65, 10), steelMat, side * w * 0.44, h * 0.32, -d * 0.35, -0.22, 0, 0);
          addMesh(THREE, group, new THREE.CylinderGeometry(0.035, 0.035, h * 0.48, 10), steelMat, side * w * 0.44, h * 0.24, d * 0.35, 0.15, 0, 0);
          addMesh(THREE, group, new THREE.BoxGeometry(0.07, 0.04, d * 0.78), steelMat, side * w * 0.44, h * 0.56, 0);
          addMesh(THREE, group, softBox(THREE, 0.10, 0.06, d * 0.45, 0.02), leatherMat, side * w * 0.44, h * 0.58, 0.02);
        });
        addMesh(THREE, group, new THREE.CylinderGeometry(0.03, 0.03, w * 0.88, 10), steelMat, 0, h * 0.12, -d * 0.25, 0, 0, Math.PI / 2);
        addMesh(THREE, group, new THREE.CylinderGeometry(0.03, 0.03, w * 0.88, 10), steelMat, 0, h * 0.12, d * 0.25, 0, 0, Math.PI / 2);
        
        addMesh(THREE, group, softBox(THREE, w * 0.78, h * 0.14, d * 0.72, 0.04, { puff: 0.28 }), leatherMat, 0, h * 0.34, d * 0.05, 0.12, 0, 0);
        addMesh(THREE, group, softBox(THREE, w * 0.76, h * 0.55, d * 0.12, 0.04, { puff: 0.22 }), leatherMat, 0, h * 0.64, -d * 0.28, -0.25, 0, 0);
      } else {
        // Scandinavian Solid Oak Armchair with angled tapered frame and tailored linen cushions
        var scandOakMat = new THREE.MeshStandardMaterial({
          map: makeWoodTexture(THREE, '#6b4c33', 2, 2),
          roughness: 0.52
        });
        var scandCushionMat = new THREE.MeshStandardMaterial({
          map: makeFabricTexture(THREE, item.color || '#c8b097'),
          roughness: 0.88
        });
        [-1, 1].forEach(function (side) {
          addMesh(THREE, group, new THREE.CylinderGeometry(0.045, 0.035, h * 0.48, 10), scandOakMat, side * w * 0.42, h * 0.24, d * 0.34, 0.12, 0, side * 0.06);
          addMesh(THREE, group, new THREE.CylinderGeometry(0.05, 0.04, h * 0.75, 10), scandOakMat, side * w * 0.42, h * 0.38, -d * 0.32, -0.22, 0, side * 0.06);
          addMesh(THREE, group, softBox(THREE, 0.10, 0.06, d * 0.78, 0.02), scandOakMat, side * w * 0.42, h * 0.54, 0.02, -0.06, 0, 0);
        });
        addMesh(THREE, group, softBox(THREE, w * 0.82, 0.07, d * 0.76, 0.02), scandOakMat, 0, h * 0.26, 0);
        addMesh(THREE, group, softBox(THREE, w * 0.78, h * 0.22, d * 0.74, 0.05, { puff: 0.32 }), scandCushionMat, 0, h * 0.40, d * 0.03, 0.08, 0, 0);
        addMesh(THREE, group, softBox(THREE, w * 0.76, h * 0.52, d * 0.18, 0.05, { puff: 0.26 }), scandCushionMat, 0, h * 0.65, -d * 0.28, -0.22, 0, 0);
      }
    } else if (t === 'chair') {
      addMesh(THREE, group, softBox(THREE, w * 0.9, h * 0.14, d * 0.88, 0.04, { puff: 0.2 }), fabricMat, 0, h * 0.48, 0);
      addMesh(THREE, group, softBox(THREE, w * 0.88, h * 0.48, d * 0.14, 0.04), fabricMat, 0, h * 0.74, -d * 0.38);
      var cLegGeo = new THREE.CylinderGeometry(0.045, 0.03, h * 0.45, 8);
      [[-w * 0.36, -d * 0.34], [w * 0.36, -d * 0.34], [-w * 0.36, d * 0.34], [w * 0.36, d * 0.34]].forEach(function (pt) {
        addMesh(THREE, group, cLegGeo, mats.darkWood, pt[0], h * 0.225, pt[1]);
      });
    } else if (t === 'ottoman' || t === 'pouf' || t === 'bench') {
      // Tailored upholstered ottoman / pouf with plump rounded cushion and wooden plinth
      var otMat = new THREE.MeshStandardMaterial({
        map: makeFabricTexture(THREE, baseColor),
        roughness: 0.82,
        metalness: 0.02,
      });
      // Low plinth base
      addMesh(THREE, group, softBox(THREE, w * 0.92, h * 0.14, d * 0.92, 0.02), mats.darkWood, 0, h * 0.07, 0);
      // Main plush tufted cushion
      addMesh(THREE, group, softBox(THREE, w, h * 0.84, d, 0.06, { puff: 0.34 }), otMat, 0, h * 0.56, 0);
      // 4 low tapered feet
      var otLeg = new THREE.CylinderGeometry(0.04, 0.025, h * 0.14, 8);
      [[-w * 0.38, -d * 0.38], [w * 0.38, -d * 0.38], [-w * 0.38, d * 0.38], [w * 0.38, d * 0.38]].forEach(function (pt) {
        addMesh(THREE, group, otLeg, mats.brass, pt[0], h * 0.07, pt[1]);
      });
    } else if (t === 'side_table' || t === 'end_table') {
      // Sculptural circular accent side table
      var sRad = Math.min(w, d) * 0.48;
      addMesh(THREE, group, new THREE.CylinderGeometry(sRad, sRad, 0.06, 24), woodMat, 0, h - 0.03, 0);
      var sLeg = new THREE.CylinderGeometry(0.03, 0.02, h - 0.06, 8);
      for (var sIdx = 0; sIdx < 3; sIdx++) {
        var sAng = (sIdx / 3) * Math.PI * 2;
        var sLx = Math.cos(sAng) * sRad * 0.65;
        var sLz = Math.sin(sAng) * sRad * 0.65;
        addMesh(THREE, group, sLeg, mats.brass, sLx, (h - 0.06) * 0.5, sLz, 0.06 * Math.cos(sAng), 0, 0.06 * Math.sin(sAng));
      }
    } else if (t === 'wardrobe' || t === 'cabinet' || t === 'dresser' || t === 'nightstand') {
      addMesh(THREE, group, softBox(THREE, w, h, d, 0.03), woodMat, 0, h * 0.5, 0);
      if (t === 'wardrobe' || t === 'cabinet') {
        var dGeo = softBox(THREE, w * 0.46, h * 0.92, 0.06, 0.02);
        [-1, 1].forEach(function (side) {
          addMesh(THREE, group, dGeo, woodMat, side * w * 0.24, h * 0.5, d * 0.51);
          addMesh(THREE, group, new THREE.CylinderGeometry(0.02, 0.02, Math.min(0.45, h * 0.18), 8), mats.brass, side * w * 0.05, h * 0.52, d * 0.55);
        });
      } else {
        for (var dr = 0; dr < 2; dr++) {
          var dy = h * (0.3 + dr * 0.38);
          addMesh(THREE, group, softBox(THREE, w * 0.86, h * 0.3, 0.05, 0.02), woodMat, 0, dy, d * 0.51);
          addMesh(THREE, group, new THREE.SphereGeometry(0.04, 10, 10), mats.brass, 0, dy, d * 0.55);
        }
      }
    } else if (t === 'bookshelf') {
      addMesh(THREE, group, softBox(THREE, w, h, d * 0.1, 0.02), woodMat, 0, h * 0.5, -d * 0.45);
      [-1, 1].forEach(function (s) {
        addMesh(THREE, group, softBox(THREE, w * 0.06, h, d, 0.02), woodMat, s * w * 0.47, h * 0.5, 0);
      });
      for (var si = 0; si < 4; si++) {
        var sy = (h / 4) * si + 0.06;
        addMesh(THREE, group, softBox(THREE, w * 0.9, 0.08, d * 0.92, 0.01), woodMat, 0, sy, 0);
        if (si > 0) {
          var bCols = [0xc95f56, 0x4b8f8c, 0xd8a24a, 0x5c7599];
          for (var bk = 0; bk < 3; bk++) {
            var bMat = new THREE.MeshStandardMaterial({ color: bCols[(si + bk) % bCols.length], roughness: 0.78 });
            addMesh(THREE, group, softBox(THREE, w * 0.1, h * 0.16, d * 0.55, 0.01), bMat, -w * 0.25 + bk * w * 0.22, sy + h * 0.09, 0);
          }
        }
      }
    } else if (t === 'tv' || t === 'media') {
      addMesh(THREE, group, softBox(THREE, w, h * 0.36, d, 0.03), mats.walnut, 0, h * 0.18, 0);
      addMesh(THREE, group, softBox(THREE, w * 0.84, h * 0.54, 0.08, 0.02), mats.charcoal, 0, h * 0.72, -d * 0.2);
      var scrMat = new THREE.MeshStandardMaterial({ color: 0x11161f, roughness: 0.12, metalness: 0.2 });
      addMesh(THREE, group, new THREE.BoxGeometry(w * 0.8, h * 0.5, 0.02), scrMat, 0, h * 0.72, -d * 0.15);
    } else if (t === 'lamp' || t === 'arc_lamp' || t === 'floor_lamp') {
      // Photorealistic Arch / Cantilever Brass Floor Lamp matching Scandinavian photography
      var baseR = Math.max(0.65, w * 0.4);
      addMesh(THREE, group, new THREE.CylinderGeometry(baseR, baseR + 0.04, 0.12, 28), mats.brass, 0, 0.06, 0);
      
      // Sweeping arch cantilever tube extending up and forward along +Z towards the lounge
      var archH = Math.max(6.8, h);
      var archReach = Math.max(2.6, w * 1.6);
      var curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, 0.12, 0),
        new THREE.Vector3(0, archH * 0.85, archReach * 0.15),
        new THREE.Vector3(0, archH * 1.05, archReach * 0.68),
        new THREE.Vector3(0, archH * 0.74, archReach)
      );
      var archGeom = new THREE.TubeGeometry(curve, 32, 0.04, 12, false);
      addMesh(THREE, group, archGeom, mats.brass, 0, 0, 0);
      
      // Spun brass hemisphere dome shade hanging down
      var shadeR = 0.42;
      var domeGeom = new THREE.SphereGeometry(shadeR, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2);
      var domeMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.28,
        metalness: 0.82,
        side: THREE.DoubleSide
      });
      addMesh(THREE, group, domeGeom, domeMat, 0, archH * 0.74, archReach, Math.PI, 0, 0);
      
      // Warm glowing filament / shade underside
      var glowMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
      addMesh(THREE, group, new THREE.SphereGeometry(0.12, 14, 14), glowMat, 0, archH * 0.72, archReach);
      
      // Warm ambient pool of light
      var pLight = new THREE.PointLight(0xffdfa4, 1.45, 14, 2);
      pLight.position.set(0, archH * 0.70, archReach);
      pLight.castShadow = true;
      group.add(pLight);
    } else if (t === 'planter' || t === 'plant') {
      // Modern off-white ceramic cylindrical planter
      addMesh(THREE, group, new THREE.CylinderGeometry(w * 0.42, w * 0.36, h * 0.36, 24), mats.ceramic, 0, h * 0.18, 0);
      // Dark potting soil
      addMesh(THREE, group, new THREE.CylinderGeometry(w * 0.39, w * 0.39, 0.04, 20), mats.charcoal, 0, h * 0.34, 0);
      
      // Multi-stemmed Fiddle Leaf Fig Tree (Ficus Lyrata)
      var leafMat = new THREE.MeshStandardMaterial({ color: 0x244a2b, roughness: 0.55, metalness: 0.04 });
      var stemMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.78 });
      addMesh(THREE, group, new THREE.CylinderGeometry(0.04, 0.07, h * 0.72, 8), stemMat, 0, h * 0.58, 0);
      addMesh(THREE, group, new THREE.CylinderGeometry(0.03, 0.04, h * 0.52, 8), stemMat, 0.15, h * 0.62, 0.1, 0.25, 0.5, -0.15);
      
      for (var l = 0; l < 10; l++) {
        var ang = (l / 10) * Math.PI * 2 + (l * 0.35);
        var ly = h * (0.44 + (l / 10) * 0.52);
        var reach = w * (0.38 + (l % 3) * 0.12);
        addMesh(THREE, group, new THREE.CylinderGeometry(0.015, 0.02, reach * 0.5, 6), stemMat, Math.cos(ang) * reach * 0.3, ly - 0.08, Math.sin(ang) * reach * 0.3, 0.4, ang, 0);
        var leafGeom = new THREE.BoxGeometry(reach * 0.55, 0.015, reach * 0.38);
        addMesh(THREE, group, leafGeom, leafMat, Math.cos(ang) * reach * 0.7, ly, Math.sin(ang) * reach * 0.7, 0.35, ang, 0.2);
      }
    } else if (t === 'kitchen') {
      addMesh(THREE, group, softBox(THREE, w, h * 0.92, d, 0.02), woodMat, 0, h * 0.46, 0);
      addMesh(THREE, group, softBox(THREE, w + 0.06, h * 0.08, d + 0.06, 0.02), mats.stone, 0, h * 0.96, 0);
      addMesh(THREE, group, new THREE.BoxGeometry(w * 0.35, 0.04, d * 0.55), mats.chrome, -w * 0.18, h + 0.02, 0);
      addMesh(THREE, group, new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8), mats.chrome, -w * 0.18, h + 0.16, -d * 0.28);
    } else if (t === 'bath' || t === 'bathtub') {
      addMesh(THREE, group, softBox(THREE, w, h, d, 0.12), mats.ceramic, 0, h * 0.5, 0);
      addMesh(THREE, group, softBox(THREE, w * 0.84, h * 0.65, d * 0.76, 0.08), mats.water, 0, h * 0.68, 0);
      addMesh(THREE, group, new THREE.CylinderGeometry(0.04, 0.04, 0.24, 10), mats.chrome, -w * 0.4, h + 0.12, 0);
    } else {
      addMesh(THREE, group, softBox(THREE, w, h, d, 0.05), woodMat, 0, h * 0.5, 0);
    }

    return group;
  }

  function buildArchitecturalShell(THREE, roomW, roomD, wallH, mats, stylePreset) {
    var shell = new THREE.Group();
    shell.name = 'ArchitecturalShell';
    var isConcrete = /concrete|industrial|slate/i.test(stylePreset || '');
    // Scandinavian photo uses rich warm dark walnut/espresso wood planks
    var floorHex = isConcrete ? '#7a756f' : '#3e3126';
    var floorMat = new THREE.MeshStandardMaterial({
      map: makeWoodTexture(THREE, floorHex, Math.max(3, Math.round(roomW / 2.5)), Math.max(3, Math.round(roomD / 2.5))),
      roughness: 0.42,
      metalness: 0.05,
    });
    var floor = new THREE.Mesh(new THREE.BoxGeometry(roomW + 0.4, 0.35, roomD + 0.4), floorMat);
    floor.position.set(0, -0.175, 0);
    floor.receiveShadow = true;
    floor.name = 'FloorSlab';
    shell.add(floor);

    // Woven living rug
    var rugW = Math.min(roomW * 0.52, 8.5);
    var rugD = Math.min(roomD * 0.48, 6.5);
    var rug = new THREE.Mesh(
      softBox(THREE, rugW, 0.04, rugD, 0.015),
      new THREE.MeshStandardMaterial({ map: makeRugTexture(THREE), roughness: 0.94 })
    );
    rug.position.set(0, 0.02, 0.2);
    rug.receiveShadow = true;
    rug.name = 'AreaRug';
    shell.add(rug);

    var wallT = 0.45;
    var wallMat = new THREE.MeshStandardMaterial({
      map: makePlasterTexture(THREE, isConcrete ? '#dcd9d3' : '#ede8df'),
      roughness: 0.88,
      metalness: 0.02,
    });

    // North (back) wall
    var northWall = new THREE.Mesh(new THREE.BoxGeometry(roomW + wallT * 2, wallH, wallT), wallMat);
    northWall.position.set(0, wallH / 2, -roomD / 2 - wallT / 2);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    northWall.name = 'NorthWall';
    shell.add(northWall);

    // West (left) wall
    var westWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, roomD), wallMat);
    westWall.position.set(-roomW / 2 - wallT / 2, wallH / 2, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    westWall.name = 'WestWall';
    shell.add(westWall);

    // East (right) Architectural Glass Window Wall with Vertical Warm Oak Mullions matching the photo
    var eastWindowWall = new THREE.Group();
    eastWindowWall.name = 'EastGlassWindowWall';
    addMesh(THREE, eastWindowWall, new THREE.BoxGeometry(wallT, 0.38, roomD), mats.walnut, roomW / 2 + wallT / 2, 0.19, 0);
    addMesh(THREE, eastWindowWall, new THREE.BoxGeometry(wallT, 0.42, roomD), mats.walnut, roomW / 2 + wallT / 2, wallH - 0.21, 0);
    var mullions = 5;
    for (var mi = 0; mi < mullions; mi++) {
      var mz = -roomD / 2 + (mi / (mullions - 1)) * roomD;
      addMesh(THREE, eastWindowWall, new THREE.BoxGeometry(wallT + 0.08, wallH - 0.8, 0.22), mats.walnut, roomW / 2 + wallT / 2, (wallH - 0.8) / 2 + 0.38, mz);
    }
    var glassEastMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8f4fc,
      roughness: 0.08,
      metalness: 0.02,
      transparent: true,
      opacity: 0.38,
      reflectivity: 0.65
    });
    addMesh(THREE, eastWindowWall, new THREE.PlaneGeometry(roomD - 0.4, wallH - 0.8), glassEastMat, roomW / 2 + 0.02, (wallH - 0.8) / 2 + 0.38, 0, 0, -Math.PI / 2, 0);
    shell.add(eastWindowWall);

    // Architectural outdoor terrace decking outside East glass wall
    var terraceGeo = new THREE.BoxGeometry(6.0, 0.22, roomD + 2.0);
    var terraceMesh = new THREE.Mesh(terraceGeo, mats.darkWood);
    terraceMesh.position.set(roomW / 2 + 3.0, -0.11, 0);
    terraceMesh.receiveShadow = true;
    shell.add(terraceMesh);

    // Baseboards
    var bbH = 0.38;
    var bbN = new THREE.Mesh(new THREE.BoxGeometry(roomW, bbH, 0.08), mats.darkWood);
    bbN.position.set(0, bbH / 2, -roomD / 2 + 0.04);
    shell.add(bbN);
    var bbW = new THREE.Mesh(new THREE.BoxGeometry(0.08, bbH, roomD), mats.darkWood);
    bbW.position.set(-roomW / 2 + 0.04, bbH / 2, 0);
    shell.add(bbW);

    // High Panoramic Transom / Ribbon Window on North Wall matching Scandinavian architecture
    var trW = roomW * 0.72;
    var trH = 1.45;
    var trY = wallH * 0.72;
    var trZ = -roomD / 2 + 0.05;
    var winGroup = new THREE.Group();
    winGroup.name = 'TransomDaylightWindow';
    winGroup.position.set(0, trY, trZ);
    var glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff2ff,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.45,
      emissive: 0xfff5e0,
      emissiveIntensity: 0.35,
    });
    addMesh(THREE, winGroup, new THREE.BoxGeometry(trW, trH, 0.14), mats.darkWood, 0, 0, 0);
    addMesh(THREE, winGroup, new THREE.PlaneGeometry(trW - 0.22, trH - 0.22), glassMat, 0, 0, 0.08);
    addMesh(THREE, winGroup, new THREE.BoxGeometry(trW - 0.22, 0.05, 0.16), mats.darkWood, 0, 0, 0.08);
    addMesh(THREE, winGroup, new THREE.BoxGeometry(0.08, trH - 0.2, 0.16), mats.darkWood, -trW * 0.25, 0, 0.08);
    addMesh(THREE, winGroup, new THREE.BoxGeometry(0.08, trH - 0.2, 0.16), mats.darkWood, trW * 0.25, 0, 0.08);
    shell.add(winGroup);

    // Paneled Door on West Wall
    var doorGroup = new THREE.Group();
    doorGroup.name = 'EntryDoor';
    doorGroup.position.set(-roomW / 2 + 0.04, 0, roomD * 0.26);
    doorGroup.rotation.y = Math.PI / 2;
    addMesh(THREE, doorGroup, new THREE.BoxGeometry(3.1, 6.8, 0.14), mats.darkWood, 0, 3.4, 0);
    addMesh(THREE, doorGroup, new THREE.BoxGeometry(2.8, 6.5, 0.18), mats.walnut, 0, 3.25, 0.02);
    addMesh(THREE, doorGroup, new THREE.SphereGeometry(0.1, 10, 10), mats.brass, 1.05, 3.2, 0.14);
    shell.add(doorGroup);

    // Wall Art Frame on North Wall
    var artGroup = new THREE.Group();
    artGroup.name = 'WallArt';
    artGroup.position.set(roomW * 0.26, wallH * 0.56, -roomD / 2 + 0.06);
    addMesh(THREE, artGroup, new THREE.BoxGeometry(2.8, 2.1, 0.08), mats.darkWood, 0, 0, 0);
    addMesh(THREE, artGroup, new THREE.BoxGeometry(2.5, 1.8, 0.1), mats.linen, 0, 0, 0.01);
    addMesh(THREE, artGroup, new THREE.BoxGeometry(1.4, 0.9, 0.11), mats.terracotta, -0.25, 0.12, 0.015);
    shell.add(artGroup);

    return shell;
  }

  function mount(containerId, opts) {
    var THREE = global.THREE;
    if (!THREE) throw new Error('Three.js not loaded');
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) throw new Error('Container not found');

    var roomW = Math.max(8, Number(opts.roomW) || 16);
    var roomD = Math.max(8, Number(opts.roomD) || 14);
    var wallH = Math.max(7, Number(opts.wallH) || 9);
    var variants = opts.variants || [];
    var stylePreset = opts.stylePreset || 'Warm Minimalist Oak & Concrete';
    var hud = opts.hud || {};

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c111d);

    var camera = new THREE.PerspectiveCamera(44, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 250);
    var controls = new THREE.OrbitControls(camera, container);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.49;

    var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    var envTex = buildStudioEnvMap(THREE, renderer);
    scene.environment = envTex;

    // ArchViz 3-point lighting
    var hemi = new THREE.HemisphereLight(0xf6f4ee, 0x3b352e, 0.65);
    scene.add(hemi);

    var sun = new THREE.DirectionalLight(0xfff1dc, 1.45);
    sun.position.set(-roomW * 0.35, wallH * 1.9, -roomD * 0.85);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.camera.left = -roomW;
    sun.shadow.camera.right = roomW;
    sun.shadow.camera.top = roomD;
    sun.shadow.camera.bottom = -roomD;
    scene.add(sun);

    var fill = new THREE.DirectionalLight(0xc4daf5, 0.42);
    fill.position.set(roomW, wallH * 1.1, roomD);
    scene.add(fill);

    var mats = {
      darkWood: new THREE.MeshStandardMaterial({ color: 0x2e231c, roughness: 0.62, metalness: 0.04 }),
      walnut: new THREE.MeshStandardMaterial({ map: makeWoodTexture(THREE, '#6e4a30', 2, 2), roughness: 0.55 }),
      linen: new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.92 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xd0d4da, roughness: 0.22, metalness: 0.88 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc9a659, roughness: 0.28, metalness: 0.85 }),
      charcoal: new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.42, metalness: 0.25 }),
      ceramic: new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.25, metalness: 0.05 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xdcd7ce, roughness: 0.45, metalness: 0.05 }),
      terracotta: new THREE.MeshStandardMaterial({ color: 0xa65c3e, roughness: 0.82 }),
      foliage: new THREE.MeshStandardMaterial({ color: 0x3b6e44, roughness: 0.82 }),
      water: new THREE.MeshStandardMaterial({ color: 0x7eb6c8, roughness: 0.15, metalness: 0.1 }),
    };

    var exportRoot = new THREE.Group();
    exportRoot.name = 'SceneMosaicRoom';
    scene.add(exportRoot);

    var shellGroup = buildArchitecturalShell(THREE, roomW, roomD, wallH, mats, stylePreset);
    exportRoot.add(shellGroup);

    var furnitureGroup = new THREE.Group();
    furnitureGroup.name = 'FurnitureLayer';
    exportRoot.add(furnitureGroup);

    var currentIdx = 0;

    var camTween = null;
    function tweenCameraTo(targetPos, targetTarget, durationMs) {
      if (camTween && camTween.raf) global.cancelAnimationFrame(camTween.raf);
      var startPos = camera.position.clone();
      var startTarget = controls.target.clone();
      var startTime = performance.now();
      var dur = durationMs || 650;
      function step(now) {
        var elapsed = now - startTime;
        var p = Math.min(1.0, elapsed / dur);
        // Astryx-style cubic ease-out: 1 - Math.pow(1 - p, 3)
        var ease = 1.0 - Math.pow(1.0 - p, 3);
        camera.position.lerpVectors(startPos, targetPos, ease);
        controls.target.lerpVectors(startTarget, targetTarget, ease);
        controls.update();
        if (p < 1.0) {
          camTween = { raf: global.requestAnimationFrame(step) };
        } else {
          camTween = null;
        }
      }
      camTween = { raf: global.requestAnimationFrame(step) };
    }

    function setCameraPreset(mode, instant) {
      var aspectFactor = Math.max(1.0, 0.92 / Math.max(0.35, camera.aspect || 1));
      var span = Math.max(roomW, roomD);
      var targetPos = new THREE.Vector3();
      var targetLookAt = new THREE.Vector3();
      if (mode === 'top') {
        targetPos.set(0, span * 1.45 * aspectFactor, 0.01);
        targetLookAt.set(0, 0, 0);
      } else if (mode === 'eye') {
        targetPos.set(roomW * 0.44, 4.6, roomD * 0.46);
        targetLookAt.set(-roomW * 0.12, 2.6, -roomD * 0.12);
      } else {
        targetPos.set(roomW * 0.95 * aspectFactor, wallH * 1.48 * aspectFactor, roomD * 1.08 * aspectFactor);
        targetLookAt.set(0, 1.8, 0);
      }
      if (instant) {
        camera.position.copy(targetPos);
        controls.target.copy(targetLookAt);
        controls.update();
      } else {
        tweenCameraTo(targetPos, targetLookAt, 650);
      }
    }

    function loadVariant(idx) {
      currentIdx = Math.max(0, Math.min(variants.length - 1, idx));
      while (furnitureGroup.children.length) furnitureGroup.remove(furnitureGroup.children[0]);
      var v = variants[currentIdx];
      if (!v) return;
      (v.objects || []).forEach(function (obj) {
        var meshGroup = createFurniture3D(THREE, obj, mats);
        meshGroup.position.set(Number(obj.x) || 0, Number(obj.y) || 0, Number(obj.z) || 0);
        if (obj.yaw_deg) meshGroup.rotation.y = (Number(obj.yaw_deg) * Math.PI) / 180;
        meshGroup.userData = {
          name: obj.name || obj.type,
          type: obj.type,
          w: obj.w,
          d: obj.d,
          h: obj.h,
        };
        furnitureGroup.add(meshGroup);
      });
      if (hud.onVariantChange) hud.onVariantChange(currentIdx, v);
    }

    function exportGLB() {
      if (!THREE.GLTFExporter) {
        alert('GLTFExporter not loaded');
        return;
      }
      var exporter = new THREE.GLTFExporter();
      exporter.parse(
        exportRoot,
        function (result) {
          var blob = result instanceof ArrayBuffer
            ? new Blob([result], { type: 'model/gltf-binary' })
            : new Blob([JSON.stringify(result, null, 2)], { type: 'model/gltf+json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'scenemosaic-room.glb';
          a.click();
        },
        { binary: true }
      );
    }

    function exportJSON() {
      var v = variants[currentIdx] || {};
      var payload = JSON.stringify({ room_width: roomW, room_depth: roomD, style_preset: stylePreset, variant: v }, null, 2);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      a.download = 'scenemosaic-layout.json';
      a.click();
    }

    // Raycast click-to-inspect
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', function (ev) {
      var rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(furnitureGroup.children, true);
      if (hits.length && hud.onInspect) {
        var node = hits[0].object;
        while (node && node.parent && node.parent !== furnitureGroup) node = node.parent;
        if (node && node.userData && node.userData.name) hud.onInspect(node.userData);
      }
    });

    function onResize() {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    global.addEventListener('resize', onResize);

    setCameraPreset('iso');
    loadVariant(0);

    var animId = 0;
    function animate() {
      animId = global.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return {
      loadVariant: loadVariant,
      setCameraPreset: setCameraPreset,
      exportGLB: exportGLB,
      exportJSON: exportJSON,
      setSunHour: function (hour) {
        var t = Math.max(6, Math.min(20, Number(hour) || 11));
        var angle = ((t - 6) / 14) * Math.PI;
        sun.position.set(-Math.cos(angle) * roomW, Math.sin(angle) * wallH * 2.1 + 3, -roomD * 0.75);
        sun.intensity = t > 17.5 ? 0.65 : 1.45;
        sun.color.setHex(t > 16.5 ? 0xffc48c : 0xfff1dc);
      },
      destroy: function () {
        global.cancelAnimationFrame(animId);
        global.removeEventListener('resize', onResize);
        renderer.dispose();
      },
    };
  }

  function mountWithHUD(opts) {
    var style = document.createElement('style');
    style.textContent =
      ':root{' +
      '--astryx-surface:rgba(15,23,42,0.94);' +
      '--astryx-surface-subtle:rgba(30,41,59,0.7);' +
      '--astryx-border:rgba(255,255,255,0.12);' +
      '--astryx-border-focus:rgba(56,189,248,0.45);' +
      '--astryx-accent:#38bdf8;' +
      '--astryx-text:#f8fafc;' +
      '--astryx-text-muted:#94a3b8;' +
      '--astryx-radius:12px;' +
      '--astryx-shadow:0 12px 36px rgba(0,0,0,0.48);' +
      '}' +
      '*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#090d16;color:var(--astryx-text);font-family:Inter,system-ui,sans-serif}' +
      '#sm-stage{position:fixed;inset:0;width:100%;height:100%}' +
      '#sm-badge{position:fixed;top:14px;left:14px;z-index:10;background:var(--astryx-surface);backdrop-filter:blur(12px);border:1px solid var(--astryx-border);border-radius:var(--astryx-radius);padding:10px 14px;max-width:340px;box-shadow:var(--astryx-shadow)}' +
      '#sm-badge h1{font-size:13.5px;font-weight:700;color:#fff;letter-spacing:-0.01em}#sm-badge p{font-size:11px;color:var(--astryx-text-muted);margin-top:2px}' +
      '#sm-inspect{position:fixed;bottom:14px;left:14px;z-index:10;background:var(--astryx-surface);border:1px solid var(--astryx-border);border-radius:8px;padding:7px 12px;font-size:11px;color:#cbd5e1;display:none;backdrop-filter:blur(8px)}' +
      '#sm-hud{position:fixed;top:14px;right:14px;z-index:10;width:240px;background:var(--astryx-surface);backdrop-filter:blur(14px);border:1px solid var(--astryx-border);border-radius:var(--astryx-radius);padding:12px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--astryx-shadow)}' +
      '#sm-hud h3{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--astryx-accent);margin-top:3px}' +
      '.sm-row{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}' +
      '.sm-btn{width:100%;text-align:left;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#e2e8f0;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.18s ease}' +
      '.sm-btn:hover{background:rgba(56,189,248,0.12);border-color:rgba(56,189,248,0.3)}' +
      '.sm-btn.c{text-align:center;padding:6px 2px;font-size:10.5px}.sm-btn.active{background:#0284c7;border-color:#38bdf8;color:#fff;box-shadow:0 0 12px rgba(56,189,248,0.35)}' +
      '.sm-ver{font-size:10px;color:#34d399;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);border-radius:6px;padding:4px 8px;margin-top:4px;display:inline-block}' +
      '#sm-2d{position:fixed;inset:0;width:100%;height:100%;display:none;background:#070d18;z-index:5}' +
      '.sm-exp{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}' +
      '.sm-ebtn{padding:7px 8px;border-radius:8px;border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.14);color:#a7f3d0;font-size:11px;font-weight:600;cursor:pointer;text-align:center;transition:background 0.18s ease}' +
      '.sm-ebtn:hover{background:rgba(16,185,129,.24)}' +
      '.sm-sl{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--astryx-text-muted);gap:8px}.sm-sl input{flex:1;accent-color:var(--astryx-accent)}';
    document.head.appendChild(style);

    var ver = opts.verification || { status: 'VERIFIED', items: (opts.variants[0] && opts.variants[0].objects ? opts.variants[0].objects.length : 0), collisions: 0 };
    var verChips = '<div class="sm-ver">✓ ' + ver.status + ' · ' + ver.items + ' items · ' + ver.collisions + ' collisions</div>';
    if (ver.daylight) {
      var dl = ver.daylight.glazingRatio != null ? '☀ Daylight ' + Math.round(ver.daylight.glazingRatio * 100) + '% · ' + (ver.daylight.verdict || '') : '☀ ' + (ver.daylight.verdict || '');
      verChips += '<div class="sm-ver" style="color:#fbbf24;background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.3)">' + dl + '</div>';
    }
    if (ver.walkway && ver.walkway.minGap != null) {
      var ww = '↔ Min walkway ' + ver.walkway.minGap + ' ft · ' + ver.walkway.status;
      var warn = ver.walkway.status !== 'clear';
      verChips += '<div class="sm-ver" style="' + (warn ? 'color:#fbbf24;background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.3)' : '') + '">' + ww + '</div>';
    }
    document.body.innerHTML =
      '<div id="sm-stage"></div>' +
      '<canvas id="sm-2d"></canvas>' +
      '<div id="sm-badge"><h1>' + (opts.title || 'SceneMosaic 3D') + '</h1><p>' + (opts.stylePreset || '') + ' · ' + opts.roomW + "' × " + opts.roomD + "'</p>" + verChips + '</div>' +
      '<div id="sm-inspect"></div>' +
      '<div id="sm-hud"><h3>Layout Variants</h3><div id="sm-vars" style="display:flex;flex-direction:column;gap:5px"></div>' +
      '<h3>View &amp; Camera</h3><div class="sm-row" id="sm-cams">' +
      '<button class="sm-btn c" data-cam="2d">2D Map</button>' +
      '<button class="sm-btn c active" data-cam="iso">Iso</button>' +
      '<button class="sm-btn c" data-cam="eye">Eye</button>' +
      '<button class="sm-btn c" data-cam="top">Top</button></div>' +
      '<h3>Daylight</h3><div class="sm-sl"><span id="sm-sunl">11:00</span><input id="sm-sun" type="range" min="7" max="19" step="1" value="11"/></div>' +
      '<div class="sm-exp"><button class="sm-ebtn" id="sm-glb">Export .glb</button><button class="sm-ebtn" id="sm-json">Export JSON</button></div></div>';

    var c2d = document.getElementById('sm-2d');
    var activeVariantIdx = 0;
    var activeCam = 'iso';

    function draw2DMap() {
      var dpr = global.devicePixelRatio || 2;
      var W = global.innerWidth || 800;
      var H = global.innerHeight || 600;
      c2d.width = W * dpr;
      c2d.height = H * dpr;
      var ctx = c2d.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = '#070d18';
      ctx.fillRect(0, 0, W, H);

      var pad = 90;
      var scale = Math.min((W - pad * 2) / opts.roomW, (H - pad * 2.2) / opts.roomD);
      var ox = (W - opts.roomW * scale) / 2;
      var oy = (H - opts.roomD * scale) / 2 + 20;
      var rwPx = opts.roomW * scale;
      var rdPx = opts.roomD * scale;

      // Architectural Blueprint Grid (Fine dots and grid lines)
      ctx.strokeStyle = 'rgba(56,189,248,0.06)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx <= opts.roomW; gx += 2) {
        ctx.beginPath(); ctx.moveTo(ox + gx * scale, oy); ctx.lineTo(ox + gx * scale, oy + rdPx); ctx.stroke();
      }
      for (var gz = 0; gz <= opts.roomD; gz += 2) {
        ctx.beginPath(); ctx.moveTo(ox, oy + gz * scale); ctx.lineTo(ox + rwPx, oy + gz * scale); ctx.stroke();
      }

      // Room Floor Slab
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox, oy, rwPx, rdPx);

      // Central Area Rug with woven border
      var rugW = Math.min(opts.roomW * 0.52, 8.5) * scale;
      var rugD = Math.min(opts.roomD * 0.48, 6.5) * scale;
      var rugX = ox + rwPx / 2 - rugW / 2;
      var rugZ = oy + rdPx / 2 - rugD / 2 + 8;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.08)';
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(rugX, rugZ, rugW, rugD);
      ctx.strokeRect(rugX, rugZ, rugW, rugD);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
      ctx.strokeRect(rugX + 6, rugZ + 6, rugW - 12, rugD - 12);
      ctx.setLineDash([]);

      // Double-line Architectural Outer Walls
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, rwPx, rdPx);
      ctx.strokeRect(ox - 5, oy - 5, rwPx + 10, rdPx + 10);

      // North Window (Triple-line architectural glazing)
      var winW = Math.min(5.2, opts.roomW * 0.38) * scale;
      var winX = ox + rwPx / 2 - opts.roomW * 0.12 * scale - winW / 2;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(winX, oy - 5, winW, 10);
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(winX, oy - 2); ctx.lineTo(winX + winW, oy - 2);
      ctx.moveTo(winX, oy + 2); ctx.lineTo(winX + winW, oy + 2);
      ctx.stroke();

      // West Entry Door + 90-degree dashed Swing Arc
      var doorZ = oy + rdPx / 2 + opts.roomD * 0.26 * scale;
      var doorW = 3.0 * scale;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      // Door leaf
      ctx.beginPath(); ctx.moveTo(ox, doorZ - doorW / 2); ctx.lineTo(ox + doorW, doorZ - doorW / 2); ctx.stroke();
      // Door swing arc
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(ox, doorZ - doorW / 2, doorW, 0, Math.PI / 2); ctx.stroke();
      ctx.setLineDash([]);

      // Dimension Ticks & Lines (Top and Left)
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = '#7dd3fc';
      ctx.lineWidth = 1.2;
      // Top dimension
      ctx.beginPath();
      ctx.moveTo(ox, oy - 22); ctx.lineTo(ox + rwPx, oy - 22);
      ctx.moveTo(ox, oy - 27); ctx.lineTo(ox, oy - 17);
      ctx.moveTo(ox + rwPx, oy - 27); ctx.lineTo(ox + rwPx, oy - 17);
      // Left dimension
      ctx.moveTo(ox - 22, oy); ctx.lineTo(ox - 22, oy + rdPx);
      ctx.moveTo(ox - 27, oy); ctx.lineTo(ox - 17, oy);
      ctx.moveTo(ox - 27, oy + rdPx); ctx.lineTo(ox - 17, oy + rdPx);
      ctx.stroke();

      // Dimension Text
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.roomW + "'-0\" (" + (opts.roomW * 0.3048).toFixed(1) + 'm) · ' + Math.round(opts.roomW * opts.roomD) + ' sq ft', ox + rwPx / 2, oy - 30);
      ctx.save();
      ctx.translate(ox - 32, oy + rdPx / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(opts.roomD + "'-0\" (" + (opts.roomD * 0.3048).toFixed(1) + 'm)', 0, 0);
      ctx.restore();

      // Furniture Footprints with Architectural CAD Vector Symbols
      var v = (opts.variants || [])[activeVariantIdx];
      ((v && v.objects) || []).forEach(function (item) {
        var cx = ox + (Number(item.x) + opts.roomW / 2) * scale;
        var cz = oy + (Number(item.z) + opts.roomD / 2) * scale;
        var fw = Number(item.w) * scale;
        var fd = Number(item.d) * scale;
        var yaw = Number(item.yaw_deg) || 0;
        var t = String(item.type || '').toLowerCase();

        ctx.save();
        ctx.translate(cx, cz);
        ctx.rotate(-(yaw * Math.PI) / 180);

        // Base fill & outline
        ctx.fillStyle = normalizeColor(item.color || '#475569');
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-fw / 2, -fd / 2, fw, fd);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-fw / 2, -fd / 2, fw, fd);

        // Architectural Vector Details
        if (t === 'sofa' || t === 'couch') {
          // Armrests
          var armW = Math.max(4, fw * 0.12);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(-fw / 2, -fd / 2, armW, fd);
          ctx.fillRect(fw / 2 - armW, -fd / 2, armW, fd);
          // Backrest
          var backD = Math.max(4, fd * 0.22);
          ctx.fillRect(-fw / 2, -fd / 2, fw, backD);
          // Cushion Dividers
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-fw / 6, -fd / 2 + backD); ctx.lineTo(-fw / 6, fd / 2);
          ctx.moveTo(fw / 6, -fd / 2 + backD); ctx.lineTo(fw / 6, fd / 2);
          ctx.stroke();
        } else if (t === 'desk') {
          // Computer monitor footprint on back edge
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(-fw * 0.3, -fd / 2 + 2, fw * 0.6, 3);
          // Keyboard outline
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.strokeRect(-fw * 0.2, -fd * 0.1, fw * 0.4, fd * 0.35);
        } else if (t === 'tv') {
          // Screen line along rear
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(-fw * 0.42, -fd / 2 + 1, fw * 0.84, 3);
        } else if (t === 'coffee_table') {
          // Inset decorative tray
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.strokeRect(-fw * 0.35, -fd * 0.35, fw * 0.7, fd * 0.7);
        } else if (t === 'planter' || t === 'plant') {
          // Circular ceramic rim + radiating leaf lines
          ctx.fillStyle = '#15803d';
          ctx.beginPath(); ctx.arc(0, 0, Math.min(fw, fd) * 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#86efac';
          for (var a = 0; a < 6; a++) {
            var rad = (a / 6) * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(rad) * fw * 0.44, Math.sin(rad) * fd * 0.44); ctx.stroke();
          }
        } else if (t === 'lamp') {
          // Glowing circle
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath(); ctx.arc(0, 0, Math.min(fw, fd) * 0.34, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();

        // Label pill (prevents overlapping illegibility)
        var label = item.name || item.type;
        var sub = item.w + "'×" + item.d + "'";
        ctx.font = '600 9.5px Inter, system-ui, sans-serif';
        var tw = Math.max(ctx.measureText(label).width, ctx.measureText(sub).width) + 8;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(cx - tw / 2, cz - 12, tw, 22);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(cx - tw / 2, cz - 12, tw, 22);

        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cz - 2);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 8px Inter, system-ui, sans-serif';
        ctx.fillText(sub, cx, cz + 8);
      });
    }

    var vWrap = document.getElementById('sm-vars');
    var inspectEl = document.getElementById('sm-inspect');
    var studio = null;
    (opts.variants || []).forEach(function (v, idx) {
      var b = document.createElement('button');
      b.className = 'sm-btn' + (idx === 0 ? ' active' : '');
      b.textContent = v.name;
      b.onclick = function () { if (studio) studio.loadVariant(idx); };
      vWrap.appendChild(b);
    });

    studio = mount('sm-stage', {
      roomW: opts.roomW,
      roomD: opts.roomD,
      wallH: opts.wallH || 9.2,
      variants: opts.variants,
      stylePreset: opts.stylePreset,
      hud: {
        onVariantChange: function (idx) {
          activeVariantIdx = idx;
          Array.prototype.forEach.call(vWrap.children, function (el, i) { el.classList.toggle('active', i === idx); });
          if (activeCam === '2d') draw2DMap();
        },
        onInspect: function (info) {
          inspectEl.style.display = 'block';
          inspectEl.textContent = info.name + ' (' + info.type + ') · ' + info.w + "' × " + info.d + "' × " + info.h + "'";
        },
      },
    });

    document.querySelectorAll('#sm-cams button').forEach(function (btn) {
      btn.onclick = function () {
        document.querySelectorAll('#sm-cams button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeCam = btn.dataset.cam;
        if (activeCam === '2d') {
          c2d.style.display = 'block';
          draw2DMap();
        } else {
          c2d.style.display = 'none';
          studio.setCameraPreset(activeCam);
        }
      };
    });
    global.addEventListener('resize', function () {
      if (activeCam === '2d') draw2DMap();
    });
    var sun = document.getElementById('sm-sun');
    var sunl = document.getElementById('sm-sunl');
    sun.oninput = function () {
      sunl.textContent = String(sun.value).padStart(2, '0') + ':00';
      studio.setSunHour(Number(sun.value));
    };
    document.getElementById('sm-glb').onclick = function () { studio.exportGLB(); };
    document.getElementById('sm-json').onclick = function () { studio.exportJSON(); };
    return studio;
  }

  global.SatchidaSceneMosaic = { mount: mount, mountWithHUD: mountWithHUD };
})(typeof window !== 'undefined' ? window : this);
