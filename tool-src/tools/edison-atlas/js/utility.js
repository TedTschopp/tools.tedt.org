import { categories, drawUtilityArt, kinds } from "./utility-art.js";
import { icon } from "./icons.js";
import { esc } from "./reports.js";
import { number } from "./lenses.js";

const ROW = Math.sqrt(3) / 2;
const key = (width, col, row) => width + ":" + col + "," + row;
const overlap = (a, b) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
export const areaName = (a) =>
  a.width === 1 ? "One-mile charging hex" : a.width + "-mile reporting area";
export const quantity = (v, noun) =>
  number(v) + " " + noun + (v === 1 ? "" : "s");
export function summary(kind, v) {
  return kind === "ev"
    ? quantity(v.sites, "station") + " · " + quantity(v.ports, "port")
    : quantity(v.sites, "site") + " · " + number(v.mw, 1) + " MW";
}
export function locationLabel(a) {
  return "Near " + a.near + " · " + a.col + ", " + a.row;
}
export const modeWidth = (s) => (s < 3.8 ? 48 : 12);

export class UtilityLayer {
  constructor(data) {
    this.data = data;
    this.filters = new Set(kinds);
    this.byId = new Map();
    this.selection = null;
    for (const [width, areas] of Object.entries(data.levels))
      for (const area of areas) {
        area.width = Number(width);
        area.id = key(width, area.col, area.row);
        this.byId.set(area.id, area);
      }
  }
  at(width, x, y) {
    let best = Infinity,
      id;
    x /= width;
    y /= width;
    const mid = Math.floor(y / ROW + 0.5);
    for (let r = mid - 1; r <= mid + 1; r++) {
      const offset = Math.abs(r % 2) / 2,
        c = Math.floor(x - offset + 0.5);
      const d = (x - c - offset) ** 2 + (y - r * ROW) ** 2;
      if (d < best) {
        best = d;
        id = key(width, c, r);
      }
    }
    return this.byId.get(id);
  }
  draw(c, map) {
    const s = map.scale,
      w = modeWidth(s),
      local = s >= 22;
    const hits = [],
      reserved = [],
      names = map.labels.filter((h) => !h.symbol),
      metroPlates = names.filter((h) => h.metroPlate);
    const placeGroup = (area, enabled, size, detail, movable) => {
      if (!enabled.length) return;
      const [ax, ay] = map.screen(area.x, area.y);
      const cols = Math.min(2, enabled.length),
        rows = Math.ceil(enabled.length / cols);
      const step = size * (detail ? 0.92 : 0.91),
        height = step * (rows - 1) + size;
      const width = step * (cols - 1) + size,
        tag = area.width > 1 && detail;
      if (
        ax + width < 0 ||
        ax - width > map.w ||
        ay + height < 0 ||
        ay - height > map.h
      )
        return;
      // A short leader keeps group symbols readable beside a town banner. Individual
      // charging hexes retain their exact grid anchor.
      let px = ax,
        py = ay;
      if (movable) {
        const shift = Math.min(18, s * area.width * 0.23);
        const positions = [[0, 0], [0, shift], [0, -shift], [shift, 0], [-shift, 0]];
        const halfWidth = Math.max(width / 2, tag ? 15 : 0);
        const top = height / 2, bottom = height / 2 + (tag ? 11 : 0);
        const boxAt = (dx, dy) => ({
          x0: ax + dx - halfWidth, x1: ax + dx + halfWidth,
          y0: ay + dy - top, y1: ay + dy + bottom,
        });
        // Keep reporting-area symbols nearby, using a leader when a ribbon covers the anchor.
        const anchor = boxAt(0, 0);
        for (const plate of metroPlates) {
          if (!overlap(plate, anchor)) continue;
          const exits = [
            [0, plate.y1 + top + 3 - ay], [0, plate.y0 - bottom - 3 - ay],
            [plate.x0 - halfWidth - 3 - ax, 0], [plate.x1 + halfWidth + 3 - ax, 0],
          ].sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
          positions.push(...exits.filter(([dx, dy]) => {
            const box = boxAt(dx, dy);
            return box.x0 >= 0 && box.y0 >= 0 && box.x1 <= map.w && box.y1 <= map.h;
          }));
        }
        let score = Infinity;
        for (const [dx, dy] of positions) {
          const box = boxAt(dx, dy);
          const cost = reserved.filter((b) => overlap(b, box)).length * 3 +
            names.filter((b) => overlap(b, box)).length +
            (metroPlates.some((b) => overlap(b, box)) ? 1 + names.length + 3 * reserved.length : 0);
          if (cost < score) {
            score = cost;
            px = ax + dx;
            py = ay + dy;
          }
          if (cost === 0) break;
        }
        reserved.push({
          x0: px - width / 2,
          y0: py - height / 2,
          x1: px + width / 2,
          y1: py + height / 2 + (tag ? 11 : 0),
        });
        if (px !== ax || py !== ay) {
          c.beginPath();
          c.moveTo(ax, ay);
          c.lineTo(px, py);
          c.strokeStyle = "rgba(59,60,41,.68)";
          c.lineWidth = 1.3;
          c.stroke();
        }
      }
      for (const [idx, kind] of enabled.entries()) {
        const row = Math.floor(idx / cols),
          len = Math.min(cols, enabled.length - row * cols);
        const x = px + ((idx % cols) - (len - 1) / 2) * step,
          y = py + (row - (rows - 1) / 2) * step;
        const selected =
          this.selection?.area === area && this.selection.kind === kind;
        if (selected) {
          c.beginPath();
          c.ellipse(x, y, size * 0.56, size * 0.51, 0, 0, Math.PI * 2);
          c.fillStyle = "#fcdf78";
          c.fill();
          c.lineWidth = 1.6;
          c.strokeStyle = "#574b27";
          c.stroke();
        }
        drawUtilityArt(c, kind, x, y, size, detail, selected);
        hits.push({
          x0: x - size * 0.46,
          y0: y - size * 0.5,
          x1: x + size * 0.46,
          y1: y + size * 0.47,
          kind: "utility",
          assetKind: kind,
          p: area,
        });
      }
      if (tag) {
        const ty = py + height / 2 - 2;
        c.fillStyle = "rgba(53,59,42,.94)";
        c.beginPath();
        c.roundRect(px - 15, ty, 30, 11, 3);
        c.fill();
        c.font = "bold 8px Arial";
        c.fillStyle = "#faf2d4";
        c.textAlign = "center";
        c.fillText(area.width + " mi", px, ty + 8.3);
      }
    };
    c.save();
    if (metroPlates.length) {
      // Banners are disjoint. Cut their rectangles out of the utility drawing
      // so even a one-mile charger at its exact anchor cannot obscure the text.
      const visible = new Path2D();
      visible.rect(0, 0, map.w, map.h);
      for (const p of metroPlates) visible.rect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      c.clip(visible, "evenodd");
    }
    if (local && this.filters.has("ev")) {
      const size = Math.min(48, Math.max(16, s * 0.78));
      for (const a of this.data.levels[1])
        placeGroup(a, ["ev"], size, s >= 28, false);
    }
    const detailed = s >= 8,
      size = detailed
        ? Math.min(56, Math.max(32, s * 2.1))
        : Math.max(14, Math.min(27, s * (w === 48 ? 9 : 4)));
    for (const a of this.data.levels[w]) {
      const show = kinds.filter(
        (k) => this.filters.has(k) && a.values[k] && (!local || k !== "ev"),
      );
      placeGroup(a, show, size, detailed, true);
    }
    c.restore();
    // Hit-test in the same order as the visible layers, including the clip above.
    if (!metroPlates.length) {
      map.labels.unshift(...hits.reverse());
      return;
    }
    const foreground = label => label.kind === "metro" || label.metroPlate;
    const plates = map.labels.filter(foreground);
    const others = map.labels.filter(label => !foreground(label));
    map.labels = [...plates, ...hits.reverse(), ...others];
  }
}

export function areaChoices(layer) {
  const areas = layer.data.levels[12].filter((a) =>
    kinds.some((k) => layer.filters.has(k) && a.values[k]),
  );
  return areas
    .sort(
      (a, b) => a.near.localeCompare(b.near) || a.row - b.row || a.col - b.col,
    )
    .map(
      (a) =>
        '<option value="' + a.id + '">' + esc(locationLabel(a)) + "</option>",
    )
    .join("");
}

export function kindButton(kind, v, action, checked, areaId = null) {
  const info = categories[kind];
  return (
    '<button class="utility-kind" ' +
    action +
    '="' +
    kind +
    '"' +
    (areaId ? ' data-utility-area="' + esc(areaId) + '"' : "") +
    (checked == null ? "" : ' role="switch" aria-checked="' + checked + '"') +
    ">" +
    icon(info.icon, 24) +
    "<span><b>" +
    info.name +
    "</b><small>" +
    esc(summary(kind, v)) +
    "</small></span>" +
    (checked == null
      ? icon("right", 14)
      : '<i class="switch" aria-hidden="true"></i>') +
    "</button>"
  );
}
