import { test, expect, type Page } from '@playwright/test';
import { routeHeaderAssets } from '../shared-header.mjs';

const node = (page: Page, name: string) => page.locator(`#diagram button[data-node="${name}"]`);
const transportControls = [
  ['back', 'Back'], ['next', 'Next step'], ['play', 'Play'],
  ['restart', 'Restart'], ['jump-return', 'Jump to answer'],
] as const;

async function pauseJourneyClock(page: Page) {
  await page.clock.install({ time: new Date('2026-11-21T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-21T12:00:01Z'));
  await page.reload();
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

test('the fictional example explains its limits and supports reversible navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Prompt Journey', exact: true })).toBeVisible();
  await expect(page.locator('#scenario')).toHaveValue('enterprise');
  await expect(page.locator('body')).toContainText(/illustrative|simulation/i);
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

test('possible saved copies are separate from the main route', async ({ page }) => {
  const journeyBefore = await page.locator('#journey-list').textContent();
  await page.locator('#show-copies').check();
  for (const participant of ['history', 'logs', 'training']) {
    await expect(node(page, participant)).toBeVisible();
  }
  await node(page, 'training').click();
  await expect(page.locator('#detail-body')).toContainText(/train|policy|setting|contract/i);
  await page.locator('#show-copies').uncheck();
  for (const participant of ['history', 'logs', 'training']) {
    await expect(node(page, participant)).toBeHidden();
  }
  await expect(page.locator('#journey-list')).toHaveText(journeyBefore || '');
});

test('possible copy paths include each recipient and disappear with removed connections', async ({ page }) => {
  await page.locator('#fallback').check();
  await page.locator('#show-copies').check();
  const copyPath = (from: string) => page.locator(`#paths path[data-copy-from="${from}"][data-copy-to="logs"]`);
  for (const recipient of ['edge', 'app', 'identity', 'retrieval', 'router', 'host', 'backup', 'tool', 'checks']) {
    await expect(node(page, recipient)).toBeVisible();
    await expect(copyPath(recipient)).toHaveCount(1);
    await expect(copyPath(recipient)).toBeVisible();
    expect(await copyPath(recipient).evaluate(element => getComputedStyle(element).strokeDasharray))
      .not.toBe('none');
  }
  await page.locator('#tools').uncheck();
  await expect(copyPath('tool')).toHaveCount(0);
  await page.locator('#routing').uncheck();
  await expect(copyPath('router')).toHaveCount(0);
  await expect(copyPath('backup')).toHaveCount(0);
  await expect(copyPath('host')).toBeVisible();
  await page.locator('#show-copies').uncheck();
  await expect(page.locator('#paths path[data-copy-from]')).toHaveCount(0);
});

test('the JSON download preserves selected routes, fictional inputs and the return path', async ({ page }) => {
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

test('media icons have accessible names and keyboard playback keeps its label in sync', async ({ page }) => {
  await pauseJourneyClock(page);
  for (const [id, name] of transportControls) {
    const control = page.locator(`#${id}`);
    await expect(control).toHaveAccessibleName(name);
    await expect(control).toHaveAttribute('title', name);
    await expect(control.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  }
  await expect(page.getByRole('checkbox', { name: 'Autoplay steps', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Play', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toHaveAccessibleName('Pause');
  await expect(page.locator('#play')).toHaveAttribute('title', 'Pause');
  await expect(page.locator('#autoplay')).toBeChecked();
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
  await expect(page.locator('#autoplay')).not.toBeChecked();
});

test('autoplay respects the selected delay and restarts that interval when it changes', async ({ page }) => {
  await pauseJourneyClock(page);
  const progress = page.locator('#progress');
  const autoplay = page.getByRole('checkbox', { name: 'Autoplay steps', exact: true });
  await expect(page.locator('#step-delay')).toHaveValue('4000');
  expect(await page.locator('#step-delay option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
    .toEqual(['2000', '4000', '6000', '10000']);
  await autoplay.check();
  await expect(page.locator('#play')).toHaveAccessibleName('Pause');
  await page.clock.runFor(3999);
  await expect(progress).toHaveJSProperty('value', 0);
  await page.clock.runFor(1);
  await expect(progress).toHaveJSProperty('value', 1);

  await page.clock.runFor(1000);
  await page.locator('#step-delay').selectOption('6000');
  await expect(progress).toHaveJSProperty('value', 1);
  await expect(autoplay).toBeChecked();
  await page.clock.runFor(5999);
  await expect(progress).toHaveJSProperty('value', 1);
  await page.clock.runFor(1);
  await expect(progress).toHaveJSProperty('value', 2);

  await autoplay.uncheck();
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
  await page.clock.runFor(60_000);
  await expect(progress).toHaveJSProperty('value', 2);
});

test('manual navigation and setup changes stop autoplay and clear its checkbox', async ({ page }) => {
  await pauseJourneyClock(page);
  const autoplay = page.locator('#autoplay');
  for (const id of ['next', 'back', 'jump-return', 'restart']) {
    await autoplay.check();
    await page.locator(`#${id}`).click();
    await expect(autoplay).not.toBeChecked();
    await expect(page.locator('#play')).toHaveAccessibleName('Play');
    const pausedStep = await page.locator('#step-count').innerText();
    await page.clock.runFor(20_000);
    await expect(page.locator('#step-count')).toHaveText(pausedStep);
  }
  await autoplay.check();
  await page.locator('#scenario').selectOption('local');
  await expect(autoplay).not.toBeChecked();
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
  await page.clock.runFor(20_000);
  await expect(page.locator('#progress')).toHaveJSProperty('value', 0);
});

test('autoplay stops at the final answer and can resume only after leaving the end', async ({ page }) => {
  await pauseJourneyClock(page);
  await page.locator('#scenario').selectOption('local');
  await page.locator('#step-delay').selectOption('2000');
  const autoplay = page.locator('#autoplay');
  const lastStep = (await page.locator('#journey-list li').count()) - 1;
  await autoplay.check();
  await page.clock.runFor(lastStep * 2000);
  await expect(page.locator('#step-title')).toHaveText('The answer reaches you');
  await expect(page.locator('#progress')).toHaveJSProperty('value', lastStep);
  await expect(autoplay).not.toBeChecked();
  await expect(autoplay).toBeDisabled();
  await expect(page.locator('#play')).toHaveAccessibleName('Play');
  await expect(page.locator('#play')).toBeDisabled();
  await page.clock.runFor(20_000);
  await expect(page.locator('#progress')).toHaveJSProperty('value', lastStep);

  await page.locator('#back').click();
  await expect(autoplay).toBeEnabled();
  await expect(page.locator('#play')).toBeEnabled();
  await expect(autoplay).not.toBeChecked();
  await page.locator('#restart').click();
  await expect(page.locator('#progress')).toHaveJSProperty('value', 0);
  await expect(autoplay).toBeEnabled();
});

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

for (const width of [320, 375]) {
  test(`all diagram labels fit inside their cards at ${width}px, including possible copies`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    for (const [id] of transportControls) {
      const bounds = await page.locator(`#${id}`).boundingBox();
      expect(bounds, `${id} should be rendered`).not.toBeNull();
      expect(bounds!.width, `${id} needs a 44px-wide touch target`).toBeGreaterThanOrEqual(44);
      expect(bounds!.height, `${id} needs a 44px-high touch target`).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#fallback').check();
    await page.locator('#show-copies').check();
    await expect(node(page, 'training').locator('b')).toHaveText('Later evaluation / training');
    await page.evaluate(() => document.fonts.ready);

    const clippedText = await page.locator('#diagram button[data-node]').evaluateAll(elements => {
      const clipped: { node: string | undefined; text: string | null }[] = [];
      for (const element of elements) {
        const card = element.getBoundingClientRect();
        for (const label of element.querySelectorAll('b, span')) {
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
    expect(clippedText, 'title and subtitle text must stay inside every card').toEqual([]);
    expect(await page.locator('.map-scroll').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await node(page, 'training').click();
    await expect(page.locator('#detail-title')).toBeFocused();
    await expect(page.locator('#detail-title')).toBeInViewport();
    await page.locator('#back-map').click();
    await expect(node(page, 'training')).toBeFocused();
    await expect(node(page, 'training')).toBeInViewport();
  });
}

test('the tool is discoverable and launches from its catalog description', async ({ page }) => {
  await page.goto('/');
  await page.locator('#search').fill('Prompt Journey');
  await expect(page.locator('[data-tool-card]:not([hidden])')).toHaveCount(1);
  await page.goto('/about/prompt-journey/');
  await expect(page.locator('a.primary')).toHaveAttribute('href', 'https://tools.tedt.org/prompt-journey.html');
  await expect(page.locator('body')).toContainText('illustrative simulation');
  await expect(page.locator('body')).toContainText('masked visitor analytics');
});
