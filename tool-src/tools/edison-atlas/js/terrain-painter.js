(() => {
  // js/usaciv/hex.js
  var SQRT3 = Math.sqrt(3);
  var NEIGHBOURS = [
    [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]],
    // even rows
    [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]
    // odd rows
  ];
  function makeGrid({ radius: R2, cols, rows }) {
    const W = SQRT3 * R2;
    const H = 1.5 * R2;
    const corners = [];
    for (let k = 0; k < 6; k++) {
      const a = (60 * k - 30) * Math.PI / 180;
      corners.push([R2 * Math.cos(a), R2 * Math.sin(a)]);
    }
    return {
      R: R2,
      W,
      H,
      cols,
      rows,
      size: cols * rows,
      corners,
      cx(i) {
        const r = i / cols | 0;
        return W * (i % cols + 0.5 * (r & 1));
      },
      cy(i) {
        return H * (i / cols | 0);
      },
      neighbour(i, d) {
        const c = i % cols, r = i / cols | 0;
        const [dc, dr] = NEIGHBOURS[r & 1][d];
        const nc = c + dc, nr = r + dr;
        return nc < 0 || nr < 0 || nc >= cols || nr >= rows ? -1 : nr * cols + nc;
      },
      cellAt(x, y) {
        const q = (SQRT3 / 3 * x - y / 3) / R2;
        const r = 2 / 3 * y / R2;
        let rx = Math.round(q), rz = Math.round(r);
        const ry = Math.round(-q - r);
        const dx = Math.abs(rx - q), dy = Math.abs(ry - (-q - r)), dz = Math.abs(rz - r);
        if (dx > dy && dx > dz) rx = -ry - rz;
        else if (dy <= dz) rz = -rx - ry;
        const row = rz, col = rx + (row - (row & 1) >> 1);
        return col < 0 || row < 0 || col >= cols || row >= rows ? -1 : row * cols + col;
      },
      // Inclusive range of cell rows/cols touching a world-space rectangle.
      range(x0, y0, x1, y1) {
        return {
          r0: Math.max(0, Math.floor(y0 / H) - 1),
          r1: Math.min(rows - 1, Math.ceil(y1 / H) + 1),
          c0: Math.max(0, Math.floor(x0 / W) - 1),
          c1: Math.min(cols - 1, Math.ceil(x1 / W) + 1)
        };
      }
    };
  }
  function hash01(i, salt = 0) {
    let h = i * 374761393 + salt * 668265263 | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  }

  // js/usaciv/color.js
  function parseHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  var mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function shade(c, k) {
    return k >= 0 ? mix(c, [255, 255, 255], k) : mix(c, [0, 0, 0], -k);
  }
  var css = (c, a = 1) => a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  var STATE_PALETTE = [
    "#d8483f",
    "#3b7dd8",
    "#e2b23a",
    "#3aa865",
    "#9a58d0",
    "#e57c32",
    "#2fb3b0",
    "#d9549b",
    "#8cb83a",
    "#5b6fd8",
    "#b8653a",
    "#56c1e6"
  ].map(parseHex);

  // js/usaciv/terrain.js
  var COVER = {
    NONE: 0,
    DECIDUOUS: 1,
    EVERGREEN: 2,
    MIXED: 3,
    SCRUB: 4,
    GRASS: 5,
    PASTURE: 6,
    CROP: 7,
    WETLAND: 8,
    URBAN: 9,
    BARREN: 10,
    ICE: 11
  };
  var ELEV_STOPS = [
    [-100, "#5d8a39"],
    [250, "#7c9744"],
    [700, "#a39c58"],
    [1400, "#b09366"],
    [2200, "#9a8068"],
    [3e3, "#8c8078"],
    [3800, "#d8dde0"]
  ].map(([e, c]) => [e, parseHex(c)]);
  var OCEAN_DEEP = parseHex("#0d2a47");

  // js/usaciv/world.js
  var FOREIGN = -2;
  var isCapital = (city) => city.capital != null ? !!city.capital : city.id === "47900";
  var NO_DATA = parseHex("#55534d");

  // js/usaciv/render/art/lod.js
  var LOD = Object.freeze({ FAR: "far", MID: "mid", NEAR: "near", CLOSE: "close" });
  var LOD_ORDER = [LOD.FAR, LOD.MID, LOD.NEAR, LOD.CLOSE];
  function lodFor(Rpx) {
    return Rpx < 10 ? LOD.FAR : Rpx < 22 ? LOD.MID : Rpx < 44 ? LOD.NEAR : LOD.CLOSE;
  }
  var atLeast = (lod, min) => LOD_ORDER.indexOf(lod) >= LOD_ORDER.indexOf(min);

  // js/usaciv/render/art/sprites.js
  var BUDGET_PX = 24e6;
  var cache = /* @__PURE__ */ new Map();
  var stats = { count: 0, pixels: 0, hits: 0, misses: 0, painted: 0 };
  function newCanvas(w, h) {
    if (typeof document !== "undefined") {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      return cv;
    }
    return new OffscreenCanvas(w, h);
  }
  function bucketPx(upx, { min = 4, max = 256 } = {}) {
    const v = Math.min(max, Math.max(min, upx || min));
    return Math.pow(2, Math.round(Math.log2(v) * 4) / 4);
  }
  function deviceScale(ctx) {
    const t = ctx.getTransform();
    return Math.hypot(t.a, t.b) || 1;
  }
  function getSprite(key, upx, box, paint) {
    const k = `${key}@${upx}`;
    let spr = cache.get(k);
    if (spr) {
      stats.hits++;
      cache.delete(k);
      cache.set(k, spr);
      return spr;
    }
    stats.misses++;
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const pw = Math.max(1, Math.ceil((box.x1 - box.x0) * upx));
    const ph = Math.max(1, Math.ceil((box.y1 - box.y0) * upx));
    const cv = newCanvas(pw, ph);
    const g = cv.getContext("2d");
    g.setTransform(upx, 0, 0, upx, -box.x0 * upx, -box.y0 * upx);
    g.lineCap = "round";
    g.lineJoin = "round";
    paint(g, upx);
    spr = { canvas: cv, x0: box.x0, y0: box.y0, w: pw / upx, h: ph / upx, px: pw * ph };
    cache.set(k, spr);
    stats.count++;
    stats.pixels += spr.px;
    if (t0) stats.painted += performance.now() - t0;
    evict();
    return spr;
  }
  function evict() {
    if (stats.pixels <= BUDGET_PX) return;
    for (const [k, spr] of cache) {
      if (stats.pixels <= BUDGET_PX * 0.8 || cache.size <= 1) break;
      cache.delete(k);
      stats.count--;
      stats.pixels -= spr.px;
    }
  }
  function drawSprite(ctx, spr, x, y, k) {
    ctx.drawImage(spr.canvas, x + spr.x0 * k, y + spr.y0 * k, spr.w * k, spr.h * k);
  }
  var patternTiles = /* @__PURE__ */ new Map();
  var patterns = /* @__PURE__ */ new WeakMap();
  function makePattern(ctx, key, sizePx, dpr, paint) {
    const k = `${key}|${sizePx}|${Math.max(1, Math.round(sizePx * dpr))}`;
    let tile = patternTiles.get(k);
    if (!tile) {
      const n = Math.max(1, Math.round(sizePx * dpr));
      tile = newCanvas(n, n);
      const g = tile.getContext("2d");
      g.setTransform(n / sizePx, 0, 0, n / sizePx, 0, 0);
      g.lineCap = "round";
      g.lineJoin = "round";
      paint(g, sizePx);
      patternTiles.set(k, tile);
    }
    let m = patterns.get(ctx);
    if (!m) patterns.set(ctx, m = /* @__PURE__ */ new Map());
    let p = m.get(k);
    if (!p) m.set(k, p = ctx.createPattern(tile, "repeat"));
    return p;
  }
  function wrapDraw(size, draw) {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy);
  }
  function rng(seed) {
    let a = (seed | 0) + 1831565813;
    return () => {
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // js/usaciv/render/art/city.js
  var cityIsDot = (city, Rpx) => city.minTileRpx != null ? Rpx < city.minTileRpx : Rpx < 9 || Rpx < 18 && city.population < 25e4 || Rpx < 26 && city.population < 1e5;
  var SPILL_MIN_POP = 15e5;
  var spills = /* @__PURE__ */ new WeakMap();
  function metroSpill(w) {
    let out = spills.get(w);
    if (out) return out;
    out = /* @__PURE__ */ new Map();
    const { grid } = w, dev = w.pct?.developed;
    for (const [cell, city] of w.cityByCell) {
      if (!(city.population >= SPILL_MIN_POP)) continue;
      const cand = [];
      for (let d = 0; d < 6; d++) {
        const j = grid.neighbour(cell, d);
        if (j < 0 || w.water[j] || w.cityByCell.has(j) || out.has(j) || w.cover[j] !== COVER.URBAN) continue;
        cand.push([j, dev ? dev[j] || 0 : 50]);
      }
      cand.sort((a, b) => b[1] - a[1]);
      const n = city.population >= 5e6 ? 2 : 1;
      cand.slice(0, n).forEach(([j], k) => {
        out.set(j, { id: `spill-${j}`, name: city.name, capital: false, of: city, population: (city.population >= 5e6 ? 9e5 : 5e5) / (k + 1) });
      });
    }
    spills.set(w, out);
    return out;
  }
  var CITY_CLASSES = [
    { id: "village", min: 0, village: true },
    { id: "town", min: 15e4, extent: 0.66, lot: 0.2, core: 0.9, mid: 0.55, height: 0.2, park: 0.05, ragged: 0.4, grey: 0.08, fringe: true, civic: true },
    { id: "city", min: 4e5, extent: 0.8, lot: 0.18, core: 0.66, mid: 0.33, height: 0.44, park: 0.06, ragged: 0.32, grey: 0.14, fringe: true, civic: true },
    { id: "metropolis", min: 15e5, extent: 0.9, lot: 0.16, core: 0.5, mid: 0.18, height: 0.58, park: 0.06, ragged: 0.25, grey: 0.2, fringe: true },
    { id: "megalopolis", min: 5e6, extent: 0.96, lot: 0.145, core: 0.36, mid: 0.08, height: 0.68, park: 0.05, ragged: 0.12, grey: 0.26, fringe: false }
  ];
  var LOT_MIN_PX = 5.5;
  function cityClass(population) {
    let c = CITY_CLASSES[0];
    for (const k of CITY_CLASSES) if (population >= k.min) c = k;
    return c;
  }
  var P = {
    asphalt: [74, 72, 70],
    kerb: [182, 176, 160],
    walk: [196, 190, 174],
    concrete: [168, 162, 148],
    lawn: [118, 150, 80],
    lawnBlock: [128, 160, 88],
    park: [96, 146, 70],
    path: [218, 208, 176],
    plaza: [204, 194, 168],
    plazaInner: [224, 216, 194],
    pond: [92, 160, 206],
    tree: [60, 108, 50],
    treeMid: [82, 132, 60],
    treeLit: [128, 170, 82],
    conifer: [44, 88, 54],
    field: [[214, 186, 104], [176, 178, 86], [196, 160, 92], [150, 172, 80]],
    road: [196, 186, 160],
    roadEdge: [92, 84, 70],
    walls: [[236, 226, 204], [242, 238, 228], [218, 200, 164], [226, 214, 190], [214, 222, 226]],
    roofs: [[170, 78, 56], [124, 82, 60], [92, 98, 112], [184, 110, 66], [70, 82, 100]],
    stone: [[208, 196, 172], [188, 178, 160], [168, 98, 74], [196, 188, 176], [150, 118, 96]],
    glass: [[118, 160, 190], [96, 128, 158], [150, 178, 196], [196, 170, 112], [128, 170, 176]],
    marble: [240, 236, 224],
    dome: [246, 244, 236],
    white: [244, 240, 230]
  };
  var AX = 0.866;
  var AY = 0.5;
  var iso = (u, v) => [(u - v) * AX, (u + v) * AY];
  var CORNERS = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (60 * k - 30) * Math.PI / 180;
    return [Math.cos(a), Math.sin(a)];
  });
  function hexPath(ctx, x, y, R2, f) {
    ctx.beginPath();
    ctx.moveTo(x + R2 * CORNERS[0][0] * f, y + R2 * CORNERS[0][1] * f);
    for (let k = 1; k < 6; k++) ctx.lineTo(x + R2 * CORNERS[k][0] * f, y + R2 * CORNERS[k][1] * f);
    ctx.closePath();
  }
  var hexRho = (x, y, R2) => Math.max(Math.abs(x), 0.5 * Math.abs(x) + 0.866 * Math.abs(y)) / (0.866 * R2);
  function foot(x, y, a, b) {
    const [ax, ay] = iso(a, 0), [bx, by] = iso(0, b);
    return [
      [x - ax - bx, y - ay - by],
      // N (back)
      [x + ax - bx, y + ay - by],
      // E
      [x + ax + bx, y + ay + by],
      // S (front)
      [x - ax + bx, y - ay + by]
      // W
    ];
  }
  var up = (p, h) => [p[0], p[1] - h];
  function poly(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }
  function fillPoly(g, pts, style) {
    g.beginPath();
    poly(g, pts);
    g.fillStyle = style;
    g.fill();
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    for (let k = p.length - 1; k >= 0; k--) {
      const q = p[k];
      while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
      hi.push(q);
    }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  var shadowOf = (F, h) => hull(F.concat(F.map((p) => [p[0] + h * 0.62, p[1] + h * 0.26])));
  var pick = (arr, t) => arr[Math.min(arr.length - 1, Math.floor(t * arr.length))];
  function gable(g, F, hw, hr, wall, roof, along, lineW) {
    const [N, E, S, W] = F;
    const [Nt, Et, St, Wt] = F.map((p) => up(p, hw));
    const lit = css(wall), dark = css(shade(wall, -0.32));
    fillPoly(g, [W, S, St, Wt], lit);
    fillPoly(g, [S, E, Et, St], dark);
    const rLit = css(shade(roof, 0.14)), rDark = css(shade(roof, -0.28)), rBack = css(shade(roof, 0.26));
    if (along === 0) {
      const r0 = up([(Nt[0] + Wt[0]) / 2, (Nt[1] + Wt[1]) / 2], hr), r1 = up([(Et[0] + St[0]) / 2, (Et[1] + St[1]) / 2], hr);
      fillPoly(g, [Nt, Et, r1, r0], rBack);
      fillPoly(g, [St, Et, r1], dark);
      fillPoly(g, [Wt, St, r1, r0], rLit);
      if (lineW) {
        g.beginPath();
        g.moveTo(r0[0], r0[1]);
        g.lineTo(r1[0], r1[1]);
        g.strokeStyle = css(shade(roof, 0.45), 0.8);
        g.lineWidth = lineW;
        g.stroke();
      }
    } else {
      const r0 = up([(Nt[0] + Et[0]) / 2, (Nt[1] + Et[1]) / 2], hr), r1 = up([(Wt[0] + St[0]) / 2, (Wt[1] + St[1]) / 2], hr);
      fillPoly(g, [Wt, St, r1], lit);
      fillPoly(g, [Nt, Wt, r1, r0], rBack);
      fillPoly(g, [Et, St, r1, r0], rDark);
      if (lineW) {
        g.beginPath();
        g.moveTo(r0[0], r0[1]);
        g.lineTo(r1[0], r1[1]);
        g.strokeStyle = css(shade(roof, 0.45), 0.8);
        g.lineWidth = lineW;
        g.stroke();
      }
    }
    if (lineW) {
      g.beginPath();
      poly(g, [W, Wt, Nt, Et, E, S]);
      g.strokeStyle = "rgba(40,28,18,.35)";
      g.lineWidth = lineW;
      g.stroke();
    }
  }
  function treeShape(g, x, y, r, conifer, shadowToo = true) {
    if (shadowToo) {
      g.beginPath();
      g.ellipse(x + r * 0.6, y + r * 0.1, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
      g.fillStyle = "rgba(20,30,10,.26)";
      g.fill();
    }
    if (conifer) {
      for (const [t, w0] of [[0, 0.85], [0.7, 0.62]]) {
        const yb = y - r * (0.1 + t), yt = yb - r * 1.5;
        g.beginPath();
        g.moveTo(x, yt);
        g.lineTo(x + r * w0, yb);
        g.lineTo(x - r * w0, yb);
        g.closePath();
        g.fillStyle = css(P.conifer);
        g.fill();
        g.beginPath();
        g.moveTo(x, yt);
        g.lineTo(x - r * w0, yb);
        g.lineTo(x - r * w0 * 0.1, yb);
        g.closePath();
        g.fillStyle = css(shade(P.conifer, 0.2));
        g.fill();
      }
      return;
    }
    g.beginPath();
    g.arc(x + r * 0.12, y - r * 0.62, r, 0, Math.PI * 2);
    g.fillStyle = css(P.tree);
    g.fill();
    g.beginPath();
    g.arc(x - r * 0.08, y - r * 0.78, r * 0.82, 0, Math.PI * 2);
    g.fillStyle = css(P.treeMid);
    g.fill();
    g.beginPath();
    g.arc(x - r * 0.34, y - r * 1.02, r * 0.42, 0, Math.PI * 2);
    g.fillStyle = css(P.treeLit);
    g.fill();
  }
  var Painter = class {
    constructor(g, R2, sCss, dev, detail, accent) {
      this.g = g;
      this.R = R2;
      this.s = sCss;
      this.dev = dev;
      this.detail = detail;
      this.accent = accent;
      this.shadows = new Path2D();
    }
    px(n) {
      return n / this.s;
    }
    /** Ground shadow of a box (cast to the lower right). */
    shadow(F, h) {
      poly(this.shadows, shadowOf(F, h));
    }
    /** A box on footprint F (from foot()), from height z0 to z0 + h. Colours: base [r,g,b]. */
    box(F, z0, h, base, { glass = false, outline = true, top = null } = {}) {
      const g = this.g;
      const [N, E, S, W] = F.map((p) => up(p, z0));
      const [Nt, Et, St, Wt] = [N, E, S, W].map((p) => up(p, h));
      const lit = base, dark = shade(base, glass ? -0.38 : -0.34), topC = top || shade(base, 0.2);
      if (h > this.px(6)) {
        const gr = g.createLinearGradient(0, Wt[1], 0, W[1]);
        gr.addColorStop(0, css(shade(lit, glass ? 0.16 : 0.06)));
        gr.addColorStop(1, css(shade(lit, -0.14)));
        fillPoly(g, [W, S, St, Wt], gr);
        const gd = g.createLinearGradient(0, Et[1], 0, E[1]);
        gd.addColorStop(0, css(shade(dark, 0.08)));
        gd.addColorStop(1, css(shade(dark, -0.18)));
        fillPoly(g, [S, E, Et, St], gd);
      } else {
        fillPoly(g, [W, S, St, Wt], css(lit));
        fillPoly(g, [S, E, Et, St], css(dark));
      }
      fillPoly(g, [Nt, Et, St, Wt], css(topC));
      if (outline && this.detail >= 1) {
        g.lineJoin = "round";
        g.beginPath();
        g.moveTo(Wt[0], Wt[1]);
        g.lineTo(St[0], St[1]);
        g.lineTo(Et[0], Et[1]);
        g.moveTo(St[0], St[1]);
        g.lineTo(S[0], S[1]);
        g.strokeStyle = "rgba(255,250,235,.35)";
        g.lineWidth = this.px(0.6);
        g.stroke();
        g.beginPath();
        poly(g, [W, Wt, Nt, Et, E, S]);
        g.strokeStyle = "rgba(28,22,16,.45)";
        g.lineWidth = this.px(0.6);
        g.stroke();
      }
      return { N: Nt, E: Et, S: St, W: Wt, base: [N, E, S, W] };
    }
    /** Rows of windows on both visible faces of a box placed with box(). */
    windows(F, z0, h, glass) {
      if (this.detail < 2) return;
      const g = this.g;
      const floor = Math.max(this.px(3.2), this.R * 0.022);
      const nf = Math.floor((h - floor * 0.6) / floor);
      if (nf < 1) return;
      const [, E, S, W] = F.map((p) => up(p, z0));
      const faces = [
        [W, S, glass ? "rgba(225,240,250,.42)" : "rgba(70,78,92,.55)"],
        [S, E, glass ? "rgba(160,200,230,.22)" : "rgba(30,34,44,.5)"]
      ];
      for (const [a, b, style] of faces) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const nCol = Math.max(1, Math.floor(len / this.px(3)));
        const path = new Path2D();
        for (let f = 0; f < nf; f++) {
          const z = floor * (f + 0.45), zh = floor * 0.45;
          for (let c = 0; c < nCol; c++) {
            const t0 = (c + 0.22) / nCol, t1 = (c + 0.78) / nCol;
            const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 - z];
            const p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 - z];
            poly(path, [p0, p1, [p1[0], p1[1] - zh], [p0[0], p0[1] - zh]]);
          }
        }
        g.fillStyle = style;
        g.fill(path);
      }
    }
    /** A small house with a gable roof; `along` = 0 ridge along A, 1 along B. */
    house(x, y, a, b, wall, roof, along) {
      const hw = Math.max(this.R * 0.03, this.px(2)), hr = Math.max(this.R * 0.026, this.px(1.6));
      const F = foot(x, y, a, b);
      gable(this.g, F, hw, hr, wall, roof, along, this.detail >= 1 ? this.px(0.5) : 0);
      this.shadow(F, hw + hr * 0.6);
    }
    tree(x, y, r, conifer = false) {
      treeShape(this.g, x, y, r, conifer);
    }
    /** Feathered fill: a soft dark halo of `blur` km around path P, then P itself. */
    feather(P2, style, blur, haloStyle) {
      const g = this.g;
      g.save();
      g.shadowColor = haloStyle;
      g.shadowBlur = Math.max(1, blur * this.dev);
      g.fillStyle = style;
      g.fill(P2);
      g.restore();
    }
  };
  function drawChurch(p, x, y, sz, accent) {
    const g = p.g;
    const roof = mix([88, 92, 104], accent, 0.35);
    const F = foot(x, y, sz, sz * 0.55);
    const hw = sz * 0.62;
    p.shadow(F, hw + sz * 0.4);
    gable(g, F, hw, sz * 0.48, P.white, roof, 0, p.detail >= 1 ? p.px(0.5) : 0);
    const [tx, ty] = iso(sz * 0.95, 0);
    const t = sz * 0.3, th = sz * 1.55, sh = sz * 1.15;
    const Ft = foot(x + tx, y + ty, t, t);
    p.shadow(Ft, th + sh * 0.6);
    const top = p.box(Ft, 0, th, P.white);
    if (p.detail >= 1) {
      const [, E, S, W] = Ft.map((q) => up(q, th * 0.72));
      const bh = th * 0.14;
      fillPoly(g, [W, S, up(S, bh), up(W, bh)], "rgba(60,52,44,.7)");
      fillPoly(g, [S, E, up(E, bh), up(S, bh)], "rgba(30,26,22,.75)");
    }
    const tip = [x + tx, y + ty - th - sh];
    fillPoly(g, [top.W, top.S, tip], css(shade(accent, 0.12)));
    fillPoly(g, [top.S, top.E, tip], css(shade(accent, -0.3)));
    g.beginPath();
    g.arc(tip[0], tip[1], Math.max(p.px(0.7), sz * 0.07), 0, Math.PI * 2);
    g.fillStyle = "#f0d27a";
    g.fill();
  }
  function drawWaterTower(p, x, y, sz, accent) {
    const g = p.g;
    const z = sz * 1.9, rx = sz * 0.62, ry = rx * 0.5, th = sz * 0.7;
    g.beginPath();
    g.ellipse(x + z * 0.5, y + z * 0.2, rx * 1.1, ry * 0.9, 0, 0, Math.PI * 2);
    g.fillStyle = "rgba(22,18,12,.22)";
    g.fill();
    const lw = Math.max(p.px(0.7), sz * 0.07);
    for (const [lx, ly, a] of [[-0.45, -0.18, 0.55], [0.45, -0.18, 0.55], [-0.5, 0.2, 0.9], [0.5, 0.2, 0.9]]) {
      g.beginPath();
      g.moveTo(x + lx * rx, y + ly * rx);
      g.lineTo(x + lx * rx * 0.55, y - z + ly * ry * 0.5);
      g.strokeStyle = `rgba(70,74,80,${a})`;
      g.lineWidth = lw;
      g.stroke();
    }
    const cy = y - z;
    const body = g.createLinearGradient(x - rx, 0, x + rx, 0);
    body.addColorStop(0, "#fbfaf6");
    body.addColorStop(0.5, "#e6e4de");
    body.addColorStop(1, "#9c9a96");
    g.beginPath();
    g.ellipse(x, cy, rx, ry, 0, 0, Math.PI);
    g.lineTo(x - rx, cy - th);
    g.ellipse(x, cy - th, rx, ry, 0, Math.PI, 2 * Math.PI);
    g.closePath();
    g.fillStyle = body;
    g.fill();
    const b0 = cy - th * 0.38, bh = th * 0.28;
    g.beginPath();
    g.ellipse(x, b0, rx, ry, 0, 0, Math.PI);
    g.lineTo(x - rx, b0 - bh);
    g.ellipse(x, b0 - bh, rx, ry, 0, Math.PI, 0, true);
    g.closePath();
    g.fillStyle = css(accent);
    g.fill();
    g.beginPath();
    g.ellipse(x, cy - th, rx, ry, 0, 0, Math.PI);
    g.lineTo(x, cy - th - sz * 0.55);
    g.closePath();
    g.fillStyle = "#d2d0ca";
    g.fill();
    g.beginPath();
    g.moveTo(x - rx, cy - th);
    g.lineTo(x, cy - th - sz * 0.55);
    g.lineTo(x - rx * 0.1, cy - th + ry);
    g.closePath();
    g.fillStyle = "rgba(255,255,255,.55)";
    g.fill();
  }
  function paintVillage(p, seed, accent, Rpx) {
    const g = p.g, R2 = p.R;
    const r = rng(seed * 7919 + 101);
    const roadW = Math.max(R2 * 0.05, p.px(2.6)), roadIn = Math.max(R2 * 0.03, p.px(1.4));
    const hs = Math.max(R2 * 0.048, p.px(2.6));
    const S = hs * 2.35;
    const side = roadW / 2 + hs * 0.9 + Math.max(R2 * 0.012, p.px(0.8));
    const v0 = (r() - 0.5) * 0.08 * R2;
    const cross = r() < 0.7 ? { u: (r() - 0.5) * 0.2 * R2, v1: (0.26 + r() * 0.12) * R2 } : null;
    const nHouses = Rpx < 34 ? 6 : Rpx < 56 ? 8 : 10;
    const spots = [];
    const cu = cross ? cross.u : 0;
    for (let u = -0.44 * R2; u <= 0.44 * R2; u += S) {
      if (cross && Math.abs(u - cross.u) < S * 0.8) continue;
      for (const sg of [-1, 1]) spots.push({ u, v: v0 + sg * side, along: 0 });
    }
    if (cross) {
      for (let v = -cross.v1; v <= cross.v1; v += S) {
        if (Math.abs(v - v0) < S * 0.8) continue;
        for (const sg of [-1, 1]) spots.push({ u: cross.u + sg * side, v, along: 1 });
      }
    }
    for (const sp of spots) sp.d = Math.hypot(sp.u - cu, sp.v - v0) * (0.8 + r() * 0.4);
    spots.sort((a, b) => a.d - b.d);
    const church = r() < 0.62;
    const lm = { u: cu + S * 1.1, v: v0 - side - hs * (church ? 0.5 : 0.2) };
    const free = spots.filter((sp) => Math.hypot(sp.u - lm.u, sp.v - lm.v) > hs * 3.2);
    const houses = free.slice(0, nHouses);
    const items = [];
    for (const sp of houses) {
      const [x, y] = iso(sp.u, sp.v);
      const wall = pick(P.walls, r()), roof = r() < 0.2 ? mix(P.roofs[0], accent, 0.55) : pick(P.roofs, r());
      const a = hs * (sp.along === 0 ? 1.05 : 0.75) * (0.9 + r() * 0.2), b = hs * (sp.along === 0 ? 0.75 : 1.05) * (0.9 + r() * 0.2);
      items.push({ y, draw: () => p.house(x, y, a, b, wall, roof, sp.along) });
    }
    {
      const [x, y] = iso(lm.u, lm.v);
      items.push({ y, draw: () => church ? drawChurch(p, x, y, hs * 1.35, accent) : drawWaterTower(p, x, y, hs * 1.1, accent) });
    }
    const roadDist = (u, v) => Math.min(Math.abs(v - v0), cross && Math.abs(v) <= cross.v1 + S ? Math.abs(u - cross.u) : Infinity);
    const nTrees = 7 + Math.floor(r() * 4);
    const treeR = Math.max(R2 * 0.042, p.px(2.2));
    const placed = houses.map((sp) => [sp.u, sp.v]).concat([[lm.u, lm.v]]);
    for (let k = 0, tries = 0; k < nTrees && tries < 140; tries++) {
      const ang = r() * Math.PI * 2, rad = (0.12 + r() * 0.46) * R2;
      const u = cu + Math.cos(ang) * rad, v = v0 + Math.sin(ang) * rad * 0.8;
      const [x, y] = iso(u, v);
      if (hexRho(x, y, R2) > 0.7) continue;
      if (roadDist(u, v) < roadW + treeR) continue;
      if (placed.some(([pu, pv]) => Math.hypot(pu - u, pv - v) < hs * 1.7)) continue;
      placed.push([u, v]);
      const conifer = r() < 0.25, tr = treeR * (0.85 + r() * 0.3);
      items.push({ y, draw: () => p.tree(x, y, tr, conifer) });
      k++;
    }
    if (p.detail >= 1) {
      const nF = 3 + Math.floor(r() * 2);
      for (let k = 0, tries = 0; k < nF && tries < 30; tries++) {
        const ang = r() * Math.PI * 2, rad = (0.52 + r() * 0.16) * R2;
        const u = Math.cos(ang) * rad, v = Math.sin(ang) * rad;
        const fa = (0.1 + r() * 0.07) * R2, fb = (0.07 + r() * 0.05) * R2;
        const F = foot(...iso(u, v), fa, fb);
        if (F.some(([fx, fy]) => hexRho(fx, fy, R2) > 0.84)) continue;
        if (Math.abs(v - v0) < fb + roadW * 2 || cross && Math.abs(u - cross.u) < fa + roadW * 2 && Math.abs(v) < cross.v1) continue;
        if (placed.some(([pu, pv]) => Math.abs(pu - u) < fa + hs * 1.5 && Math.abs(pv - v) < fb + hs * 1.5)) continue;
        placed.push([u, v]);
        const col = pick(P.field, r());
        fillPoly(g, F, css(col, 0.9));
        g.beginPath();
        const [N, E, S2, W] = F;
        const nS = Math.max(3, Math.round(fb * 2 * p.s / 2.4));
        for (let q = 1; q < nS; q++) {
          const t = q / nS;
          g.moveTo(N[0] + (W[0] - N[0]) * t, N[1] + (W[1] - N[1]) * t);
          g.lineTo(E[0] + (S2[0] - E[0]) * t, E[1] + (S2[1] - E[1]) * t);
        }
        g.strokeStyle = css(shade(col, -0.25), 0.5);
        g.lineWidth = p.px(0.6);
        g.stroke();
        g.beginPath();
        poly(g, F);
        g.strokeStyle = "rgba(70,60,30,.35)";
        g.lineWidth = p.px(0.6);
        g.stroke();
      }
    }
    const [gx, gy] = iso(cu, v0);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, R2 * 0.5);
    gr.addColorStop(0, "rgba(236,226,186,.2)");
    gr.addColorStop(1, "rgba(236,226,186,0)");
    g.fillStyle = gr;
    g.fillRect(gx - R2 * 0.5, gy - R2 * 0.5, R2, R2);
    const road = new Path2D();
    const [m0x, m0y] = iso(-0.6 * R2, v0), [m1x, m1y] = iso(0.6 * R2, v0);
    road.moveTo(m0x, m0y);
    road.lineTo(m1x, m1y);
    if (cross) {
      const [c0x, c0y] = iso(cross.u, -cross.v1), [c1x, c1y] = iso(cross.u, cross.v1);
      road.moveTo(c0x, c0y);
      road.lineTo(c1x, c1y);
    }
    const tail = new Path2D();
    for (const sg of [-1, 1]) {
      const [ax, ay] = iso(sg * 0.6 * R2, v0), [bx, by] = iso(sg * 0.8 * R2, v0);
      tail.moveTo(ax, ay);
      tail.lineTo(bx, by);
    }
    g.lineCap = "round";
    for (const [P2, a] of [[road, 1], [tail, 0.5]]) {
      g.strokeStyle = css(P.roadEdge, 0.5 * a);
      g.lineWidth = roadW;
      g.stroke(P2);
      g.strokeStyle = css(P.road, 0.95 * a);
      g.lineWidth = roadIn;
      g.stroke(P2);
    }
    return items;
  }
  function gridLayout(cls, seed, R2, Rpx, capital) {
    const L = Math.max(cls.lot * R2, LOT_MIN_PX / Rpx * R2);
    const sw = Math.max(L * 0.19, 1.3 / Rpx * R2);
    const half = L / 2, bh = half - sw / 2;
    const n = Math.ceil(R2 * 1.2 / L) + 1;
    const lots = [], fringe = [];
    const H = (id, salt) => hash01(seed * 7919 + id, salt);
    const capR = capital ? capitolExtent(R2, Rpx) : null;
    for (let u = -n; u <= n; u++) {
      for (let v = -n; v <= n; v++) {
        const [x, y] = iso(u * L, v * L);
        const id = (u + 64) * 131 + (v + 64);
        const rho = Math.max(...foot(x, y, half, half).map((q) => hexRho(q[0], q[1], R2)));
        const rc = hexRho(x, y, R2);
        const reserved = capR && reservedByCapitol(u * L, v * L, L, capR);
        const cut = !reserved && rc > cls.extent * 0.68 && H(id, 10) < cls.ragged;
        if (rho <= cls.extent && !cut) {
          const c = Math.max(0, Math.min(1, 1 - rc / cls.extent + (H(id, 11) - 0.5) * 0.16));
          lots.push({ x, y, u, v, c, id, type: reserved ? "reserved" : null });
        } else if (cls.fringe && rho <= 0.86) {
          fringe.push({ x, y, id });
        }
      }
    }
    const free = lots.filter((l) => !l.type);
    const best = (ok, salt) => {
      let b = null, bv = -1;
      for (const l of free) {
        if (l.type || !ok(l)) continue;
        const h = H(l.id, salt);
        if (h > bv) {
          b = l;
          bv = h;
        }
      }
      return b;
    };
    if (free.length >= 4) {
      const park = best((l) => l.c > 0.2 && l.c < 0.7, 12);
      if (park) park.type = "park";
    }
    if (free.length > 12 && cls.core < 1) {
      const plaza = best((l) => l.c > 0.45 && l.c < 0.82, 14);
      if (plaza) plaza.type = "plaza";
    }
    if (cls.civic && free.length >= 8 && !capital) {
      const civ = best((l) => l.c > 0.3 && l.c < 0.75, 16);
      if (civ) civ.type = "civic";
    }
    for (const l of free) {
      if (l.type) continue;
      if (H(l.id, 13) < cls.park) l.type = "park";
      else if (l.c > cls.core && H(l.id, 15) < 0.9) l.type = "core";
      else if (l.c > cls.mid) l.type = "mid";
      else l.type = "res";
    }
    return { L, sw, half, bh, lots, fringe };
  }
  function capitolExtent(R2, Rpx) {
    const q = R2 * 0.1 * Math.max(1, Math.min(1.5, 26 / Rpx));
    return { q, half: q * 2.9, mallFrom: q * 2.9, mallTo: Math.min(R2 * 0.78, q * 8.5), mallHalf: q * 1.05 };
  }
  function reservedByCapitol(u, v, L, C2) {
    const h = L * 0.5;
    const inSq = Math.abs(u) - h < C2.half && Math.abs(v) - h < C2.half;
    const inMall = u + h > C2.mallFrom && u - h < C2.mallTo && Math.abs(v) - h < C2.mallHalf;
    return inSq || inMall;
  }
  function paintCapitolGround(p, C2) {
    const g = p.g;
    fillPoly(g, foot(0, 0, C2.half, C2.half), css(P.plaza));
    fillPoly(g, foot(0, 0, C2.half * 0.82, C2.half * 0.82), css(P.plazaInner));
    const mu = (C2.mallFrom + C2.mallTo) / 2, mh = (C2.mallTo - C2.mallFrom) / 2;
    const [mx, my] = iso(mu, 0);
    fillPoly(g, foot(mx, my, mh, C2.mallHalf), css(P.lawn));
    if (p.detail >= 1) {
      for (const sv of [-0.55, 0.55]) {
        const [ax, ay] = iso(C2.mallFrom, sv * C2.mallHalf), [bx, by] = iso(C2.mallTo, sv * C2.mallHalf);
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.strokeStyle = css(P.path, 0.85);
        g.lineWidth = Math.max(p.px(1), C2.q * 0.12);
        g.stroke();
      }
      const [rx, ry] = iso(C2.mallTo - C2.q * 1.6, 0);
      fillPoly(g, foot(rx, ry, C2.q * 0.9, C2.q * 0.22), "rgba(110,170,210,.95)");
    }
  }
  function capitolItems(p, C2) {
    const items = [];
    const q = C2.q;
    if (p.detail >= 1) {
      const nT = Math.max(2, Math.floor((C2.mallTo - C2.mallFrom - q) / Math.max(q * 0.9, p.px(5))));
      for (let k = 0; k <= nT; k++) {
        const u = C2.mallFrom + q * 0.5 + (C2.mallTo - C2.mallFrom - q * 1.6) * k / nT;
        for (const sv of [-0.95, 0.95]) {
          const [tx, ty] = iso(u, sv * C2.mallHalf);
          items.push({ y: ty, draw: () => p.tree(tx, ty, Math.max(q * 0.22, p.px(1.6))) });
        }
      }
    }
    const [ox, oy] = iso(C2.mallTo - q * 0.4, 0);
    items.push({
      y: oy,
      draw: () => {
        const a = Math.max(q * 0.13, p.px(1.2)), h = q * 2.1;
        const F = foot(ox, oy, a, a);
        p.shadow(F, h);
        const t = p.box(F, 0, h, P.marble, { outline: false });
        const tip = [ox, oy - h - a * 2.4];
        fillPoly(p.g, [t.W, t.S, tip], css(shade(P.marble, 0.05)));
        fillPoly(p.g, [t.S, t.E, tip], css(shade(P.marble, -0.3)));
      }
    });
    items.push({
      y: 0,
      draw: () => {
        const g = p.g;
        const wingH = q * 0.55;
        const F = foot(0, 0, q * 0.95, q * 2.5);
        p.shadow(F, q * 1.4);
        p.box(F, 0, wingH, P.marble);
        const Fc = foot(0, 0, q * 1.05, q * 0.95);
        p.box(Fc, 0, wingH * 1.25, P.marble);
        const Fp = foot(q * 1.25, 0, q * 0.3, q * 0.6);
        const por = p.box(Fp, 0, wingH * 1.1, shade(P.marble, -0.02));
        const ped = [por.S, por.E, [(por.S[0] + por.E[0]) / 2, (por.S[1] + por.E[1]) / 2 - q * 0.28]];
        fillPoly(g, ped, css(shade(P.marble, -0.12)));
        if (p.detail >= 1) {
          const [, E, S] = Fp;
          g.beginPath();
          for (let k = 1; k < 6; k++) {
            const t = k / 6;
            const bx = S[0] + (E[0] - S[0]) * t, by = S[1] + (E[1] - S[1]) * t;
            g.moveTo(bx, by - q * 0.05);
            g.lineTo(bx, by - wingH * 1);
          }
          g.strokeStyle = "rgba(255,255,250,.85)";
          g.lineWidth = Math.max(p.px(0.6), q * 0.05);
          g.stroke();
        }
        const z = wingH * 1.25;
        const rx = q * 0.78, ry = rx * 0.5, dh = q * 0.55;
        const cy = -z;
        const drum = g.createLinearGradient(-rx, 0, rx, 0);
        drum.addColorStop(0, css(shade(P.dome, 0)));
        drum.addColorStop(0.45, css(shade(P.dome, -0.08)));
        drum.addColorStop(1, css(shade(P.dome, -0.4)));
        g.beginPath();
        g.ellipse(0, cy, rx, ry, 0, 0, Math.PI);
        g.lineTo(-rx, cy - dh);
        g.ellipse(0, cy - dh, rx, ry, 0, Math.PI, 2 * Math.PI);
        g.closePath();
        g.fillStyle = drum;
        g.fill();
        g.beginPath();
        g.ellipse(0, cy - dh, rx, ry, 0, 0, Math.PI * 2);
        g.fillStyle = css(shade(P.dome, -0.12));
        g.fill();
        if (p.detail >= 1) {
          g.beginPath();
          for (let k = 1; k < 10; k++) {
            const a = Math.PI - k * Math.PI / 10;
            const cx = Math.cos(a) * rx;
            g.moveTo(cx, cy + Math.sin(a) * ry - q * 0.04);
            g.lineTo(cx, cy + Math.sin(a) * ry - dh + q * 0.04);
          }
          g.strokeStyle = "rgba(120,110,95,.45)";
          g.lineWidth = Math.max(p.px(0.5), q * 0.035);
          g.stroke();
        }
        const dy = cy - dh, dr = rx * 0.9, dhh = q * 1.05;
        const dome = g.createRadialGradient(-dr * 0.35, dy - dhh * 0.6, dr * 0.05, 0, dy - dhh * 0.3, dr * 1.25);
        dome.addColorStop(0, "#ffffff");
        dome.addColorStop(0.5, css(P.dome));
        dome.addColorStop(1, css(shade(P.dome, -0.42)));
        g.beginPath();
        g.ellipse(0, dy, dr, ry * 0.9, 0, 0, Math.PI);
        g.ellipse(0, dy, dr, dhh, 0, Math.PI, 0);
        g.closePath();
        g.fillStyle = dome;
        g.fill();
        g.strokeStyle = "rgba(60,50,40,.4)";
        g.lineWidth = p.px(0.6);
        g.stroke();
        if (p.detail >= 1) {
          g.beginPath();
          for (const f of [-0.55, 0, 0.55]) {
            g.moveTo(dr * f, dy + ry * 0.9 * Math.sqrt(1 - f * f) * 0.9);
            g.quadraticCurveTo(dr * f * 0.95, dy - dhh * 0.7, 0, dy - dhh);
          }
          g.strokeStyle = "rgba(150,140,120,.45)";
          g.lineWidth = p.px(0.5);
          g.stroke();
        }
        const lw = Math.max(q * 0.16, p.px(1.2)), lh = q * 0.36;
        g.fillStyle = css(shade(P.dome, -0.05));
        g.fillRect(-lw, dy - dhh - lh, lw * 2, lh + q * 0.04);
        g.fillStyle = css(shade(P.dome, -0.35));
        g.fillRect(0, dy - dhh - lh, lw, lh + q * 0.04);
        g.beginPath();
        g.arc(0, dy - dhh - lh - lw * 0.5, lw * 0.75, 0, Math.PI * 2);
        g.fillStyle = "#c9a45c";
        g.fill();
      }
    });
    return items;
  }
  function paintTile(g, city, R2, Rpx, dev, detail, col, seed, capital) {
    const cls = city.artClass ?? cityClass(city.population);
    const sCss = Rpx / R2;
    const p = new Painter(g, R2, sCss, dev, detail, col);
    const items = cls.village ? paintVillage(p, seed, col, Rpx) : paintGrid(p, cls, seed, Rpx, capital);
    items.sort((a, b) => a.y - b.y);
    prepassShadows(p, items);
    g.fillStyle = "rgba(22,18,12,.3)";
    g.fill(p.shadows);
    p.shadows = new Path2D();
    for (const it of items) it.draw();
    if (detail >= 2 && !cls.village) {
      hexPath(g, 0, 0, R2, 0.95);
      g.lineJoin = "round";
      g.strokeStyle = css(shade(col, 0.1), 0.25);
      g.lineWidth = p.px(1);
      g.stroke();
    }
  }
  function paintGrid(p, cls, seed, Rpx, capital) {
    const g = p.g, R2 = p.R;
    const lay = gridLayout(cls, seed, R2, Rpx, capital);
    const { L, half, bh, lots, fringe } = lay;
    const ci = CITY_CLASSES.indexOf(cls);
    const accent = p.accent;
    const r0 = (id, salt) => hash01(seed * 7919 + id, salt);
    g.save();
    hexPath(g, 0, 0, R2, 0.97);
    g.clip();
    const lawn = mix(mix(P.lawn, [96, 128, 66], 0.4), P.concrete, cls.grey * 0.6);
    const lg = g.createRadialGradient(-R2 * 0.08, -R2 * 0.1, 0, 0, 0, R2 * 0.97);
    lg.addColorStop(0, css(shade(lawn, 0.04)));
    lg.addColorStop(0.5, css(lawn, 0.96));
    lg.addColorStop(0.7, css(shade(lawn, -0.06), 0.5));
    lg.addColorStop(0.88, css(shade(lawn, -0.08), 0));
    g.fillStyle = lg;
    g.fillRect(-R2, -R2, 2 * R2, 2 * R2);
    for (let k = 0; k < 6; k++) {
      const mx = (hash01(seed, 40 + k) - 0.5) * 0.9 * R2, my = (hash01(seed, 50 + k) - 0.5) * 0.9 * R2, mr = R2 * (0.16 + hash01(seed, 60 + k) * 0.2);
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      const c = k % 2 ? "40,60,20" : "230,236,190";
      mg.addColorStop(0, `rgba(${c},.12)`);
      mg.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = mg;
      g.fillRect(mx - mr, my - mr, 2 * mr, 2 * mr);
    }
    g.restore();
    const kw = Math.max(p.px(0.9), L * 0.05);
    const pad = new Path2D(), kerb = new Path2D();
    for (const l of lots) {
      poly(pad, foot(l.x, l.y, half, half));
      poly(kerb, foot(l.x, l.y, half + kw, half + kw));
    }
    g.save();
    hexPath(g, 0, 0, R2, 0.95);
    g.clip();
    p.feather(kerb, css(P.kerb), R2 * 0.05, "rgba(40,36,28,.55)");
    g.fillStyle = css(shade(P.asphalt, ci * 0.03));
    g.fill(pad);
    g.restore();
    const swk = Math.max(p.px(0.55), L * 0.035);
    const paths = { walk: new Path2D(), paved: new Path2D(), lawn: new Path2D(), park: new Path2D(), plaza: new Path2D() };
    const parkWalks = new Path2D();
    for (const l of lots) {
      if (l.type === "reserved") continue;
      poly(paths.walk, foot(l.x, l.y, bh, bh));
      const kind = l.type === "res" ? "lawn" : l.type === "park" ? "park" : l.type === "plaza" ? "plaza" : "paved";
      const F = foot(l.x, l.y, bh - swk, bh - swk);
      poly(paths[kind], F);
      if (l.type === "park" && p.detail >= 1) {
        const [N, E, S, W] = F;
        parkWalks.moveTo(N[0], N[1]);
        parkWalks.lineTo(S[0], S[1]);
        parkWalks.moveTo(W[0], W[1]);
        parkWalks.lineTo(E[0], E[1]);
      }
    }
    g.fillStyle = css(P.walk);
    g.fill(paths.walk);
    g.fillStyle = css(P.concrete);
    g.fill(paths.paved);
    g.fillStyle = css(P.lawnBlock);
    g.fill(paths.lawn);
    g.fillStyle = css(P.park);
    g.fill(paths.park);
    g.fillStyle = css(P.plazaInner);
    g.fill(paths.plaza);
    if (p.detail >= 1) {
      g.strokeStyle = css(P.path, 0.9);
      g.lineWidth = Math.max(p.px(0.8), L * 0.04);
      g.stroke(parkWalks);
    }
    if (p.detail >= 2 && ci >= 2) {
      const avenue = new Path2D();
      const reach = R2 * 1.2;
      for (const off of [0.5, -0.5]) {
        const [ax, ay] = iso(-reach, off * L), [bx, by] = iso(reach, off * L);
        avenue.moveTo(ax, ay);
        avenue.lineTo(bx, by);
        const [cx, cy] = iso(off * L, -reach), [dx, dy] = iso(off * L, reach);
        avenue.moveTo(cx, cy);
        avenue.lineTo(dx, dy);
      }
      g.save();
      g.clip(pad);
      g.setLineDash([p.px(2.2), p.px(2.2)]);
      g.strokeStyle = "rgba(240,214,130,.6)";
      g.lineWidth = p.px(0.7);
      g.stroke(avenue);
      g.setLineDash([]);
      g.restore();
    }
    const C2 = capital ? capitolExtent(R2, Rpx) : null;
    if (C2) paintCapitolGround(p, C2);
    const items = [];
    const hMax = R2 * (capital ? Math.min(cls.height, 0.24) : cls.height);
    const big = bh * p.s >= 6;
    let tallest = null;
    for (const l of lots) {
      const r = (salt) => r0(l.id, salt);
      const { x, y } = l;
      if (l.type === "core") {
        const h = Math.max(p.px(7), hMax * (0.3 + 0.7 * l.c ** 1.4 * (0.55 + 0.45 * r(21))));
        const it = { y, h, draw: () => drawCore(p, x, y, bh, h, r, it === tallest) };
        if (!tallest || h > tallest.h) tallest = it;
        items.push(it);
      } else if (l.type === "mid") {
        const h = Math.max(p.px(3.5), R2 * (0.045 + 0.06 * r(24)) * (0.8 + ci * 0.12) * (0.6 + 0.6 * l.c));
        const split = !big ? 1 : r(25) < 0.3 ? 1 : r(25) < 0.55 ? 2 : r(25) < 0.8 ? 3 : 4;
        for (const pc of parcels(split, bh)) {
          const [ox, oy] = iso(pc.u, pc.v);
          const gap = Math.max(p.px(0.45), L * 0.018);
          const k = pc.k;
          items.push({
            y: y + oy,
            draw: () => drawBlock(p, x + ox, y + oy, pc.a - gap, pc.b - gap, h * (0.7 + 0.55 * r(26 + k)), r, k)
          });
        }
      } else if (l.type === "res") {
        const spots = big ? [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] : [[0, 0]];
        spots.forEach(([su, sv], k) => {
          const [hx, hy] = iso(su * bh, sv * bh);
          const sz = big ? 0.34 : 0.55;
          const along = r(100 + k) < 0.5 ? 0 : 1;
          const a = bh * sz * (along === 0 ? 1 : 0.75) * (0.9 + r(50 + k) * 0.2);
          const b = bh * sz * (along === 0 ? 0.75 : 1) * (0.9 + r(60 + k) * 0.2);
          const wall = pick(P.walls, r(70 + k));
          const roof = r(80 + k) < 0.2 ? mix(P.roofs[0], accent, 0.6) : pick(P.roofs, r(90 + k));
          items.push({ y: y + hy, draw: () => p.house(x + hx, y + hy, a, b, wall, roof, along) });
        });
        if (big && p.detail >= 1 && r(105) < 0.7) {
          items.push({ y: y + 1e-3, draw: () => p.tree(x, y, Math.max(bh * 0.2, p.px(1.6)), r(106) < 0.2) });
        }
      } else if (l.type === "park") {
        const nT = p.detail === 0 ? 2 : big ? 6 : 3;
        if (p.detail >= 2 && big) {
          const [px2, py2] = iso(bh * 0.3, -bh * 0.25);
          g.beginPath();
          g.ellipse(x + px2, y + py2, bh * 0.32, bh * 0.17, 0, 0, Math.PI * 2);
          g.fillStyle = css(P.pond);
          g.fill();
          g.strokeStyle = "rgba(240,250,255,.6)";
          g.lineWidth = p.px(0.6);
          g.stroke();
        }
        for (let k = 0; k < nT; k++) {
          const [tx, ty] = iso((r(110 + k) - 0.5) * bh * 1.5, (r(120 + k) - 0.5) * bh * 1.5);
          items.push({ y: y + ty, draw: () => p.tree(x + tx, y + ty, Math.max(bh * 0.2, p.px(1.6)), r(130 + k) < 0.3) });
        }
      } else if (l.type === "plaza") {
        items.push({ y, draw: () => drawPlaza(p, x, y, bh, accent) });
      } else if (l.type === "civic") {
        items.push({ y, draw: () => drawChurch(p, x, y, bh * 0.5, accent) });
      }
    }
    for (const f of fringe) {
      const r = (salt) => r0(f.id, salt);
      const n = 1 + (r(200) < 0.6 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const [ox, oy] = iso((r(201 + k) - 0.5) * L * 0.6, (r(211 + k) - 0.5) * L * 0.6);
        const hx = f.x + ox, hy = f.y + oy;
        if (r(221 + k) < 0.45) {
          items.push({ y: hy, draw: () => p.tree(hx, hy, Math.max(L * 0.1, p.px(1.6)), r(231 + k) < 0.3) });
        } else {
          const a = Math.max(L * 0.14, p.px(2)), b = a * 0.75;
          const wall = pick(P.walls, r(241 + k)), roof = pick(P.roofs, r(251 + k));
          items.push({ y: hy, draw: () => p.house(hx, hy, a, b, wall, roof, r(261 + k) < 0.5 ? 0 : 1) });
        }
      }
    }
    if (C2) items.push(...capitolItems(p, C2));
    return items;
  }
  function parcels(split, bh) {
    if (split === 1) return [{ u: 0, v: 0, a: bh, b: bh, k: 0 }];
    if (split === 2) return [-1, 1].map((sg, k) => ({ u: sg * bh / 2, v: 0, a: bh / 2, b: bh, k }));
    if (split === 3) return [-1, 1].map((sg, k) => ({ u: 0, v: sg * bh / 2, a: bh, b: bh / 2, k }));
    const out = [];
    for (const su of [-1, 1]) for (const sv of [-1, 1]) out.push({ u: su * bh / 2, v: sv * bh / 2, a: bh / 2, b: bh / 2, k: out.length });
    return out;
  }
  function prepassShadows(p, items) {
    const real = p.g;
    p.g = NULL_CTX;
    for (const it of items) it.draw();
    p.g = real;
  }
  var NULL_CTX = new Proxy(
    {},
    {
      get(_, key) {
        if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop() {
        } });
        return () => {
        };
      },
      set() {
        return true;
      }
    }
  );
  function drawCore(p, x, y, bh, h, r, tallest) {
    const podH = Math.max(p.px(2.2), p.R * 0.028);
    const F = foot(x, y, bh * 0.95, bh * 0.95);
    const podC = pick(P.stone, r(230));
    p.shadow(F, podH);
    p.box(F, 0, podH, podC);
    if (p.detail >= 1) {
      const [, E, S, W] = F;
      const bandH = podH * 0.45;
      fillPoly(p.g, [W, S, up(S, bandH), up(W, bandH)], "rgba(40,48,60,.45)");
      fillPoly(p.g, [S, E, up(E, bandH), up(S, bandH)], "rgba(20,24,32,.45)");
    }
    const twin = bh * p.s >= 7 && r(231) < 0.35 && !tallest;
    if (twin) {
      for (const [sg, k] of [[-1, 0], [1, 1]]) {
        const [ox, oy] = iso(sg * bh * 0.46, 0);
        drawTower(p, x + ox, y + oy, bh * 0.4, bh * 0.66, h * (k ? 0.72 : 1), (salt) => r(salt + k * 50), false, podH);
      }
    } else {
      const a = bh * (0.6 + r(22) * 0.2), b = bh * (0.6 + r(23) * 0.2);
      drawTower(p, x, y, a, b, h, r, tallest, podH);
    }
  }
  function drawTower(p, x, y, a, b, h, r, tallest, z0 = 0) {
    const glass = r(201) < 0.65;
    const base = glass ? pick(P.glass, r(202)) : pick(P.stone, r(203));
    const F = foot(x, y, a, b);
    p.shadow(F, z0 + h);
    const setback = h > p.R * 0.3 && r(204) < 0.45;
    const h1 = setback ? h * (0.55 + r(205) * 0.15) : h;
    p.box(F, z0, h1, base, { glass });
    p.windows(F, z0, h1, glass);
    let top = { F, z: z0 + h1, a, b };
    if (setback) {
      const F2 = foot(x, y, a * 0.68, b * 0.68);
      p.box(F2, z0 + h1, h - h1, shade(base, 0.04), { glass });
      p.windows(F2, z0 + h1, h - h1, glass);
      top = { F: F2, z: z0 + h, a: a * 0.68, b: b * 0.68 };
    }
    const g = p.g;
    const [, E, S, W] = top.F.map((q) => up(q, top.z));
    const ins = foot(x, y - top.z, top.a * 0.72, top.b * 0.72);
    if (p.detail >= 1) fillPoly(g, ins, css(shade(base, -0.05)));
    if (r(206) < 0.4 || tallest) {
      const band = Math.max(p.px(1), h * 0.035);
      fillPoly(g, [W, S, up(S, -band), up(W, -band)], css(p.accent));
      fillPoly(g, [S, E, up(E, -band), up(S, -band)], css(shade(p.accent, -0.3)));
    }
    if (tallest && h > p.R * 0.3) {
      const sh = h * 0.22;
      g.beginPath();
      g.moveTo(x, y - top.z);
      g.lineTo(x, y - top.z - sh);
      g.strokeStyle = "rgba(235,235,230,.95)";
      g.lineWidth = Math.max(p.px(0.9), top.a * 0.12);
      g.stroke();
      g.beginPath();
      g.arc(x, y - top.z - sh, Math.max(p.px(0.9), top.a * 0.1), 0, Math.PI * 2);
      g.fillStyle = "#ffe08a";
      g.fill();
    } else if (p.detail >= 1 && r(207) < 0.6) {
      const Fb = foot(x + (r(208) - 0.5) * top.a * 0.6, y - top.z + (r(209) - 0.5) * top.b * 0.3, top.a * 0.28, top.b * 0.28);
      p.box(Fb, 0, Math.max(p.px(1.2), h * 0.04), [150, 148, 140], { outline: false });
    }
  }
  function drawBlock(p, x, y, a, b, h, r, k) {
    const base = pick(P.stone, r(220 + k));
    const F = foot(x, y, a, b);
    p.shadow(F, h);
    p.box(F, 0, h, base);
    p.windows(F, 0, h, false);
    if (p.detail >= 1) {
      const ins = foot(x, y - h, a * 0.8, b * 0.8);
      fillPoly(p.g, ins, r(224 + k) < 0.2 ? css(mix(P.park, P.concrete, 0.3)) : css(shade(base, 0.08)));
      if (p.detail >= 2 && r(228 + k) < 0.5) p.box(foot(x - a * 0.2, y - h - b * 0.05, a * 0.22, b * 0.22), 0, p.px(1.4), [150, 146, 138], { outline: false });
    }
  }
  function drawPlaza(p, x, y, bh, accent) {
    const g = p.g;
    fillPoly(g, foot(x, y, bh * 0.72, bh * 0.72), css(P.plaza));
    const r = Math.max(bh * 0.24, p.px(1.4));
    g.beginPath();
    g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    g.fillStyle = p.detail >= 1 ? "#6fb0d8" : css(accent);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.7)";
    g.lineWidth = p.px(0.6);
    g.stroke();
    if (p.detail >= 2) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - r * 1.2);
      g.strokeStyle = "rgba(235,248,255,.85)";
      g.lineWidth = p.px(0.8);
      g.stroke();
    }
  }
  var SUB_ROOFS = [[164, 71, 58], [107, 111, 122], [138, 90, 60], [79, 93, 110], [179, 107, 69], [91, 74, 68], [128, 64, 54]];
  var SUB_WALLS = [[239, 230, 210], [226, 215, 189], [216, 223, 224], [240, 220, 192], [230, 225, 214]];
  var suburbPlans = /* @__PURE__ */ new Map();
  function segDist(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  }
  function suburbPlan(v, small) {
    const key = `${v}|${small ? 1 : 0}`;
    let plan = suburbPlans.get(key);
    if (plan) return plan;
    const r = rng(v * 7349 + (small ? 5 : 11));
    const lim = small ? 0.5 : 0.82;
    const inHex = (x, y, m = 0) => hexRho(x, y, 1) <= lim - m;
    const roads = [], bulbs = [];
    const ang = (r() - 0.5) * 1;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const off = (r() - 0.5) * 0.24, wa = 0.04 + r() * 0.05, wp = r() * 6.28;
    const span = small ? 0.62 : 1.15;
    const along = (t) => {
      const nrm = off + wa * Math.sin(t * 2.4 + wp);
      return [t * ca - nrm * sa, t * sa + nrm * ca];
    };
    const collector = [];
    for (let k = 0; k <= 24; k++) collector.push(along(-span + 2 * span * k / 24));
    roads.push(collector);
    const nb = small ? 1 : 2 + (r() < 0.55 ? 1 : 0);
    let sideSign = r() < 0.5 ? -1 : 1;
    for (let b = 0; b < nb; b++) {
      const t = small ? (r() - 0.5) * 0.3 : -0.5 + 1 * (b + 0.5) / nb + (r() - 0.5) * 0.12;
      const base = along(t);
      sideSign = -sideSign;
      const dir = ang + sideSign * (Math.PI / 2) + (r() - 0.5) * 0.5;
      const dx = Math.cos(dir), dy = Math.sin(dir);
      const len = small ? 0.16 : 0.2 + r() * 0.12;
      const loopC = [base[0] + dx * (len + 0.13), base[1] + dy * (len + 0.13)];
      if (!small && r() < 0.45 && inHex(loopC[0], loopC[1], 0.14)) {
        const loop = [];
        const lx = 0.16, ly = 0.1;
        for (let k = 0; k <= 20; k++) {
          const a = k / 20 * Math.PI * 2;
          const ex = Math.cos(a) * lx, ey = Math.sin(a) * ly;
          loop.push([loopC[0] + ex * dx - ey * dy, loopC[1] + ex * dy + ey * dx]);
        }
        roads.push(loop);
        roads.push([base, [base[0] + dx * (len + 0.13 - lx), base[1] + dy * (len + 0.13 - lx)]]);
      } else {
        const bend = (r() - 0.5) * 0.08;
        const mid = [base[0] + dx * len * 0.5 - dy * bend, base[1] + dy * len * 0.5 + dx * bend];
        const end = [base[0] + dx * len, base[1] + dy * len];
        roads.push([base, mid, end]);
        bulbs.push([end[0], end[1], 0.05]);
      }
    }
    const roadDist = (x, y) => {
      let d = Infinity;
      for (const R2 of roads) for (let k = 1; k < R2.length; k++) d = Math.min(d, segDist(x, y, R2[k - 1], R2[k]));
      for (const [bx, by, br] of bulbs) d = Math.min(d, Math.hypot(x - bx, y - by) - br);
      return d;
    };
    let amenity = null;
    if (!small) {
      for (const t of [0.45, -0.45, 0.15, -0.15]) {
        for (const sg of [1, -1]) {
          const [cx0, cy0] = along(t);
          const x = cx0 - sa * sg * 0.17, y = cy0 + ca * sg * 0.17;
          if (amenity || !inHex(x, y, 0.16)) continue;
          let clear = Infinity;
          for (let k = 1; k < roads.length; k++) for (let q = 1; q < roads[k].length; q++) clear = Math.min(clear, segDist(x, y, roads[k][q - 1], roads[k][q]));
          for (const [bx, by, br] of bulbs) clear = Math.min(clear, Math.hypot(x - bx, y - by) - br);
          if (clear < 0.17) continue;
          amenity = { x, y, kind: r() < 0.5 ? "school" : "mall", a: 0.11, b: 0.065 };
        }
      }
    }
    const inAmenity = (x, y, m) => amenity && Math.abs(x - amenity.x) < 0.17 + m && Math.abs(y - amenity.y) < 0.12 + m;
    const roofs = [pick(SUB_ROOFS, r()), pick(SUB_ROOFS, r()), pick(SUB_ROOFS, r())];
    const houses = [];
    const hs = small ? 0.048 : 0.052;
    const tryHouse = (x, y, ridge) => {
      if (!inHex(x, y, 0.04) || roadDist(x, y) < 0.062 || inAmenity(x, y, 0.03)) return;
      for (const h of houses) if (Math.hypot(h.x - x, h.y - y) < 0.098) return;
      houses.push({ x, y, s: hs * (0.9 + r() * 0.2), ridge, wall: pick(SUB_WALLS, r()), roof: roofs[Math.floor(r() * 3)] });
    };
    for (const R2 of roads) {
      let carry = 0.05;
      for (let k = 1; k < R2.length; k++) {
        const [ax, ay] = R2[k - 1], [bx, by] = R2[k];
        const sl = Math.hypot(bx - ax, by - ay);
        if (!sl) continue;
        const tx = (bx - ax) / sl, ty = (by - ay) / sl;
        const ridge = Math.abs(tx * 0.866 + ty * 0.5) >= Math.abs(-tx * 0.866 + ty * 0.5) ? 0 : 1;
        let d = carry;
        for (; d < sl; d += 0.106) {
          const x = ax + tx * d, y = ay + ty * d;
          tryHouse(x - ty * 0.088, y + tx * 0.088, ridge);
          tryHouse(x + ty * 0.088, y - tx * 0.088, ridge);
        }
        carry = d - sl;
      }
    }
    for (const [bx, by, br] of bulbs) {
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + r() * 0.4;
        tryHouse(bx + Math.cos(a) * (br + 0.08), by + Math.sin(a) * (br + 0.08), k % 2);
      }
    }
    const trees = [];
    const tryTree = (x, y) => {
      if (!inHex(x, y, 0.02) || roadDist(x, y) < 0.045 || inAmenity(x, y, 0)) return;
      for (const h of houses) if (Math.hypot(h.x - x, h.y - y) < 0.07) return;
      for (const t of trees) if (Math.hypot(t.x - x, t.y - y) < 0.045) return;
      trees.push({ x, y, h: 0.06 + r() * 0.025, conifer: r() < 0.22 });
    };
    const nc = small ? 2 : 4 + Math.floor(r() * 3);
    for (let c = 0; c < nc; c++) {
      let cx = 0, cy = 0;
      for (let tries = 0; tries < 14; tries++) {
        cx = (r() - 0.5) * 1.5 * lim;
        cy = (r() - 0.5) * 1.6 * lim;
        if (inHex(cx, cy, 0.06) && roadDist(cx, cy) > 0.09) break;
      }
      const n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) tryTree(cx + (r() - 0.5) * 0.2, cy + (r() - 0.5) * 0.15);
    }
    for (const h of houses) if (r() < 0.3) tryTree(h.x + (r() - 0.5) * 0.06, h.y - 0.075);
    const lawn = shade(mix([116, 152, 80], [146, 156, 92], r()), (r() - 0.5) * 0.12);
    plan = { lim, roads, bulbs, houses, trees, amenity, lawn };
    suburbPlans.set(key, plan);
    return plan;
  }
  function paintSuburbGround(g, upx, v, kind) {
    const plan = suburbPlan(v, kind === "small");
    const px = 1 / upx;
    const small = kind === "small";
    g.save();
    hexPath(g, 0, 0, 1, small ? 0.92 : 1.01);
    g.clip();
    g.save();
    g.shadowColor = css(plan.lawn, 0.85);
    g.shadowBlur = Math.max(1, 0.07 * upx);
    hexPath(g, 0, 0, 1, small ? plan.lim + 0.05 : 0.97);
    g.fillStyle = css(plan.lawn, 0.9);
    g.fill();
    g.restore();
    const rr = rng(v * 131 + 7);
    for (let k = 0; k < 5; k++) {
      const mx = (rr() - 0.5) * 1.3 * plan.lim, my = (rr() - 0.5) * 1.3 * plan.lim, mr = 0.18 + rr() * 0.2;
      const mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      const c = k % 2 ? "40,64,22" : "232,238,190";
      mg.addColorStop(0, `rgba(${c},.13)`);
      mg.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = mg;
      g.fillRect(mx - mr, my - mr, 2 * mr, 2 * mr);
    }
    const am = plan.amenity;
    if (am) {
      if (am.kind === "mall") {
        const F = foot(am.x, am.y + 0.035, am.a + 0.05, am.b + 0.06);
        fillPoly(g, F, "rgba(118,116,110,.92)");
        if (upx > 50) {
          g.beginPath();
          const [N, E, S, W] = F;
          for (let q = 1; q < 8; q++) {
            const t = q / 8;
            g.moveTo(W[0] + (S[0] - W[0]) * t, W[1] + (S[1] - W[1]) * t);
            g.lineTo(W[0] + (S[0] - W[0]) * t + (N[0] - W[0]) * 0.35, W[1] + (S[1] - W[1]) * t + (N[1] - W[1]) * 0.35);
          }
          g.strokeStyle = "rgba(235,232,220,.55)";
          g.lineWidth = px;
          g.stroke();
        }
      } else {
        const [ox, oy] = iso(0, am.b + 0.09);
        const F = foot(am.x + ox, am.y + oy, am.a + 0.02, 0.075);
        fillPoly(g, F, "rgba(132,178,88,.95)");
        const cx = am.x + ox, cy = am.y + oy;
        g.beginPath();
        g.ellipse(cx, cy, 0.09, 0.045, 0, 0, Math.PI * 2);
        g.strokeStyle = "rgba(196,110,84,.8)";
        g.lineWidth = Math.max(px * 1.2, 0.012);
        g.stroke();
        fillPoly(g, foot(am.x, am.y, am.a + 0.03, am.b + 0.03), "rgba(150,146,136,.85)");
      }
    }
    suburbRoads(g, plan, px);
    g.restore();
  }
  function suburbRoads(g, plan, px) {
    g.lineCap = "round";
    g.lineJoin = "round";
    const roadP = new Path2D();
    for (const R2 of plan.roads) {
      roadP.moveTo(R2[0][0], R2[0][1]);
      for (let k = 1; k < R2.length; k++) roadP.lineTo(R2[k][0], R2[k][1]);
    }
    const bulbP = new Path2D();
    for (const [bx, by, br] of plan.bulbs) {
      bulbP.moveTo(bx + br, by);
      bulbP.arc(bx, by, br, 0, Math.PI * 2);
    }
    const casing = Math.max(0.05, px * 2.4), surface2 = Math.max(0.034, px * 1.4);
    g.strokeStyle = "rgba(70,66,58,.55)";
    g.lineWidth = casing;
    g.stroke(roadP);
    g.save();
    g.lineWidth = casing - surface2;
    g.strokeStyle = "rgba(70,66,58,.55)";
    g.stroke(bulbP);
    g.restore();
    g.strokeStyle = "#b8b4a8";
    g.lineWidth = surface2;
    g.stroke(roadP);
    g.fillStyle = "#b8b4a8";
    g.fill(bulbP);
  }
  function paintSuburbBuild(g, upx, v, kind) {
    const plan = suburbPlan(v, kind === "small");
    const px = 1 / upx;
    if (kind === "small") {
      g.save();
      hexPath(g, 0, 0, 1, plan.lim + 0.08);
      g.clip();
      suburbRoads(g, plan, px);
      g.restore();
    }
    const items = [];
    const shadows = new Path2D();
    for (const h of plan.houses) {
      const a = h.ridge === 0 ? h.s : h.s * 0.72, b = h.ridge === 0 ? h.s * 0.72 : h.s;
      const F = foot(h.x, h.y, a, b);
      const hw = Math.max(h.s * 0.55, px * 2), hr = Math.max(h.s * 0.45, px * 1.5);
      poly(shadows, shadowOf(F, hw + hr * 0.6));
      items.push({ y: h.y, draw: () => gable(g, F, hw, hr, h.wall, h.roof, h.ridge, upx * h.s > 14 ? px * 0.8 : 0) });
    }
    for (const t of plan.trees) {
      const rad = Math.max(t.h * 0.6, px * 2);
      items.push({ y: t.y, draw: () => treeShape(g, t.x, t.y, rad, t.conifer, true) });
    }
    const am = plan.amenity;
    if (am) {
      const F = foot(am.x, am.y, am.a, am.b);
      const h = am.kind === "mall" ? 0.05 : 0.07;
      poly(shadows, shadowOf(F, h));
      items.push({
        y: am.y,
        draw: () => {
          const wall = am.kind === "mall" ? [226, 214, 188] : [178, 96, 72];
          const [N, E, S, W] = F;
          const [Nt, Et, St, Wt] = F.map((q) => up(q, h));
          fillPoly(g, [W, S, St, Wt], css(wall));
          fillPoly(g, [S, E, Et, St], css(shade(wall, -0.32)));
          fillPoly(g, [Nt, Et, St, Wt], css(am.kind === "mall" ? [196, 192, 182] : [150, 148, 140]));
          const bz = h * 0.35, bh = h * 0.3;
          fillPoly(g, [up(W, bz), up(S, bz), up(S, bz + bh), up(W, bz + bh)], am.kind === "mall" ? "rgba(60,80,104,.7)" : "rgba(240,236,224,.6)");
          if (upx > 40) {
            g.beginPath();
            poly(g, [W, Wt, Nt, Et, E, S]);
            g.strokeStyle = "rgba(40,28,18,.35)";
            g.lineWidth = px * 0.8;
            g.stroke();
          }
        }
      });
    }
    g.fillStyle = "rgba(22,24,12,.24)";
    g.fill(shadows);
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
  }
  var SUBURB_ART = Object.freeze({
    ground: { box: { x0: -0.92, y0: -1.02, x1: 0.92, y1: 1.02 }, paint: paintSuburbGround },
    build: { box: { x0: -0.92, y0: -1.1, x1: 0.92, y1: 1 }, paint: paintSuburbBuild }
  });
  var SX = 1;
  var SY0 = 1.55;
  var SY1 = 1;
  var MAX_SPRITE_RPX = 220;
  var MAX_BIG_RPX = 480;
  var BUDGET_PX2 = 14e6;
  var BIG_BUDGET_PX = 12e6;
  var BIG_KEEP_MS = 500;
  var makeCache = (budget) => ({ map: /* @__PURE__ */ new Map(), px: 0, budget });
  var spriteCache = makeCache(BUDGET_PX2);
  var bigSpriteCache = makeCache(BIG_BUDGET_PX);
  var newCanvas2 = (wd, ht) => {
    if (typeof document !== "undefined") {
      const cv = document.createElement("canvas");
      cv.width = wd;
      cv.height = ht;
      return cv;
    }
    return new OffscreenCanvas(wd, ht);
  };
  var spriteSize = (k, R2) => [Math.ceil(2 * SX * R2 * k), Math.ceil((SY0 + SY1) * R2 * k)];
  function getSprite2(cache2, key, k, R2, paint, keepMs = 0) {
    const now = keepMs ? performance.now() : 0;
    let sp = cache2.map.get(key);
    if (sp) {
      cache2.map.delete(key);
      cache2.map.set(key, sp);
      sp.t = now;
      return sp;
    }
    const [wd, ht] = spriteSize(k, R2);
    for (const [kk, old] of cache2.map) {
      if (cache2.px + wd * ht <= cache2.budget) break;
      if (keepMs && old.t > now - keepMs) return null;
      cache2.map.delete(kk);
      cache2.px -= old.cv.width * old.cv.height;
    }
    if (keepMs && cache2.px + wd * ht > cache2.budget) return null;
    const cv = newCanvas2(wd, ht);
    const g = cv.getContext("2d");
    g.setTransform(k, 0, 0, k, SX * R2 * k, SY0 * R2 * k);
    paint(g, k);
    sp = { cv, k, t: now };
    cache2.map.set(key, sp);
    cache2.px += wd * ht;
    return sp;
  }
  var bucket = (v, steps) => 2 ** (Math.ceil(Math.log2(v) * steps - 1e-9) / steps);
  function drawCityTile(ctx, city, x, y, R2, opts = {}) {
    const { Rpx = R2, s = 1, stateColor = [200, 200, 200] } = opts;
    const seed = opts.seed ?? city.cell ?? 0;
    const col = stateColor;
    if (cityIsDot(city, Rpx)) {
      drawCityDot(ctx, x, y, R2, { Rpx, s, stateColor: col, capital: isCapital(city), population: city.population });
      return;
    }
    const lod = opts.lod ?? lodFor(Rpx);
    const detail = lod === "close" ? 2 : lod === "near" ? 1 : 0;
    const capital = isCapital(city);
    const RpxB = bucket(Rpx, 4);
    const m = ctx.getTransform ? ctx.getTransform() : null;
    const kDev = m && m.a > 0 ? m.a : s;
    const kB = bucket(kDev, 6);
    const flat = m && !m.b && !m.c;
    const isBig = !flat || R2 * kB > MAX_SPRITE_RPX;
    if (isBig && ctx.canvas && flat) {
      const cvs = ctx.canvas;
      const ax = m.a * (x - SX * R2) + m.e, bx = m.a * (x + SX * R2) + m.e;
      const ay = m.d * (y - SY0 * R2) + m.f, by = m.d * (y + SY1 * R2) + m.f;
      if (Math.max(ax, bx) < 0 || Math.min(ax, bx) > cvs.width || Math.max(ay, by) < 0 || Math.min(ay, by) > cvs.height) return;
    }
    const kS = isBig ? kDev : kB;
    let sp = null;
    if (flat && R2 * kS <= MAX_BIG_RPX) {
      const key = `${seed}|${(city.artClass ?? cityClass(city.population)).id}|${col.join(",")}|${capital ? 1 : 0}|${RpxB.toFixed(3)}|${detail}|${kS.toFixed(4)}|${R2}`;
      const paint = (g, k) => paintTile(g, city, R2, RpxB, k, detail, col, seed, capital);
      sp = isBig ? getSprite2(bigSpriteCache, key, kS, R2, paint, BIG_KEEP_MS) : getSprite2(spriteCache, key, kS, R2, paint);
    }
    if (!sp) {
      ctx.save();
      ctx.translate(x, y);
      paintTile(ctx, city, R2, RpxB, kDev, detail, col, seed, capital);
      ctx.restore();
      return;
    }
    const x0 = x - SX * R2, y0 = y - SY0 * R2;
    const dx = (Math.round(m.a * x0 + m.e) - m.e) / m.a, dy = (Math.round(m.d * y0 + m.f) - m.f) / m.d;
    ctx.drawImage(sp.cv, dx, dy, sp.cv.width / sp.k, sp.cv.height / sp.k);
  }
  function drawCityDot(ctx, x, y, R2, { Rpx, s, capital = false, population = 0 }) {
    const big = population >= 15e5;
    const r = Math.max((big ? 2.8 : 2.1) / s, R2 * (Rpx < 9 ? big ? 0.34 : 0.27 : 0.19));
    ctx.beginPath();
    ctx.arc(x + 0.6 / s, y + 0.9 / s, r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, "#fff6dc");
    gr.addColorStop(0.6, "#e6d2a2");
    gr.addColorStop(1, "#a9844a");
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = "rgba(28,20,10,.9)";
    ctx.lineWidth = 1 / s;
    ctx.stroke();
    if (big) {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(70,50,22,.75)";
      ctx.fill();
    }
    if (capital) drawCapitalLandmark(ctx, x, y - r * 0.05, r * 4.2, { s });
  }
  function drawCapitalLandmark(ctx, x, y, R2, { s = 1 } = {}) {
    ctx.beginPath();
    star(ctx, x, y, Math.max(R2 * 0.2, 3.2 / s));
    ctx.fillStyle = "#ffe08a";
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,0,.85)";
    ctx.lineWidth = 1 / s;
    ctx.stroke();
  }
  function star(ctx, x, y, r) {
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5;
      const rr = k % 2 ? r * 0.45 : r;
      k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  // js/usaciv/render/art/terrain.js
  var TAU = Math.PI * 2;
  var FOREIGN_ALPHA = 0.4;
  var C = parseHex;
  var WARM = [255, 241, 196];
  var COOL = [38, 52, 86];
  function drawTerrainGlyphs(ctx, cells, w, { Rpx, s, lod, bridges, pixelRatio } = {}) {
    const R2 = w.grid.R;
    s = s ?? Rpx / R2;
    Rpx = Rpx ?? R2 * s;
    lod = lod ?? lodFor(Rpx);
    const dev = deviceScale(ctx);
    const dpr = pixelRatio ?? (dev / s || 1);
    const upx = bucketPx(R2 * dev, { min: 6, max: 256 });
    ctx.save();
    drawTextures(ctx, cells, w, s, dpr, lod, Rpx);
    drawFields(ctx, cells, w, s, dpr, lod, Rpx);
    const ground = [], upright = [];
    bridges = bridges ?? !(Array.isArray(cells) && cells.length === 1);
    const env = { w, R: R2, Rpx, lod, upx, bridges, ground: null, upright: null, memo: /* @__PURE__ */ new Map() };
    const plans = planCache(w, `${lod}|${upx}|${Rpx}|${bridges}`);
    for (const i of cells) {
      let pl = plans.get(i);
      if (!pl) {
        env.ground = [];
        env.upright = [];
        planCell(env, i);
        pl = { g: env.ground.length ? env.ground : NONE, u: env.upright.length ? env.upright : NONE };
        plans.set(i, pl);
      }
      for (const st of pl.g) ground.push(st);
      for (const st of pl.u) upright.push(st);
    }
    upright.sort((a, b) => a.z - b.z);
    const vis = visibleBounds(ctx);
    let alpha = -1;
    for (const list of [ground, upright]) {
      for (const st of list) {
        const spr = st.spr, x0 = st.x + spr.x0 * st.k, y0 = st.y + spr.y0 * st.k;
        if (vis && (x0 > vis.x1 || y0 > vis.y1 || x0 + spr.w * st.k < vis.x0 || y0 + spr.h * st.k < vis.y0)) continue;
        if (st.a !== alpha) ctx.globalAlpha = alpha = st.a;
        drawSprite(ctx, spr, st.x, st.y, st.k);
      }
    }
    ctx.restore();
  }
  var NONE = [];
  var PLAN_CACHE_ZOOMS = 3;
  var PLAN_CACHE_CELLS = 4e4;
  var planCaches = /* @__PURE__ */ new WeakMap();
  function planCache(w, key) {
    let byKey = planCaches.get(w);
    if (!byKey) planCaches.set(w, byKey = /* @__PURE__ */ new Map());
    let map = byKey.get(key);
    if (map) byKey.delete(key);
    if (!map || map.size > PLAN_CACHE_CELLS) map = /* @__PURE__ */ new Map();
    byKey.set(key, map);
    while (byKey.size > PLAN_CACHE_ZOOMS) byKey.delete(byKey.keys().next().value);
    return map;
  }
  function visibleBounds(ctx) {
    const cv = ctx.canvas;
    if (!cv || !(cv.width > 0) || !(cv.height > 0)) return null;
    const m = ctx.getTransform();
    if (!m.is2D || m.b || m.c) return null;
    const inv = m.inverse();
    if (!Number.isFinite(inv.a) || !Number.isFinite(inv.d)) return null;
    const p = inv.transformPoint({ x: 0, y: 0 }), q = inv.transformPoint({ x: cv.width, y: cv.height });
    return { x0: Math.min(p.x, q.x), y0: Math.min(p.y, q.y), x1: Math.max(p.x, q.x), y1: Math.max(p.y, q.y) };
  }
  var TEX_SIZE = 200;
  var TEX_ALPHA = { far: 0.55, mid: 0.8, near: 1, close: 1 };
  function texFamily(w, i) {
    const cv = w.cover[i], rel = w.relief[i];
    if (cv === COVER.ICE) return "snow";
    if (rel >= 2) return rel === 3 || w.raw.elev[i] > 2600 ? "snowrock" : "rock";
    switch (cv) {
      case COVER.DECIDUOUS:
      case COVER.EVERGREEN:
      case COVER.MIXED:
        return "canopy";
      case COVER.SCRUB:
        return "sand";
      case COVER.WETLAND:
        return "marsh";
      case COVER.URBAN:
        return "grass";
      case COVER.BARREN:
        return "rock";
      case COVER.NONE:
        return w.raw.elev[i] > 1500 ? "rock" : "grass";
      default:
        return "grass";
    }
  }
  function drawTextures(ctx, cells, w, s, dpr, lod, Rpx) {
    const owner = w.raw.owner;
    const groups = /* @__PURE__ */ new Map();
    const bounds = visibleBounds(ctx), radius = w.grid.R + 1 / (s * dpr);
    for (const i of cells) {
      if (bounds) {
        const x = w.grid.cx(i), y = w.grid.cy(i);
        if (x + radius < bounds.x0 || y + radius < bounds.y0 || x - radius > bounds.x1 || y - radius > bounds.y1) continue;
      }
      if (w.water[i] || isFieldCell(w, i, Rpx)) continue;
      const key = texFamily(w, i) + (owner[i] === FOREIGN ? "|f" : "");
      let list = groups.get(key);
      if (!list) groups.set(key, list = []);
      list.push(i);
    }
    const sb = 2 ** Math.round(Math.log2(s));
    const m = new DOMMatrix([1 / (sb * dpr), 0, 0, 1 / (sb * dpr), 0, 0]);
    const base = TEX_ALPHA[lod] ?? 1;
    for (const [key, list] of groups) {
      const [fam, f] = key.split("|");
      const pat = makePattern(ctx, `terrain-tex:${fam}@${base}`, TEX_SIZE, dpr, bakedAlpha(base, (g, size) => TEXTURES[fam](g, size)));
      pat.setTransform(m);
      ctx.globalAlpha = f ? FOREIGN_ALPHA : 1;
      ctx.fillStyle = pat;
      ctx.fill(hexRunsPath(w.grid, list));
    }
    ctx.globalAlpha = 1;
  }
  function hexRunsPath(grid, list) {
    const K = grid.corners, cols = grid.cols, p = new Path2D();
    for (let a = 0; a < list.length; ) {
      let b = a;
      while (b + 1 < list.length && list[b + 1] === list[b] + 1 && list[b] % cols !== cols - 1) b++;
      let i = list[a];
      p.moveTo(grid.cx(i) + K[4][0], grid.cy(i) + K[4][1]);
      for (let k = a; k <= b; k++) {
        i = list[k];
        const x = grid.cx(i), y = grid.cy(i);
        p.lineTo(x + K[5][0], y + K[5][1]);
        p.lineTo(x + K[0][0], y + K[0][1]);
      }
      p.lineTo(grid.cx(i) + K[1][0], grid.cy(i) + K[1][1]);
      for (let k = b; k >= a; k--) {
        i = list[k];
        const x = grid.cx(i), y = grid.cy(i);
        p.lineTo(x + K[2][0], y + K[2][1]);
        p.lineTo(x + K[3][0], y + K[3][1]);
      }
      p.closePath();
      a = b + 1;
    }
    return p;
  }
  function bakedAlpha(a, paint) {
    if (a >= 1) return paint;
    return (g, size) => {
      g.save();
      paint(g, size);
      g.restore();
      g.save();
      g.globalCompositeOperation = "destination-in";
      g.globalAlpha = 1;
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.fillRect(-1, -1, size + 2, size + 2);
      g.restore();
    };
  }
  function wrapMark(ctx, size, x, y, radius, draw) {
    const reach = radius + 1 + size / ctx.canvas.width;
    wrapDraw(size, (dx, dy) => {
      const px = x + dx, py = y + dy;
      if (px + reach >= 0 && py + reach >= 0 && px - reach <= size && py - reach <= size)
        draw(dx, dy);
    });
  }
  var TEXTURES = {
    grass(g, S) {
      const r = rng(11);
      blotches(g, S, r, 26, 10, 26, "rgba(255,250,210,.05)", "rgba(20,40,0,.05)");
      for (let k = 0; k < 260; k++) {
        const x = r() * S, y = r() * S, len = 3 + r() * 4, a = -1.1 + (r() - 0.5) * 0.7;
        g.strokeStyle = k % 2 ? "rgba(255,252,200,.13)" : "rgba(25,45,5,.13)";
        g.lineWidth = 0.9 + r() * 0.5;
        wrapMark(g, S, x, y, len, (dx, dy) => {
          g.beginPath();
          g.moveTo(x + dx, y + dy);
          g.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
          g.stroke();
        });
      }
    },
    canopy(g, S) {
      const r = rng(23);
      blotches(g, S, r, 30, 8, 22, "rgba(200,230,120,.05)", "rgba(0,20,0,.07)");
      for (let k = 0; k < 170; k++) {
        const x = r() * S, y = r() * S, rr = 2 + r() * 3.5;
        wrapMark(g, S, x, y, rr, (dx, dy) => {
          g.beginPath();
          g.arc(x + dx, y + dy, rr, 0, TAU);
          g.fillStyle = "rgba(5,25,5,.13)";
          g.fill();
          g.beginPath();
          g.arc(x + dx - rr * 0.3, y + dy - rr * 0.35, rr * 0.55, 0, TAU);
          g.fillStyle = "rgba(220,240,150,.09)";
          g.fill();
        });
      }
    },
    sand(g, S) {
      const r = rng(37);
      blotches(g, S, r, 22, 12, 30, "rgba(255,240,200,.06)", "rgba(90,60,20,.05)");
      for (let k = 0; k < 70; k++) {
        const x = r() * S, y = r() * S, len = 9 + r() * 12;
        wrapDraw(S, (dx, dy) => {
          const X = x + dx, Y = y + dy;
          g.beginPath();
          g.moveTo(X - len, Y);
          g.quadraticCurveTo(X, Y - 4, X + len, Y);
          g.strokeStyle = "rgba(255,244,210,.16)";
          g.lineWidth = 1.1;
          g.stroke();
          g.beginPath();
          g.moveTo(X - len * 0.8, Y + 1.6);
          g.quadraticCurveTo(X, Y - 2.2, X + len * 0.8, Y + 1.6);
          g.strokeStyle = "rgba(110,70,25,.12)";
          g.lineWidth = 0.9;
          g.stroke();
        });
      }
      speckle(g, S, r, 220, "rgba(90,60,25,.16)", "rgba(255,245,215,.16)");
    },
    rock(g, S) {
      const r = rng(41);
      blotches(g, S, r, 26, 8, 24, "rgba(255,250,235,.05)", "rgba(30,20,10,.06)");
      speckle(g, S, r, 320, "rgba(40,30,20,.17)", "rgba(255,250,235,.15)");
      for (let k = 0; k < 16; k++) {
        let x = r() * S, y = r() * S;
        const pts = [[x, y]];
        for (let n = 0; n < 4; n++) pts.push([x += (r() - 0.3) * 9, y += (r() - 0.5) * 7]);
        wrapMark(g, S, pts[0][0], pts[0][1], 4 * 9, (dx, dy) => {
          g.beginPath();
          pts.forEach(([px, py], n) => n ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy));
          g.strokeStyle = "rgba(35,25,15,.12)";
          g.lineWidth = 0.8;
          g.stroke();
        });
      }
    },
    snowrock(g, S) {
      TEXTURES.rock(g, S);
      const r = rng(43);
      blotches(g, S, r, 18, 10, 24, "rgba(255,255,255,.08)", "rgba(80,100,140,.05)");
    },
    marsh(g, S) {
      const r = rng(53);
      blotches(g, S, r, 30, 8, 22, "rgba(170,210,200,.06)", "rgba(10,35,20,.08)");
      for (let k = 0; k < 120; k++) {
        const x = r() * S, y = r() * S, len = 4 + r() * 9;
        g.strokeStyle = k % 3 ? "rgba(185,225,230,.12)" : "rgba(15,40,25,.14)";
        g.lineWidth = 1;
        wrapMark(g, S, x, y, len, (dx, dy) => {
          g.beginPath();
          g.moveTo(x + dx, y + dy);
          g.lineTo(x + dx + len, y + dy);
          g.stroke();
        });
      }
    },
    snow(g, S) {
      const r = rng(61);
      blotches(g, S, r, 24, 10, 28, "rgba(255,255,255,.12)", "rgba(110,140,190,.07)");
      for (let k = 0; k < 60; k++) {
        const x = r() * S, y = r() * S, len = 8 + r() * 14;
        wrapMark(g, S, x, y, len, (dx, dy) => {
          g.beginPath();
          g.moveTo(x + dx - len, y + dy);
          g.quadraticCurveTo(x + dx, y + dy - 3, x + dx + len, y + dy);
          g.strokeStyle = "rgba(120,150,195,.12)";
          g.lineWidth = 1.2;
          g.stroke();
        });
      }
    }
  };
  var textureOpacities = [TEX_ALPHA.far, TEX_ALPHA.mid, TEX_ALPHA.near];
  var textureFamilies = Object.keys(TEXTURES);
  function blotches(g, S, r, n, r0, r1, light, dark) {
    for (let k = 0; k < n; k++) {
      const x = r() * S, y = r() * S, rr = r0 + r() * (r1 - r0);
      g.fillStyle = k % 2 ? light : dark;
      wrapMark(g, S, x, y, rr, (dx, dy) => {
        g.beginPath();
        g.ellipse(x + dx, y + dy, rr, rr * 0.7, 0, 0, TAU);
        g.fill();
      });
    }
  }
  function speckle(g, S, r, n, dark, light) {
    for (let k = 0; k < n; k++) {
      const x = r() * S, y = r() * S, rr = 0.5 + r() * 0.9;
      g.fillStyle = k % 2 ? dark : light;
      g.fillRect(x, y, rr, rr);
    }
  }
  var RAD = Math.PI / 180;
  var ALBERS = (() => {
    const RE = 6371.0088, p1 = 29.5 * RAD, p2 = 45.5 * RAD, p0 = 37.5 * RAD;
    const n = (Math.sin(p1) + Math.sin(p2)) / 2;
    const c = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1);
    return { RE, n, c, rho0: RE * Math.sqrt(c - 2 * n * Math.sin(p0)) / n, lon0: -96 };
  })();
  var SHIPPED_PROJ = { min_x: -2350.109311515341, max_y: 1559.2228881834299, margin: 200, grid: [25, 117, 90] };
  var geoTables = /* @__PURE__ */ new WeakMap();
  function geoTable(w) {
    let t = geoTables.get(w);
    if (t === void 0) {
      const raw = w.raw, g = w.grid, sp = SHIPPED_PROJ;
      const p = raw.projection || (raw.margin === sp.margin && g.R === sp.grid[0] && g.cols === sp.grid[1] && g.rows === sp.grid[2] ? sp : null);
      t = p ? { p, lon: new Float32Array(g.size).fill(NaN), lat: new Float32Array(g.size) } : null;
      geoTables.set(w, t);
    }
    return t;
  }
  function geo(w, i) {
    if (w.geography) return w.geography;
    const t = geoTable(w);
    if (t && Number.isNaN(t.lon[i])) {
      const { RE, n, c, rho0, lon0 } = ALBERS;
      const X = w.grid.cx(i) + t.p.min_x - t.p.margin, Y = t.p.max_y + t.p.margin - w.grid.cy(i);
      const dy = rho0 - Y, rho = Math.hypot(X, dy);
      const s = (c - (rho * n / RE) ** 2) / (2 * n);
      t.lon[i] = lon0 + Math.atan2(X, dy) / n / RAD;
      t.lat[i] = Math.asin(Math.max(-1, Math.min(1, s))) / RAD;
    }
    return t;
  }
  function onPlateau(w, i) {
    const e = w.raw.elev[i];
    if (e < 1400 || e > 2400) return false;
    const t = geo(w, i);
    if (!t) return hash01(i, 97) < 0.5;
    const lon = t.lon[i], lat = t.lat[i];
    return lat > 35.8 && lat < 38.6 && lon > -112.6 && lon < -107.8;
  }
  function inGreatBasin(w, i) {
    const t = geo(w, i);
    if (!t) return false;
    const lon = t.lon[i], lat = t.lat[i];
    return lat > 36.2 && lat < 43.6 && lon > -120.3 && lon < -111.8;
  }
  function pivotCountry(w, i) {
    const t = geo(w, i);
    return !t || t.lon[i] < -98;
  }
  var FIELD_T = 256;
  var FIELD_TILE_MAX_PX = 2048;
  var FIELD_ALPHA = { far: 0.6, mid: 0.9, near: 1, close: 1 };
  function isFieldCell(w, i, Rpx) {
    if (w.cover[i] !== COVER.CROP || w.relief[i] > 1 || w.water[i]) return false;
    const city = w.cityByCell.get(i);
    return !city || cityIsDot(city, Rpx);
  }
  function fieldRegion(w, i) {
    const t = geo(w, i);
    if (t && t.lon[i] < -82.5) {
      const band = Math.floor((t.lon[i] + 130) / 3);
      const lonMid = band * 3 - 130 + 1.5;
      return { key: `p${band}`, ang: -ALBERS.n * (lonMid - ALBERS.lon0) * RAD, ox: band * 37.3, oy: band * 23.9 };
    }
    const bx = Math.floor(w.grid.cx(i) / 280), by = Math.floor(w.grid.cy(i) / 280);
    const id = bx * 7919 + by * 104729;
    const ang = [-0.42, -0.2, 0.12, 0.3, 0.52, -0.08][Math.floor(hash01(id, 5) * 6)];
    return { key: `e${bx},${by}`, ang, ox: hash01(id, 6) * FIELD_T, oy: hash01(id, 7) * FIELD_T };
  }
  function drawFields(ctx, cells, w, s, dpr, lod, Rpx) {
    const groups = /* @__PURE__ */ new Map();
    for (const i of cells) {
      if (!isFieldCell(w, i, Rpx)) continue;
      const reg = fieldRegion(w, i);
      const key = reg.key + (w.raw.owner[i] === FOREIGN ? "|f" : "");
      let gr = groups.get(key);
      if (!gr) groups.set(key, gr = { reg, foreign: key.endsWith("|f"), cells: [] });
      gr.cells.push(i);
    }
    if (!groups.size) return;
    let sb = 2 ** Math.round(Math.log2(s));
    while (FIELD_T * sb * dpr > FIELD_TILE_MAX_PX && sb > 1 / 64) sb /= 2;
    const dpx = sb * dpr;
    const base = FIELD_ALPHA[lod] ?? 1;
    const pat = makePattern(ctx, `terrain-fields@${base}`, FIELD_T * sb, dpr, bakedAlpha(base, (g, size) => {
      g.scale(size / FIELD_T, size / FIELD_T);
      paintFieldTile(g, dpx);
    }));
    for (const { reg, foreign, cells: list } of groups.values()) {
      pat.setTransform(new DOMMatrix().translateSelf(reg.ox, reg.oy).rotateSelf(reg.ang / RAD).scaleSelf(1 / dpx));
      ctx.globalAlpha = foreign ? FOREIGN_ALPHA : 1;
      ctx.fillStyle = pat;
      ctx.fill(hexRunsPath(w.grid, list));
    }
    ctx.globalAlpha = 1;
  }
  var CROPS = [
    ["#7f9f3c", 3],
    ["#94b04a", 2.5],
    ["#6c8c36", 2],
    ["#d8b84f", 2.5],
    ["#e2c86c", 1.5],
    ["#c9a446", 1.2],
    ["#d9cc98", 1],
    ["#a97f50", 1],
    ["#8d6a45", 0.8],
    ["#b4bf62", 1.2]
  ].map(([c, wgt]) => [C(c), wgt]);
  var CROP_W = CROPS.map((c) => c[1]);
  function paintFieldTile(g, dpx) {
    const r = rng(4021);
    const T = FIELD_T, px = 1 / dpx;
    g.fillStyle = "#a18f5d";
    g.fillRect(0, 0, T, T);
    const lane = Math.max(0.35, px * 0.9);
    const furrows = dpx >= 1.6;
    const breaks = [];
    for (let x = 0; x < T; ) {
      let cw = 13 + r() * 15;
      if (T - x - cw < 9) cw = T - x;
      for (let y = 0; y < T; ) {
        let rh = 9 + r() * 19;
        if (T - y - rh < 8) rh = T - y;
        const split = r() < 0.28 ? 2 : 1;
        for (let k = 0; k < split; k++) {
          const vert = cw > rh;
          const fx = vert ? x + cw / split * k : x, fy = vert ? y : y + rh / split * k;
          const fw = vert ? cw / split : cw, fh = vert ? rh : rh / split;
          paintField(g, r, fx + lane / 2, fy + lane / 2, fw - lane, fh - lane, px, furrows);
        }
        if (r() < 0.07) breaks.push([x, y + rh, cw, true]);
        y += rh;
      }
      if (r() < 0.2) breaks.push([x + cw, r() * T * 0.6, 30 + r() * 60, false]);
      x += cw;
    }
    if (dpx >= 1.2) {
      for (const [x0, y0, len, horiz] of breaks) {
        const pts = [];
        for (let t = 0; t <= len; t += 0.5) {
          const p = horiz ? [x0 + t, y0] : [x0, y0 + t];
          if (p[0] > 1 && p[0] < T - 1 && p[1] > 1 && p[1] < T - 1) pts.push(p);
        }
        if (pts.length > 3) treeLine(g, pts, 0.42, px, rng(Math.floor(x0 * 31 + y0 * 17)));
      }
    }
  }
  function paintField(g, r, x, y, fw, fh, px, furrows) {
    const c = CROPS[pickWeighted(r, CROP_W)][0];
    g.fillStyle = css(c);
    g.fillRect(x, y, fw, fh);
    const gr = g.createLinearGradient(x, y, x + fw, y + fh);
    gr.addColorStop(0, "rgba(255,248,215,.16)");
    gr.addColorStop(0.6, "rgba(255,248,215,0)");
    gr.addColorStop(1, "rgba(40,30,0,.12)");
    g.fillStyle = gr;
    g.fillRect(x, y, fw, fh);
    if (furrows) {
      const step = Math.max(0.7, px * 3.2);
      const alongX = fw > fh ? r() < 0.8 : r() < 0.2;
      g.strokeStyle = css(shade(c, -0.28), 0.38);
      g.lineWidth = Math.max(px * 0.9, step * 0.28);
      g.beginPath();
      if (alongX) for (let yy = y + step / 2; yy < y + fh; yy += step) {
        g.moveTo(x + 0.2, yy);
        g.lineTo(x + fw - 0.2, yy);
      }
      else for (let xx = x + step / 2; xx < x + fw; xx += step) {
        g.moveTo(xx, y + 0.2);
        g.lineTo(xx, y + fh - 0.2);
      }
      g.stroke();
    }
    g.lineWidth = Math.max(px, 0.15);
    g.strokeStyle = "rgba(255,246,210,.3)";
    g.beginPath();
    g.moveTo(x, y + fh);
    g.lineTo(x, y);
    g.lineTo(x + fw, y);
    g.stroke();
    g.strokeStyle = "rgba(70,50,20,.3)";
    g.beginPath();
    g.moveTo(x + fw, y);
    g.lineTo(x + fw, y + fh);
    g.lineTo(x, y + fh);
    g.stroke();
  }
  function treeLine(g, pts, cr, px, r) {
    const stroke = (dx, dy, col, lw) => {
      g.beginPath();
      pts.forEach(([x, y], k) => k ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy));
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.stroke();
    };
    stroke(cr * 0.9, cr * 0.6, "rgba(20,30,10,.25)", cr * 2.4);
    stroke(0, -cr * 0.5, "#2b4520", cr * 1.9);
    const crowns = [];
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const d = Math.hypot(x1 - x0, y1 - y0);
      for (; acc < d; acc += cr * (0.55 + r() * 0.35)) {
        const t = acc / d;
        crowns.push([x0 + (x1 - x0) * t + (r() - 0.5) * cr * 0.3, y0 + (y1 - y0) * t + (r() - 0.5) * cr * 0.3, cr * (0.8 + r() * 0.4)]);
      }
      acc -= d;
    }
    crowns.sort((p, q) => p[1] - q[1]);
    for (const [x, y, rr] of crowns) {
      g.fillStyle = "#3a5e27";
      g.beginPath();
      g.arc(x, y - rr * 0.7, rr, 0, TAU);
      g.fill();
    }
    if (cr / px < 1.5) return;
    for (const [x, y, rr] of crowns) {
      g.fillStyle = "#6a9440";
      g.beginPath();
      g.arc(x - rr * 0.28, y - rr * 1, rr * 0.6, 0, TAU);
      g.fill();
    }
    if (cr / px < 3) return;
    g.fillStyle = "rgba(176,206,112,.7)";
    for (const [x, y, rr] of crowns) {
      g.beginPath();
      g.arc(x - rr * 0.42, y - rr * 1.15, rr * 0.26, 0, TAU);
      g.fill();
    }
  }
  var SPOTS = [[0, 0.05]].concat([0, 1, 2, 3, 4, 5].map((k) => [Math.cos(k * (Math.PI / 3) + Math.PI / 6) * 0.38, Math.sin(k * (Math.PI / 3) + Math.PI / 6) * 0.34 + 0.08])).concat([0, 1, 2, 3, 4, 5].map((k) => [Math.cos(k * (Math.PI / 3)) * 0.6, Math.sin(k * (Math.PI / 3)) * 0.46 + 0.1]));
  var CLUMPS = [
    [],
    [[0, 0.22]],
    [[-0.3, -0.02], [0.3, 0.32]],
    [[-0.32, -0.18], [0.34, -0.08], [0, 0.44]],
    [[-0.36, -0.28], [0.34, -0.26], [-0.3, 0.32], [0.36, 0.4]],
    [[-0.38, -0.3], [0.3, -0.38], [0.02, 0.08], [-0.38, 0.44], [0.42, 0.4]]
  ];
  var BRIDGE = [[Math.sqrt(3) / 2, 0], [Math.sqrt(3) / 4, 0.75], [-Math.sqrt(3) / 4, 0.75]];
  var NV_MTN = 12;
  var NV_HILL = 12;
  var NV_MESA = 6;
  var RIDGE_ANG = [-0.9, -0.72, -0.54, -0.37, -0.2, -0.04, 0.12];
  var RIDGE_BIAS = -0.45;
  function planCell(env, i) {
    const { w, R: R2, lod } = env;
    if (w.water[i]) return;
    const city = w.cityByCell.get(i);
    const spill = metroSpill(w).get(i);
    const tiled = city && !cityIsDot(city, env.Rpx) || spill && !cityIsDot(spill, env.Rpx) && !cityIsDot(spill.of, env.Rpx);
    const x = w.grid.cx(i), y = w.grid.cy(i);
    const a = w.raw.owner[i] === FOREIGN ? FOREIGN_ALPHA : 1;
    const rel = w.relief[i], cv = w.cover[i];
    const elev = w.raw.elev[i];
    const h = (salt) => hash01(i, salt);
    const vary = (salt, n) => Math.floor(h(salt) * n) % n;
    const put = (list, name, arg, v, px, py, f = 1, z = py) => list.push({ spr: sprite(env, name, arg, v), x: x + px * R2, y: y + py * R2, k: R2 * f, a, z: y + z * R2 });
    const up2 = (name, arg, v, px, py, f, z) => put(env.upright, name, arg, v, px, py, f, z);
    const flat = (name, arg, v, px = 0, py = 0, f = 1) => put(env.ground, name, arg, v, px, py, f);
    if (tiled) {
      if (cv === COVER.URBAN && atLeast(lod, "mid")) flat("suburbGround", "", vary(130, 8));
      return;
    }
    const isForest = cv === COVER.DECIDUOUS || cv === COVER.EVERGREEN || cv === COVER.MIXED;
    const forestPct = w.pct?.forest ? w.pct.forest[i] || 0 : isForest ? 70 : 0;
    const desert = cv === COVER.SCRUB || cv === COVER.BARREN;
    const emax = w.raw.elev_max ? w.raw.elev_max[i] : elev;
    const snowy = cv === COVER.ICE || rel === 3 || (desert ? elev > 3e3 || emax > 3200 : elev > 2400 || emax > 3e3);
    const alpine = rel === 3 || rel === 2 && emax > 3500;
    const near = atLeast(lod, "near"), mid = atLeast(lod, "mid"), close = lod === "close";
    const c = { w, i, h, vary, up: up2, rel, cv, elev, alpine, isForest, forestPct, desert, snowy, near, lod, city, bridges: env.bridges };
    if (rel >= 2 && desert && !snowy && !city && inGreatBasin(w, i) && h(61) < 0.32) {
      flat("cracks", "", vary(62, 6), (h(63) - 0.5) * 0.3, (h(64) - 0.5) * 0.3, 0.7 + h(65) * 0.3);
      if (mid) {
        const n = lod === "mid" ? 2 : lod === "near" ? 4 : 6;
        for (let k = 0; k < n; k++) up2(h(66 + k) < 0.8 ? "sage" : "rocks", "", vary(70 + k, 6), (h(80 + k) - 0.5) * 1.1, (h(90 + k) - 0.5) * 1, 0.8 + h(100 + k) * 0.3);
      }
      return;
    }
    if (rel >= 2) return planMountains(c);
    const tops = rel === 1 ? planHills(c) : null;
    if (city || tops?.ridge) return;
    const onHill = !!tops;
    const hillSpot = (k, salt) => {
      const t = tops[k % tops.length];
      return [t[0] + (h(salt + k) - 0.5) * t[3], t[1] + (h(salt + 20 + k) - 0.5) * 0.05, t[2] + 1e-3 * (k + 1)];
    };
    const onTops = (n, salt, fn) => {
      if (tops?.length) for (let k = 0; k < n; k++) fn(...hillSpot(k, salt), k);
    };
    const spots = (n, salt, start = 0) => {
      const idx = SPOTS.map((_, k) => k).slice(start);
      idx.sort((p, q) => hash01(i, salt + p) - hash01(i, salt + q));
      return idx.slice(0, n).map((k, j) => [SPOTS[k][0] + (hash01(i, salt + 40 + j) - 0.5) * 0.1, SPOTS[k][1] + (hash01(i, salt + 60 + j) - 0.5) * 0.08]);
    };
    if (isForest && forestPct >= 20 && !onHill) {
      const d = forestPct / 100;
      const n = lod === "far" ? d >= 0.45 ? 1 : 0 : lod === "mid" ? d >= 0.6 ? 3 : 2 : lod === "near" ? d >= 0.6 ? 4 : d >= 0.4 ? 3 : 2 : d >= 0.6 ? 5 : 3;
      const kind = cv === COVER.DECIDUOUS ? "decid" : cv === COVER.EVERGREEN ? elev > 2200 ? "conifsnow" : "conif" : "mixed";
      const L = CLUMPS[n] || [];
      const f = lod === "far" ? 1.3 : 1;
      L.forEach(([px, py], k) => up2("clump", kind, vary(20 + k, 8), px + (h(30 + k) - 0.5) * 0.1, py + (h(40 + k) - 0.5) * 0.06, f * (0.88 + h(50 + k) * 0.22)));
      if (close) {
        spots(3, 300, 7).forEach(([px, py], k) => up2("tree", kind === "decid" || kind === "mixed" && k % 2 ? "decid" : "conif", vary(60 + k, 6), px, py, 0.8 + h(70 + k) * 0.2));
      }
      if (cv === COVER.DECIDUOUS && close) spots(2, 320).forEach(([px, py], k) => up2("tuft", "", vary(80 + k, 6), px, py, 0.9));
      return;
    }
    if (!mid) return;
    switch (cv) {
      case COVER.CROP: {
        if (!onHill && pivotCountry(w, i) && h(105) < (elev > 700 ? 0.5 : 0.3)) {
          const two = h(106) < 0.35;
          const P2 = two ? [[-0.3, -0.16], [0.3, 0.24]] : [[0, 0.04]];
          P2.forEach(([px, py], k) => flat("pivot", "", vary(107 + k, 6), px + (h(109 + k) - 0.5) * 0.3, py + (h(111 + k) - 0.5) * 0.24, 0.85 + h(113 + k) * 0.3));
        }
        if (near && h(101) < 0.3) {
          if (onHill) onTops(1, 115, (px, py, z) => up2("barn", "", vary(102, 4), px, py, 0.8, z));
          else up2("barn", "", vary(102, 4), (h(103) - 0.5) * 0.7, 0.1 + (h(104) - 0.5) * 0.5, 1);
        }
        break;
      }
      case COVER.PASTURE:
        if (onHill) break;
        flat("pasture", "", vary(110, 8));
        if (near && h(111) < 0.22) up2("barn", "", vary(112, 4), (h(113) - 0.5) * 0.7, 0.1 + (h(114) - 0.5) * 0.5, 0.9);
        break;
      case COVER.WETLAND:
        if (!onHill) flat("marsh", "", vary(120, 8));
        break;
      case COVER.URBAN:
        if (!onHill) {
          flat("suburbGround", "", vary(130, 8));
          up2("suburbBuild", "", vary(130, 8), 0, 0, 1, 0);
        } else if (near) onTops(1, 132, (px, py, z) => up2("suburbBuild", "small", vary(130, 8), px, py + 0.1, 0.7, z));
        break;
      case COVER.ICE:
        if (!onHill) flat("ice", "", vary(140, 6));
        break;
      case COVER.BARREN:
        if (!onHill) {
          flat("cracks", "", vary(150, 6));
          spots(near ? close ? 4 : 3 : 1, 160).forEach(([px, py], k) => up2("rocks", "", vary(170 + k, 6), px, py, 0.9 + h(180 + k) * 0.3));
        } else onTops(near ? 2 : 1, 160, (px, py, z, k) => up2("rocks", "", vary(170 + k, 6), px, py, 0.8 + h(180 + k) * 0.3, z));
        break;
      case COVER.SCRUB: {
        if (onHill) {
          if (near) onTops(close ? 3 : 2, 200, (px, py, z, k) => up2(h(220 + k) < 0.75 ? "sage" : "rocks", "", vary(240 + k, 6), px, py, 0.8 + h(260 + k) * 0.3, z));
          break;
        }
        const low = elev < 800;
        const n = lod === "mid" ? 3 : lod === "near" ? 5 : 8;
        if (low && h(190) < 0.35) up2("dune", "", vary(191, 6), (h(192) - 0.5) * 0.3, 0.3 + (h(193) - 0.5) * 0.3, 1);
        spots(n, 200).forEach(([px, py], k) => {
          const t = h(220 + k);
          const kind = low && t < 0.3 ? "cactus" : t < 0.82 ? "sage" : "rocks";
          up2(kind, "", vary(240 + k, 6), px, py, 0.85 + h(260 + k) * 0.3);
        });
        break;
      }
      case COVER.GRASS: {
        if (onHill) {
          if (near) onTops(close ? 3 : 2, 280, (px, py, z, k) => up2("tuft", close && k === 0 ? "flowers" : "", vary(290 + k, 6), px, py, 0.85 + h(300 + k) * 0.2, z));
          break;
        }
        if (near) flat("meadow", close ? "c" : "n", vary(270, 6));
        const groups = lod === "mid" ? 2 : lod === "near" ? 3 : 5;
        spots(groups, 280).forEach(([px, py], k) => {
          const m = lod === "mid" ? 1 : 1 + (h(310 + k) < 0.6) + (close && h(312 + k) < 0.5);
          for (let q = 0; q < m; q++) {
            const ox = q ? (h(320 + k * 3 + q) - 0.5) * 0.2 : 0, oy = q ? (h(340 + k * 3 + q) - 0.3) * 0.1 : 0;
            up2("tuft", close && (k + q) % 3 === 0 ? "flowers" : "", vary(290 + k * 3 + q, 6), px + ox, py + oy, (q ? 0.72 : 0.92) + h(300 + k) * 0.2);
          }
        });
        break;
      }
      default:
        break;
    }
    if (forestPct >= 20) {
      const kind = cv === COVER.SCRUB || elev > 1500 ? "conif" : "decid";
      if (onHill) {
        onTops(near && forestPct >= 30 ? 2 : 1, 410, (px, py, z, k) => up2("clump", kind === "conif" ? "conif" : "mixed", vary(410 + k, 8), px, py + 0.04, 0.55 + h(430 + k) * 0.12, z));
      } else {
        const n = near ? Math.min(3, Math.round(forestPct / 18)) : 1;
        spots(n, 400, 7).forEach(([px, py], k) => up2("tree", kind, vary(420 + k, 6), px, py, 0.8 + h(440 + k) * 0.25));
      }
    }
  }
  function planMountains(c) {
    const { w, i, h, vary, up: up2, cv, elev, desert, isForest, snowy, near, city, lod, bridges } = c;
    const plateau = desert && !snowy && onPlateau(w, i);
    const hf = Math.min(1.14, Math.max(0.82, 0.8 + (elev - 1200) / 6e3));
    if (plateau && h(3) < 0.34) {
      const jx = (h(1) - 0.5) * 0.4, jy = (h(2) - 0.5) * 0.16;
      up2("mesa", "mesa", vary(4, NV_MESA), jx, 0.3 + jy, 0.9 + h(5) * 0.25);
      if (h(6) < 0.5) up2("mesa", "butte", vary(7, NV_MESA), jx + (h(8) < 0.5 ? -0.62 : 0.64), 0.52 + (h(9) - 0.5) * 0.1, 0.62 + h(10) * 0.2);
    } else {
      const style = mtnStyle(c, plateau);
      const basin = desert && !snowy && inGreatBasin(w, i);
      const jx = (h(1) - 0.5) * 0.5, jy = (h(2) - 0.5) * 0.22;
      const f0 = basin ? 0.6 + h(5) * 0.55 : 0.8 + h(5) * 0.3;
      up2("mtn", style, vary(4, NV_MTN), jx * (basin ? 0.5 : 1), (basin ? 0.02 : 0.26) + jy, f0 * hf);
      const extra = lod === "far" ? 0 : h(8) < 0.3 ? 0 : h(8) < 0.78 ? 1 : 2;
      const side = h(9) < 0.5 ? -1 : 1;
      for (let k = 0; k < extra; k++) {
        const sd = k ? -side : side;
        const ex = basin ? jx * 0.5 + (h(10 + k) - 0.5) * 0.3 : jx * 0.4 + sd * (0.45 + h(10 + k) * 0.2);
        const ey = basin ? (k ? -0.42 : 0.52) + (h(12 + k) - 0.5) * 0.1 : k ? 0.5 + (h(12 + k) - 0.5) * 0.1 : 0.02 + (h(12 + k) - 0.5) * 0.14;
        up2("mtn", style, vary(16 + k, NV_MTN), ex, ey, (basin ? 0.4 + h(14 + k) * 0.35 : 0.5 + h(14 + k) * 0.22) * hf);
      }
      for (let d = 0; d < (bridges ? 3 : 0); d++) {
        const j = w.grid.neighbour(i, d);
        if (j < 0 || w.water[j] || w.relief[j] < 2 || h(20 + d) > 0.8) continue;
        const [bx, by] = BRIDGE[d];
        up2("mtn", style, vary(24 + d, NV_MTN), bx + (h(27 + d) - 0.5) * 0.2, by + 0.2 + (h(30 + d) - 0.5) * 0.1, (0.55 + h(33 + d) * 0.2) * hf);
      }
    }
    if (!near || city) return;
    const foot2 = (k) => [(h(40 + k) - 0.5) * 1.2, 0.6 + h(42 + k) * 0.14];
    if (isForest) {
      const kind = snowy ? "conifsnow" : cv === COVER.DECIDUOUS ? "mixed" : "conif";
      for (let k = 0, n = 1 + (h(44) < 0.5); k < n; k++) up2("clump", kind, vary(45 + k, 8), ...foot2(k), 0.5 + h(47 + k) * 0.15);
    } else if (desert) {
      up2("sage", "", vary(45, 6), ...foot2(0), 0.9);
      if (h(46) < 0.6) up2("rocks", "", vary(47, 6), ...foot2(1), 0.85);
    }
  }
  function mtnStyle({ alpine, cv, desert, snowy, isForest }, plateau) {
    if (alpine) return snowy ? "peak" : "arid";
    if (desert) return snowy ? "rocksnow" : plateau ? "desert" : "arid";
    if (isForest || cv === COVER.GRASS || cv === COVER.PASTURE || cv === COVER.CROP || cv === COVER.WETLAND) return snowy ? "greensnow" : "green";
    return snowy ? "rocksnow" : "rock";
  }
  function planHills(c) {
    const { w, i, h, vary, up: up2, cv, desert, isForest, forestPct, lod, bridges } = c;
    const tops = [];
    if (isForest ? forestPct >= 20 : forestPct >= 40) {
      planWoodedHills(c);
      tops.ridge = true;
      return tops;
    }
    if (desert && onPlateau(w, i) && h(3) < 0.34) {
      up2("mesa", "butte", vary(4, NV_MESA), (h(1) - 0.5) * 0.4, 0.3 + (h(2) - 0.5) * 0.16, 0.72 + h(5) * 0.25);
      return tops;
    }
    const tone = hillTone(w, cv);
    const mound = (v, px, py, f) => {
      up2("hill", tone, v, px, py, f, py);
      tops.push([px - 0.04 * f, py - 0.17 * f, py, 0.34 * f]);
    };
    const jx = (h(1) - 0.5) * 0.5, jy = (h(2) - 0.5) * 0.22;
    mound(vary(4, NV_HILL), jx, 0.22 + jy, 0.85 + h(5) * 0.3);
    const extra = lod === "far" ? 0 : h(8) < 0.35 ? 0 : h(8) < 0.8 ? 1 : 2;
    const side = h(9) < 0.5 ? -1 : 1;
    for (let k = 0; k < extra; k++) {
      const sd = k ? -side : side;
      mound(vary(16 + k, NV_HILL), jx * 0.4 + sd * (0.46 + h(10 + k) * 0.16), k ? 0.5 + (h(12 + k) - 0.5) * 0.1 : -0.06 + (h(12 + k) - 0.5) * 0.12, 0.55 + h(14 + k) * 0.25);
    }
    for (let d = 0; d < (bridges ? 3 : 0); d++) {
      const j = w.grid.neighbour(i, d);
      if (j < 0 || w.water[j] || w.relief[j] < 1 || h(20 + d) > 0.65) continue;
      const [bx, by] = BRIDGE[d];
      const py = by + 0.15 + (h(30 + d) - 0.5) * 0.1;
      up2("hill", tone, vary(24 + d, NV_HILL), bx + (h(27 + d) - 0.5) * 0.2, py, 0.5 + h(33 + d) * 0.2, py);
    }
    return tops;
  }
  function planWoodedHills(c) {
    const { w, i, h, vary, up: up2, cv, elev, isForest, forestPct, lod, bridges } = c;
    const conif = cv === COVER.EVERGREEN || !isForest && (cv === COVER.SCRUB || elev > 1500);
    const mixed = cv === COVER.MIXED;
    const base = w.coverRGB && w.coverRGB[cv] || [96, 120, 64];
    const tone = `${cv}.${mix(base, [134, 124, 78], 0.5).map((q) => q | 0).join(".")}`;
    const ang = RIDGE_ANG[ridgeAngle(w, i)] + (h(7) - 0.5) * 0.35;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const n = lod === "far" ? 1 : h(8) < 0.28 ? 1 : h(8) < 0.8 ? 2 : 3;
    const spread = 0.62 + h(9) * 0.3;
    const mounds = [];
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? (h(11) - 0.5) * 0.2 : (k / (n - 1) - 0.5) * spread + (h(11 + k) - 0.5) * 0.12;
      const f = (n === 1 ? 1.15 : k === 1 || n === 2 && k === 0 ? 1 : 0.8) + h(14 + k) * 0.22;
      const px = ux * t + (h(17 + k) - 0.5) * 0.1, py = 0.16 + uy * t * 0.7 + (h(20 + k) - 0.5) * 0.1;
      up2("hill", tone, vary(24 + k, NV_HILL), px, py, f, py);
      mounds.push([px, py, f]);
    }
    for (let d = 0; d < (bridges && lod !== "far" ? 3 : 0); d++) {
      const j = w.grid.neighbour(i, d);
      if (j < 0 || w.water[j] || w.relief[j] !== 1 || h(30 + d) > 0.55) continue;
      const [bx, by] = BRIDGE[d];
      const py = by + 0.15 + (h(33 + d) - 0.5) * 0.1, f = 0.48 + h(36 + d) * 0.18;
      up2("hill", tone, vary(39 + d, NV_HILL), bx + (h(42 + d) - 0.5) * 0.2, py, f, py);
      mounds.push([bx, py, f]);
    }
    const dens = Math.max(0.45, Math.min(1, forestPct / 75));
    const total = Math.round((lod === "far" ? 4 : lod === "mid" ? 8 : lod === "near" ? 11 : 15) * dens);
    for (let k = 0; k < total; k++) {
      const [mx, my, f] = mounds[k % Math.min(mounds.length, n + 1)];
      const u = (h(100 + k) - 0.5) * 1.8;
      const hh = 0.26 * f * Math.max(0, 1 - u * u * 0.95);
      const tx = mx + u * 0.46 * f - 0.03 * f, ty = my - hh * (0.2 + h(120 + k) * 0.75);
      const kind = conif || mixed && h(140 + k) < 0.5 ? "conif" : "decid";
      const ts = (0.46 + h(160 + k) * 0.16) * (0.7 + 0.3 * f);
      up2("tree", kind, vary(180 + k, 6), tx, ty, ts, my + 1e-3 + (ty - my + 0.3) * 0.01);
    }
    if (lod !== "far") {
      for (let k = 0, m = lod === "mid" ? 2 : 4; k < m; k++) {
        const tx = (h(200 + k) - 0.5) * 1.3, ty = 0.42 + h(210 + k) * 0.22;
        const kind = conif || mixed && h(220 + k) < 0.5 ? "conif" : "decid";
        up2("tree", kind, vary(230 + k, 6), tx, ty, 0.6 + h(240 + k) * 0.2);
      }
    }
  }
  function ridgeAngle(w, i) {
    const { grid } = w, e = w.raw.elev;
    const grad = (c) => {
      const z = e[c];
      const E = (d) => {
        const j = grid.neighbour(c, d);
        return j < 0 || w.water[j] ? z : e[j];
      };
      return [(E(0) - E(3)) / (2 * grid.W), (E(1) + E(2) - E(4) - E(5)) / (6 * grid.R)];
    };
    let [gx, gy] = grad(i);
    for (let d = 0; d < 6; d++) {
      const j = grid.neighbour(i, d);
      if (j < 0 || w.water[j]) continue;
      const [jx, jy] = grad(j);
      gx += jx * 0.5;
      gy += jy * 0.5;
    }
    gx /= 4;
    gy /= 4;
    const bx = Math.cos(RIDGE_BIAS), by = Math.sin(RIDGE_BIAS);
    let ax = -gy, ay = gx * 0.62;
    const m = Math.hypot(ax, ay);
    let vx = bx, vy = by;
    if (m > 1e-6) {
      if (ax * bx + ay * by < 0) ax = -ax, ay = -ay;
      const wgt = Math.min(0.65, Math.hypot(gx, gy) / 8);
      vx = bx * (1 - wgt) + ax / m * wgt;
      vy = by * (1 - wgt) + ay / m * wgt;
    }
    const ang = Math.atan2(vy, vx) + (hash01(i, 77) - 0.5) * 0.1;
    let best = 0;
    for (let k = 1; k < RIDGE_ANG.length; k++) if (Math.abs(RIDGE_ANG[k] - ang) < Math.abs(RIDGE_ANG[best] - ang)) best = k;
    return best;
  }
  function hillTone(w, cv) {
    const c = w.coverRGB && w.coverRGB[cv] || (cv === COVER.NONE ? [138, 136, 110] : [150, 160, 100]);
    return `${cv}.${c.map((v) => v | 0).join(".")}`;
  }
  var HEX_BOX = { x0: -0.92, y0: -1.02, x1: 0.92, y1: 1.02 };
  var SPRITES = {
    clump: { box: { x0: -0.54, y0: -0.76, x1: 0.7, y1: 0.18 }, paint: paintClump },
    tree: { box: { x0: -0.2, y0: -0.6, x1: 0.32, y1: 0.1 }, paint: paintTree },
    mtn: { box: { x0: -1, y0: -1.46, x1: 1.12, y1: 0.26 }, paint: paintMountain },
    mesa: { box: { x0: -1.02, y0: -0.8, x1: 1.08, y1: 0.24 }, paint: paintMesa },
    hill: { box: { x0: -0.76, y0: -0.5, x1: 0.94, y1: 0.2 }, paint: paintHill },
    ridge: { box: { x0: -1.2, y0: -1.02, x1: 1.3, y1: 1.16 }, paint: paintRidge },
    tuft: { box: { x0: -0.17, y0: -0.26, x1: 0.2, y1: 0.06 }, paint: paintTuft },
    sage: { box: { x0: -0.17, y0: -0.17, x1: 0.26, y1: 0.07 }, paint: paintSage },
    cactus: { box: { x0: -0.1, y0: -0.32, x1: 0.2, y1: 0.06 }, paint: paintCactus },
    rocks: { box: { x0: -0.22, y0: -0.2, x1: 0.32, y1: 0.07 }, paint: paintRocks },
    dune: { box: { x0: -0.46, y0: -0.2, x1: 0.6, y1: 0.12 }, paint: paintDune },
    barn: { box: { x0: -0.3, y0: -0.36, x1: 0.42, y1: 0.09 }, paint: paintBarn },
    pivot: { box: { x0: -0.38, y0: -0.38, x1: 0.42, y1: 0.4 }, paint: paintPivot },
    pasture: { box: HEX_BOX, paint: paintPasture },
    meadow: { box: HEX_BOX, paint: paintMeadow },
    marsh: { box: HEX_BOX, paint: paintMarsh },
    suburbGround: SUBURB_ART.ground,
    suburbBuild: SUBURB_ART.build,
    ice: { box: HEX_BOX, paint: paintIce },
    cracks: { box: HEX_BOX, paint: paintCracks }
  };
  function sprite(env, name, arg, v) {
    const key = `terrain:${name}:${arg}:${v}`;
    let spr = env.memo.get(key);
    if (!spr) {
      const def = SPRITES[name];
      spr = getSprite(key, env.upx, def.box, (g, upx) => def.paint(g, upx, v, arg));
      env.memo.set(key, spr);
    }
    return spr;
  }
  function softShadow(g, x, y, rx, ry, a) {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(12,16,6,${a})`);
    gr.addColorStop(0.55, `rgba(12,16,6,${a * 0.55})`);
    gr.addColorStop(1, "rgba(12,16,6,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.fill();
    g.restore();
  }
  function hexClip(g, f) {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (60 * k - 30) * Math.PI / 180;
      k ? g.lineTo(Math.cos(a) * f, Math.sin(a) * f) : g.moveTo(Math.cos(a) * f, Math.sin(a) * f);
    }
    g.closePath();
    g.clip();
  }
  function poly2(g, pts) {
    g.beginPath();
    pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
  }
  function blobPath(g, x, y, rx, ry, r, n = 9, wob = 0.3) {
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, f = 1 - wob / 2 + r() * wob;
      pts.push([x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f]);
    }
    g.beginPath();
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]);
    g.moveTo(m0[0], m0[1]);
    for (let k = 0; k < n; k++) {
      const p = pts[k], m = mid(p, pts[(k + 1) % n]);
      g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    g.closePath();
  }
  var DECID = [
    { deep: "#203a17", dark: "#2f5220", mid: "#4f7d2e", light: "#80ab49", hi: "#bcd77d" },
    { deep: "#2a3f16", dark: "#3e5c22", mid: "#678c34", light: "#9bbd55", hi: "#d2e391" },
    { deep: "#1b3416", dark: "#2a4a1f", mid: "#3f6b2c", light: "#6b9a43", hi: "#a6c873" },
    { deep: "#3a3412", dark: "#5c5420", mid: "#8c8132", light: "#bfa54a", hi: "#e7cf82" },
    { deep: "#3c2410", dark: "#6a3c1a", mid: "#a35c2a", light: "#cf8a3e", hi: "#efc27a" }
  ];
  var CONIF = [
    { deep: "#0d2318", dark: "#163423", mid: "#25523a", light: "#3e7650", hi: "#6e9e6e" },
    { deep: "#10281a", dark: "#1b3a26", mid: "#2f5f3a", light: "#4d8455", hi: "#82b078" },
    { deep: "#0c2420", dark: "#132e28", mid: "#1f4a3f", light: "#356c5a", hi: "#629682" }
  ];
  function decidTree(g, x, y, h, pal, px, shadow = true) {
    if (shadow) softShadow(g, x + h * 0.24, y - h * 0.01, h * 0.42, h * 0.13, 0.34);
    g.fillStyle = "#4a3622";
    g.fillRect(x - h * 0.035, y - h * 0.42, h * 0.07, h * 0.42);
    g.fillStyle = "#2a1e12";
    g.fillRect(x + h * 5e-3, y - h * 0.42, h * 0.03, h * 0.42);
    const r = h * 0.3, cx = x, cy = y - h * 0.64;
    const lobes = [[-0.5, 0.18, 0.72], [0.52, 0.22, 0.7], [0.02, -0.42, 0.78], [-0.22, 0.4, 0.66], [0.28, 0.42, 0.64], [0, 0.02, 0.9]];
    const body = (grow) => {
      g.beginPath();
      for (const [dx, dy, f] of lobes) {
        g.moveTo(cx + dx * r + f * r + grow, cy + dy * r);
        g.arc(cx + dx * r, cy + dy * r, f * r + grow, 0, TAU);
      }
    };
    body(px * 1.1);
    g.fillStyle = "rgba(18,28,10,.8)";
    g.fill();
    body(0);
    g.fillStyle = pal.dark;
    g.fill();
    for (const [dx, dy, f] of [...lobes].sort((p, q) => p[1] - q[1])) {
      const lx = cx + dx * r, ly = cy + dy * r, lr = f * r;
      const gr = g.createRadialGradient(lx - lr * 0.4, ly - lr * 0.45, lr * 0.05, lx, ly, lr * 1.05);
      const lit = dx + dy < -0.2;
      gr.addColorStop(0, lit ? pal.hi : pal.light);
      gr.addColorStop(0.45, lit ? pal.light : pal.mid);
      gr.addColorStop(1, pal.dark);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(lx, ly, lr, 0, TAU);
      g.fill();
    }
    g.save();
    body(0);
    g.clip();
    g.fillStyle = "rgba(10,25,5,.32)";
    g.beginPath();
    g.ellipse(cx + r * 0.25, cy + r * 1.05, r * 1.1, r * 0.55, 0, 0, TAU);
    g.fill();
    g.restore();
    if (h / px > 18) {
      g.fillStyle = pal.hi;
      g.globalAlpha = 0.7;
      for (const [dx, dy, f] of [[-0.45, -0.25, 0.14], [-0.1, -0.7, 0.12], [-0.6, 0.15, 0.1]]) {
        g.beginPath();
        g.arc(cx + dx * r, cy + dy * r, f * r, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }
  function conifTree(g, x, y, h, pal, px, shadow = true, snow = false) {
    if (shadow) softShadow(g, x + h * 0.26, y, h * 0.34, h * 0.1, 0.34);
    g.fillStyle = "#3a2a1a";
    g.fillRect(x - h * 0.025, y - h * 0.16, h * 0.05, h * 0.16);
    const tiers = 3;
    for (let t = 0; t < tiers; t++) {
      const yb = y - h * (0.1 + t * 0.24);
      const ya = t === tiers - 1 ? y - h : yb - h * (0.42 - t * 0.04);
      const wd = h * (0.25 - t * 0.055);
      const path = () => {
        g.beginPath();
        g.moveTo(x, ya);
        g.quadraticCurveTo(x - wd * 0.3, yb - (yb - ya) * 0.35, x - wd, yb);
        g.lineTo(x - wd * 0.45, yb - h * 0.025);
        g.lineTo(x, yb + h * 0.02);
        g.lineTo(x + wd * 0.45, yb - h * 0.025);
        g.lineTo(x + wd, yb);
        g.quadraticCurveTo(x + wd * 0.3, yb - (yb - ya) * 0.35, x, ya);
        g.closePath();
      };
      path();
      g.strokeStyle = pal.deep;
      g.lineWidth = px * 1.6;
      g.stroke();
      const gr = g.createLinearGradient(x - wd, 0, x + wd, 0);
      gr.addColorStop(0, pal.light);
      gr.addColorStop(0.46, pal.mid);
      gr.addColorStop(0.54, pal.dark);
      gr.addColorStop(1, pal.deep);
      g.fillStyle = gr;
      g.fill();
      if (snow) {
        g.fillStyle = "rgba(245,249,253,.92)";
        g.beginPath();
        g.moveTo(x, ya);
        g.quadraticCurveTo(x - wd * 0.2, ya + (yb - ya) * 0.3, x - wd * 0.55, ya + (yb - ya) * 0.62);
        g.lineTo(x - wd * 0.1, ya + (yb - ya) * 0.45);
        g.lineTo(x + wd * 0.2, ya + (yb - ya) * 0.35);
        g.closePath();
        g.fill();
      }
    }
    if (h / px > 20) {
      g.strokeStyle = pal.hi;
      g.globalAlpha = 0.55;
      g.lineWidth = px;
      g.beginPath();
      g.moveTo(x - h * 0.02, y - h * 0.95);
      g.lineTo(x - h * 0.09, y - h * 0.62);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  function paintClump(g, upx, v, kind) {
    const r = rng(v * 7919 + kind.length * 131 + 7);
    const px = 1 / upx;
    const n = 5 + Math.floor(r() * 3);
    const trees = [];
    for (let k = 0; k < n; k++) {
      const ang = k / n * TAU + r() * 0.6;
      const rad = k === 0 ? 0 : 0.6 + r() * 0.4;
      const conif = kind.startsWith("conif") || kind === "mixed" && r() < 0.5;
      trees.push({
        x: Math.cos(ang) * 0.3 * rad,
        y: Math.sin(ang) * 0.1 * rad,
        conif,
        h: conif ? 0.44 + r() * 0.14 : 0.36 + r() * 0.1,
        pal: conif ? CONIF[Math.floor(r() * CONIF.length)] : DECID[Math.floor(r() * (kind === "mixed" ? 5 : 4))]
      });
    }
    trees.sort((p, q) => p.y - q.y);
    softShadow(g, 0.14, 0.03, 0.46, 0.14, 0.3);
    for (const t of trees) softShadow(g, t.x + t.h * 0.24, t.y, t.h * 0.36, t.h * 0.1, 0.22);
    for (const t of trees) {
      if (t.conif) conifTree(g, t.x, t.y, t.h, t.pal, px, false, kind === "conifsnow");
      else decidTree(g, t.x, t.y, t.h, t.pal, px, false);
    }
  }
  function paintTree(g, upx, v, kind) {
    const px = 1 / upx;
    if (kind === "conif") conifTree(g, 0, 0, 0.5, CONIF[v % CONIF.length], px);
    else decidTree(g, 0, 0, 0.44, DECID[v % 4], px);
  }
  var MTN = {
    rock: { lit: "#b9a990", lit2: "#8d7d68", sh: "#5f5246", sh2: "#43392f", line: "#2a2119", snow: 0, h: 0.95 },
    rocksnow: { lit: "#aea89f", lit2: "#837c72", sh: "#5b5752", sh2: "#3d3a37", line: "#24211e", snow: 0.42, h: 1.02 },
    peak: { lit: "#b3aea7", lit2: "#8a847c", sh: "#5c5956", sh2: "#3e3c3a", line: "#211f1d", snow: 0.6, h: 1.24 },
    arid: { lit: "#c3b296", lit2: "#9a876b", sh: "#6b6052", sh2: "#4a4239", line: "#2b241c", snow: 0, h: 0.84, sage: true },
    desert: { lit: "#cf9a6c", lit2: "#a8754e", sh: "#7b4c34", sh2: "#583626", line: "#361f13", snow: 0, h: 0.82, strata: true, sage: true },
    green: { lit: "#a59b85", lit2: "#6c7a4a", sh: "#4f5442", sh2: "#2e3a25", line: "#1d2317", snow: 0, h: 0.9, trees: true },
    greensnow: { lit: "#aaa49a", lit2: "#6f7b52", sh: "#55574d", sh2: "#30392a", line: "#1f2219", snow: 0.36, h: 1.02, trees: true }
  };
  var HAZE = [150, 170, 190];
  function paintMountain(g, upx, v, style) {
    const S = MTN[style] || MTN.rock;
    const r = rng(v * 104729 + style.length * 977 + 3);
    const px = 1 / upx;
    const H = S.h * (0.9 + r() * 0.16);
    const lean = r() < 0.5 ? -1 : 1;
    const peaks = [];
    if (r() < 0.65) peaks.push({ x: lean * (0.36 + r() * 0.1), h: H * (0.5 + r() * 0.2), wl: 0.34 + r() * 0.06, wr: 0.36 + r() * 0.06, haze: 0.24, y: -0.04 });
    peaks.push({ x: (r() - 0.5) * 0.1, h: H, wl: 0.48 + r() * 0.14, wr: 0.46 + r() * 0.14, haze: 0, y: 0 });
    if (r() < 0.45) peaks.push({ x: -lean * (0.36 + r() * 0.1), h: H * (0.3 + r() * 0.12), wl: 0.26, wr: 0.3, haze: 0, y: 0.07, foot: true });
    softShadow(g, 0.28, 0.04, 0.82, 0.17, 0.38);
    for (const p of peaks) drawPeak(g, p, S, r, px);
    g.save();
    g.globalCompositeOperation = "source-atop";
    const gr = g.createLinearGradient(0, -0.3, 0, 0.1);
    gr.addColorStop(0, "rgba(30,22,14,0)");
    gr.addColorStop(1, "rgba(30,22,14,.35)");
    g.fillStyle = gr;
    g.fillRect(-1.3, -0.3, 2.6, 0.6);
    g.restore();
    if (S.sage && upx > 24) {
      for (let k = 0, n = 7 + Math.floor(r() * 6); k < n; k++) {
        const x = (r() - 0.5) * 1.05, y = -0.02 - r() * 0.16 * (1 - Math.abs(x));
        const br = Math.max(px * 1.4, 0.014 + r() * 0.01);
        g.fillStyle = "rgba(40,44,24,.55)";
        g.beginPath();
        g.arc(x + br * 0.4, y + br * 0.3, br, 0, TAU);
        g.fill();
        g.fillStyle = k % 3 ? "#7d8656" : "#5f6b45";
        g.beginPath();
        g.arc(x, y, br, 0, TAU);
        g.fill();
      }
    }
    if (S.trees) {
      const n = 5 + Math.floor(r() * 3);
      const ts = [];
      for (let k = 0; k < n; k++) ts.push([(k / (n - 1) - 0.5) * 1.05 + (r() - 0.5) * 0.1, 0.03 + r() * 0.1, 0.17 + r() * 0.09]);
      ts.sort((p, q) => p[1] - q[1]);
      for (const [tx, ty, th] of ts) conifTree(g, tx, ty, th, CONIF[Math.floor(r() * CONIF.length)], px, true, S.snow > 0 && r() < 0.4);
    }
  }
  function drawPeak(g, p, S, r, px) {
    const by = p.y, sx = p.x, sy = by - p.h;
    const col = (c) => css(p.haze ? mix(C(c), HAZE, p.haze) : C(c));
    const L = [[sx - p.wl, by]], Rr = [];
    for (const t of [0.28, 0.52, 0.76]) {
      L.push([sx - p.wl * (1 - t) + (r() - 0.5) * 0.05, by - p.h * t + (r() - 0.5) * p.h * 0.1]);
      Rr.push([sx + p.wr * (1 - t) + (r() - 0.5) * 0.05, by - p.h * t + (r() - 0.5) * p.h * 0.1]);
    }
    Rr.reverse();
    const top = [sx, sy];
    const rEnd = sx + p.wr * (0.15 + r() * 0.15);
    const ridge = [top];
    for (const t of [0.22, 0.45, 0.7]) ridge.push([sx + (rEnd - sx) * t + (r() - 0.5) * 0.09, sy + p.h * t]);
    ridge.push([rEnd, by]);
    const lit = [...L, top, ...ridge.slice(1)];
    const shd = [top, ...Rr, [sx + p.wr, by], ...ridge.slice(1).reverse()];
    const sil = [...L, top, ...Rr, [sx + p.wr, by]];
    g.beginPath();
    sil.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y));
    g.strokeStyle = S.line;
    g.globalAlpha = p.haze ? 0.45 : 0.8;
    g.lineWidth = px * 2.2;
    g.stroke();
    g.globalAlpha = 1;
    let gr = g.createLinearGradient(sx - p.wl * 0.4, sy, sx - p.wl * 0.2, by);
    gr.addColorStop(0, col(S.lit));
    gr.addColorStop(1, col(S.lit2));
    poly2(g, lit);
    g.fillStyle = gr;
    g.fill();
    gr = g.createLinearGradient(sx, sy, sx + p.wr * 0.4, by);
    gr.addColorStop(0, col(S.sh));
    gr.addColorStop(1, col(S.sh2));
    poly2(g, shd);
    g.fillStyle = gr;
    g.fill();
    if (S.strata) {
      g.save();
      poly2(g, sil);
      g.clip();
      for (let yy = sy + p.h * 0.3, k = 0; yy < by - 0.04; yy += 0.09 + r() * 0.05, k++) {
        g.beginPath();
        g.moveTo(sx - p.wl - 0.1, yy);
        g.quadraticCurveTo(sx, yy + (r() - 0.5) * 0.05, sx + p.wr + 0.1, yy + 0.02);
        g.strokeStyle = k % 2 ? "rgba(255,214,160,.13)" : "rgba(90,36,14,.13)";
        g.lineWidth = 0.014;
        g.stroke();
      }
      g.restore();
    }
    g.lineWidth = Math.max(px, 0.012);
    for (let k = 1; k < ridge.length - 1; k++) {
      const [rx, ry] = ridge[k];
      g.beginPath();
      g.moveTo(rx, ry);
      g.quadraticCurveTo(rx - 0.06, ry + 0.08, rx - 0.12 - r() * 0.1, ry + 0.16 + r() * 0.1);
      g.strokeStyle = col(S.sh);
      g.globalAlpha = 0.55;
      g.stroke();
      g.beginPath();
      g.moveTo(rx + 0.02, ry + 0.02);
      g.quadraticCurveTo(rx + 0.08, ry + 0.1, rx + 0.12 + r() * 0.08, ry + 0.18 + r() * 0.08);
      g.strokeStyle = "rgba(255,255,255,.5)";
      g.globalAlpha = 0.28;
      g.stroke();
      g.globalAlpha = 1;
    }
    const snowF = S.snow * (p.foot ? 0 : p.haze ? 0.85 : 1);
    if (snowF > 0) {
      const y0 = sy + p.h * snowF;
      const cap = new Path2D();
      cap.moveTo(sx - p.wl - 0.2, sy - 0.2);
      cap.lineTo(sx + p.wr + 0.2, sy - 0.2);
      cap.lineTo(sx + p.wr + 0.2, y0 - p.h * 0.08);
      const n = 9;
      for (let k = 0; k <= n; k++) {
        const xx = sx + p.wr + 0.1 - (p.wl + p.wr + 0.2) * k / n;
        const drip = k % 2 ? p.h * (0.05 + r() * 0.09) : -p.h * (0.02 + r() * 0.04);
        cap.lineTo(xx, y0 + drip - (xx - sx) * 0.12);
      }
      cap.lineTo(sx - p.wl - 0.2, y0);
      cap.closePath();
      for (const [face, color] of [[lit, "#f6f9fc"], [shd, "#aebfd4"]]) {
        g.save();
        poly2(g, face);
        g.clip();
        g.fillStyle = p.haze ? css(mix(C(color), HAZE, p.haze * 0.6)) : color;
        g.fill(cap);
        g.restore();
      }
    }
    g.beginPath();
    g.moveTo(L[2][0], L[2][1]);
    g.lineTo(L[3][0], L[3][1]);
    g.lineTo(top[0], top[1]);
    g.strokeStyle = snowF > 0 ? "rgba(255,255,255,.85)" : "rgba(255,240,210,.45)";
    g.lineWidth = Math.max(px * 1.2, 0.012);
    g.stroke();
  }
  function paintMesa(g, upx, v, kind) {
    const r = rng(v * 331 + kind.length * 17 + 5);
    const px = 1 / upx;
    const butte = kind === "butte";
    const forms = butte ? [{ x: (r() - 0.5) * 0.08, tw: 0.1 + r() * 0.04, h: 0.6 + r() * 0.1, y: 0 }] : v % 2 ? [{ x: -0.16, tw: 0.27 + r() * 0.07, h: 0.5 + r() * 0.08, y: 0 }, { x: 0.56, tw: 0.075 + r() * 0.03, h: 0.52 + r() * 0.08, y: 0.07 }] : [{ x: (r() - 0.5) * 0.1, tw: 0.3 + r() * 0.08, h: 0.5 + r() * 0.08, y: 0 }];
    softShadow(g, 0.26, 0.05, butte ? 0.42 : 0.72, 0.15, 0.42);
    for (const f of forms) paintTable(g, f, r, px, upx);
  }
  var STRATA = [["#efd3a2", "#a88a62"], ["#c8693c", "#7c3820"], ["#d8975a", "#8a5530"], ["#b9583a", "#6e301c"]];
  function paintTable(g, { x, tw, h, y: by }, r, px, upx) {
    const top = by - h, cliffB = by - h * 0.48;
    const out = 0.08 + h * 0.42;
    const lean = Math.min(0.02, tw * 0.08);
    const split = x + tw * 0.38;
    const d = Math.min(0.055, tw * 0.28);
    const line = Math.max(px * 1.4, 9e-3);
    const talus = new Path2D();
    talus.moveTo(x - tw - 4e-3, cliffB - 8e-3);
    talus.bezierCurveTo(x - tw - out * 0.25, cliffB + (by - cliffB) * 0.55, x - tw - out * 0.6, by - 4e-3, x - tw - out, by);
    talus.lineTo(x + tw + out * 1.2, by);
    talus.bezierCurveTo(x + tw + out * 0.7, by - 4e-3, x + tw + out * 0.3, cliffB + (by - cliffB) * 0.55, x + tw + 0.01, cliffB - 8e-3);
    talus.closePath();
    let gr = g.createLinearGradient(0, cliffB, 0, by);
    gr.addColorStop(0, "#a85f3a");
    gr.addColorStop(0.6, "#c48a5c");
    gr.addColorStop(1, "rgba(206,160,112,.0)");
    g.fillStyle = gr;
    g.fill(talus);
    g.save();
    g.clip(talus);
    poly2(g, [[split, cliffB - 0.02], [x + tw + out * 0.5, by + 0.02], [x + tw + out * 2, by + 0.02], [x + tw + 0.3, cliffB - 0.02]]);
    g.fillStyle = "rgba(78,32,14,.32)";
    g.fill();
    g.lineWidth = Math.max(px, 6e-3);
    for (let k = 0, n = Math.round(tw * 26) + 4; k < n; k++) {
      const sx = x - tw + (k + 0.5) / n * tw * 2, ex = sx + (sx - x) * 0.9 + (r() - 0.5) * 0.04;
      g.strokeStyle = k % 2 ? "rgba(80,34,14,.28)" : "rgba(255,228,184,.2)";
      g.beginPath();
      g.moveTo(sx, cliffB);
      g.quadraticCurveTo(sx + (sx - x) * 0.2, (cliffB + by) / 2, ex, by - 0.01);
      g.stroke();
    }
    if (upx * h > 20) {
      for (let k = 0; k < 12; k++) {
        const t = r(), bx = x - tw - out * 0.5 + t * (tw * 2 + out * 1.4), byy = cliffB + (by - cliffB) * (0.25 + r() * 0.65);
        const br = Math.max(px * 1.1, 6e-3 + r() * 8e-3);
        g.fillStyle = "rgba(60,26,10,.5)";
        g.beginPath();
        g.arc(bx + br * 0.4, byy + br * 0.3, br, 0, TAU);
        g.fill();
        g.fillStyle = "#d9aa7c";
        g.beginPath();
        g.arc(bx, byy, br, 0, TAU);
        g.fill();
      }
    }
    g.restore();
    const xl = x - tw, xr = x + tw;
    const lip = [];
    for (let k = 0, n = Math.max(5, Math.round(tw * 30)); k <= n; k++) {
      const t = k / n, lx = xl + lean + (xr - xl - 2 * lean) * t;
      const notch = k > 0 && k < n && r() < 0.22 ? 0.012 + r() * 0.012 : (r() - 0.5) * 6e-3;
      lip.push([lx, top + notch]);
    }
    const front = [[xl + lean, top], ...lip.filter(([lx]) => lx <= split), [split, top], [split + 4e-3, cliffB], [xl - 4e-3, cliffB]];
    const side = [[split, top], ...lip.filter(([lx]) => lx > split), [xr - lean, top], [xr + 0.01, cliffB], [split + 4e-3, cliffB]];
    const block = new Path2D();
    [[xl + lean, top], ...lip, [xr - lean, top], [xr + 0.01, cliffB], [xl - 4e-3, cliffB]].forEach(([qx, qy], k) => k ? block.lineTo(qx, qy) : block.moveTo(qx, qy));
    block.closePath();
    g.strokeStyle = "rgba(52,22,9,.8)";
    g.lineWidth = line * 1.3;
    g.stroke(block);
    const bands = [0, 0.2 + r() * 0.06, 0.46 + r() * 0.08, 0.74 + r() * 0.06, 1];
    for (let b = 0; b < 4; b++) {
      const y0 = top + (cliffB - top) * bands[b], y1 = top + (cliffB - top) * bands[b + 1] + 2e-3;
      const [lit, shd] = STRATA[b];
      g.save();
      g.beginPath();
      g.rect(xl - 0.05, y0, xr - xl + 0.1, y1 - y0);
      g.clip();
      poly2(g, front);
      g.fillStyle = lit;
      g.fill();
      poly2(g, side);
      g.fillStyle = shd;
      g.fill();
      g.restore();
    }
    g.save();
    g.clip(block);
    gr = g.createLinearGradient(xl, 0, split, 0);
    gr.addColorStop(0, "rgba(255,236,200,.12)");
    gr.addColorStop(1, "rgba(60,20,8,.18)");
    g.fillStyle = gr;
    g.fillRect(xl - 0.02, top - 0.03, split - xl + 0.02, cliffB - top + 0.04);
    g.lineWidth = Math.max(px, 6e-3);
    for (let fx = xl + 0.012; fx < xr; fx += 0.02 + r() * 0.024) {
      g.strokeStyle = fx < split ? "rgba(92,36,14,.24)" : "rgba(30,10,4,.26)";
      g.beginPath();
      g.moveTo(fx, top + 0.015);
      g.lineTo(fx + (r() - 0.5) * 6e-3, cliffB - r() * (cliffB - top) * 0.45);
      g.stroke();
    }
    for (let b = 1; b < 4; b++) {
      g.fillStyle = "rgba(50,18,6,.28)";
      g.fillRect(xl - 0.02, top + (cliffB - top) * bands[b] - Math.max(px * 0.6, 3e-3), xr - xl + 0.05, Math.max(px, 5e-3));
    }
    g.restore();
    g.beginPath();
    g.moveTo(split, top);
    g.lineTo(split + 4e-3, cliffB);
    g.strokeStyle = "rgba(255,226,186,.4)";
    g.lineWidth = Math.max(px, 6e-3);
    g.stroke();
    const capTop = [[xl + lean, top], [xl + lean + d * 0.6, top - d * 0.8], [x - tw * 0.1, top - d + (r() - 0.5) * 0.01], [xr - lean - d * 0.4, top - d * 0.75], [xr - lean, top], ...lip.slice().reverse()];
    poly2(g, capTop);
    gr = g.createLinearGradient(xl, top - d, xr, top);
    gr.addColorStop(0, "#f3d2a0");
    gr.addColorStop(1, "#d2a06c");
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = "rgba(52,22,9,.7)";
    g.lineWidth = line;
    g.stroke();
    g.beginPath();
    lip.filter(([lx]) => lx <= split + 0.01).forEach(([lx, ly], k) => k ? g.lineTo(lx, ly) : g.moveTo(lx, ly));
    g.strokeStyle = "rgba(255,240,210,.85)";
    g.lineWidth = Math.max(px * 1.1, 7e-3);
    g.stroke();
    if (upx * tw > 16) {
      g.fillStyle = "#6f7a4c";
      for (let k = 0, n = Math.round(tw * 12); k < n; k++) {
        g.beginPath();
        g.arc(x - tw * 0.75 + r() * tw * 1.5, top - d * (0.25 + r() * 0.55), Math.max(px * 1.1, 9e-3), 0, TAU);
        g.fill();
      }
    }
  }
  function hillPalette(cv, c) {
    const dry = cv === COVER.SCRUB || cv === COVER.BARREN;
    const ice = cv === COVER.ICE;
    const pull = cv === COVER.NONE ? 0 : 0.38;
    const base = ice ? shade(c, -0.08) : shade(mix(c, dry ? [170, 128, 72] : [100, 116, 54], pull), -0.1);
    return {
      hi: mix(shade(base, 0.24), WARM, 0.22),
      light: mix(shade(base, 0.12), WARM, 0.12),
      base,
      dark: mix(shade(base, -0.3), COOL, 0.14),
      deep: mix(shade(base, -0.5), COOL, 0.2),
      dry,
      ice
    };
  }
  function paintHill(g, upx, v, toneKey) {
    const [cvStr, ...rgb] = toneKey.split(".");
    const cv = +cvStr;
    const T = hillPalette(cv, rgb.map(Number));
    const r = rng(v * 613 + cv * 37 + 11);
    const px = 1 / upx;
    const mounds = [];
    if (v % 3 === 0) mounds.push({ x: 0.3 + r() * 0.1, w: 0.3 + r() * 0.06, h: 0.16 + r() * 0.05, y: -0.04 });
    mounds.push({ x: (r() - 0.5) * 0.08, w: 0.46 + r() * 0.1, h: 0.26 + r() * 0.08, y: 0 });
    if (v % 4 === 1) mounds.push({ x: -0.36 - r() * 0.05, w: 0.24, h: 0.11 + r() * 0.04, y: 0.05 });
    for (const m of mounds) softShadow(g, m.x + m.w * 0.35, m.y + 0.02, m.w * 0.95, 0.11, 0.34);
    for (const m of mounds) paintMound(g, m, T, r, px, upx);
  }
  function paintMound(g, { x, y, w, h }, T, r, px, upx) {
    const top = x - w * 0.12 + (r() - 0.5) * 0.08;
    const path = new Path2D();
    path.moveTo(x - w, y);
    path.bezierCurveTo(x - w * 0.62, y - h * 0.78, top - w * 0.28, y - h * 1.02, top, y - h);
    path.bezierCurveTo(top + w * 0.36, y - h * 0.98, x + w * 0.72, y - h * 0.45, x + w, y);
    path.quadraticCurveTo(x, y + h * 0.12, x - w, y);
    path.closePath();
    g.strokeStyle = css(T.deep, 0.6);
    g.lineWidth = px * 2;
    g.stroke(path);
    let gr = g.createLinearGradient(x - w, y - h, x + w * 0.6, y);
    gr.addColorStop(0, css(T.light));
    gr.addColorStop(0.45, css(T.base));
    gr.addColorStop(1, css(T.dark));
    g.fillStyle = gr;
    g.fill(path);
    g.save();
    g.clip(path);
    gr = g.createLinearGradient(top + w * 0.05, 0, x + w * 0.85, 0);
    gr.addColorStop(0, css(T.dark, 0));
    gr.addColorStop(0.35, css(T.dark, 0.55));
    gr.addColorStop(1, css(T.deep, 0.75));
    g.fillStyle = gr;
    g.fillRect(x - w, y - h * 1.2, w * 2.2, h * 1.4);
    gr = g.createRadialGradient(top - w * 0.25, y - h * 0.85, 0, top - w * 0.2, y - h * 0.7, w * 0.55);
    gr.addColorStop(0, css(T.hi, 0.7));
    gr.addColorStop(1, css(T.hi, 0));
    g.fillStyle = gr;
    g.fillRect(x - w, y - h * 1.2, w * 2.2, h * 1.4);
    gr = g.createLinearGradient(0, y - h * 0.35, 0, y);
    gr.addColorStop(0, css(T.deep, 0));
    gr.addColorStop(1, css(T.deep, 0.35));
    g.fillStyle = gr;
    g.fillRect(x - w, y - h * 0.35, w * 2.2, h * 0.5);
    if (upx * w > 20 && !T.ice) {
      const prof = (t) => Math.sin(Math.PI * (0.12 + t * 0.76));
      if (T.dry) {
        for (let k = 0, n = 6 + Math.floor(r() * 6); k < n; k++) {
          const t = r(), gx = x - w * 0.8 + t * w * 1.6, gy = y - h * (0.15 + r() * 0.7) * prof(t);
          const br = Math.max(px * 1.3, 0.016 + r() * 0.012);
          g.fillStyle = css(T.deep, 0.5);
          g.beginPath();
          g.arc(gx + br * 0.5, gy + br * 0.35, br, 0, TAU);
          g.fill();
          g.fillStyle = k % 3 ? "#7a8352" : "#5d6942";
          g.beginPath();
          g.arc(gx, gy, br, 0, TAU);
          g.fill();
          if (br / px > 3) {
            g.fillStyle = "rgba(205,212,160,.6)";
            g.beginPath();
            g.arc(gx - br * 0.35, gy - br * 0.35, br * 0.35, 0, TAU);
            g.fill();
          }
        }
      } else {
        g.lineWidth = Math.max(px, 0.01);
        for (let k = 0; k < 16; k++) {
          const t = r(), gx = x - w * 0.8 + t * w * 1.6, gy = y - h * (0.1 + r() * 0.75) * prof(t);
          g.strokeStyle = k % 2 ? css(T.hi, 0.5) : css(T.deep, 0.35);
          g.beginPath();
          g.moveTo(gx, gy);
          g.lineTo(gx - 8e-3, gy - 0.035);
          g.stroke();
        }
      }
    }
    g.restore();
    g.beginPath();
    g.moveTo(x - w * 0.82, y - h * 0.3);
    g.bezierCurveTo(x - w * 0.6, y - h * 0.78, top - w * 0.28, y - h * 1, top + w * 0.1, y - h * 0.99);
    g.strokeStyle = css(T.hi, 0.8);
    g.lineWidth = Math.max(px * 1.4, 0.014);
    g.stroke();
  }
  function paintRidge(g, upx, v, arg) {
    const [kind, ais, dens] = arg.split("|");
    const ai = +ais, ang = RIDGE_ANG[ai];
    const r = rng(v * 4241 + ai * 71 + kind.length * 13 + (dens === "d" ? 5 : 0) + 1);
    const px = 1 / upx;
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const L = 0.82 + r() * 0.1, H = 0.2 + r() * 0.07, wf = 0.17 + r() * 0.04;
    const k1 = 5 + r() * 4, p1 = r() * TAU, k2 = 11 + r() * 5, p2 = r() * TAU;
    const pal = kind === "conif" ? CONIF[v % 2] : DECID[v % 3];
    const N = 30, crest = [], foot2 = [], envs = [];
    for (let k = 0; k <= N; k++) {
      const t = -1 + 2 * k / N, env = Math.pow(1 - t * t, 0.55);
      const prof = env * (1 + 0.13 * Math.sin(t * k1 + p1) + 0.06 * Math.sin(t * k2 + p2));
      const bx = ux * t * L, by = uy * t * L, fw = wf * (0.35 + 0.65 * env);
      crest.push([bx, by - H * prof]);
      foot2.push([bx + nx * fw, by + ny * fw]);
      envs.push(env);
    }
    g.save();
    g.translate(nx * wf * 0.9 + 0.06, ny * wf * 0.9 + 0.02);
    g.rotate(ang);
    softShadow(g, 0, 0, L * 1.05, wf * 0.95, 0.42);
    g.restore();
    const face = new Path2D();
    crest.forEach(([x, y], k) => k ? face.lineTo(x, y) : face.moveTo(x, y));
    for (let k = N; k >= 0; k--) face.lineTo(foot2[k][0], foot2[k][1]);
    face.closePath();
    g.strokeStyle = css(C(pal.deep), 0.85);
    g.lineWidth = px * 2.2;
    g.stroke(face);
    let gr = g.createLinearGradient(0, -H, nx * wf, ny * wf);
    gr.addColorStop(0, pal.light);
    gr.addColorStop(0.35, pal.mid);
    gr.addColorStop(0.75, pal.dark);
    gr.addColorStop(1, pal.deep);
    g.fillStyle = gr;
    g.fill(face);
    g.save();
    g.clip(face);
    gr = g.createLinearGradient(-ux * L, -uy * L, ux * L, uy * L);
    gr.addColorStop(0, "rgba(255,240,190,.2)");
    gr.addColorStop(0.5, "rgba(255,240,190,0)");
    gr.addColorStop(1, "rgba(10,20,40,.22)");
    g.fillStyle = gr;
    g.fillRect(-1.3, -1.1, 2.6, 2.3);
    const dabs = Math.round((dens === "d" ? 90 : 55) * Math.min(1, upx / 40));
    for (let k = 0; k < dabs; k++) {
      const q = Math.floor(r() * N), s = 0.12 + r() * 0.85;
      const cx = crest[q][0] + (foot2[q][0] - crest[q][0]) * s, cy = crest[q][1] + (foot2[q][1] - crest[q][1]) * s;
      const br = Math.max(px * 1.2, 0.02 + r() * 0.015);
      g.fillStyle = css(C(pal.deep), 0.45);
      g.beginPath();
      g.arc(cx + br * 0.3, cy + br * 0.3, br, 0, TAU);
      g.fill();
      g.fillStyle = css(C(pal.light), 0.4);
      g.beginPath();
      g.arc(cx - br * 0.3, cy - br * 0.35, br * 0.6, 0, TAU);
      g.fill();
    }
    g.strokeStyle = css(C(pal.deep), 0.35);
    g.lineWidth = Math.max(px, 0.01);
    for (let k = 0; k < 4; k++) {
      const q = 4 + Math.floor(r() * (N - 8));
      g.beginPath();
      g.moveTo(crest[q][0], crest[q][1] + 0.02);
      g.quadraticCurveTo(crest[q][0] + 0.03, (crest[q][1] + foot2[q][1]) / 2, foot2[q][0] + 0.02, foot2[q][1]);
      g.stroke();
    }
    g.restore();
    g.beginPath();
    for (let k = 1; k <= Math.round(N * 0.75); k++) (k > 1 ? g.lineTo : g.moveTo).call(g, crest[k][0], crest[k][1]);
    g.strokeStyle = css(C(pal.hi), 0.85);
    g.lineWidth = Math.max(px * 1.5, 0.012);
    g.stroke();
    g.beginPath();
    foot2.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y));
    g.strokeStyle = "rgba(12,20,8,.6)";
    g.lineWidth = Math.max(px * 1.5, 0.012);
    g.stroke();
    const step = dens === "d" ? 0.07 : 0.11;
    const crowns = [];
    for (let t = -0.94; t <= 0.94; t += step * (0.75 + r() * 0.5)) {
      const q = Math.round((t + 1) / 2 * N), env = envs[q];
      if (env < 0.3 && r() < 0.5) continue;
      const conif = kind === "conif" || kind === "mixed" && r() < 0.5;
      crowns.push({
        x: crest[q][0] + (r() - 0.5) * 0.02,
        y: crest[q][1] + 0.012 + r() * 0.025,
        s: (0.055 + r() * 0.028) * (0.6 + 0.4 * env),
        conif,
        pal: conif ? CONIF[Math.floor(r() * CONIF.length)] : DECID[Math.floor(r() * (kind === "mixed" ? 5 : 4))]
      });
    }
    crowns.sort((p, q) => p.y - q.y);
    for (const c of crowns) crown(g, c.x, c.y, c.s, c.pal, c.conif, px);
  }
  function crown(g, x, y, s, pal, conif, px) {
    if (conif) {
      const w2 = s * 0.42, tip = y - s * 1.45;
      poly2(g, [[x, tip], [x + w2, y], [x - w2, y]]);
      g.strokeStyle = pal.deep;
      g.lineWidth = px * 1.4;
      g.stroke();
      const gr2 = g.createLinearGradient(x - w2, 0, x + w2, 0);
      gr2.addColorStop(0, pal.light);
      gr2.addColorStop(0.48, pal.mid);
      gr2.addColorStop(0.52, pal.dark);
      gr2.addColorStop(1, pal.deep);
      g.fillStyle = gr2;
      g.fill();
      return;
    }
    const cr = s * 0.62, cy = y - cr * 0.9;
    g.beginPath();
    g.arc(x, cy, cr + px * 1.1, 0, TAU);
    g.fillStyle = pal.deep;
    g.fill();
    const gr = g.createRadialGradient(x - cr * 0.4, cy - cr * 0.45, cr * 0.05, x, cy, cr);
    gr.addColorStop(0, pal.hi);
    gr.addColorStop(0.45, pal.mid);
    gr.addColorStop(1, pal.dark);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, cy, cr, 0, TAU);
    g.fill();
  }
  function paintTuft(g, upx, v, kind) {
    const r = rng(v * 97 + kind.length * 13 + 3);
    const px = 1 / upx;
    softShadow(g, 0.05, 5e-3, 0.13, 0.035, 0.26);
    const n = 11;
    const tips = [];
    for (let k = 0; k < n; k++) {
      const bx = (r() - 0.5) * 0.13, lean = bx * 0.9 + (r() - 0.5) * 0.1, hh = 0.11 + r() * 0.1;
      const wd = Math.max(0.011, px * 1.3);
      g.beginPath();
      g.moveTo(bx - wd, 0);
      g.quadraticCurveTo(bx + lean * 0.25, -hh * 0.6, bx + lean, -hh);
      g.quadraticCurveTo(bx + lean * 0.25 + wd * 0.6, -hh * 0.55, bx + wd, 0);
      g.closePath();
      g.fillStyle = k < n * 0.4 ? "#3f5a22" : k < n * 0.75 ? "#6f9238" : "#a8c660";
      g.fill();
      tips.push([bx + lean, -hh]);
    }
    if (kind === "flowers") {
      const cols = ["#f4dc5c", "#fbf6ea", "#c79ade", "#f0a04a"];
      for (let k = 0; k < 4; k++) {
        const [tx, ty] = tips[n - 1 - k];
        g.fillStyle = cols[(v + k) % cols.length];
        g.beginPath();
        g.arc(tx, ty, Math.max(0.014, px * 1.4), 0, TAU);
        g.fill();
      }
    }
  }
  function paintSage(g, upx, v) {
    const r = rng(v * 151 + 9);
    const px = 1 / upx;
    const blobs = [];
    const n = 3 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) blobs.push([(r() - 0.5) * 0.18, -(r() * 0.04), 0.035 + r() * 0.025]);
    blobs.sort((p, q) => p[1] - q[1]);
    for (const [bx, by, br] of blobs) softShadow(g, bx + br * 0.8, by + 5e-3, br * 1.4, br * 0.45, 0.28);
    for (const [bx, by, br] of blobs) {
      const cy = by - br * 0.8;
      g.beginPath();
      g.arc(bx, cy, br + px * 1.1, 0, TAU);
      g.fillStyle = "rgba(48,52,28,.75)";
      g.fill();
      const gr = g.createRadialGradient(bx - br * 0.4, cy - br * 0.45, br * 0.05, bx, cy, br);
      gr.addColorStop(0, "#d2d6a4");
      gr.addColorStop(0.45, "#97a06d");
      gr.addColorStop(1, "#5c6743");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(bx, cy, br, 0, TAU);
      g.fill();
    }
  }
  function paintCactus(g, upx, v) {
    const r = rng(v * 173 + 21);
    const px = 1 / upx;
    const H = 0.2 + r() * 0.07, W = 0.04;
    softShadow(g, 0.07, 0, 0.12, 0.03, 0.3);
    const armL = r() < 0.8, armR = r() < 0.8;
    const ya = -H * (0.45 + r() * 0.15), yb = -H * (0.55 + r() * 0.15);
    const stems = [[[0, 0], [0, -H]]];
    if (armR) stems.push([[0, ya], [0.065, ya], [0.065, ya - 0.07]]);
    if (armL) stems.push([[0, yb], [-0.055, yb], [-0.055, yb - 0.055]]);
    const strokeAll = (width, style) => {
      g.strokeStyle = style;
      g.lineWidth = width;
      for (const s of stems) {
        g.beginPath();
        s.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y));
        g.stroke();
      }
    };
    strokeAll(W + px * 2.2, "#1f3518");
    const gr = g.createLinearGradient(-0.08, 0, 0.09, 0);
    gr.addColorStop(0, "#9cc777");
    gr.addColorStop(0.5, "#5f8f46");
    gr.addColorStop(1, "#365a2b");
    strokeAll(W, gr);
    g.save();
    g.translate(-W * 0.22, 0);
    strokeAll(Math.max(W * 0.18, px), "rgba(210,240,170,.6)");
    g.restore();
  }
  function paintRocks(g, upx, v) {
    const r = rng(v * 199 + 31);
    const px = 1 / upx;
    const n = 2 + Math.floor(r() * 2);
    const rocks = [];
    for (let k = 0; k < n; k++) rocks.push([(r() - 0.5) * 0.2, -r() * 0.04, 0.04 + r() * 0.04]);
    rocks.sort((p, q) => p[1] - q[1]);
    for (const [bx, by, br] of rocks) softShadow(g, bx + br * 0.7, by + 5e-3, br * 1.4, br * 0.4, 0.3);
    for (const [bx, by, br] of rocks) {
      const pts = [];
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + k / 6 * Math.PI;
        const f = 0.8 + r() * 0.35;
        pts.push([bx + Math.cos(a) * br * f, by + Math.min(0, Math.sin(a) * br * 1.1 * f)]);
      }
      poly2(g, pts);
      g.strokeStyle = "rgba(35,28,22,.8)";
      g.lineWidth = px * 2;
      g.stroke();
      g.fillStyle = "#71675a";
      g.fill();
      g.save();
      g.clip();
      poly2(g, [[bx - br * 1.2, by - br * 1.3], [bx + br * 0.25, by - br * 1.3], [bx - br * 0.1, by - br * 0.3], [bx - br * 1.2, by - br * 0.1]]);
      g.fillStyle = "#b9ad99";
      g.fill();
      g.restore();
    }
  }
  function paintDune(g, upx, v) {
    const r = rng(v * 223 + 7);
    const px = 1 / upx;
    const w = 0.32 + r() * 0.08, h = 0.1 + r() * 0.04, cx = (r() - 0.5) * 0.08;
    softShadow(g, 0.1, 0.03, w * 1.1, 0.05, 0.18);
    const body = new Path2D();
    body.moveTo(-w, 0.02);
    body.quadraticCurveTo(cx - w * 0.4, -h * 1.1, cx + 0.04, -h);
    body.quadraticCurveTo(cx + w * 0.5, -h * 0.6, w, 0.03);
    body.quadraticCurveTo(0, 0.07, -w, 0.02);
    let gr = g.createLinearGradient(-w, -h, w * 0.3, 0.05);
    gr.addColorStop(0, "#f2e1b0");
    gr.addColorStop(1, "#d3b37a");
    g.fillStyle = gr;
    g.fill(body);
    const slip = new Path2D();
    slip.moveTo(cx + 0.04, -h);
    slip.quadraticCurveTo(cx + w * 0.5, -h * 0.6, w, 0.03);
    slip.quadraticCurveTo(cx + w * 0.35, 0.02, cx + 0.1, -h * 0.25);
    slip.closePath();
    gr = g.createLinearGradient(cx, -h, w, 0);
    gr.addColorStop(0, "#a27c4a");
    gr.addColorStop(1, "#c29d66");
    g.fillStyle = gr;
    g.fill(slip);
    g.beginPath();
    g.moveTo(-w * 0.6, -h * 0.55);
    g.quadraticCurveTo(cx - w * 0.3, -h * 1.05, cx + 0.04, -h);
    g.quadraticCurveTo(cx + w * 0.5, -h * 0.6, w * 0.9, 0.02);
    g.strokeStyle = "rgba(255,250,228,.8)";
    g.lineWidth = Math.max(px * 1.2, 0.01);
    g.stroke();
    if (upx > 40) {
      g.strokeStyle = "rgba(160,120,70,.35)";
      g.lineWidth = px;
      for (let k = 1; k <= 3; k++) {
        g.beginPath();
        g.moveTo(-w * 0.8 + k * 0.08, 0.01 - k * 0.012);
        g.quadraticCurveTo(-w * 0.4 + k * 0.05, -h * 0.4 - k * 0.01, cx - 0.05 + k * 0.02, -h * 0.5);
        g.stroke();
      }
    }
  }
  function paintBarn(g, upx, v) {
    const px = 1 / upx;
    const roofs = ["#4b4a4f", "#5a3b2e", "#3f4b57", "#6b6a66"];
    softShadow(g, 0.1, 0.01, 0.28, 0.07, 0.34);
    const sx = -0.2, sw = 0.055, sh = 0.24;
    let gr = g.createLinearGradient(sx - sw, 0, sx + sw, 0);
    gr.addColorStop(0, "#f2f0e8");
    gr.addColorStop(0.5, "#c9c7bd");
    gr.addColorStop(1, "#86857e");
    g.fillStyle = gr;
    g.fillRect(sx - sw, -0.02 - sh, sw * 2, sh);
    g.beginPath();
    g.ellipse(sx, -0.02 - sh, sw, sw * 0.9, 0, Math.PI, 0);
    g.fillStyle = "#9aa7b3";
    g.fill();
    g.strokeStyle = "rgba(40,40,40,.6)";
    g.lineWidth = px;
    g.strokeRect(sx - sw, -0.02 - sh, sw * 2, sh);
    const d = [0.15, -0.06];
    const A = [-0.13, 0], B = [0.03, 0], Cc = [0.03, -0.12], P2 = [-0.05, -0.2], D = [-0.13, -0.12];
    const add = (p) => [p[0] + d[0], p[1] + d[1]];
    const outline = (pts) => {
      poly2(g, pts);
      g.strokeStyle = "rgba(30,14,8,.85)";
      g.lineWidth = px * 1.6;
      g.stroke();
    };
    outline([B, add(B), add(Cc), Cc]);
    g.fillStyle = "#7e2a1f";
    g.fill();
    outline([Cc, P2, add(P2), add(Cc)]);
    g.fillStyle = roofs[v % roofs.length];
    g.fill();
    gr = g.createLinearGradient(-0.13, -0.2, 0.03, 0);
    gr.addColorStop(0, "#d0563c");
    gr.addColorStop(1, "#a63a28");
    outline([A, B, Cc, P2, D]);
    g.fillStyle = gr;
    g.fill();
    if (upx > 40) {
      g.strokeStyle = "rgba(255,245,230,.85)";
      g.lineWidth = Math.max(px, 8e-3);
      g.strokeRect(-0.085, -0.075, 0.07, 0.075);
      g.beginPath();
      g.moveTo(-0.085, -0.075);
      g.lineTo(-0.015, 0);
      g.moveTo(-0.015, -0.075);
      g.lineTo(-0.085, 0);
      g.moveTo(D[0], D[1]);
      g.lineTo(P2[0], P2[1]);
      g.lineTo(Cc[0], Cc[1]);
      g.stroke();
    }
    decidTree(g, 0.22, 0.03, 0.2, DECID[v % 3], px);
  }
  function pickWeighted(r, weights) {
    let t = r() * weights.reduce((p, q) => p + q, 0);
    for (let k = 0; k < weights.length; k++) if ((t -= weights[k]) <= 0) return k;
    return weights.length - 1;
  }
  function paintPivot(g, upx, v) {
    const r = rng(v * 557 + 19);
    const px = 1 / upx;
    const pr = 0.3;
    const ripe = v % 3 === 2;
    g.beginPath();
    g.arc(0.012, 0.012, pr + Math.max(px, 8e-3), 0, TAU);
    g.fillStyle = "rgba(60,48,20,.35)";
    g.fill();
    const gr = g.createRadialGradient(-pr * 0.35, -pr * 0.35, pr * 0.05, 0, 0, pr);
    gr.addColorStop(0, ripe ? "#e6cd72" : "#a8cc5e");
    gr.addColorStop(1, ripe ? "#c19c45" : "#5f8f35");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, pr, 0, TAU);
    g.fill();
    if (upx * pr > 10) {
      g.strokeStyle = ripe ? "rgba(110,80,20,.3)" : "rgba(30,60,10,.3)";
      g.lineWidth = Math.max(px, 5e-3);
      for (const f of [0.3, 0.52, 0.74, 0.92]) {
        g.beginPath();
        g.arc(0, 0, pr * f, 0, TAU);
        g.stroke();
      }
      const a = r() * TAU;
      g.strokeStyle = "rgba(245,245,235,.75)";
      g.lineWidth = Math.max(px * 1.2, 7e-3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * pr, Math.sin(a) * pr);
      g.stroke();
    }
    g.strokeStyle = "rgba(255,250,215,.3)";
    g.lineWidth = Math.max(px, 6e-3);
    g.beginPath();
    g.arc(0, 0, pr, Math.PI * 0.9, Math.PI * 1.6);
    g.stroke();
  }
  function paintMeadow(g, upx, v, kind) {
    const r = rng(v * 811 + 23);
    const px = 1 / upx;
    hexClip(g, 0.97);
    for (let k = 0; k < 6; k++) {
      blobPath(g, (r() - 0.5) * 1.4, (r() - 0.5) * 1.5, 0.18 + r() * 0.16, 0.1 + r() * 0.08, r);
      g.fillStyle = k % 2 ? "rgba(214,206,120,.16)" : "rgba(60,90,30,.14)";
      g.fill();
    }
    const cols = ["rgba(60,92,30,.5)", "rgba(110,146,52,.5)", "rgba(176,196,96,.55)", "rgba(206,196,128,.5)"];
    g.lineWidth = Math.max(px * 1.1, 8e-3);
    const n = Math.round(Math.min(420, upx * 2.2));
    for (let k = 0; k < n; k++) {
      const x = (r() - 0.5) * 1.8, y = (r() - 0.5) * 2, len = 0.025 + r() * 0.035, lean = (r() - 0.6) * 0.5;
      g.strokeStyle = cols[k % cols.length];
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.sin(lean) * len, y - Math.cos(lean) * len);
      g.stroke();
    }
    if (kind === "c") {
      const flowers = ["#f4dc5c", "#fbf6ea", "#c79ade", "#f0a04a", "#e86a5a"];
      for (let p = 0; p < 3; p++) {
        const cx = (r() - 0.5) * 1.1, cy = (r() - 0.5) * 1.2, col = flowers[Math.floor(r() * flowers.length)];
        for (let k = 0; k < 9; k++) {
          const fx = cx + (r() - 0.5) * 0.2, fy = cy + (r() - 0.5) * 0.12;
          g.fillStyle = col;
          g.beginPath();
          g.arc(fx, fy, Math.max(px * 1.2, 0.01), 0, TAU);
          g.fill();
        }
      }
    }
    for (let k = 0, m = 1 + Math.floor(r() * 3); k < m; k++) {
      const x = (r() - 0.5) * 1.1, y = (r() - 0.5) * 1.2, br = 0.02 + r() * 0.015;
      softShadow(g, x + br * 0.6, y + br * 0.2, br * 1.5, br * 0.5, 0.3);
      g.fillStyle = "#8d877a";
      g.beginPath();
      g.ellipse(x, y - br * 0.3, br, br * 0.7, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(235,230,215,.7)";
      g.beginPath();
      g.ellipse(x - br * 0.3, y - br * 0.55, br * 0.45, br * 0.3, 0, 0, TAU);
      g.fill();
    }
  }
  function paintPasture(g, upx, v) {
    const r = rng(v * 389 + 17);
    const px = 1 / upx;
    hexClip(g, 0.94);
    const greens = ["rgba(176,204,104,.5)", "rgba(138,176,82,.5)", "rgba(196,210,120,.45)", "rgba(120,160,72,.45)"];
    g.fillStyle = greens[v % 4];
    g.fillRect(-1, -1.1, 2, 2.2);
    const lines = [];
    for (let k = 0; k < 2; k++) {
      const a = r() * Math.PI, ox = (r() - 0.5) * 0.5, oy = (r() - 0.5) * 0.5;
      lines.push({ a, ox, oy, dx: Math.cos(a), dy: Math.sin(a) });
    }
    lines.forEach((L, k) => {
      const nx = -L.dy, ny = L.dx;
      poly2(g, [[L.ox - L.dx * 3, L.oy - L.dy * 3], [L.ox + L.dx * 3, L.oy + L.dy * 3], [L.ox + L.dx * 3 + nx * 3, L.oy + L.dy * 3 + ny * 3], [L.ox - L.dx * 3 + nx * 3, L.oy - L.dy * 3 + ny * 3]]);
      g.fillStyle = greens[(v + k + 1) % 4];
      g.fill();
      if (k === 0) {
        g.save();
        g.clip();
        g.strokeStyle = "rgba(255,255,220,.1)";
        g.lineWidth = 0.05;
        for (let t = -1.4; t < 1.4; t += 0.1) {
          g.beginPath();
          g.moveTo(L.ox + nx * t - L.dx * 2, L.oy + ny * t - L.dy * 2);
          g.lineTo(L.ox + nx * t + L.dx * 2, L.oy + ny * t + L.dy * 2);
          g.stroke();
        }
        g.restore();
      }
    });
    const along = (L, step, fn) => {
      for (let t = -1.2; t <= 1.2; t += step) {
        const x = L.ox + L.dx * t, y = L.oy + L.dy * t;
        if (Math.hypot(x, y * 1.1) < 0.84) fn(x, y);
      }
    };
    const hedge = [];
    along(lines[0], 0.04, (x, y) => hedge.push([x, y]));
    if (hedge.length > 2) treeLine(g, hedge, 0.032, px, r);
    if (upx > 28) {
      const L = lines[1];
      g.strokeStyle = "rgba(110,80,45,.75)";
      g.lineWidth = Math.max(px, 7e-3);
      g.beginPath();
      g.moveTo(L.ox - L.dx * 1.2, L.oy - L.dy * 1.2 - 0.025);
      g.lineTo(L.ox + L.dx * 1.2, L.oy + L.dy * 1.2 - 0.025);
      g.stroke();
      along(L, 0.08, (x, y) => {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - 0.04);
        g.stroke();
      });
    }
    const pts = [];
    for (let k = 0; k < 4; k++) pts.push([(r() - 0.5) * 1, (r() - 0.5) * 0.9]);
    pts.sort((p, q) => p[1] - q[1]);
    for (const [x, y] of pts) {
      if (v % 2) {
        softShadow(g, x + 0.03, y + 5e-3, 0.05, 0.015, 0.3);
        g.beginPath();
        g.arc(x, y - 0.025, 0.028, 0, TAU);
        g.fillStyle = "#d9c27c";
        g.fill();
        g.strokeStyle = "rgba(120,90,40,.7)";
        g.lineWidth = Math.max(px, 5e-3);
        g.stroke();
        g.beginPath();
        g.arc(x, y - 0.025, 0.013, 0, TAU);
        g.stroke();
      } else if (upx > 36) {
        const c = ["#f2ede2", "#3b2f25", "#8a5a34", "#2a2420"][Math.floor(r() * 4)];
        softShadow(g, x + 0.02, y + 4e-3, 0.04, 0.012, 0.3);
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, y - 0.018, 0.03, 0.016, 0, 0, TAU);
        g.fill();
        g.beginPath();
        g.ellipse(x - 0.032, y - 0.026, 0.011, 9e-3, 0, 0, TAU);
        g.fill();
        g.strokeStyle = "rgba(20,15,10,.6)";
        g.lineWidth = px * 0.8;
        g.stroke();
      }
    }
    g.globalCompositeOperation = "destination-in";
    const fe = g.createRadialGradient(0, 0, 0.5, 0, 0, 0.98);
    fe.addColorStop(0, "rgba(0,0,0,1)");
    fe.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fe;
    g.fillRect(-1, -1.1, 2, 2.2);
    g.globalCompositeOperation = "source-over";
  }
  function paintMarsh(g, upx, v) {
    const r = rng(v * 211 + 41);
    const px = 1 / upx;
    hexClip(g, 0.94);
    for (let k = 0; k < 7; k++) {
      blobPath(g, (r() - 0.5) * 1.3, (r() - 0.5) * 1.4, 0.16 + r() * 0.12, 0.1 + r() * 0.08, r);
      g.fillStyle = k % 2 ? "rgba(30,64,34,.28)" : "rgba(140,170,90,.22)";
      g.fill();
    }
    const pools = [];
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) pools.push([(r() - 0.5) * 1.05, (r() - 0.5) * 1.1, 0.1 + r() * 0.12, 0.05 + r() * 0.05]);
    for (const [x, y, rx, ry] of pools) {
      const seed = Math.floor(r() * 1e6);
      const shape = () => blobPath(g, x, y, rx, ry, rng(seed), 10, 0.35);
      shape();
      g.strokeStyle = "rgba(124,150,96,.55)";
      g.lineWidth = Math.max(px * 2.5, 0.025);
      g.stroke();
      const gr = g.createLinearGradient(0, y - ry, 0, y + ry);
      gr.addColorStop(0, "#2c6170");
      gr.addColorStop(1, "#4a8c98");
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = "rgba(25,45,28,.6)";
      g.lineWidth = Math.max(px, 8e-3);
      g.stroke();
      g.strokeStyle = "rgba(235,250,255,.75)";
      g.lineWidth = Math.max(px * 1.1, 0.01);
      g.beginPath();
      g.moveTo(x - rx * 0.5, y - ry * 0.25);
      g.lineTo(x - rx * 0.15, y - ry * 0.25);
      g.moveTo(x + rx * 0.05, y + ry * 0.15);
      g.lineTo(x + rx * 0.25, y + ry * 0.15);
      g.stroke();
      if (upx > 40) {
        g.fillStyle = "#6f9a48";
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.arc(x + (r() - 0.5) * rx, y + (r() - 0.3) * ry * 0.8, 0.014, 0.4, TAU);
          g.fill();
        }
      }
    }
    const clumps = pools.flatMap(([x, y, rx, ry]) => [[x - rx * 0.9, y + ry * 0.6], [x + rx * 0.8, y + ry * 0.9]]);
    clumps.sort((p, q) => p[1] - q[1]);
    for (const [cx, cy] of clumps) {
      const m = 6 + Math.floor(r() * 4);
      const lw = Math.max(px * 1.1, 9e-3);
      for (let k = 0; k < m; k++) {
        const bx = cx + (r() - 0.5) * 0.08, hh = 0.09 + r() * 0.09, lean = (r() - 0.5) * 0.05;
        g.strokeStyle = k % 3 ? "#5c7a36" : "#3c5626";
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(bx, cy);
        g.quadraticCurveTo(bx + lean * 0.3, cy - hh * 0.6, bx + lean, cy - hh);
        g.stroke();
        if (upx > 34 && k % 3 === 0) {
          g.fillStyle = "#6b4528";
          g.beginPath();
          g.ellipse(bx + lean * 0.9, cy - hh * 0.92, lw * 1.2, Math.max(0.022, px * 2.5), 0, 0, TAU);
          g.fill();
        }
      }
    }
  }
  function paintIce(g, upx, v) {
    const r = rng(v * 541 + 3);
    const px = 1 / upx;
    hexClip(g, 0.94);
    for (let k = 0; k < 7; k++) {
      const x = (r() - 0.5) * 1.4, y = (r() - 0.5) * 1.6, w = 0.25 + r() * 0.25;
      g.beginPath();
      g.moveTo(x - w, y);
      g.quadraticCurveTo(x, y - 0.08, x + w, y);
      g.strokeStyle = "rgba(255,255,255,.75)";
      g.lineWidth = Math.max(px * 1.5, 0.014);
      g.stroke();
      g.beginPath();
      g.moveTo(x - w * 0.9, y + 0.02);
      g.quadraticCurveTo(x, y - 0.05, x + w * 0.9, y + 0.02);
      g.strokeStyle = "rgba(110,145,190,.35)";
      g.lineWidth = Math.max(px * 1.5, 0.016);
      g.stroke();
    }
    for (let k = 0; k < 3; k++) {
      let x = (r() - 0.5) * 1.2, y = (r() - 0.5) * 1.2;
      const pts = [[x, y]];
      for (let n = 0; n < 4; n++) pts.push([x += 0.08 + r() * 0.06, y += (r() - 0.5) * 0.1]);
      for (const [col, off] of [["rgba(255,255,255,.8)", -px], ["rgba(60,95,140,.6)", 0]]) {
        g.beginPath();
        pts.forEach(([px2, py2], n) => n ? g.lineTo(px2, py2 + off) : g.moveTo(px2, py2 + off));
        g.strokeStyle = col;
        g.lineWidth = Math.max(px, 0.01);
        g.stroke();
      }
    }
    if (upx > 40) {
      g.fillStyle = "rgba(255,255,255,.95)";
      for (let k = 0; k < 6; k++) {
        const x = (r() - 0.5) * 1.3, y = (r() - 0.5) * 1.5, s = 0.02 + r() * 0.015;
        poly2(g, [[x, y - s], [x + s * 0.25, y - s * 0.25], [x + s, y], [x + s * 0.25, y + s * 0.25], [x, y + s], [x - s * 0.25, y + s * 0.25], [x - s, y], [x - s * 0.25, y - s * 0.25]]);
        g.fill();
      }
    }
  }
  function paintCracks(g, upx, v) {
    const r = rng(v * 467 + 13);
    const px = 1 / upx;
    hexClip(g, 0.92);
    const gr = g.createRadialGradient(-0.2, -0.2, 0.05, 0, 0, 0.9);
    gr.addColorStop(0, "rgba(255,250,236,.22)");
    gr.addColorStop(1, "rgba(255,250,236,0)");
    g.fillStyle = gr;
    g.fillRect(-1, -1.1, 2, 2.2);
    const walk = (x, y, a, n, depth) => {
      const pts = [[x, y]];
      for (let k = 0; k < n; k++) {
        a += (r() - 0.5) * 1.1;
        pts.push([x += Math.cos(a) * 0.09, y += Math.sin(a) * 0.09]);
        if (depth < 2 && r() < 0.25) walk(x, y, a + (r() < 0.5 ? 1.2 : -1.2), 3, depth + 1);
      }
      for (const [col, off] of [["rgba(255,250,235,.3)", px], ["rgba(80,64,48,.4)", 0]]) {
        g.beginPath();
        pts.forEach(([px2, py2], k) => k ? g.lineTo(px2 + off, py2 + off) : g.moveTo(px2 + off, py2 + off));
        g.strokeStyle = col;
        g.lineWidth = Math.max(px, 8e-3);
        g.stroke();
      }
    };
    for (let k = 0; k < 5; k++) walk((r() - 0.5) * 1.4, (r() - 0.5) * 1.6, r() * TAU, 7, 0);
  }

  // js/usaciv/render/art/water.js
  var WATER_OCEAN = 1;
  var WATER_COAST = 2;
  var WATER_LAKE = 3;
  var LAKE_RGB = [64, 146, 202];
  var LAKE_CSS = `rgb(${LAKE_RGB.join(",")})`;
  var lastOceanPatterns = null;
  var shoreCache = /* @__PURE__ */ new WeakMap();
  function shoreInfo(w) {
    let info = shoreCache.get(w);
    if (info && info.water === w.water) return info;
    const { grid, water } = w;
    const n = grid.size;
    const mask = new Uint8Array(n), dist = new Uint8Array(n);
    let front = [];
    for (let i = 0; i < n; i++) {
      if (!water[i]) continue;
      let m = 0;
      for (let d = 0; d < 6; d++) {
        const j = grid.neighbour(i, d);
        if (j >= 0 && !water[j]) m |= 1 << d;
      }
      mask[i] = m;
      if (m) {
        dist[i] = 1;
        front.push(i);
      }
    }
    for (let step = 2; step <= 4 && front.length; step++) {
      const next = [];
      for (const i of front) {
        for (let d = 0; d < 6; d++) {
          const j = grid.neighbour(i, d);
          if (j >= 0 && water[j] && !dist[j]) {
            dist[j] = step;
            next.push(j);
          }
        }
      }
      front = next;
    }
    for (let i = 0; i < n; i++) if (water[i] && !dist[i]) dist[i] = 4;
    info = { water, mask, dist };
    shoreCache.set(w, info);
    return info;
  }
  function drawWaterGlyphs(ctx, cells, w, opts = {}) {
    const { grid, water } = w;
    const R2 = grid.R;
    const s = opts.s ?? 1;
    const Rpx = opts.Rpx ?? R2 * s;
    const lod = opts.lod ?? lodFor(Rpx);
    const { dist } = shoreInfo(w);
    const px = (v) => v / s;
    const lakes = new Path2D(), shelf = new Path2D();
    const drawn = cells instanceof Set ? cells : new Set(cells);
    const deep = [];
    const crests = new Path2D(), glints = new Path2D();
    let nLake = 0, nShelf = 0, nCrest = 0, nGlint = 0;
    const near = atLeast(lod, "near"), close = lod === "close";
    const K = grid.corners;
    for (const i of cells) {
      const wt = water[i];
      if (!wt) continue;
      const x = grid.cx(i), y = grid.cy(i);
      if (wt === WATER_LAKE) {
        lakes.moveTo(x + K[0][0] * 1.03, y + K[0][1] * 1.03);
        for (let k = 1; k < 6; k++) lakes.lineTo(x + K[k][0] * 1.03, y + K[k][1] * 1.03);
        lakes.closePath();
        nLake++;
        if (dist[i] >= 2) deep.push(x, y, dist[i] >= 3 ? 0.22 : 0.13);
      }
      if (wt === WATER_COAST) {
        for (let d = 0; d < 6; d++) {
          const j = grid.neighbour(i, d);
          if (j < 0 || water[j] !== WATER_OCEAN) continue;
          if (!drawn.has(j)) continue;
          shelf.moveTo(x + K[d][0], y + K[d][1]);
          shelf.lineTo(x + K[(d + 1) % 6][0], y + K[(d + 1) % 6][1]);
          nShelf++;
        }
      }
      if (near && dist[i] >= 2) {
        const nC = close ? hash01(i, 301) < 0.3 ? 2 : 1 : 1;
        const p = close ? 0.62 : 0.42;
        for (let k = 0; k < nC; k++) {
          if (hash01(i, 302 + k) > p) continue;
          const cx = x + (hash01(i, 310 + k) - 0.5) * R2 * 1;
          const cy = y + (hash01(i, 320 + k) - 0.5) * R2 * 0.9;
          const wl = R2 * (wt === WATER_LAKE ? 0.16 : 0.24) * (0.75 + hash01(i, 330 + k) * 0.5);
          if (hash01(i, 340 + k) < 0.5) {
            crests.moveTo(cx - wl / 2, cy + wl * 0.06);
            crests.quadraticCurveTo(cx, cy - wl * 0.28, cx + wl / 2, cy + wl * 0.06);
          } else {
            crests.moveTo(cx - wl / 2, cy);
            crests.quadraticCurveTo(cx - wl / 4, cy - wl * 0.2, cx, cy);
            crests.quadraticCurveTo(cx + wl / 4, cy - wl * 0.2, cx + wl / 2, cy);
          }
          nCrest++;
        }
      }
      if (close && hash01(i, 350) < (wt === WATER_LAKE ? 0.22 : 0.1)) {
        const gx = x + (hash01(i, 351) - 0.5) * R2 * 0.9, gy = y + (hash01(i, 352) - 0.5) * R2 * 0.8;
        const gr = px(2.2 + hash01(i, 353) * 1.6);
        glints.moveTo(gx - gr, gy);
        glints.quadraticCurveTo(gx, gy, gx, gy - gr * 0.7);
        glints.quadraticCurveTo(gx, gy, gx + gr, gy);
        glints.quadraticCurveTo(gx, gy, gx, gy + gr * 0.7);
        glints.quadraticCurveTo(gx, gy, gx - gr, gy);
        nGlint++;
      }
    }
    if (nLake) {
      ctx.fillStyle = LAKE_CSS;
      ctx.fill(lakes);
      const patterns2 = lastOceanPatterns;
      if (patterns2?.ctx === ctx) {
        ctx.save();
        ctx.clip(lakes);
        const m = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = patterns2.mottle;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = Rpx < 6 ? 0.35 : Rpx < 10 ? 0.45 : 0.6;
        ctx.fillStyle = patterns2.waves;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.setTransform(m);
        ctx.restore();
      }
    }
    if (deep.length) {
      const spr = blobSprite(R2 * deviceScale(ctx));
      for (let k = 0; k < deep.length; k += 3) {
        ctx.globalAlpha = deep[k + 2];
        drawSprite(ctx, spr, deep[k], deep[k + 1], R2);
      }
      ctx.globalAlpha = 1;
    }
    if (nShelf) {
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(110,185,220,.06)";
      ctx.lineWidth = R2 * 0.55;
      ctx.stroke(shelf);
      ctx.strokeStyle = "rgba(130,200,230,.06)";
      ctx.lineWidth = R2 * 0.25;
      ctx.stroke(shelf);
    }
    if (nCrest) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const lw = Math.min(px(close ? 1.5 : 1.15), R2 * 0.04);
      ctx.save();
      ctx.translate(0, px(1.1));
      ctx.strokeStyle = "rgba(3,20,38,.32)";
      ctx.lineWidth = lw * 1.2;
      ctx.stroke(crests);
      ctx.restore();
      ctx.strokeStyle = "rgba(205,236,252,.42)";
      ctx.lineWidth = lw;
      ctx.stroke(crests);
    }
    if (nGlint) {
      ctx.fillStyle = "rgba(240,250,255,.75)";
      ctx.fill(glints);
    }
  }
  function blobSprite(devPerR) {
    const upx = bucketPx(devPerR, { min: 4, max: 48 });
    return getSprite("water:depth-blob", upx, { x0: -1.6, y0: -1.6, x1: 1.6, y1: 1.6 }, (g) => {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1.6);
      gr.addColorStop(0, "rgba(14,52,96,1)");
      gr.addColorStop(0.45, "rgba(14,52,96,.6)");
      gr.addColorStop(1, "rgba(14,52,96,0)");
      g.fillStyle = gr;
      g.fillRect(-1.6, -1.6, 3.2, 3.2);
    });
  }

  // js/civ-terrain.js
  var R = 1 / Math.sqrt(3);
  var UNIT = R / 25;
  var CALIFORNIA = [77, 148, 90];
  function terrainGrid({ cols, rows, col0, row0, present }) {
    const native = makeGrid({ radius: 25, cols, rows });
    return {
      ...native,
      cx: (j) => native.cx(j) + col0 * native.W,
      cy: (j) => native.cy(j) + row0 * native.H,
      cellAt(x, y) {
        const j = native.cellAt(x - col0 * native.W, y - row0 * native.H);
        return j >= 0 && present[j] ? j : -1;
      },
      neighbour(j, d) {
        const k = native.neighbour(j, d);
        return k >= 0 && present[k] ? k : -1;
      }
    };
  }
  function paintCivTerrain(ctx, cells, world, scale, water, pixelRatio) {
    const Rpx = R * scale;
    ctx.save();
    ctx.scale(UNIT, UNIT);
    drawTerrainGlyphs(ctx, cells, world, { Rpx, s: scale * UNIT, pixelRatio });
    if (water && cells.some((j) => world.water[j])) {
      drawWaterGlyphs(ctx, cells, world, { Rpx, s: scale * UNIT });
    }
    ctx.restore();
    for (const j of cells) {
      const city = world.cityByCell.get(j);
      if (!city || cityIsDot(city, Rpx)) continue;
      const seed = city.source ? j : j % 37;
      drawCityTile(
        ctx,
        city,
        world.grid.cx(j) * UNIT,
        world.grid.cy(j) * UNIT,
        R,
        { Rpx, s: scale, seed, stateColor: CALIFORNIA }
      );
    }
  }

  // js/terrain-worker.js
  var land;
  var settled;
  var surface;
  self.onmessage = ({ data }) => {
    if (data.layout) {
      land = { ...data.world, grid: terrainGrid(data.layout) };
      settled = { ...land, cityByCell: new Map(land.cityByCell) };
      for (const [cell, city] of data.places) settled.cityByCell.set(cell, city);
      return;
    }
    const { view, cells, places, water } = data;
    if (!surface) surface = new OffscreenCanvas(view.width, view.height);
    if (surface.width !== view.width) surface.width = view.width;
    if (surface.height !== view.height) surface.height = view.height;
    const ctx = surface.getContext("2d");
    const px = view.s * view.dpr;
    ctx.setTransform(px, 0, 0, px, -view.x0 * px, -view.y0 * px);
    paintCivTerrain(ctx, cells, places ? settled : land, view.s, water, view.dpr);
    const image = surface.transferToImageBitmap();
    self.postMessage(image, [image]);
  };
})();
