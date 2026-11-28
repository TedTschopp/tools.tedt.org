import { esc, int, compact } from "./usaciv/format.js";
import { icon } from "./usaciv/ui/icon.js";
import { hasIcon } from "./usaciv/icons.js";
import { citizenSVG, CITIZEN_ROWS } from "./usaciv/render/art/people.js";
import { bar, sparkline } from "./usaciv/ext/cityView/charts.js";

const groupNames = {workforce:"Workforce",age:"Generations",commute:"Journey to work",education:"Education",nativity:"Birthplace"};
const populations = {workforce:"workers",age:"residents",commute:"workers",education:"adults aged 25+",nativity:"residents"};
const districtGlyph = {
  campus:"y-science",commercial_hub:"i-finance",industrial_zone:"i-manufacturing",harbor:"i-transportation",
  theater_square:"i-arts",entertainment_complex:"i-accommodation",aerodrome:"i-transportation",
  government_plaza:"i-public_admin",encampment:"i-public_admin",aqueduct:"i-utilities",
};
const formatPct = value => (value * 100).toLocaleString("en-US",{maximumFractionDigits:1}) + "%";

export function mapSeal(model, id) {
  const path = model.profiles.outlines?.[id];
  if (!path) return "";
  return `<svg class="geo-seal" viewBox="0 0 88 70" role="img" aria-label="Geographic outline"><path d="${esc(path)}" fill-rule="evenodd"/></svg>`;
}

export function metricStrip(items) {
  return '<div class="metric-strip">' + items.map(([glyph,label,value,color]) =>
    `<div class="metric-coin" style="--coin:${color}">${icon(glyph,"◆",{size:24})}<b>${esc(value)}</b><small>${esc(label)}</small></div>`).join("") + '</div>';
}

export function residentFigures(group, counts, labels) {
  const keys = CITIZEN_ROWS[group].filter(key => Number.isFinite(counts?.[key]));
  const total = keys.reduce((sum,k) => sum + counts[k],0);
  if (!total) return "";
  // Largest remainders keep ten illustrated people per row. Exact counts remain visible.
  const values = keys.map(k => counts[k] * 10 / total);
  const units = values.map(Math.floor);
  const order = keys.map((_,i) => i).sort((a,b) => (values[b]-units[b]) - (values[a]-units[a]));
  const rest = 10 - units.reduce((sum,v) => sum+v,0);
  for (let j=0; j<rest; j++) units[order[j]]++;
  const people = keys.map((k,i) => Array.from({length:units[i]},(_,n) =>
    citizenSVG(k,{size:26,variant:n%4,shadow:true})).join("")).join("");
  const legend = keys.map(k => `<li>${citizenSVG(k,{size:22})}<span>${esc(labels[k] || k)}</span><b>${formatPct(counts[k]/total)}</b><small>${int(counts[k])}</small></li>`).join("");
  return `<div class="resident-plot"><h4>${groupNames[group]}</h4><div class="citizen-strip" aria-hidden="true">${people}</div>
    <p>Each figure represents about ${int(Math.round(total/10))} ${populations[group]}.</p>
    <details><summary>Shares and counts</summary><ul>${legend}</ul></details></div>`;
}

export function populationHistory(metro) {
  const points = Object.entries(metro.pop_series || {}).filter(([,v]) => Number.isFinite(v))
    .sort(([a],[b]) => Number(a)-Number(b)).map(([year,value]) => ({year:Number(year),value}));
  if (points.length < 2) return "";
  return '<figure class="population-chart"><figcaption>Population · ' + points[0].year + '–' + points.at(-1).year + '</figcaption>' +
    sparkline(points,{fmt:compact,height:108,title:"Population of the " + metro.name + " metro area"}) +
    '<details><summary>Annual estimates</summary><ol>' + points.map(p => '<li><span>' + p.year + '</span><b>' + int(p.value) + '</b></li>').join("") + '</ol></details></figure>';
}

export function districtRows(model, rows) {
  return (rows || []).map(row => {
    const [district,lq,employees,lowerBound] = row;
    const color = model.profiles.districtColors[district] || "#c9a45c";
    const glyph = hasIcon("d-"+district) ? "d-"+district : districtGlyph[district];
    return `<div class="district-row" style="--district:${color}"><span class="district-medal">${icon(glyph,"◆",{size:24})}</span><div><b>${esc(model.reg.districtNames[district] || district)}</b><small>${lowerBound ? "At least " : ""}${int(employees)} jobs</small></div><strong>${Number(lq).toFixed(2)}×</strong></div>`;
  }).join("");
}

export function shareMeter(glyph, caption, value, color) {
  if (!Number.isFinite(value)) return "";
  return `<div class="share-meter"><span>${icon(glyph,"◆",{size:16})} ${esc(caption)}</span><b>${formatPct(value/100)}</b>${bar(value/100,color)}</div>`;
}
