export const gridKinds = ["substations", "transmission", "distribution"];
export const gridNames = {substations:"Substations", transmission:"Transmission", distribution:"Distribution"};
export const regionalDetailScale = 12;

// Decode once. Map pans, zooms, PNG exports and the overview use the same registered images.
export async function loadGridImages(network) {
  const [x0,y0,x1,y1] = network.bounds;
  const images = {};
  await Promise.all(Object.entries(network.images).map(async ([key, encoded]) => {
    const img = new Image();
    img.src = "data:image/png;base64," + encoded;
    await img.decode();
    if (img.naturalWidth !== x1-x0 || img.naturalHeight !== y1-y0)
      throw new Error("The grid image does not match its one-mile map registration");
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img,0,0);
    images[key] = canvas;
  }));
  return {images, bounds:network.bounds};
}

export function drawGridLines(c, grid, filters, scale, boundary) {
  const t = filters.has("transmission"), d = filters.has("distribution");
  if (!t && !d) return;
  const [x0,y0,x1,y1] = grid.bounds;
  c.save();
  c.clip(boundary, "evenodd");
  // At close zoom, reveal the finite source pixels instead of interpolating street-level curves.
  c.imageSmoothingEnabled = scale < regionalDetailScale;
  c.globalAlpha *= scale >= regionalDetailScale ? 0.55 : 0.93;
  c.drawImage(grid.images[t && d ? "both" : t ? "transmission" : "distribution"], x0,y0,x1-x0,y1-y0);
  c.restore();
}
