// Sites on hexes: military installations as forts, restricted ground (the big training and test ranges), wonder
// tiles (national parks, research universities, landmarks), protected land around big parks, and wonder plaques.
// All original art drawn in code; painted once per (kind, size bucket) into sprites (render/art/sprites.js) and
// stamped into the CACHED static map by ext/layers/ (never per frame).
//
//   FORT_KINDS, fortKind(component) → "army" | "navy" | "air" | "marines" | "guard" | "air_guard" | "reserve" | "other"
//   drawFort(ctx, kind, x, y, size, {tier, joint, muted, coastal})   size = glyph width in ctx user units
//   drawRestricted(ctx, hatch, vp, o)                            hatched hexes + dashed boundary (see prepareCellSet)
//   prepareCellSet(w, cells) → {path: Path2D, edges: Path2D, bbox}   hex area and its outer boundary, world km
//   drawProtected(ctx, set, vp, o)                               protected land: soft green wash + dotted boundary
//   WONDER_KINDS, WONDER_MOTIFS, MOTIF_LABELS, drawWonder(ctx, kind, x, y, size, {rank, motif, variant})
//   drawPlaque(ctx, text, x, y, {kind, sub, scale})              screen-space name plate (css px)
import { bucketPx, deviceScale, getSprite, drawSprite, makePattern } from "./sprites.js";

const TAU = Math.PI * 2;

function stamp(ctx, key, x, y, size, box, paint) {
  const k = size / 2;
  const upx = bucketPx(deviceScale(ctx) * k, { min: 3, max: 220 });
  const spr = getSprite(key, upx, box, paint);
  drawSprite(ctx, spr, x, y, k);
}

function ink(g, upx, wPx = 1.1, col = "rgba(28,20,10,.92)") {
  g.lineWidth = wPx / upx;
  g.strokeStyle = col;
  g.stroke();
}

function groundShadow(g, y = 0.72, rx = 0.95, ry = 0.24, a = 0.3) {
  g.fillStyle = `rgba(18,12,4,${a})`;
  g.beginPath();
  g.ellipse(0, y, rx, ry, 0, 0, TAU);
  g.fill();
}

function star(g, x, y, r, n = 5, inner = 0.45, rot = -Math.PI / 2) {
  for (let k = 0; k < n * 2; k++) {
    const a = rot + (k * Math.PI) / n;
    const rr = k % 2 ? r * inner : r;
    k ? g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : g.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  g.closePath();
}

function flag(g, upx, x, y, h, col) {
  g.strokeStyle = "#3a2c1c";
  g.lineWidth = Math.max(1 / upx, 0.05);
  g.beginPath();
  g.moveTo(x, y); g.lineTo(x, y - h);
  g.stroke();
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y - h); g.quadraticCurveTo(x + 0.22, y - h - 0.05, x + 0.4, y - h + 0.05);
  g.lineTo(x + 0.4, y - h + 0.25); g.quadraticCurveTo(x + 0.22, y - h + 0.18, x, y - h + 0.22);
  g.closePath();
  g.fill();
  ink(g, upx, 0.8);
}

// --- forts ----------------------------------------------------------------------------------------------------------

/** Component palettes: walls, roof / accent, flag. */
export const FORT_KINDS = {
  army: { name: "Army", wall: "#a8966a", accent: "#5f6b3a", flag: "#e0b44a", pad: "rgba(96,108,58,.72)" },
  navy: { name: "Navy", wall: "#98a4b2", accent: "#22406a", flag: "#e8e2d0", pad: "rgba(34,64,106,.62)" },
  air: { name: "Air Force & Space Force", wall: "#b2bac4", accent: "#3a6aa8", flag: "#9cc4ec", pad: "rgba(58,106,168,.55)" },
  marines: { name: "Marine Corps", wall: "#b0946e", accent: "#8a2a2a", flag: "#e2b84a", pad: "rgba(138,42,42,.6)" },
  guard: { name: "Army National Guard", wall: "#a8a28c", accent: "#6a6a52", flag: "#cfc3a0", pad: "rgba(110,110,84,.55)" },
  air_guard: { name: "Air National Guard", wall: "#aeb0b2", accent: "#5a6a7a", flag: "#b9c8d8", pad: "rgba(90,106,122,.55)" },
  reserve: { name: "Reserve", wall: "#a49e92", accent: "#6a6258", flag: "#d8cfba", pad: "rgba(106,98,88,.5)" },
  other: { name: "Defense agency", wall: "#a2a2a2", accent: "#4a4a5a", flag: "#d0d0d0", pad: "rgba(74,74,90,.5)" },
};

/** military.json component id → a fort kind above. */
export function fortKind(component) {
  switch (component) {
    case "army": return "army";
    case "navy": return "navy";
    case "air_force": return "air";
    case "marines": return "marines";
    case "army_guard": return "guard";
    case "air_guard": return "air_guard";
    case "army_reserve": case "navy_reserve": case "air_force_reserve": case "marine_reserve": return "reserve";
    default: return "other";
  }
}

/**
 * A fort glyph by component: Army = a star fort with bastions; Navy = a sea wall and quay with an anchor; Air = a
 * hangar and airstrip with a winged roundel; Marines = a palisade with a chevron banner; Guard / Reserve = a smaller
 * muted blockhouse. tier "major" adds a keep and a flag, "site" is a small outpost. joint = a gold ring at the base.
 */
export function drawFort(ctx, kind, x, y, size, { tier = "base", joint = false, muted = false, coastal = true, airfield = false } = {}) {
  // a Navy or Marine Corps air station is an airfield with the service's roundel, not a quay or a palisade
  const air = airfield && (kind === "navy" || kind === "marines") ? 1 : 0;
  const sea = kind === "navy" && coastal && !air ? 1 : 0;
  const key = `site:fort:${kind}:${tier}:${joint ? 1 : 0}:${muted ? 1 : 0}:${sea}:${air}`;
  stamp(ctx, key, x, y, size, { x0: -1.25, y0: -1.35, x1: 1.25, y1: 1.15 }, (g, upx) => paintFort(g, upx, kind, tier, joint, muted, !!sea, !!air));
}

/** True when a military.json installation name is an air station or airfield (NAS, MCAS, outlying field …). */
export function isAirfieldName(name) {
  if (/\bAnnex\b/i.test(name || "")) return false; // e.g. Oceana's Dam Neck Annex is a training site, not a field
  return /\bAir Station\b|\bNAS\b|\bMCAS\b|\bAir Facility\b|\bALF\b|\bN?OLF\b|Outlying (Landing )?Field|Air Field\b|Airfield\b/i.test(name || "");
}

function paintFort(g, upx, kind, tier, joint, muted, sea, air = false) {
  const pal = FORT_KINDS[kind] || FORT_KINDS.other;
  const small = tier === "site";
  const k = small ? 0.72 : 1;
  if (muted) g.globalAlpha = 0.85;
  groundShadow(g, 0.62, 1.0 * k, 0.26 * k);
  // a component-tinted ground pad, so the fort reads on any terrain (like a district plate)
  g.beginPath();
  g.ellipse(0, 0.42, 1.04 * k, 0.4 * k, 0, 0, TAU);
  g.fillStyle = pal.pad;
  g.fill();
  ink(g, upx, 0.9, "rgba(30,20,10,.55)");
  if (joint) {
    g.beginPath();
    g.ellipse(0, 0.45, 1.08 * k, 0.42 * k, 0, 0, TAU);
    g.lineWidth = Math.max(1.6 / upx, 0.1);
    g.strokeStyle = "#e6c46a";
    g.stroke();
    ink(g, upx, 0.7, "rgba(80,56,10,.8)");
  }
  g.save();
  g.scale(k, k);
  if (air) paintAirBase(g, upx / k, pal, tier, "anchor");
  else if (kind === "army" || kind === "other") paintStarFort(g, upx / k, pal, tier);
  else if (kind === "navy") paintNavalFort(g, upx / k, pal, tier, sea);
  else if (kind === "air" || kind === "air_guard") paintAirBase(g, upx / k, pal, tier);
  else if (kind === "marines") paintPalisade(g, upx / k, pal, tier, true);
  else paintPalisade(g, upx / k, pal, tier, false);
  g.restore();
  g.globalAlpha = 1;
}

function paintStarFort(g, upx, pal, tier) {
  // a five-bastion star fort seen at an angle (squashed vertically)
  g.save();
  g.translate(0, 0.25);
  g.scale(1, 0.62);
  g.beginPath();
  star(g, 0, 0, 1.0, 5, 0.62, -Math.PI / 2);
  g.fillStyle = "#6f6248";
  g.fill();
  g.restore();
  g.save();
  g.translate(0, 0.12);
  g.scale(1, 0.62);
  g.beginPath();
  star(g, 0, 0, 1.0, 5, 0.62, -Math.PI / 2);
  g.fillStyle = pal.wall;
  g.fill();
  ink(g, upx / 0.62 * 0.8, 1.1);
  // inner parade ground
  g.beginPath();
  star(g, 0, 0, 0.6, 5, 0.7, -Math.PI / 2);
  g.fillStyle = "#b9a878";
  g.fill();
  g.restore();
  // barracks blocks
  g.fillStyle = pal.accent;
  for (const [bx, by] of [[-0.3, 0.02], [0.08, 0.18]]) {
    g.beginPath();
    g.rect(bx, by - 0.14, 0.26, 0.14);
    g.fill();
    ink(g, upx, 0.8);
  }
  if (tier === "major") {
    // keep
    g.fillStyle = pal.wall;
    g.beginPath();
    g.rect(-0.18, -0.42, 0.36, 0.42);
    g.fill();
    ink(g, upx, 1);
    g.fillStyle = "#3a3020";
    for (let c = 0; c < 3; c++) g.fillRect(-0.18 + c * 0.14, -0.5, 0.08, 0.08);
    flag(g, upx, 0, -0.5, 0.7, pal.flag);
  } else {
    flag(g, upx, 0.05, 0.0, 0.62, pal.flag);
  }
}

function paintNavalFort(g, upx, pal, tier, sea) {
  // water in front (inland sites: a paved yard), a stone quay wall, a slipway shed and an anchor emblem
  g.fillStyle = sea ? "#3f7fa6" : "#8a8a86";
  g.beginPath();
  g.moveTo(-1.1, 0.5); g.lineTo(1.1, 0.5); g.lineTo(1.0, 0.95); g.lineTo(-1.0, 0.95); g.closePath();
  g.fill();
  g.fillStyle = pal.wall;
  g.beginPath();
  g.moveTo(-1.0, 0.52); g.lineTo(-0.9, 0.12); g.lineTo(0.9, 0.12); g.lineTo(1.0, 0.52); g.closePath();
  g.fill();
  ink(g, upx, 1);
  g.strokeStyle = "rgba(40,40,50,.45)";
  g.lineWidth = 0.8 / upx;
  g.beginPath();
  g.moveTo(-0.95, 0.32); g.lineTo(0.95, 0.32);
  for (let x = -0.7; x < 0.9; x += 0.3) { g.moveTo(x, 0.12); g.lineTo(x, 0.32); g.moveTo(x + 0.15, 0.32); g.lineTo(x + 0.15, 0.52); }
  g.stroke();
  // shed with a pitched roof
  g.fillStyle = "#d8d2c4";
  g.beginPath();
  g.rect(-0.8, -0.28, 0.7, 0.4);
  g.fill();
  ink(g, upx, 1);
  g.fillStyle = pal.accent;
  g.beginPath();
  g.moveTo(-0.86, -0.26); g.lineTo(-0.45, -0.56); g.lineTo(-0.04, -0.26); g.closePath();
  g.fill();
  ink(g, upx, 1);
  // anchor medallion
  g.beginPath();
  g.arc(0.42, -0.18, 0.34, 0, TAU);
  g.fillStyle = pal.accent;
  g.fill();
  ink(g, upx, 1);
  g.strokeStyle = "#f2ead6";
  g.lineWidth = Math.max(1.2 / upx, 0.06);
  g.beginPath();
  g.moveTo(0.42, -0.4); g.lineTo(0.42, 0.04);
  g.moveTo(0.3, -0.3); g.lineTo(0.54, -0.3);
  g.moveTo(0.24, -0.08); g.quadraticCurveTo(0.42, 0.12, 0.6, -0.08);
  g.stroke();
  g.beginPath();
  g.arc(0.42, -0.44, 0.05, 0, TAU);
  g.stroke();
  if (tier === "major" && sea) {
    // a grey warship at the quay
    g.fillStyle = "#6a7480";
    g.beginPath();
    g.moveTo(-0.95, 0.6); g.lineTo(0.75, 0.6); g.lineTo(0.95, 0.56); g.lineTo(0.7, 0.8); g.lineTo(-0.85, 0.8); g.closePath();
    g.fill();
    ink(g, upx, 0.9);
    g.fillStyle = "#8a949e";
    g.beginPath();
    g.rect(-0.35, 0.46, 0.4, 0.14); g.rect(-0.2, 0.36, 0.14, 0.1);
    g.fill();
    ink(g, upx, 0.8);
    flag(g, upx, 0.86, 0.12, 0.6, pal.flag);
  }
}

function paintAirBase(g, upx, pal, tier, emblem = "star") {
  // airstrip, an arched hangar and a winged roundel
  g.save();
  g.translate(0, 0.42);
  g.rotate(-0.12);
  g.fillStyle = "#55585c";
  g.beginPath();
  g.rect(-1.05, -0.11, 2.1, 0.22);
  g.fill();
  ink(g, upx, 0.9);
  g.strokeStyle = "#f2efe4";
  g.lineWidth = 0.9 / upx;
  g.setLineDash([0.14, 0.1]);
  g.beginPath();
  g.moveTo(-0.85, 0); g.lineTo(0.85, 0);
  g.stroke();
  g.setLineDash([]);
  g.restore();
  // hangar
  g.fillStyle = pal.wall;
  g.beginPath();
  g.moveTo(-0.95, 0.2); g.lineTo(-0.95, -0.05); g.bezierCurveTo(-0.9, -0.52, -0.1, -0.52, -0.05, -0.05); g.lineTo(-0.05, 0.2);
  g.closePath();
  g.fill();
  ink(g, upx, 1);
  g.fillStyle = "#3a3c40";
  g.beginPath();
  g.rect(-0.72, -0.04, 0.44, 0.24);
  g.fill();
  // winged roundel
  g.fillStyle = pal.accent;
  g.beginPath();
  g.moveTo(0.05, -0.3); g.lineTo(0.98, -0.42); g.lineTo(0.9, -0.28); g.lineTo(0.55, -0.16); g.lineTo(0.05, -0.16); g.closePath();
  g.fill();
  ink(g, upx, 0.9);
  g.beginPath();
  g.arc(0.42, -0.24, 0.24, 0, TAU);
  g.fillStyle = "#f2ead6";
  g.fill();
  ink(g, upx, 0.9);
  if (emblem === "anchor") {
    // a small anchor in the roundel (Navy / Marine Corps aviation)
    g.strokeStyle = pal.accent;
    g.lineWidth = Math.max(1.2 / upx, 0.045);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0.42, -0.38); g.lineTo(0.42, -0.1);
    g.moveTo(0.34, -0.31); g.lineTo(0.5, -0.31);
    g.moveTo(0.3, -0.18); g.quadraticCurveTo(0.42, -0.04, 0.54, -0.18);
    g.stroke();
    g.lineCap = "butt";
  } else {
    g.beginPath();
    star(g, 0.42, -0.24, 0.17, 5, 0.42);
    g.fillStyle = pal.accent;
    g.fill();
  }
  if (tier === "major") {
    // a parked jet
    g.save();
    g.translate(0.55, 0.18);
    g.rotate(-0.2);
    g.fillStyle = "#c8ccd2";
    g.beginPath();
    g.moveTo(0.38, 0); g.lineTo(-0.3, -0.05); g.lineTo(-0.1, -0.3); g.lineTo(-0.2, -0.3); g.lineTo(-0.42, -0.05);
    g.lineTo(-0.5, -0.14); g.lineTo(-0.56, -0.14); g.lineTo(-0.5, 0); g.lineTo(-0.56, 0.14); g.lineTo(-0.5, 0.14);
    g.lineTo(-0.42, 0.05); g.lineTo(-0.2, 0.3); g.lineTo(-0.1, 0.3); g.lineTo(-0.3, 0.05); g.closePath();
    g.fill();
    ink(g, upx, 0.8);
    g.restore();
  }
}

function paintPalisade(g, upx, pal, tier, chevron) {
  // a timber palisade ring around a blockhouse (Marines get a chevron banner, Guard / Reserve a plain pennant)
  g.save();
  g.translate(0, 0.25);
  g.scale(1, 0.5);
  g.beginPath();
  g.arc(0, 0, 0.92, 0, TAU);
  g.fillStyle = "#8a7656";
  g.fill();
  ink(g, upx / 0.5 * 0.7, 1);
  g.beginPath();
  g.arc(0, -0.1, 0.72, 0, TAU);
  g.fillStyle = "#b7a47a";
  g.fill();
  g.restore();
  // stakes along the front arc
  g.fillStyle = "#6a4e2e";
  for (let a = 0.15; a < Math.PI - 0.1; a += 0.22) {
    const sx = Math.cos(a) * 0.92, sy = 0.25 + Math.sin(a) * 0.46;
    g.beginPath();
    g.moveTo(sx - 0.05, sy); g.lineTo(sx - 0.05, sy - 0.2); g.lineTo(sx, sy - 0.27); g.lineTo(sx + 0.05, sy - 0.2); g.lineTo(sx + 0.05, sy);
    g.closePath();
    g.fill();
  }
  // blockhouse
  g.fillStyle = pal.wall;
  g.beginPath();
  g.rect(-0.32, -0.25, 0.64, 0.42);
  g.fill();
  ink(g, upx, 1);
  g.fillStyle = pal.accent;
  g.beginPath();
  g.moveTo(-0.4, -0.22); g.lineTo(0, -0.52); g.lineTo(0.4, -0.22); g.closePath();
  g.fill();
  ink(g, upx, 1);
  g.fillStyle = "#2e2618";
  g.fillRect(-0.07, -0.05, 0.14, 0.22);
  if (chevron) {
    // banner with a chevron
    g.strokeStyle = "#3a2c1c";
    g.lineWidth = Math.max(1 / upx, 0.05);
    g.beginPath(); g.moveTo(0.6, 0.2); g.lineTo(0.6, -0.75); g.stroke();
    g.fillStyle = pal.accent;
    g.beginPath();
    g.moveTo(0.6, -0.75); g.lineTo(1.02, -0.75); g.lineTo(1.02, -0.28); g.lineTo(0.81, -0.4); g.lineTo(0.6, -0.28); g.closePath();
    g.fill();
    ink(g, upx, 0.8);
    g.strokeStyle = pal.flag;
    g.lineWidth = Math.max(1.2 / upx, 0.06);
    g.beginPath(); g.moveTo(0.66, -0.62); g.lineTo(0.81, -0.52); g.lineTo(0.96, -0.62); g.stroke();
  } else {
    flag(g, upx, 0.55, 0.15, tier === "major" ? 0.85 : 0.65, pal.flag);
  }
}

// --- restricted ground and protected land ------------------------------------------------------------------------

/** A set of hexes as a fill path and its outer boundary (edges whose neighbour is outside the set), world km. */
export function prepareCellSet(w, cells) {
  const { grid } = w;
  const set = new Set(cells);
  const path = new Path2D(), edges = new Path2D();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const C = grid.corners;
  for (const i of set) {
    const x = grid.cx(i), y = grid.cy(i);
    path.moveTo(x + C[0][0], y + C[0][1]);
    for (let k = 1; k < 6; k++) path.lineTo(x + C[k][0], y + C[k][1]);
    path.closePath();
    for (let d = 0; d < 6; d++) {
      const j = grid.neighbour(i, d);
      if (j >= 0 && set.has(j)) continue;
      // edge d runs from corner d to corner d+1
      edges.moveTo(x + C[d][0], y + C[d][1]);
      edges.lineTo(x + C[(d + 1) % 6][0], y + C[(d + 1) % 6][1]);
    }
    x0 = Math.min(x0, x - grid.R); y0 = Math.min(y0, y - grid.R);
    x1 = Math.max(x1, x + grid.R); y1 = Math.max(y1, y + grid.R);
  }
  return { path, edges, bbox: [x0, y0, x1, y1], cells: set };
}

const inView = (b, vp, pad) => !(b[2] < vp.x0 - pad || b[0] > vp.x1 + pad || b[3] < vp.y0 - pad || b[1] > vp.y1 + pad);

function hatchPattern(ctx, dpr, s) {
  const p = makePattern(ctx, "site:hatch", 10, dpr, (g, n) => {
    g.strokeStyle = "rgba(120,30,20,.55)";
    g.lineWidth = 1.6;
    g.lineCap = "butt";
    for (const o of [-n, 0, n]) {
      g.beginPath();
      g.moveTo(o, n); g.lineTo(o + n, 0);
      g.stroke();
    }
  });
  // the tile is in css px; the context is in km: scale the pattern so the hatching stays 10 css px apart
  try { p.setTransform(new DOMMatrix().scale(1 / s)); } catch { /* old browsers: hatching scales with the map */ }
  return p;
}

/**
 * Restricted ground: diagonal red-brown hatching over the hexes of each range, a faint wash and a dashed boundary
 * (world transform). sets: from prepareCellSet.
 */
export function drawRestricted(ctx, sets, vp, o) {
  const s = vp.s;
  const pad = 2 * (o.Rpx / s);
  const vis = sets.filter((st) => inView(st.bbox, vp, pad));
  if (!vis.length) return;
  ctx.fillStyle = "rgba(150,60,40,.12)";
  for (const st of vis) ctx.fill(st.path);
  if (o.Rpx >= 5) {
    ctx.fillStyle = hatchPattern(ctx, vp.dpr, s);
    for (const st of vis) ctx.fill(st.path);
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(40,10,6,.45)";
  ctx.lineWidth = Math.max(1.6, Math.min(3.4, o.Rpx * 0.1)) / s;
  for (const st of vis) ctx.stroke(st.edges);
  ctx.strokeStyle = "rgba(214,92,62,.9)";
  ctx.lineWidth = Math.max(1, Math.min(2.2, o.Rpx * 0.06)) / s;
  ctx.setLineDash([5 / s, 3.5 / s]);
  for (const st of vis) ctx.stroke(st.edges);
  ctx.setLineDash([]);
}

/** Protected land (big national parks): a soft green wash and a dotted pale-green boundary. */
export function drawProtected(ctx, sets, vp, o) {
  const s = vp.s;
  const pad = 2 * (o.Rpx / s);
  const vis = sets.filter((st) => inView(st.bbox, vp, pad));
  if (!vis.length) return;
  ctx.fillStyle = "rgba(90,170,90,.14)";
  for (const st of vis) ctx.fill(st.path);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(10,40,10,.35)";
  ctx.lineWidth = Math.max(1.4, Math.min(3, o.Rpx * 0.09)) / s;
  for (const st of vis) ctx.stroke(st.edges);
  ctx.strokeStyle = "rgba(170,230,150,.9)";
  ctx.lineWidth = Math.max(1, Math.min(2.2, o.Rpx * 0.06)) / s;
  ctx.setLineDash([0.1 / s, 4 / s]);
  ctx.lineWidth = Math.max(1.8, Math.min(3.2, o.Rpx * 0.08)) / s;
  for (const st of vis) ctx.stroke(st.edges);
  ctx.setLineDash([]);
}

// --- wonders --------------------------------------------------------------------------------------------------------

export const WONDER_KINDS = {
  natural: { name: "Natural wonder", ring: "#8fd07a", base: "#3f6a34", icon: "w-park" },
  university: { name: "Great university", ring: "#8fb8ec", base: "#2c4a78", icon: "w-university" },
  landmark: { name: "Landmark", ring: "#ecc46a", base: "#6a4a1c", icon: "w-landmark" },
};

/**
 * Wonder motifs: what stands on the plinth. Each wonder gets the motif that says what the site is (ext/layers/model.js
 * maps wonder ids to motifs); `variant` only picks a fallback for an id it does not know.
 */
export const WONDER_MOTIFS = {
  natural: ["peak", "canyon", "forest", "desert", "geyser", "coast", "bridge", "dam", "arch", "obelisk"],
  university: ["hall", "redhall", "spire"],
  landmark: ["statue", "mission", "gantry", "mound", "adobe", "ballpark", "brickhall", "rotunda", "carved", "quarter", "flight", "spike", "dam", "obelisk", "arch", "memorial"],
};
export const MOTIF_LABELS = {
  peak: "Snow peak", canyon: "Canyon", forest: "Forest", desert: "Desert", geyser: "Hot springs & geysers", coast: "Coast & lighthouse",
  bridge: "Bridge", dam: "Dam", arch: "Steel arch", obelisk: "Obelisk", hall: "Domed hall", redhall: "Domed hall (red)",
  spire: "Bell tower", statue: "Statue", mission: "Mission", gantry: "Launch tower", mound: "Earth mound", adobe: "Pueblo",
  ballpark: "Ballpark", brickhall: "Brick hall", rotunda: "Rotunda", carved: "Carved mountain", quarter: "Old quarter",
  flight: "First flight", spike: "Golden spike", memorial: "Memorial arch",
};
const FALLBACK = { natural: ["peak", "forest", "canyon"], university: ["hall", "redhall", "spire"], landmark: ["obelisk", "memorial", "rotunda"] };

/**
 * A wonder tile: a raised round plinth with a gold rim (the wonder "seal"), and the wonder itself on top, drawn from
 * its `motif` (see WONDER_MOTIFS). Without a motif, `variant` picks one of three generic ones for the kind.
 */
export function drawWonder(ctx, kind, x, y, size, { variant = 0, rank = null, motif = null } = {}) {
  const fb = FALLBACK[kind] || FALLBACK.landmark;
  const mo = motif && MOTIF_LABELS[motif] ? motif : fb[((variant % 3) + 3) % 3];
  const top = rank != null && rank <= 3 ? 1 : 0;
  stamp(ctx, `site:wonder:${kind}:${mo}:${top}`, x, y, size, { x0: -1.2, y0: -1.45, x1: 1.2, y1: 1.1 }, (g, upx) => paintWonder(g, upx, kind, mo, top));
}

function plinth(g, upx, pal, top) {
  groundShadow(g, 0.66, 1.05, 0.3, 0.35);
  // drum
  g.fillStyle = "#5a4a32";
  g.beginPath();
  g.ellipse(0, 0.5, 0.98, 0.34, 0, 0, Math.PI);
  g.lineTo(-0.98, 0.36);
  g.ellipse(0, 0.36, 0.98, 0.34, 0, Math.PI, 0, true);
  g.closePath();
  g.fill();
  ink(g, upx, 1);
  g.beginPath();
  g.ellipse(0, 0.36, 0.98, 0.34, 0, 0, TAU);
  g.fillStyle = pal.base;
  g.fill();
  g.lineWidth = Math.max(1.6 / upx, top ? 0.09 : 0.06);
  g.strokeStyle = top ? "#f2d27a" : "#c9a45c";
  g.stroke();
  ink(g, upx, 0.7, "rgba(40,26,6,.8)");
}

function paintWonder(g, upx, kind, motif, top) {
  const pal = WONDER_KINDS[kind] || WONDER_KINDS.landmark;
  plinth(g, upx, pal, top);
  (MOTIF_PAINT[motif] || MOTIF_PAINT.obelisk)(g, upx);
  if (top) {
    // a small gold star for the top three of a rule
    g.beginPath();
    star(g, 0.82, -1.18, 0.2, 5, 0.45);
    g.fillStyle = "#f2d27a";
    g.fill();
    ink(g, upx, 0.8, "rgba(60,40,6,.9)");
  }
}

function pine(g, upx, x, y, h, col = "#2f5a32") {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y - h); g.lineTo(x + h * 0.32, y - h * 0.35); g.lineTo(x + h * 0.18, y - h * 0.35); g.lineTo(x + h * 0.38, y);
  g.lineTo(x - h * 0.38, y); g.lineTo(x - h * 0.18, y - h * 0.35); g.lineTo(x - h * 0.32, y - h * 0.35); g.closePath();
  g.fill();
  ink(g, upx, 0.8);
}

function paintPeak(g, upx) {
  // mountain
  g.fillStyle = "#7a8494";
  g.beginPath();
  g.moveTo(-0.92, 0.36); g.lineTo(-0.3, -0.85); g.lineTo(-0.05, -0.45); g.lineTo(0.2, -1.05); g.lineTo(0.92, 0.36); g.closePath();
  g.fill();
  ink(g, upx, 1.1);
  // shaded flank
  g.fillStyle = "rgba(0,0,0,.18)";
  g.beginPath();
  g.moveTo(0.2, -1.05); g.lineTo(0.92, 0.36); g.lineTo(0.3, 0.36); g.lineTo(0.35, -0.4); g.closePath();
  g.fill();
  // snow caps
  g.fillStyle = "#f4f6fa";
  g.beginPath();
  g.moveTo(0.2, -1.05); g.lineTo(0.42, -0.62); g.lineTo(0.3, -0.68); g.lineTo(0.18, -0.58); g.lineTo(0.06, -0.7); g.closePath();
  g.moveTo(-0.3, -0.85); g.lineTo(-0.16, -0.58); g.lineTo(-0.28, -0.63); g.lineTo(-0.4, -0.62); g.closePath();
  g.fill();
  // waterfall
  g.fillStyle = "#cfe8f6";
  g.beginPath();
  g.moveTo(-0.08, -0.35); g.lineTo(0.06, -0.35); g.lineTo(0.12, 0.3); g.lineTo(-0.12, 0.3); g.closePath();
  g.fill();
  g.fillStyle = "#5fa8d8";
  g.beginPath();
  g.ellipse(0, 0.36, 0.32, 0.1, 0, 0, TAU);
  g.fill();
  // pines
  pine(g, upx, -0.62, 0.42, 0.52);
  pine(g, upx, -0.38, 0.48, 0.4, "#3a6a3a");
  pine(g, upx, 0.6, 0.44, 0.5);
}

function paintUniversity(g, upx, v) {
  const stone = "#e8dcc2", shade = "#c8b894", roof = v === 1 ? "#8a3a2a" : v === 2 ? "#4a7650" : "#3e6a8a";
  // main hall
  g.fillStyle = stone;
  g.beginPath();
  g.rect(-0.82, -0.2, 1.3, 0.56);
  g.fill();
  ink(g, upx, 1);
  // portico columns
  g.fillStyle = shade;
  for (let c = 0; c < 5; c++) g.fillRect(-0.68 + c * 0.24, -0.08, 0.08, 0.42);
  // pediment
  g.fillStyle = stone;
  g.beginPath();
  g.moveTo(-0.9, -0.18); g.lineTo(-0.17, -0.52); g.lineTo(0.56, -0.18); g.closePath();
  g.fill();
  ink(g, upx, 1);
  // dome
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(-0.48, -0.42); g.bezierCurveTo(-0.46, -0.95, 0.12, -0.95, 0.14, -0.42); g.closePath();
  g.fill();
  ink(g, upx, 1);
  g.fillStyle = "#f2d27a";
  g.beginPath(); g.arc(-0.17, -0.86, 0.06, 0, TAU); g.fill();
  // bell tower
  g.fillStyle = stone;
  g.beginPath();
  g.rect(0.52, -0.82, 0.3, 1.18);
  g.fill();
  ink(g, upx, 1);
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(0.48, -0.8); g.lineTo(0.67, -1.22); g.lineTo(0.86, -0.8); g.closePath();
  g.fill();
  ink(g, upx, 1);
  g.beginPath(); g.arc(0.67, -0.6, 0.09, 0, TAU);
  g.fillStyle = "#fbf4e0"; g.fill(); ink(g, upx, 0.8);
  g.fillStyle = "#3a2e20";
  g.fillRect(0.62, -0.38, 0.1, 0.16);
  // steps
  g.fillStyle = "#d4c6a6";
  g.fillRect(-0.86, 0.32, 1.38, 0.08);
}

function paintLandmark(g, upx, v) {
  const stone = "#ece2cc";
  if (v === 1) {
    // a tall memorial arch
    g.fillStyle = stone;
    g.beginPath();
    g.moveTo(-0.7, 0.36); g.lineTo(-0.7, -0.72); g.lineTo(0.7, -0.72); g.lineTo(0.7, 0.36);
    g.lineTo(0.3, 0.36); g.lineTo(0.3, -0.1); g.bezierCurveTo(0.3, -0.46, -0.3, -0.46, -0.3, -0.1); g.lineTo(-0.3, 0.36);
    g.closePath();
    g.fill();
    ink(g, upx, 1.1);
    g.fillStyle = "#d6c8a8";
    g.fillRect(-0.76, -0.86, 1.52, 0.16);
    g.strokeStyle = "rgba(28,20,10,.9)";
    g.lineWidth = 1 / upx;
    g.strokeRect(-0.76, -0.86, 1.52, 0.16);
  } else if (v === 2) {
    // a domed rotunda memorial
    g.fillStyle = stone;
    g.beginPath();
    g.rect(-0.72, -0.25, 1.44, 0.6);
    g.fill();
    ink(g, upx, 1);
    g.fillStyle = "#cfc0a0";
    for (let c = 0; c < 6; c++) g.fillRect(-0.62 + c * 0.24, -0.18, 0.08, 0.5);
    g.fillStyle = "#e2d6bc";
    g.beginPath();
    g.moveTo(-0.62, -0.25); g.bezierCurveTo(-0.6, -1.0, 0.6, -1.0, 0.62, -0.25); g.closePath();
    g.fill();
    ink(g, upx, 1);
  } else {
    // an obelisk in front of a low colonnade
    g.fillStyle = "#d8ccb0";
    g.beginPath();
    g.rect(-0.85, -0.05, 1.7, 0.4);
    g.fill();
    ink(g, upx, 0.9);
    g.fillStyle = "#c4b694";
    for (let c = 0; c < 7; c++) g.fillRect(-0.78 + c * 0.24, 0.02, 0.07, 0.3);
    g.fillStyle = stone;
    g.beginPath();
    g.moveTo(-0.14, 0.36); g.lineTo(-0.09, -0.98); g.lineTo(0, -1.12); g.lineTo(0.09, -0.98); g.lineTo(0.14, 0.36); g.closePath();
    g.fill();
    ink(g, upx, 1.1);
    g.fillStyle = "rgba(0,0,0,.14)";
    g.beginPath();
    g.moveTo(0, -1.12); g.lineTo(0.09, -0.98); g.lineTo(0.14, 0.36); g.lineTo(0.02, 0.36); g.closePath();
    g.fill();
  }
}

// --- wonder motifs (all in plinth units: ground at y ≈ 0.36, the top of the box at y = -1.45) -----------------------

function poly(g, pts) {
  g.beginPath();
  for (let k = 0; k < pts.length; k += 2) (k ? g.lineTo : g.moveTo).call(g, pts[k], pts[k + 1]);
  g.closePath();
}
function fillInk(g, upx, fill, w = 1) {
  g.fillStyle = fill;
  g.fill();
  ink(g, upx, w);
}
function roundTree(g, upx, x, y, r, col = "#4f7a3a") {
  g.fillStyle = "#5a3e24";
  g.fillRect(x - r * 0.12, y - r * 0.9, r * 0.24, r * 0.9);
  g.beginPath();
  g.arc(x, y - r * 1.2, r * 0.7, 0, TAU);
  fillInk(g, upx, col, 0.8);
}
function water(g, upx, y0 = 0.2) {
  g.beginPath();
  g.ellipse(0, 0.36, 0.96, 0.33, 0, 0, TAU);
  g.save();
  g.clip();
  g.fillStyle = "#4f9ccc";
  g.fillRect(-1, y0, 2, 1);
  g.strokeStyle = "rgba(230,245,255,.75)";
  g.lineWidth = 0.9 / upx;
  g.beginPath();
  for (const [x, y] of [[-0.6, y0 + 0.14], [0.1, y0 + 0.24], [0.5, y0 + 0.12], [-0.25, y0 + 0.32]]) {
    g.moveTo(x - 0.14, y); g.quadraticCurveTo(x - 0.07, y - 0.05, x, y); g.quadraticCurveTo(x + 0.07, y + 0.05, x + 0.14, y);
  }
  g.stroke();
  g.restore();
}

function paintCanyon(g, upx) {
  // far butte, then two mesas with a gorge and a river between
  poly(g, [-0.2, 0.1, -0.14, -0.86, 0.12, -0.92, 0.18, 0.1]);
  fillInk(g, upx, "#c98256", 0.9);
  const left = [-0.94, 0.36, -0.94, -0.3, -0.84, -0.44, -0.4, -0.44, -0.3, -0.3, -0.24, -0.1, -0.12, 0.36];
  const right = [0.06, 0.36, 0.16, -0.5, 0.26, -0.66, 0.84, -0.66, 0.94, -0.5, 0.94, 0.36];
  for (const pts of [left, right]) {
    poly(g, pts);
    g.fillStyle = "#b85a34";
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = "rgba(255,214,160,.6)";
    g.lineWidth = Math.max(1 / upx, 0.05);
    g.beginPath();
    for (const y of [-0.42, -0.24, -0.04, 0.16]) { g.moveTo(-1, y); g.lineTo(1, y + 0.03); }
    g.stroke();
    g.fillStyle = "rgba(60,20,6,.22)";
    g.fillRect(pts === left ? -0.4 : 0.6, -1, 0.4, 2);
    g.restore();
    poly(g, pts);
    ink(g, upx, 1.1);
  }
  // gorge shadow and river
  poly(g, [-0.12, 0.36, -0.2, -0.05, 0.12, -0.05, 0.06, 0.36]);
  g.fillStyle = "#6a2e18";
  g.fill();
  poly(g, [-0.06, 0.36, -0.03, 0.02, 0.02, 0.02, 0.04, 0.36]);
  g.fillStyle = "#5fa8d8";
  g.fill();
}

function paintForest(g, upx) {
  // a blue-green ridge in the haze, then a valley of pines and broadleaf trees
  g.beginPath();
  g.moveTo(-0.95, 0.3); g.bezierCurveTo(-0.7, -0.6, -0.35, -0.75, -0.05, -0.45); g.bezierCurveTo(0.2, -0.85, 0.65, -0.7, 0.95, 0.1);
  g.lineTo(0.95, 0.36); g.lineTo(-0.95, 0.36); g.closePath();
  fillInk(g, upx, "#5d7f86", 1);
  g.fillStyle = "rgba(236,242,246,.55)";
  g.beginPath(); g.ellipse(0, -0.12, 0.92, 0.13, 0, 0, TAU); g.fill();
  g.beginPath();
  g.moveTo(-0.95, 0.36); g.bezierCurveTo(-0.6, -0.05, -0.2, 0.0, 0.1, 0.08); g.bezierCurveTo(0.45, -0.08, 0.75, -0.02, 0.95, 0.2); g.lineTo(0.95, 0.4); g.lineTo(-0.95, 0.4);
  g.closePath();
  fillInk(g, upx, "#4d7a3c", 0.9);
  roundTree(g, upx, -0.2, 0.36, 0.34, "#c8742e");
  pine(g, upx, -0.66, 0.44, 0.62);
  pine(g, upx, -0.44, 0.48, 0.5, "#3a6a3a");
  roundTree(g, upx, 0.3, 0.42, 0.3, "#5f8f3e");
  pine(g, upx, 0.64, 0.42, 0.66);
  pine(g, upx, 0.06, 0.5, 0.42, "#2a5230");
}

function joshua(g, upx, x, y, h) {
  g.strokeStyle = "#6a4e30";
  g.lineCap = "round";
  g.lineWidth = Math.max(1.6 / upx, h * 0.1);
  g.beginPath();
  g.moveTo(x, y); g.lineTo(x, y - h * 0.55);
  g.moveTo(x, y - h * 0.5); g.quadraticCurveTo(x - h * 0.3, y - h * 0.55, x - h * 0.32, y - h * 0.85);
  g.moveTo(x, y - h * 0.55); g.quadraticCurveTo(x + h * 0.15, y - h * 0.7, x + h * 0.08, y - h * 0.95);
  g.moveTo(x, y - h * 0.45); g.quadraticCurveTo(x + h * 0.35, y - h * 0.45, x + h * 0.4, y - h * 0.7);
  g.stroke();
  for (const [tx, ty] of [[x - h * 0.32, y - h * 0.85], [x + h * 0.08, y - h * 0.95], [x + h * 0.4, y - h * 0.7]]) {
    star(g, tx, ty, h * 0.13, 7, 0.4);
    fillInk(g, upx, "#6f8f3a", 0.7);
  }
}

function paintDesert(g, upx) {
  g.fillStyle = "#f0b04a";
  g.beginPath(); g.arc(0.56, -0.86, 0.2, 0, TAU); g.fill();
  g.beginPath();
  g.moveTo(-0.95, 0.36); g.bezierCurveTo(-0.6, -0.12, -0.25, -0.1, 0.05, 0.08); g.bezierCurveTo(0.35, -0.02, 0.7, -0.08, 0.95, 0.3); g.lineTo(0.95, 0.4); g.lineTo(-0.95, 0.4);
  g.closePath();
  fillInk(g, upx, "#d9b37a", 0.9);
  // granite boulders
  for (const [bx, by, r] of [[0.48, 0.18, 0.22], [0.7, 0.24, 0.15], [-0.62, 0.22, 0.14]]) {
    g.beginPath(); g.ellipse(bx, by, r, r * 0.8, 0, 0, TAU);
    fillInk(g, upx, "#b8916a", 0.8);
  }
  joshua(g, upx, -0.18, 0.4, 1.15);
  joshua(g, upx, 0.32, 0.34, 0.7);
}

function paintGeyser(g, upx) {
  // a pale sinter mound, a rainbow hot pool and a steam plume
  g.beginPath();
  g.moveTo(-0.92, 0.36); g.bezierCurveTo(-0.6, 0.0, 0.6, 0.0, 0.92, 0.36); g.closePath();
  fillInk(g, upx, "#d8ccb4", 0.9);
  g.beginPath(); g.ellipse(-0.42, 0.24, 0.36, 0.1, 0, 0, TAU);
  g.fillStyle = "#e08a3a"; g.fill();
  g.beginPath(); g.ellipse(-0.42, 0.24, 0.27, 0.07, 0, 0, TAU);
  g.fillStyle = "#e8d65a"; g.fill();
  g.beginPath(); g.ellipse(-0.42, 0.24, 0.17, 0.045, 0, 0, TAU);
  g.fillStyle = "#2fa8c4"; g.fill();
  // plume
  const puffs = [[0.3, 0.06, 0.14], [0.28, -0.18, 0.18], [0.34, -0.46, 0.22], [0.24, -0.76, 0.26], [0.36, -1.06, 0.24], [0.16, -1.2, 0.18]];
  g.beginPath();
  for (const [px, py, r] of puffs) { g.moveTo(px + r, py); g.arc(px, py, r, 0, TAU); }
  g.fillStyle = "#f6f8fa";
  g.fill();
  g.lineWidth = 0.9 / upx;
  g.strokeStyle = "rgba(90,100,110,.55)";
  g.stroke();
  g.fillStyle = "rgba(150,165,180,.35)";
  g.beginPath(); g.arc(0.42, -0.5, 0.12, 0, TAU); g.arc(0.32, -0.8, 0.12, 0, TAU); g.fill();
  pine(g, upx, -0.78, 0.42, 0.46);
  pine(g, upx, 0.78, 0.44, 0.5);
}

function paintCoast(g, upx) {
  water(g, upx, 0.24);
  // dune with sea grass
  g.beginPath();
  g.moveTo(-0.95, 0.32); g.bezierCurveTo(-0.6, 0.02, 0.1, 0.0, 0.55, 0.3); g.closePath();
  fillInk(g, upx, "#e2cc96", 0.9);
  g.strokeStyle = "#7a8a3a";
  g.lineWidth = Math.max(0.9 / upx, 0.04);
  g.beginPath();
  for (const x of [-0.7, -0.62, 0.26, 0.34]) { g.moveTo(x, 0.22); g.lineTo(x - 0.05, 0.06); g.moveTo(x, 0.22); g.lineTo(x + 0.05, 0.08); }
  g.stroke();
  // lighthouse
  poly(g, [-0.36, 0.14, -0.28, -0.82, -0.04, -0.82, 0.04, 0.14]);
  g.fillStyle = "#f4f1ea";
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = "#b8402e";
  g.fillRect(-0.4, -0.58, 0.5, 0.16);
  g.fillRect(-0.4, -0.22, 0.5, 0.16);
  g.restore();
  poly(g, [-0.36, 0.14, -0.28, -0.82, -0.04, -0.82, 0.04, 0.14]);
  ink(g, upx, 1);
  g.beginPath(); g.rect(-0.3, -1.02, 0.28, 0.2);
  fillInk(g, upx, "#f2d27a", 0.9);
  poly(g, [-0.36, -1.02, -0.16, -1.22, 0.04, -1.02]);
  fillInk(g, upx, "#3a3430", 0.9);
  // light beams
  g.fillStyle = "rgba(255,236,160,.45)";
  poly(g, [-0.02, -0.96, 0.7, -1.18, 0.7, -0.82]);
  g.fill();
}

function paintBridge(g, upx) {
  water(g, upx, 0.12);
  // headlands
  poly(g, [-0.96, 0.36, -0.96, -0.12, -0.7, -0.2, -0.5, 0.2, -0.5, 0.36]);
  fillInk(g, upx, "#6f8a4a", 0.9);
  poly(g, [0.96, 0.36, 0.96, -0.06, 0.72, -0.14, 0.52, 0.2, 0.52, 0.36]);
  fillInk(g, upx, "#6f8a4a", 0.9);
  const red = "#c0462e";
  // main cable and hangers
  g.strokeStyle = red;
  g.lineWidth = Math.max(1.2 / upx, 0.05);
  g.beginPath();
  g.moveTo(-0.96, -0.02); g.quadraticCurveTo(-0.66, -0.35, -0.44, -0.92); g.quadraticCurveTo(0, 0.0, 0.44, -0.92); g.quadraticCurveTo(0.66, -0.35, 0.96, -0.02);
  g.stroke();
  g.lineWidth = Math.max(0.7 / upx, 0.025);
  g.beginPath();
  for (let k = -3; k <= 3; k++) {
    const x = k * 0.11, t = (x + 0.44) / 0.88, yc = (1 - t) * (1 - t) * -0.92 + 2 * (1 - t) * t * 0 + t * t * -0.92;
    g.moveTo(x, yc); g.lineTo(x, 0.04);
  }
  g.stroke();
  // deck
  g.beginPath(); g.rect(-0.96, 0.02, 1.92, 0.08);
  fillInk(g, upx, red, 0.9);
  // towers
  for (const tx of [-0.44, 0.44]) {
    g.beginPath(); g.rect(tx - 0.08, -1.02, 0.05, 1.24); g.rect(tx + 0.03, -1.02, 0.05, 1.24);
    g.rect(tx - 0.08, -0.98, 0.16, 0.05); g.rect(tx - 0.08, -0.62, 0.16, 0.05); g.rect(tx - 0.08, -0.28, 0.16, 0.05);
    fillInk(g, upx, red, 0.8);
  }
}

function paintDam(g, upx) {
  // canyon walls, the reservoir behind, the curved wall and the river below
  poly(g, [-0.96, 0.36, -0.96, -0.74, -0.56, -0.8, -0.38, 0.36]);
  fillInk(g, upx, "#b8683e", 1);
  poly(g, [0.96, 0.36, 0.96, -0.74, 0.56, -0.8, 0.38, 0.36]);
  fillInk(g, upx, "#a85a34", 1);
  g.beginPath(); g.moveTo(-0.6, -0.62); g.quadraticCurveTo(0, -0.74, 0.6, -0.62); g.lineTo(0.6, -0.5); g.lineTo(-0.6, -0.5); g.closePath();
  g.fillStyle = "#3f8cc0"; g.fill();
  g.beginPath();
  g.moveTo(-0.6, -0.56); g.quadraticCurveTo(0, -0.36, 0.6, -0.56);
  g.lineTo(0.4, 0.3); g.quadraticCurveTo(0, 0.42, -0.4, 0.3); g.closePath();
  g.fillStyle = "#d8d0c0"; g.fill();
  g.save(); g.clip();
  g.fillStyle = "rgba(0,0,0,.12)";
  g.fillRect(0.1, -1, 0.6, 2);
  g.strokeStyle = "rgba(80,70,60,.4)";
  g.lineWidth = 0.8 / upx;
  g.beginPath();
  for (const y of [-0.3, -0.1, 0.1]) { g.moveTo(-0.6, y); g.quadraticCurveTo(0, y + 0.18, 0.6, y); }
  g.stroke();
  g.restore();
  g.beginPath();
  g.moveTo(-0.6, -0.56); g.quadraticCurveTo(0, -0.36, 0.6, -0.56); g.lineTo(0.4, 0.3); g.quadraticCurveTo(0, 0.42, -0.4, 0.3); g.closePath();
  ink(g, upx, 1.1);
  // intake towers
  for (const tx of [-0.48, 0.42]) { g.beginPath(); g.rect(tx, -0.86, 0.08, 0.32); fillInk(g, upx, "#ece4d2", 0.8); }
  g.beginPath(); g.ellipse(0, 0.38, 0.3, 0.07, 0, 0, TAU);
  g.fillStyle = "#5fa8d8"; g.fill();
}

function paintSteelArch(g, upx) {
  pine(g, upx, -0.82, 0.42, 0.34, "#4a7a3a");
  pine(g, upx, 0.82, 0.42, 0.34, "#4a7a3a");
  g.beginPath();
  g.moveTo(-0.72, 0.36);
  g.bezierCurveTo(-0.62, -0.7, -0.22, -1.32, 0, -1.32);
  g.bezierCurveTo(0.22, -1.32, 0.62, -0.7, 0.72, 0.36);
  g.lineTo(0.56, 0.36);
  g.bezierCurveTo(0.48, -0.6, 0.18, -1.14, 0, -1.14);
  g.bezierCurveTo(-0.18, -1.14, -0.48, -0.6, -0.56, 0.36);
  g.closePath();
  const gr = g.createLinearGradient(-0.7, 0, 0.7, 0);
  gr.addColorStop(0, "#f4f6f8"); gr.addColorStop(0.45, "#b8c0c8"); gr.addColorStop(1, "#7a848e");
  fillInk(g, upx, gr, 1.1);
}

function paintStatue(g, upx) {
  // pedestal
  poly(g, [-0.42, 0.36, -0.42, 0.06, -0.3, -0.02, 0.3, -0.02, 0.42, 0.06, 0.42, 0.36]);
  fillInk(g, upx, "#d8ccb0", 1);
  g.fillStyle = "rgba(0,0,0,.12)";
  g.fillRect(0.12, 0.04, 0.28, 0.32);
  const cu = "#6fae9a";
  // robe
  poly(g, [-0.26, -0.02, -0.18, -0.62, -0.04, -0.76, 0.1, -0.74, 0.2, -0.58, 0.24, -0.02]);
  fillInk(g, upx, cu, 1);
  g.strokeStyle = "rgba(30,70,60,.55)";
  g.lineWidth = 0.8 / upx;
  g.beginPath(); g.moveTo(-0.1, -0.6); g.lineTo(-0.14, -0.04); g.moveTo(0.06, -0.62); g.lineTo(0.1, -0.04); g.stroke();
  // raised arm and torch
  poly(g, [0.06, -0.72, 0.16, -0.76, 0.26, -1.12, 0.18, -1.14]);
  fillInk(g, upx, cu, 0.9);
  g.beginPath(); g.moveTo(0.22, -1.14); g.quadraticCurveTo(0.12, -1.3, 0.24, -1.42); g.quadraticCurveTo(0.36, -1.28, 0.26, -1.14); g.closePath();
  fillInk(g, upx, "#f2b63a", 0.8);
  // tablet
  poly(g, [-0.3, -0.5, -0.14, -0.54, -0.1, -0.28, -0.26, -0.24]);
  fillInk(g, upx, "#5f9e8a", 0.8);
  // head and crown
  g.beginPath(); g.arc(-0.02, -0.86, 0.1, 0, TAU);
  fillInk(g, upx, cu, 0.9);
  g.strokeStyle = cu;
  g.lineWidth = Math.max(1 / upx, 0.04);
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI * (0.18 + 0.16 * k);
    g.moveTo(-0.02 + 0.1 * Math.cos(a), -0.88 + 0.1 * Math.sin(a)); g.lineTo(-0.02 + 0.22 * Math.cos(a), -0.88 + 0.22 * Math.sin(a));
  }
  g.stroke();
}

function paintMission(g, upx) {
  const stone = "#e6d6b2";
  g.beginPath();
  g.moveTo(-0.8, 0.36); g.lineTo(-0.8, -0.3); g.lineTo(-0.3, -0.3);
  g.bezierCurveTo(-0.28, -0.6, -0.14, -0.66, -0.12, -0.84); g.quadraticCurveTo(0, -0.96, 0.12, -0.84);
  g.bezierCurveTo(0.14, -0.66, 0.28, -0.6, 0.3, -0.3); g.lineTo(0.8, -0.3); g.lineTo(0.8, 0.36); g.closePath();
  fillInk(g, upx, stone, 1.1);
  g.fillStyle = "rgba(120,90,50,.18)";
  g.fillRect(0.4, -0.3, 0.4, 0.66);
  // cornice
  g.fillStyle = "#cdbb94";
  g.fillRect(-0.84, -0.34, 1.68, 0.07);
  // arched door
  g.beginPath(); g.moveTo(-0.16, 0.36); g.lineTo(-0.16, 0.0); g.arc(0, 0.0, 0.16, Math.PI, 0); g.lineTo(0.16, 0.36); g.closePath();
  fillInk(g, upx, "#4a3420", 0.9);
  // niches and windows
  g.fillStyle = "#8a7656";
  for (const x of [-0.5, 0.5]) {
    g.beginPath(); g.moveTo(x - 0.07, 0.12); g.lineTo(x - 0.07, -0.08); g.arc(x, -0.08, 0.07, Math.PI, 0); g.lineTo(x + 0.07, 0.12); g.closePath(); g.fill();
  }
  g.beginPath(); g.arc(0, -0.5, 0.07, 0, TAU); g.fill();
  // columns either side of the door
  g.fillStyle = "#d4c29c";
  for (const x of [-0.3, -0.24, 0.2, 0.26]) g.fillRect(x, -0.22, 0.04, 0.58);
}

function paintGantry(g, upx) {
  // pad
  poly(g, [-0.8, 0.36, -0.7, 0.2, 0.7, 0.2, 0.8, 0.36]);
  fillInk(g, upx, "#9aa0a6", 0.9);
  // lattice tower
  const red = "#c04a32";
  g.strokeStyle = red;
  g.lineWidth = Math.max(1 / upx, 0.04);
  g.beginPath();
  g.moveTo(-0.58, 0.2); g.lineTo(-0.58, -1.12); g.moveTo(-0.3, 0.2); g.lineTo(-0.3, -1.12);
  for (let y = 0.2; y > -1.1; y -= 0.22) { g.moveTo(-0.58, y); g.lineTo(-0.3, y - 0.22); g.moveTo(-0.58, y - 0.22); g.lineTo(-0.3, y); g.moveTo(-0.58, y); g.lineTo(-0.3, y); }
  g.moveTo(-0.3, -0.7); g.lineTo(0.02, -0.7); g.moveTo(-0.3, -0.36); g.lineTo(0.02, -0.36);
  g.stroke();
  g.beginPath(); g.rect(-0.64, -1.2, 0.4, 0.08);
  fillInk(g, upx, red, 0.8);
  // rocket
  g.beginPath();
  g.moveTo(0.1, 0.14); g.lineTo(0.1, -0.84); g.quadraticCurveTo(0.1, -1.14, 0.22, -1.3); g.quadraticCurveTo(0.34, -1.14, 0.34, -0.84); g.lineTo(0.34, 0.14); g.closePath();
  fillInk(g, upx, "#f4f1ea", 1);
  g.fillStyle = "#2a2e36";
  g.fillRect(0.1, -0.5, 0.24, 0.06);
  poly(g, [0.1, 0.14, 0.1, -0.12, 0.0, 0.18]);
  fillInk(g, upx, "#2a2e36", 0.8);
  poly(g, [0.34, 0.14, 0.34, -0.12, 0.44, 0.18]);
  fillInk(g, upx, "#2a2e36", 0.8);
  // exhaust cloud
  g.beginPath();
  for (const [cx, cy, r] of [[0.0, 0.3, 0.12], [0.22, 0.3, 0.16], [0.46, 0.3, 0.12]]) { g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, TAU); }
  g.fillStyle = "rgba(240,240,236,.9)";
  g.fill();
}

function paintMound(g, upx) {
  // a flat-topped earthen platform mound with a stair and a thatched temple house
  poly(g, [-0.92, 0.36, -0.52, -0.38, 0.52, -0.38, 0.92, 0.36]);
  fillInk(g, upx, "#7f9048", 1.1);
  g.fillStyle = "rgba(40,50,10,.18)";
  poly(g, [0.52, -0.38, 0.92, 0.36, 0.5, 0.36]);
  g.fill();
  poly(g, [-0.1, 0.36, -0.06, -0.38, 0.06, -0.38, 0.1, 0.36]);
  g.fillStyle = "#b89a62";
  g.fill();
  g.strokeStyle = "rgba(80,60,30,.6)";
  g.lineWidth = 0.7 / upx;
  g.beginPath();
  for (let y = -0.28; y < 0.36; y += 0.12) { g.moveTo(-0.1, y); g.lineTo(0.1, y); }
  g.stroke();
  g.beginPath(); g.rect(-0.3, -0.66, 0.6, 0.28);
  fillInk(g, upx, "#b0844e", 0.9);
  poly(g, [-0.42, -0.62, 0, -1.0, 0.42, -0.62]);
  fillInk(g, upx, "#c9a860", 0.9);
  g.fillStyle = "#3a2a18";
  g.fillRect(-0.06, -0.56, 0.12, 0.18);
}

function paintAdobe(g, upx) {
  const mud = "#c89466", shade = "#a8764c";
  const blocks = [[-0.86, -0.06, 0.7, 0.42], [-0.6, -0.42, 0.62, 0.36], [-0.34, -0.74, 0.5, 0.32], [-0.16, -0.06, 0.6, 0.42], [0.3, -0.34, 0.58, 0.7]];
  for (const [x, y, w, h] of blocks) {
    g.beginPath(); g.rect(x, y, w, h);
    fillInk(g, upx, mud, 1);
    g.fillStyle = shade;
    g.fillRect(x + w - 0.08, y, 0.08, h);
  }
  // vigas (roof beams)
  g.strokeStyle = "#4a3420";
  g.lineWidth = Math.max(1 / upx, 0.035);
  g.beginPath();
  for (const [x, y, w] of blocks) for (let k = 1; k < 4; k++) { const vx = x + (w * k) / 4; g.moveTo(vx, y + 0.06); g.lineTo(vx + 0.05, y + 0.08); }
  g.stroke();
  // doors and windows
  g.fillStyle = "#3a2618";
  for (const [x, y] of [[-0.7, 0.12], [-0.4, -0.26], [0.02, 0.1], [0.5, -0.16], [-0.18, -0.6]]) g.fillRect(x, y, 0.1, 0.14);
  // ladder
  g.strokeStyle = "#7a5a34";
  g.lineWidth = Math.max(1 / upx, 0.03);
  g.beginPath();
  g.moveTo(0.14, 0.36); g.lineTo(0.22, -0.2); g.moveTo(0.26, 0.36); g.lineTo(0.34, -0.2);
  for (let k = 0; k < 5; k++) { const y = 0.28 - k * 0.11; g.moveTo(0.15 + k * 0.015, y); g.lineTo(0.27 + k * 0.015, y); }
  g.stroke();
}

function paintBallpark(g, upx) {
  // a brick grandstand bowl around a green diamond, with light towers
  g.beginPath(); g.ellipse(0, 0.0, 0.92, 0.42, 0, 0, TAU);
  fillInk(g, upx, "#9a3e2e", 1.1);
  g.beginPath(); g.ellipse(0, 0.02, 0.74, 0.3, 0, 0, TAU);
  g.fillStyle = "#3f7a3a";
  g.fill();
  g.strokeStyle = "#2f6a2c";
  g.lineWidth = Math.max(1.4 / upx, 0.06);
  g.stroke();
  poly(g, [0, 0.26, -0.24, 0.06, 0, -0.08, 0.24, 0.06]);
  g.fillStyle = "#c89a62";
  g.fill();
  poly(g, [0, 0.2, -0.16, 0.06, 0, -0.03, 0.16, 0.06]);
  g.fillStyle = "#4f8a42";
  g.fill();
  // scoreboard
  g.beginPath(); g.rect(-0.22, -0.68, 0.44, 0.26);
  fillInk(g, upx, "#2f5a34", 0.9);
  g.fillStyle = "#f4f1ea";
  for (let k = 0; k < 4; k++) g.fillRect(-0.16 + k * 0.09, -0.6, 0.05, 0.08);
  g.fillStyle = "#3a2a1c";
  g.fillRect(-0.02, -0.42, 0.04, 0.1);
  // light towers
  for (const tx of [-0.8, 0.8]) {
    g.fillStyle = "#3a3430";
    g.fillRect(tx - 0.025, -0.9, 0.05, 0.9);
    g.beginPath(); g.rect(tx - 0.14, -1.02, 0.28, 0.14);
    fillInk(g, upx, "#f6e8a0", 0.8);
  }
}

function paintBrickHall(g, upx) {
  const brick = "#a5503a";
  g.beginPath(); g.rect(-0.9, -0.24, 1.8, 0.6);
  fillInk(g, upx, brick, 1);
  g.fillStyle = "#f4efe2";
  for (const x of [-0.78, -0.58, -0.38, 0.28, 0.48, 0.68]) { g.fillRect(x, -0.14, 0.1, 0.14); g.fillRect(x, 0.12, 0.1, 0.14); }
  // tower
  g.beginPath(); g.rect(-0.18, -0.62, 0.36, 0.98);
  fillInk(g, upx, brick, 1);
  g.beginPath(); g.moveTo(-0.08, 0.36); g.lineTo(-0.08, 0.14); g.arc(0, 0.14, 0.08, Math.PI, 0); g.lineTo(0.08, 0.36); g.closePath();
  g.fillStyle = "#3a2418"; g.fill();
  g.fillStyle = "#f4efe2";
  g.fillRect(-0.05, -0.44, 0.1, 0.18);
  // white belfry and spire
  g.beginPath(); g.rect(-0.14, -0.9, 0.28, 0.28);
  fillInk(g, upx, "#f4f1ea", 0.9);
  g.beginPath(); g.arc(0, -0.76, 0.06, 0, TAU); g.fillStyle = "#3a3430"; g.fill();
  g.beginPath(); g.rect(-0.1, -1.06, 0.2, 0.16);
  fillInk(g, upx, "#f4f1ea", 0.9);
  poly(g, [-0.08, -1.06, 0, -1.4, 0.08, -1.06]);
  fillInk(g, upx, "#f4f1ea", 0.9);
  // roof line
  g.fillStyle = "#5a3a2e";
  g.fillRect(-0.92, -0.3, 0.74, 0.07);
  g.fillRect(0.18, -0.3, 0.74, 0.07);
}

function paintCarved(g, upx) {
  // a granite ridge with four carved heads
  g.beginPath();
  g.moveTo(-0.95, 0.36); g.lineTo(-0.9, -0.3); g.lineTo(-0.7, -0.62); g.lineTo(-0.3, -0.86); g.lineTo(0.1, -0.9); g.lineTo(0.5, -0.76);
  g.lineTo(0.8, -0.5); g.lineTo(0.95, -0.1); g.lineTo(0.95, 0.36); g.closePath();
  fillInk(g, upx, "#8f959c", 1.1);
  // talus
  g.beginPath(); g.moveTo(-0.9, 0.36); g.quadraticCurveTo(0, -0.02, 0.9, 0.36); g.closePath();
  g.fillStyle = "#b0aaa0"; g.fill();
  for (const [hx, hy, r] of [[-0.54, -0.42, 0.17], [-0.2, -0.5, 0.18], [0.12, -0.48, 0.16], [0.44, -0.4, 0.16]]) {
    g.beginPath(); g.ellipse(hx, hy, r * 0.8, r, 0, 0, TAU);
    fillInk(g, upx, "#c6c8c8", 0.9);
    g.fillStyle = "rgba(40,44,50,.35)";
    g.beginPath(); g.ellipse(hx + r * 0.3, hy + r * 0.1, r * 0.35, r * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(40,44,50,.5)";
    g.fillRect(hx - r * 0.4, hy - r * 0.2, r * 0.25, r * 0.12);
    g.fillRect(hx + r * 0.1, hy - r * 0.2, r * 0.25, r * 0.12);
  }
  pine(g, upx, -0.72, 0.42, 0.42);
  pine(g, upx, 0.66, 0.44, 0.46);
  pine(g, upx, 0.84, 0.4, 0.36, "#3a6a3a");
}

function paintQuarter(g, upx) {
  // a cathedral front (stone towers, slate spires, crosses) behind a row of balconied townhouses
  g.beginPath(); g.rect(-0.46, -0.62, 0.92, 0.4);
  fillInk(g, upx, "#d9ccb2", 0.9); // nave front
  for (const [x, w, top] of [[-0.46, 0.22, -0.86], [0.24, 0.22, -0.86], [-0.12, 0.24, -0.98]]) {
    g.beginPath(); g.rect(x, top, w, -top - 0.22);
    fillInk(g, upx, "#e4d8c0", 0.9); // stone tower
    g.fillStyle = "#3e3a36";
    g.fillRect(x + w * 0.32, top + 0.1, w * 0.36, 0.14); // belfry opening
    const tip = top - (x === -0.12 ? 0.42 : 0.34);
    poly(g, [x - 0.02, top, x + w / 2, tip, x + w + 0.02, top]);
    fillInk(g, upx, "#4c5866", 0.9); // slate spire
    g.strokeStyle = "#2a2622";
    g.lineWidth = Math.max(1.1 / upx, 0.04);
    g.beginPath(); // cross finial
    g.moveTo(x + w / 2, tip); g.lineTo(x + w / 2, tip - 0.16);
    g.moveTo(x + w / 2 - 0.05, tip - 0.1); g.lineTo(x + w / 2 + 0.05, tip - 0.1);
    g.stroke();
  }
  const houses = [[-0.9, "#e8b96a"], [-0.3, "#8fb8a8"], [0.3, "#d88a7a"]];
  for (const [x, col] of houses) {
    g.beginPath(); g.rect(x, -0.3, 0.6, 0.66);
    fillInk(g, upx, col, 1);
    g.fillStyle = "#2f4a3a";
    for (const dx of [0.08, 0.34]) { g.fillRect(x + dx, -0.22, 0.18, 0.18); g.fillRect(x + dx, 0.08, 0.18, 0.24); }
    // iron balcony
    g.strokeStyle = "#1c1a18";
    g.lineWidth = Math.max(1 / upx, 0.035);
    g.beginPath();
    g.moveTo(x + 0.02, 0.0); g.lineTo(x + 0.58, 0.0); g.moveTo(x + 0.02, -0.08); g.lineTo(x + 0.58, -0.08);
    for (let k = 0; k <= 8; k++) { g.moveTo(x + 0.04 + k * 0.065, -0.08); g.lineTo(x + 0.04 + k * 0.065, 0.0); }
    g.stroke();
    g.fillStyle = "#4a3a2e";
    g.fillRect(x - 0.02, -0.34, 0.64, 0.06);
  }
}

function paintFlight(g, upx) {
  // a grassy dune with the granite pylon, and a large early biplane banking over it
  g.beginPath(); g.moveTo(-0.95, 0.36); g.bezierCurveTo(-0.5, -0.3, 0.5, -0.3, 0.95, 0.36); g.closePath();
  fillInk(g, upx, "#a8b46a", 1);
  poly(g, [-0.5, -0.04, -0.46, -0.6, -0.4, -0.66, -0.34, -0.6, -0.3, -0.04]);
  fillInk(g, upx, "#e4dccc", 1);
  g.save();
  g.translate(0.22, -0.86);
  g.rotate(-0.22);
  const W = 0.78, wingH = 0.1;
  // struts between the wings
  g.strokeStyle = "#3a2c1c";
  g.lineWidth = Math.max(1.1 / upx, 0.04);
  g.beginPath();
  for (const dx of [-0.6, -0.3, 0.3, 0.6]) { g.moveTo(dx * W, -0.2); g.lineTo(dx * W, 0.04); }
  g.stroke();
  // lower wing, fuselage and tail, upper wing (canvas-covered, dark outline so it reads at small size)
  g.beginPath(); g.rect(-W, 0.02, W * 2, wingH);
  fillInk(g, upx, "#e8d9a8", 1.1);
  poly(g, [-0.16, -0.06, 0.62, -0.02, 0.62, 0.06, -0.16, 0.1]);
  fillInk(g, upx, "#8a5a32", 1);
  poly(g, [0.54, -0.22, 0.68, -0.22, 0.68, 0.06, 0.58, 0.06]);
  fillInk(g, upx, "#e8d9a8", 1); // rudder
  g.beginPath(); g.rect(-W, -0.24, W * 2, wingH);
  fillInk(g, upx, "#f1e6bf", 1.1);
  // propellers
  g.fillStyle = "#3a2c1c";
  g.fillRect(-0.24, -0.16, 0.05, 0.3);
  g.restore();
}

function paintSpike(g, upx) {
  // desert ground, a rail line meeting in the middle, a small steam engine, and the gold spike standing tall
  g.beginPath(); g.moveTo(-0.95, 0.36); g.bezierCurveTo(-0.5, -0.12, 0.5, -0.12, 0.95, 0.36); g.closePath();
  fillInk(g, upx, "#c8b27a", 1);
  // ties and rails, a little perspective
  g.fillStyle = "#6a4a2c";
  for (let k = -4; k <= 4; k++) g.fillRect(k * 0.19 - 0.03, 0.02, 0.06, 0.18);
  g.strokeStyle = "#2e2c2a";
  g.lineWidth = Math.max(1.2 / upx, 0.045);
  g.beginPath(); g.moveTo(-0.86, 0.06); g.lineTo(0.86, 0.06); g.moveTo(-0.86, 0.16); g.lineTo(0.86, 0.16); g.stroke();
  // locomotive on the left, facing the spike
  g.beginPath(); g.rect(-0.86, -0.3, 0.34, 0.32);
  fillInk(g, upx, "#3a2e2a", 1); // cab
  g.beginPath(); g.rect(-0.54, -0.2, 0.36, 0.22);
  fillInk(g, upx, "#2a2a30", 1); // boiler
  poly(g, [-0.36, -0.2, -0.4, -0.5, -0.24, -0.5, -0.28, -0.2]);
  fillInk(g, upx, "#2a2a30", 1); // funnel stack
  poly(g, [-0.18, -0.04, -0.06, 0.06, -0.18, 0.06]);
  fillInk(g, upx, "#b8433a", 0.9); // cow-catcher
  g.fillStyle = "#c9a45c";
  g.fillRect(-0.82, -0.26, 0.12, 0.1); // cab window glint
  // the golden spike
  poly(g, [0.28, -1.12, 0.44, -1.12, 0.42, -0.98, 0.39, 0.06, 0.36, 0.14, 0.33, 0.06, 0.3, -0.98]);
  fillInk(g, upx, "#f0c848", 1.1);
  g.fillStyle = "rgba(255,250,220,.7)";
  g.fillRect(0.32, -0.96, 0.03, 0.9);
}

const MOTIF_PAINT = {
  peak: paintPeak,
  canyon: paintCanyon, forest: paintForest, desert: paintDesert, geyser: paintGeyser, coast: paintCoast, bridge: paintBridge,
  dam: paintDam, arch: paintSteelArch,
  obelisk: (g, upx) => paintLandmark(g, upx, 0),
  memorial: (g, upx) => paintLandmark(g, upx, 1),
  rotunda: (g, upx) => paintLandmark(g, upx, 2),
  hall: (g, upx) => paintUniversity(g, upx, 0),
  redhall: (g, upx) => paintUniversity(g, upx, 1),
  spire: (g, upx) => paintUniversity(g, upx, 2),
  statue: paintStatue, mission: paintMission, gantry: paintGantry, mound: paintMound, adobe: paintAdobe,
  ballpark: paintBallpark, brickhall: paintBrickHall, carved: paintCarved, quarter: paintQuarter, flight: paintFlight,
  spike: paintSpike,
};

// --- plaques --------------------------------------------------------------------------------------------------------

const PLAQUE_FONT = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

/**
 * A name plate centred under (x, y) in screen css px (call with a screen transform): dark bronze plate, gold rim, the
 * name in small caps-ish serif and an optional second line (sub). `kind` tints the rim (wonder kinds or "fort").
 * Returns the plate's box [x0, y0, x1, y1] (css px) for decluttering.
 */
export function drawPlaque(ctx, text, x, y, { kind = "landmark", sub = "", scale = 1, measureOnly = false } = {}) {
  const fs = 10.5 * scale, fs2 = 9 * scale;
  ctx.font = `600 ${fs.toFixed(1)}px ${PLAQUE_FONT}`;
  const tw = ctx.measureText(text).width;
  let sw = 0;
  if (sub) {
    ctx.font = `${fs2.toFixed(1)}px -apple-system, system-ui, sans-serif`;
    sw = ctx.measureText(sub).width;
  }
  const w = Math.max(tw, sw) + 14 * scale, h = (sub ? 27 : 16) * scale;
  const x0 = x - w / 2, y0 = y;
  if (measureOnly) return [x0, y0, x0 + w, y0 + h];
  const rim = kind === "fort" ? "#c98a6a" : WONDER_KINDS[kind]?.ring || "#c9a45c";
  const r = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0); ctx.lineTo(x0 + w - r, y0); ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  ctx.lineTo(x0 + w, y0 + h - r); ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  ctx.lineTo(x0 + r, y0 + h); ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, y0, 0, y0 + h);
  grad.addColorStop(0, "rgba(46,34,20,.95)");
  grad.addColorStop(1, "rgba(22,16,8,.95)");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${fs.toFixed(1)}px ${PLAQUE_FONT}`;
  ctx.fillStyle = "#f6e7bf";
  ctx.fillText(text, x, y0 + 8.4 * scale);
  if (sub) {
    ctx.font = `${fs2.toFixed(1)}px -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = "#c9b98f";
    ctx.fillText(sub, x, y0 + 19.6 * scale);
  }
  return [x0, y0, x0 + w, y0 + h];
}
