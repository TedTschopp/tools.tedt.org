export const projectionModel = (() => {
  const firstMonth = 2022 * 12 + 2;
  const maxFuture = 360;
  const ceiling = 1;
  const reference = { lower: .68, upper: .70 };
  const iqMean = 100;
  const iqSd = 15;
  const measurements = [
    ["GPT-3.5", 2022, 3, .986, "Fluent conversation"],
    ["GPT-4", 2023, 3, .913, "Benefits from thinking before answering"],
    ["GPT-4 Turbo", 2023, 11, .909],
    ["GPT-4o / o1", 2024, 5, .904],
    ["GPT-4.5", 2025, 2, .876],
    ["GPT-4.1 / o3", 2025, 4, .902],
    ["GPT-5 / 5.1", 2025, 8, .893],
    ["GPT-5.2", 2025, 12, .888],
    ["GPT-5.3-Codex / 5.4", 2026, 2, .871, "Useful coder"],
    ["GPT-5.5", 2026, 4, .848],
    ["GPT-5.6 Sol", 2026, 7, .828, "Cybersecurity expert"],
    ["GPT-6 Astra", 2026, 9, .783],
    ["GPT-6.2 Astra", 2026, 11, .761, "Solved a Millennium Prize math problem"],
    ["Internal model", 2026, 11, .732],
  ].map(([name, year, month, loss, note]) => ({
    name, month: year * 12 + month - 1 - firstMonth, loss, note, internal: name === "Internal model",
  }));
  const released = measurements.filter(point => !point.internal);
  const latest = released.at(-1);
  const defaults = {
    future: maxFuture, base: 1 + (latest.month + maxFuture) / 12,
    lowerIq: reference.upper, higherIq: reference.lower,
    optimisticFloor: .2, pessimisticFloor: .7,
    series: { observed: true, optimistic: true, historical: true, pessimistic: true, iq: true, window: false },
    marks: { annual: true, quarterly: false, monthly: false },
  };
  const human = [
    { name: "Human (pooled)", label: "Human (pooled)", point: 148, span: [85, 256] },
    { name: "GPT-2 Small (rounded)", label: "GPT-2 rounded", point: 46, span: [34, 61] },
    { name: "GPT-2 Small (reference)", label: "GPT-2 reference", point: 24, span: null },
  ];
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const shortFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  const monthDate = offset => {
    const month = firstMonth + Math.round(offset);
    return new Date(Date.UTC(Math.floor(month / 12), month % 12, 1));
  };
  const formatMonth = (offset, short = false) => (short ? shortFormat : dateFormat).format(monthDate(offset));
  const isoMonth = offset => monthDate(offset).toISOString().slice(0, 7);
  const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));

  // Least-squares slope of log(loss − floor) against elapsed calendar years.
  function fit(points, floor) {
    const xs = points.map(point => point.month / 12);
    const ys = points.map(point => Math.log(point.loss - floor));
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const xMean = mean(xs);
    const yMean = mean(ys);
    const numerator = xs.reduce((sum, x, index) => sum + (x - xMean) * (ys[index] - yMean), 0);
    const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
    return numerator / denominator;
  }

  function scenarios(optimisticFloor, pessimisticFloor) {
    const inputs = [
      ["optimistic", "Optimistic", released.slice(7), optimisticFloor],
      ["historical", "Historical fit", released, 0],
      ["pessimistic", "Pessimistic", released.slice(0, 8), pessimisticFloor],
    ];
    return inputs.map(([id, name, points, floor]) => ({ id, name, points, floor, slope: fit(points, floor) }));
  }

  function project(scenario, months) {
    return scenario.floor + (latest.loss - scenario.floor) * Math.exp(scenario.slope * months / 12);
  }

  function crossing(scenario, threshold, future) {
    if (latest.loss <= threshold + 1e-12) return { offset: latest.month, exact: latest.month };
    if (threshold <= scenario.floor || scenario.slope >= 0) return { label: "No crossing" };
    const elapsed = 12 * Math.log((threshold - scenario.floor) / (latest.loss - scenario.floor)) / scenario.slope;
    const month = Math.ceil(elapsed - 1e-10);
    if (month > future) return { label: "Outside view" };
    return { offset: latest.month + month, exact: latest.month + elapsed };
  }

  function iq(scale85, scale115) {
    const median = (scale85 + scale115) / 2;
    const drop = (scale85 - scale115) / 2;
    const atSd = sd => median - drop * sd;
    const bands = Array.from({ length: 8 }, (_, index) => {
      const sd = index - 4;
      return {
        sd, iqLow: iqMean + sd * iqSd, iqHigh: iqMean + (sd + 1) * iqSd,
        lower: atSd(sd + 1), upper: atSd(sd),
      };
    });
    return { lower: atSd(4), median, upper: atSd(-4), bands };
  }

  function timePosition(month, end, base) {
    if (month <= 0) return 0;
    if (month >= end) return 1;
    const share = month / end;
    if (Math.abs(base - 1) < 1e-8) return share;
    return Math.log1p((base - 1) * share) / Math.log(base);
  }

  function timeMonth(position, end, base) {
    if (position <= 0) return 0;
    if (position >= 1) return end;
    if (Math.abs(base - 1) < 1e-8) return position * end;
    return end * (Math.expm1(Math.log(base) * position) / (base - 1));
  }

  function calendarMark(offset, marks) {
    const month = (firstMonth + offset) % 12;
    if (month === 0 && marks.annual) return "annual";
    if (month % 3 === 0 && marks.quarterly) return "quarterly";
    return marks.monthly ? "monthly" : null;
  }

  function autoMin(optimistic, future) {
    return Math.max(0, project(optimistic, future));
  }

  function viewRange(automatic, minimum, maximum) {
    const cap = maximum > automatic && maximum <= ceiling ? maximum : ceiling;
    const min = minimum !== null && minimum >= automatic && minimum < cap ? minimum : automatic;
    return { min, max: cap };
  }

  const pastFit = released.slice(0, 8);
  const endPastFit = pastFit.at(-1);
  const sensitivityPast = endPastFit.loss * Math.exp(fit(pastFit, 0) * (latest.month - endPastFit.month) / 12);

  return {
    maxFuture, ceiling, reference, iqMean, iqSd, measurements, released, latest, defaults, human,
    clamp, formatMonth, isoMonth, scenarios, project, crossing, iq, timePosition, timeMonth,
    calendarMark, autoMin, viewRange, sensitivityPast,
  };
})();

export const appUrl = 'https://tools.tedt.org/perplexity-projections.html';
export const sharePath = '/share/perplexity-projections/';
export const previewPath = sharePath + 'chart.png';
export const previewWidth = 1200;
export const previewHeight = 630;

const model = projectionModel;
export const defaultView = {
  ...model.defaults, minimum: null, maximum: model.ceiling, cursor: null,
};
const seriesKeys = Object.keys(defaultView.series);
const markKeys = Object.keys(defaultView.marks);
const maximumMask = keys => (1 << keys.length) - 1;

function encodeMask(keys, values) {
  return keys.reduce((mask, key, index) => mask | (values[key] ? 1 << index : 0), 0);
}

function decodeMask(keys, mask) {
  return Object.fromEntries(keys.map((key, index) => [key, Boolean(mask & (1 << index))]));
}

const inRange = (value, minimum, maximum) => Number.isFinite(value) && value >= minimum && value <= maximum;
const integerInRange = (value, minimum, maximum) => Number.isInteger(value) && inRange(value, minimum, maximum);

export function encodeView(view) {
  const settings = [
    1, view.future, view.base, view.minimum, view.maximum, view.lowerIq, view.higherIq,
    view.optimisticFloor, view.pessimisticFloor, encodeMask(seriesKeys, view.series),
    encodeMask(markKeys, view.marks), view.cursor,
  ];
  return btoa(JSON.stringify(settings)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function readView(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{12,360}$/.test(token)) return null;
  try {
    const settings = JSON.parse(atob(token.replaceAll('-', '+').replaceAll('_', '/')));
    if (!Array.isArray(settings) || settings.length !== 12 || settings[0] !== 1) return null;
    const [, future, base, minimum, maximum, lowerIq, higherIq, optimisticFloor, pessimisticFloor, series, marks, cursor] = settings;
    if (!integerInRange(future, 0, model.maxFuture) || !Number.isFinite(base) || base <= 0 ||
        !inRange(higherIq, 0, 1) || !inRange(lowerIq, 0, 1) || higherIq >= lowerIq ||
        !inRange(optimisticFloor, 0, model.latest.loss) || optimisticFloor === model.latest.loss ||
        !inRange(pessimisticFloor, 0, model.latest.loss) || pessimisticFloor === model.latest.loss ||
        !integerInRange(series, 0, maximumMask(seriesKeys)) ||
        !integerInRange(marks, 0, maximumMask(markKeys)) ||
        (cursor !== null && !integerInRange(cursor, 0, model.latest.month + future))) return null;
    const [optimistic] = model.scenarios(optimisticFloor, pessimisticFloor);
    const auto = model.autoMin(optimistic, future);
    if (!inRange(maximum, auto, model.ceiling) || maximum <= auto ||
        (minimum !== null && (!inRange(minimum, auto, maximum) || minimum >= maximum))) return null;
    return {
      future, base, minimum, maximum, lowerIq, higherIq, optimisticFloor, pessimisticFloor,
      series: decodeMask(seriesKeys, series), marks: decodeMask(markKeys, marks), cursor,
    };
  } catch {
    return null;
  }
}

export function shareViewUrl(view, path = sharePath) {
  const url = new URL(path, appUrl);
  url.searchParams.set('view', encodeView(view));
  return url.href;
}

export function viewData(view) {
  const scenarios = model.scenarios(view.optimisticFloor, view.pessimisticFloor);
  return {
    end: model.latest.month + view.future,
    scenarios,
    range: model.viewRange(model.autoMin(scenarios[0], view.future), view.minimum, view.maximum),
    band: model.iq(view.lowerIq, view.higherIq),
  };
}
