// Every numeric lens declares its native geography, unit, thresholds and source.
import { localLenses, localValue, scopes } from "./local-lenses.js";
export const number = (n, digits = 0) =>
  n == null || !Number.isFinite(n)
    ? "No data"
    : n.toLocaleString("en-US", { maximumFractionDigits: digits });
export const compact = (n) =>
  n == null
    ? "No data"
    : Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
export const coverNames = {
  11: "Open water",
  12: "Perennial ice or snow",
  21: "Developed open space",
  22: "Low-intensity development",
  23: "Medium-intensity development",
  24: "High-intensity development",
  31: "Barren ground",
  41: "Deciduous forest",
  42: "Evergreen forest",
  43: "Mixed forest",
  52: "Shrub and scrub",
  71: "Grassland",
  81: "Pasture and hay",
  82: "Cultivated crops",
  90: "Woody wetland",
  95: "Emergent wetland",
};
export const terrainColors = {
  water: "#4092ca",
  forest: "#537747",
  scrub: "#b8a26a",
  grass: "#9fb35a",
  farm: "#b5b261",
  urban: "#909082",
  rock: "#b9ab94",
  alpine: "#dce0df",
  wetland: "#547f68",
};
export const terrainNames = {
  forest: "Forest",
  scrub: "Scrub",
  grass: "Grassland",
  farm: "Farmland",
  urban: "Developed",
  rock: "Bare rock",
  alpine: "Alpine",
  water: "Water",
  wetland: "Wetland",
};
export function biome(cover, elev) {
  if (cover === 11) return "water";
  if (cover === 12 || (cover === 31 && elev > 2900)) return "alpine";
  if (cover >= 21 && cover <= 24) return "urban";
  if (cover >= 41 && cover <= 43) return "forest";
  return (
    {
      31: "rock",
      52: "scrub",
      71: "grass",
      81: "farm",
      82: "farm",
      90: "wetland",
      95: "wetland",
    }[cover] || "rock"
  );
}
const palettes = {
  sage: ["#e8e5bb", "#c7d39e", "#a0bb81", "#6e9c70", "#427e64", "#215b50"],
  sun: ["#eeebc5", "#e8d89e", "#dfbc71", "#d49c4c", "#bf783d", "#9d5237"],
  heat: ["#e4e6c1", "#ded59c", "#e4b879", "#d18f5e", "#b7604c", "#823c40"],
  sea: ["#e3e8d1", "#bdd9c5", "#90bfba", "#639fa9", "#467e98", "#3c5c80"],
  plum: ["#eee2d0", "#d9c8bf", "#c3a9b4", "#ad849e", "#8f6284", "#674764"],
};
export const lenses = [];
function add(
  id,
  name,
  group,
  scope,
  source,
  detail,
  unit,
  breaks,
  colors,
  icon = "map",
  digits = 0,
) {
  lenses.push({
    id,
    name,
    group,
    scope,
    source,
    detail,
    unit,
    breaks,
    colors: palettes[colors] || colors,
    icon,
    digits,
  });
}
add(
  "terrain",
  "Terrain",
  "Landscape",
  "Hex sample",
  "terrain",
  "Zoom in to see USACiv’s illustrated terrain and settlements. Buildings and fields illustrate local land-cover classes. Banners show Census place populations.",
  "",
  [],
  [],
  "mountain",
);
add(
  "elev",
  "Elevation",
  "Landscape",
  "Hex sample",
  "terrain",
  "Bare-earth elevation at the tile’s sample point.",
  "ft",
  [0, 1000, 3000, 5000, 8000],
  "sage",
  "mountain",
);
add(
  "fire",
  "Utility wildfire threat",
  "Environment",
  "Largest area in the hex",
  "drpepFire",
  "Color shows the class covering the largest area within the SCE portion of this hex. CPUC Tier 2 means elevated utility wildfire risk and Tier 3 means extreme risk. The third class is outside both tiers. Overlapping district polygons count toward Tier 3. The higher tier wins an exact tie. Select a hex to see all three percentages.",
  "",
  [],
  ["#dcdcc3", "#e6ae66", "#b95640"],
  "flame",
);
add(
  "solar",
  "Solar resource",
  "Environment",
  "800 m climate grid",
  "prism",
  "Average daily sunlight on a horizontal surface over 1991–2020. Useful for comparing solar exposure.",
  "kWh/m²/day",
  [4.4, 4.7, 5, 5.3, 5.6],
  "sun",
  "sun",
  2,
);
add(
  "july",
  "Summer heat",
  "Environment",
  "4 km climate grid",
  "prism",
  "July’s normal daily high temperature over 1991–2020 gives context for summer cooling demand.",
  "°F",
  [70, 80, 90, 95, 100],
  "heat",
  "thermo",
  1,
);
add(
  "january",
  "Winter cold",
  "Environment",
  "4 km climate grid",
  "prism",
  "January’s normal daily low temperature over 1991–2020 gives context for winter heating demand.",
  "°F",
  [15, 25, 32, 40, 48],
  "sea",
  "thermo",
  1,
);
add(
  "rain",
  "Annual precipitation",
  "Environment",
  "4 km climate grid",
  "prism",
  "Annual precipitation, including melted snow, averaged over 1991–2020.",
  "in/yr",
  [5, 10, 15, 25, 40],
  "sea",
  "drop",
  1,
);
add(
  "screen",
  "Environmental burden",
  "Environment",
  "2010 census tract",
  "ces",
  "CalEnviroScreen 4.0 statewide percentile for the sample point’s tract. Higher values indicate higher cumulative pollution and population vulnerability.",
  "percentile",
  [25, 50, 65, 75, 90],
  "plum",
  "leaf",
  1,
);
export function addLocalLenses(local) {
  for (const [
    id,
    title,
    group,
    source,
    unit,
    breaks,
    palette,
    icon,
    digits,
    detail,
  ] of localLenses) {
    const spec = local.fields[id];
    if (!spec) throw new Error("Missing local geography for " + id);
    add(
      id,
      title,
      group,
      scopes[spec.layer],
      source,
      detail,
      unit,
      breaks,
      palette,
      icon,
      digits,
    );
  }
}
export const featured = ["terrain", "substations", "evPermitStatus", "fire", "solar", "gwh", "home_value"];
export function valueAt(m, id, i) {
  if (i < 0) return null;
  const get = (k) => m.val(i, k);
  if (id === "terrain") return biome(get("cover"), get("elev"));
  if (id === "elev") return get("elev") == null ? null : get("elev") * 3.28084;
  if (id === "fire") return get("fireDominant");
  if (["july", "january", "rain", "solar"].includes(id))
    return get(id) == null ? null : get(id) / (id === "solar" ? 100 : 10);
  if (id === "screen") return m.tracts.screen[get("ces")]?.[1] ?? null;
  const local = m.local.fields[id];
  if (local) return localValue(m, local, i);
  return null;
}
const capacityClasses = ["Above 3 MW", "1–3 MW", "0–1 MW", "Tied bands"];
const planningClasses = {
  evPermitStatus: ["Streamlined", "Streamlining in progress", "Not streamlined"],
  growth: ["Above 5 MW", "Above 3 through 5 MW", "0–3 MW", "Tied bands"],
  loadFull: capacityClasses,
  loadPartial: capacityClasses,
};
export const categorical = (id) =>
  id === "terrain" || id === "fire" || Object.hasOwn(planningClasses, id);
export function formatValue(l, v) {
  if (v == null) return "No data";
  if (l.id === "home_value" && (v === 9999 || v === 2000001))
    return v === 9999 ? "Under $10,000" : "$2,000,000+";
  if (l.id === "income" && (v === 2499 || v === 250001))
    return v === 2499 ? "Under $2,500" : "$250,000+";
  if (l.id === "terrain") return terrainNames[v];
  if (planningClasses[l.id]) return planningClasses[l.id][v - 1];
  if (l.id === "fire")
    return {
      0: "Outside tiers 2–3",
      2: "Tier 2 · Elevated",
      3: "Tier 3 · Extreme",
    }[v];
  if (typeof v === "string")
    return v.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());
  if (l.unit === "$") return "$" + number(v);
  if (l.unit === "%") return number(v, l.digits) + "%";
  return (
    number(v, l.digits) + (l.unit === "°F" ? "°F" : l.unit ? " " + l.unit : "")
  );
}
export function bins(l, m) {
  if (l.id === "terrain")
    return Object.entries(terrainNames).map(([key, label]) => ({
      key,
      label,
      color: terrainColors[key],
    }));
  if (l.id === "fire")
    return [0, 2, 3].map((key, i) => ({
      key,
      label: formatValue(l, key),
      color: l.colors[i],
    }));
  if (planningClasses[l.id])
    return planningClasses[l.id].map((label, i) => ({
      key: i + 1,
      label,
      color: l.colors[i],
    }));
  return l.colors.map((color, i) => {
    const b = l.breaks,
      unit = l.unit === "$" ? "$" : "",
      f = (x) => unit + (Math.abs(x) >= 10000 ? compact(x) : number(x, 2));
    return {
      color,
      label:
        i === 0
          ? "Under " + f(b[0])
          : i === b.length
            ? f(b.at(-1)) + "+"
            : f(b[i - 1]) + "–<" + f(b[i]),
    };
  });
}
export function band(l, v, legend) {
  if (v == null) return -1;
  if (categorical(l.id)) return legend.findIndex((b) => b.key === v);
  const i = l.breaks.findIndex((x) => v < x);
  return i < 0 ? l.breaks.length : i;
}
