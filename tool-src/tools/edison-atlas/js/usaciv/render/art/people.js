// Citizen figures: little strategy-game person icons for the City View's citizen rows (citizens.json), in one shared
// drawing language so canvas and HTML (SVG) look identical. All original art.
//
// Every figure is a list of shapes in a 24×24 box (ground line at y ≈ 23): {d: SVG path, fill: role|colour,
// stroke?: role|colour, w?: stroke width, ink?: true = gets the dark outline}. Roles resolve per figure and variant:
// skin, hair, cloth (the category colour), accent, light, dark, metal, gold.
//
//   CITIZEN_KINDS                          every kind id with its label and category colour
//   citizenKind(keyOrIcon) → kind | null   accepts citizens.json keys (executive, drove_alone, less_than_hs, …) and the
//                                          suggested icon ids (c-executive, c-car, c-edu0, …)
//   drawCitizen(ctx, kind, x, y, size, opts)   canvas, centred at (x, y), `size` user units tall; sprite-cached
//   citizenSVG(kind, opts) → "<svg …>"       the same figure as an inline SVG string (for HTML)
//   opts: {variant = 0 (hair colour and a slight clothing shade, any integer: never the skin), dim = false (greyed, for
//          a figure that is "not there"), disk = null | colour (a round backing), title = "" (SVG only: accessible
//          name), shadow = true}
// Every figure has the same neutral, stylised skin tone (SKIN): the citizen rows describe occupations, ages, journeys,
// schooling and birthplace, never race, so figures must not suggest one. Do not vary it by position in a row.
import { bucketPx, deviceScale, getSprite, drawSprite } from "./sprites.js";

const f = (n) => +n.toFixed(2);
const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const rrect = (x, y, w, h, r) =>
  `M${f(x + r)} ${f(y)}H${f(x + w - r)}a${r} ${r} 0 0 1 ${r} ${r}V${f(y + h - r)}a${r} ${r} 0 0 1 ${-r} ${r}H${f(x + r)}a${r} ${r} 0 0 1 ${-r} ${-r}V${f(y + r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
const ellipse = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;

const SKIN = "#d9a982"; // one neutral tone for every figure (see the header)
const HAIR = ["#2a1d14", "#5a3a22", "#1c1a18", "#8a5a2a", "#3a2a1c", "#c9a060"];
const CLOTH_SHADE = [0, -0.1, 0.08, -0.05, 0.12]; // variant → a slight darken (−) / lighten (+) of the category colour

function shade(hex, amt) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
  if (!m || !amt) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
const INK = "rgba(28,20,12,.92)";

// --- body parts ---------------------------------------------------------------------------------------------------

const HEAD = (cx = 12, cy = 6.9, r = 3.5) => ({ d: circle(cx, cy, r), fill: "skin", ink: true });
const BODY = "M4.8 23V18.4C4.8 14.1 7.9 11.4 12 11.4S19.2 14.1 19.2 18.4V23Z";
const body = (fill = "cloth") => ({ d: BODY, fill, ink: true });
const HAIR_SHORT = { d: "M8.5 6.6c0-2.6 1.6-4 3.5-4s3.5 1.4 3.5 4c-.8-1-2-1.6-3.5-1.6S9.3 5.6 8.5 6.6Z", fill: "hair" };
const HAIR_LONG = { d: "M8.3 7.2c-.2-3 1.4-4.7 3.7-4.7s3.9 1.7 3.7 4.7l.4 3.8-1.6-.4-.2-3.6c-.8-.9-2-1.4-2.3-1.6-.6.8-2.1 1.4-3.3 1.6l-.2 3.6-1.6.4Z", fill: "hair" };
const HAIR_GREY = { d: "M8.4 7.4c-.3-3 1.6-4.8 3.6-4.8s3.9 1.8 3.6 4.8c-.5-.6-.8-1.6-1-2.2-1.4.6-3.8.6-5.2 0-.2.6-.5 1.6-1 2.2Z", fill: "#e6e2da" };

const person = (extra = {}) => {
  const hair = extra.hair === "long" ? HAIR_LONG : extra.hair === "grey" ? HAIR_GREY : extra.hair === "none" ? null : HAIR_SHORT;
  return [...(extra.back || []), body(extra.cloth || "cloth"), ...(extra.torso || []), HEAD(), ...(hair ? [hair] : []), ...(extra.head || []), ...(extra.front || [])];
};

// Small round badge at the lower right with a symbol, for the nativity and education rows.
const badge = (symbol, fill = "gold") => [
  { d: circle(18.6, 18.6, 4.1), fill, ink: true },
  ...symbol,
];

// --- the figures --------------------------------------------------------------------------------------------------

/** kind → {label, row, cloth, accent, shapes(variant)} */
export const CITIZEN_KINDS = {
  // workforce (C24010)
  executive: {
    label: "Executive", row: "workforce", cloth: "#2c3e66", accent: "#c0392b",
    shapes: () => person({
      torso: [
        { d: "M9.7 11.8L12 16.4l2.3-4.6Z", fill: "#f4f1ea" },
        { d: "M11.4 12.6h1.2l.6 3.6-1.2 1.6-1.2-1.6Z", fill: "accent" },
      ],
      front: [
        { d: rrect(14.6, 17.6, 6.4, 4.6, 0.7), fill: "#7a4a24", ink: true },
        { d: "M16.4 17.6v-1a1 1 0 0 1 1-1h1.2a1 1 0 0 1 1 1v1", fill: "none", stroke: "#3a2412", w: 0.9 },
      ],
    }),
  },
  engineer: {
    label: "Engineer & scientist", row: "workforce", cloth: "#2f7f86", accent: "#f2d27a",
    shapes: () => person({
      torso: [{ d: "M12 14.2l.9 1.1 1.4-.2-.4 1.4 1 1-1.4.4-.2 1.4-1.3-.7-1.3.7-.2-1.4-1.4-.4 1-1-.4-1.4 1.4.2Z", fill: "accent" }],
      head: [{ d: `${circle(10.3, 7.2, 1.25)}${circle(13.7, 7.2, 1.25)}M11.55 7.2h.9`, fill: "none", stroke: "#1c1a18", w: 0.8 }],
    }),
  },
  scholar: {
    label: "Teacher, lawyer & artist", row: "workforce", cloth: "#6a4c9c", accent: "#f4efe2",
    shapes: () => person({
      hair: "long",
      front: [
        { d: "M6.6 16.6l5.4 1.2 5.4-1.2v5.4l-5.4 1.2-5.4-1.2Z", fill: "accent", ink: true },
        { d: "M12 17.8v5.2", fill: "none", stroke: "#8a7a5a", w: 0.8 },
      ],
    }),
  },
  healer: {
    label: "Health worker", row: "workforce", cloth: "#eef0f2", accent: "#c8323a",
    shapes: () => person({
      torso: [
        { d: "M12 11.6l-2.4 5.8M12 11.6l2.4 5.8", fill: "none", stroke: "#b9bec6", w: 0.9 },
        { d: "M8.8 12.6c0 3.4 1.2 5 3.2 5s3.2-1.6 3.2-5", fill: "none", stroke: "#5a6270", w: 0.8 },
        { d: "M15.6 16h1.2v1.2H18v1.2h-1.2v1.2h-1.2v-1.2h-1.2V17.2h1.2Z", fill: "accent" },
      ],
    }),
  },
  service: {
    label: "Service & protective", row: "workforce", cloth: "#9a3a3a", accent: "#f6f4ee",
    shapes: () => person({
      torso: [
        { d: "M9.4 15.2h5.2l.8 7.8H8.6Z", fill: "accent", ink: true },
        { d: "M9.4 15.4l-2.4-1.6M14.6 15.4l2.4-1.6", fill: "none", stroke: "accent", w: 0.8 },
      ],
      head: [{ d: "M8.4 5.6a2.1 2.1 0 0 1 1.4-3.6 2.4 2.4 0 0 1 4.4 0 2.1 2.1 0 0 1 1.4 3.6v1.2H8.4Z", fill: "accent", ink: true }],
    }),
  },
  clerk: {
    label: "Sales & office", row: "workforce", cloth: "#3f7a4a", accent: "#7ec85a",
    shapes: () => person({
      torso: [{ d: "M10.2 11.8L12 15l1.8-3.2Z", fill: "#f4f1ea" }],
      head: [{ d: "M7.6 5.6h8.8l1.4 1.6H6.2Z", fill: "accent", ink: true }],
      front: [
        { d: rrect(13.6, 15.2, 5.2, 6.8, 0.6), fill: "#d8c08a", ink: true },
        { d: "M15 17.4h2.4M15 18.8h2.4M15 20.2h1.6", fill: "none", stroke: "#6a5a3a", w: 0.7 },
        { d: rrect(15.2, 14.6, 2, 1.2, 0.3), fill: "#8a8f96" },
      ],
    }),
  },
  farmer: {
    label: "Farmer", row: "workforce", cloth: "#b5483a", accent: "#e0c36a",
    shapes: () => person({
      torso: [{ d: "M8.4 15.6h7.2V23H8.4Z M9.4 12.4v3.2M14.6 12.4v3.2", fill: "#3d6aa8", stroke: "#3d6aa8", w: 1.2 }],
      head: [
        { d: "M3.8 6.4q8.2-2.6 16.4 0l-.2 1.1H4Z", fill: "accent", ink: true },
        { d: "M8.6 6c.4-3.2 1.6-4 3.4-4s3 .8 3.4 4Z", fill: "accent", ink: true },
      ],
      front: [
        { d: "M18.8 23V12.6", fill: "none", stroke: "#b8902e", w: 0.9 },
        { d: `${ellipse(18.8, 12.2, 0.7, 1.4)}${ellipse(18.1, 14, 0.6, 1.1)}${ellipse(19.5, 14, 0.6, 1.1)}`, fill: "accent", ink: true },
      ],
    }),
  },
  builder: {
    label: "Construction", row: "workforce", cloth: "#e8792b", accent: "#f2c230",
    shapes: () => person({
      torso: [
        { d: "M5.6 18.6h12.8", fill: "none", stroke: "#f6f0d0", w: 1.1 },
        { d: "M9.4 12v11M14.6 12v11", fill: "none", stroke: "#f6f0d0", w: 1.1 },
      ],
      head: [
        { d: "M8 6.2a4 4 0 0 1 8 0Z", fill: "accent", ink: true },
        { d: "M6.8 6.2h10.4v1.2H6.8Z", fill: "accent", ink: true },
      ],
    }),
  },
  maker: {
    label: "Production & transport", row: "workforce", cloth: "#44658f", accent: "#9aa3ad",
    shapes: () => person({
      head: [{ d: "M8.2 5.8c.4-2.4 2-3.4 3.8-3.4s3.4 1 3.8 3.4l1.8.6v.8H8.2Z", fill: "#5a5a5e", ink: true }],
      front: [
        { d: "M16.2 21.6l3.2-6.2", fill: "none", stroke: "accent", w: 1.6 },
        { d: "M18.6 13.4a2 2 0 1 0 2.4 3l-1-.2-.4-1.2.8-.8Z", fill: "accent", ink: true },
      ],
    }),
  },

  // age (B01001)
  child: {
    label: "Child (under 18)", row: "age", cloth: "#e0a33a", accent: "#f4efe2",
    shapes: () => [
      { d: "M7.4 23v-3.6c0-2.8 2-4.8 4.6-4.8s4.6 2 4.6 4.8V23Z", fill: "cloth", ink: true },
      HEAD(12, 11, 3.4),
      { d: "M8.8 10.4c0-2.4 1.4-3.4 3.2-3.4s3.2 1 3.2 3.4c-.8-.8-1.8-1.2-3.2-1.2s-2.4.4-3.2 1.2Z", fill: "hair" },
    ],
  },
  young: {
    label: "Young adult (18–34)", row: "age", cloth: "#4f8fcf", accent: "#2a4a6a",
    shapes: () => person({
      hair: "long",
      back: [{ d: rrect(14.4, 13.2, 5.6, 7.4, 1.4), fill: "accent", ink: true }],
      torso: [{ d: "M9.6 12.2c.6 2.4 1.4 3.4 2.4 3.4s1.8-1 2.4-3.4", fill: "none", stroke: "#2a4a6a", w: 0.9 }],
    }),
  },
  midlife: {
    label: "Midlife (35–64)", row: "age", cloth: "#7a6a52", accent: "#f4f1ea",
    shapes: () => person({ torso: [{ d: "M10 11.8L12 15.4l2-3.6Z", fill: "accent" }, { d: "M12 15.4V23", fill: "none", stroke: "#5a4c3a", w: 0.8 }] }),
  },
  elder: {
    label: "Elder (65+)", row: "age", cloth: "#8a8f9a", accent: "#7a4a24",
    shapes: () => person({
      hair: "grey",
      front: [{ d: "M18.4 23v-8.2c0-1.2 1.6-1.2 1.6 0", fill: "none", stroke: "accent", w: 1.4 }],
    }),
  },

  // commute (C08301)
  drove_alone: {
    label: "Drove alone", row: "commute", cloth: "#c8483a", accent: "#bfe0f2",
    shapes: () => car(1),
  },
  carpool: {
    label: "Carpooled", row: "commute", cloth: "#3a78a8", accent: "#bfe0f2",
    shapes: () => car(2),
  },
  transit: {
    label: "Public transit", row: "commute", cloth: "#2f8f6a", accent: "#bfe0f2",
    shapes: () => [
      { d: rrect(1.6, 6.4, 20.8, 13.4, 2.2), fill: "cloth", ink: true },
      { d: `${rrect(3.2, 8.4, 4.2, 4.4, 0.6)}${rrect(8.4, 8.4, 4.2, 4.4, 0.6)}${rrect(13.6, 8.4, 4.2, 4.4, 0.6)}`, fill: "accent" },
      { d: rrect(18.8, 8.4, 2.4, 9.6, 0.4), fill: "#e8f2f6", ink: true },
      { d: `${circle(5.3, 11.6, 1.2)}${circle(10.5, 11.2, 1.2)}${circle(15.7, 11.6, 1.2)}`, fill: "skin" },
      { d: "M1.6 15.2h17.2", fill: "none", stroke: "#f2d27a", w: 1 },
      { d: `${circle(6.2, 20.2, 2.2)}${circle(17.2, 20.2, 2.2)}`, fill: "#2a2a2e", ink: true },
    ],
  },
  walk: {
    label: "Walked", row: "commute", cloth: "#7a8a3a", accent: "#4a3a2a",
    shapes: () => [
      { d: "M10.6 17.6l-3.4 5.2M13.2 17.6l3.6 5", fill: "none", stroke: "accent", w: 2.2 },
      { d: "M8.4 18.4c-.2-4.6 1.2-7.4 3.8-7.4s4 2.8 3.6 7.4Z", fill: "cloth", ink: true },
      { d: "M9.2 13.4l-3 3.6M15 13.4l2.8 3.2", fill: "none", stroke: "cloth", w: 1.8 },
      HEAD(12.2, 6.9, 3.4),
      { ...HAIR_SHORT },
    ],
  },
  other: {
    label: "Bike, motorcycle, taxi or other", row: "commute", cloth: "#d0703a", accent: "#2a2a2e",
    shapes: () => [
      { d: `${circle(5.6, 18.4, 3.6)}${circle(18.4, 18.4, 3.6)}`, fill: "none", stroke: "accent", w: 1.4 },
      { d: "M5.6 18.4l4.4-6.2h6l2.4 6.2M10 12.2l3.4 6.2 2.6-6.2M9 10.8h2.6M16 12.2l-.8-2", fill: "none", stroke: "#6a6a72", w: 1.1 },
      { d: "M10.2 10.6c.4-3 1.6-4.2 3.2-4.2l1.6.4.6 5.4Z", fill: "cloth", ink: true },
      { d: "M13 11.4l1.6 4", fill: "none", stroke: "#3a3a42", w: 1.4 },
      HEAD(14.2, 3.9, 2.6),
    ],
  },
  home: {
    label: "Worked from home", row: "commute", cloth: "#8a5a3a", accent: "#bfe0f2",
    shapes: () => [
      { d: "M2 12.4L12 3.4l10 9V23H2Z", fill: "#e8dcc4", ink: true },
      { d: "M1.2 12.8L12 3l10.8 9.8-1.2 1.2L12 5.4 2.4 14Z", fill: "cloth", ink: true },
      { d: rrect(6, 13, 12, 8.4, 0.6), fill: "accent", ink: true },
      { d: circle(12, 15.8, 1.7), fill: "skin" },
      { d: "M9.2 21.4c.2-2 1.2-3.2 2.8-3.2s2.6 1.2 2.8 3.2Z", fill: "#3a78a8" },
      { d: rrect(10, 19.6, 4, 1.8, 0.3), fill: "#5a5a62" },
    ],
  },

  // education (C15003), adults 25+
  less_than_hs: {
    label: "No high-school diploma", row: "education", cloth: "#8a7a64", accent: "#c9b99a",
    shapes: () => person(),
  },
  high_school: {
    label: "High school", row: "education", cloth: "#4a7a9a", accent: "#f4efe2",
    shapes: () => person({
      front: [
        { d: "M14.2 19.8l5.6-3.2 1 1.6-5.6 3.2Z", fill: "accent", ink: true },
        { d: "M16.6 19.4l.6 1", fill: "none", stroke: "#c0392b", w: 1.2 },
      ],
    }),
  },
  some_college: {
    label: "Some college", row: "education", cloth: "#5a6a9a", accent: "#c0392b",
    shapes: () => person({
      front: [
        { d: rrect(13.8, 18.4, 6.6, 1.8, 0.3), fill: "accent", ink: true },
        { d: rrect(14.2, 16.6, 6, 1.8, 0.3), fill: "#3a78a8", ink: true },
        { d: rrect(13.6, 20.2, 7, 1.8, 0.3), fill: "#e0a33a", ink: true },
      ],
    }),
  },
  bachelors: {
    // a coloured gown (not black) with a light collar, and a small cap set high, so the face stays clear at 20 px
    label: "Bachelor's degree", row: "education", cloth: "#2f4f8f", accent: "#f2d27a",
    shapes: () => person({
      torso: [{ d: "M10.2 10.9l1.8 2.3 1.8-2.3-.6-.3-1.2 1.4-1.2-1.4Z", fill: "#f2ead6", ink: true }],
      head: mortar(false, "#24365e"),
    }),
  },
  graduate: {
    label: "Graduate degree", row: "education", cloth: "#7a2a3a", accent: "#f2d27a",
    shapes: () => person({
      torso: [
        { d: "M8.2 12.6c1 3 2.2 4.6 3.8 4.6s2.8-1.6 3.8-4.6l1.4 1.2c-1 4.2-2.8 6.2-5.2 6.2s-4.2-2-5.2-6.2Z", fill: "#e0b04a", ink: true },
        { d: "M10.2 10.9l1.8 2.3 1.8-2.3-.6-.3-1.2 1.4-1.2-1.4Z", fill: "#f2ead6", ink: true },
      ],
      head: mortar(true, "#3a1a26"),
    }),
  },

  // nativity (B05002)
  born_in_state: {
    label: "Born in this state", row: "nativity", cloth: "#5a7a3a", accent: "#f2d27a",
    shapes: () => [...person(), ...badge([{ d: "M18.6 15.8l2.6 2.4h-.8v2.8h-3.6v-2.8h-.8Z", fill: "#3a2a14" }])],
  },
  other_state: {
    label: "Born in another state", row: "nativity", cloth: "#3a6a8a", accent: "#a8743a",
    shapes: () => person({
      front: [
        { d: rrect(14.4, 16.4, 6.8, 5.6, 0.8), fill: "accent", ink: true },
        { d: "M16.6 16.4v-1a.8.8 0 0 1 .8-.8h.8a.8.8 0 0 1 .8.8v1M14.4 19h6.8", fill: "none", stroke: "#4a2c10", w: 0.8 },
      ],
    }),
  },
  native_abroad: {
    label: "US citizen born abroad", row: "nativity", cloth: "#6a5a8a", accent: "#e8eef6",
    shapes: () => [...person(), ...badge([{ d: "M15.6 18.8l6-1.6-.2.8-2.6 1 .2 2-.8.2-.6-1.8-2 .4Z", fill: "#2a4a6a" }], "accent")],
  },
  foreign_born: {
    label: "Born in another country", row: "nativity", cloth: "#8a4a6a", accent: "#4f8fcf",
    shapes: () => [...person(), ...badge([
      { d: "M14.5 18.6h8.2M18.6 14.5c-2.4 2.4-2.4 5.8 0 8.2M18.6 14.5c2.4 2.4 2.4 5.8 0 8.2", fill: "none", stroke: "#e8f2f6", w: 0.7 },
    ], "accent")],
  },
};

function mortar(tassel, col = "#24365e") {
  // a flat board and a shallow band above the brow: the head (top at y 3.4) shows its face below y ≈ 5
  return [
    { d: "M8.4 4.6v-1.2h7.2v1.2c-1 .6-2.2.9-3.6.9s-2.6-.3-3.6-.9Z", fill: col, ink: true },
    { d: "M12 0.6l6.6 1.9-6.6 1.9-6.6-1.9Z", fill: col, ink: true },
    { d: tassel ? "M12 2.5l5.4.9v3.6" : "M12 2.5l4.8.8v3", fill: "none", stroke: "accent", w: 0.9 },
    { d: circle(tassel ? 17.4 : 16.8, tassel ? 7.4 : 6.6, 0.7), fill: "accent" },
  ];
}

function car(n) {
  const heads = n === 1 ? [circle(13.2, 9.8, 1.7)] : [circle(9.4, 9.8, 1.7), circle(14.4, 9.8, 1.7)];
  return [
    { d: "M1.6 19.2v-3.4c0-1.2.8-2 2-2.2l2.6-.4 2.4-4.4c.4-.8 1.2-1.2 2-1.2h5.2c.8 0 1.6.4 2.1 1.1l3 4.4 1.5.4c.9.3 1.5 1.1 1.5 2v3.7Z", fill: "cloth", ink: true },
    { d: "M7.6 13.2l1.8-3.4c.2-.4.6-.6 1-.6h5.4c.4 0 .8.2 1 .5l2.2 3.5Z", fill: "accent" },
    { d: heads.join(""), fill: "skin" },
    { d: "M12.8 9.2v4", fill: "none", stroke: "cloth", w: 0.9 },
    { d: `${circle(6.4, 19.4, 2.4)}${circle(17.6, 19.4, 2.4)}`, fill: "#2a2a2e", ink: true },
    { d: `${circle(6.4, 19.4, 0.9)}${circle(17.6, 19.4, 0.9)}`, fill: "#b9bec6" },
  ];
}

// Data keys and suggested icon ids → kinds.
const ALIAS = {
  "c-executive": "executive", "c-engineer": "engineer", "c-scholar": "scholar", "c-healer": "healer", "c-service": "service",
  "c-clerk": "clerk", "c-farmer": "farmer", "c-builder": "builder", "c-maker": "maker",
  "c-child": "child", "c-young": "young", "c-midlife": "midlife", "c-elder": "elder",
  "c-car": "drove_alone", "c-carpool": "carpool", "c-transit": "transit", "c-walk": "walk", "c-bike": "other", "c-home": "home",
  "c-edu0": "less_than_hs", "c-edu1": "high_school", "c-edu2": "some_college", "c-edu3": "bachelors", "c-edu4": "graduate",
  "c-local": "born_in_state", "c-newcomer": "other_state", "c-abroad": "native_abroad", "c-immigrant": "foreign_born",
  car: "drove_alone", bike: "other", artist: "scholar", worker: "maker", adult: "midlife", senior: "elder",
};

export function citizenKind(id) {
  if (id == null) return null;
  const k = String(id);
  return CITIZEN_KINDS[k] ? k : ALIAS[k] && CITIZEN_KINDS[ALIAS[k]] ? ALIAS[k] : null;
}

// --- colours ------------------------------------------------------------------------------------------------------

function grey(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const l = Math.round(0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255));
  const v = Math.round(110 + l * 0.35);
  return `rgb(${v},${v},${v - 4})`;
}

function palette(def, variant, dim) {
  const v = Math.abs(variant | 0);
  const p = {
    skin: SKIN, hair: HAIR[(v * 3 + 1) % HAIR.length], cloth: shade(def.cloth, CLOTH_SHADE[v % CLOTH_SHADE.length]), accent: def.accent || "#f2d27a",
    light: "#f4f1ea", dark: "#22262e", metal: "#9aa3ad", gold: "#f2d27a",
  };
  if (dim) for (const k of Object.keys(p)) p[k] = grey(p[k]);
  return p;
}

const resolve = (c, pal, dim) => (c == null || c === "none" ? null : pal[c] || (dim && c.startsWith("#") ? grey(c) : c));

// --- canvas -------------------------------------------------------------------------------------------------------

const pathCache = new Map();
const path2d = (d) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

function paintFigure(g, kind, pal, dim, { disk = null, shadow = true, upx = 2 } = {}) {
  const def = CITIZEN_KINDS[kind];
  if (disk) {
    g.beginPath();
    g.arc(12, 12.4, 11.6, 0, Math.PI * 2);
    g.fillStyle = disk;
    g.fill();
  }
  if (shadow) {
    g.beginPath();
    g.ellipse(12, 23, 8, 1.1, 0, 0, Math.PI * 2);
    g.fillStyle = dim ? "rgba(0,0,0,.12)" : "rgba(0,0,0,.25)";
    g.fill();
  }
  g.lineJoin = "round";
  g.lineCap = "round";
  for (const sh of def.shapes()) {
    const p = path2d(sh.d);
    const fill = resolve(sh.fill, pal, dim);
    if (fill) {
      g.fillStyle = fill;
      g.fill(p, "evenodd");
    }
    if (sh.stroke) {
      g.strokeStyle = resolve(sh.stroke, pal, dim);
      g.lineWidth = sh.w || 1;
      g.stroke(p);
    }
    if (sh.ink) {
      g.strokeStyle = dim ? "rgba(60,60,60,.6)" : INK;
      g.lineWidth = Math.max(0.85, 1.4 / upx); // at least ~1.4 device px
      g.stroke(p);
    }
  }
}

/**
 * Draw a citizen centred at (x, y), `size` user units tall (and wide). Unknown kinds draw nothing and return false.
 * Cached as a sprite per (kind, variant, dim, disk, size bucket), so a row of 20 figures costs 20 blits.
 */
export function drawCitizen(ctx, kind, x, y, size, opts = {}) {
  const k = citizenKind(kind);
  if (!k || !(size > 0)) return false;
  const { variant = 0, dim = false, disk = null, shadow = true } = opts;
  const def = CITIZEN_KINDS[k];
  const pal = palette(def, variant, dim);
  const unitsPerPx = size / 24; // user units per art unit
  const upx = bucketPx(deviceScale(ctx) * unitsPerPx, { min: 0.5, max: 24 });
  const key = `cit:${k}:${Math.abs(variant | 0) % 30}:${dim ? 1 : 0}:${disk || ""}:${shadow ? 1 : 0}`;
  const spr = getSprite(key, upx, { x0: -0.6, y0: -0.6, x1: 24.6, y1: 24.6 }, (g, u) => paintFigure(g, k, pal, dim, { disk, shadow, upx: u }));
  drawSprite(ctx, spr, x - size / 2, y - size / 2, unitsPerPx);
  return true;
}

// --- SVG ----------------------------------------------------------------------------------------------------------

const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The figure as an inline SVG string, `size` css px square. Same options as drawCitizen, plus title / className. */
export function citizenSVG(kind, { size = 24, variant = 0, dim = false, disk = null, shadow = true, title = "", className = "" } = {}) {
  const k = citizenKind(kind);
  if (!k) return "";
  const def = CITIZEN_KINDS[k];
  const pal = palette(def, variant, dim);
  const a11y = title ? `role="img" aria-label="${escAttr(title)}"` : 'aria-hidden="true" focusable="false"';
  const parts = [];
  if (title) parts.push(`<title>${escAttr(title)}</title>`);
  if (disk) parts.push(`<circle cx="12" cy="12.4" r="11.6" fill="${escAttr(disk)}"/>`);
  if (shadow) parts.push(`<ellipse cx="12" cy="23" rx="8" ry="1.1" fill="rgba(0,0,0,${dim ? 0.12 : 0.25})"/>`);
  for (const sh of def.shapes()) {
    const fill = resolve(sh.fill, pal, dim) || "none";
    const attrs = [`d="${sh.d}"`, `fill="${escAttr(fill)}"`, 'fill-rule="evenodd"'];
    if (sh.stroke) attrs.push(`stroke="${escAttr(resolve(sh.stroke, pal, dim))}"`, `stroke-width="${sh.w || 1}"`);
    parts.push(`<path ${attrs.join(" ")}/>`);
    if (sh.ink) parts.push(`<path d="${sh.d}" fill="none" stroke="${dim ? "rgba(60,60,60,.6)" : INK}" stroke-width="${size < 20 ? 1.3 : 1.05}"/>`);
  }
  return `<svg class="citizen${className ? ` ${escAttr(className)}` : ""}" xmlns="http://www.w3.org/2000/svg" viewBox="-0.6 -0.6 25.2 25.2" width="${size}" height="${size}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${parts.join("")}</svg>`;
}

/** Kinds of one citizens.json row, in display order (for galleries and legends). */
export const CITIZEN_ROWS = {
  workforce: ["executive", "engineer", "scholar", "healer", "service", "clerk", "farmer", "builder", "maker"],
  age: ["child", "young", "midlife", "elder"],
  commute: ["drove_alone", "carpool", "transit", "walk", "other", "home"],
  education: ["less_than_hs", "high_school", "some_college", "bachelors", "graduate"],
  nativity: ["born_in_state", "other_state", "native_abroad", "foreign_born"],
};
