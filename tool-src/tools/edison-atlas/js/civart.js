import {
  R,
  UNIT,
  CALIFORNIA,
  terrainGrid,
  paintCivTerrain,
} from "./civ-terrain.js";
import { money } from "./usaciv/format.js";
import { COVER } from "./usaciv/terrain.js";
import {
  CITY_CLASSES,
  cityIsDot,
  drawCityDot,
} from "./usaciv/render/art/city.js";
import { drawBanners } from "./usaciv/render/banners.js";
import { drawPlaque, drawWonder } from "./usaciv/render/art/sites.js";
import { drawRivers } from "./usaciv/render/art/water.js";

const ROW = Math.sqrt(3) / 2;
const CONTEXT = [97, 108, 110];
const nlcd = {
  12: COVER.ICE,
  21: COVER.GRASS,
  22: COVER.URBAN,
  23: COVER.URBAN,
  24: COVER.URBAN,
  31: COVER.BARREN,
  41: COVER.DECIDUOUS,
  42: COVER.EVERGREEN,
  43: COVER.MIXED,
  52: COVER.SCRUB,
  71: COVER.GRASS,
  81: COVER.PASTURE,
  82: COVER.CROP,
  90: COVER.WETLAND,
  95: COVER.WETLAND,
};
const classes = Object.fromEntries(CITY_CLASSES.map((c) => [c.id, c]));
const districts = {
  23: { artClass: classes.town, minTileRpx: 20, capital: false },
  24: { artClass: classes.city, minTileRpx: 16, capital: false },
};
const citySizes = [
  [375000, "megalopolis", 10],
  [140000, "metropolis", 12],
  [50000, "city", 14],
  [10000, "town", 18],
  [0, "village", 22],
];
const popFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
// Icon colors and order are from USACiv's nation.json. Gold is GDP in dollars.
const metroFields = Object.entries({
  food: "#7fbf3f",
  production: "#d9823b",
  gold: "#f2c94c",
  science: "#4fa3e0",
  culture: "#b07ce0",
}).map(([key, color]) => ({
  key,
  color,
  icon: "y-" + key,
  ...(key === "gold" ? { format: money } : {}),
}));
const parkMotifs = {
  YOSE: "peak",
  JOTR: "desert",
  CHIS: "coast",
  SAMO: "canyon",
  SEQU: "forest",
  KICA: "canyon",
  CECH: "memorial",
  CAMO: "desert",
  MOJA: "desert",
};

export class CivArt {
  constructor(model, places, locate) {
    const [west, north, east, south] = model.meta.bounds;
    const col0 = Math.floor(west) - 2,
      row0 = 2 * Math.floor(north / (2 * ROW)) - 2;
    const cols = Math.ceil(east) - col0 + 3,
      rows = Math.ceil(south / ROW) - row0 + 3;
    const n = rows * cols,
      indices = (this.indices = new Int32Array(model.meta.cells));
    const present = new Uint8Array(n),
      cover = new Uint8Array(n),
      water = new Uint8Array(n);
    const raw = { elev: new Int16Array(n), owner: new Int8Array(n) };
    const geography = { lon: new Float32Array(n), lat: new Float32Array(n) };
    const relief = new Uint8Array(n),
      districtCells = new Map();
    this.gridLayout = { cols, rows, col0, row0, present };
    const grid = terrainGrid(this.gridLayout);
    for (let i = 0; i < indices.length; i++) {
      const j = (indices[i] =
        (model.val(i, "row") - row0) * cols + model.val(i, "col") - col0);
      const code = model.val(i, "cover");
      present[j] = 1;
      raw.elev[j] = model.val(i, "elev") ?? 0;
      geography.lon[j] = model.val(i, "lon") / 1e5;
      geography.lat[j] = model.val(i, "lat") / 1e5;
      cover[j] = nlcd[code] ?? COVER.NONE;
      water[j] = code === 11 ? 3 : 0;
      if (districts[code]) districtCells.set(j, districts[code]);
    }
    for (const j of indices) {
      let min = raw.elev[j],
        max = min;
      for (let d = 0; d < 6; d++) {
        const k = grid.neighbour(j, d);
        if (k < 0 || water[k]) continue;
        min = Math.min(min, raw.elev[k]);
        max = Math.max(max, raw.elev[k]);
      }
      const range = max - min;
      relief[j] =
        cover[j] === COVER.ICE || (raw.elev[j] > 2900 && range > 140)
          ? 3
          : range >= 285
            ? 2
            : range >= 95
              ? 1
              : 0;
    }
    raw.rivers = model.context.rivers.map(([rank, points]) => ({
      rank,
      pts: points.flatMap(([x, y]) => [x / UNIT, y / UNIT]),
    }));
    this.land = {
      grid,
      raw,
      relief,
      cover,
      water,
      geography,
      cityByCell: districtCells,
    };
    this.settled = { ...this.land, cityByCell: new Map(districtCells) };
    const metros = new Map(
      Object.values(model.reg.metros).map((region) => [region.name, region]),
    );
    this.badges = new Map();
    this.nation = model.profiles.nation;
    this.cities = places.map((p, cell) => {
      const [, tier, minTileRpx] = citySizes.find(
        ([min]) => (p.pop ?? 0) >= min,
      );
      const city = {
        ...p,
        source: p,
        cell,
        population: p.pop,
        populationLabel: p.pop == null ? "–" : popFormat.format(p.pop),
        capital: false,
        artClass: classes[tier],
        minTileRpx,
        ax: p.x,
        ay: p.y,
        sampleIndex: p.inside ? locate(p.x, p.y) : -1,
        tileIndex: -1,
      };
      const metro = p.id.startsWith("06") && metros.get(p.name);
      if (metro) {
        city.metroId = metro.id;
        city.yields = metro.yields;
        city.bannerFields = metroFields.filter(
          (f) => metro.yields?.[f.key] != null,
        );
        city.metroPopulation = metro.population;
        city.jobs = metro.jobs;
        const badge = metro.districts?.badge;
        this.badges.set(p.id, {
          label: badge ? badge.label + " · Metro" : "Metro yields",
          color: model.profiles.districtColors[badge?.district] || "#506a84",
        });
      }
      return city;
    });
    // Give metro anchors first choice of the limited label space at regional zooms.
    this.overviewCities = [...this.cities].sort(
      (a, b) => (b.metroPopulation || 0) - (a.metroPopulation || 0),
    );
    this.byId = new Map(this.cities.map((c) => [c.id, c]));
    // Where two place points share a hex, its skyline belongs to the larger place.
    const occupied = new Set();
    for (const p of [...this.cities].sort(
      (a, b) => (b.pop || 0) - (a.pop || 0),
    )) {
      const i = p.sampleIndex;
      if (i < 0 || occupied.has(i) || water[indices[i]]) continue;
      const j = indices[i];
      const x = grid.cx(j) * UNIT,
        y = grid.cy(j) * UNIT;
      if (model.val(i, "coverage") < 1e6 && locate(x, y) !== i) continue;
      occupied.add(i);
      p.tileIndex = j;
      p.ax = x;
      p.ay = y;
      this.settled.cityByCell.set(j, p);
    }
    this.bannerWorld = {
      grid: { R, cx: (i) => this.cities[i].ax, cy: (i) => this.cities[i].ay },
      raw: { owner: this.cities.map((p) => (p.inside ? 0 : 1)) },
      stateColor: [CALIFORNIA, CONTEXT],
    };
  }

  terrain(ctx, visible, scale, places, water, pixelRatio) {
    const world = places ? this.settled : this.land;
    const cells = visible.map((i) => this.indices[i]);
    paintCivTerrain(ctx, cells, world, scale, water, pixelRatio);
  }

  terrainData() {
    const { raw, water, relief, cover, geography, cityByCell } = this.land;
    // Banners include format functions. The worker needs only the city tile fields.
    const places = this.cities
      .filter((p) => p.tileIndex >= 0)
      .map((p) => [
        p.tileIndex,
        {
          id: p.id,
          name: p.name,
          capital: p.capital,
          population: p.population,
          artClass: p.artClass,
          minTileRpx: p.minTileRpx,
          source: true,
        },
      ]);
    return {
      layout: this.gridLayout,
      places,
      world: {
        raw: { elev: raw.elev, owner: raw.owner },
        water,
        relief,
        cover,
        geography,
        cityByCell,
      },
    };
  }

  rivers(ctx, scale) {
    ctx.save();
    ctx.scale(UNIT, UNIT);
    drawRivers(ctx, this.land, { s: scale * UNIT, Rpx: scale * R });
    ctx.restore();
  }

  banners(ctx, map, showBuildings) {
    const s = map.scale,
      Rpx = R * s;
    const sel = map.place && this.byId.get(map.place.id);
    const candidates = s < 12 ? this.overviewCities : this.cities;
    const cities = candidates.filter((p) => {
      if (p === sel || p.metroId) return true;
      if (s < 3.4 && (p.priority < 0 || (p.name === "Avalon" && map.w < 480)))
        return false;
      return (
        p.priority >= 0 || s >= 16 || (p.pop ?? 0) >= (s < 7 ? 55000 : 5000)
      );
    });
    const cam = {
      w: map.w,
      h: map.h,
      scale: s,
      toScreen: (x, y) => map.screen(x, y),
    };
    // The small tab identifies the geography of the optional second tier.
    const hits = drawBanners(
      ctx,
      cam,
      this.bannerWorld,
      {
        cities,
        selectedCity: sel,
        cityBadges: this.badges,
        metroYields: true,
        nation: this.nation,
        minBannerPopulation: 0,
      },
      null,
    );
    for (const hit of hits) {
      const p = hit.city;
      if (p.metroId && hit.yieldTop != null) {
        map.labels.push({
          x0: hit.x, x1: hit.x + hit.w, y0: hit.yieldTop, y1: hit.y + hit.h,
          p: p.source, kind: "metro", id: p.metroId,
        });
        if (hit.plateTop > hit.y)
          map.labels.push({
            x0: hit.x, x1: hit.x + hit.w, y0: hit.y, y1: hit.plateTop,
            p: p.source, kind: "metro", id: p.metroId,
          });
      }
      map.labels.push({
        x0: hit.x,
        y0: hit.y,
        x1: hit.x + hit.w,
        y1: hit.y + hit.h + 4,
        p: p.source,
        kind: "place",
        metroPlate: Boolean(p.metroId && hit.yieldTop != null),
      });
    }
    for (const p of cities) {
      const [x, y] = map.screen(p.ax, p.ay);
      if (x < 0 || y < 0 || x > map.w || y > map.h) continue;
      const tiled = showBuildings && p.tileIndex >= 0 && !cityIsDot(p, Rpx);
      if (!tiled) {
        // Use the same bronze city disc as the source. Only readable dots appear at overview scale.
        if (s < 5 && !hits.some((h) => h.city === p)) continue;
        drawCityDot(ctx, x, y, 1, { s: 1, Rpx: 1, population: p.population });
      }
      const radius = tiled ? Math.max(5, 0.52 * Rpx) : 5;
      map.labels.push({
        x0: x - radius,
        y0: y - radius,
        x1: x + radius,
        y1: y + radius,
        p: p.source,
        kind: "place",
        symbol: true,
      });
    }
  }
}

const overlaps = (a, b) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
export function drawSites(ctx, map) {
  const places = [];
  if (map.opts.parks)
    for (const p of map.m.context.parks) {
      places.push({
        p,
        type: "park",
        kind: p.code === "CECH" ? "landmark" : "natural",
        motif: parkMotifs[p.code],
      });
    }
  if (map.opts.landmarks)
    for (const p of map.m.context.landmarks) {
      const motif = /chapel/i.test(p.name)
        ? "mission"
        : /mansion|house/i.test(p.name)
          ? "adobe"
          : /district|shop|hotel|store/i.test(p.name)
            ? "quarter"
            : "brickhall";
      places.push({ p, type: "landmark", kind: "landmark", motif });
    }
  if (!places.length) return;
  const occupied = map.labels.filter((label) => !label.symbol),
    sites = [];
  if (map.landmark)
    places.sort(
      (a, b) => Number(b.p === map.landmark) - Number(a.p === map.landmark),
    );
  ctx.save();
  for (const { p, type, kind, motif } of places) {
    const [x, y] = map.screen(p.x, p.y);
    if (x < 0 || x > map.w || y < 0 || y > map.h) continue;
    const size = Math.min(27, Math.max(6, map.scale * 0.4));
    const marker = {
      x0: x - size,
      y0: y - size * 1.25,
      x1: x + size,
      y1: y + size * 0.8,
      p,
      kind: type,
    };
    if (sites.some((a) => overlaps(a, marker)) && p !== map.landmark) continue;
    if (occupied.some((a) => overlaps(a, marker)) && p !== map.landmark)
      continue;
    drawWonder(ctx, kind, x, y, size, { motif });
    sites.push(marker);
    if (map.scale < 6) continue;
    const top = marker.y1 + 2;
    const [x0, y0, x1, y1] = drawPlaque(ctx, p.name, x, top, {
      kind,
      measureOnly: true,
    });
    const label = { x0, y0, x1, y1, p, kind: type };
    if (
      x0 < 2 ||
      x1 > map.w - 2 ||
      y1 > map.h - 2 ||
      (p !== map.landmark &&
        [...occupied, ...sites].some((a) => overlaps(a, label)))
    )
      continue;
    drawPlaque(ctx, p.name, x, top, { kind });
    sites.push(label);
  }
  map.labels.unshift(...sites);
  ctx.restore();
}
