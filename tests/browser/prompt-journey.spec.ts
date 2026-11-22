import { test, expect, type Page } from '@playwright/test';
import { routeHeaderAssets } from '../shared-header.mjs';

const node = (page: Page, name: string) => page.locator(`#diagram button[data-node="${name}"]`);
const transportControls = [
  ['back', 'Back'], ['next', 'Next step'], ['play', 'Play'],
  ['restart', 'Start'], ['jump-model', 'Model'], ['jump-return', 'Answer'],
] as const;

async function openSetup(page: Page) {
  const setup = page.locator('#setup');
  if (!(await setup.evaluate(element => (element as HTMLDetailsElement).open))) {
    await setup.locator('summary').click();
  }
}

async function pauseJourneyClock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-21T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-21T12:00:01Z'));
  await page.reload();
}

async function followState(page: Page, target?: string) {
  return page.evaluate(target => {
    const pane = document.querySelector('.map-scroll') as HTMLElement;
    const current = document.querySelector(target ? `#diagram [data-node="${target}"]` : '#diagram .node.current') as HTMLElement;
    const playback = document.querySelector('.playback-panel') as HTMLElement;
    const paneBounds = pane.getBoundingClientRect();
    const nodeBounds = current.getBoundingClientRect();
    const playbackBounds = playback.getBoundingClientRect();
    const playbackSharesMapColumn = playbackBounds.left < paneBounds.right && playbackBounds.right > paneBounds.left;
    return {
      current: current.dataset.node,
      node: { top: nodeBounds.top, right: nodeBounds.right, bottom: nodeBounds.bottom, left: nodeBounds.left },
      visible: {
        top: Math.max(0, paneBounds.top + pane.clientTop, playbackSharesMapColumn ? playbackBounds.bottom : 0),
        left: Math.max(0, paneBounds.left + pane.clientLeft),
        right: Math.min(innerWidth, paneBounds.left + pane.clientLeft + pane.clientWidth),
        bottom: Math.min(innerHeight, paneBounds.top + pane.clientTop + pane.clientHeight),
      },
      paneTop: pane.scrollTop,
      paneLeft: pane.scrollLeft,
      routeScrollTop: scrollY,
      pageX: scrollX,
      pageY: scrollY,
      playbackTop: playbackBounds.top,
      playbackBottom: playbackBounds.bottom,
      viewportHeight: innerHeight,
    };
  }, target);
}

async function scrollToEndOfMap(page: Page) {
  await page.locator('.map-scroll').evaluate(pane => {
    const bottom = scrollY + pane.getBoundingClientRect().bottom;
    window.scrollTo({ top: bottom - innerHeight + 16, behavior: 'instant' });
  });
}

async function expectCurrentStopVisible(page: Page, target?: string) {
  const state = await followState(page, target);
  expect(state.node.top, `${state.current} top must be inside the visible map`).toBeGreaterThanOrEqual(state.visible.top - 1);
  expect(state.node.left, `${state.current} left must be inside the visible map`).toBeGreaterThanOrEqual(state.visible.left - 1);
  expect(state.node.right, `${state.current} right must be inside the visible map`).toBeLessThanOrEqual(state.visible.right + 1);
  expect(state.node.bottom, `${state.current} bottom must be inside the visible map`).toBeLessThanOrEqual(state.visible.bottom + 1);
  expect(state.playbackTop, 'playback controls remain on screen').toBeGreaterThanOrEqual(-1);
  expect(state.playbackBottom, 'playback controls remain on screen').toBeLessThanOrEqual(state.viewportHeight + 1);
  return state;
}

async function finishJourney(page: Page) {
  let advances = 0;
  while (await page.locator('#next').isEnabled()) {
    expect(advances, 'the journey must have a reachable end').toBeLessThan(50);
    await page.locator('#next').click();
    advances += 1;
  }
  expect(advances, 'the example includes a request and a return journey').toBeGreaterThan(2);
}

async function downloadJourney(page: Page) {
  const downloaded = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('prompt-journey.json');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test.beforeEach(async ({ page }) => {
  await routeHeaderAssets(page);
  await page.goto('/prompt-journey.html');
});

for (const viewport of [{ width: 1200, height: 800 }, { width: 390, height: 844 }]) {
  test(`the first step and labeled controls are available on arrival at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.locator('#setup')).toHaveJSProperty('open', false);
    await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#step-title')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#payload')).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(page.locator('#step-route')).toHaveText('From Your device to Network connection');
    await expect(page.locator('#step-title')).toBeInViewport({ ratio: 1 });
  });
}

test('key steps and the ordered list lead to the corresponding explanation', async ({ page }) => {
  await expect(page.locator('#jump-later')).toBeHidden();
  await page.locator('#jump-model').click();
  await expect(page.locator('#step-title')).toHaveText('The model receives the context');
  await expect(node(page, 'model')).toHaveAttribute('aria-current', 'step');
  await page.locator('#jump-return').click();
  await expect(page.locator('#step-title')).toHaveText('The answer reaches you');
  await expect(page.locator('#payload')).toContainText('the limit is $200');
  await page.locator('#open-steps').click();
  await expect(page.locator('#journey-list button[aria-current="step"]')).toBeFocused();
  await page.locator('#journey-list').getByRole('button', { name: /Search the company documents/ }).click();
  await expect(page.locator('#step-title')).toBeFocused();
  await expect(page.locator('#step-title')).toHaveText('Search the company documents');
  await expect(node(page, 'retrieval')).toHaveAttribute('aria-current', 'step');

  await openSetup(page);
  await page.getByLabel('Sample story').selectOption('factory');
  await page.locator('#view-journey').click();
  await expect(page.locator('#setup')).toHaveJSProperty('open', false);
  await expect(page.locator('#next')).toBeFocused();
  await page.locator('#jump-later').click();
  await expect(page.locator('#step-title')).toContainText('Three days later');
  await expect(page.locator('#payload')).toContainText('Responsible person or organization: unknown');
});

test('the fictional example explains its limits and supports reversible navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Prompt Journey', exact: true })).toBeVisible();
  await expect(page.locator('#scenario')).toHaveValue('enterprise');
  await expect(page.locator('body')).toContainText('Fictional walkthrough');
  await expect(page.locator('body')).toContainText(/fictional|sample/i);
  await expect(page.locator('#back')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const firstTitle = await page.locator('#step-title').innerText();
  const firstCount = await page.locator('#step-count').innerText();
  await expect(page.locator('#step-text')).not.toBeEmpty();
  await page.locator('#next').click();
  await expect(page.locator('#step-count')).not.toHaveText(firstCount);
  await expect(page.locator('#step-title')).not.toHaveText(firstTitle);
  await page.locator('#back').click();
  await expect(page.locator('#step-count')).toHaveText(firstCount);
  await expect(page.locator('#step-title')).toHaveText(firstTitle);
  await page.locator('#next').click();
  await page.locator('#next').click();
  await page.locator('#restart').click();
  await expect(page.locator('#step-count')).toHaveText(firstCount);
  await expect(page.locator('#back')).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const scenario of ['enterprise', 'direct', 'local']) {
  test(`${scenario} follows the answer all the way back to the reader`, async ({ page }) => {
    await openSetup(page);
    await page.locator('#scenario').selectOption(scenario);
    if (scenario !== 'enterprise') {
      for (const control of ['retrieval', 'tools', 'routing']) {
        await expect(page.locator(`#${control}`)).toBeDisabled();
      }
    }
    await finishJourney(page);
    await expect(page.locator('#step-title')).toHaveText('The answer reaches you');
    await expect(page.locator('#step-text')).toContainText('The round trip is complete');
    await expect(page.locator('#payload')).not.toBeEmpty();
    await expect(page.locator('#next')).toBeDisabled();
    await page.locator('#restart').click();
    await expect(page.locator('#back')).toBeDisabled();
    await page.locator('#jump-return').click();
    await expect(page.locator('#back')).toBeEnabled();
    await expect(page.locator('#step-title')).toContainText(/answer|response|return|check|stream/i);
  });
}

test('optional company connections change the diagram and ordered journey', async ({ page }) => {
  await openSetup(page);
  for (const [control, participant] of [['retrieval', 'retrieval'], ['tools', 'tool'], ['routing', 'router']]) {
    await page.locator(`#${control}`).check();
    await expect(node(page, participant)).toBeVisible();
    const withConnection = await page.locator('#journey-list li').count();
    await page.locator(`#${control}`).uncheck();
    await expect(node(page, participant)).toBeHidden();
    expect(await page.locator('#journey-list li').count()).toBeLessThan(withConnection);
    await expect(page.locator('#back')).toBeDisabled();
    await page.locator(`#${control}`).check();
    await expect(node(page, participant)).toBeVisible();
  }
});

for (const viewport of [{ width: 320, height: 480 }, { width: 1200, height: 900 }]) {
  test(`saved copies start visible and toggle from the diagram at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const copies = page.locator('#route-legend').getByRole('checkbox', { name: 'Possible saved copies', exact: true });
    const paths = page.locator('#copy-edges path');
    await expect(copies).toBeChecked();
    const pathCount = await paths.count();
    expect(pathCount).toBeGreaterThan(0);
    const labelBounds = await copies.locator('..').boundingBox();
    expect(labelBounds!.height).toBeGreaterThanOrEqual(44);
    await page.locator('#next').click();
    const stepBefore = await page.locator('#step-count').textContent();
    const journeyBefore = await page.locator('#journey-list').textContent();
    if (viewport.width === 320) {
      await page.getByRole('link', { name: 'Diagram', exact: true }).click();
      await expect(copies).toBeInViewport({ ratio: 1 });
      expect(await copies.evaluate(input => {
        const bounds = input.getBoundingClientRect();
        return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) === input;
      })).toBe(true);
    }

    await copies.press('Space');
    await expect(copies).not.toBeChecked();
    await expect(copies).toBeFocused();
    await expect(paths).toHaveCount(0);
    for (const participant of ['history', 'logs', 'training']) {
      await expect(node(page, participant)).toBeHidden();
    }
    await expect(node(page, 'network')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('#step-count')).toHaveText(stepBefore!);

    await copies.check();
    await expect(paths).toHaveCount(pathCount);
    for (const participant of ['history', 'logs', 'training']) {
      await expect(node(page, participant)).toBeVisible();
    }
    await expect(node(page, 'network')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('#step-count')).toHaveText(stepBefore!);
    await expect(page.locator('#journey-list')).toHaveText(journeyBefore!);
    await expect(page.locator('#setup')).toHaveJSProperty('open', false);
    await node(page, 'training').click();
    await expect(page.locator('#detail-body')).toContainText(/train|policy|setting|contract/i);
  });
}

test('possible copy paths include each recipient and disappear with removed connections', async ({ page }) => {
  await openSetup(page);
  await page.locator('#fallback').check();
  const copyPath = (from: string) => page.locator(`#copy-edges [data-copy-from="${from}"][data-copy-to="logs"]`);
  for (const recipient of ['edge', 'app', 'identity', 'retrieval', 'router', 'host', 'backup', 'tool', 'checks']) {
    await expect(node(page, recipient)).toBeVisible();
    await expect(page.locator(`.copy-records[data-copy-source="${recipient}"] [data-stop="logs"]`)).toBeVisible();
    await expect(copyPath(recipient)).toHaveCSS('stroke-linecap', 'round');
    await expect(copyPath(recipient)).not.toHaveCSS('stroke-dasharray', 'none');
  }
  await page.locator('#tools').uncheck();
  await expect(copyPath('tool')).toHaveCount(0);
  await page.locator('#routing').uncheck();
  await expect(copyPath('router')).toHaveCount(0);
  await expect(copyPath('backup')).toHaveCount(0);
  await expect(copyPath('host')).toHaveCount(1);
  await page.locator('#show-copies').uncheck();
  await expect(page.locator('#copy-edges path')).toHaveCount(0);
});

for (const viewport of [{ width: 320, height: 480 }, { width: 1200, height: 900 }]) {
  test(`saved-copy links join traffic stops directly without crossing other lines at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSetup(page);
    await page.locator('#fallback').check();
    await page.getByRole('button', { name: 'View journey', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);

    const svg = page.locator('#paths');
    await expect(svg.locator('#copy-edges path')).toHaveCount(11);
    const errors = await svg.evaluate(element => {
      const svg = element as SVGSVGElement;
      const near = (a: number, b: number) => Math.abs(a - b) < 1;
      const errors: string[] = [];
      const diagram = svg.closest('#diagram')!;
      const origin = svg.getBoundingClientRect();
      const traffic = [...svg.querySelectorAll<SVGGraphicsElement>('#map-edges path, #map-edges circle')];
      const trafficRight = Math.max(...traffic.map(item => {
        const box = item.getBBox();
        return box.x + box.width;
      }));
      const wires = [...svg.querySelectorAll<SVGPathElement>('#copy-edges path')];
      for (const [index, path] of wires.entries()) {
        const { copyFrom, copyTo, copySource } = path.dataset;
        const records = diagram.querySelector(`.copy-records[data-copy-source="${copySource}"]`)!;
        const stop = diagram.querySelector(`.node[data-node="${copySource}"]`)!;
        const group = stop.closest('.route-group')!;
        const frame = group.getBoundingClientRect();
        const heading = group.querySelector('h3')!.getBoundingClientRect();
        const target = records.querySelector(`[data-stop="${copyTo}"]`)!;
        const start = path.getPointAtLength(0), end = path.getPointAtLength(path.getTotalLength());
        const sourceBox = (copyTo === 'training' ? records.querySelector('[data-stop="logs"]')! : stop).getBoundingClientRect();
        const targetBox = target.getBoundingClientRect();
        const box = path.getBBox();
        if (records.closest('.route-group') !== group || box.y + origin.top < heading.bottom ||
            box.y + box.height + origin.top > frame.bottom || box.x + box.width + origin.left > frame.right) {
          errors.push(`${copySource}: ${copyFrom} → ${copyTo} leaves its traffic group`);
        }
        const sameX = near(start.x, end.x), sameY = near(start.y, end.y);
        const direct = copyTo === 'training'
          ? sameX && near(start.y + origin.top, sourceBox.bottom) && near(end.y + origin.top, targetBox.top) &&
            near(end.x + origin.left, targetBox.left + targetBox.width / 2)
          : sameY && near(start.x + origin.left, sourceBox.right) && near(end.x + origin.left, targetBox.left) &&
            near(end.y + origin.top, targetBox.top + targetBox.height / 2) &&
            start.y + origin.top > sourceBox.top && start.y + origin.top < sourceBox.bottom;
        if (!direct) errors.push(`${copySource}: ${copyFrom} → ${copyTo} misses its stop or record`);
        if (box.x - trafficRight < 4) errors.push(`${copySource}: copy line enters the traffic lane`);
        for (const other of wires.slice(0, index)) {
          const prior = other.getBBox();
          const separate = box.x > prior.x + prior.width + 2 || prior.x > box.x + box.width + 2 ||
            box.y > prior.y + prior.height + 2 || prior.y > box.y + box.height + 2;
          if (!separate) errors.push(`${copySource}: copy lines overlap`);
        }
      }
      return errors;
    });
    expect(errors).toEqual([]);
    const hostLog = page.locator('.copy-records[data-copy-source="host"] [data-stop="logs"]');
    await hostLog.click();
    await expect(page.locator('#detail-title')).toHaveText('Logs & caches');
    await page.getByRole('button', { name: 'Return to stop', exact: true }).click();
    await expect(hostLog).toBeFocused();
    await expect(hostLog).toBeInViewport({ ratio: 1 });
  });
}

test('the JSON download preserves selected routes, fictional inputs and the return path', async ({ page }) => {
  await openSetup(page);
  await page.locator('#routing').uncheck();
  await page.locator('#tools').uncheck();
  const withoutTools = await downloadJourney(page);
  expect(withoutTools).toMatchObject({
    tool: 'Prompt Journey',
    kind: 'illustrative-simulation',
    scenario: 'enterprise',
    options: { routing: false, tools: false, retrieval: true },
  });
  expect(withoutTools.sample.policy).toMatch(/fictional/i);
  expect(withoutTools.sample.forecast).toMatch(/fictional/i);
  expect(withoutTools.limits).toMatch(/not live tracing/);
  expect(withoutTools.journey).toHaveLength(await page.locator('#journey-list li').count());
  const destinations = withoutTools.journey.map((step: { to: string }) => step.to);
  expect(destinations).toContain('retrieval');
  expect(destinations).not.toContain('router');
  expect(destinations).not.toContain('tool');
  expect(withoutTools.journey.at(-1)).toMatchObject({ to: 'user', phase: 'return' });
  expect(withoutTools.journey.at(-1).payload).toContain('No forecast was looked up');

  await page.locator('#scenario').selectOption('local');
  const local = await downloadJourney(page);
  expect(local.scenario).toBe('local');
  const localDestinations = local.journey.map((step: { to: string }) => step.to);
  for (const remote of ['network', 'edge', 'host', 'router', 'retrieval', 'tool']) {
    expect(localDestinations).not.toContain(remote);
    await expect(node(page, remote)).toBeHidden();
  }
  expect(local.journey.at(-1)).toMatchObject({ to: 'user', phase: 'return' });
  expect(local.journey.at(-1).payload).toContain('hotel allowance cannot be confirmed');
});

test('fallback adds a second recipient and remains unavailable without routing', async ({ page }) => {
  await openSetup(page);
  await page.locator('#fallback').check();
  await expect(node(page, 'backup')).toBeVisible();
  const data = await downloadJourney(page);
  const firstHost = data.journey.findIndex((step: { to: string }) => step.to === 'host');
  const secondHost = data.journey.findIndex((step: { to: string }) => step.to === 'backup');
  expect(firstHost).toBeGreaterThan(-1);
  expect(secondHost).toBeGreaterThan(firstHost);
  expect(data.journey.slice(firstHost, secondHost).map((step: { text: string }) => step.text).join(' '))
    .toContain('timeout will not prove that it saw nothing');
  await page.locator('#routing').uncheck();
  await expect(page.locator('#fallback')).toBeDisabled();
  await expect(node(page, 'backup')).toBeHidden();
  const directRoute = await downloadJourney(page);
  expect(directRoute.journey.some((step: { to: string }) => step.to === 'backup')).toBe(false);
});

test('the factory example finishes the summary before a separate, unattributed later observation', async ({ page }) => {
  await openSetup(page);
  const trackingLink = 'https://canary.example/factory-test-001';
  const trackingRequests: string[] = [];
  await page.route('https://canary.example/**', route => {
    trackingRequests.push(route.request().url());
    return route.abort();
  });
  const originalLinks = await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')));
  await page.getByLabel('Sample story', { exact: true }).selectOption('factory');
  await expect(page.locator('#scenario')).toHaveValue('enterprise');
  await expect(page.locator('#routing')).toBeChecked();
  await expect(page.locator('#retrieval')).not.toBeChecked();
  await expect(page.locator('#tools')).not.toBeChecked();
  await expect(page.locator('#sample-request')).toContainText('Do not open the tracking link');
  await expect(page.locator('#sample-context')).toContainText('Pump P-17');
  await expect(page.locator('#sample-context')).toContainText('40 minutes');
  await expect(page.locator('#sample-context')).toContainText(trackingLink);
  await expect(page.locator('#sample-note')).toContainText('never opened');
  await expect(page.locator(`a[href="${trackingLink}"]`)).toHaveCount(0);

  const data = await downloadJourney(page);
  expect(data).toMatchObject({
    kind: 'illustrative-simulation', scenario: 'enterprise', options: { example: 'factory' },
    sample: { trackingLink },
  });
  expect(data.sample.report).toContain('SAMPLE DATA');
  expect(data.sample.report).toContain('Pump P-17');
  expect(data.sample.request).toContain(data.sample.report);
  const answerIndex = data.journey.findIndex((step: { to: string; phase: string }) => step.to === 'user' && step.phase === 'return');
  expect(answerIndex).toBeGreaterThan(0);
  const summary = data.journey[answerIndex];
  expect(summary.payload).toContain('40 minutes');
  expect(summary.payload).toContain('next scheduled maintenance visit');
  expect(summary.payload).not.toContain(trackingLink);
  expect(data.journey.slice(answerIndex + 1).map((step: { from: string | null; to: string; phase: string }) => ({ from: step.from, to: step.to, phase: step.phase })))
    .toEqual([
      { from: null, to: 'unknown', phase: 'later' },
      { from: 'unknown', to: 'canary', phase: 'later' },
      { from: 'canary', to: 'security', phase: 'later' },
      { from: null, to: 'security', phase: 'later' },
    ]);
  expect(data.journey[answerIndex + 1].payload).toContain('Responsible person or organization: unknown');
  expect(data.journey[answerIndex + 1].payload).toContain('How the link was obtained: unknown');
  expect(data.journey[answerIndex + 3].text).toContain('does not prove that the whole report was kept');
  expect(data.limits).toContain('not live tracing');
  await expect(page.locator('#paths path.edge.later')).toHaveCount(2);
  expect(await page.locator('#paths path.edge.later').evaluateAll(paths => paths.map(path => (path as SVGElement).dataset.key)))
    .toEqual(['unknown-canary-later', 'canary-security-later']);

  for (let step = 0; step < answerIndex; step += 1) await page.locator('#next').click();
  await expect(page.locator('#step-title')).toHaveText('The answer reaches you');
  await expect(page.locator('#phase')).toHaveAttribute('data-phase', 'return');
  await page.locator('#next').click();
  await expect(page.locator('#phase')).toHaveAttribute('data-phase', 'later');
  await expect(page.locator('#phase')).toContainText('day 3');
  await expect(page.locator('#step-title')).toContainText('Three days later');
  await finishJourney(page);
  await expect(page.locator('#step-title')).toHaveText('Investigate before assigning blame');
  expect(trackingRequests).toEqual([]);
  expect(await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(originalLinks);
});

test('switching sample stories stops playback and restores each story’s usable defaults', async ({ page }) => {
  await pauseJourneyClock(page);
  await page.locator('#show-copies').uncheck();
  await openSetup(page);
  await page.locator('#fallback').check();
  await page.locator('#play').click();
  await page.clock.runFor(4000);
  await page.locator('#example').selectOption('factory');
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
  await expect(page.locator('#progress')).toHaveJSProperty('value', 0);
  await expect(page.locator('#fallback')).not.toBeChecked();
  await expect(page.locator('#show-copies')).not.toBeChecked();
  await expect(node(page, 'unknown')).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(page.locator('#progress')).toHaveJSProperty('value', 0);

  await page.locator('#scenario').selectOption('local');
  await page.locator('#show-copies').check();
  await page.locator('#play').click();
  await page.locator('#example').selectOption('travel');
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
  await expect(page.locator('#scenario')).toHaveValue('enterprise');
  await expect(page.locator('#show-copies')).toBeChecked();
  for (const id of ['retrieval', 'tools', 'routing']) await expect(page.locator(`#${id}`)).toBeChecked();
  for (const id of ['unknown', 'canary', 'security']) await expect(node(page, id)).toBeHidden();
  await expect(page.locator('#sample-request')).toContainText('Madrid');
  await page.clock.runFor(20_000);
  await expect(page.locator('#progress')).toHaveJSProperty('value', 0);
});

test('a factory deep link supports optional maintenance tools without reading the tracking page', async ({ page }) => {
  const errors: string[] = [];
  const trackingRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://canary.example/**', route => {
    trackingRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/prompt-journey.html?example=factory');
  await expect(page.locator('#show-copies')).toBeChecked();
  await expect(page.locator('#copy-edges path')).not.toHaveCount(0);
  await openSetup(page);
  await expect(page.locator('#example')).toHaveValue('factory');
  await expect(page.locator('#scenario')).toHaveValue('enterprise');
  await expect(page.locator('#tools')).not.toBeChecked();
  await page.locator('#retrieval').check();
  await page.locator('#tools').check();
  await expect(node(page, 'tool')).toBeVisible();
  await node(page, 'tool').click();
  await expect(page.locator('#detail-body')).toContainText('Pump P-17');
  await expect(page.locator('#detail-body')).toContainText('never fetches the tracking link');
  const data = await downloadJourney(page);
  const toolCall = data.journey.find((step: { to: string }) => step.to === 'tool');
  expect(toolCall.payload).toContain('asset = Pump P-17');
  expect(toolCall.payload).not.toContain(data.sample.trackingLink);
  expect(data.journey.some((step: { to: string }) => step.to === 'retrieval')).toBe(true);
  expect(trackingRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('the local factory route does not imply that its model sent the later tracking request', async ({ page }) => {
  await openSetup(page);
  await page.locator('#example').selectOption('factory');
  await page.locator('#scenario').selectOption('local');
  const data = await downloadJourney(page);
  const inferenceStops = data.journey.filter((step: { phase: string }) => step.phase !== 'later').map((step: { to: string }) => step.to);
  for (const remote of ['network', 'edge', 'host', 'router', 'retrieval', 'tool']) expect(inferenceStops).not.toContain(remote);
  const laterStart = data.journey.find((step: { phase: string }) => step.phase === 'later');
  expect(laterStart).toMatchObject({ from: null, to: 'unknown' });
  expect(laterStart.text).toContain('separate hypothetical signal with an unexplained path');
  expect(laterStart.text).toContain('does not show that the local model sent the link');
});

test('automatic playback advances and stops when the reader pauses or restarts', async ({ page }) => {
  await page.clock.install();
  await page.reload();
  const firstCount = await page.locator('#step-count').innerText();
  await page.locator('#play').click();
  for (let tick = 0; tick < 40 && (await page.locator('#step-count').innerText()) === firstCount; tick += 1) {
    await page.clock.runFor(250);
  }
  await expect(page.locator('#step-count')).not.toHaveText(firstCount);
  await page.locator('#play').click();
  const pausedCount = await page.locator('#step-count').innerText();
  await page.clock.runFor(60_000);
  await expect(page.locator('#step-count')).toHaveText(pausedCount);
  await page.locator('#play').click();
  await page.locator('#restart').click();
  await page.clock.runFor(60_000);
  await expect(page.locator('#step-count')).toHaveText(firstCount);
  await expect(page.locator('#back')).toBeDisabled();
});

test('playback and milestone buttons have visible keyboard-accessible labels', async ({ page }) => {
  await pauseJourneyClock(page);
  for (const [id, name] of transportControls) {
    const control = page.locator(`#${id}`);
    await expect(control).toHaveAccessibleName(name);
    await expect(control).toHaveText(name);
  }
  await page.getByRole('button', { name: 'Play', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toHaveAccessibleName('Pause');
  await expect(page.locator('#play')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
});

test('autoplay respects the selected delay and restarts that interval when it changes', async ({ page }) => {
  await pauseJourneyClock(page);
  await openSetup(page);
  const progress = page.locator('#progress');
  const play = page.locator('#play');
  await expect(page.locator('#step-delay')).toHaveValue('4000');
  expect(await page.locator('#step-delay option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
    .toEqual(['2000', '4000', '6000', '10000']);
  await play.click();
  await expect(play).toHaveAccessibleName('Pause');
  await page.clock.runFor(3999);
  await expect(progress).toHaveJSProperty('value', 0);
  await page.clock.runFor(1);
  await expect(progress).toHaveJSProperty('value', 1);

  await page.clock.runFor(1000);
  await page.locator('#step-delay').selectOption('6000');
  await expect(progress).toHaveJSProperty('value', 1);
  await expect(play).toHaveAccessibleName('Pause');
  await page.clock.runFor(5999);
  await expect(progress).toHaveJSProperty('value', 1);
  await page.clock.runFor(1);
  await expect(progress).toHaveJSProperty('value', 2);

  await play.click();
  await expect(play).toHaveAccessibleName('Play');
  await page.clock.runFor(60_000);
  await expect(progress).toHaveJSProperty('value', 2);
});

test('manual navigation and setup changes stop autoplay', async ({ page }) => {
  await pauseJourneyClock(page);
  await openSetup(page);
  const play = page.locator('#play');
  for (const id of ['next', 'back', 'jump-model', 'restart', 'jump-return']) {
    await play.click();
    await page.locator(`#${id}`).click();
    await expect(play).toHaveAccessibleName('Play');
    const pausedStep = await page.locator('#step-count').innerText();
    await page.clock.runFor(20_000);
    await expect(page.locator('#step-count')).toHaveText(pausedStep);
  }
  await page.locator('#restart').click();
  await play.click();
  await page.locator('#scenario').selectOption('local');
  await expect(play).toHaveAccessibleName('Play');
  await page.clock.runFor(20_000);
  await expect(page.locator('#progress')).toHaveJSProperty('value', 0);
});

test('autoplay stops at the final answer and can resume only after leaving the end', async ({ page }) => {
  await pauseJourneyClock(page);
  await openSetup(page);
  await page.locator('#scenario').selectOption('local');
  await page.locator('#step-delay').selectOption('2000');
  const play = page.locator('#play');
  const lastStep = (await page.locator('#journey-list li').count()) - 1;
  await play.click();
  await page.clock.runFor(lastStep * 2000);
  await expect(page.locator('#step-title')).toHaveText('The answer reaches you');
  await expect(page.locator('#progress')).toHaveJSProperty('value', lastStep);
  await expect(play).toHaveAccessibleName('Play');
  await expect(play).toBeDisabled();
  await page.clock.runFor(20_000);
  await expect(page.locator('#progress')).toHaveJSProperty('value', lastStep);

  await page.locator('#back').click();
  await expect(play).toBeEnabled();
  await expect(play).toHaveAccessibleName('Play');
  await page.locator('#restart').click();
  await expect(page.locator('#progress')).toHaveJSProperty('value', 0);
  await expect(play).toBeEnabled();
});

for (const setup of [
  { name: 'desktop company assistant with fallback', scenario: 'enterprise', width: 1440, height: 1000 },
  { name: 'mobile company assistant with fallback', scenario: 'enterprise', width: 375, height: 844 },
  { name: 'short landscape company assistant with fallback', scenario: 'enterprise', width: 844, height: 390 },
  { name: 'small portrait company assistant with fallback', scenario: 'enterprise', width: 320, height: 480 },
  { name: 'desktop direct service', scenario: 'direct', width: 1440, height: 1000 },
  { name: 'mobile local model', scenario: 'local', width: 375, height: 844 },
]) {
  test(`autoplay follows the full ${setup.name} journey without moving controls or stealing focus`, async ({ page }) => {
    await page.setViewportSize({ width: setup.width, height: setup.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pauseJourneyClock(page);
    await openSetup(page);
    await page.locator('#scenario').selectOption(setup.scenario);
    if (setup.scenario === 'enterprise') await page.locator('#fallback').check();
    await page.locator('#step-delay').selectOption('2000');
    const lastStep = (await page.locator('#journey-list li').count()) - 1;
    if (setup.scenario === 'enterprise') expect(lastStep).toBeGreaterThanOrEqual(35);
    await page.locator('#play').focus();
    await page.keyboard.press('Space');
    await page.clock.runFor(32);
    const initial = await expectCurrentStopVisible(page);
    const visited = new Set([initial.current]);
    const routePositions = [initial.routeScrollTop];

    for (let step = 1; step <= lastStep; step += 1) {
      await page.clock.runFor(2000);
      await page.clock.runFor(32);
      await expect(page.locator('#progress')).toHaveJSProperty('value', step);
      const state = await expectCurrentStopVisible(page);
      visited.add(state.current);
      routePositions.push(state.routeScrollTop);
      expect(state.paneLeft, `diagram horizontal position at step ${step}`).toBe(0);
      expect(Math.abs(state.pageX - initial.pageX), `page x at step ${step}`).toBeLessThanOrEqual(1);
      expect(state.paneTop).toBe(0);
      expect(Math.abs(state.playbackTop - initial.playbackTop), `control position at step ${step}`).toBeLessThanOrEqual(1);
      if (step < lastStep) await expect(page.locator('#play')).toBeFocused();
    }

    expect(Math.max(...routePositions) - Math.min(...routePositions), 'the route must follow steps vertically').toBeGreaterThan(100);
    if (setup.scenario === 'enterprise') {
      for (const stop of ['retrieval', 'router', 'host', 'backup', 'tool', 'checks', 'model']) {
        expect(visited, `the full walkthrough includes ${stop}`).toContain(stop);
      }
    }
    expect((await followState(page)).current).toBe('user');
    await expect(page.locator('#step-title')).toHaveText('The answer reaches you');
    await expect(page.locator('#play')).toHaveAccessibleName('Play');
  });
}

for (const viewport of [{ width: 375, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 480 }]) {
  test(`the extended factory journey follows every stop at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pauseJourneyClock(page);
    await openSetup(page);
    await page.locator('#example').selectOption('factory');
    await page.locator('#step-delay').selectOption('2000');
    const lastStep = (await page.locator('#journey-list li').count()) - 1;
    await page.locator('#play').focus();
    await page.keyboard.press('Space');
    await page.clock.runFor(32);
    const initial = await expectCurrentStopVisible(page);
    const visited: string[] = [initial.current!];

    for (let step = 1; step <= lastStep; step += 1) {
      await page.clock.runFor(2032);
      await expect(page.locator('#progress')).toHaveJSProperty('value', step);
      const state = await expectCurrentStopVisible(page);
      visited.push(state.current!);
      expect(state.paneTop, `inner scroll position at step ${step}`).toBe(0);
      expect(Math.abs(state.pageX - initial.pageX), `page horizontal position at step ${step}`).toBeLessThanOrEqual(1);
      expect(Math.abs(state.playbackTop - initial.playbackTop), `controls at step ${step}`).toBeLessThanOrEqual(1);
      if (step < lastStep) await expect(page.locator('#play')).toBeFocused();
    }

    expect(visited.slice(-5)).toEqual(['user', 'unknown', 'canary', 'security', 'security']);
    await expect(page.locator('#step-title')).toHaveText('Investigate before assigning blame');
    await page.getByRole('link', { name: 'Read step' }).click();
    await expect(page.locator('#step-title')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#step-title')).toBeFocused();
    await expect(page.locator('#play')).toHaveAccessibleName('Play');
    await expect(page.locator('#play')).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced-motion following is immediate and a paused map stays where the reader scrolls it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await pauseJourneyClock(page);
  await openSetup(page);
  await page.locator('#step-delay').selectOption('2000');
  await scrollToEndOfMap(page);
  await page.locator('#play').click();
  await page.clock.runFor(32);
  await expectCurrentStopVisible(page);
  await page.clock.runFor(4032);
  await expectCurrentStopVisible(page);
  await page.locator('#play').click();
  await scrollToEndOfMap(page);
  const paused = await followState(page);
  const pausedStep = await page.locator('#step-count').innerText();
  await page.clock.runFor(20_000);
  const afterPause = await followState(page);
  expect(afterPause.routeScrollTop).toBe(paused.routeScrollTop);
  expect(afterPause.paneLeft).toBe(paused.paneLeft);
  await expect(page.locator('#step-count')).toHaveText(pausedStep);

  await page.locator('#play').click();
  await page.clock.runFor(32);
  await expectCurrentStopVisible(page);
  await expect(page.locator('#step-count')).toHaveText(pausedStep);
  await page.clock.runFor(2000);
  await expectCurrentStopVisible(page);
  await expect(page.locator('#step-count')).not.toHaveText(pausedStep);
});

test('normal-motion playback smoothly reaches a distant node and pause freezes the map', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const journey = page.locator('#journey-list');
  await journey.locator('xpath=ancestor::details[1]').locator('summary').click();
  await journey.getByRole('button').filter({ hasText: 'The app calls an allowed tool' }).click();
  await openSetup(page);
  await page.locator('#step-delay').selectOption('2000');
  await page.locator('#play').focus();
  await page.keyboard.press('Space');
  const start = await expectCurrentStopVisible(page);
  expect(start.current).toBe('tool');
  const firstStep = await page.locator('#step-count').innerText();
  await expect(page.locator('#step-count')).not.toHaveText(firstStep, { timeout: 3500 });
  await expect.poll(async () => {
    const state = await followState(page);
    return state.current === 'app' &&
      state.node.top >= state.visible.top - 1 && state.node.bottom <= state.visible.bottom + 1 &&
      state.node.left >= state.visible.left - 1 && state.node.right <= state.visible.right + 1;
  }, { timeout: 1500, intervals: [50, 100, 150] }).toBe(true);
  const afterPan = await expectCurrentStopVisible(page);
  expect(Math.abs(afterPan.routeScrollTop - start.routeScrollTop)).toBeGreaterThan(100);
  expect(afterPan.paneLeft).toBe(0);
  expect(afterPan.paneTop).toBe(0);
  expect(Math.abs(afterPan.playbackTop - start.playbackTop)).toBeLessThanOrEqual(1);
  await expect(page.locator('#play')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
  const paused = await followState(page);
  const pausedStep = await page.locator('#step-count').innerText();
  await page.waitForTimeout(2200);
  const later = await followState(page);
  expect(later.routeScrollTop).toBe(paused.routeScrollTop);
  expect(later.paneLeft).toBe(paused.paneLeft);
  await expect(page.locator('#step-count')).toHaveText(pausedStep);
  await expect(page.locator('#play')).toBeFocused();
});

for (const viewport of [{ width: 844, height: 390 }, { width: 320, height: 480 }]) {
  test(`returning from the inspector keeps the selected node clear of controls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const stepBeforeInspection = await page.locator('#step-count').innerText();
    await node(page, 'training').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#detail-title')).toBeFocused();
    await page.locator('#back-map').click();
    await expect(node(page, 'training')).toBeFocused();
    await expectCurrentStopVisible(page, 'training');
    await expect(page.locator('#step-count')).toHaveText(stepBeforeInspection);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('diagram explanations work by keyboard on a narrow screen without document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const stepBeforeInspection = await page.locator('#step-count').innerText();
  await node(page, 'user').click();
  const initialDetail = await page.locator('#detail-title').innerText();
  await node(page, 'model').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-title')).not.toHaveText(initialDetail);
  await expect(page.locator('#detail-body')).not.toBeEmpty();
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page.locator('#detail-title')).toBeInViewport();
  await expect(page.locator('#step-count')).toHaveText(stepBeforeInspection);
  await expect(page.locator('#back-map')).toBeVisible();
  await page.locator('#back-map').click();
  await expect(node(page, 'model')).toBeFocused();
  await expect(node(page, 'model')).toBeInViewport();
  await expectCurrentStopVisible(page, 'model');
  await page.locator('#next').click();
  await expect(page.locator('#back-map')).toBeHidden();
  await expect(page.locator('#back')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const journey = page.locator('#journey-list');
  const listDetails = journey.locator('xpath=ancestor::details[1]');
  if (!(await listDetails.evaluate(element => (element as HTMLDetailsElement).open))) {
    await listDetails.locator('summary').click();
  }
  await expect(journey).toBeVisible();
  expect(await journey.locator('li').count()).toBeGreaterThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [320, 375, 600, 1035, 1440]) {
  test(`the whole diagram width fits at ${width}px, including optional stops`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    for (const [id] of transportControls) {
      const bounds = await page.locator(`#${id}`).boundingBox();
      expect(bounds, `${id} should be rendered`).not.toBeNull();
      expect(bounds!.width, `${id} needs a 44px-wide touch target`).toBeGreaterThanOrEqual(44);
      expect(bounds!.height, `${id} needs a 44px-high touch target`).toBeGreaterThanOrEqual(44);
    }
    await openSetup(page);
    await page.locator('#fallback').check();
    await expect(node(page, 'training').locator('b')).toHaveText('Later evaluation / training');
    await page.evaluate(() => document.fonts.ready);

    const clippedText = await page.locator('#diagram button[data-stop]').evaluateAll(elements => {
      const clipped: { node: string | undefined; text: string | null }[] = [];
      const pane = document.querySelector('.map-scroll') as HTMLElement;
      const paneLeft = pane.getBoundingClientRect().left + pane.clientLeft;
      const paneRight = paneLeft + pane.clientWidth;
      for (const element of elements) {
        const card = element.getBoundingClientRect();
        if (card.left < paneLeft || card.right > paneRight) {
          clipped.push({ node: (element as HTMLElement).dataset.node, text: 'Card is outside the diagram pane' });
        }
        const group = element.closest('.route-group')!;
        const frame = group.getBoundingClientRect();
        const heading = group.querySelector('h3')!.getBoundingClientRect();
        if (card.left < frame.left || card.right > frame.right || card.top < heading.bottom || card.bottom > frame.bottom) {
          clipped.push({ node: (element as HTMLElement).dataset.node, text: 'Card overlaps the group heading or leaves its frame' });
        }
        for (const label of element.querySelectorAll('b, span, small')) {
          const range = document.createRange();
          range.selectNodeContents(label);
          const fits = [...range.getClientRects()].every(rect =>
            rect.left >= card.left + 1 && rect.right <= card.right - 1 &&
            rect.top >= card.top + 1 && rect.bottom <= card.bottom - 1);
          if (!fits) clipped.push({ node: (element as HTMLElement).dataset.node, text: label.textContent });
        }
      }
      return clipped;
    });
    expect(clippedText, 'cards must fit the pane and their text must fit the cards').toEqual([]);
    expect(await page.locator('.map-scroll').evaluate(element => element.scrollWidth === element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await node(page, 'training').click();
    await expect(page.locator('#detail-title')).toBeFocused();
    await expect(page.locator('#detail-title')).toBeInViewport();
    await page.locator('#back-map').click();
    await expect(node(page, 'training')).toBeFocused();
    await expect(node(page, 'training')).toBeInViewport();
    await expectCurrentStopVisible(page, 'training');
  });
}

test('the operator note precedes the diagram in both layouts', async ({ page }) => {
  await page.locator('#show-copies').uncheck();
  await page.locator('#jump-model').click();
  for (const width of [1200, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const diagram = page.locator('#diagram');
    const caption = page.locator('#map-context');
    const map = page.getByRole('region', { name: 'Route stops', exact: true });
    await expect(diagram).toHaveAttribute('data-layout', width===1200?'columns':'stacked');
    await expect(caption).toHaveText('Stops can have different operators.');
    await expect(map).toHaveAccessibleDescription(/Stops can have different operators/);
    const captionBounds = await caption.boundingBox();
    const mapBounds = await map.boundingBox();
    expect(captionBounds!.y + captionBounds!.height).toBeLessThan(mapBounds!.y);
    await scrollToEndOfMap(page);
    const nextCaption = await caption.boundingBox();
    const nextMap = await map.boundingBox();
    expect(nextCaption!.y + nextCaption!.height).toBeLessThan(nextMap!.y);
    expect(await map.evaluate(element => element.scrollLeft)).toBe(0);
    await expect(page.locator('#step-title')).toHaveText('The model receives the context');
  }
});

test('overview, grouped route, and inside flows keep the walkthrough at the same step', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.locator('#next').click();
  const count = await page.locator('#step-count').textContent();
  const levels = page.getByRole('group', { name: 'Diagram level' });
  const route = page.locator('#diagram');
  await expect(route.locator('[data-group="device"] [data-node="user"]')).toBeVisible();
  await expect(route.locator('[data-group="application"] [data-node="app"]')).toBeVisible();
  await expect(route.locator('[data-group="serving"] [data-node="model"]')).toBeVisible();
  await expect(node(page, 'app')).toHaveAttribute('data-has-inside', '');

  await levels.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(route).toBeHidden();
  await expect(page.locator('#overview-flow .overview-stop')).toHaveCount(4);
  await expect(page.locator('#overview-flow [aria-current="step"]')).toContainText('Across the network');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#overview-flow [data-group="application"]').click();
  await expect(levels.getByRole('button', { name: 'Route', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(node(page, 'edge')).toBeFocused();
  await expectCurrentStopVisible(page, 'edge');
  await expect(page.locator('#step-count')).toHaveText(count!);

  await node(page, 'app').click();
  await page.getByRole('button', { name: 'See inside', exact: true }).click();
  await expect(levels.getByRole('button', { name: 'Inside a stop', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#inside-heading')).toHaveText('AI application');
  await expect(page.locator('#inside-flow li')).toHaveCount(4);
  await expect(page.locator('#inside-flow')).toContainText('Assemble instructions and permitted context');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Stop', { exact: true }).selectOption('model');
  await expect(page.locator('#inside-flow')).toContainText('Calculate next-token scores');
  await page.getByRole('button', { name: 'Show stop in route', exact: true }).click();
  await expect(node(page, 'model')).toBeFocused();
  await expectCurrentStopVisible(page, 'model');
  await expect(page.locator('#step-count')).toHaveText(count!);
  await expect(page.locator('.map-scroll')).toHaveCSS('overflow-y', 'visible');
  await page.getByRole('link', { name: 'Diagram', exact: true }).click();
  await expect(page.locator('#map-title')).toBeFocused();
  await expect(page.locator('#map-title')).toBeInViewport({ ratio: 1 });
});

for (const viewport of [{ width: 320, height: 480 }, { width: 1200, height: 900 }]) {
  test(`connections stop at group boundaries and stay below the headings at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSetup(page);
    await page.locator('#fallback').check();
    await page.getByRole('button', { name: 'View journey', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);

    const links = page.locator('#paths g.edge-link[data-key]');
    await expect(links.filter({ has: page.locator('[data-segment="between"]') })).not.toHaveCount(0);
    await expect(page.locator('#paths [data-key="host-router-request"] [data-segment="between"]')).toHaveCount(1);
    const boundaryErrors = () => links.evaluateAll(elements => {
      const errors: string[] = [];
      for (const group of elements) {
        const key = (group as SVGGElement).dataset.key!;
        const [fromId, toId] = key.split('-');
        const from = document.querySelector(`[data-node="${fromId}"]`)!;
        const to = document.querySelector(`[data-node="${toId}"]`)!;
        const fromGroup = from.closest('.route-group')!;
        const toGroup = to.closest('.route-group')!;
        const fromFrame = fromGroup.getBoundingClientRect();
        const toFrame = toGroup.getBoundingClientRect();
        const fromHeaderBottom = fromGroup.querySelector('h3')!.getBoundingClientRect().bottom;
        const toHeaderBottom = toGroup.querySelector('h3')!.getBoundingClientRect().bottom;
        const down = fromFrame.top < toFrame.top;
        const svgBounds = (group as SVGGElement).ownerSVGElement!.getBoundingClientRect();
        const exit = group.querySelector<SVGPathElement>('[data-segment="exit"]')!;
        const bridge = group.querySelector<SVGPathElement>('[data-segment="between"]')!;
        const entry = group.querySelector<SVGPathElement>('[data-segment="entry"]')!;
        const y = (path: SVGPathElement, end = false) =>
          svgBounds.top + path.getPointAtLength(end ? path.getTotalLength() : 0).y;
        const near = (actual: number, expected: number) => Math.abs(actual - expected) < 1;

        if (!near(y(exit), down ? from.getBoundingClientRect().bottom : from.getBoundingClientRect().top) ||
            !near(y(entry, true), down ? to.getBoundingClientRect().top : to.getBoundingClientRect().bottom)) {
          errors.push(`${key} does not join both stop borders`);
        }
        if (!near(y(exit, true), down ? fromFrame.bottom : fromHeaderBottom) ||
            !near(y(entry), down ? toHeaderBottom : toFrame.bottom)) {
          errors.push(`${key} does not connect the inner group boundaries`);
        }
        if (!near(y(bridge), down ? fromFrame.bottom : fromFrame.top) ||
            !near(y(bridge, true), down ? toFrame.top : toFrame.bottom) ||
            bridge.getBBox().width > 1 ||
            group.querySelectorAll('.edge-port').length !== 3) {
          errors.push(`${key} does not cross the gap directly between the groups`);
        }
        for (const [path, frame, headerBottom] of [[exit, fromFrame, fromHeaderBottom], [entry, toFrame, toHeaderBottom]] as const) {
          const bounds = path.getBBox();
          if (bounds.y + svgBounds.top < headerBottom - 1 ||
              bounds.y + bounds.height + svgBounds.top > frame.bottom + 1 ||
              bounds.x + svgBounds.left < frame.left - 1 ||
              bounds.x + bounds.width + svgBounds.left > frame.right + 1) {
            errors.push(`${key} leaves its group or crosses its heading`);
          }
        }
      }
      return errors;
    });
    expect(await boundaryErrors()).toEqual([]);
    await page.locator('#show-copies').uncheck();
    expect(await boundaryErrors()).toEqual([]);
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(page.locator('#paths g.active[data-key="user-network-request"] path[data-segment]')).toHaveCount(3);
    await page.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(page.locator('#paths g.active[data-key="network-user-return"] path[data-segment]')).toHaveCount(3);
  });
}

test('local and optional groups reflect the example and the alert keeps the requester unknown', async ({ page }) => {
  await openSetup(page);
  await page.getByLabel('Sample story').selectOption('factory');
  await page.getByLabel('AI setup', { exact: true }).selectOption('local');
  await page.getByRole('button', { name: 'View journey', exact: true }).click();
  await expect(page.locator('#diagram [data-group="device"] [data-node="app"]')).toBeVisible();
  await expect(page.locator('#diagram [data-group="device"] [data-node="model"]')).toBeVisible();
  await expect(page.locator('#diagram [data-group="device"] [data-copy-source="app"] [data-node="logs"]')).toBeVisible();
  const levels = page.getByRole('group', { name: 'Diagram level' });
  await levels.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('#overview-flow .overview-stop')).toHaveCount(1);
  await expect(page.locator('#overview-branches .overview-stop')).toHaveCount(2);
  await page.locator('#overview-branches [data-group="alert"]').click();
  await node(page, 'unknown').click();
  await expect(page.getByRole('button', { name: 'See inside', exact: true })).toBeHidden();
  await levels.getByRole('button', { name: 'Inside a stop', exact: true }).click();
  await expect(page.locator('#inside-flow li')).toHaveCount(0);
  await expect(page.locator('#inside-unknown')).toContainText('unknown');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(levels.getByRole('button', { name: 'Route', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1200, height: 900 }]) {
  test(`scrolling the route moves the page and pauses playback at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pauseJourneyClock(page);

    const pane = page.locator('.map-scroll');
    await expect(pane).toHaveCSS('overflow-y', 'visible');
    expect(await pane.evaluate(element => element.clientHeight === element.scrollHeight)).toBe(true);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const start = await expectCurrentStopVisible(page);
    const bounds = await node(page, 'user').boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.wheel(0, 400);

    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(start.pageY + 250);
    await expect(page.locator('#play')).toHaveAccessibleName('Play');
    await page.clock.runFor(20_000);
    await expect(page.locator('#step-count')).toHaveText('Step 1 of 35');
    expect(await pane.evaluate(element => element.scrollTop)).toBe(0);

    if (viewport.width < 1024) {
      await page.getByRole('link', { name: 'Read step' }).click();
      await expect(page.locator('#step-title')).toBeFocused();
    }
    await expect(page.locator('#step-title')).toBeInViewport({ ratio: 1 });
  });
}

test('the tool is discoverable and launches from its catalog description', async ({ page }) => {
  await page.goto('/');
  await page.locator('#search').fill('Prompt Journey');
  await expect(page.locator('[data-tool-card]:not([hidden])')).toHaveCount(1);
  await page.goto('/about/prompt-journey/');
  await expect(page.locator('a.primary')).toHaveAttribute('href', 'https://tools.tedt.org/prompt-journey.html');
  await expect(page.locator('body')).toContainText('illustrative simulation');
  await expect(page.locator('body')).toContainText('Clear Possible saved copies in the diagram legend');
  await expect(page.locator('body')).toContainText('masked visitor analytics');
});
