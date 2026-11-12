/* Satchida SceneMosaic Studio — Self-contained Photorealistic 3D Room Reconstruction & Layout Evolution Engine */
(function (global) {
  'use strict';

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
      addMesh(THREE, group, softBox(THREE, w - 0.2, h * 0.16, d * 0.84, 0.03), mats.darkWood, 0, h * 0.08, 0);
      addMesh(THREE, group, softBox(THREE, w, h * 0.36, d * 0.86, 0.06), fabricMat, 0, h * 0.32, 0);
      addMesh(THREE, group, softBox(THREE, w, h * 0.58, d * 0.2, 0.07), fabricMat, 0, h * 0.62, -d * 0.35);
      addMesh(THREE, group, softBox(THREE, w * 0.12, h * 0.48, d * 0.82, 0.06), fabricMat, -w * 0.44, h * 0.48, 0.02);
      addMesh(THREE, group, softBox(THREE, w * 0.12, h * 0.48, d * 0.82, 0.06), fabricMat, w * 0.44, h * 0.48, 0.02);

      var count = Math.max(2, Math.min(4, Math.round(w / 2.2)));
      var cw = (w * 0.74) / count;
      for (var i = 0; i < count; i++) {
        var cx = (i + 0.5 - count / 2) * cw;
        addMesh(THREE, group, softBox(THREE, cw * 0.94, h * 0.2, d * 0.66, 0.06, { puff: 0.32 }), cushionMat, cx, h * 0.54, d * 0.06);
      }
      var pColors = ['#e8c987', '#d88c66', '#8db3ad'];
      for (var pi = 0; pi < 2; pi++) {
        var side = pi === 0 ? -1 : 1;
        var pMat = new THREE.MeshStandardMaterial({ color: pColors[pi], roughness: 0.9 });
        addMesh(THREE, group, softBox(THREE, w * 0.16, h * 0.32, 0.24, 0.05, { puff: 0.42 }), pMat, side * w * 0.32, h * 0.72, -d * 0.18, -0.26, side * 0.15, side * 0.08);
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
    } else if (t === 'desk' || t === 'table' || t === 'dining' || t === 'coffee_table') {
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
    } else if (t === 'chair' || t === 'armchair') {
      addMesh(THREE, group, softBox(THREE, w * 0.9, h * 0.14, d * 0.88, 0.04, { puff: 0.2 }), fabricMat, 0, h * 0.48, 0);
      addMesh(THREE, group, softBox(THREE, w * 0.88, h * 0.48, d * 0.14, 0.04), fabricMat, 0, h * 0.74, -d * 0.38);
      var cLegGeo = new THREE.CylinderGeometry(0.045, 0.03, h * 0.45, 8);
      [[-w * 0.36, -d * 0.34], [w * 0.36, -d * 0.34], [-w * 0.36, d * 0.34], [w * 0.36, d * 0.34]].forEach(function (pt) {
        addMesh(THREE, group, cLegGeo, mats.darkWood, pt[0], h * 0.225, pt[1]);
      });
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
    } else if (t === 'lamp') {
      addMesh(THREE, group, new THREE.CylinderGeometry(w * 0.32, w * 0.38, 0.1, 16), mats.brass, 0, 0.05, 0);
      addMesh(THREE, group, new THREE.CylinderGeometry(0.04, 0.05, h * 0.72, 12), mats.brass, 0, h * 0.4, 0);
      var shadeMat = new THREE.MeshStandardMaterial({
        color: 0xfff3dc,
        roughness: 0.85,
        emissive: 0xffc878,
        emissiveIntensity: 0.55,
        side: THREE.DoubleSide,
      });
      addMesh(THREE, group, new THREE.CylinderGeometry(w * 0.26, w * 0.42, h * 0.28, 18, 1, true), shadeMat, 0, h * 0.84, 0);
      var pLight = new THREE.PointLight(0xffd6a0, 0.75, 11, 2);
      pLight.position.set(0, h * 0.82, 0);
      group.add(pLight);
    } else if (t === 'planter' || t === 'plant') {
      addMesh(THREE, group, new THREE.CylinderGeometry(w * 0.36, w * 0.28, h * 0.35, 16), mats.terracotta, 0, h * 0.175, 0);
      addMesh(THREE, group, new THREE.CylinderGeometry(w * 0.33, w * 0.33, 0.04, 14), mats.darkWood, 0, h * 0.34, 0);
      [
        [0, h * 0.62, 0, w * 0.38],
        [-w * 0.18, h * 0.54, w * 0.14, w * 0.24],
        [w * 0.2, h * 0.58, -w * 0.1, w * 0.26],
        [0, h * 0.78, 0.08, w * 0.22],
      ].forEach(function (blob) {
        addMesh(THREE, group, new THREE.IcosahedronGeometry(blob[3], 1), mats.foliage, blob[0], blob[1], blob[2]);
      });
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
    var isConcrete = /concrete|industrial|slate|dark/i.test(stylePreset || '');

    var floorMat = new THREE.MeshStandardMaterial({
      map: makeWoodTexture(THREE, isConcrete ? '#7a756f' : '#c09a6b', Math.max(2, Math.round(roomW / 3)), Math.max(2, Math.round(roomD / 3))),
      roughness: isConcrete ? 0.78 : 0.48,
      metalness: 0.04,
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

    // East (right) partial/low cutaway wall so interior stays visible in Iso
    var eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH * 0.35, roomD), wallMat);
    eastWall.position.set(roomW / 2 + wallT / 2, (wallH * 0.35) / 2, 0);
    eastWall.receiveShadow = true;
    eastWall.name = 'EastCutawayWall';
    shell.add(eastWall);

    // Baseboards
    var bbH = 0.38;
    var bbN = new THREE.Mesh(new THREE.BoxGeometry(roomW, bbH, 0.08), mats.darkWood);
    bbN.position.set(0, bbH / 2, -roomD / 2 + 0.04);
    shell.add(bbN);
    var bbW = new THREE.Mesh(new THREE.BoxGeometry(0.08, bbH, roomD), mats.darkWood);
    bbW.position.set(-roomW / 2 + 0.04, bbH / 2, 0);
    shell.add(bbW);

    // Framed Daylight Window on North Wall
    var winW = Math.min(5.2, roomW * 0.38);
    var winH = Math.min(4.8, wallH * 0.54);
    var winY = wallH * 0.55;
    var winZ = -roomD / 2 + 0.05;
    var winGroup = new THREE.Group();
    winGroup.name = 'DaylightWindow';
    winGroup.position.set(-roomW * 0.12, winY, winZ);
    var glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff2ff,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.45,
      emissive: 0xfff5e0,
      emissiveIntensity: 0.35,
    });
    addMesh(THREE, winGroup, new THREE.BoxGeometry(winW, winH, 0.12), mats.charcoal, 0, 0, 0);
    addMesh(THREE, winGroup, new THREE.PlaneGeometry(winW - 0.28, winH - 0.28), glassMat, 0, 0, 0.07);
    addMesh(THREE, winGroup, new THREE.BoxGeometry(0.1, winH - 0.2, 0.16), mats.charcoal, 0, 0, 0.04);
    addMesh(THREE, winGroup, new THREE.BoxGeometry(winW + 0.24, 0.14, 0.28), mats.charcoal, 0, -winH / 2 - 0.04, 0.08);
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

    function setCameraPreset(mode) {
      var aspectFactor = Math.max(1.0, 0.92 / Math.max(0.35, camera.aspect || 1));
      var span = Math.max(roomW, roomD);
      if (mode === 'top') {
        camera.position.set(0, span * 1.45 * aspectFactor, 0.01);
        controls.target.set(0, 0, 0);
      } else if (mode === 'eye') {
        camera.position.set(roomW * 0.44, 4.6, roomD * 0.46);
        controls.target.set(-roomW * 0.12, 2.6, -roomD * 0.12);
      } else {
        camera.position.set(roomW * 0.95 * aspectFactor, wallH * 1.48 * aspectFactor, roomD * 1.08 * aspectFactor);
        controls.target.set(0, 1.8, 0);
      }
      controls.update();
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
      '*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#0c111d;color:#f8fafc;font-family:Inter,system-ui,sans-serif}' +
      '#sm-stage{position:fixed;inset:0;width:100%;height:100%}' +
      '#sm-badge{position:fixed;top:12px;left:12px;z-index:10;background:rgba(15,23,42,.88);backdrop-filter:blur(8px);border:1px solid rgba(56,189,248,.28);border-radius:10px;padding:9px 13px;max-width:320px}' +
      '#sm-badge h1{font-size:13px;font-weight:700;color:#f8fafc}#sm-badge p{font-size:11px;color:#94a3b8;margin-top:2px}' +
      '#sm-inspect{position:fixed;bottom:14px;left:12px;z-index:10;background:rgba(15,23,42,.88);border:1px solid rgba(148,163,184,.28);border-radius:8px;padding:7px 11px;font-size:11px;color:#cbd5e1;display:none}' +
      '#sm-hud{position:fixed;top:12px;right:12px;z-index:10;width:228px;background:rgba(15,23,42,.9);backdrop-filter:blur(8px);border:1px solid rgba(56,189,248,.3);border-radius:12px;padding:11px;display:flex;flex-direction:column;gap:7px}' +
      '#sm-hud h3{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#38bdf8;margin-top:2px}' +
      '.sm-row{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}' +
      '.sm-btn{width:100%;text-align:left;padding:6px 9px;border-radius:7px;border:1px solid rgba(56,189,248,.25);background:rgba(56,189,248,.09);color:#e0f2fe;font-size:11px;font-weight:600;cursor:pointer}' +
      '.sm-btn.c{text-align:center;padding:5px 4px;font-size:10px}.sm-btn.active{background:#0284c7;border-color:#38bdf8;color:#fff}' +
      '.sm-exp{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:3px}' +
      '.sm-ebtn{padding:6px 8px;border-radius:7px;border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.14);color:#a7f3d0;font-size:11px;font-weight:600;cursor:pointer;text-align:center}' +
      '.sm-sl{display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#cbd5e1;gap:6px}.sm-sl input{flex:1;accent-color:#38bdf8}';
    document.head.appendChild(style);

    document.body.innerHTML =
      '<div id="sm-stage"></div>' +
      '<div id="sm-badge"><h1>' + (opts.title || 'SceneMosaic 3D') + '</h1><p>' + (opts.stylePreset || '') + ' · ' + opts.roomW + "' × " + opts.roomD + "'</p></div>" +
      '<div id="sm-inspect"></div>' +
      '<div id="sm-hud"><h3>Layout Variants</h3><div id="sm-vars" style="display:flex;flex-direction:column;gap:5px"></div>' +
      '<h3>Camera</h3><div class="sm-row" id="sm-cams">' +
      '<button class="sm-btn c active" data-cam="iso">Iso</button>' +
      '<button class="sm-btn c" data-cam="eye">Eye-Level</button>' +
      '<button class="sm-btn c" data-cam="top">Top</button></div>' +
      '<h3>Daylight</h3><div class="sm-sl"><span id="sm-sunl">11:00</span><input id="sm-sun" type="range" min="7" max="19" step="1" value="11"/></div>' +
      '<div class="sm-exp"><button class="sm-ebtn" id="sm-glb">Export .glb</button><button class="sm-ebtn" id="sm-json">Export JSON</button></div></div>';

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
          Array.prototype.forEach.call(vWrap.children, function (el, i) { el.classList.toggle('active', i === idx); });
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
        studio.setCameraPreset(btn.dataset.cam);
      };
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
