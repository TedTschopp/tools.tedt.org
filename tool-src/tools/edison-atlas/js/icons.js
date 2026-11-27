import { hasIcon, svgIcon } from "./usaciv/icons.js";

const sourceIcons = {
  mountain: "terrain",
  sun: "r-solar",
  bolt: "i-utilities",
  users: "pop",
  leaf: "w-park",
  car: "l-commute",
  home: "l-home",
  building: "l-developed",
  battery: "r-battery",
  coins: "y-gold",
  signal: "l-broadband",
  rail: "t-rail",
  roads: "t-road",
  town: "l-developed",
  landmark: "w-landmark",
};
const lines = {
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v6c0 4 16 4 16 0v-6"/>',
  flame:
    '<path d="M13 2c2 7-2 8 0 11 2 0 3-2 4-4 6 7 2 13-5 13-6 0-9-5-7-10 1-3 4-5 5-8 0 4 1 5 2 5 1-2 1-4 1-7Z"/>',
  grid: '<path d="m8 2 4 2v5l-4 2-4-2V4zM16 9l4 2v5l-4 2-4-2v-5zM7 12l4 2v5l-4 2-4-2v-5z"/>',
  hex: '<path d="m12 2 8.5 5v10L12 22l-8.5-5V7z"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/><circle cx="12" cy="12" r="2"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  link: '<path d="m10 7 2-2a5 5 0 0 1 7 7l-3 3m-2 2-2 2a5 5 0 0 1-7-7l3-3m1 6 6-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  thermo: '<path d="M9 13V5a3 3 0 0 1 6 0v8a5.5 5.5 0 1 1-6 0Zm3 2V7"/>',
  drop: '<path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z"/>',
  plug: '<path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0zm6 10v4"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 4-5 14 0 18 5-4 5-14 0-18Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
  trail: '<path d="M2 18c8 0 0-9 8-9s3 6 12-4"/>',
  cursor: '<path d="m4 3 5 17 3-7 7-3z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 7-2.5 7-6 3 3-7z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-5 3 3 4-6 5 7"/>',
  external: '<path d="M14 3h7v7m-1-6L10 14M11 5H4v15h15v-7"/>',
};
export function icon(id, size = 18) {
  const source = sourceIcons[id] ?? id;
  if (hasIcon(source)) return svgIcon(source, { size });
  return (
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" width="' +
    size +
    '" height="' +
    size +
    '" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    (lines[id] || lines.map) +
    "</svg>"
  );
}
