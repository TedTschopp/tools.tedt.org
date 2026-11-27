import { drawIcon } from "./usaciv/icons.js";
import {
  bucketPx,
  deviceScale,
  drawSprite,
  getSprite,
} from "./usaciv/render/art/sprites.js";

export const categories = {
  solar: { name: "Solar farms", icon: "r-solar" },
  wind: { name: "Wind farms", icon: "r-wind" },
  battery: { name: "Battery storage", icon: "r-battery" },
  ev: { name: "EV charging", icon: "r-ev-charging" },
};
export const kinds = Object.keys(categories);

// Isometric miniatures use the same upper-left light, bronze rim and sprite
// cache as the USACiv tile painters. Small zoom levels use its resource medallions.
const iso = (u, v, z = 0) => [u - v, (u + v) * 0.46 - z];
function face(g, points, color, edge) {
  g.beginPath();
  g.moveTo(...points[0]);
  for (const p of points.slice(1)) g.lineTo(...p);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = 0.55;
    g.stroke();
  }
}
function line(g, points, color, width = 0.75) {
  g.beginPath();
  g.moveTo(...points[0]);
  for (const p of points.slice(1)) g.lineTo(...p);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}
function box(g, u, v, w, d, h, z, colors) {
  const top = z + h,
    a = iso(u, v, top),
    b = iso(u + w, v, top),
    c = iso(u + w, v + d, top),
    e = iso(u, v + d, top);
  face(g, [e, c, iso(u + w, v + d, z), iso(u, v + d, z)], colors[1]);
  face(g, [b, c, iso(u + w, v + d, z), iso(u + w, v, z)], colors[2]);
  face(g, [a, b, c, e], colors[0], "#504b3a");
}
function solar(g) {
  for (const v of [-8, 1])
    for (const u of [-9, -2, 5]) {
      line(g, [iso(u + 2, v + 2, 0), iso(u + 2, v + 2, 4)], "#6e6b54", 1);
      const p = (a, b) => iso(u + a, v + b, 5 - b * 0.38);
      face(g, [p(0, 0), p(6, 0), p(6, 6), p(0, 6)], "#23557e", "#d4dfda");
      line(g, [p(3, 0), p(3, 6)], "#95b8c2", 0.6);
      line(g, [p(0, 3), p(6, 3)], "#75a6c1", 0.6);
    }
}
function turbine(g, u, v, h, phase) {
  const [x, y] = iso(u, v),
    hub = y - h;
  face(
    g,
    [
      [x - 1.4, y],
      [x + 0.95, y],
      [x + 0.5, hub],
      [x - 0.55, hub],
    ],
    "#d9e5da",
    "#646f64",
  );
  for (let j = 0; j < 3; j++) {
    const a = phase + (Math.PI * 2 * j) / 3,
      dx = Math.cos(a),
      dy = Math.sin(a);
    face(
      g,
      [
        [x, hub],
        [x + dx * 3 - dy, hub + dy * 3 + dx],
        [x + dx * 8.3, hub + dy * 8.3],
        [x + dx * 2 + dy * 0.55, hub + dy * 2 - dx * 0.55],
      ],
      "#f5f2df",
      "#627873",
    );
  }
  g.beginPath();
  g.arc(x, hub, 1.25, 0, Math.PI * 2);
  g.fillStyle = "#74939b";
  g.fill();
}
function wind(g) {
  turbine(g, -6, -4, 11, -0.68);
  turbine(g, 6, -5, 15, -1.34);
  turbine(g, 3, 7, 19, -1.72);
}
function battery(g) {
  for (const v of [-7, 2]) {
    box(g, -8, v, 16, 5.5, 6, 0, ["#c8d9bc", "#8eaa83", "#607c69"]);
    for (const u of [-6, -2, 2, 6]) {
      line(g, [iso(u, v + 5.5, 5.3), iso(u, v + 5.5, 0.7)], "#48695c", 0.75);
      line(
        g,
        [iso(u + 0.8, v + 5.5, 3.8), iso(u + 2.1, v + 5.5, 3.8)],
        "#d8dfbc",
        0.65,
      );
    }
    box(g, -5, v + 1.1, 5, 2.7, 0.8, 6, ["#829685", "#526d64", "#465f54"]);
  }
}
function charge(g) {
  for (const u of [-7, 4]) {
    line(g, [iso(u - 2, 1), iso(u - 2, 8), iso(u + 4, 8)], "#dfdbc7", 0.7);
    box(g, u, -5, 4.5, 3, 10, 0, ["#d5e4cb", "#e4e5c8", "#32767c"]);
    face(
      g,
      [
        iso(u + 0.5, -2, 9),
        iso(u + 4, -2, 9),
        iso(u + 4, -2, 5.5),
        iso(u + 0.5, -2, 5.5),
      ],
      "#244b50",
    );
    line(g, [iso(u + 1, -2, 7.8), iso(u + 3.3, -2, 7.8)], "#83e0bc", 0.8);
    const [x, y] = iso(u + 4.5, -3, 6.5);
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 5, y - 2, x + 3.7, y + 9, x + 1.6, y + 5);
    g.strokeStyle = "#253c3e";
    g.lineWidth = 1;
    g.stroke();
  }
}
const painters = { solar, wind, battery, ev: charge };
function paintMiniature(g, kind) {
  g.scale(1 / 24, 1 / 24);
  g.translate(0, 5);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.fillStyle = "rgba(26,28,19,.31)";
  g.beginPath();
  g.ellipse(1.6, 5.1, 22, 9.4, 0, 0, Math.PI * 2);
  g.fill();
  box(g, -11, -11, 22, 22, 2.7, -2.7, ["#ae8747", "#825e30", "#694c29"]);
  box(
    g,
    -10.4,
    -10.4,
    20.8,
    20.8,
    0.65,
    0,
    kind === "ev" || kind === "battery"
      ? ["#aaa99a", "#7c7e6c", "#666c5c"]
      : ["#b4b282", "#949567", "#777d57"],
  );
  painters[kind](g);
}
const boxBounds = { x0: -1.1, y0: -1.3, x1: 1.1, y1: 0.82 };
export function drawUtilityArt(ctx, kind, x, y, size, detailed, selected) {
  if (!detailed) {
    drawIcon(ctx, categories[kind].icon, x, y, size, {
      ring: selected ? "#fff49d" : "#d9b361",
    });
    return;
  }
  const scale = size * 0.49,
    px = bucketPx(scale * deviceScale(ctx), { min: 12, max: 150 });
  const sprite = getSprite("edison-utility:" + kind, px, boxBounds, (g) =>
    paintMiniature(g, kind),
  );
  drawSprite(ctx, sprite, x, y, scale);
  drawIcon(
    ctx,
    categories[kind].icon,
    x + size * 0.29,
    y + size * 0.2,
    Math.min(18, Math.max(11, size * 0.32)),
    { ring: selected ? "#fff49d" : "#d9b361" },
  );
}
