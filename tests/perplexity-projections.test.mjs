import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  projectionModel as model, defaultView, encodeView, readView, sharePath, shareViewUrl, viewData,
} from '../tool-src/tools/perplexity-projections/model.mjs';
const scenarios = model.scenarios(.20, .70);

test('measurements and fitted scenarios reproduce the workbook checkpoints', () => {
  assert.equal(model.measurements.length, 14);
  assert.equal(model.released.length, 13);
  assert.equal(model.formatMonth(0), 'Mar 2022');
  assert.equal(model.latest.loss, .761);
  assert.equal(model.measurements.at(-1).loss, .732);
  assert.deepEqual(scenarios.map(scenario => scenario.points.length), [6, 13, 8]);
  assert.deepEqual(scenarios.map(scenario => model.project(scenario, 360).toFixed(3)), ['0.201', '0.227', '0.703']);
  assert.deepEqual(scenarios.map(scenario => (1 - Math.exp(scenario.slope)).toFixed(5)), ['0.19970', '0.03951', '0.09129']);
  assert.equal(model.sensitivityPast.toFixed(3), '0.869');
});

test('eight bands preserve IQ order and reproduce the three workbook crossing rows', () => {
  const band = model.iq(.70, .68);
  assert.equal(band.bands.length, 8);
  assert.equal(band.bands[0].iqLow, 40);
  assert.equal(band.bands.at(-1).iqHigh, 160);
  const thresholds = [band.lower, band.median, band.upper];
  assert.deepEqual(thresholds.map(value => value.toFixed(3)), ['0.650', '0.690', '0.730']);
  const crossingDates = months => scenarios.map(scenario => thresholds.map(value => {
    const finding = model.crossing(scenario, value, months);
    return finding.label ?? model.formatMonth(finding.offset);
  }));
  assert.deepEqual(crossingDates(360), [
    ['Nov 2027', 'Jul 2027', 'Mar 2027'],
    ['Oct 2030', 'May 2029', 'Dec 2027'],
    ['No crossing', 'No crossing', 'Apr 2034'],
  ]);
  assert.equal(crossingDates(60)[2][2], 'Outside view');
  const exactMonth = model.project(scenarios[0], 6);
  assert.equal(model.crossing(scenarios[0], exactMonth, 6).offset, model.latest.month + 6);
  assert.equal(model.crossing(scenarios[0], exactMonth, 5).label, 'Outside view');
});

test('positive and inverse log bases preserve calendar marks and the horizon', () => {
  const end = model.latest.month + model.maxFuture;
  for (const base of [.001, .5, 1, model.defaults.base, 160]) {
    for (const offset of [0, 1, 10, 56, 60, 300, end]) {
      const position = model.timePosition(offset, end, base);
      assert.ok(Math.abs(model.timeMonth(position, end, base) - offset) < 1e-8);
    }
  }
  const marks = { annual: true, quarterly: true, monthly: true };
  const counts = { annual: 0, quarterly: 0, monthly: 0 };
  for (let month = 1; month <= end; month++) counts[model.calendarMark(month, marks)]++;
  assert.deepEqual(counts, { annual: 34, quarterly: 105, monthly: 277 });
  assert.equal(model.calendarMark(10, { ...marks, annual: false }), 'quarterly');
  assert.equal(model.calendarMark(10, { ...marks, annual: false, quarterly: false }), 'monthly');
  assert.equal(model.calendarMark(10, { annual: false, quarterly: false, monthly: false }), null);
});

test('auto min follows the optimistic cutoff and the viewport has a 1.00 ceiling', () => {
  const automatic = model.autoMin(scenarios[0], 360);
  assert.ok(Math.abs(automatic - .20070247099803865) < 1e-10);
  assert.equal(model.autoMin(scenarios[0], 60).toFixed(3), '0.384');
  assert.deepEqual(model.viewRange(automatic, .64, .75), { min: .64, max: .75 });
  assert.deepEqual(model.viewRange(automatic, 0, 1.02), { min: automatic, max: 1 });
  assert.deepEqual(model.viewRange(.761, .64, .75), { min: .761, max: 1 });
  assert.deepEqual(model.human[0].span, [85, 256]);
});

test('shared URLs round-trip the chart settings', () => {
  const settings = {
    ...defaultView, future: 60, base: .5, minimum: .64, maximum: .77, lowerIq: .72, higherIq: .67,
    optimisticFloor: .23, pessimisticFloor: .68, cursor: 72,
    series: { ...defaultView.series, historical: false, window: true },
    marks: { annual: false, quarterly: true, monthly: true },
  };
  const url = new URL(shareViewUrl(settings));
  assert.equal(url.origin, 'https://tools.tedt.org');
  assert.equal(url.pathname, sharePath);
  assert.deepEqual(readView(url.searchParams.get('view')), settings);
  assert.deepEqual(readView(encodeView(defaultView)), defaultView);
  assert.deepEqual(viewData(settings).range, { min: .64, max: .77 });
});

test('malformed and out-of-range share settings are rejected', () => {
  assert.equal(readView('<script>alert(1)</script>'), null);
  for (const overrides of [
    { future: 361 }, { base: 0 }, { future: 0, minimum: .1 }, { maximum: 1.1 },
    { lowerIq: .67, higherIq: .72 }, { optimisticFloor: .9 }, { cursor: 500 },
  ]) assert.equal(readView(encodeView({ ...defaultView, ...overrides })), null, JSON.stringify(overrides));
});
