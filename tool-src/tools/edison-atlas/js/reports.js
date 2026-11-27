import { assetUrl, portable } from "./assets.js";
import { number, compact } from "./lenses.js";
import { coverage, direct } from "./sources.js";
import { icon } from "./icons.js";
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const btn = (label, action, attr = "") =>
  '<button class="action-btn" data-action="' +
  action +
  '" ' +
  attr +
  ">" +
  esc(label) +
  "</button>";
const stat = (title, value) =>
  '<div class="stat-box"><small>' +
  esc(title) +
  "</small><strong>" +
  esc(value) +
  "</strong></div>";
const table = (head, rows) =>
  '<table class="report-table"><thead><tr>' +
  head.map((h) => '<th scope="col">' + esc(h) + "</th>").join("") +
  "</tr></thead><tbody>" +
  rows
    .map(
      (r) =>
        "<tr>" + r.map((v) => "<td>" + esc(v) + "</td>").join("") + "</tr>",
    )
    .join("") +
  "</tbody></table>";
const money = (v) => (v == null ? "No data" : "$" + number(v));
const pct = (v) => (v == null ? "No data" : number(v * 100, 1) + "%");
const usd = (v) => (v == null ? "No data" : "$" + compact(v));
const titleCase = (s) =>
  s.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const sourceLink = (url, label) =>
  '<a target="_blank" rel="noopener" href="' +
  esc(assetUrl(url)) +
  '">' +
  esc(label) +
  "</a>";
function bars(pairs, fmt = number) {
  const max = Math.max(1, ...pairs.map((r) => r[1]));
  return pairs
    .map(
      ([name, v]) =>
        '<div class="bar-row"><span>' +
        esc(name) +
        '</span><i><b style="width:' +
        Math.max(0, (v / max) * 100).toFixed(2) +
        '%"></b></i><strong>' +
        esc(fmt(v)) +
        "</strong></div>",
    )
    .join("");
}
const sorted = (o) =>
  Object.entries(o || {})
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => b[1] - a[1]);
function utility(m) {
  const u = m.reg.utility;
  const assets = m.utility.totals;
  return (
    '<h3>Southern California Edison</h3><p class="dialog-intro">These company-wide measures describe SCE’s customer base, seasonal peaks and distributed solar across its California operations.</p><div class="tile-stats">' +
    stat("Customers in reliability report", compact(u.accounts)) +
    stat("Summer peak · 2025", number(u.summerPeak) + " MW") +
    stat("Winter peak · 2025", number(u.winterPeak) + " MW") +
    "</div>" +
    "<h3>Resources inside the service territory</h3><p>The utility layer includes all owners inside the published boundary. A plant can contribute to more than one technology.</p>" +
    table(
      ["Resource", "Sites", "Installed equipment"],
      [
        [
          "Solar generation",
          number(assets.solar.sites),
          number(assets.solar.mw, 1) + " MW",
        ],
        [
          "Wind generation",
          number(assets.wind.sites),
          number(assets.wind.mw, 1) + " MW",
        ],
        [
          "Battery storage",
          number(assets.battery.sites),
          number(assets.battery.mw, 1) +
            " MW · " +
            number(assets.battery.mwh, 1) +
            " MWh",
        ],
        [
          "Public EV charging",
          number(assets.ev.sites),
          number(assets.ev.ports) +
            " ports · " +
            number(assets.ev.dc) +
            " DC fast",
        ],
      ],
    ) +
    "<p>" +
    sourceLink(direct.eia860[3], "EIA operating inventory · October 2026") +
    " · " +
    sourceLink(direct.afdc[3], "AFDC public stations · November 27, 2026") +
    "</p>" +
    "<h3>Electricity use by sector</h3><p>In 2024, the CEC recorded <b>" +
    number(u.history["2024"]) +
    " GWh</b> under Southern California Edison Company. The chart uses the CEC’s agency series. Its planning-area self-generation series is reported separately.</p>" +
    bars(sorted(u.sectors), (v) => number(v) + " GWh") +
    "<details><summary>Annual CEC agency series, 1990–2024</summary>" +
    table(
      ["Year", "Consumption"],
      Object.entries(u.history)
        .reverse()
        .map(([y, v]) => [y, number(v, 1) + " GWh"]),
    ) +
    "</details>" +
    "<h3>Net-metered photovoltaics</h3><p>In 2025 SCE reported <b>" +
    number(u.netSolarSystems) +
    " installations</b> and <b>" +
    number(u.netSolarMW, 1) +
    " MW " +
    esc(u.netSolarBasis) +
    "</b> in the EIA net-metering survey.</p>" +
    "<h3>Distribution reliability</h3><p>IEEE measures reported to EIA for 2025. SAIDI measures average interruption minutes per customer annually. SAIFI measures sustained interruptions per customer annually.</p>" +
    table(
      ["Event treatment", "SAIDI", "SAIFI"],
      [
        ["All events", number(u.saidi, 1) + " min", number(u.saifi, 3)],
        [
          "Excluding major event days",
          number(u.saidiEx, 1) + " min",
          number(u.saifiEx, 3),
        ],
      ],
    ) +
    "<p>" +
    sourceLink(direct.cec[3], "CEC electricity consumption") +
    " · " +
    sourceLink(direct.eia861[3], "EIA Form 861") +
    "</p>"
  );
}
function counties(m, selected) {
  const c =
    m.reg.counties.find((c) => c.geoid === selected) ||
    m.reg.counties.find((c) => c.name === "Los Angeles County");
  let out =
    '<label class="group-title" for="county-list">Reporting county</label><select id="county-list">' +
    m.reg.counties
      .map(
        (v) =>
          '<option value="' +
          v.geoid +
          '" ' +
          (v === c ? "selected" : "") +
          ">" +
          esc(v.name) +
          "</option>",
      )
      .join("") +
    "</select>" +
    "<h3>" +
    esc(c.name) +
    "</h3><p>Whole-county figures include every provider. The SCE service polygon overlaps " +
    number(c.overlapSqMi, c.overlapSqMi < 10 ? 2 : 0) +
    " square miles of the Census county geography.</p>" +
    '<div class="tile-stats">' +
    stat("Electricity use · 2024", number(c.gwh) + " GWh") +
    stat("Plug-in light vehicles · 2025", number(c.plugIns)) +
    stat("Public chargers · June 2026", number(c.chargers)) +
    '</div><div class="actions">' +
    btn("View county on map", "locate-county", 'data-id="' + c.geoid + '"') +
    "</div>" +
    "<h4>Electricity consumption by sector · 2024</h4>" +
    bars(sorted(c.sectors), (v) => number(v) + " GWh") +
    "<h4>Vehicle electrification</h4>" +
    table(
      ["County measure", "Value"],
      [
        ["Registered light-duty vehicles · 2025", number(c.vehicles)],
        ["Share that plug in", number(c.plugShare, 1) + "%"],
        ["Public DC fast chargers · June 2026", number(c.dcFast)],
        ["Limited-access chargers · June 2026", number(c.limited)],
      ],
    ) +
    "<details><summary>Operating capacity by technology · October 2026</summary>" +
    bars(sorted(c.capacity), (v) => number(v, 1) + " MW") +
    "</details>" +
    "<details><summary>Population, housing and county indicators</summary>" +
    table(
      ["Indicator", "Whole county"],
      m.reg.fields
        .filter(
          (f) => !["geoid", "name", "state", "cell", "cbsa"].includes(f.key),
        )
        .map((f) => {
          const v = c[f.key];
          let formatted =
            typeof v === "number" ? number(v, 1) : (v ?? "No data");
          if (f.format === "pct") formatted = pct(v);
          if (["income", "home_value"].includes(f.key)) formatted = money(v);
          return [f.label, formatted];
        }),
    ) +
    "</details>";
  if (c.fema)
    out +=
      "<details><summary>FEMA major disaster declarations</summary><p>Distinct county declarations since 2000, through November 25, 2026. The reference omits biological events, emergency declarations and fire-management assistance declarations.</p>" +
      table(
        ["Incident", "Declarations"],
        [
          "flood",
          "fire",
          "severe_storm",
          "winter",
          "hurricane",
          "other",
          "total",
        ].map((k) => [titleCase(k), number(c.fema[k])]),
      ) +
      "<p>Most recent declaration · " +
      esc(c.fema.last_date) +
      "</p></details>";
  if (c.districts)
    out +=
      "<details><summary>Industry specializations · BLS QCEW</summary><p>Location quotients compare the industry’s local employment share with its national share.</p>" +
      table(
        ["District", "Location quotient", "Jobs"],
        c.districts.districts.map(([id, q, n]) => [
          m.reg.districtNames[id] || id,
          number(q, 2) + "×",
          number(n),
        ]),
      ) +
      "</details>";
  return (
    out +
    "<p>" +
    sourceLink(direct.cec[3], "CEC electricity") +
    " · " +
    sourceLink(direct.vehicles[3], "CEC vehicles and chargers") +
    " · " +
    sourceLink(direct.eia860[3], "EIA operating inventory") +
    "</p>"
  );
}
function metros(m, id) {
  const values = Object.values(m.reg.metros).sort(
      (a, b) => b.population - a.population,
    ),
    c = m.reg.metros[id] || values[0],
    reg = m.reg;
  let html =
    '<label class="group-title" for="metro-list">Metropolitan or micropolitan area</label><select id="metro-list">' +
    values
      .map(
        (v) =>
          '<option value="' +
          v.id +
          '" ' +
          (v === c ? "selected" : "") +
          ">" +
          esc(v.full) +
          "</option>",
      )
      .join("") +
    "</select>" +
    "<h3>" +
    esc(c.full) +
    "</h3><p>USACiv’s metro includes the full counties in the Census delineation. Its figures describe a wider economy than the service territory.</p>" +
    '<div class="tile-stats">' +
    stat("Metro population · 2025", number(c.population)) +
    stat("GDP · " + c.gdp_year, usd(c.gdp)) +
    stat("Median household income", money(c.median_income)) +
    "</div>" +
    "<h4>City yields</h4><p>USACiv’s Food, Production, Science and Culture yields group ACS workers by industry. Gold represents gross domestic product in dollars.</p>" +
    table(
      ["Yield", "Real-world measure"],
      ["food", "production", "gold", "science", "culture"].map((k) => [
        titleCase(k),
        k === "gold" ? usd(c.yields[k]) : number(c.yields[k]) + " workers",
      ]),
    ) +
    "<details><summary>Industry economy and employment</summary>" +
    table(
      ["Industry", "GDP · " + c.gdp_year, "Jobs"],
      Object.keys(c.jobs).map((k) => [
        titleCase(k),
        usd(c.gdp_by_industry?.[k]),
        number(c.jobs[k]),
      ]),
    ) +
    (c.gdp_estimated?.length
      ? "<p>USACiv estimates suppressed industry figures for " +
        esc(c.gdp_estimated.join(", ")) +
        ".</p>"
      : "") +
    "</details>" +
    "<details><summary>Housing, population growth and history</summary>" +
    table(
      ["Measure", "Metro area"],
      [
        ["Median rent", money(c.median_rent)],
        ["Median home value", money(c.home_value)],
        ["Rent burden", pct(c.rent_burden)],
        ["Unemployment", pct(c.unemployment)],
        [
          "Population growth · " + (c.growth_years || []).join("–"),
          pct(c.growth),
        ],
      ],
    ) +
    table(
      ["Year", "Estimated residents"],
      Object.entries(c.pop_series || {}).map(([y, v]) => [y, number(v)]),
    ) +
    "</details>";
  if (c.people)
    for (const [k, group] of Object.entries(c.people)) {
      if (!group.counts) continue;
      html +=
        "<details><summary>" +
        esc(
          {
            workforce: "Occupations",
            age: "Age groups",
            commute: "Commuting",
            education: "Education",
            nativity: "Place of birth",
          }[k] || titleCase(k),
        ) +
        "</summary>" +
        table(
          ["Group", "People", "Share"],
          Object.entries(group.counts).map(([g, v]) => [
            reg.peopleGroups[k]?.[g] || titleCase(g),
            number(v),
            pct(group.shares?.[g]),
          ]),
        ) +
        "</details>";
    }
  if (c.districts?.top?.length)
    html +=
      "<details><summary>Industry specializations</summary>" +
      table(
        ["Industry", "Jobs", "Location quotient"],
        c.districts.top.map((v) => [
          reg.industries[v.naics] || v.naics,
          number(v.emp),
          number(v.lq, 2) + "×",
        ]),
      ) +
      "</details>";
  return (
    html +
    "<p>" +
    sourceLink(
      direct.usaciv[3],
      "USACiv metro profiles and source methodology",
    ) +
    "</p>"
  );
}
function region(m) {
  const r = m.reg,
    county = (gid) => r.counties.find((c) => c.geoid === gid)?.name || "";
  return (
    "<h3>Freight and transport</h3><p>Freight flows cover whole FAF zones. Airports and ports below are the reference map’s selected facilities in counties the published territory touches.</p>" +
    r.trade
      .map(
        (v) =>
          "<details><summary>" +
          esc(v.name) +
          "</summary>" +
          table(
            ["2024 freight value", "Million USD"],
            Object.entries(v.totals).map(([k, n]) => [titleCase(k), money(n)]),
          ) +
          table(
            ["Leading partner zones", "Mode", "Million USD"],
            v.partners.map(([name, n, mode]) => [name, mode, money(n)]),
          ) +
          "</details>",
      )
      .join("") +
    "<h4>Principal ports · 2023</h4>" +
    table(
      ["Port", "County", "Short tons"],
      r.ports.map((v) => [v.name, county(v.county), number(v.tons)]),
    ) +
    "<details><summary>Airport enplanements and cargo · 2025</summary>" +
    table(
      ["Airport", "Boardings", "Cargo, lb"],
      r.airports.map((v) => [
        v.name,
        number(v.enplanements),
        number(v.cargo_lbs),
      ]),
    ) +
    "</details>" +
    "<h3>Parks, landmarks and research</h3><p>" +
    number(m.context.parks.length) +
    " National Park Service units intersect the service boundary, and " +
    number(m.context.landmarks.length) +
    " National Historic Landmark point records fall inside it.</p>" +
    "<details><summary>Park units and historic landmarks</summary>" +
    table(
      ["Name", "Type"],
      [
        ...m.context.parks.map((x) => [x.name, "NPS unit"]),
        ...m.context.landmarks.map((x) => [x.name, "Historic landmark"]),
      ],
    ) +
    "</details>" +
    "<h4>USACiv regional wonders</h4>" +
    table(
      ["Institution or park", "Reported measure"],
      r.wonders.map((w) => [
        w.name,
        w.kind === "natural"
          ? number(w.metrics.visits) + " visits · " + w.metrics.year
          : usd(w.metrics.rd_usd) +
            " R&D · " +
            w.metrics.year +
            " / " +
            number(w.metrics.enrollment) +
            " enrolled · " +
            w.metrics.enrollment_year,
      ]),
    ) +
    "<p>" +
    sourceLink(direct.usaciv[3], "USACiv transport, freight and wonders") +
    " · " +
    sourceLink(direct.parks[3], "National Park Service GIS") +
    "</p>"
  );
}
function state(m) {
  const s = m.reg.state;
  return (
    "<h3>California context</h3><p>These state-level figures provide the same regional context USACiv uses for defense, resources and extreme weather.</p>" +
    '<h4>Defense</h4><div class="tile-stats">' +
    stat("Active-duty personnel · Sep 2026", number(s.defense.active)) +
    stat("DoD spending · FY2024", usd(s.defense.spending)) +
    stat(
      "Mapped installations statewide",
      number(s.defense.installationCount),
    ) +
    "</div>" +
    "<h4>Weather and climate disasters · 1980–2024</h4><p>NOAA’s final billion-dollar-disaster series, with CPI-adjusted state costs as compiled by USACiv.</p>" +
    table(
      ["Type", "Events", "Estimated cost"],
      Object.entries(s.disasters.count).map(([k, v]) => [
        titleCase(k),
        number(v),
        usd(s.disasters.cost_usd[k]),
      ]),
    ) +
    "<h4>Selected resource inventory · Statewide</h4><p>Counts cover records meeting USACiv’s size and selection rules. The regional operating-capacity lenses use the complete EIA operating sheet. California has no selected shale-play or coal-mine record in this snapshot.</p>" +
    table(
      ["Resource", "Selected records", "Value"],
      Object.entries(s.resources).map(([k, v]) => [
        s.resourceNames[k] || k,
        number(v.count),
        number(v.value) + " " + v.unit,
      ]),
    ) +
    "<p>" +
    sourceLink(direct.usaciv[3], "USACiv state data and selection rules") +
    "</p>"
  );
}
function coolingCenters(m) {
  const cooling = m.portals.cooling;
  const rows = cooling.sites
    .map(
      (s) =>
        `<tr><td><button class="table-link" data-cooling-site="${s.id}">${esc(s.name)}</button></td><td>${esc(s.address)}</td><td>${esc(s.city)}</td><td>${esc(s.zip)}</td></tr>`,
    )
    .join("");
  return `<h3>Cooling centers in SCE territory</h3><p>SCE’s November 27, 2026 directory places ${number(cooling.sites.length)} of its ${number(cooling.sourceCount)} public listings inside the service boundary. Select a facility to see its one-mile hex, address and published hours. Confirm availability with the facility before visiting.</p>
    <div class="actions"><button class="action-btn" data-lens="sceCooling">Map cooling centers</button></div>
    <div class="sce-controls"><label>Facility, city, street or ZIP<input id="cooling-filter" type="search" placeholder="Search cooling centers"></label></div>
    <div class="sce-scroll"><table class="report-table" id="cooling-table"><thead><tr><th scope="col">Cooling center</th><th scope="col">Street</th><th scope="col">City</th><th scope="col">ZIP</th></tr></thead><tbody>${rows}</tbody></table></div><p id="cooling-empty" hidden>No matching cooling centers.</p><p>${sourceLink(direct.sceCooling[3], "SCE cooling-center source")}</p>`;
}

function planning(m) {
  const services = m.portals.planning;
  const count = services.reduce(
    (total, service) => total + service.layers.length,
    0,
  );
  return `<h3>Distribution planning</h3><p>SCE’s Distribution Resources Plan External Portal lists ${services.length} public feature services with ${count} layers and tables in the November 27, 2026 snapshot. The map measures the overlap of SCE’s published planning polygons with each one-mile hex inside the territory.</p>
    <h4>Planning data by hex</h4><p>${number(m.portals.mappedHexes.planningAreas)} hexes intersect an approved project study area. Select a hex to see the number of CAISO, utility and CPUC approval records and the share of the hex inside any study area. The wildfire map colors each hex by its largest area share and shows all three percentages when selected.</p>
    <div class="actions"><button class="action-btn" data-lens="planningAreas">Map approved study areas</button><button class="action-btn" data-lens="projectCoverage">Study area coverage</button><button class="action-btn" data-lens="fire">Wildfire tier by area</button><button class="action-btn" data-lens="tierOne">Tier 1 tree mortality</button><button class="action-btn" data-lens="fireTwoPct">Tier 2 fire area</button><button class="action-btn" data-lens="fireThreePct">Tier 3 fire area</button></div>
    <p>The load maps show the published MW band covering the greatest mapped area in each hex. The hex inspector gives the percentage with source coverage for each scenario. When SCE maps several bands over the same place, the inspector lists the area covered by each band. Their percentages can add up to more than 100%. Blank hexes have no published band. A MW band describes the source area and cannot be summed across hexes.</p>
    <div class="actions"><button class="action-btn" data-lens="growth">Load growth</button><button class="action-btn" data-lens="loadFull">Available load · full submittals</button><button class="action-btn" data-lens="loadPartial">Available load · full and partial</button></div>
    <h4>Annual planning assumptions</h4><p>Territory-wide sums of SCE’s circuit planning assumptions, in MW. The source does not allocate these totals to one-mile areas. Forecasts refer to individual circuit peaks at different times. Signs follow SCE’s source. ${sourceLink("https://docs.cpuc.ca.gov/PublishedDocs/Efile/G000/M541/K492/541492933.PDF", "SCE planning data definitions")}</p>
    <div class="sce-scroll">${table(
      [
        "Year",
        "Base demand",
        "Electric vehicles",
        "Solar PV",
        "Storage",
        "Efficiency",
        "Building electrification",
      ],
      m.portals.forecast.map((v) => [
        v.year_value,
        ...["base_demand", "ev", "pv", "es", "ee", "be"].map((k) =>
          number(v["sum_" + k], 1),
        ),
      ]),
    )}</div>
    <details><summary>Distribution upgrade plan by service required</summary>${table(
      ["SCE service category", "Published circuit records"],
      m.portals.upgrades.map((v) => [
        v.grid_need || "Unspecified",
        number(v.records),
      ]),
    )}</details>
    <h4>Published services</h4>${services
      .map(
        (s) =>
          `<details><summary>${esc(s.name.replaceAll("_", " "))} · ${s.layers.length}</summary>${table(
            ["SCE layer or table", "Source records"],
            s.layers.map((r) => [r.name, number(r.count)]),
          )}</details>`,
      )
      .join(
        "",
      )}<p>SCE publishes overlapping views of the same records. Each count belongs to its named layer.</p>`;
}

function religion() {
  return `<h3>Religious affiliation and local sources</h3><p>The 2020 U.S. Religion Census reports adherence and denomination by county. For local employer establishments, the atlas maps the Census Bureau’s religious organizations with payroll by ZIP.</p><div class="actions"><button class="action-btn" data-lens="religiousEmployers">Map religious employers</button></div>
    <h4>Survey estimates within Greater Los Angeles</h4><p>The 2021 Study of Jewish LA estimates where Jewish households in its study area lived. Each percentage uses all Jewish households in the study area as its denominator. The study includes Jewish identity by religion or ethnicity.</p>${table(
      ["Study region", "Share of the study area’s Jewish households"],
      [
        ["West Valley", "26%"],
        ["Westside", "26%"],
        ["Central/Metro/Mid", "24%"],
        ["East Valley", "15%"],
        ["South Bay", "5%"],
        ["North County Valleys", "4%"],
      ],
    )}<p>${sourceLink("https://www.brandeis.edu/cmjs/community-studies/los-angeles-report.html", "Brandeis study, reports and public dataset")}</p>
    <h4>Multiple denominations</h4><p>Pew’s 2023–24 Religious Landscape Study reports adult self-identification by denomination for the ${sourceLink("https://www.pewresearch.org/religious-landscape-study/metro-area/los-angeles-ca/", "Los Angeles metro")} and ${sourceLink("https://www.pewresearch.org/religious-landscape-study/metro-area/riverside-ca/", "Riverside metro")}.</p><p>ACS Technologies’ ReligiousInsite projects religious preferences for ZIPs, tracts and block groups from its national American Beliefs Study. The provider licenses access to these estimates. ${sourceLink("https://help.acst.com/en/missioninsite/how-to/generate-demographic-reports/american-beliefs-study-report-variables", "Study variables and geography")} · ${sourceLink("https://help.acst.com/en/missioninsite/privacy--security/missioninsite-software-services-agreement", "MissionInsite agreement")}</p>`;
}

export function report(m, view = "utility", id = "") {
  const tabs = {
    utility: "SCE profile",
    cooling: "Cooling centers",
    planning: "Grid planning",
    religion: "Religion",
    counties: "Counties",
    metros: "Metro areas",
    region: "Trade & landmarks",
    state: "California",
  };
  return (
    '<div class="report"><nav class="dialog-tabs" aria-label="Almanac sections">' +
    Object.entries(tabs)
      .map(
        ([k, v]) =>
          '<button class="' +
          (view === k ? "active" : "") +
          '" data-report="' +
          k +
          '">' +
          v +
          "</button>",
      )
      .join("") +
    "</nav>" +
    {
      utility: () => utility(m),
      cooling: () => coolingCenters(m),
      planning: () => planning(m),
      religion,
      counties: () => counties(m, id),
      metros: () => metros(m, id),
      region: () => region(m),
      state: () => state(m),
    }[view]() +
    "</div>"
  );
}
export function method(m) {
  const a = m.meta;
  return (
    '<article class="method-page"><h3>One mile across each hex</h3><p>Each regular hex measures exactly 1,609.344 metres between opposite sides in California Albers (NAD83, EPSG:3310). Adjacent centers are one projected mile apart. A full tile covers ' +
    number(a.fullAreaSqMi, 6) +
    " square miles. Across the footprint the checked ellipsoidal distances range from " +
    number(a.groundMiles[0], 5) +
    " to " +
    number(a.groundMiles[1], 5) +
    " miles.</p>" +
    "<h3>Territory and edge cells</h3><p>The atlas retains all " +
    a.pieces +
    " polygon parts and their interior exclusions. It clips every hex with positive intersection area to Edison’s published outline. Summing the clipped areas gives " +
    number(a.areaSqMi, 2) +
    " square miles across " +
    number(a.cells) +
    " tiles, including " +
    number(a.boundaryCells) +
    " partial tiles. Some small islands occupy only a fraction of a cell. The Census internal point identifies a place’s tile. A place that crosses the boundary can have customers on both sides.</p>" +
    "<h3>Reading the artwork</h3><p>USACiv’s painters draw buildings, fields, forests and ridges from land cover and elevation. Building layouts are illustrations. City skylines use local population bands and sit on the tile containing the Census place point. Green population caps mark points inside the service area. Gray caps mark nearby places. Selecting a banner opens the place record.</p><p>At close zoom, a Tile climate ribbon shows daily solar energy per square metre and the normal July high sampled for that hex. A Metro yields ribbon shows USACiv’s five published economic measures for the named regional center. The Almanac defines each yield and lists the full values.</p>" +
    "<h3>Utility resources</h3><p>Utility symbols summarize records inside the service polygon across all owners. The overview uses 48-mile hexes. Regional symbols cover 12-mile hexes. Public charging resolves to individual one-mile hexes at street-area zoom. Select a symbol to outline its reporting area and read the counts. The area name identifies a nearby Census place. Each scale groups the original records independently. Use a single scale for totals.</p>" +
    "<p>The October 2026 EIA-860M inventory covers plants with at least 1 MW of combined nameplate capacity. A site counts once per technology. The November 27 AFDC snapshot counts public stations and Level 1, Level 2 and DC fast ports. The capacity lenses use 12-mile areas and the charging lenses count ports in each clipped one-mile hex. Solar, wind and battery medallions come from USACiv. The charging medallion and four isometric miniatures were drawn for this atlas.</p>" +
    "<p>The geographic overlay touches " +
    m.reg.counties.length +
    " Census county polygons. Alpine, Mariposa and San Diego have less than one square mile of geometric overlap apiece. SCE identifies 15 counties in its published service-area description. County reports here follow the spatial intersection, including those small boundary differences. " +
    sourceLink(
      "https://ia.cpuc.ca.gov/environment/info/panoramaenv/EPL_TLRR/Main/SCE_EPL_TLRR_A2304009-SCE_Amended_Application.pdf",
      "SCE service-area description",
    ) +
    "</p>" +
    "<h3>One-mile tiles and source areas</h3><p>The sample is the hex center when it falls inside SCE, or a point in the clipped portion. Census and ZIP lenses assign that point to its reporting area. A hex can cross several neighborhoods. Switch the legend to Block groups, Census tracts or ZIP areas to color and select the publisher’s polygons directly, including neighborhoods smaller than a hex. The source ID appears in the inspector.</p>" +
    "<p>ACS 2020–2024 supplies neighborhood estimates. The home-value inspector includes the published 90% margin of error. CDC PLACES measures use their own 2023 Census tract geography, and CalEnviroScreen uses its original 2010 tracts. Forest, farmland and developed shares count valid centers in the 250 m NLCD extract inside each clipped hex.</p>" +
    "<p>Postal ZIP estimates use matching 2020 Census ZIP Code Tabulation Areas (ZCTAs) for display. SCE usage covers separately published customer classes in Q3 2026. Combined rows and missing values are excluded. The CEC ZIP worksheet covers all vehicle registrations in the ZIP, including portions beyond SCE. The religion, disaster and wellbeing tables in the county Almanac retain their published scope. The map includes religious employers and FEMA registrations by ZIP and a California-benchmarked health index by tract.</p>" +
    "<p>Blank joins are shown as “No data.” Zero is kept as a measured value. The zoomed terrain uses USACiv’s hand-coded landscape and settlement illustrations. Elevation contours follow the terrain model at 400-metre intervals. The one-mile sampling grid does not increase the resolution of the source measurements.</p>" +
    "<h3>Map controls</h3><p>Drag to pan. Scroll, pinch or use + and − to zoom. Click a tile or source polygon to inspect it. Type / to find a place and Home to fit the territory. With the map focused, use the arrows to pan and Enter to inspect the center. Share view saves the lens, geography mode, camera, overlay filters and selection.</p>" +
    "<p>" +
    sourceLink(direct.boundary[3], "Edison’s territory geometry") +
    " · " +
    sourceLink(direct.usaciv[3], "USACiv reference map") +
    "</p></article>"
  );
}
export function sourcePage(m, q = "") {
  const needle = q.trim().toLowerCase();
  const filter = (a) => a.flat().join(" ").toLowerCase().includes(needle);
  const own = Object.entries(direct).filter(([, s]) => filter(s));
  const ref = m.reg.referenceSources.filter((s) =>
    filter([s.title, s.publisher, s.vintage, coverage[s.id] || ""]),
  );
  return (
    '<div class="source-page"><p class="dialog-intro">The November 27, 2026 snapshot records each publisher, reporting period and spatial scale. The GIS archive contains one-mile hexes, Census block groups and tracts, ZIP areas and utility reporting polygons.</p><div class="actions"><a class="link-btn" download="SCE-one-mile-hexes.zip" href="' +
    esc(assetUrl("data/SCE-one-mile-hexes.zip")) +
    '">' +
    icon("download", 15) +
    "Download one-mile GIS data</a>" +
    (!portable && document.querySelector("tedt-global-header")
      ? '<a class="link-btn" href="Edison-Atlas-offline.zip" download>Download offline atlas</a>'
      : "") +
    '</div><label class="group-title" for="source-filter">Filter sources</label><input id="source-filter" placeholder="Publisher, dataset or subject" value="' +
    esc(q) +
    '">' +
    "<h3>Territory data</h3>" +
    own
      .map(
        ([, s]) =>
          '<div class="source-row"><strong>' +
          esc(s[0]) +
          "</strong><br><small>" +
          esc(s[1]) +
          " · " +
          esc(s[2]) +
          "</small><p>" +
          esc(s[4]) +
          "</p>" +
          sourceLink(s[3], "Publisher and documentation") +
          "</div>",
      )
      .join("") +
    "<h3>USACiv source coverage</h3>" +
    ref
      .map(
        (s) =>
          '<div class="source-row"><strong>' +
          esc(s.title) +
          "</strong><br><small>" +
          esc(s.publisher) +
          " · " +
          esc(s.vintage) +
          "</small><p>" +
          esc(coverage[s.id] || "Regional context.") +
          "</p>" +
          sourceLink(
            s.id === "nlcd" ? direct.nlcdLocal[3] : s.homepage,
            "Original publisher",
          ) +
          "</div>",
      )
      .join("") +
    (!own.length && !ref.length ? "<p>No matching source.</p>" : "") +
    "<p>USACiv terrain, cities, banners, water, roads, rail, landmarks, icons and regional reference data © 2026 Andrej Karpathy. Derived religion measures credit ASARB and the Association of Religion Data Archives (Grammich et al., 2023). Terrain Tiles credit Mapzen and its elevation providers. PRISM Group, Oregon State University, accessed November 27, 2026.</p>" +
    "<p>" +
    sourceLink("data/inputs.json", "Download source URLs and SHA-256 hashes") +
    " · " +
    sourceLink(
      "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
      "Terrain attribution",
    ) +
    " · " +
    sourceLink("licenses/USACiv-MIT.txt", "USACiv license") +
    " · " +
    sourceLink("https://karpathy.ai/usaciv/", "Original USACiv atlas") +
    " · " +
    sourceLink("licenses/Open-Sans-OFL.txt", "Font license") +
    "</p></div>"
  );
}
