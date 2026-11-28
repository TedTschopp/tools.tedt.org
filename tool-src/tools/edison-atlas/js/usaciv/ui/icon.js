// DOM icons: the SVG set from icons.js, with the emoji as a fallback when an id is missing.
import { svgIcon, hasIcon } from "../icons.js";
import { esc } from "../format.js";

// icon("l-income", "💵") → inline <svg> (currentColor) or an emoji <span>.
export function icon(id, fallback = "•", { size = 16, title = "" } = {}) {
  if (id && hasIcon(id)) return svgIcon(id, { size, title });
  const a11y = title ? `role="img" aria-label="${esc(title)}"` : `aria-hidden="true"`;
  return `<span class="emoji" ${a11y} style="font-size:${Math.round(size * 0.9)}px">${esc(fallback || "•")}</span>`;
}

// For data objects (yields, lenses, resource types). v2 files carry an SVG id in `icon` and the emoji in `emoji`;
// v1 files put the emoji in `icon`.
export function glyph(o, size = 16, title = "") {
  if (!o) return icon(null, "•", { size, title });
  const id = o.icon && hasIcon(o.icon) ? o.icon : null;
  const emoji = o.emoji ?? (o.icon && !/^[a-z]+(-|$)/.test(o.icon) ? o.icon : "•");
  return icon(id, emoji, { size, title });
}
