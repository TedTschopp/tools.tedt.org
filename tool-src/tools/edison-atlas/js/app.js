import { assetUrl, portable } from "./assets.js";
import { HexMap } from "./map.js";
import {
  addLocalLenses,
  bins,
  coverNames,
  categorical,
  featured,
  formatValue,
  lenses,
  number,
  valueAt,
} from "./lenses.js";
import { icon } from "./icons.js";
import { btn, esc, method, report, sourcePage } from "./reports.js";
import { sourceFor } from "./sources.js";
import {
  areaChoices,
  areaName,
  kindButton,
  locationLabel,
  modeWidth,
  summary,
} from "./utility.js";
import { categories, drawUtilityArt, kinds } from "./utility-art.js";
import { homeTable, localArea, localRow, localValue } from "./local-lenses.js";
import { shapeNames } from "./source-areas.js";

const $ = (id) => document.getElementById(id);
const small = () => matchMedia("(max-width:700px)").matches;
const overlaySpec = {
  utility: ["Utility infrastructure", "bolt"],
  places: ["Places", "town"],
  roads: ["Highways", "roads"],
  rail: ["Railroads", "rail"],
  water: ["Rivers & lakes", "drop"],
  counties: ["County boundaries", "map"],
  parks: ["National park units", "leaf"],
  landmarks: ["Historic landmarks", "landmark"],
  contours: ["Elevation contours · 400 m", "mountain"],
  grid: ["Hex grid", "hex"],
  art: ["Terrain & settlement artwork", "mountain"],
};
const themes = {
  terrain: ["#dde7c9", "#527449"],
  fire: ["#f4e2d0", "#ab6948"],
  solar: ["#f4e8be", "#9c762f"],
  gwh: ["#d9e8e5", "#4c797a"],
  density: ["#e8e1e7", "#806c82"],
};
const styleFor = (id) => {
  const t = themes[id] || ["#e4eadc", "#5b755b"];
  return "--tint:" + t[0] + ";--pic:" + t[1];
};
const lensById = (id) => lenses.find((l) => l.id === id);
const fact = (label, value) =>
  '<div class="fact"><span>' +
  esc(label) +
  "</span><b>" +
  esc(value) +
  "</b></div>";
const detailSection = (label, html) =>
  '<section class="detail-section"><h3>' +
  esc(label) +
  "</h3>" +
  html +
  "</section>";
let m,
  map,
  sideMode = "layers",
  chosenPlace = null,
  selectedLandmark = null,
  legendOpen = true,
  searchItems = [],
  activeResult = 0,
  hashTimer,
  restoreHash = false,
  lastHover = -1;
for (const el of document.querySelectorAll("[data-icon]"))
  el.innerHTML = icon(el.dataset.icon);
function message(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(message.timer);
  message.timer = setTimeout(() => ($("toast").hidden = true), 2500);
}
async function data(name, type = "json") {
  const response = await fetch(assetUrl("data/" + name));
  if (!response.ok) throw new Error(name + " returned HTTP " + response.status);
  return type === "json" ? response.json() : response.arrayBuffer();
}
async function start() {
  const pic = new Image();
  pic.src = assetUrl("data/relief.webp");
  const art = new Image();
  art.src = assetUrl("assets/terrain-art.png");
  const [
    meta,
    buffer,
    reg,
    tracts,
    context,
    utility,
    local,
    outlines,
    portals,
  ] = await Promise.all([
    data("atlas.json"),
    data("hexes.bin", "binary"),
    data("regional.json"),
    data("tracts.json"),
    data("context.json"),
    data("utility.json"),
    data("local.json"),
    data("local-boundaries.json"),
    data("sce-portals.json"),
    pic.decode(),
    art.decode(),
    document.fonts.ready,
  ]);
  const keys = Object.fromEntries(meta.columns.map((key, i) => [key, i])),
    raw = new Int32Array(buffer),
    stride = meta.columns.length;
  if (raw.length !== meta.cells * stride)
    throw new Error("The hex grid is incomplete.");
  m = {
    meta,
    reg,
    tracts,
    context,
    utility,
    local,
    outlines,
    portals,
    image: pic,
    art,
    val: (i, k) => {
      const v = raw[i * stride + keys[k]];
      return v === meta.noData ? null : v;
    },
  };
  addLocalLenses(local);
  map = new HexMap(m, $("base"), $("map"), $("mini"));
  map.onDraw = drawStatus;
  map.onHover = hovered;
  map.onPick = pick;
  map.onView = scheduleHash;
  map.setLens(lensById("terrain"));
  install();
  loadHash();
  syncUtilityControls();
  layersOrDetail();
  legend();
  $("loading").hidden = true;
  drawStatus();
}
function layersOrDetail() {
  if (sideMode === "layers") layers();
  else if (sideMode === "utility") utilityDetail();
  else if (sideMode === "source") sourceDetail();
  else inspector();
}
function showSource(layer, index) {
  map.sourceAreas.selection = { layer, index };
  map.selected = -1;
  map.place = null;
  chosenPlace = null;
  map.landmark = null;
  selectedLandmark = null;
  map.utility.selection = null;
  map.utilityHover = null;
  sideMode = "source";
  sourceDetail();
  map.queue();
  hovered(-1);
  $("side-body").scrollTop = 0;
  if (small()) $("sidebar").classList.add("open");
  scheduleHash();
}
function sourceDetail() {
  const { layer, index } = map.sourceAreas.selection,
    row = map.sourceAreas.row(layer, index),
    l = map.lens;
  const source = sourceFor(l.source, m.reg),
    id = row[0],
    v = map.sourceAreas.value(l, index);
  const all = lenses.filter(
    (other) => m.local.fields[other.id]?.layer === layer && other.id !== l.id,
  );
  let sourceUrl = source[3],
    label = source[0];
  if (l.id === "home_value") {
    sourceUrl = homeTable(id);
    label = "Census table for this block group";
  }
  const moe = layer === "bg" ? row[m.local.fields.homeMoe.index] : null;
  const heading =
    {
      bg: "Block group ",
      tract: "Tract ",
      health: "Tract ",
      zcta: "ZIP area ",
      work: "Workplace block group ",
    }[layer] + id;
  $("side-body").innerHTML =
    '<section class="detail-hero"><button class="back-btn" data-action="back">' +
    icon("back", 14) +
    'Map layers</button><span class="eyebrow">' +
    esc(l.scope) +
    "</span><h2>" +
    esc(l.name) +
    "</h2><p>" +
    esc(heading) +
    "</p>" +
    '<div class="lens-callout"><button class="change-lens" data-action="library" aria-label="Change active map lens">' +
    icon("layers", 14) +
    "Change lens</button><span>" +
    esc(l.name) +
    "</span><strong>" +
    esc(formatValue(l, v)) +
    "</strong><small>" +
    esc(
      l.id === "home_value"
        ? "90% margin of error · " +
            (moe == null ? "Unavailable" : "±$" + number(moe))
        : source[2],
    ) +
    "</small></div></section>" +
    detailSection(
      "Source and geography",
      '<p class="fine">' +
        esc(l.detail) +
        '</p><p class="fine"><a href="' +
        esc(sourceUrl) +
        '" target="_blank" rel="noopener">' +
        esc(label) +
        "</a></p>",
    ) +
    detailSection(
      "Also reported for this area",
      all
        .map((other) =>
          fact(
            other.name,
            formatValue(other, map.sourceAreas.value(other, index)),
          ),
        )
        .join(""),
    );
}
function setSourceMode(on) {
  map.sourceAreas.enabled = on;
  map.sourceAreas.hover = null;
  if (!on && map.sourceAreas.selection) clearSelected();
  if (on && map.selected >= 0) {
    const layer = map.sourceAreas.layer(map.lens),
      i = layer ? m.val(map.selected, layer) : -1;
    if (i >= 0) showSource(layer, i);
  }
  legend();
  map.queue();
  scheduleHash();
}
function syncUtilityControls() {
  const u = map.utility;
  for (const el of document.querySelectorAll('[data-overlay="utility"]'))
    el.setAttribute("aria-checked", String(map.opts.utility));
  const previous = document.activeElement?.dataset.utilityFilter;
  $("utility-kinds").innerHTML = kinds
    .map((k) =>
      kindButton(k, u.data.totals[k], "data-utility-filter", u.filters.has(k)),
    )
    .join("");
  if (previous)
    $("utility-kinds")
      .querySelector('[data-utility-filter="' + previous + '"]')
      ?.focus({ preventScroll: true });
  $("utility-area").innerHTML =
    '<option value="">Choose a reporting area…</option>' + areaChoices(u);
  $("utility-area").disabled = !u.filters.size;
  $("utility-scale").textContent = !u.filters.size
    ? "Choose a resource to display its areas."
    : "Overview symbols cover 48 miles. Zoom in for 12-mile areas and one-mile public charging hexes.";
}
function utilityScaleText() {
  const filters = map.utility.filters;
  if (!filters.size) return "No utility resources selected";
  if (map.scale >= 22 && filters.has("ev"))
    return filters.size === 1
      ? "Public charging · one-mile hexes"
      : "12-mile areas · charging by one-mile hex";
  return modeWidth(map.scale) + "-mile reporting areas";
}
function utilityMenu(open) {
  $("utility-panel").hidden = !open;
  $("utility-menu").setAttribute("aria-expanded", String(open));
  if (open) closeSearch();
}
function showUtility(area, kind) {
  if (!area?.values[kind] || !map.utility.filters.has(kind)) return;
  map.opts.utility = true;
  map.sourceAreas.selection = null;
  map.sourceAreas.hover = null;
  map.selected = -1;
  map.place = null;
  chosenPlace = null;
  map.landmark = null;
  selectedLandmark = null;
  map.utility.selection = { area, kind };
  sideMode = "utility";
  utilityMenu(false);
  syncUtilityControls();
  legend();
  utilityDetail();
  map.queue();
  hovered(-1);
  $("side-body").scrollTop = 0;
  if (small()) $("sidebar").classList.add("open");
  scheduleHash();
}
function zoomUtility(area) {
  const target =
    area.width === 1
      ? 50
      : area.width === 12
        ? Math.max(12, Math.min(24, Math.min(map.w, map.h) / 23))
        : 5.6;
  map.go(area.x, area.y, target / map.base);
}
function resourceButtons(area, attribute, selected = null) {
  return kinds
    .filter(
      (k) => area.values[k] && map.utility.filters.has(k) && k !== selected,
    )
    .map((k) => kindButton(k, area.values[k], attribute, null, area.id))
    .join("");
}
function utilityDetail() {
  const sel = map.utility.selection;
  if (!sel) return;
  const { area, kind } = sel,
    v = area.values[kind],
    ev = kind === "ev",
    src = sourceFor(ev ? "afdc" : "eia860", m.reg);
  let html =
    '<section class="detail-hero utility-hero"><button class="back-btn" data-action="back">' +
    icon("back", 14) +
    'Map layers</button><canvas id="utility-model" width="180" height="146" aria-hidden="true"></canvas>' +
    '<span class="eyebrow">' +
    esc(areaName(area)) +
    "</span><h2>" +
    categories[kind].name +
    "</h2><p>" +
    esc(locationLabel(area)) +
    "</p>" +
    '<div class="lens-callout"><span>' +
    esc(ev ? "Public charging" : "Operating inventory") +
    "</span><strong>" +
    esc(summary(kind, v)) +
    "</strong><small>" +
    esc(ev ? "November 27, 2026" : m.utility.generationPeriod) +
    "</small></div></section>";
  let values = ev
    ? fact("Public charging stations", number(v.sites)) +
      fact("Reported charging ports", number(v.ports)) +
      fact("Level 1 ports", number(v.level1)) +
      fact("Level 2 ports", number(v.level2)) +
      fact("DC fast ports", number(v.dc)) +
      (v.restrictedSites
        ? fact("Stations with access restrictions", number(v.restrictedSites))
        : "")
    : fact("Operating plant sites", number(v.sites)) +
      fact("Operating units", number(v.units)) +
      fact("Nameplate power", number(v.mw, 1) + " MW");
  if (kind === "battery")
    values +=
      fact(
        "Reported storage energy",
        v.energyUnits ? number(v.mwh, 1) + " MWh" : "No data",
      ) +
      fact(
        "Units reporting energy",
        number(v.energyUnits) + " of " + number(v.units),
      );
  html += detailSection(
    ev ? "Stations and ports" : "Capacity in this area",
    values,
  );
  const other = resourceButtons(area, "data-utility-pick", kind);
  if (other) html += detailSection("Also in this area", other);
  html += detailSection(
    "Map and source",
    '<p class="fine">' +
      (area.width === 1
        ? "The symbol marks the occupied one-mile hex. "
        : "The symbol summarizes the portion of this reporting hex inside Edison’s territory. ") +
      (ev
        ? "A station can have several ports. The inventory records installed equipment."
        : "Counts include all owners. A plant with several technologies can appear in more than one category.") +
      '</p><p class="fine"><a target="_blank" rel="noopener" href="' +
      esc(src[3]) +
      '">' +
      esc(src[0]) +
      "</a><br>" +
      esc(src[2]) +
      "</p>" +
      btn(
        area.width === 1 ? "Center charging hex" : "Zoom to reporting area",
        "utility-zoom",
      ),
  );
  $("side-body").innerHTML = html;
  const c = $("utility-model").getContext("2d");
  c.scale(2, 2);
  drawUtilityArt(c, kind, 44, 39, 76, true, false);
}
function layers() {
  const quick = featured.includes(map.lens.id)
    ? featured
    : [...featured, map.lens.id];
  $("side-body").innerHTML =
    '<div class="panel-hero"><span class="eyebrow">Service territory</span><h2>Territory explorer</h2><div class="kicker"><i></i>Southern &amp; Central California</div><div class="stats"><div class="metric"><strong>' +
    number(m.meta.cells) +
    '</strong><small>One-mile hexes</small></div><div class="metric"><strong>' +
    number(m.meta.areaSqMi) +
    "</strong><small>Square miles</small></div></div></div>" +
    '<section class="panel-section"><div class="section-head"><h3>Map lenses</h3>' +
    icon("layers", 16) +
    '</div><div class="lens-list">' +
    quick
      .map((id) => {
        const l = lensById(id),
          active = map.lens.id === id;
        return (
          '<button class="lens-row ' +
          (active ? "active" : "") +
          '" data-lens="' +
          id +
          '" aria-pressed="' +
          active +
          '"><span class="swatch-icon" style="' +
          styleFor(id) +
          '">' +
          icon(l.icon, 16) +
          "</span>" +
          esc(l.name) +
          (active
            ? '<span class="tick">' + icon("check", 15) + "</span>"
            : "") +
          "</button>"
        );
      })
      .join("") +
    '</div><button class="all-lenses" data-action="library"><span>' +
    icon("grid", 15) +
    "Browse all " +
    lenses.length +
    " lenses</span>" +
    icon("right", 14) +
    '</button><div class="sce-shortcuts"><button data-report="cooling">Cooling centers</button><button data-report="planning">SCE grid planning</button></div></section>' +
    '<section class="panel-section"><div class="section-head"><h3>Map overlays</h3></div>' +
    Object.entries(overlaySpec)
      .map(
        ([key, [name, ic]]) =>
          '<button class="overlay-row" role="switch" aria-checked="' +
          map.opts[key] +
          '" data-overlay="' +
          key +
          '">' +
          icon(ic, 15) +
          esc(name) +
          '<i class="switch" aria-hidden="true"></i></button>',
      )
      .join("") +
    "</section>";
}
function fireShares(i) {
  const fields = {
    0: "fireOutsideShare",
    2: "fireElevatedShare",
    3: "fireExtremeShare",
  };
  return bins(lensById("fire"), m).map(({ key, label, color }) => ({
    label,
    color,
    percent: m.val(i, fields[key]) / 100,
  }));
}

function fireCoverage(i) {
  const shares = fireShares(i);
  const bar = shares
    .map(
      ({ percent, color }) =>
        `<span style="width:${percent}%;background:${color}"></span>`,
    )
    .join("");
  return detailSection(
    "Fire tier coverage",
    `<div class="fire-share-bar" aria-hidden="true">${bar}</div>` +
      shares
        .map(({ label, percent }) => fact(label, number(percent, 2) + "%"))
        .join(""),
  );
}

function inspector() {
  const i = map.selected,
    p = chosenPlace,
    l = map.lens;
  if (i < 0 && !p && !selectedLandmark) {
    sideMode = "layers";
    layers();
    return;
  }
  const v = (id) => formatValue(lensById(id), valueAt(m, id, i));
  const bg = localRow(m, "bg", i)?.[0],
    zip = localRow(m, "zcta", i)?.[0];
  const homeMoe = i >= 0 ? localValue(m, m.local.fields.homeMoe, i) : null;
  const moe = homeMoe == null ? "Unavailable" : "±$" + number(homeMoe);
  const sourceArea = localArea(m, l.id, i);
  const county = i >= 0 ? m.reg.counties[m.val(i, "county")] : null,
    tract = i >= 0 ? m.tracts.rows[m.val(i, "tract")] : null;
  const heading =
    selectedLandmark?.name ||
    p?.name ||
    (i >= 0
      ? formatValue(lensById("terrain"), valueAt(m, "terrain", i)) + " hex"
      : "Map location");
  const cell = i >= 0 ? m.val(i, "col") + ", " + m.val(i, "row") : "";
  let html =
    '<section class="detail-hero"><button class="back-btn" data-action="back">' +
    icon("back", 14) +
    'Map layers</button><span class="eyebrow">' +
    (selectedLandmark
      ? "Historic landmark"
      : p
        ? "Census place"
        : "Tile inspector") +
    "</span><h2>" +
    esc(heading) +
    "</h2><p>" +
    esc(
      p && !p.inside
        ? "Place marker outside SCE territory"
        : county?.name || "SCE service territory",
    ) +
    "</p>";
  if (i >= 0)
    html +=
      '<div class="lens-callout"><button class="change-lens" data-action="library" aria-label="Change active map lens">' +
      icon("layers", 14) +
      "Change lens</button><span>" +
      esc(l.name) +
      "</span><strong>" +
      esc(formatValue(l, map.values[i])) +
      "</strong><small>" +
      esc(l.scope) +
      (sourceArea ? " · " + esc(sourceArea) : "") +
      "</small>" +
      (l.id === "home_value"
        ? "<small>90% margin of error · " + esc(moe) + "</small>"
        : "") +
      "</div>";
  html += "</section>";
  if (i >= 0 && l.id === "fire") html += fireCoverage(i);
  if (p)
    html += detailSection(
      "Place profile",
      fact(
        "Population · ACS 2020–2024",
        p.pop == null ? "No data" : number(p.pop),
      ) +
        fact("Census place ID", p.id) +
        '<p class="fine">The Census internal point identifies the tile. Population describes the entire place.</p>' +
        (i < 0 && map.civ.byId.get(p.id)?.metroId
          ? btn(
              "Open metro profile",
              "metro-report",
              'data-id="' + map.civ.byId.get(p.id).metroId + '"',
            )
          : ""),
    );
  if (i >= 0) {
    const cov = m.val(i, "coverage") / 1e6;
    if (l.id === "sceCooling" || m.val(i, "sceCooling") > 0) {
      const key = m.val(i, "col") + "," + m.val(i, "row");
      const sites = m.portals.cooling.sites.filter((site) => site.tile === key);
      html += detailSection(
        "Cooling centers in this hex",
        sites.length
          ? sites
              .map(
                (site) =>
                  `<div class="cooling-site"><strong>${esc(site.name)}</strong><p>${esc([site.address, site.city, site.zip].filter(Boolean).join(", "))}</p><p>${esc(site.hours || "Hours not listed")}</p></div>`,
              )
              .join("")
          : "<p>No listed sites in this hex.</p>",
      );
    }
    const classAndCoverage = (key) => {
      const percent = (column) =>
        number(localValue(m, m.local.fields[column], i), 2) + "%";
      const bands = [1, 2, 3].map(
        (rank) =>
          esc(formatValue(lensById(key), rank)) +
          " · " +
          percent(key + "Band" + rank),
      );
      const mapped = localValue(m, m.local.fields[key + "Coverage"], i);
      const scope =
        mapped === 0 && m.val(i, key) != null
          ? "<0.01%"
          : percent(key + "Coverage");
      return (
        fact(lensById(key).name, v(key) + " · " + scope + " mapped") +
        (m.val(i, key) == null
          ? ""
          : `<details class="band-coverage"><summary>Coverage by MW band</summary><ul>${bands.map((b) => "<li>" + b + "</li>").join("")}</ul></details>`)
      );
    };
    html += detailSection(
      "SCE planning in this hex",
      fact("Approved study-area records", v("planningAreas")) +
        fact(
          "CAISO / utility / CPUC records",
          ["caisoAreas", "utilityAreas", "cpucAreas"]
            .map((k) => number(m.val(i, k)))
            .join(" / "),
        ) +
        fact("Approved study area coverage", v("projectCoverage")) +
        (l.id === "fire" ? "" : fact("Fire tier by largest area", v("fire"))) +
        fact("Tier 1 tree mortality", v("tierOne")) +
        classAndCoverage("growth") +
        classAndCoverage("loadFull") +
        classAndCoverage("loadPartial") +
        '<button class="table-link" data-report="planning">Planning sources and methods</button>',
    );
    if (l.id !== "fire") html += fireCoverage(i);
    html += detailSection(
      "One-mile tile",
      fact("Hex column, row", cell) +
        fact(
          "Inside SCE boundary",
          cov === 1
            ? "100%"
            : cov < 0.001
              ? "<0.1%"
              : number(cov * 100, 1) + "%",
        ) +
        fact("Clipped area", number(cov * m.meta.fullAreaSqMi, 4) + " mi²") +
        fact(
          "Sample coordinates",
          (m.val(i, "lat") / 1e5).toFixed(4) +
            "°, " +
            (m.val(i, "lon") / 1e5).toFixed(4) +
            "°",
        ) +
        fact("Land cover", coverNames[m.val(i, "cover")] || "No data") +
        fact("Elevation", v("elev")),
    );
    html += detailSection(
      "Energy & environment",
      fact("Daily solar resource", v("solar")) +
        fact("Normal July high", v("july")) +
        fact("Normal January low", v("january")) +
        fact("Annual precipitation", v("rain")) +
        fact(
          "CalEnviroScreen tract",
          m.tracts.screen[m.val(i, "ces")]?.[0] || "No data",
        ) +
        fact("CalEnviroScreen percentile", v("screen")),
    );
    html += detailSection(
      "Neighborhood estimates · ACS 2020–2024",
      fact("2024 block group", bg || "No data") +
        fact("2024 tract", tract?.[0] || "No data") +
        fact("Median home value", v("home_value")) +
        fact("90% margin of error", moe) +
        fact("Population density", v("density")) +
        fact("Household income", v("income")) +
        fact("Electric home heating", v("electricHeat")) +
        fact("Renter households", v("renters")) +
        fact("Multifamily housing", v("multifamily")) +
        (bg
          ? '<a class="detail-link" target="_blank" rel="noopener" href="' +
            esc(homeTable(bg)) +
            '">Census home-value table for this block group ' +
            icon("external", 13) +
            "</a>"
          : ""),
    );
    html += detailSection(
      "ZIP electricity and vehicles",
      fact("Mapped ZIP / ZCTA", zip || "No data") +
        fact("Published SCE use · Q3 2026", v("gwh")) +
        fact("Residential use · Q3 2026", v("resGwh")) +
        fact(
          "Separately reported class-months",
          number(localValue(m, m.local.fields.publishedClassMonths, i)),
        ) +
        fact("Registered plug-in share · 2025", v("plugShare")) +
        '<p class="fine">The SCE subtotal includes separately reported sales. Census ZCTAs approximate the ZIPs used in the utility and vehicle reports.</p>',
    );
    html += detailSection(
      "Public charging in this hex",
      fact("Listed ports", v("chargers")) + fact("DC fast ports", v("dcFast")),
    );
    if (county)
      html += detailSection(
        "Whole-county context",
        fact("Electricity use · 2024", number(county.gwh) + " GWh") +
          fact(
            "Plug-in vehicle share · 2025",
            number(county.plugShare, 1) + "%",
          ) +
          fact("Public EV chargers · June 2026", number(county.chargers)) +
          '<button class="detail-link" data-action="county-report" data-id="' +
          county.geoid +
          '">' +
          icon("book", 15) +
          "Open county report" +
          icon("right", 14) +
          "</button>" +
          (m.reg.metros[county.cbsa]
            ? '<button class="detail-link" data-action="metro-report" data-id="' +
              county.cbsa +
              '">' +
              icon("building", 15) +
              "Open metro profile" +
              icon("right", 14) +
              "</button>"
            : ""),
      );
    const s = sourceFor(l.source, m.reg);
    html += detailSection(
      "Active lens source",
      '<p class="fine">' +
        esc(l.detail) +
        '</p><p class="fine"><a target="_blank" rel="noopener" href="' +
        esc(s[3]) +
        '">' +
        esc(s[0]) +
        "</a><br>" +
        esc(s[2]) +
        "</p>" +
        btn("Download tile CSV", "tile-csv"),
    );
  }
  if (map.opts.utility && i >= 0) {
    const [x, y] = map.coords[i],
      local = map.utility.byId.get(
        "1:" + m.val(i, "col") + "," + m.val(i, "row"),
      );
    const region = map.utility.at(12, x, y);
    let nearby =
      local && map.utility.filters.has("ev")
        ? '<p class="fine">In this one-mile charging hex</p>' +
          kindButton("ev", local.values.ev, "data-utility-pick", null, local.id)
        : "";
    if (
      region &&
      kinds.some((k) => region.values[k] && map.utility.filters.has(k))
    )
      nearby +=
        '<p class="fine">12-mile area around the tile center</p>' +
        resourceButtons(region, "data-utility-pick");
    if (nearby) html += detailSection("Utility resources", nearby);
  }
  $("side-body").innerHTML = html;
}
function chooseLens(id, fromDialog = false) {
  const l = lensById(id);
  if (!l) return;
  map.setLens(l);
  if (
    map.sourceAreas.selection &&
    map.sourceAreas.selection.layer !== map.sourceAreas.layer(l)
  )
    clearSelected();
  map.sourceAreas.hover = null;
  legend();
  layersOrDetail();
  scheduleHash();
  if (fromDialog) {
    closeDialog();
    if (small()) $("sidebar").classList.remove("open");
  }
  hovered(-1);
}
function legend() {
  const l = map.lens,
    items = map.legend;
  const isCat = categorical(l.id);
  let body = "";
  if (isCat)
    body =
      '<div class="leg-grid" ' +
      (l.id === "fire" ? 'style="grid-template-columns:1fr"' : "") +
      ">" +
      items
        .map(
          (b) =>
            '<span class="key"><i class="chip" style="background:' +
            b.color +
            '"></i>' +
            esc(b.label) +
            "</span>",
        )
        .join("") +
      "</div>";
  else
    body =
      '<div class="ramp" aria-label="' +
      esc(items.map((b) => b.label).join(", ")) +
      '">' +
      items
        .map(
          (b) =>
            '<i title="' +
            esc(b.label) +
            '" style="background:' +
            b.color +
            '"></i>',
        )
        .join("") +
      '</div><div class="ramp-labels"><span>' +
      esc(items[0].label) +
      "</span><span>" +
      esc(items.at(-1).label) +
      "</span></div>";
  const source = sourceFor(l.source, m.reg);
  if (map.hasNoData)
    body +=
      '<span class="key" style="margin-top:5px"><i class="chip" style="background:#a4a49a"></i>No data</span>';
  const notes =
    l.id === "terrain"
      ? "Zoom in to see individual hexes"
      : l.scope +
        " · " +
        (l.unit ? l.unit + " · " : "") +
        source[2].split(" · ")[0];
  const utilityKey = map.opts.utility
    ? '<div class="utility-key"><div class="utility-key-items">' +
      kinds
        .filter((k) => map.utility.filters.has(k))
        .map(
          (k) =>
            '<span class="key"><canvas width="34" height="34" data-key="' +
            k +
            '" aria-hidden="true"></canvas>' +
            categories[k].name +
            "</span>",
        )
        .join("") +
      '</div><small id="utility-legend-scale">' +
      esc(utilityScaleText()) +
      "</small></div>"
    : "";
  const shapeLayer = map.sourceAreas.layer(l);
  const switcher = shapeLayer
    ? '<div class="geo-mode" role="group" aria-label="Map geography"><button data-geography="hex" aria-pressed="' +
      !map.sourceAreas.enabled +
      '">One-mile hexes</button><button data-geography="source" aria-pressed="' +
      map.sourceAreas.enabled +
      '">' +
      shapeNames[shapeLayer] +
      "</button></div>"
    : "";
  $("legend").classList.toggle("closed", !legendOpen);
  $("legend").innerHTML =
    '<button class="legend-head" data-action="legend" aria-expanded="' +
    legendOpen +
    '">' +
    icon(l.icon, 15) +
    "<strong>" +
    esc(l.name) +
    '</strong><span class="chev">' +
    icon("down", 13) +
    "</span></button>" +
    (legendOpen
      ? '<div class="legend-body">' +
        switcher +
        body +
        '<p class="legend-note">' +
        esc(notes) +
        "</p>" +
        utilityKey +
        "</div>"
      : "");
  for (const canvas of $("legend").querySelectorAll("canvas[data-key]")) {
    const c = canvas.getContext("2d");
    c.scale(2, 2);
    drawUtilityArt(c, canvas.dataset.key, 8.5, 8.5, 16, false, false);
  }
}
function updateText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}
function drawStatus() {
  if (!map || !map.lens) return;
  const native = map.sourceAreas.enabled && map.sourceAreas.layer(map.lens);
  const reading = native
    ? shapeNames[native] + " · source polygons"
    : "1 mile across flats";
  updateText($("geography-status"), reading);
  const scope = $("utility-legend-scale");
  if (scope) updateText(scope, utilityScaleText());
  const terrainNote = $("legend").querySelector(".legend-note");
  if (map.lens.id === "terrain" && terrainNote)
    updateText(
      terrainNote,
      map.scale < 5
        ? "Zoom in to see individual hexes"
        : "One-mile tiles · NLCD 2021",
    );
  const max = small() ? 65 : 88,
    goal = max / map.scale;
  const choices = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200];
  const d = choices.filter((v) => v <= goal).at(-1) || 0.1;
  const scaleBar = $("scale"),
    width = d * map.scale;
  if (width !== drawStatus.scaleWidth) {
    scaleBar.style.width = width + "px";
    drawStatus.scaleWidth = width;
  }
  updateText(scaleBar.querySelector("span"), d + " mi");
  const zoomIn = $("zoom-in"),
    zoomOut = $("zoom-out");
  const atMaxZoom = map.z >= 59.99,
    atMinZoom = map.z <= 0.701;
  if (zoomIn.disabled !== atMaxZoom) zoomIn.disabled = atMaxZoom;
  if (zoomOut.disabled !== atMinZoom) zoomOut.disabled = atMinZoom;
  updateText(
    $("status-mode"),
    map.lens.name + (map.opts.utility ? " · Utility" : ""),
  );
  if (lastHover < 0)
    updateText(
      $("status-info"),
      map.selected >= 0
        ? "Hex " +
            m.val(map.selected, "col") +
            ", " +
            m.val(map.selected, "row")
        : map.utility.selection
          ? areaName(map.utility.selection.area) +
            " · Near " +
            map.utility.selection.area.near
          : map.sourceAreas.selection
            ? map.lens.scope +
              " · " +
              map.sourceAreas.row(
                map.sourceAreas.selection.layer,
                map.sourceAreas.selection.index,
              )[0]
            : map.sourceAreas.enabled && map.sourceAreas.layer(map.lens)
              ? "Select a source area to inspect"
              : "Select a hex to inspect",
    );
}
function hovered(i, pos, label) {
  if (label?.kind === "cooling") i = map.lookup.get(label.p.tile);
  lastHover = i;
  const utility = label?.kind === "utility";
  const native = label?.kind === "source";
  if ((i < 0 && !utility && !native) || !pos) {
    $("hover").hidden = true;
    drawStatus();
    return;
  }
  const scope = utility
    ? areaName(label.p) +
      " · " +
      summary(label.assetKind, label.p.values[label.assetKind])
    : native
      ? map.lens.scope +
        " · " +
        map.sourceAreas.row(label.layer, label.index)[0]
      : localArea(m, map.lens.id, i) ||
        m.reg.counties[m.val(i, "county")]?.name ||
        "SCE service territory";
  $("hover").innerHTML =
    "<b>" +
    esc(
      label?.kind === "cooling"
        ? label.p.name
        : utility
          ? categories[label.assetKind].name
          : formatValue(
              map.lens,
              native
                ? map.sourceAreas.value(map.lens, label.index)
                : map.values[i],
            ),
    ) +
    "</b><small>" +
    esc(scope) +
    "</small>";
  $("hover").hidden = false;
  $("hover").style.left =
    Math.max(4, Math.min(map.w - $("hover").offsetWidth - 4, pos[0] + 15)) +
    "px";
  $("hover").style.top =
    Math.max(4, Math.min(map.h - $("hover").offsetHeight - 4, pos[1] + 14)) +
    "px";
  $("status-info").textContent = utility
    ? areaName(label.p) + " · Near " + label.p.near
    : native
      ? scope
      : "Hex " +
        m.val(i, "col") +
        ", " +
        m.val(i, "row") +
        " · " +
        (m.val(i, "lat") / 1e5).toFixed(3) +
        "° N, " +
        (-m.val(i, "lon") / 1e5).toFixed(3) +
        "° W";
}
function showSelected(i, p = null, landmark = null) {
  map.sourceAreas.selection = null;
  map.sourceAreas.hover = null;
  map.utility.selection = null;
  map.utilityHover = null;
  map.selected = i;
  chosenPlace = p;
  map.place = p;
  map.landmark = landmark;
  selectedLandmark = landmark;
  sideMode = "detail";
  inspector();
  map.queue();
  hovered(-1);
  if (small()) $("sidebar").classList.add("open");
  $("side-body").scrollTop = 0;
  scheduleHash();
}
function pick(i, label) {
  if (label?.kind === "cooling") {
    showSelected(map.lookup.get(label.p.tile));
    return;
  }
  if (label?.kind === "source") {
    showSource(label.layer, label.index);
    return;
  }
  if (label?.kind === "utility") {
    showUtility(label.p, label.assetKind);
    return;
  }
  if (label?.kind === "park") {
    parkGo(label.p);
    return;
  }
  if (label?.kind === "place") {
    const p = label.p;
    showSelected(p.inside ? map.cellAt(p.x, p.y) : -1, p);
    return;
  }
  if (label?.kind === "landmark") {
    const a = label.p;
    showSelected(map.cellAt(a.x, a.y), null, a);
    return;
  }
  if (i >= 0) showSelected(i);
  else {
    clearSelected();
    message("Outside the mapped SCE territory");
  }
}
function clearSelected() {
  map.sourceAreas.selection = null;
  map.sourceAreas.hover = null;
  map.utility.selection = null;
  map.utilityHover = null;
  map.selected = -1;
  map.place = null;
  map.landmark = null;
  chosenPlace = null;
  selectedLandmark = null;
  sideMode = "layers";
  layers();
  map.queue();
  scheduleHash();
}
function lookup(term) {
  const s = term.trim().toLowerCase();
  if (!s) return [];
  const tile = s.match(/^hex\s+(-?\d+)\s*[, ]\s*(-?\d+)$/);
  if (tile) {
    const key = Number(tile[1]) + "," + Number(tile[2]),
      i = map.lookup.get(key);
    return i == null
      ? []
      : [{ name: "Hex " + key, kind: "hex", item: i, scope: "One-mile tile" }];
  }
  return [
    ...m.meta.places.map((p) => ({
      name: p.name,
      kind: "place",
      item: p,
      scope: p.inside ? "SCE place" : "Nearby place",
    })),
    ...m.reg.counties.map((p) => ({
      name: p.name,
      kind: "county",
      item: p,
      scope: "County",
    })),
    ...m.context.landmarks.map((p) => ({
      name: p.name,
      kind: "landmark",
      item: p,
      scope: "Landmark",
    })),
    ...m.context.parks.map((p) => ({
      name: p.name,
      kind: "park",
      item: p,
      scope: "NPS unit",
    })),
  ]
    .filter((x) => x.name.toLowerCase().includes(s))
    .sort((a, b) => {
      const score = (x) => {
        const n = x.name.toLowerCase();
        return (
          (n === s ? 100 : n.startsWith(s) ? 60 : 0) +
          (x.item.inside ? 4 : 0) +
          (x.kind === "county" ? 2 : 0)
        );
      };
      return (
        score(b) - score(a) ||
        (b.item.pop || 0) - (a.item.pop || 0) ||
        a.name.localeCompare(b.name)
      );
    })
    .slice(0, 12);
}
function searchRender() {
  const term = $("find").value.trim();
  searchItems = lookup(term);
  activeResult = 0;
  $("results").hidden = !term;
  $("find").setAttribute("aria-expanded", String(!!term));
  $("results").innerHTML =
    searchItems
      .map(
        (r, i) =>
          '<button tabindex="-1" class="result" role="option" id="result-' +
          i +
          '" aria-selected="' +
          (i === 0) +
          '" data-result="' +
          i +
          '">' +
          icon(
            r.kind === "place"
              ? "pin"
              : r.kind === "county"
                ? "map"
                : r.kind === "park"
                  ? "leaf"
                  : "landmark",
            15,
          ) +
          "<strong>" +
          esc(r.name) +
          "</strong><small>" +
          esc(r.scope) +
          "</small></button>",
      )
      .join("") ||
    (term ? '<div class="empty">No matching place in this atlas.</div>' : "");
  if (searchItems.length)
    $("find").setAttribute("aria-activedescendant", "result-0");
  else $("find").removeAttribute("aria-activedescendant");
}
function closeSearch() {
  searchItems = [];
  $("results").hidden = true;
  $("find").setAttribute("aria-expanded", "false");
  $("find").removeAttribute("aria-activedescendant");
}
function countyGo(c) {
  if (!c) return;
  closeDialog();
  clearSelected();
  const b = c.mapBounds,
    zoom =
      Math.min(
        (map.w - 110) / (b[2] - b[0] || 1),
        (map.h - 110) / (b[3] - b[1] || 1),
      ) / map.base;
  map.go(
    (b[0] + b[2]) / 2,
    (b[1] + b[3]) / 2,
    Math.max(1.4, Math.min(zoom, 24)),
  );
  const i = map.cellAt(...c.anchor);
  if (i >= 0) {
    showSelected(i);
    if (m.reg.counties[m.val(i, "county")]?.geoid !== c.geoid)
      message("County boundary fragment · " + c.name);
  }
}
function parkGo(p) {
  clearSelected();
  map.opts.parks = true;
  layers();
  const a = p.rings.flat(),
    xs = a.map((v) => v[0]),
    ys = a.map((v) => v[1]);
  const b = [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];
  map.go(
    (b[0] + b[2]) / 2,
    (b[1] + b[3]) / 2,
    Math.max(
      2,
      Math.min(
        17,
        (map.w - 100) / ((b[2] - b[0]) * map.base),
        (map.h - 100) / ((b[3] - b[1]) * map.base),
      ),
    ),
  );
  message(p.name);
}
function chooseResult(n) {
  const r = searchItems[n];
  if (!r) return;
  const p = r.item;
  $("find").value = "";
  closeSearch();
  $("find").blur();
  hovered(-1);
  if (r.kind === "hex") {
    const xy = map.coords[p];
    map.go(xy[0], xy[1], 18);
    showSelected(p);
  } else if (r.kind === "county") countyGo(p);
  else if (r.kind === "park") {
    parkGo(p);
  } else if (r.kind === "landmark") {
    map.opts.landmarks = true;
    map.go(p.x, p.y, 12);
    showSelected(map.cellAt(p.x, p.y), null, p);
  } else {
    map.go(p.x, p.y, small() ? 12 : 9);
    showSelected(p.inside ? map.cellAt(p.x, p.y) : -1, p);
  }
}
function showDialog(type, title, html) {
  $("dialog").dataset.view = type;
  for (const v of ["map", "sources", "almanac"]) {
    const active =
      v === (type === "sources" || type === "almanac" ? type : "map");
    if (active) $("nav-" + v).setAttribute("aria-current", "page");
    else $("nav-" + v).removeAttribute("aria-current");
  }
  $("dialog-title").textContent = title;
  $("dialog-body").innerHTML = html;
  $("dialog-body").scrollTop = 0;
  if (!$("dialog").open) $("dialog").showModal();
}
function closeDialog() {
  if ($("dialog").open) $("dialog").close();
}
function library(q = "") {
  const chosen = lenses.filter((l) =>
    (l.name + " " + l.group + " " + l.scope)
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    '<div class="library"><label class="group-title" for="lens-filter">Filter map lenses</label><input id="lens-filter" placeholder="Find a lens" value="' +
    esc(q) +
    '">' +
    [...new Set(chosen.map((l) => l.group))]
      .map(
        (g) =>
          "<h3>" +
          esc(g) +
          '</h3><div class="library-grid">' +
          chosen
            .filter((l) => l.group === g)
            .map(
              (l) =>
                '<button class="library-btn ' +
                (l === map.lens ? "active" : "") +
                '" data-lens="' +
                l.id +
                '"><span class="library-icon" style="' +
                styleFor(l.id) +
                '">' +
                icon(l.icon, 17) +
                "</span><span><strong>" +
                esc(l.name) +
                "</strong><small>" +
                esc(l.scope) +
                "</small></span>" +
                (l === map.lens
                  ? '<span class="check">' + icon("check", 15) + "</span>"
                  : "") +
                "</button>",
            )
            .join("") +
          "</div>",
      )
      .join("") +
    (chosen.length ? "" : '<p class="empty">No matching lens.</p>') +
    "</div>"
  );
}
function almanac(view = "utility", id = "") {
  showDialog("almanac", "Almanac", report(m, view, id));
  $("dialog").dataset.report = view;
  scheduleHash();
}
function makeHash() {
  const p = new URLSearchParams({
    lens: map.lens.id,
    x: map.x.toFixed(3),
    y: map.y.toFixed(3),
    z: map.z.toFixed(3),
    layers: Object.keys(map.opts)
      .filter((k) => map.opts[k])
      .join(","),
  });
  if (map.selected >= 0)
    p.set(
      "tile",
      m.val(map.selected, "col") + "," + m.val(map.selected, "row"),
    );
  if (chosenPlace) p.set("place", chosenPlace.id);
  if (map.sourceAreas.enabled) p.set("geography", "source");
  if (map.sourceAreas.selection) {
    const { layer, index } = map.sourceAreas.selection;
    p.set("geoid", map.sourceAreas.row(layer, index)[0]);
  }
  if (map.utility.filters.size !== kinds.length)
    p.set(
      "resources",
      kinds.filter((k) => map.utility.filters.has(k)).join(","),
    );
  if (map.opts.utility && map.utility.selection) {
    const { area, kind } = map.utility.selection;
    p.set("resource", kind + "@" + area.id);
  }
  if (selectedLandmark) {
    p.set("landmark", selectedLandmark.id);
    p.set("site", selectedLandmark.name);
  }
  if ($("dialog").open && $("dialog").dataset.view === "almanac")
    p.set("report", $("dialog").dataset.report);
  return "#" + p.toString();
}
function scheduleHash() {
  if (restoreHash || !map?.lens) return;
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const hash = makeHash();
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }, 150);
}
function loadHash() {
  if (!location.hash) return;
  restoreHash = true;
  try {
    const p = new URLSearchParams(location.hash.slice(1)),
      l =
        lensById(p.get("lens")) ||
        lensById(p.get("lens")?.startsWith("sce") ? "sceCooling" : "terrain");
    if (map.lens !== l) map.setLens(l);
    map.sourceAreas.enabled = p.get("geography") === "source";
    if (p.has("layers")) {
      const set = new Set(p.get("layers").split(","));
      for (const key of Object.keys(map.opts)) map.opts[key] = set.has(key);
    }
    map.utility.filters = new Set(
      p.has("resources")
        ? p
            .get("resources")
            .split(",")
            .filter((k) => kinds.includes(k))
        : kinds,
    );
    const cv = ["x", "y", "z"];
    if (
      cv.every(
        (k) => p.has(k) && p.get(k) !== "" && Number.isFinite(Number(p.get(k))),
      )
    ) {
      map.go(...cv.map((k) => Number(p.get(k))));
    }
    const i = map.lookup.get(p.get("tile")) ?? -1,
      place = m.meta.places.find((v) => v.id === p.get("place")),
      land = m.context.landmarks.find(
        (v) =>
          v.id === p.get("landmark") &&
          (!p.has("site") || v.name === p.get("site")),
      );
    const [kind, id] = (p.get("resource") || "").split("@"),
      area = map.utility.byId.get(id);
    const layer = map.sourceAreas.enabled && map.sourceAreas.layer(l);
    const nativeIndex =
      layer && p.has("geoid")
        ? m.local.tables[layer].rows.findIndex((r) => r[0] === p.get("geoid"))
        : -1;
    if (map.opts.utility && map.utility.filters.has(kind) && area?.values[kind])
      showUtility(area, kind);
    else if (nativeIndex >= 0) showSource(layer, nativeIndex);
    else if (i >= 0 || place || land)
      showSelected(i, place || null, land || null);
    else clearSelected();
    syncUtilityControls();
    legend();
    layersOrDetail();
    map.queue();
    const requested =
      (p.get("report") === "outages" ? "cooling" : p.get("report")) ||
      {
        faith: "religion",
        faith_tradition: "religion",
        amenities: "counties",
        disasters: "counties",
      }[p.get("lens")];
    if (
      [
        "utility",
        "cooling",
        "planning",
        "religion",
        "counties",
        "metros",
        "region",
        "state",
      ].includes(requested)
    )
      almanac(requested);
  } finally {
    restoreHash = false;
  }
}
function save(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function tileCsv() {
  const i = map.selected;
  if (i < 0) return;
  const tile = m.val(i, "col") + "," + m.val(i, "row");
  const coordinates = [tile, m.val(i, "lat") / 1e5, m.val(i, "lon") / 1e5];
  const rows = [
    [
      "Tile",
      "Sample latitude",
      "Sample longitude",
      "Indicator",
      "Value",
      "Reporting geography",
      "Source area ID or label",
      "Home value 90% margin of error (USD)",
      "Source",
    ],
    ...lenses.map((l) => [
      ...coordinates,
      l.name,
      formatValue(l, valueAt(m, l.id, i)),
      l.scope,
      localArea(m, l.id, i) || "",
      l.id === "home_value"
        ? (localValue(m, m.local.fields.homeMoe, i) ?? "")
        : "",
      sourceFor(l.source, m.reg)[0],
    ]),
    ...fireShares(i).map(({ label, percent }) => [
      ...coordinates,
      "Fire tier coverage · " + label,
      number(percent, 2) + "%",
      "One-mile hex inside SCE",
      "Hex " + tile,
      "",
      sourceFor("drpepFire", m.reg)[0],
    ]),
  ];
  save(
    new Blob(
      [
        rows
          .map((r) =>
            r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
          )
          .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    "edison-tile-" + m.val(i, "col") + "-" + m.val(i, "row") + ".csv",
  );
}
function shareDialog() {
  const url = new URL(location.href);
  url.hash = makeHash();
  showDialog(
    "share",
    "Share this view",
    '<p class="dialog-intro">The link preserves the lens, overlays, zoom and selected tile. ' +
      (portable
        ? "The file link opens on this computer. Send the HTML file itself to share the entire atlas."
        : location.hostname === "127.0.0.1" || location.hostname === "localhost"
          ? "A localhost link opens on a computer serving this atlas at the same address."
          : "Anyone with access to this atlas can open the link.") +
      '</p><input id="share-url" class="share-input" readonly aria-label="Link to this view" value="' +
      esc(url.href) +
      '"><div class="actions">' +
      btn("Copy link", "copy") +
      btn("Download map PNG", "png") +
      "</div>",
  );
}
function snapshot() {
  map.draw();
  const d = map.dpr,
    w = Math.max(720, map.w),
    h = map.h,
    footer = map.opts.utility ? 107 : 72,
    out = document.createElement("canvas");
  out.width = w * d;
  out.height = (h + footer) * d;
  const c = out.getContext("2d");
  c.scale(d, d);
  c.fillStyle = "#f5f4e8";
  c.fillRect(0, 0, w, h + footer);
  c.drawImage(map.canvas, (w - map.w) / 2, 0, map.w, h);
  c.drawImage(map.overlay, (w - map.w) / 2, 0, map.w, h);
  const l = map.lens,
    items = [...map.legend];
  if (map.hasNoData) items.push({ label: "No data", color: "#a4a49a" });
  const columns = Math.min(3, items.length),
    rows = Math.ceil(items.length / columns);
  c.font = '11px "Open Sans",Arial';
  const cellWidth =
      Math.ceil(Math.max(...items.map((v) => c.measureText(v.label).width))) +
      26,
    legendWidth = cellWidth * columns + 14,
    legendHeight = rows * 16 + 14;
  const left = (w - map.w) / 2 + 12,
    top = h - legendHeight - 12;
  c.fillStyle = "#f7f5e8";
  c.fillRect(left, top, legendWidth, legendHeight);
  c.strokeStyle = "#9aa58e";
  c.strokeRect(left, top, legendWidth, legendHeight);
  items.forEach((v, i) => {
    const x = left + 8 + (i % columns) * cellWidth,
      y = top + 7 + Math.floor(i / columns) * 16;
    c.fillStyle = v.color;
    c.fillRect(x, y + 1, 10, 10);
    c.fillStyle = "#304b38";
    c.fillText(v.label, x + 14, y + 10);
  });
  c.fillStyle = "#193e34";
  c.fillRect(0, h, w, footer);
  c.fillStyle = "#fbf7df";
  c.font = 'bold 16px "Open Sans",Arial';
  c.fillText("Edison Atlas  ·  " + l.name, 15, h + 22);
  c.font = '11px "Open Sans",Arial';
  c.fillStyle = "#d8e1c9";
  c.fillText(
    "Southern California Edison service territory  /  " +
      (map.sourceAreas.enabled && map.sourceAreas.layer(l)
        ? "Source polygons"
        : "One-mile hexes") +
      "  /  " +
      l.scope,
    15,
    h + 40,
  );
  const s = sourceFor(l.source, m.reg);
  c.font = '10px "Open Sans",Arial';
  c.fillText(
    s[1] +
      "  ·  " +
      s[2] +
      (l.source === "prism" ? "  ·  prism.oregonstate.edu" : "") +
      "  |  Atlas snapshot 2026-11-27",
    15,
    h + 57,
    w - 185,
  );
  const bar = parseFloat($("scale").style.width);
  if (map.opts.utility) {
    c.textAlign = "left";
    c.font = '10px "Open Sans",Arial';
    c.fillStyle = "#fbf1c4";
    let x = 15;
    for (const kind of kinds.filter((k) => map.utility.filters.has(k))) {
      drawUtilityArt(c, kind, x + 7, h + 73, 14, false, false);
      c.fillText(categories[kind].name, x + 18, h + 76);
      x += c.measureText(categories[kind].name).width + 32;
    }
    c.fillText(utilityScaleText(), x, h + 76, w - x - 15);
    c.fillStyle = "#d8e1c9";
    c.fillText(
      "Operating inventory: EIA-860M, October 2026   /   Public charging: AFDC, November 27, 2026",
      15,
      h + 92,
      w - 30,
    );
  }
  c.strokeStyle = "#fbf7df";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(w - 16 - bar, h + 43);
  c.lineTo(w - 16 - bar, h + 48);
  c.lineTo(w - 16, h + 48);
  c.lineTo(w - 16, h + 43);
  c.stroke();
  c.textAlign = "right";
  c.fillText($("scale").textContent, w - 16, h + 38);
  out.toBlob((blob) => {
    if (blob) save(blob, "edison-atlas-" + l.id + ".png");
  }, "image/png");
}
function install() {
  const click = async (e) => {
    const el = e.target.closest("button,a");
    if (!el) return;
    if (el.dataset.geography) {
      setSourceMode(el.dataset.geography === "source");
      return;
    }
    if (el.dataset.lens) {
      chooseLens(el.dataset.lens, $("dialog").contains(el));
      return;
    }
    if (el.dataset.overlay) {
      const k = el.dataset.overlay;
      map.opts[k] = !map.opts[k];
      el.setAttribute("aria-checked", map.opts[k]);
      if (k === "utility") {
        if (!map.opts.utility) {
          map.utilityHover = null;
          if (map.utility.selection) clearSelected();
          utilityMenu(false);
        }
        syncUtilityControls();
        legend();
        if (sideMode === "detail") inspector();
      }
      map.queue();
      scheduleHash();
      return;
    }
    if (el.dataset.utilityFilter) {
      const k = el.dataset.utilityFilter;
      map.opts.utility = true;
      if (map.utility.filters.has(k)) map.utility.filters.delete(k);
      else map.utility.filters.add(k);
      if (
        map.utility.selection &&
        !map.utility.filters.has(map.utility.selection.kind)
      )
        clearSelected();
      map.utilityHover = null;
      syncUtilityControls();
      legend();
      layersOrDetail();
      map.queue();
      scheduleHash();
      return;
    }
    if (el.dataset.utilityPick) {
      showUtility(
        map.utility.byId.get(el.dataset.utilityArea),
        el.dataset.utilityPick,
      );
      return;
    }
    if (el.dataset.result != null) {
      chooseResult(Number(el.dataset.result));
      return;
    }
    if (el.dataset.report) {
      almanac(el.dataset.report);
      return;
    }
    if (el.dataset.coolingSite) {
      const site = m.portals.cooling.sites.find(
        (v) => String(v.id) === el.dataset.coolingSite,
      );
      if (site) {
        chooseLens("sceCooling", true);
        map.go(site.x, site.y, 30);
        showSelected(map.lookup.get(site.tile));
      }
      return;
    }
    const a = el.dataset.action;
    if (a === "library") showDialog("library", "Map lenses", library());
    if (a === "back") {
      clearSelected();
      $("side-body").scrollTop = 0;
    }
    if (a === "legend") {
      legendOpen = !legendOpen;
      legend();
    }
    if (a === "county-report") almanac("counties", el.dataset.id);
    if (a === "metro-report") almanac("metros", el.dataset.id);
    if (a === "locate-county")
      countyGo(m.reg.counties.find((c) => c.geoid === el.dataset.id));
    if (a === "tile-csv") tileCsv();
    if (a === "utility-zoom" && map.utility.selection) {
      zoomUtility(map.utility.selection.area);
      if (small()) $("sidebar").classList.remove("open");
    }
    if (a === "png") snapshot();
    if (a === "copy") {
      const input = $("share-url");
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        el.textContent = "Copied";
      } catch {
        el.textContent = document.execCommand("copy")
          ? "Copied"
          : "Select and copy the link";
      }
    }
  };
  document.addEventListener("click", click);
  $("utility-menu").onclick = () => utilityMenu($("utility-panel").hidden);
  $("utility-area").onchange = (e) => {
    const area = map.utility.byId.get(e.target.value);
    if (!area) return;
    const kind = kinds.find(
      (k) => map.utility.filters.has(k) && area.values[k],
    );
    showUtility(area, kind);
    zoomUtility(area);
  };
  $("zoom-in").onclick = () => map.zoom(1.7);
  $("zoom-out").onclick = () => map.zoom(1 / 1.7);
  $("fit").onclick = () => {
    clearSelected();
    map.fit();
    if (small()) $("sidebar").classList.remove("open");
  };
  $("locator").addEventListener("click", (e) => {
    if (e.detail === 0) map.fit();
  });
  $("share").onclick = shareDialog;
  $("nav-map").onclick = () => {
    closeDialog();
    if (small()) $("sidebar").classList.remove("open");
  };
  $("nav-almanac").onclick = () => almanac();
  $("nav-sources").onclick = () =>
    showDialog("sources", "Data sources", sourcePage(m));
  $("method").onclick = () =>
    showDialog("method", "Grid & methodology", method(m));
  $("dialog-close").onclick = closeDialog;
  $("dialog").onclick = (e) => {
    if (e.target === $("dialog")) {
      const r = $("dialog").getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closeDialog();
    }
  };
  $("dialog").addEventListener("close", () => {
    scheduleHash();
    $("nav-map").setAttribute("aria-current", "page");
    $("nav-almanac").removeAttribute("aria-current");
    $("nav-sources").removeAttribute("aria-current");
  });
  $("mobile-layers").onclick = () => {
    sideMode = "layers";
    layers();
    $("sidebar").classList.add("open");
  };
  $("mobile-close").onclick = () => $("sidebar").classList.remove("open");
  $("dialog-body").addEventListener("change", (e) => {
    if (e.target.id === "county-list") almanac("counties", e.target.value);
    if (e.target.id === "metro-list") almanac("metros", e.target.value);
  });
  $("dialog-body").addEventListener("input", (e) => {
    if (e.target.id === "cooling-filter") {
      const needle = e.target.value.trim().toLowerCase();
      const rows = Array.from($("cooling-table").tBodies[0].rows);
      for (const row of rows)
        row.hidden = !Array.from(row.cells).some((cell) =>
          cell.textContent.toLowerCase().includes(needle),
        );
      $("cooling-empty").hidden = rows.some((row) => !row.hidden);
      return;
    }
    if (!["lens-filter", "source-filter"].includes(e.target.id)) return;
    const { id, value, selectionStart, selectionEnd } = e.target;
    $("dialog-body").innerHTML =
      id === "lens-filter" ? library(value) : sourcePage(m, value);
    const inp = $(id);
    inp.focus();
    inp.setSelectionRange(selectionStart, selectionEnd);
  });
  $("find").addEventListener("input", searchRender);
  $("find").addEventListener("focus", searchRender);
  $("find").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSearch();
      $("find").blur();
      return;
    }
    if (!searchItems.length) return;
    if (e.key === "Enter") {
      e.preventDefault();
      chooseResult(activeResult);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      activeResult =
        (activeResult + (e.key === "ArrowDown" ? 1 : -1) + searchItems.length) %
        searchItems.length;
      $("find").setAttribute("aria-activedescendant", "result-" + activeResult);
      $("results")
        .querySelectorAll("[role=option]")
        .forEach((el, i) =>
          el.setAttribute("aria-selected", String(i === activeResult)),
        );
      $("result-" + activeResult).scrollIntoView({ block: "nearest" });
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".find-wrap")) closeSearch();
    if (!e.target.closest(".utility-control")) utilityMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("utility-panel").hidden) {
      e.preventDefault();
      utilityMenu(false);
      $("utility-menu").focus();
      return;
    }
    if (
      $("dialog").open ||
      e.target.matches("input,textarea,select") ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key === "/") {
      e.preventDefault();
      $("find").focus();
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      map.zoom(1.7);
    }
    if (e.key === "-") {
      e.preventDefault();
      map.zoom(1 / 1.7);
    }
    if (e.key === "Home") {
      e.preventDefault();
      $("fit").click();
    }
    if (e.key === "?") $("method").click();
    if (e.key === "Escape") {
      clearSelected();
      if (small()) $("sidebar").classList.remove("open");
    }
  });
  window.addEventListener("hashchange", loadHash);
}
start().catch((err) => {
  console.error(err);
  $("loading").textContent =
    "The atlas could not load its data. " +
    (location.protocol === "file:"
      ? "Open it with the local web server described in the README."
      : err.message);
});
