import { compact, dollars, int, esc } from "./usaciv/format.js";
import { amenities, gdpRow, growthSpan, industries, popLine, statRow, yieldGrid } from "./usaciv/ui/infoPanel.js";
import { icon } from "./usaciv/ui/icon.js";
import { drawCityTile } from "./usaciv/render/art/city.js";
import { CALIFORNIA } from "./civ-terrain.js";
import { districtRows, mapSeal, metricStrip, populationHistory, residentFigures, shareMeter } from "./profile-art.js";

export const section = (title, content) =>
  '<section class="detail-section cp-section"><h3>' + esc(title) + "</h3>" + content + "</section>";

export function profileLink(kind, id, title, value = "") {
  return `<button class="geo-row" data-profile-kind="${esc(kind)}" data-id="${esc(id)}"><span>${esc(title)}</span><small>${esc(value)}</small><span aria-hidden="true">›</span></button>`;
}

const source = (url, title) => `<a target="_blank" rel="noopener" href="${esc(url)}">${esc(title)}</a>`;
const stateLink = () => profileLink("state", "06", "California", "State");
const censusPlace = id => source("https://data.census.gov/profile?g=160XX00US" + id, "U.S. Census Bureau · Place profile");
const percent = n => n == null ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%";
const stat = (glyph, label, value, fmt = int) => statRow(glyph, "•", label, value, null, fmt, null);
const foot = html => '<div class="profile-foot">' + html + "</div>";
const cityAnchor = (m, region) => m.meta.places.find(p => p.id.startsWith("06") && p.name === region.name);
const countyLink = c => profileLink("county", c.geoid, c.name, "County");
const metroLink = r => profileLink("metro", r.id, r.name, "Metro");

function head(kind, title, sub, extra = "", art = false) {
  return `<section class="detail-hero profile-head"><button class="back-btn" data-action="back">‹ Map layers</button>
    ${art === true ? '<canvas class="profile-art" width="172" height="144" aria-hidden="true"></canvas>' : art || ""}
    <span class="eyebrow">${esc(kind)}</span><h2>${esc(title)}</h2><p>${esc(sub)}</p>${extra}</section>`;
}

export function paintCityArt(container, city) {
  const canvas = container.querySelector(".profile-art");
  if (!canvas || !city) return;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  drawCityTile(ctx, city, 42, 46, 27, { s: 1, Rpx: 27, seed: city.cell, stateColor: CALIFORNIA });
}

export function tileArt(container, map, i, background) {
  const canvas = container.querySelector(".profile-art");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const [x, y] = map.coords[i], scale = 57;
  ctx.setTransform(2 * scale, 0, 0, 2 * scale, 86 - x * scale * 2, 72 - y * scale * 2);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI * (k / 3 - 0.5);
    const px = x + Math.cos(a) / Math.sqrt(3), py = y + Math.sin(a) / Math.sqrt(3);
    if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = background;
  ctx.fill();
  ctx.strokeStyle = "#c9a45c";
  ctx.lineWidth = 1.3 / scale;
  ctx.stroke();
  ctx.clip();
  map.civ.terrain(ctx, [i], scale, true, true, 2);
}

export function placeProfile(m, place, hex, lensCallout, localSections) {
  const o = m.profiles.places[place.id];
  const county = m.reg.counties.find(c => c.geoid === o.county);
  const metro = m.reg.metros[county?.cbsa];
  const related = (metro ? metroLink(metro) : "") + (county ? countyLink(county) : "") +
    (o.state === "CA" ? stateLink() : "");
  return head(o.kind, place.name, [county?.name, o.state, "Place " + place.id].filter(Boolean).join(" · "),
    `<div class="cp-pop">${icon("pop", "♟")} <b>${int(o.population)}</b> residents</div>`, true) +
    (o.education ? section("Residents", residentFigures("education", o.education, m.reg.peopleGroups.education)) : "") +
    section("People & households",
      stat("i-professional", "Employed residents", o.employed) +
      stat("unemployment", "Unemployment", o.unemployment, percent) +
      stat("l-income", "Median household income", o.income, dollars) +
      stat("l-home", "Median home value", o.home, dollars) +
      shareMeter("l-homeownership", "Renter households", o.renters, "#b593d0") +
      shareMeter("r-solar", "Homes using electric heat", o.electricHeat, "#efbb61")) +
    section("SCE map location", hex ? lensCallout + profileLink("hex", hex, "Inspect one-mile hex", hex) :
      '<p class="fine">The Census reference point for this place falls outside the mapped service territory.</p>') +
    localSections + (related ? section("Related geographies", related) : "") +
    foot("Figures cover the whole Census place. ACS 2020–2024 five-year estimates. " + censusPlace(place.id));
}

function economy(m, o, isState) {
  const nation = m.profiles.nation;
  return section(isState ? "Yields · rank among states" : "Yields", '<div class="yield-grid">' +
      yieldGrid(nation, o.yields, isState ? o.ranks : null, m.profiles.stateCount) + "</div>" +
      '<p class="fine">Food, production, science and culture count workers by industry. Gold measures GDP in dollars.</p>') +
    section("Economy & housing", gdpRow(o) + amenities(o, nation.nation)) +
    section("Leading industries", industries(o, nation, 6));
}

function metroProfile(m, r) {
  const nation = m.profiles.nation.nation, anchor = cityAnchor(m, r), badge = r.districts?.badge;
  const related = (anchor ? profileLink("place", anchor.id, anchor.name, "City proper") : "") +
    r.counties.map(id => m.reg.counties.find(c => c.geoid === id)).filter(Boolean).map(countyLink).join("") + stateLink();
  const badgeHtml = badge ? `<span class="district-badge" style="--district:${m.profiles.districtColors[badge.district] || "#9575ad"}">${icon("d-"+badge.district,"✦")} ${esc(badge.label)}</span>` : "";
  const residents = ["workforce","age","commute","education","nativity"].map(k =>
    residentFigures(k,r.people?.[k]?.counts,m.reg.peopleGroups[k])).join("");
  const districts = districtRows(m,(r.districts?.districts || []).map(d => [d.id,d.lq,d.emp,d.lower_bound]));
  const overview = economy(m, r, false) + section("Related geographies", related);
  const pages = [["overview","Overview","map",overview]];
  if (residents) pages.push(["people","Residents","pop",section("Metro residents",residents)]);
  if (districts) pages.push(["districts","Districts","i-manufacturing",section("Economic districts",
    (badge ? '<p class="fine">' + esc(badge.text) + '</p>' : '') + districts +
    '<p class="fine">The multiplier compares the industry’s share of metro jobs with its share nationwide.</p>')]);
  return head("Metro area", r.name, r.full, badgeHtml + popLine(r, growthSpan(r, nation)), true) +
    '<nav class="dossier-nav" aria-label="Metro profile sections">' + pages.map(([key,title,glyph],i) =>
      `<button type="button" data-dossier="${key}" aria-pressed="${!i}" aria-controls="dossier-${key}">${icon(glyph,"◆",{size:16})}${title}</button>`).join("") + '</nav>' +
    pages.map(([key,,,body],i) => `<div id="dossier-${key}" data-dossier-page="${key}" ${i ? "hidden" : ""}>${!i ? populationHistory(r) : ""}${body}</div>`).join("") +
    foot("Whole metro · CBSA " + esc(r.id) + " · " + esc(m.profiles.nation.vintage) +
      '. <button data-action="metro-report" data-id="' + esc(r.id) + '">Full metro almanac ›</button>');
}

function stateProfile(m) {
  const o = m.profiles.state, nation = m.profiles.nation.nation;
  const metros = Object.values(m.reg.metros).sort((a, b) => b.population - a.population);
  return head("State", o.name, "CA · FIPS 06", popLine(o, growthSpan(o, nation)), mapSeal(m,"06")) + economy(m, o, true) +
    section("California land cover", shareMeter("land","Forest",o.land.forest*100,"#85a86c") +
      shareMeter("y-food","Cropland",o.land.crop*100,"#d7ba69") + shareMeter("i-construction","Developed",o.land.developed*100,"#ab9eac")) +
    section("Metros in this atlas", metros.map(r => profileLink("metro", r.id, r.name, compact(r.population))).join("")) +
    section("Counties in this atlas", m.reg.counties.map(countyLink).join("")) +
    foot("Statewide figures · " + esc(m.profiles.nation.vintage) + '. <button data-report="state">Full state almanac ›</button>');
}

function countyProfile(m, c) {
  const places = m.meta.places.filter(p => m.profiles.places[p.id]?.county === c.geoid)
    .sort((a, b) => (m.profiles.places[b.id].population || 0) - (m.profiles.places[a.id].population || 0)).slice(0, 8);
  const region = m.reg.metros[c.cbsa];
  return head("County", c.name, "California · FIPS " + c.geoid,
    `<div class="cp-pop">${icon("pop", "♟")} <b>${int(c.population)}</b> residents</div>`, mapSeal(m,c.geoid)) +
    section("County electricity", metricStrip([["r-solar","Solar MW",compact(c.solarMW),"#ebc15d"],
      ["r-wind","Wind MW",compact(c.windMW),"#84c6bf"],["r-battery","Storage MW",compact(c.storageMW),"#a8c784"]])) +
    (c.districts?.districts?.length ? section("Economic districts", districtRows(m,c.districts.districts) +
      '<p class="fine">Job concentration compared with the U.S. share.</p>') : "") +
    section("People & housing", stat("l-income", "Median household income", c.income, dollars) +
      stat("l-home", "Median home value", c.home_value, dollars) +
      stat("l-homeownership", "Owner-occupied homes", c.homeownership == null ? null : c.homeownership * 100, percent)) +
    section("Electricity & transport", stat("i-utilities", "Electricity use · 2024", c.gwh, n => int(n) + " GWh") +
      stat("r-ev-charging", "Public chargers", c.chargers) +
      '<p class="fine">Whole-county figures across electricity providers. The SCE boundary overlaps ' +
      esc(c.overlapSqMi.toLocaleString("en-US", { maximumFractionDigits: 2 })) + ' square miles of this county.</p>') +
    (places.length ? section("Places in this atlas", places.map(p => profileLink("place", p.id, p.name, compact(m.profiles.places[p.id].population))).join("")) : "") +
    section("Related geographies", (region ? metroLink(region) : "") + stateLink()) +
    foot('<button data-action="county-report" data-id="' + esc(c.geoid) + '">Full county almanac & sources ›</button>');
}

export function regionProfile(m, kind, item) {
  if (kind === "county") return countyProfile(m, item);
  if (kind === "metro") return metroProfile(m, item);
  if (kind === "park") return head("National Park Service", item.name, "Park unit · " + item.code) +
    section("Park boundary", '<p class="fine">The map outlines the published park unit. Its atlas marker sits within the portion that overlaps SCE.</p>') +
    section("Related geographies", stateLink()) +
    foot(source("https://www.nps.gov/" + item.code.toLowerCase() + "/", "National Park Service · Visitor information"));
  return stateProfile(m);
}

export function landAccessSection(access, key) {
  const shares = access.byHex[key];
  if (!shares) return "";
  const labels = ["Military land", "Protected land · restricted access", "Protected land · no public access"];
  return section("Military & restricted land",
    '<p class="access-key"><i class="access-swatch"></i> Share of this hex inside SCE</p>' +
    shares.map((v, i) => v ? stat("land", labels[i], v, n => n < 0 ? "&lt;0.01%" : (n / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%") : "").join("") +
    '<p class="fine">Military and protected-land footprints can overlap. Military boundaries describe land use. Protected-area labels describe published public access.</p>');
}
