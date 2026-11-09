import { test, expect } from '@playwright/test';
import { routeHeaderAssets } from '../shared-header.mjs';

test.beforeEach(async ({page}) => {
  await routeHeaderAssets(page);
  await page.goto('/agent-business-case-lab.html');
});

test('growth compares paid volume with the manual pilot and rejects impossible volumes', async ({page}) => {
  const value = page.getByRole('row', {name: /First-year contribution gain/});
  await expect(value.getByRole('cell').nth(1)).toHaveText('$13,600');
  await expect(page.getByRole('row', {name: /Revenue \/ month/}).getByRole('cell').nth(1)).toHaveText('$4,500');
  await page.getByLabel('Paid orders fulfilled per month').fill('30');
  await expect(value.getByRole('cell').nth(1)).toHaveText('$2,800');
  await page.getByLabel('Paid orders fulfilled per month').fill('201');
  await expect(value.getByRole('cell').nth(1)).toHaveText('—');
  await expect(page.getByLabel('Paid orders fulfilled per month')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('status')).toContainText('Paid orders cannot exceed eligible requests');
});

test('removal needs separate evidence and a real change in support spending', async ({page}) => {
  await page.getByRole('button', {name: 'Operating cost', exact: true}).click();
  const value = page.getByRole('row', {name: /First-year net savings/}).getByRole('cell');
  const retirement = page.locator('#retirement');
  await expect(value.nth(1)).toHaveText('$2,200');
  await expect(value.nth(2)).toHaveText('-$600');
  await expect(value.nth(3)).toHaveText('$11,400');
  await expect(retirement).toContainText('The simpler upgrade clears the targets');
  await page.getByLabel('Cancel legacy support if the workaround is retired').uncheck();
  await expect(value.nth(3)).toHaveText('-$600');
  await expect(retirement).toContainText('lacks a cost case');
  await page.getByLabel('Cancel legacy support if the workaround is retired').check();
  await page.getByLabel('Correct outcomes (%)', {exact: true}).fill('97');
  await expect(value.nth(3)).toHaveText('$11,400');
  await expect(retirement).toContainText('Keep the workaround');
  await page.getByLabel('Correct outcomes (%)', {exact: true}).fill('98');
  await page.getByLabel('Required control and exception tests').selectOption('');
  await expect(retirement).toContainText('Enter results for both');
  await page.getByLabel('Required control and exception tests').selectOption('fail');
  await expect(retirement).toContainText('Keep the workaround');
  await page.getByLabel('Required control and exception tests').selectOption('pass');
  await expect(retirement).toContainText('clears the targets');
  await page.getByLabel('Configuration to edit').selectOption('kept');
  await expect(page.getByLabel('Correct outcomes (%)', {exact: true})).toHaveValue('99.2');
});

test('the tool is discoverable and keeps comparison scrolling inside the mobile page', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('button', {name: 'Operating cost', exact: true}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', {name: 'Start blank', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('Planning estimates');
  await expect(page.locator('#retirement')).toContainText('Enter results for both');
  await page.getByRole('button', {name: 'Growth', exact: true}).click();
  await expect(page.getByRole('row', {name: /First-year contribution gain/}).getByRole('cell').nth(1)).toHaveText('$13,600');
  await page.goto('/about/agent-business-case-lab/');
  await expect(page.locator('a.primary')).toHaveAttribute('href', 'https://tools.tedt.org/agent-business-case-lab.html');
  await page.goto('/');
  await page.locator('#search').fill('Agent Business Case Lab');
  await expect(page.locator('[data-tool-card]:not([hidden])')).toHaveCount(1);
});
