import { test, expect, type Page } from '@playwright/test';
import { routeHeaderAssets } from '../shared-header.mjs';

const valuesFor = (page: Page, name: string) => page.getByRole('row', {name: new RegExp('^' + name)}).getByRole('cell');
const editAssumptions = (page: Page) => page.getByText('Edit assumptions', {exact: true}).click();

test.beforeEach(async ({page}) => {
  await routeHeaderAssets(page);
  await page.goto('/agent-business-case-lab.html');
});

test('growth separates demand and capacity and compares the same volume', async ({page}) => {
  const value = valuesFor(page, 'First-year contribution gain from pilot');
  const revenue = valuesFor(page, 'Revenue / month');
  const demand = page.getByLabel('Paid orders placed per month');
  const capacity = page.getByLabel('Fulfillment capacity per month');
  const comparison = page.locator('#growth-case');
  await expect(comparison).toContainText('$2,800');
  await expect(comparison).toContainText('$13,600');
  await expect(value.nth(1)).toHaveText('$13,600');
  await expect(revenue.nth(1)).toHaveText('$4,500');
  await editAssumptions(page);
  await demand.fill('30');
  await expect(capacity).toHaveValue('45');
  await expect(value.nth(1)).toHaveText('$2,800');
  await expect(revenue.nth(1)).toHaveText('$3,000');
  await demand.fill('45');
  await capacity.fill('35');
  await expect(valuesFor(page, 'Paid orders placed / month').nth(1)).toHaveText('45');
  await expect(valuesFor(page, 'Paid orders fulfilled / month').nth(1)).toHaveText('35');
  await expect(valuesFor(page, 'Eligible requests fulfilled as paid orders').nth(1)).toHaveText('17.5%');
  await demand.fill('201');
  await expect(value.nth(1)).toHaveText('—');
  await expect(demand).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#status')).toContainText('Paid orders cannot exceed eligible requests');
});

test('retirement and the decision to switch use separate comparisons', async ({page}) => {
  await page.getByRole('button', {name: 'Operating cost', exact: true}).click();
  await editAssumptions(page);
  const fromOriginal = valuesFor(page, 'First-year net savings from original desk');
  const fromToday = valuesFor(page, 'First-year net savings from today’s model');
  const retirement = page.locator('#retirement');
  const upgrade = page.locator('#upgrade-case');
  const spend = page.getByLabel('Monthly cash spend before legacy support ($)', {exact: true});
  const contract = page.getByLabel('Cancel legacy support if the workaround is retired');

  await expect(fromOriginal.nth(1)).toHaveText('$2,200');
  await expect(fromOriginal.nth(2)).toHaveText('-$600');
  await expect(fromOriginal.nth(3)).toHaveText('$11,400');
  await expect(fromToday.nth(3)).toHaveText('$9,200');
  await expect(retirement).toContainText('passes the delivery checks without the script');
  await expect(upgrade).toContainText('Switching beats today’s model');
  await expect(upgrade).toContainText('$4,650 per month');
  await expect(upgrade).toContainText('$3,800 per month');

  await contract.uncheck();
  await expect(fromOriginal.nth(3)).toHaveText('-$600');
  await expect(fromToday.nth(3)).toHaveText('-$2,800');
  await expect(retirement).toContainText('same monthly cost');
  await expect(upgrade).toContainText('Keep today’s model');
  await expect(upgrade).toContainText('Either upgrade costs $2,800 more');
  await contract.check();

  await spend.fill('4700');
  await expect(fromOriginal.nth(3)).toHaveText('$600');
  await expect(fromToday.nth(3)).toHaveText('-$1,600');
  await expect(retirement).toContainText('passes the delivery checks without the script');
  await expect(upgrade).toContainText('Keep today’s model');

  await spend.fill('3800');
  await page.getByLabel('Remaining cost to switch from today’s model ($)', {exact: true}).fill('11000');
  await expect(fromOriginal.nth(3)).toHaveText('$11,400');
  await expect(fromToday.nth(3)).toHaveText('-$800');
  await expect(upgrade).toContainText('Keep today’s model');
});

test('the upgrade needs evidence for reused part numbers and unsafe near matches', async ({page}) => {
  await page.getByRole('button', {name: 'Operating cost', exact: true}).click();
  await editAssumptions(page);
  const retirement = page.locator('#retirement');
  const upgrade = page.locator('#upgrade-case');
  const quality = page.getByLabel('Correct outcomes (%)', {exact: true});
  const reused = page.getByLabel('Reused part number tests', {exact: true});
  const near = page.getByLabel('Unsafe near-match tests', {exact: true});
  await quality.fill('97');
  await expect(retirement).toContainText('Keep the script');
  await quality.fill('98.9');
  await reused.selectOption('fail');
  await expect(retirement).toContainText('reused part numbers');
  await expect(upgrade).toContainText('Keep today’s model');
  await reused.selectOption('pass');
  await near.selectOption('');
  await expect(valuesFor(page, 'Unsafe near-match tests').nth(3)).toHaveText('Pending');
  await expect(retirement).toContainText('Enter delivery results for both');
  await expect(upgrade).toContainText('complete the comparison');
  await near.selectOption('fail');
  await expect(retirement).toContainText('unsafe near matches');
  await page.getByLabel('Edit the numbers for').selectOption('kept');
  await expect(near).toHaveValue('pass');
  await page.getByLabel('Monthly cash spend before legacy support ($)', {exact: true}).fill('3400');
  await expect(upgrade).toContainText('Switching beats today’s model');
  await expect(upgrade).toContainText('Upgrade with routine costs $4,400 per month');
  await expect(retirement).toContainText('Keep the script');
});

test('the bundled figures stay illustrative and users can label their own inputs', async ({page}) => {
  await editAssumptions(page);
  const evidence = page.getByLabel('Where your figures come from');
  const status = page.locator('#status');
  await expect(evidence).toBeDisabled();
  await page.getByLabel('Paid orders placed per month').fill('30');
  await expect(status).toContainText('figures are fictional');
  await page.getByRole('button', {name: 'Start blank', exact: true}).click();
  await expect(evidence).toBeEnabled();
  await expect(page.getByRole('button', {name: 'Only 30 paid orders come in', exact: true})).toBeHidden();
  await expect(page.getByLabel('Paid orders placed per month')).toHaveValue('');
  await evidence.selectOption('mixed');
  await expect(status).toContainText('Measurements and estimates you entered');
  await page.getByRole('button', {name: 'Load distributor example', exact: true}).click();
  await expect(evidence).toBeDisabled();
  await expect(status).toContainText('figures are fictional');
});

test('the mobile walkthrough keeps each choice beside its result', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/agent-business-case-lab.html#try-example');
  const paidOrders = page.getByRole('button', {name: 'Only 30 paid orders come in', exact: true});
  const growth = page.locator('#growth-case');
  await expect(page.locator('#assumptions-panel')).toHaveJSProperty('open', false);
  await paidOrders.focus();
  await page.keyboard.press('Enter');
  await expect(paidOrders).toBeFocused();
  await expect(paidOrders).toHaveAttribute('aria-pressed', 'true');
  await expect(growth).toBeInViewport();
  await expect(growth).toContainText('sales are $3,000 a month for either workflow');
  await expect(growth).toContainText('$2,800 more in year one after setup');
  await expect(growth).toContainText('room for 15 more orders');
  await editAssumptions(page);
  await expect(page.getByLabel('Paid orders placed per month')).toHaveValue('30');
  await expect(page.getByLabel('Fulfillment capacity per month')).toHaveValue('45');
  await editAssumptions(page);

  await page.getByRole('button', {name: 'Operating cost', exact: true}).click();
  const keepSupport = page.getByRole('button', {name: 'Keep paying for support', exact: true});
  await expect(page.locator('#upgrade-case')).toBeInViewport();
  await expect(page.locator('#upgrade-case')).toContainText('$9,200');
  await keepSupport.click();
  await expect(keepSupport).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#upgrade-case')).toBeInViewport();
  await expect(page.locator('#upgrade-case')).toContainText('Either upgrade costs $2,800 more');
  await expect(page.locator('#retirement')).toContainText('passes the delivery checks without the script');
  expect(await page.evaluate(() => {
    const summary = document.querySelector('#upgrade-case')!.getBoundingClientRect();
    const assumptions = document.querySelector('#assumptions-panel')!.getBoundingClientRect();
    return summary.bottom <= assumptions.top && document.documentElement.scrollWidth <= innerWidth;
  })).toBe(true);
  await editAssumptions(page);
  await expect(page.getByLabel('Cancel legacy support if the workaround is retired')).not.toBeChecked();
});

test('the lab stays discoverable in the tools catalog', async ({page}) => {
  await page.goto('/about/agent-business-case-lab/');
  await expect(page.locator('a.primary')).toHaveAttribute('href', 'https://tools.tedt.org/agent-business-case-lab.html');
  await page.goto('/');
  await page.locator('#search').fill('Agent Business Case Lab');
  await expect(page.locator('[data-tool-card]:not([hidden])')).toHaveCount(1);
});
