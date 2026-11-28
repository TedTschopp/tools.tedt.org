import { drawUtilityArt } from "./utility-art.js";

export function stationAreas(map) {
  if (map.stationAreas) return map.stationAreas;
  const rows = map.m.local.tables.energyArea.rows;
  const byArea = new Map(map.m.portals.substations.areas.map(area =>
    [area.col + "," + area.row, {...area, width:12, id:area.col + "," + area.row, tile: -1, distance: Infinity}]));
  const missing = new Map();
  for (const area of byArea.values()) {
    const i = map.cellAt(area.x, area.y);
    if (i >= 0 && rows[map.m.val(i, "energyArea")]?.[0] === area.id) area.tile = i;
    else missing.set(area.id, area);
  }
  if (missing.size) {
    for (let i = 0; i < map.coords.length; i++) {
      const area = missing.get(rows[map.m.val(i, "energyArea")]?.[0]);
      if (!area) continue;
      const [x,y] = map.coords[i];
      const distance = (area.x - x) ** 2 + (area.y - y) ** 2;
      if (distance < area.distance) {
        area.distance = distance;
        area.tile = i;
      }
    }
  }
  map.stationAreas = [...byArea.values()].filter(a => a.tile >= 0).sort((a,b) => b.count - a.count || a.row - b.row || a.col - b.col);
  return map.stationAreas;
}

export function drawSubstations(ctx, map) {
  const size = Math.min(39, Math.max(18, map.scale * 3.4)), half = size / 2;
  const occupied = map.labels.filter(h => !h.symbol || h.kind === "utility");
  const offset = Math.min(26, map.scale * 4.6);
  const positions = [[0,0], [0,-offset], [offset,0], [-offset,0], [0,offset],
    [offset*.8,-offset*.8], [-offset*.8,offset*.8]];
  const hits = [];
  ctx.save();
  for (const area of stationAreas(map)) {
    const [ax,ay] = map.screen(area.x,area.y);
    if (ax < -half || ay < -half || ax > map.w+half || ay > map.h+half) continue;
    const badge = map.scale >= 5 || area.count >= 10;
    const n = String(area.count), w = n.length > 1 ? 16 : 11;
    let box, x, y;
    for (const [dx,dy] of positions) {
      x = ax + dx; y = ay + dy;
      const candidate = {x0:x-half, x1:x+half+(badge ? w-2 : 0), y0:y-half-(badge ? 3 : 0), y1:y+half, kind:"substation", p:area};
      if (!occupied.some(b => b.x0 < candidate.x1 && candidate.x0 < b.x1 && b.y0 < candidate.y1 && candidate.y0 < b.y1)) {
        box = candidate;
        break;
      }
    }
    if (!box) continue;
    if (x !== ax || y !== ay) {
      ctx.strokeStyle = "#385b60"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(x,y); ctx.stroke();
    }
    drawUtilityArt(ctx,"substation",x,y,size,map.scale >= 5,map.stationSelection === area);
    if (badge) {
      const left = x+half-2, top = y-half-3;
      ctx.fillStyle="#173c49"; ctx.strokeStyle="#f2cf80"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(left,top,w,12,3);ctx.fill();ctx.stroke();
      ctx.fillStyle="#fff0c4";ctx.font="bold 10px system-ui";ctx.textAlign="center";
      ctx.fillText(n,left+w/2,top+9);
    }
    occupied.push(box);hits.push(box);
  }
  ctx.restore();
  map.labels.unshift(...hits);
}
