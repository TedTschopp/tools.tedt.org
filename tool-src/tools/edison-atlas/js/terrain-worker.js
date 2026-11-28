import { terrainGrid, paintCivTerrain } from "./civ-terrain.js";

let land, settled, surface;
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
  // Each transfer also gives the next patch a fresh transparent surface.
  const image = surface.transferToImageBitmap();
  self.postMessage(image, [image]);
};
