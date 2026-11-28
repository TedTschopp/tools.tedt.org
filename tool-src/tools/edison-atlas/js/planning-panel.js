import { esc, int } from "./usaciv/format.js";
import { number } from "./lenses.js";

const authority = { caiso: "CAISO", utility: "Utility", cpuc: "CPUC" };
const permitCodes = { Streamlined: "ready", "Streamlining in Progress": "progress", "Not Streamlined": "pending" };
const host = "https://drpep.sce.com/arcgis_server/rest/services/Hosted";
export const serviceLink = (service, layer) => host + "/" + encodeURIComponent(service) + "/FeatureServer/" + Number(layer);

function publishedLink(url, label) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) return "";
  return `<a href="${esc(url.trim())}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

const hexButton = (key, title) => key ? `<button class="table-link" data-profile-kind="hex" data-id="${esc(key)}">${esc(title)}</button>` : esc(title);
const status = (name) => `<span class="permit-badge permit-${permitCodes[name] || "unknown"}">${esc(name || "Status unavailable")}</span>`;
const pct = bp => bp === 0 ? "&lt;0.01%" : number(bp / 100, 2) + "%";

export function hexPermits(m, i, hex) {
  const permits = m.portals.permits;
  const primary = m.val(i, "permitJurisdiction");
  if (primary == null) return '<p class="fine">GO-Biz publishes no permitting jurisdiction for this portion of the hex.</p>';
  const parts = permits.split[hex] || [[primary, m.val(i, "evPermitCoverage")]];
  return parts.map(([fid, bp], index) => {
    const j = permits.jurisdictions[fid];
    const links = [publishedLink(j.Website, "Ordinance"), publishedLink(j.ChecklistURL, "Permit checklist")].filter(Boolean);
    const adopted = [j.Adoption_Month, j.Adoption_Year].filter(v => v && v !== "N/A").join(" ");
    const criteria = Object.entries(permits.criteria).map(([field, label]) => {
      const value = j[field] || "Unreported";
      return `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
    }).join("");
    return `<details class="permit-card" ${index === 0 ? "open" : ""}><summary><b>${esc(j.Name)}</b><span>${pct(bp)} of hex</span></summary>
      ${status(j.Compliance_Status)}${adopted ? '<p class="fine">Adoption · ' + esc(adopted) + '</p>' : ""}
      ${links.length ? '<div class="permit-links">' + links.join(" · ") + '</div>' : ""}
      <details class="permit-criteria"><summary>Permitting scorecard</summary>${criteria}</details></details>`;
  }).join("") + '<p class="fine">City ordinances cover incorporated land. County rules apply to the remaining mapped area. California GO-Biz publishes the scorecard.</p>';
}

export function hexProjects(portals, hex) {
  const indexes = portals.projects.byHex[hex] || [];
  if (!indexes.length) return "";
  const groups = new Map();
  for (const i of indexes) {
    const p = portals.projects.records[i];
    const key = JSON.stringify([p.name, p.status, p.year]);
    if (!groups.has(key)) groups.set(key, {p, approvals: new Set()});
    groups.get(key).approvals.add(authority[p.authority]);
  }
  return '<div class="study-cards">' + Array.from(groups.values(), ({p, approvals}) =>
    `<article><strong>${esc(p.name || "Unnamed study area")}</strong><small>${esc(p.status || "Status unreported")}${p.year ? " · Planned service " + esc(p.year) : ""}</small><span>${esc([...approvals].join(" · "))}</span></article>`).join("") + '</div>';
}

export function additionalPlanning(m, table, link) {
  const info = m.portals.additional, t = info.territory;
  const amount = (value, suffix) => number(value, 1) + " " + suffix;
  const totals = [["Existing generation",t.existing_gen],["Queued generation",t.queued_gen],["Total generation",t.total_gen],["Projected load",t.projected_load]];
  const dataCards = totals.map(([label,value]) => `<div class="stat-box"><small>${label}</small><strong>${amount(value,"MW")}</strong></div>`).join("");
  const stats = info.tables.map(s => {
    const rows = s.rows.map(row => row.map((v,j) => v == null || v === "" ? "Unreported" :
      typeof v === "number" && !["Year","Planning year","DER forecast year"].includes(s.columns[j]) ? number(v, 3) : v));
    return `<details><summary>${esc(s.title)}</summary><div class="sce-scroll">${table(s.columns,rows)}</div>${link(serviceLink(s.service,s.layer),"SCE source table")}</details>`;
  }).join("");
  const projects = m.portals.projects.records;
  const projectTable = projects.map(p => `<tr><td>${hexButton(p.hex,p.name || "Unnamed study area")}</td><td>${authority[p.authority]}</td><td>${esc(p.status || "Unreported")}</td><td>${esc(p.year || "Unreported")}</td></tr>`).join("");
  const permits = Object.values(m.portals.permits.jurisdictions).sort((a,b) => a.Name.localeCompare(b.Name));
  const permitTable = permits.map(j => `<tr><td>${hexButton(j.hex,j.Name)}</td><td>${esc(j.Compliance_Status)}</td></tr>`).join("");
  const stations = m.portals.substations;
  return `<h4>SCE service territory</h4><div class="tile-stats">${dataCards}</div>
    <p>SCE reports ${number(100*t.penetration_level,2)}% generation penetration. Its numerator includes existing and queued generation. ${link(serviceLink("ICA_Layer",17),"SCE territory record")}</p>
    <h4>Substations</h4><p>${int(stations.included)} of SCE’s ${int(stations.sourceCount)} inventory records fall inside this boundary. Each transformer symbol shows the count in a 12-mile reporting area.</p>
    <div class="actions"><button class="action-btn" data-lens="substations">Map substations</button></div>
    <h4>Mapped transmission and distribution routes</h4>
    <p>Plum traces SCE’s transmission routes and teal traces distribution. Indigo marks one-mile pixels containing both. The atlas and its overview inset use the same California Albers map registration.</p>
    <p>The renderer processed all ${int(m.portals.network.layers.transmission.records)} published transmission records and ${int(m.portals.network.layers.distribution.records)} distribution records, then clipped the map to SCE’s service boundary. Zooming in shows the one-mile route coverage. ${link("https://drpep.sce.com/drpep/?page=Page","Open SCE’s original route map")}</p>
    <h4>EV charging permits and project stages</h4>
    <div class="actions"><button class="action-btn" data-lens="evPermitStatus">Map EV permits</button><button class="action-btn" data-lens="drpPlan">Planning</button><button class="action-btn" data-lens="drpBuild">Construction</button><button class="action-btn" data-lens="drpOperate">In operation</button></div>
    <details><summary>${int(permits.length)} permitting jurisdictions</summary><p>Choose a jurisdiction for a covered hex and its published scorecard.</p><div class="sce-scroll"><table class="report-table"><thead><tr><th>Jurisdiction</th><th>Permit status</th></tr></thead><tbody>${permitTable}</tbody></table></div></details>
    <details><summary>${int(projects.length)} transmission study-area approval records</summary><p>Choose a title to inspect a covered hex. A single project may carry several approvals.</p><div class="sce-scroll"><table class="report-table"><thead><tr><th>Study area</th><th>Approval</th><th>Published status</th><th>Planned service year</th></tr></thead><tbody>${projectTable}</tbody></table></div></details>
    <h4>Published planning tables</h4><p>Each table summarizes its own source records across SCE. Circuit and substation forecasts describe different levels of the same system. Load-profile averages describe the published observations. SCE says its forecast-view tab currently contains rolling historical data.</p>
    ${stats}<p class="fine">SCE extract dates · ICA ${esc(info.releaseDates.ICA_Tables)} · GNA ${esc(info.releaseDates.GNA_Layer)} · DUPR ${esc(info.releaseDates.DUPR_Layer)} · LNBA ${esc(info.releaseDates.LNBA_Layer)}.</p>`;
}
