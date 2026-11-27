import {test, expect} from '@playwright/test';
import {routeHeaderAssets} from '../shared-header.mjs';

test.beforeEach(async ({page}) => { await routeHeaderAssets(page); });

test('outage directory opens its ZIP on the map and shares the native geography', async ({page}) => {
  await page.goto('/edison-atlas/#report=outages');
  await expect(page.getByRole('heading', {name:'Outages and community resources'})).toBeVisible();
  await page.locator('#sce-directory').selectOption('scheduled');
  const area = page.locator('button[data-outage-zip]').first();
  const zip = await area.getAttribute('data-outage-zip');
  await area.click();
  await expect(page.locator('.detail-hero')).toContainText('ZIP area ' + zip);
  await page.getByRole('button', {name:'Share view'}).click();
  const link = new URL(await page.locator('#share-url').inputValue());
  const view = new URLSearchParams(link.hash.slice(1));
  expect(link.pathname).toBe('/edison-atlas/');
  expect(view.get('lens')).toBe('sceScheduled');
  expect(view.get('geoid')).toBe(zip);
});

test('planning inventory, local religion sources, and both downloads are available', async ({page}) => {
  await page.goto('/edison-atlas/#report=planning');
  const body = page.locator('#dialog-body');
  await expect(body).toContainText('94 layers and tables');
  await expect(body).toContainText('2035');
  await body.getByRole('button', {name:'Religion',exact:true}).click();
  await expect(body).toContainText('West Valley');
  await expect(body.getByRole('link', {name:'Study variables and geography'})).toBeVisible();
  await page.getByRole('button', {name:'Close dialog'}).click();
  await page.getByRole('button', {name:'Sources',exact:true}).click();
  await expect(body.getByRole('link', {name:'Download offline atlas'})).toHaveAttribute('href','Edison-Atlas-offline.zip');
  await expect(body.getByRole('link', {name:'Download one-mile GIS data'})).toHaveAttribute('href','data/SCE-one-mile-hexes.zip');
});
