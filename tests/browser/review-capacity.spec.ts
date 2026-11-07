import { test, expect } from '@playwright/test';
import { routeHeaderAssets } from '../shared-header.mjs';

test.beforeEach(async ({page}) => { await routeHeaderAssets(page); });

test('worked examples update the actual model, chart, and accessible table', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/review-capacity-lab.html');
  await expect(page.locator('#status')).toContainText('Backlog grows');
  await expect(page.locator('#demand-hours')).toHaveText('16');
  await expect(page.locator('#capacity-hours')).toHaveText('8');
  await expect(page.locator('#end-cases')).toHaveText('960 review-case equivalents.');
  await expect(page.locator('#max-intake')).toHaveText('384 requests / workday');
  await page.getByRole('button', {name: 'No slack', exact: true}).click();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'no-slack');
  await expect(page.locator('#end-cases')).toHaveText('24 review-case equivalents.');
  await page.getByRole('button', {name: 'Clear a backlog', exact: true}).click();
  await expect(page.locator('#end-cases')).toHaveText('0 review-case equivalents.');
  await page.getByRole('button', {name: 'Add re-review', exact: true}).click();
  await expect(page.locator('#demand-hours')).toHaveText('19.2');
  await expect(page.locator('#end-cases')).toHaveText('320 review-case equivalents.');
  await page.getByText('Show daily values', {exact:true}).click();
  await expect(page.locator('#timeline tr')).toHaveCount(11);
  await expect(page.locator('#timeline tr').last()).toContainText('320');
  await expect(page.getByRole('img', {name:'Remaining review workload by workday'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('invalid inputs hide stale results and zero capacity is explicit', async ({page}) => {
  await page.goto('/review-capacity-lab.html');
  await page.locator('#requests').fill('');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#requests')).toHaveAttribute('aria-invalid','true');
  await page.locator('#requests').fill('960');
  await expect(page.locator('#results')).toBeVisible();
  await page.locator('#reviewers').fill('0');
  await expect(page.locator('#status')).toContainText('No review capacity');
  await page.locator('#reviewPercent').fill('0');
  await expect(page.locator('#max-intake')).toHaveText('No review-derived limit');
});

test('scenario exports, reimports, and CSV preserve meaningful values', async ({page}) => {
  await page.goto('/review-capacity-lab.html');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', {name:'Export scenario JSON'}).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const data = JSON.parse(Buffer.concat(chunks).toString());
  expect(data.assumptions.requests).toBe(960);
  expect(data.results.endCases).toBe(960);
  data.assumptions.hours = 8;
  data.results.endCases = 999999;
  await page.locator('#import-file').setInputFiles({name:'scenario.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await expect(page.locator('#end-cases')).toHaveText('0 review-case equivalents.');
  await expect(page.locator('#file-status')).toContainText('recalculated');
  const csv = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export timeline CSV'}).click();
  expect((await csv).suggestedFilename()).toBe('review-capacity-timeline.csv');
  await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect(page.locator('#file-status')).toContainText('current scenario is unchanged');
  await expect(page.locator('#hours')).toHaveValue('8');
});

test('catalog discovery and mobile controls work without horizontal overflow', async ({page}) => {
  await page.goto('/');
  await page.locator('#search').fill('Review Capacity Lab');
  await expect(page.locator('[data-tool-card]:not([hidden])')).toHaveCount(1);
  await page.goto('/about/review-capacity-lab/');
  await expect(page.locator('a.primary')).toHaveAttribute('href','https://tools.tedt.org/review-capacity-lab.html');
  await page.setViewportSize({width:390,height:844});
  await page.goto('/review-capacity-lab.html');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.locator('#hours').fill('6');
  await expect(page.locator('#capacity-hours')).toHaveText('12');
  await page.locator('#hours').blur();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'reports/review-capacity-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'reports/review-capacity-desktop.png',fullPage:true});
});
