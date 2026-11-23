import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const pagePath = '/perplexity-projections.html';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin
    ? route.continue() : route.abort());
});

test('adjusts zoom, crossing dates, and the visible calendar horizon', async ({ page }) => {
  await page.goto(pagePath);
  await expect(page.getByRole('heading', { name: 'Perplexity Projections' })).toBeVisible();
  await expect(page.locator('#y-range')).toHaveText('Showing 0.201–1.000. Auto minimum 0.201.');
  await expect(page.locator('#crossing-rows')).toContainText('Apr 2034');
  await expect(page.locator('#iq-bands tr')).toHaveCount(8);
  await page.getByRole('button', { name: 'Zoom to IQ Bands' }).click();
  await expect(page.locator('#y-range')).toHaveText('Showing 0.640–0.750. Auto minimum 0.201.');
  await page.getByLabel('Future years', { exact: true }).fill('60');
  await expect(page.locator('#crossing-window')).toHaveText('Through Nov 2031');
  await expect(page.locator('#crossing-rows tr').last()).toContainText('Outside view');
  await expect(page.locator('#y-range')).toHaveText('Showing 0.640–0.750. Auto minimum 0.384.');
  await page.getByLabel('Y minimum', { exact: true }).fill('');
  await expect(page.locator('#y-range')).toHaveText('Showing 0.384–0.750. Auto minimum 0.384.');
  await page.getByLabel('Y maximum', { exact: true }).fill('1.1');
  await expect(page.locator('#y-error')).toContainText('at most 1.00');
  await expect(page.locator('#y-range')).toHaveText('Showing 0.384–1.000. Auto minimum 0.384.');
  await page.getByLabel('IQ 85 (−1 SD)').fill('0.73');
  await expect(page.locator('#cross-median')).toHaveText('0.705');
  await expect(page.locator('#crossing-rows tr').last()).toContainText('Nov 2026');
  await page.getByRole('button', { name: 'Reset View' }).click();
  await expect(page.locator('#crossing-window')).toHaveText('Through Nov 2056');
  await expect(page.locator('#cross-median')).toHaveText('0.705');
});

test('redraws independent calendar and series controls and inspects dates by keyboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pagePath);
  const plot = page.locator('#trend-chart');
  const snapshot = () => plot.evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  async function redraw(action: () => Promise<void>) {
    const before = await snapshot();
    await action();
    await expect.poll(snapshot).not.toBe(before);
  }
  await expect(page.getByRole('checkbox', { name: 'Annual', exact: true })).toBeChecked();
  await redraw(() => page.getByRole('checkbox', { name: 'Annual', exact: true }).uncheck());
  await redraw(() => page.getByRole('checkbox', { name: 'Quarterly', exact: true }).check());
  await redraw(() => page.getByRole('checkbox', { name: 'Monthly', exact: true }).check());
  await redraw(() => page.getByLabel('Time-scale base').fill('0.5'));
  await redraw(() => page.getByRole('checkbox', { name: 'Pessimistic', exact: true }).uncheck());
  await redraw(() => page.getByLabel('Optimistic floor').fill('0.3'));
  await page.getByRole('slider', { name: 'Inspect month' }).press('ArrowRight');
  await expect(page.locator('#inspect-date')).toHaveText('Dec 2026');
  await expect(page.locator('#inspect-values')).toContainText('Optimistic');
  await expect(page.locator('#inspect-values')).not.toContainText('Pessimistic');
  expect(errors).toEqual([]);
});

test('keeps the separate human comparison and exports data for the selected window', async ({ page }) => {
  await page.goto(pagePath);
  await expect(page.locator('#human-rows')).toContainText('85–256');
  await page.getByLabel('Units', { exact: false }).selectOption('ln');
  await expect(page.locator('#human-rows')).toContainText('4.443–5.545');
  await page.getByLabel('Future years', { exact: true }).fill('6');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const file = await download;
  const csv = await readFile((await file.path())!, 'utf8');
  expect(file.suggestedFilename()).toBe('perplexity-projections.csv');
  expect(csv).toContain('"2026-11","GPT-6.2 Astra","0.761","Internal model","0.732"');
  expect(csv.trim().split('\n').at(-1)).toContain('"2027-05"');
  expect(csv).not.toContain('"2027-06"');
});

test('fits a narrow Night viewport and is listed in the Tools catalog', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 920 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(pagePath);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('link', { name: 'Chart Controls', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'IQ Reference Crossings' })).toBeVisible();
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(noOverflow).toBeTruthy();
  const catalog = await (await request.get('/catalog.json')).json();
  expect(catalog.find(tool => tool.slug === 'perplexity-projections')).toMatchObject({
    title: 'Perplexity Projections',
    category: 'AI and learning',
    launch: 'https://tools.tedt.org/perplexity-projections.html',
  });
  const details = await request.get('/about/perplexity-projections/');
  expect(details.ok()).toBeTruthy();
});
