import {test, expect} from '@playwright/test';
import {routeHeaderAssets} from '../shared-header.mjs';

test.beforeEach(async ({page}) => { await routeHeaderAssets(page); });

test('cooling center directory opens and shares the actual one-mile hex', async ({page}) => {
  await page.goto('/edison-atlas/#report=cooling');
  await expect(page.getByRole('heading', {name:'Cooling centers in SCE territory'})).toBeVisible();
  const search = page.getByRole('searchbox', {name:'Facility, city, street or ZIP'});
  await search.fill('Palomares Park');
  await expect(page.locator('#cooling-table tbody tr:visible')).toHaveCount(1);
  await page.getByRole('button', {name:'Palomares Park Community Center'}).click();
  await expect(page.locator('#side-body')).toContainText('499 E Arrow Highway');
  await expect(page.locator('#side-body')).toContainText('Cooling centers in this hex');
  await page.getByRole('button', {name:'Share view'}).click();
  const link = new URL(await page.locator('#share-url').inputValue());
  const view = new URLSearchParams(link.hash.slice(1));
  expect(link.pathname).toBe('/edison-atlas/');
  expect(view.get('lens')).toBe('sceCooling');
  expect(view.get('tile')).toBe('129,311');
});

test('one-mile planning data distinguishes partial polygons and overlapping source bands', async ({page}) => {
  await page.goto('/edison-atlas/#lens=projectCoverage&tile=83,53&x=83.5&y=45.9&z=25');
  await expect(page.locator('.lens-callout strong')).toHaveText('14.17%');
  const panel = page.locator('#side-body');
  await expect(panel).toContainText('SCE planning in this hex');
  await expect(panel).toContainText('3 records');
  await expect(panel).toContainText('32.56% mapped');
  await panel.locator('.band-coverage summary').first().click();
  await expect(panel.locator('.band-coverage[open]')).toContainText('Above 5 MW');
  await page.goto('/edison-atlas/#lens=fire&tile=163,146&x=163&y=126.44&z=25');
  await expect(page.locator('.lens-callout')).toContainText('Largest area in the hex');
  await expect(page.locator('.lens-callout strong')).toHaveText('Outside tiers 2–3');
});

test('fire colors the clicked hex by area and shows the complete percentage split', async ({page}) => {
  // The point lookup for this hex was Tier 2. Tier 3 covers 82.19% of the SCE area.
  await page.goto('/edison-atlas/#lens=fire&x=154.5&y=276.262&z=25&layers=');
  const base = page.locator('canvas#base');
  await expect.poll(() => base.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!;
    return Array.from(context.getImageData(Math.floor(element.width/2), Math.floor(element.height/2), 1, 1).data);
  })).toEqual([185, 86, 64, 255]);
  const canvas = page.locator('canvas#map');
  const bounds = (await canvas.boundingBox())!;
  await canvas.click({position:{x:bounds.width/2, y:bounds.height/2}});
  await expect(page.locator('.lens-callout strong')).toHaveText('Tier 3 · Extreme');
  const coverage = page.locator('section.detail-section').filter({has:page.getByRole('heading', {name:'Fire tier coverage'})});
  for (const [label, share] of [['Tier 3 · Extreme','82.19%'],['Tier 2 · Elevated','17.68%'],['Outside tiers 2–3','0.13%']]) {
    await expect(coverage.locator('.fact').filter({hasText:label}).locator('b')).toHaveText(share);
  }
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
