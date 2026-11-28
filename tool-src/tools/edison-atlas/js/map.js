import { band, bins, valueAt } from "./lenses.js";
import { drawRestricted } from "./usaciv/render/art/sites.js";
import { CivArt, drawSites } from "./civart.js";
import { TerrainRaster } from "./terrain-raster.js";
import { UtilityLayer } from "./utility.js";
import { SourceAreas } from "./source-areas.js";
import {
  drawRoads,
  drawRail,
  ROAD_MIN_RPX,
} from "./usaciv/render/art/improvements.js";
import { drawOceanTexture } from "./usaciv/render/art/water.js";
import { GLYPHS_MIN_RPX, prepareTerrainPatterns } from "./usaciv/render/art/terrain.js";
import { assetUrl } from "./assets.js";

const ROW = Math.sqrt(3) / 2,
  R = 1 / Math.sqrt(3),
  corners = [
    [0, -R],
    [0.5, -R / 2],
    [0.5, R / 2],
    [0, R],
    [-0.5, R / 2],
    [-0.5, -R / 2],
  ];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const landscapeOptions = [
  "art",
  "places",
  "water",
  "grid",
  "roads",
  "rail",
  "parks",
  "restricted",
  "counties",
  "contours",
];
function polygon(c, x, y, size = 1) {
  c.moveTo(x, y - R * size);
  for (let i = 1; i < 6; i++)
    c.lineTo(x + corners[i][0] * size, y + corners[i][1] * size);
  c.closePath();
}
function pathOf(lines, closed = false) {
  const path = new Path2D();
  for (const a of lines) {
    if (!a.length) continue;
    path.moveTo(...a[0]);
    for (let i = 1; i < a.length; i++) path.lineTo(...a[i]);
    if (closed) path.closePath();
  }
  return path;
}
function lineGroups(items, split) {
  const groups = [[], []];
  for (const [rank, pts] of items) groups[split(rank) ? 0 : 1].push(pts);
  return groups.map((a) => pathOf(a));
}
function pathBounds(points) {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of points) {
    box.x0 = Math.min(box.x0, x);
    box.x1 = Math.max(box.x1, x);
    box.y0 = Math.min(box.y0, y);
    box.y1 = Math.max(box.y1, y);
  }
  return box;
}
function intersects(box, view, pad = 0) {
  return (
    box.x1 >= view.x0 - pad &&
    box.x0 <= view.x1 + pad &&
    box.y1 >= view.y0 - pad &&
    box.y0 <= view.y1 + pad
  );
}
function coversView(area, view) {
  return (
    view.x0 >= area.x0 &&
    view.y0 >= area.y0 &&
    view.x1 <= area.x1 &&
    view.y1 <= area.y1
  );
}
// Keep complete contour lines so their joins and dash phases survive culling.
function contourIndex(lines) {
  const groups = new Map();
  for (const line of lines) {
    if (!line.length) continue;
    const box = pathBounds(line);
    const key =
      Math.floor((box.x0 + box.x1) / 48) +
      "," +
      Math.floor((box.y0 + box.y1) / 48);
    const group = groups.get(key);
    if (group) {
      group.x0 = Math.min(group.x0, box.x0);
      group.x1 = Math.max(group.x1, box.x1);
      group.y0 = Math.min(group.y0, box.y0);
      group.y1 = Math.max(group.y1, box.y1);
      group.lines.push(line);
    } else groups.set(key, { ...box, lines: [line] });
  }
  return Array.from(groups.values(), ({ lines, ...box }) => ({
    ...box,
    path: pathOf(lines),
  }));
}
// A rectangle without crossing edges is wholly inside or outside an even-odd
// water polygon. Keeping short runs of edges also handles holes and islands.
function edgeBounds(rings) {
  const boxes = [];
  for (const ring of rings) {
    if (!ring.length) continue;
    for (let i = 0; i + 1 < ring.length; i += 12)
      boxes.push(pathBounds(ring.slice(i, i + 13)));
    boxes.push(pathBounds([ring.at(-1), ring[0]]));
  }
  return boxes;
}
function tinted(hex, shift) {
  const c = parseInt(hex.slice(1), 16);
  return (
    "rgb(" +
    [(c >> 16) & 255, (c >> 8) & 255, c & 255]
      .map((v) => clamp(Math.round(v + shift), 0, 255))
      .join(",") +
    ")"
  );
}
// These sprite rows are rasterized from USACiv’s original MIT-licensed terrain brushes.
const artRows = [
  "peak",
  "alpine",
  "ridge",
  "greenridge",
  "forest",
  "farm",
  "urban",
  "village",
  "grass",
  "scrub",
  "rock",
  "wetland",
];
const regions = [
  ["PACIFIC OCEAN", -32, 285, -0.19, "sea"],
  ["SIERRA NEVADA", 61, 84, -0.79, "land"],
  ["MOJAVE DESERT", 215, 212, 0.04, "land"],
  ["SAN JOAQUIN VALLEY", 16, 121, 0.94, "land"],
  ["NEVADA", 188, 28, 0, "state"],
  ["ARIZONA", 386, 215, 0, "state"],
];
const priorities = [
  "Bishop",
  "Mammoth Lakes",
  "Visalia",
  "Ridgecrest",
  "Santa Barbara",
  "Ventura",
  "Lancaster",
  "Victorville",
  "Palm Springs",
  "Blythe",
  "Long Beach",
  "Santa Ana",
  "Avalon",
  "San Bernardino",
  "Los Angeles",
  "Bakersfield",
  "Fresno",
  "Barstow",
  "Tulare",
  "Tehachapi",
  "Lone Pine",
  "Needles",
  "Yuma",
];
export class HexMap {
  constructor(m, canvas, overlay, mini) {
    this.m = m;
    this.canvas = canvas;
    this.overlay = overlay;
    this.mini = mini;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.ink = overlay.getContext("2d");
    this.hitCtx = document.createElement("canvas").getContext("2d");
    this.boundary = pathOf(m.meta.territory, true);
    this.accessLand = m.access.groups.map(({ bbox, rings }) => {
      const path = pathOf(rings, true);
      return { bbox, path, edges: path };
    });
    this.countyLines = pathOf(m.context.counties.flat(), true);
    this.highways = lineGroups(m.context.roads, (x) => x === 1);
    this.rail = lineGroups(m.context.rail, (x) => x < 6);
    this.rivers = lineGroups(m.context.rivers, (x) => x < 6);
    this.lakes = pathOf(m.context.lakes, true);
    this.ocean = pathOf(m.context.ocean, true);
    this.coastEdges = edgeBounds(m.context.ocean);
    this.lakeBounds = m.context.lakes.filter((r) => r.length).map(pathBounds);
    const [x0, y0, x1, y1] = m.meta.backdrop;
    this.dryLand = new Path2D(this.ocean);
    this.dryLand.rect(x0, y0, x1 - x0, y1 - y0);
    const bounds = { x0, y0, x1, y1 };
    this.network = {
      roads: [{ ...bounds, paths: this.highways }],
      rail: [{ ...bounds, paths: this.rail }],
    };
    this.parks = pathOf(
      m.context.parks.flatMap((p) => p.rings),
      true,
    );
    this.contours = contourIndex(m.context.contours);
    this.rows = new Map();
    this.lookup = new Map();
    this.coords = [];
    this.selected = -1;
    this.hover = -1;
    this.place = null;
    for (let i = 0; i < m.meta.cells; i++) {
      const row = m.val(i, "row"),
        col = m.val(i, "col"),
        xy = [col + 0.5 * Math.abs(row % 2), row * ROW];
      this.coords.push(xy);
      this.lookup.set(col + "," + row, i);
      if (!this.rows.has(row)) this.rows.set(row, []);
      this.rows.get(row).push(i);
    }
    this.places = m.meta.places
      .map((p) => ({ ...p, priority: priorities.indexOf(p.name) }))
      .sort(
        (a, b) =>
          (a.priority < 0 ? 999 : a.priority) -
            (b.priority < 0 ? 999 : b.priority) || (b.pop || 0) - (a.pop || 0),
      );
    this.civ = new CivArt(m, this.places, (x, y) => this.cellAt(x, y));
    this.terrainRaster = new TerrainRaster(this.civ);
    this.renderRevision = 0;
    this.utility = new UtilityLayer(m.utility);
    this.sourceAreas = new SourceAreas(m);
    this.utilityHover = null;
    this.opts = {
      utility: true,
      places: true,
      roads: true,
      rail: false,
      water: true,
      counties: false,
      parks: false,
      restricted: true,
      landmarks: false,
      contours: false,
      grid: true,
      art: true,
    };
    this.fitBounds = m.meta.bounds;
    this.x = 0;
    this.y = 0;
    this.z = 1;
    this.labels = [];
    this.recentMoves = new Map();
    this.pointerStart = null;
    this.resize(true);
    new ResizeObserver(() => this.resize(false)).observe(canvas.parentElement);
    this.events();
    window.addEventListener("pagehide", () => {
      this.renderRevision++;
      clearTimeout(this.backdropTimer);
      clearTimeout(this.refineTimer);
      this.terrainRaster.stop();
      // Back/forward navigation can keep the DOM alive. Release private
      // backing stores now and rebuild from the saved camera when restored.
      for (const ink of [this.landscapeInk, this.nextLandscapeInk, this.landInk,
                         this.patchInk, this.previewInk]) {
        if (ink) ink.canvas.width = ink.canvas.height = 0;
      }
      this.landscape = this.zoomPreview = null;
    });
    window.addEventListener("pageshow", e => { if (e.persisted) this.queue(); });
  }
  resize(first) {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const prev = this.base;
    this.w = rect.width;
    this.h = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.dpr !== dpr) prepareTerrainPatterns(dpr, assetUrl);
    this.dpr = dpr;
    for (const c of [this.canvas, this.overlay]) {
      const width = Math.round(this.w * this.dpr),
        height = Math.round(this.h * this.dpr);
      if (c.width !== width) c.width = width;
      if (c.height !== height) c.height = height;
    }
    const [x0, y0, x1, y1] = this.fitBounds;
    const padX = this.w < 550 ? 26 : 68,
      padTop = this.h < 480 ? 53 : 77,
      padBottom = this.h < 480 ? 36 : 58;
    this.base = Math.max(
      0.35,
      Math.min(
        (this.w - 2 * padX) / (x1 - x0),
        (this.h - padTop - padBottom) / (y1 - y0),
      ),
    );
    this.homeY = (y0 + y1) / 2 - (padTop - padBottom) / (2 * this.base);
    if (first || !prev || (Math.abs(this.z - 1) < 0.001 && this.atHome))
      this.fit(false);
    this.queue();
  }
  get scale() {
    return this.base * this.z;
  }
  screen(x, y) {
    return [
      (x - this.x) * this.scale + this.w / 2,
      (y - this.y) * this.scale + this.h / 2,
    ];
  }
  world(x, y) {
    return [
      (x - this.w / 2) / this.scale + this.x,
      (y - this.h / 2) / this.scale + this.y,
    ];
  }
  clipCamera() {
    const [x0, y0, x1, y1] = this.fitBounds;
    this.x = clamp(this.x, x0 - 70, x1 + 70);
    this.y = clamp(this.y, y0 - 55, y1 + 55);
  }
  fit(notify = true) {
    const b = this.fitBounds;
    this.x = (b[0] + b[2]) / 2;
    this.y = this.homeY;
    this.z = 1;
    this.atHome = true;
    this.queue();
    if (notify) this.onView?.();
  }
  go(x, y, zoom) {
    this.x = x;
    this.y = y;
    this.z = clamp(zoom, 0.7, 60);
    this.atHome = false;
    this.clipCamera();
    this.queue();
    this.onView?.();
  }
  zoom(factor, sx = this.w / 2, sy = this.h / 2) {
    const [x, y] = this.world(sx, sy);
    this.z = clamp(this.z * factor, 0.7, 60);
    this.x = x - (sx - this.w / 2) / this.scale;
    this.y = y - (sy - this.h / 2) / this.scale;
    this.clipCamera();
    this.atHome = false;
    this.queue();
    this.onView?.();
  }
  frame(c) {
    const d = this.dpr,
      s = this.scale;
    c.setTransform(
      d * s,
      0,
      0,
      d * s,
      d * (this.w / 2 - this.x * s),
      d * (this.h / 2 - this.y * s),
    );
  }
  normal(c) {
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  cellAt(x, y) {
    if (!this.hitCtx.isPointInPath(this.boundary, x, y, "evenodd")) return -1;
    // Round to the nearest regular lattice center, including boundary fragments.
    const r = Math.round(y / ROW);
    let best = Infinity,
      key;
    for (let row = r - 1; row <= r + 1; row++) {
      const offset = 0.5 * Math.abs(row % 2),
        col = Math.round(x - offset),
        dx = x - col - offset,
        dy = y - row * ROW,
        d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        key = col + "," + row;
      }
    }
    return this.lookup.get(key) ?? -1;
  }
  setLens(lens) {
    this.lens = lens;
    this.legend = bins(lens, this.m);
    this.values = new Array(this.m.meta.cells);
    this.colors = new Array(this.m.meta.cells);
    this.hasNoData = false;
    const shades = new Map();
    for (let i = 0; i < this.values.length; i++) {
      const v = valueAt(this.m, lens.id, i);
      this.values[i] = v;
      if (v == null) this.hasNoData = true;
      const n = band(lens, v, this.legend),
        hex = this.legend[n]?.color || "#a4a49a";
      const shift =
        lens.id === "terrain"
          ? Math.round(
              this.m.val(i, "shade") * 0.8 +
                (((i * 17) % 7) - 3) +
                (v === "scrub" ? Math.min(12, this.m.val(i, "elev") / 160) : 0),
            )
          : 0;
      const key = hex + shift;
      if (!shades.has(key)) shades.set(key, tinted(hex, shift));
      this.colors[i] = shades.get(key);
    }
    const [x0, y0, x1, y1] = this.fitBounds,
      pp = 4;
    const cache = this.cache ?? document.createElement("canvas");
    const width = Math.ceil((x1 - x0 + 3) * pp), height = Math.ceil((y1 - y0 + 3) * pp);
    if (cache.width !== width) cache.width = width;
    if (cache.height !== height) cache.height = height;
    const c = cache.getContext("2d");
    c.resetTransform();
    c.clearRect(0, 0, cache.width, cache.height);
    this.cacheBox = [x0 - 1.5, y0 - 1.5, cache.width / pp, cache.height / pp];
    c.setTransform(
      pp,
      0,
      0,
      pp,
      -this.cacheBox[0] * pp,
      -this.cacheBox[1] * pp,
    );
    // The map clips this completed overview image to the service territory.
    this.paintCells(c, null, 1.11);
    this.cache = cache;
    this.landscape = null;
    this.zoomPreview = null;
    this.queue();
  }
  viewport() {
    const [x0, y0] = this.world(0, 0),
      [x1, y1] = this.world(this.w, this.h);
    return { x0, y0, x1, y1, s: this.scale, dpr: this.dpr };
  }
  visible({ x0, y0, x1, y1 } = this.viewport()) {
    const margin = 1.4;
    const result = [];
    for (
      let r = Math.floor((y0 - margin) / ROW);
      r <= Math.ceil((y1 + margin) / ROW);
      r++
    ) {
      const row = this.rows.get(r);
      if (!row) continue;
      for (const i of row) {
        const x = this.coords[i][0];
        if (x >= x0 - margin && x <= x1 + margin) result.push(i);
      }
    }
    return result;
  }
  paintCells(c, ids, extra) {
    const paint = (i) => {
      const xy = this.coords[i];
      c.fillStyle = this.colors[i];
      c.beginPath();
      polygon(c, xy[0], xy[1], extra);
      c.fill();
    };
    if (ids) ids.forEach(paint);
    else for (let i = 0; i < this.colors.length; i++) paint(i);
  }
  queue() {
    if (!this.pending)
      this.pending = requestAnimationFrame(() => {
        this.pending = 0;
        this.draw(false);
      });
  }
  draw(exact = true) {
    if (!this.cache) return;
    const c = this.ctx,
      view = this.viewport();
    this.drawLandscape(c, view, exact);
    this.normal(c);
    this.labels = [];
    this.drawLabels(c);
    this.highlights();
    this.drawMini();
    this.onDraw?.();
  }
  drawLandscape(screen, view, exact) {
    // Cache the static geography with a pan margin, as in the USACiv renderer.
    // Labels and hit targets are laid out against the live camera on every frame.
    // A new camera, layer or exact PNG render supersedes every pending patch.
    this.renderRevision++;
    const { width, height } = screen.canvas;
    const key = [
      this.lens.id,
      this.sourceAreas.enabled,
      width,
      height,
      view.dpr,
      ...landscapeOptions.map((option) => this.opts[option]),
    ].join("|");
    const prev = this.landscape;
    const compatible = prev?.key === key;
    const covers = compatible && coversView(prev, view);
    const ratio = compatible ? view.s / prev.s : 1;
    // A button or double-click changes scale in a single event. Keep the
    // current image on screen while these local zooms gain native detail.
    const previewOut =
      !exact &&
      !covers &&
      ratio < 1 &&
      ratio >= 1 / 3 &&
      compatible &&
      intersects(prev, view);
    let left = compatible ? (view.x0 - prev.x0) * prev.s * view.dpr : 0;
    let top = compatible ? (view.y0 - prev.y0) * prev.s * view.dpr : 0;
    const fractional =
      Math.abs(left - Math.round(left)) > 1e-5 ||
      Math.abs(top - Math.round(top)) > 1e-5;
    const needsDetail = Math.abs(ratio - 1) > 1e-6 || fractional;
    clearTimeout(this.refineTimer);
    clearTimeout(this.backdropTimer);
    if ((!covers && !previewOut) || ratio > 3 || (exact && needsDetail)) {
      const area = this.landscapeArea(view, key);
      this.landscapeInk ??= this.landscapeContext();
      const sheet = this.landscapeInk.canvas;
      const sameGrid = prev?.key === key && prev.s === view.s;
      const px = view.s * view.dpr;
      const dx = sameGrid ? Math.round((area.x0 - prev.x0) * px) : 0;
      const dy = sameGrid ? Math.round((area.y0 - prev.y0) * px) : 0;
      if (
        !exact &&
        sameGrid &&
        Math.abs(dx) < sheet.width / 2 &&
        Math.abs(dy) < sheet.height / 2
      ) {
        // Stay on the existing device-pixel grid so the overlap is an exact copy.
        area.x0 = prev.x0 + dx / px;
        area.y0 = prev.y0 + dy / px;
        area.x1 = area.x0 + sheet.width / px;
        area.y1 = area.y0 + sheet.height / px;
        this.scrollLandscape(area, dx, dy);
      } else {
        if (sheet.width !== area.width) sheet.width = area.width;
        if (sheet.height !== area.height) sheet.height = area.height;
        this.landscapeInk.save();
        this.paintLandscape(this.landscapeInk, area);
        this.landscapeInk.restore();
      }
      this.landscape = area;
      left = (view.x0 - area.x0) * px;
      top = (view.y0 - area.y0) * px;
    } else if (Math.abs(ratio - 1) > 1e-6) {
      if (previewOut) this.drawZoomBackdrop(screen, view, key);
      this.refineTimer = setTimeout(() => this.refineLandscape(view, key), 120);
    }
    if (this.landscape.s === view.s) {
      // Keep native pixels sharp on a fractional pan. Labels and hit testing use
      // the unrounded camera. A synchronous draw for PNG uses its exact origin.
      left = Math.round(left);
      top = Math.round(top);
    }
    if (this.landscape.s === view.s) this.queueZoomBackdrop(view, key);
    const sourceScale = this.landscape.s / view.s;
    screen.resetTransform();
    screen.drawImage(
      this.landscapeInk.canvas,
      left,
      top,
      width * sourceScale,
      height * sourceScale,
      0,
      0,
      width,
      height,
    );
  }
  queueZoomBackdrop(view, key) {
    // Prepaint enough geography for a button zoom about any point on screen.
    // Moving within this margin reuses the same pixels across pans and zooms.
    if (this.zoomPreview?.key === key && coversView(this.zoomPreview, view)) return;
    const w = view.x1 - view.x0, h = view.y1 - view.y0;
    const expected = {
      x0: view.x0 - 0.7 * w, x1: view.x1 + 0.7 * w,
      y0: view.y0 - 0.7 * h, y1: view.y1 + 0.7 * h,
    };
    this.backdropTimer = setTimeout(() => {
      if (this.pending || this.landscape?.key !== key) return;
      this.prepareZoomBackdrop(expected, key, Math.min(4, view.s / 3.4));
    }, 32);
  }
  prepareZoomBackdrop(view, key, s, realize = true) {
    const w = view.x1 - view.x0, h = view.y1 - view.y0;
    const x0 = view.x0 - w / 4, y0 = view.y0 - h / 4;
    const width = Math.ceil(1.5 * w * s), height = Math.ceil(1.5 * h * s);
    this.previewInk ??= document.createElement("canvas").getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
    const ink = this.previewInk, sheet = ink.canvas;
    if (sheet.width !== width) sheet.width = width;
    if (sheet.height !== height) sheet.height = height;
    const area = { key, s, dpr: 1, x0, y0, x1: x0 + width / s, y1: y0 + height / s };
    ink.save();
    this.paintLandscape(ink, area);
    ink.restore();
    // Flush the small overview here. WebKit can otherwise replay its vector
    // clips and drawing commands when the first zoom samples this canvas.
    if (realize) ink.putImageData(ink.getImageData(0, 0, width, height), 0, 0);
    this.zoomPreview = area;
  }
  drawZoomBackdrop(screen, view, key) {
    // Handles consecutive zooms that outrun the prepared margin.
    if (this.zoomPreview?.key !== key || !coversView(this.zoomPreview, view))
      this.prepareZoomBackdrop(view, key, Math.min(4, view.s / 2), false);
    const area = this.zoomPreview, sheet = this.previewInk.canvas;
    screen.resetTransform();
    const px = view.s * view.dpr, k = area.s / px;
    const originX = (view.x0 - area.x0) * area.s;
    const originY = (view.y0 - area.y0) * area.s;
    const width = screen.canvas.width, height = screen.canvas.height;
    const prev = this.landscape;
    const x0 = clamp(Math.ceil((prev.x0 - view.x0) * px) + 1, 0, width);
    const x1 = clamp(Math.floor((prev.x1 - view.x0) * px) - 1, x0, width);
    const y0 = clamp(Math.ceil((prev.y0 - view.y0) * px) + 1, 0, height);
    const y1 = clamp(Math.floor((prev.y1 - view.y0) * px) - 1, y0, height);
    // Only paint the four strips outside the retained native image. Allow
    // one device pixel of overlap to cover its filtered fractional edges.
    const strip = (x, y, w, h) => {
      if (w > 0 && h > 0)
        screen.drawImage(sheet, originX + x * k, originY + y * k, w * k, h * k,
                         x, y, w, h);
    };
    strip(0, 0, width, y0);
    strip(0, y1, width, height - y1);
    strip(0, y0, x0, y1 - y0);
    strip(x1, y0, width - x1, y1 - y0);
  }
  landscapeContext() {
    return document.createElement("canvas").getContext("2d", { alpha: false });
  }
  landscapeArea(view, key) {
    const pad = Math.ceil(
      Math.min(160, Math.min(this.w, this.h) / 4) * view.dpr,
    );
    const px = view.s * view.dpr;
    const x0 = view.x0 - pad / px,
      y0 = view.y0 - pad / px;
    const width = this.canvas.width + pad * 2,
      height = this.canvas.height + pad * 2;
    return {
      ...view,
      key,
      x0,
      y0,
      x1: x0 + width / px,
      y1: y0 + height / px,
      width,
      height,
    };
  }
  regionView(area, x, y, width, height) {
    const px = area.s * area.dpr;
    return { s: area.s, dpr: area.dpr, width, height,
      x0: area.x0 + x / px, y0: area.y0 + y / px,
      x1: area.x0 + (x + width) / px, y1: area.y0 + (y + height) / px };
  }
  paintRegion(target, area, x, y, width, height, view = this.regionView(area, x, y, width, height)) {
    this.patchInk ??= this.landscapeContext();
    const patch = this.patchInk, canvas = patch.canvas;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    patch.save();
    this.paintLandscape(patch, view);
    patch.restore();
    target.drawImage(canvas, x, y);
  }
  scrollLandscape(area, dx, dy) {
    const c = this.landscapeInk,
      { width, height } = c.canvas;
    const x = Math.max(0, -dx),
      y = Math.max(0, -dy);
    const w = width - Math.abs(dx),
      h = height - Math.abs(dy);
    c.resetTransform();
    c.drawImage(c.canvas, x + dx, y + dy, w, h, x, y, w, h);
    if (dx) this.paintRegion(c, area, x ? 0 : w, y, Math.abs(dx), h);
    if (dy) this.paintRegion(c, area, 0, y ? 0 : h, width, Math.abs(dy));
  }
  async refineLandscape(view, key) {
    const revision = this.renderRevision;
    const area = this.landscapeArea(view, key);
    this.nextLandscapeInk ??= this.landscapeContext();
    const next = this.nextLandscapeInk;
    if (next.canvas.width !== area.width) next.canvas.width = area.width;
    if (next.canvas.height !== area.height) next.canvas.height = area.height;
    const cols = Math.ceil(area.width / (384 * view.dpr));
    const rows = Math.ceil(area.height / (128 * view.dpr));
    const width = Math.ceil(area.width / cols), height = Math.ceil(area.height / rows);
    const useWorker = this.lens.id === "terrain" && this.opts.art && view.s * R >= GLYPHS_MIN_RPX;
    if (useWorker) this.terrainRaster.start();
    await new Promise(requestAnimationFrame);
    // Return one small, finished pixel buffer at a time. The visible map
    // stays on its preview until the complete new scale is ready.
    let frameStart = performance.now(), count = 0;
    for (let tile = 0; tile < rows * cols; tile++) {
      if (this.pending || revision !== this.renderRevision) return;
      const x = tile % cols * width, y = Math.floor(tile / cols) * height;
      const patch = this.regionView(area, x, y, width, height);
      if (useWorker && this.terrainRaster.worker) {
        const visible = this.visible(patch);
        patch.artwork = await this.terrainRaster.paint(patch, visible, this.opts.places, this.opts.water);
        patch.visible = visible;
        if (this.pending || revision !== this.renderRevision) {
          patch.artwork?.close();
          return;
        }
      }
      try {
        this.paintRegion(next, area, x, y, width, height, patch);
      } finally {
        patch.artwork?.close();
      }
      if (++count >= 3 || performance.now() - frameStart >= 4) {
        await new Promise(requestAnimationFrame);
        frameStart = performance.now();
        count = 0;
      }
    }
    if (this.pending || revision !== this.renderRevision) return;
    this.nextLandscapeInk = this.landscapeInk;
    this.landscapeInk = next;
    this.landscape = area;
    this.draw(false);
  }
  drawRelief(c, view) {
    const image = this.m.image,
      b = this.m.meta.backdrop;
    const dx = (b[2] - b[0]) / image.width,
      dy = (b[3] - b[1]) / image.height;
    // Submit only the source pixels sampled by this patch. Include neighboring
    // texels so interpolation at the edge matches drawing the whole image.
    const x = Math.max(0, Math.floor((view.x0 - b[0]) / dx) - 2);
    const y = Math.max(0, Math.floor((view.y0 - b[1]) / dy) - 2);
    const w = Math.min(image.width, Math.ceil((view.x1 - b[0]) / dx) + 2) - x;
    const h = Math.min(image.height, Math.ceil((view.y1 - b[1]) / dy) + 2) - y;
    if (w > 0 && h > 0)
      c.drawImage(
        image,
        x,
        y,
        w,
        h,
        b[0] + x * dx,
        b[1] + y * dy,
        w * dx,
        h * dy,
      );
  }
  paintLandscape(c, view) {
    const { s, dpr, x0, y0, x1, y1 } = view,
      Rpx = s * R;
    const terrain = this.lens.id === "terrain",
      nativeArt = terrain && this.opts.art && Rpx >= GLYPHS_MIN_RPX;
    c.resetTransform();
    c.fillStyle = "#dad6bf";
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.setTransform(dpr * s, 0, 0, dpr * s, -x0 * dpr * s, -y0 * dpr * s);
    this.drawRelief(c, view);
    let contours;
    if (s > 8 || this.opts.contours) {
      contours = new Path2D();
      for (const piece of this.contours)
        if (intersects(piece, view, 1 / s)) contours.addPath(piece.path);
    }
    if (s > 8) {
      const fade = Math.min(0.76, (s - 8) / 35);
      c.fillStyle = "rgba(227,223,199," + fade + ")";
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
      c.strokeStyle = "rgba(119,119,89,.36)";
      c.lineWidth = 0.7 / s;
      c.stroke(contours);
    }
    const oceanVisible =
      this.opts.water &&
      (this.coastEdges.some((edge) => intersects(edge, view, 1 / s)) ||
        this.hitCtx.isPointInPath(this.ocean, x0, y0, "evenodd"));
    if (oceanVisible) this.drawOcean(c, view);
    this.drawLand(c, view, nativeArt, oceanVisible);
    const stroke = (p, color, width, dash = []) => {
      c.strokeStyle = color;
      c.lineWidth = width / s;
      c.setLineDash(dash.map((x) => x / s));
      c.stroke(p);
      c.setLineDash([]);
    };
    if (this.opts.water) {
      if (this.lakeBounds.some((box) => intersects(box, view, 1 / s))) {
        c.fillStyle = terrain ? "#4092ca" : "rgba(75,139,168,.72)";
        c.fill(this.lakes, "evenodd");
        if (nativeArt) {
          c.save();
          c.clip(this.lakes, "evenodd");
          drawOceanTexture(c, view, { Rpx });
          c.restore();
          stroke(this.lakes, "#a3d2d6", 1.3);
        }
      }
      if (nativeArt) this.civ.rivers(c, s);
      else {
        stroke(this.rivers[0], "#4d9bc0", s > 6 ? 1.6 : 0.85);
        if (s > 3.7) stroke(this.rivers[1], "#73abc3", 1);
      }
    }
    if (this.opts.parks) {
      c.fillStyle = "rgba(70,112,71,.16)";
      c.fill(this.parks, "evenodd");
      stroke(this.parks, "#476c4b", 1.3, [4, 2]);
    }
    if (this.opts.restricted) {
      c.save();
      drawRestricted(c, this.accessLand, view, { Rpx: Math.max(5, Rpx) });
      c.restore();
    }
    if (this.opts.counties)
      stroke(this.countyLines, "rgba(70,75,65,.65)", 0.95, [4, 4]);
    if (this.opts.contours) stroke(contours, "rgba(97,89,65,.54)", 0.7);
    if (terrain && this.opts.art && Rpx >= ROAD_MIN_RPX) {
      c.save();
      if (this.opts.roads) drawRoads(c, this.network, view, { Rpx });
      if (this.opts.rail) drawRail(c, this.network, view, { Rpx });
      c.restore();
    } else {
      if (this.opts.roads) {
        if (s > 4) {
          stroke(this.highways[1], "rgba(106,89,65,.50)", 1.7);
          stroke(this.highways[1], "#ecdbac", 0.85);
        }
        stroke(this.highways[0], "rgba(114,80,56,.64)", s > 5 ? 2.5 : 1.35);
        stroke(this.highways[0], "#f2d89e", s > 5 ? 1.3 : 0.7);
      }
      if (this.opts.rail) {
        stroke(this.rail[0], "#70685f", 1.1, [4, 2]);
        if (s > 3.3) stroke(this.rail[1], "#81796c", 0.9, [3, 2]);
      }
    }
    stroke(this.boundary, "rgba(247,237,190,.85)", s > 4 ? 3 : 2.3);
    stroke(this.boundary, "#436247", s > 4 ? 1.6 : 1.2);
  }
  drawLand(screen, view, nativeArt, oceanVisible) {
    const s = view.s,
      terrain = this.lens.id === "terrain";
    const visible = s >= 5 ? (view.visible ?? this.visible(view)) : null;
    const sourceLayer =
      this.sourceAreas.enabled && this.sourceAreas.layer(this.lens);
    screen.save();
    screen.clip(this.boundary, "evenodd");
    if (terrain && oceanVisible) screen.clip(this.dryLand, "evenodd");
    // Applying these detailed clips to hundreds of individual draws is slow in
    // Safari. Draw the land at native resolution and clip one image instead.
    let c = screen;
    if (visible || sourceLayer) {
      this.landInk ??= document.createElement("canvas").getContext("2d");
      c = this.landInk;
      if (c.canvas.width !== screen.canvas.width)
        c.canvas.width = screen.canvas.width;
      if (c.canvas.height !== screen.canvas.height)
        c.canvas.height = screen.canvas.height;
      c.save();
      c.resetTransform();
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      c.setTransform(screen.getTransform());
    }
    if (sourceLayer) this.sourceAreas.draw(c, this, sourceLayer, view);
    else if (s < 5) c.drawImage(this.cache, ...this.cacheBox);
    else this.paintCells(c, visible, 1 + 0.45 / s);
    if (this.lens.id === "terrain" && s < 15) {
      c.globalCompositeOperation = "multiply";
      c.globalAlpha = 0.34;
      this.drawRelief(c, view);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }
    if (s >= 5 && this.opts.grid && !sourceLayer) {
      c.beginPath();
      for (const i of visible) {
        const xy = this.coords[i];
        polygon(c, xy[0], xy[1]);
      }
      c.lineWidth = 0.57 / s;
      c.strokeStyle =
        this.lens.id === "terrain"
          ? "rgba(53,62,39,.27)"
          : "rgba(47,55,54,.20)";
      c.stroke();
    }
    if (nativeArt && view.artwork) {
      c.save();
      c.resetTransform();
      c.drawImage(view.artwork, 0, 0);
      c.restore();
    } else if (nativeArt) {
      this.civ.terrain(c, visible, s, this.opts.places, this.opts.water, view.dpr);
    } else if (s > 6 && terrain && this.opts.art) {
      c.globalAlpha = Math.min(0.96, (s - 6) / 4);
      for (const i of visible) {
        const [x, y] = this.coords[i],
          e = this.m.val(i, "elev"),
          slope = Math.abs(this.m.val(i, "shade")),
          cover = this.m.val(i, "cover");
        let kind = this.values[i];
        if (kind === "water") continue;
        if (kind === "forest" && e > 1400 && slope > 22) kind = "greenridge";
        else if (kind === "urban" && cover <= 22) kind = "village";
        else if (
          !["urban", "farm", "forest", "alpine", "wetland"].includes(kind) &&
          e > 800 &&
          slope > 10
        )
          kind = e > 2200 ? "peak" : "ridge";
        const row = artRows.indexOf(kind);
        if (row < 0) continue;
        const variant = ((i * 37) ^ (i >>> 4)) & 7;
        c.drawImage(
          this.m.art,
          variant * 112,
          row * 128,
          112,
          128,
          x - 0.5,
          y - R,
          1,
          2 * R,
        );
      }
      c.globalAlpha = 1;
    }
    if (c !== screen) {
      c.restore();
      screen.resetTransform();
      screen.drawImage(c.canvas, 0, 0);
    }
    screen.restore();
  }
  drawOcean(c, view) {
    c.save();
    c.clip(this.ocean, "evenodd");
    this.drawRelief(c, view);
    if (this.opts.art) {
      c.lineJoin = "round";
      for (const [width, color] of [
        [0.34, "rgba(130,210,217,.40)"],
        [0.11, "rgba(231,242,215,.86)"],
      ]) {
        c.lineWidth = Math.min(width, 11 / view.s);
        c.strokeStyle = color;
        c.stroke(this.ocean);
      }
      drawOceanTexture(c, view, { Rpx: R * view.s });
    }
    c.restore();
  }
  drawLabels(c) {
    const s = this.scale;
    if (s < 6) {
      for (const [name, x, y, a, type] of regions) {
        const [px, py] = this.screen(x, y);
        c.save();
        c.translate(px, py);
        c.rotate(a);
        c.textAlign = "center";
        const sea = type === "sea";
        c.font = sea
          ? "italic 18px Georgia,serif"
          : type === "state"
            ? "600 12px Georgia,serif"
            : "italic 12px Georgia,serif";
        c.letterSpacing = sea ? "3.6px" : type === "state" ? "3px" : "1.5px";
        c.fillStyle = sea
          ? "#b7d4de"
          : type === "state"
            ? "#7c7864"
            : "#696950";
        c.fillText(name, 0, 0);
        c.restore();
      }
    }
    if (this.opts.places)
      this.civ.banners(
        c,
        this,
        this.lens.id === "terrain" && this.opts.art && s * R >= GLYPHS_MIN_RPX,
      );
    drawSites(c, this);
    if (this.opts.utility) this.utility.draw(c, this);
    if (this.lens.id === "sceCooling" && s >= 6) {
      c.save();
      for (const site of this.m.portals.cooling.sites) {
        const [x, y] = this.screen(site.x, site.y);
        if (x < -8 || y < -8 || x > this.w + 8 || y > this.h + 8) continue;
        c.beginPath();
        c.arc(x, y, 5, 0, Math.PI * 2);
        c.fillStyle = "#246b82";
        c.fill();
        c.lineWidth = 1.4;
        c.strokeStyle = "#fff5d7";
        c.stroke();
        c.beginPath();
        for (let n = 0; n < 6; n++) {
          c.moveTo(x, y);
          c.lineTo(
            x + 3 * Math.cos((n * Math.PI) / 3),
            y + 3 * Math.sin((n * Math.PI) / 3),
          );
        }
        c.stroke();
        this.labels.unshift({
          kind: "cooling",
          p: site,
          x0: x - 6,
          x1: x + 6,
          y0: y - 6,
          y1: y + 6,
        });
      }
      c.restore();
    }
  }
  highlights() {
    const c = this.ink;
    this.normal(c);
    c.clearRect(0, 0, this.w, this.h);
    this.frame(c);
    this.sourceAreas.highlight(c, this);
    const activeArea =
      this.opts.utility && (this.utilityHover || this.utility.selection?.area);
    if (activeArea) {
      const { col, row, width } = activeArea;
      const x = (col + Math.abs(row % 2) / 2) * width,
        y = row * ROW * width;
      c.save();
      c.clip(this.boundary, "evenodd");
      c.beginPath();
      polygon(c, x, y, width);
      c.fillStyle = "rgba(249,204,74,.10)";
      c.fill();
      c.lineWidth = 3.6 / this.scale;
      c.strokeStyle = "rgba(255,244,194,.94)";
      c.stroke();
      c.lineWidth = 1.6 / this.scale;
      c.strokeStyle = "#6f6227";
      c.setLineDash([5 / this.scale, 3 / this.scale]);
      c.stroke();
      c.restore();
    }
    for (const [i, selected] of [
      [this.hover, false],
      [this.selected, true],
    ]) {
      if (i < 0) continue;
      const [x, y] = this.coords[i],
        s = this.scale;
      c.save();
      c.clip(this.boundary, "evenodd");
      c.beginPath();
      polygon(c, x, y);
      c.fillStyle = selected ? "rgba(255,223,89,.47)" : "rgba(255,250,206,.35)";
      c.fill();
      c.strokeStyle = selected ? "#264d3c" : "#414c3d";
      c.lineWidth = 2 / s;
      c.stroke();
      c.restore();
      if (selected && s < 15) {
        const [sx, sy] = this.screen(x, y);
        c.save();
        this.normal(c);
        c.beginPath();
        c.arc(sx, sy, 7, 0, Math.PI * 2);
        c.strokeStyle = "#fff3bc";
        c.lineWidth = 4;
        c.stroke();
        c.strokeStyle = "#215344";
        c.lineWidth = 2;
        c.stroke();
        c.restore();
      }
    }
  }
  drawMini() {
    const c = this.mini.getContext("2d"),
      w = this.mini.width,
      h = this.mini.height,
      b = this.fitBounds;
    if (
      !this.miniBase ||
      this.miniBase.width !== w ||
      this.miniBase.height !== h
    ) {
      const s = Math.min((w - 14) / (b[2] - b[0]), (h - 12) / (b[3] - b[1]));
      const ox = w / 2 - ((b[0] + b[2]) / 2) * s;
      const oy = h / 2 - ((b[1] + b[3]) / 2) * s;
      this.miniT = { s, ox, oy };
      this.miniBase = document.createElement("canvas");
      this.miniBase.width = w;
      this.miniBase.height = h;
      const base = this.miniBase.getContext("2d");
      base.fillStyle = "#e1e2ce";
      base.fillRect(0, 0, w, h);
      base.setTransform(s, 0, 0, s, ox, oy);
      base.fillStyle = "#819678";
      base.fill(this.boundary, "evenodd");
      base.strokeStyle = "#627e60";
      base.lineWidth = 0.8 / s;
      base.stroke(this.boundary);
    }
    const { s, ox, oy } = this.miniT;
    c.resetTransform();
    c.drawImage(this.miniBase, 0, 0);
    c.setTransform(s, 0, 0, s, ox, oy);
    const [x, y] = this.world(0, 0),
      [x1, y1] = this.world(this.w, this.h);
    c.strokeStyle = "#ce863a";
    c.lineWidth = 2 / s;
    c.strokeRect(x, y, x1 - x, y1 - y);
  }
  local(e) {
    const b = this.overlay.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  }
  hitLabel(pos) {
    return (
      this.labels.find(
        (l) =>
          pos[0] >= l.x0 && pos[0] <= l.x1 && pos[1] >= l.y0 && pos[1] <= l.y1,
      ) || this.sourceAreas.pick(this, ...this.world(...pos))
    );
  }
  events() {
    const el = this.overlay;
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom(
          Math.exp(
            -clamp(e.deltaY, -140, 140) * (e.deltaMode === 1 ? 0.027 : 0.0027),
          ),
          ...this.local(e),
        );
      },
      { passive: false },
    );
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      el.focus({ preventScroll: true });
      const pos = this.local(e);
      this.recentMoves.set(e.pointerId, pos);
      el.setPointerCapture(e.pointerId);
      this.hover = -1;
      this.utilityHover = null;
      this.sourceAreas.hover = null;
      this.onHover?.(-1);
      if (this.recentMoves.size === 1) this.pointerStart = { pos, drag: false };
      else if (this.pointerStart) this.pointerStart.drag = true;
    });
    el.addEventListener("pointermove", (e) => {
      const pos = this.local(e),
        old = this.recentMoves.get(e.pointerId);
      if (old) {
        if (this.recentMoves.size === 2) {
          const other = [...this.recentMoves.entries()].find(
            ([id]) => id !== e.pointerId,
          )[1];
          const a = Math.hypot(old[0] - other[0], old[1] - other[1]),
            b = Math.hypot(pos[0] - other[0], pos[1] - other[1]);
          const oldMid = [(old[0] + other[0]) / 2, (old[1] + other[1]) / 2],
            newMid = [(pos[0] + other[0]) / 2, (pos[1] + other[1]) / 2];
          const ground = this.world(...oldMid);
          if (a > 1) this.z = clamp((this.z * b) / a, 0.7, 60);
          this.x = ground[0] - (newMid[0] - this.w / 2) / this.scale;
          this.y = ground[1] - (newMid[1] - this.h / 2) / this.scale;
          this.atHome = false;
          this.clipCamera();
          this.queue();
          this.onView?.();
        } else if (this.pointerStart) {
          if (
            Math.hypot(
              pos[0] - this.pointerStart.pos[0],
              pos[1] - this.pointerStart.pos[1],
            ) > 3
          )
            this.pointerStart.drag = true;
          if (this.pointerStart.drag) {
            this.x -= (pos[0] - old[0]) / this.scale;
            this.y -= (pos[1] - old[1]) / this.scale;
            this.atHome = false;
            this.clipCamera();
            this.queue();
            this.onView?.();
            el.classList.add("dragging");
          }
        }
        this.recentMoves.set(e.pointerId, pos);
        return;
      }
      const i = this.cellAt(...this.world(...pos));
      const label = this.hitLabel(pos);
      this.utilityHover = label?.kind === "utility" ? label.p : null;
      this.sourceAreas.hover = label?.kind === "source" ? label : null;
      this.hover = this.utilityHover || this.sourceAreas.hover ? -1 : i;
      this.highlights();
      this.onHover?.(i, pos, label);
    });
    const finish = (e, cancel) => {
      if (!this.recentMoves.has(e.pointerId)) return;
      const pos = this.local(e);
      this.recentMoves.delete(e.pointerId);
      if (
        !cancel &&
        !this.recentMoves.size &&
        this.pointerStart &&
        !this.pointerStart.drag
      ) {
        const label = this.hitLabel(pos);
        const cell = this.cellAt(...this.world(...pos));
        this.onPick?.(cell, label);
      }
      if (!this.recentMoves.size) {
        this.pointerStart = null;
        el.classList.remove("dragging");
      }
    };
    el.addEventListener("pointerup", (e) => finish(e, false));
    el.addEventListener("pointercancel", (e) => finish(e, true));
    el.addEventListener("pointerleave", () => {
      this.hover = -1;
      this.sourceAreas.hover = null;
      this.utilityHover = null;
      this.highlights();
      this.onHover?.(-1);
    });
    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.zoom(2, ...this.local(e));
    });
    el.addEventListener("keydown", (e) => {
      const shift = e.shiftKey ? 140 : 45;
      const offsets = {
        ArrowLeft: [-shift, 0],
        ArrowRight: [shift, 0],
        ArrowUp: [0, -shift],
        ArrowDown: [0, shift],
      };
      if (offsets[e.key]) {
        e.preventDefault();
        const [x, y] = offsets[e.key];
        this.go(this.x + x / this.scale, this.y + y / this.scale, this.z);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.onPick?.(
          this.cellAt(this.x, this.y),
          this.hitLabel([this.w / 2, this.h / 2]),
        );
      }
    });
    this.mini.addEventListener("click", (e) => {
      const r = this.mini.getBoundingClientRect(),
        { s, ox, oy } = this.miniT;
      this.go(
        (((e.clientX - r.left) * this.mini.width) / r.width - ox) / s,
        (((e.clientY - r.top) * this.mini.height) / r.height - oy) / s,
        this.z,
      );
    });
  }
}
