export const gridKinds = ["substations", "transmission", "distribution"];
export const gridNames = {substations:"Substations", transmission:"Transmission", distribution:"Distribution"};
export const regionalLimit = 12;

export function gridPaths(network) {
  const paths = {};
  for (const [kind, links] of Object.entries(network.layers)) {
    const path = new Path2D();
    for (const [a,b] of links) {
      path.moveTo(...network.nodes[a]);
      path.lineTo(...network.nodes[b]);
    }
    paths[kind] = path;
  }
  return paths;
}

export function drawGridLines(c, paths, filters, scale, boundary) {
  if (scale >= regionalLimit || (!filters.has("transmission") && !filters.has("distribution"))) return;
  c.save();
  c.globalAlpha *= Math.min(1, (regionalLimit - scale) / 4);
  c.clip(boundary, "evenodd");
  c.lineCap = "round";
  c.lineJoin = "round";
  function stroke(path, color, width) {
    c.strokeStyle = color;
    c.lineWidth = width / scale;
    c.stroke(path);
  }
  if (filters.has("transmission")) {
    stroke(paths.transmission, "#fff2d2", 3.7);
    stroke(paths.transmission, "#803758", 2.5);
  }
  if (filters.has("distribution")) {
    c.setLineDash([3 / scale, 3.8 / scale]);
    stroke(paths.distribution, "#eef4d9", 2.0);
    stroke(paths.distribution, "#16696c", 1.35);
  }
  c.restore();
}
