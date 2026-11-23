import { projectionModel as model, previewWidth as width, previewHeight as height, viewData } from '../../../tool-src/tools/perplexity-projections/model.mjs';
import { labelMasks, titleMask } from './font-masks.mjs';

// Paper tokens from the Public Workbench. The image stays readable on both card themes.
const paper = 0xf8f6f0;
const ink = 0x101820;
const muted = 0x4e5962;
const rule = 0xd7d5ce;
const control = 0x7d858b;
const link = 0x00446f;
const green = 0x004817;
const orange = 0xbf4714;
const cyan = 0x00779e;
const rgb = color => [color >> 16 & 255, color >> 8 & 255, color & 255];
const mix = (source, target, opacity) => rgb(source).reduce((result, channel, index) =>
  result * 256 + Math.round(channel * (1 - opacity) + rgb(target)[index] * opacity), 0);
const palette = [];
function index(color) {
  const existing = palette.indexOf(color);
  return existing === -1 ? palette.push(color) - 1 : existing;
}
const background = index(paper);
const textInk = [background, index(mix(paper, ink, 1 / 3)), index(mix(paper, ink, 2 / 3)), index(ink)];
const textMuted = [background, index(mix(paper, muted, 1 / 3)), index(mix(paper, muted, 2 / 3)), index(muted)];
const bandColors = [.05, .08, .13, .19, .19, .13, .08, .05].map(opacity => mix(paper, link, opacity));
const bands = bandColors.map(index);
const windowColors = new Uint8Array(256);
windowColors[background] = index(mix(paper, cyan, .12));
for (const [i, color] of bandColors.entries()) windowColors[bands[i]] = index(mix(color, cyan, .12));
const tickColors = { annual: index(mix(paper, control, .64)), quarterly: index(mix(paper, control, .39)), monthly: index(mix(paper, control, .21)) };
const inkIndex = index(ink), linkIndex = index(link), ruleIndex = index(rule), mutedIndex = index(muted);
const controlIndex = index(control), cyanIndex = index(cyan);
const styles = {
  observed: ['Observed models', inkIndex, 0],
  optimistic: ['Optimistic', index(green), 10],
  historical: ['Historical fit', linkIndex, 0],
  pessimistic: ['Pessimistic', index(orange), 12],
  iq: ['IQ bands', mutedIndex, 0],
  window: ['OpenAI window', cyanIndex, 5],
};
const glyphs = labelMasks.map(([x, y, w, h, advance, mask]) => [x, y, w, h, advance, atob(mask)]);
const [titleLeft, titleTop, titleWidth, titleHeight, , titleData] = titleMask;
const title = [titleLeft, titleTop, titleWidth, titleHeight, 0, atob(titleData)];

const stride = width + 1;
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value;
});

function pngChunk(type, data) {
  const chunk = new Uint8Array(data.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(encoder.encode(type), 4);
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < chunk.length - 4; i++) crc = crcTable[(crc ^ chunk[i]) & 255] ^ crc >>> 8;
  view.setUint32(chunk.length - 4, crc ^ 0xffffffff);
  return chunk;
}

async function encodePng(pixels) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 3], 8);
  const compressed = new Uint8Array(await new Response(
    new Response(pixels).body.pipeThrough(new CompressionStream('deflate')),
  ).arrayBuffer());
  const chunks = [
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk('IHDR', header),
    pngChunk('PLTE', Uint8Array.from(palette.flatMap(rgb))),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const png = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  return png;
}

function raster() {
  const pixels = new Uint8Array(stride * height);
  function rect(left, top, right, bottom, color) {
    for (let y = top; y < bottom; y++) pixels.fill(color, y * stride + 1 + left, y * stride + 1 + right);
  }
  function line(x1, y1, x2, y2, color, weight = 1, dash = 0, phase = 0) {
    const dx = x2 - x1, dy = y2 - y1;
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    const length = Math.hypot(dx, dy);
    const edge = Math.floor((weight - 1) / 2);
    for (let step = 0; step <= count; step++) {
      if (dash && (phase + length * step / count) % dash >= dash * .65) continue;
      const x = Math.round(x1 + dx * step / count) - edge;
      const y = Math.round(y1 + dy * step / count) - edge;
      rect(x, y, x + weight, y + weight, color);
    }
    return length;
  }
  function stamp(mask, x, baseline, colors) {
    const [left, top, w, h, , data] = mask;
    for (let y = 0; y < h; y++) {
      const offset = (baseline + top + y) * stride + 1 + x + left;
      for (let i = y * w, col = 0; col < w; i++, col++) {
        const alpha = data.charCodeAt(i >> 2) >> (2 * (i & 3)) & 3;
        if (alpha) pixels[offset + col] = colors[alpha];
      }
    }
  }
  const glyph = character => glyphs[character.charCodeAt(0) - 32] ?? glyphs[31];
  const measure = label => [...label].reduce((sum, character) => sum + glyph(character)[4], 0);
  function text(label, x, y, align = 'left', color = textMuted) {
    if (align !== 'left') x -= measure(label) / (align === 'center' ? 2 : 1);
    for (const character of label) {
      const mask = glyph(character);
      stamp(mask, Math.round(x), y, color);
      x += mask[4];
    }
  }
  return { pixels, rect, line, stamp, text, measure };
}

export function lossLabels(range) {
  const places = Math.max(3, Math.min(10, 2 - Math.floor(Math.log10(range.max - range.min))));
  return [range.min.toFixed(places), range.max.toFixed(places)];
}

export async function renderPreview(settings) {
  const { range, scenarios, band, end } = viewData(settings);
  const { min, max } = range;
  const [low, high] = lossLabels(range);
  const span = max - min;
  const canvas = raster();
  const { rect, line, text, measure, pixels } = canvas;
  const left = 74 + Math.round(measure(high)), right = 1128, top = 157, bottom = 486;
  const plotWidth = right - left;
  const x = month => left + model.timePosition(month, end, settings.base) * plotWidth;
  const y = value => Math.round(bottom - (bottom - top) * ((value - min) / span));
  const clip = value => model.clamp(value, min, max);

  canvas.stamp(title, 70, 83, textInk);
  text(model.formatMonth(0) + ' - ' + model.formatMonth(end) + '  /  Log-perplexity ' + low + ' - ' + high, 72, 117);

  if (settings.series.iq) {
    for (const [i, item] of band.bands.entries()) rect(left, y(clip(item.upper)), right, y(clip(item.lower)), bands[i]);
  }
  if (settings.series.window) {
    const from = y(clip(model.reference.upper));
    const to = y(clip(model.reference.lower));
    for (let row = from; row < to; row++) {
      const start = row * stride + 1 + left;
      for (let i = start; i < start + plotWidth; i++) pixels[i] = windowColors[pixels[i]];
    }
  }
  for (let month = 1; month <= end; month++) {
    const mark = model.calendarMark(month, settings.marks);
    if (!mark) continue;
    const column = Math.round(x(month));
    rect(column, top, column + 1, bottom, tickColors[mark]);
  }
  for (let i = 0; i <= 5; i++) {
    const level = min + span * i / 5;
    const row = y(level);
    rect(left, row, right, row + 1, ruleIndex);
    text(level.toFixed(high.length - high.indexOf('.') - 1), left - 11, row + 6, 'right');
  }
  for (const [visible, levels, color] of [
    [settings.series.window, [model.reference.lower, model.reference.upper], cyanIndex],
    [settings.series.iq, [band.lower, band.median, band.upper], mutedIndex],
  ]) {
    if (!visible) continue;
    for (const level of levels) {
      if (level < min || level > max) continue;
      line(left, y(level), right, y(level), color, level === band.median ? 2 : 1, level === band.median ? 0 : 7);
    }
  }

  function trace(points, color, dash) {
    let phase = 0;
    for (let i = 1; i < points.length; i++) {
      const [fromX, fromLoss] = points[i - 1];
      const [toX, toLoss] = points[i];
      if ((fromLoss < min && toLoss < min) || (fromLoss > max && toLoss > max)) continue;
      const clippedX = value => fromX + (toX - fromX) * ((clip(value) - fromLoss) / (toLoss - fromLoss));
      const from = fromLoss === clip(fromLoss) ? fromX : clippedX(fromLoss);
      const to = toLoss === clip(toLoss) ? toX : clippedX(toLoss);
      phase += line(from, y(clip(fromLoss)), to, y(clip(toLoss)), color, 3, dash, phase);
    }
  }
  function marker(month, value, color, internal = false) {
    if (value < min || value > max) return;
    const column = Math.round(x(month)), row = y(value);
    rect(column - 4, row - 4, column + 4, row + 4, color);
    if (internal) rect(column - 2, row - 2, column + 2, row + 2, background);
  }
  if (settings.series.observed) {
    trace(model.released.map(point => [x(point.month), point.loss]), inkIndex, 0);
    for (const point of model.measurements) marker(point.month, point.loss, inkIndex, point.internal);
  }
  if (settings.future > 0) {
    const first = model.timePosition(model.latest.month, end, settings.base);
    for (const scenario of scenarios) {
      if (!settings.series[scenario.id]) continue;
      const [, color, dash] = styles[scenario.id];
      const points = Array.from({ length: 361 }, (_, index) => {
        const position = first + (1 - first) * index / 360;
        const month = Math.max(model.latest.month, model.timeMonth(position, end, settings.base));
        return [left + position * plotWidth, model.project(scenario, month - model.latest.month)];
      });
      trace(points, color, dash);
      if (settings.series.iq) {
        for (const level of [band.lower, band.median, band.upper]) {
          const crossing = model.crossing(scenario, level, settings.future);
          if (crossing.exact > model.latest.month) marker(crossing.exact, level, color, true);
        }
      }
    }
  }
  if (settings.cursor !== null) line(x(settings.cursor), top, x(settings.cursor), bottom, inkIndex, 1, 6);
  line(left, top, left, bottom, controlIndex);
  line(left, bottom, right, bottom, controlIndex);

  let previousX = -100;
  for (let tick = 0; tick <= 6; tick++) {
    const month = Math.round(model.timeMonth(tick / 6, end, settings.base));
    const column = x(month);
    if (tick && (column - previousX < 90 || (tick < 6 && right - column < 90))) continue;
    text(model.formatMonth(month).replace(/\b\d{2}(\d{2})$/, "'$1"), column, bottom + 26, 'center');
    previousX = column;
  }

  let legendX = 72;
  for (const [key, [name, color, dash]] of Object.entries(styles)) {
    if (!settings.series[key]) continue;
    line(legendX, 556, legendX + 24, 556, color, 3, dash);
    text(name, legendX + 32, 562);
    legendX += 53 + measure(name);
  }
  text('Tools.Tedt.org', 72, 597, 'left', textInk);
  if (settings.series.iq) text('Illustrative IQ anchors', 1128, 597, 'right');
  return encodePng(pixels);
}
