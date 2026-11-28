import { makeGrid } from "./usaciv/hex.js";
import { drawTerrainGlyphs } from "./usaciv/render/art/terrain.js";
import { cityIsDot, drawCityTile } from "./usaciv/render/art/city.js";
import { drawWaterGlyphs } from "./usaciv/render/art/water.js";

// The source artwork uses a 25-unit hex radius. The atlas grid is one mile wide.
export const R = 1 / Math.sqrt(3),
  UNIT = R / 25;
export const CALIFORNIA = [77, 148, 90];

export function terrainGrid({ cols, rows, col0, row0, present }) {
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
    },
  };
}

export function paintCivTerrain(ctx, cells, world, scale, water, pixelRatio) {
  const Rpx = R * scale;
  ctx.save();
  ctx.scale(UNIT, UNIT);
  drawTerrainGlyphs(ctx, cells, world, { Rpx, s: scale * UNIT, pixelRatio });
  if (water && cells.some((j) => world.water[j])) {
    drawWaterGlyphs(ctx, cells, world, { Rpx, s: scale * UNIT });
  }
  ctx.restore();
  // The native city painter also supplies block layouts for medium/high-intensity
  // NLCD cells. Only real place records produce a named city or population banner.
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
      { Rpx, s: scale, seed, stateColor: CALIFORNIA },
    );
  }
}
