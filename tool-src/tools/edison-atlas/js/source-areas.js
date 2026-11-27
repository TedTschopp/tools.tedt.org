import { band } from "./lenses.js";

export const shapeNames = {
  bg: "Block groups",
  tract: "Census tracts",
  health: "Census tracts",
  zcta: "ZIP areas",
  planningRegion: "48-mile regions",
  work: "Block groups",
};

export class SourceAreas {
  constructor(model) {
    this.model = model;
    this.enabled = false;
    this.selection = null;
    this.hover = null;
    this.cache = new Map();
  }
  layer(lens) {
    const id = this.model.local.fields[lens.id]?.layer;
    return shapeNames[id] ? id : null;
  }
  shape(layer, index) {
    const key = layer + ":" + index;
    let path = this.cache.get(key);
    if (!path) {
      const entry = this.model.outlines[layer][index];
      path = new Path2D();
      for (const ring of entry[4]) {
        let x = ring[0],
          y = ring[1];
        path.moveTo(x / 1000, y / 1000);
        for (let i = 2; i < ring.length; i += 2) {
          x += ring[i];
          y += ring[i + 1];
          path.lineTo(x / 1000, y / 1000);
        }
        path.closePath();
      }
      this.cache.set(key, path);
    }
    return path;
  }
  row(layer, index) {
    return this.model.local.tables[layer].rows[index];
  }
  value(lens, index) {
    const field = this.model.local.fields[lens.id];
    return this.row(field.layer, index)[field.index];
  }
  pick(map, x, y) {
    const layer = this.enabled && this.layer(map.lens);
    if (!layer || !map.hitCtx.isPointInPath(map.boundary, x, y, "evenodd"))
      return;
    const data = this.model.outlines[layer],
      xx = x * 1000,
      yy = y * 1000;
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (xx < b[0] || yy < b[1] || xx > b[2] || yy > b[3]) continue;
      if (map.hitCtx.isPointInPath(this.shape(layer, i), x, y, "evenodd"))
        return { kind: "source", layer, index: i };
    }
  }
  draw(ctx, map, layer, view) {
    const data = this.model.outlines[layer],
      z = map.scale;
    ctx.fillStyle = "#a4a49a";
    ctx.fill(map.boundary, "evenodd");
    ctx.lineWidth = 0.65 / z;
    ctx.strokeStyle = "rgba(50,65,53,.55)";
    ctx.lineJoin = "round";
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (
        b[2] < view.x0 * 1000 ||
        b[0] > view.x1 * 1000 ||
        b[3] < view.y0 * 1000 ||
        b[1] > view.y1 * 1000
      )
        continue;
      const color =
        map.legend[band(map.lens, this.value(map.lens, i), map.legend)]
          ?.color || "#a4a49a";
      const path = this.shape(layer, i);
      ctx.fillStyle = color;
      ctx.fill(path, "evenodd");
      if (z >= 4) ctx.stroke(path);
    }
  }
  highlight(ctx, map) {
    const layer = this.layer(map.lens);
    if (!layer) return;
    let hit = this.hover || this.selection;
    if (!hit && map.selected >= 0)
      hit = { layer, index: this.model.val(map.selected, layer) };
    if (!hit || hit.layer !== layer || hit.index == null || hit.index < 0)
      return;
    const path = this.shape(layer, hit.index);
    ctx.save();
    ctx.clip(map.boundary, "evenodd");
    ctx.lineWidth = 3.5 / map.scale;
    ctx.strokeStyle = "#fff9dc";
    ctx.stroke(path);
    ctx.lineWidth = 1.4 / map.scale;
    ctx.strokeStyle = "#164c3b";
    ctx.stroke(path);
    ctx.restore();
  }
}
