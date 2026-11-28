// Small inline-SVG charts for the city screen (no libraries). All return HTML strings.
import { esc } from "../../format.js";

let uid = 0;

/**
 * Population sparkline: area + line + a dot per year, first/last values labelled.
 * series = [{year, value}], fmt(value) → text. Width scales with the container (viewBox).
 */
export function sparkline(series, { fmt, color = "#ecd08e", height = 92, title = "" } = {}) {
  if (series.length < 2) return `<p class="muted cv-note">No yearly estimates for this metro.</p>`;
  const W = 400, H = height, padL = 6, padR = 6, padT = 22, padB = 20;
  const vals = series.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || hi * 0.01 || 1;
  lo -= span * 0.12;
  hi += span * 0.12;
  const X = (k) => padL + (k / (series.length - 1)) * (W - padL - padR);
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const pts = series.map((p, k) => [X(k), Y(p.value)]);
  const line = pts.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const area = `${line}L${pts.at(-1)[0].toFixed(1)} ${H - padB}L${pts[0][0].toFixed(1)} ${H - padB}Z`;
  const id = `cvg${++uid}`;
  const first = series[0], last = series.at(-1);
  const up = last.value >= first.value;
  const lineCol = up ? color : "#f08a6a";
  const dots = pts.map(([x, y], k) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k === pts.length - 1 ? 4 : 2.6}" fill="${k === pts.length - 1 ? lineCol : "#16212d"}" stroke="${lineCol}" stroke-width="1.6"><title>${series[k].year}: ${esc(fmt(series[k].value))}</title></circle>`).join("");
  const years = series.map((p, k) =>
    `<text x="${X(k).toFixed(1)}" y="${H - 5}" text-anchor="${k === 0 ? "start" : k === series.length - 1 ? "end" : "middle"}" class="cv-ax">${p.year}</text>`).join("");
  const grid = [0.25, 0.5, 0.75].map((f) => {
    const y = (padT + f * (H - padT - padB)).toFixed(1);
    return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="cv-grid"/>`;
  }).join("");
  return `<svg class="cv-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${lineCol}" stop-opacity=".42"/><stop offset="1" stop-color="${lineCol}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${lineCol}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    ${dots}
    <text x="${pts[0][0].toFixed(1)}" y="${(pts[0][1] - 9).toFixed(1)}" class="cv-lab" text-anchor="start">${esc(fmt(first.value))}</text>
    <text x="${pts.at(-1)[0].toFixed(1)}" y="${(pts.at(-1)[1] - 10).toFixed(1)}" class="cv-lab cv-lab-hi" text-anchor="end">${esc(fmt(last.value))}</text>
    ${years}
  </svg>`;
}

/**
 * A comparison meter: the city's value as a bar on a 0..max scale, with a tick at the U.S. value.
 * better: "high" | "low" | null decides the bar colour against the U.S. value.
 */
export function meter(v, us, max, better = null) {
  if (v == null || !(max > 0)) return `<div class="cv-meter"><i style="width:0"></i></div>`;
  const f = Math.max(0, Math.min(1, v / max));
  const u = us != null ? Math.max(0, Math.min(1, us / max)) : null;
  let cls = "";
  if (better && us != null && Math.abs(v / us - 1) >= 0.03) cls = (better === "high" ? v > us : v < us) ? "good" : "bad";
  return `<div class="cv-meter ${cls}"><i style="width:${(f * 100).toFixed(1)}%"></i>${
    u != null ? `<b class="us" style="left:${(u * 100).toFixed(1)}%" title="U.S."></b>` : ""}</div>`;
}

/** A thin horizontal bar (0..1) in a colour; optional tick (0..1) for a reference such as the U.S. share. */
export function bar(frac, color, tick = null) {
  const f = Math.max(0, Math.min(1, frac || 0));
  return `<div class="cv-bar"><i style="width:${(f * 100).toFixed(1)}%;background:${color}"></i>${
    tick != null ? `<b style="left:${(Math.max(0, Math.min(1, tick)) * 100).toFixed(1)}%" title="U.S. share"></b>` : ""}</div>`;
}
