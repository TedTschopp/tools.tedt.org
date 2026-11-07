import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const html = await fs.readFile(new URL('../tool-src/tools/review-capacity-lab.html', import.meta.url), 'utf8');
const source = html.match(/<script id="review-capacity-model">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(source, context);
const {calculate, defaults, presets, validate} = context.ReviewCapacity;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('the article example creates 16 hours of demand and eight hours of daily backlog', () => {
  const r = calculate(defaults);
  assert.equal(r.demand, 960);
  assert.equal(r.capacity, 480);
  assert.equal(r.loadRatio, 2);
  assert.equal(r.state, 'growing');
  assert.equal(r.timeline[1].cases, 96);
  assert.equal(r.endCases, 960);
  assert.equal(r.maxIntake, 384);
  assert.equal(r.neededReviewers, 5);
});

test('exact capacity preserves the starting backlog instead of declaring it safe', () => {
  const r = calculate(presets.exact);
  assert.equal(r.state, 'no-slack');
  assert.equal(r.loadRatio, 1);
  assert.ok(r.timeline.every(day => day.cases === 24));
  assert.equal(r.maxIntake, 768);
  assert.equal(r.neededReviewers, 3);
});

test('arithmetic headroom clears the worked backlog on day one', () => {
  const r = calculate(presets.headroom);
  close(r.loadRatio, 2 / 3);
  assert.equal(r.startingWork, 240);
  assert.equal(r.timeline[1].completed, 1200);
  assert.equal(r.timeline[1].backlog, 0);
  assert.equal(r.state, 'headroom');
});

test('one additional review pass can overload the exact-capacity example', () => {
  const r = calculate(presets.rework);
  assert.equal(r.effectiveMinutes, 6);
  close(r.demand / 60, 19.2);
  close(r.loadRatio, 1.2);
  close(r.timeline[1].cases, 32);
  close(r.endCases, 320);
});

test('zero review fraction excludes a new-intake limit while retaining queued work', () => {
  const r = calculate({...defaults, reviewPercent: 0, backlog: 100});
  assert.equal(r.demand, 0);
  assert.equal(r.maxIntake, null);
  assert.equal(r.neededReviewers, 0);
  assert.equal(r.clearReviewers, 1);
  assert.equal(r.timeline[1].backlog, 20);
  assert.equal(r.timeline[2].backlog, 0);
});

test('zero capacity retains all work without Infinity or NaN results', () => {
  for (const s of [{...defaults, reviewers: 0}, {...defaults, hours: 0}]) {
    const r = calculate(s);
    assert.equal(r.state, 'unserved');
    assert.equal(r.loadRatio, null);
    assert.equal(r.maxIntake, 0);
    assert.equal(r.endBacklog, r.demand * s.days);
    assert.ok(!JSON.stringify(r).includes('NaN'));
  }
  assert.equal(calculate({...defaults, hours: 0}).neededReviewers, null);
  assert.equal(calculate({...defaults, requests: 0, reviewers: 0}).state, 'idle');
});

test('backlog-clearing staffing includes starting work and the chosen horizon', () => {
  const r = calculate({...defaults, requests: 0, backlog: 960, days: 10});
  assert.equal(r.neededReviewers, 0);
  assert.equal(r.clearReviewers, 3);
  assert.equal(r.endBacklog, 0);
});

test('invalid, missing, fractional count, and nonfinite values fail explicitly', () => {
  for (const [key, value] of [['requests', -1], ['hours', 25], ['minutes', 0], ['reviewPercent', 101], ['reReviewPercent', -1], ['reviewers', 1.5], ['days', 1.5], ['days', 31], ['targetPercent', 0], ['requests', NaN], ['requests', Infinity], ['requests', '960'], ['backlog', undefined]]) {
    const input = {...defaults, [key]: value};
    assert.ok(validate(input).includes(key));
    assert.throws(() => calculate(input), /Invalid fields/);
  }
});

test('review work is conserved and adding capacity never increases backlog', () => {
  for (let i = 0; i < 120; i++) {
    const s = {...defaults, requests: i * 37, reviewPercent: i % 101, reviewers: i % 6, hours: (i % 20) / 2, backlog: i * 3, reReviewPercent: i % 80, reReviewMinutes: i % 17, days: 1 + i % 30};
    const r = calculate(s);
    close(r.startingWork + s.days * r.demand, r.endBacklog + r.timeline.reduce((sum, d) => sum + d.completed, 0));
    assert.ok(r.timeline.every(d => d.backlog >= 0 && d.completed >= 0 && d.completed <= r.capacity));
    const more = calculate({...s, reviewers: s.reviewers + 1});
    assert.ok(more.endBacklog <= r.endBacklog + 1e-8);
  }
});
