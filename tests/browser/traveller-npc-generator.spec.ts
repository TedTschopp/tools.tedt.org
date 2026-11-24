import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { routeHeaderAssets } from '../shared-header.mjs';

const url = '/traveller-npc-generator.html';
const savedFixture = 'Referee-only relationship';

test.beforeEach(async ({ page }) => { await routeHeaderAssets(page); });

test('book-sourced plates track the selected and committed species', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  const encounter = page.locator('#encounter-plate');
  const before = await encounter.locator('img').getAttribute('src');
  await page.getByLabel('Species profile').selectOption('hiver');
  const preview = page.locator('#settings-plate');
  await expect(preview.getByRole('img', { name: /Hiver/ })).toBeVisible();
  await expect(preview).toContainText('six radial limbs');
  await expect(encounter.locator('img')).toHaveAttribute('src', before!);
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(encounter).toContainText('Hivers have one sex');
  await expect(encounter).toContainText('Aliens of Charted Space Vol. 2');
  const image = encounter.getByRole('img', { name: /Hiver/ });
  await expect.poll(() => image.evaluate((img: HTMLImageElement) =>
    img.complete && img.naturalWidth === img.naturalHeight && img.naturalWidth > 0)).toBe(true);
  await page.getByRole('button', { name: 'Player view', exact: true }).click();
  await expect(image).toBeVisible();
  await expect(page.locator('#referee')).toBeHidden();
  await page.getByRole('button', { name: 'Return to referee view' }).click();
  await page.getByRole('link', { name: 'Species field guide', exact: true }).click();
  await page.getByLabel('Find a species or source').fill('Chirper');
  await expect(page.locator('#species-guide')).toContainText('1 entry found');
  await expect(page.locator('#species-guide').getByRole('img', { name: /Chirper/ })).toBeVisible();
});

test('published encounters render native rules and can be saved and restored', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByLabel('Species profile').selectOption('ganmeid');
  await expect(page.getByRole('combobox', { name: 'Occupation', exact: true })).toBeHidden();
  await expect(page.locator('#settings-plate').getByRole('img', { name: /Ganmeid/ })).toBeVisible();
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#encounter-plate')).toContainText('The Third Imperium, p. 166');
  await expect(page.locator('#source-encounter-record')).toContainText('Hits24');
  await expect(page.locator('#source-encounter-record')).toContainText('Bite (1D+3)');
  await expect(page.getByText('Skills and qualifications', { exact: true })).toBeHidden();
  await page.reload();
  await expect(page.locator('#status')).toContainText('Restored NPC 1');
  await expect(page.locator('#source-encounter-record')).toBeVisible();
  await page.getByLabel('Species profile').selectOption('human');
  await expect(page.getByRole('combobox', { name: 'Occupation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#characteristics')).toBeVisible();
  await expect(page.locator('#source-encounter-record')).toBeHidden();
});

test('catalog launches the new Traveller tool and conditions a hiring search', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search' }).fill('Traveller NPC Generator');
  const card = page.locator('[data-tool-card]:visible');
  await expect(card).toHaveCount(1);
  const launch = card.getByRole('link', { name: 'Open' });
  await expect(launch).toHaveAttribute('href', 'https://tools.tedt.org' + url);
  await page.goto(new URL((await launch.getAttribute('href'))!).pathname);
  await expect(page).toHaveURL(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByText('Required skills and characteristics', { exact: true }).click();
  await page.getByRole('button', { name: 'Medic 2 hiring' }).click();
  const ratings = page.getByRole('region', { name: 'Job and crew qualifications' });
  await expect(ratings.getByRole('row', { name: /Medic 2 [23]/ })).toBeVisible();
  await expect(page.locator('#validity')).toContainText('Qualified');
  await page.getByRole('combobox', { name: 'Occupation', exact: true }).selectOption('42');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#status')).toContainText('No eligible occupation and competence can provide Medic 2+');
  await expect(ratings.getByRole('row', { name: /Medic 2 [23]/ })).toBeVisible();
});

test('locks, candidate rerolls and saved records work through the real browser entry point', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByLabel('Species profile').selectOption('droyne');
  await page.getByLabel('Adult form or caste').selectOption('Technician');
  await page.getByText('Cross-training and psionics', { exact: true }).click();
  await page.getByLabel('Wings').selectOption('large');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#characteristics')).toContainText('Technician');
  await expect(page.getByRole('region', { name: 'Resolved skills' })).toContainText('Flight');
  const characteristics = await page.locator('.characteristics').innerText();
  await page.getByText('Locks and rerolls', { exact: true }).click();
  await page.getByLabel('Lock STR', { exact: true }).check();
  await page.getByRole('button', { name: 'Reroll name', exact: true }).first().click();
  await expect(page.locator('#status')).toContainText('Rerolled the selected fields');
  await expect(page.locator('.characteristics')).toHaveText(characteristics, { useInnerText: true });
  await page.getByText('Seed, versions and roll record', { exact: true }).click();
  await expect(page.locator('#rolls')).toContainText('name 1');
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Referee record · JSON' }).click();
  const download = await waiting;
  const json = await readFile(await download.path());
  const exported = JSON.parse(json.toString());
  expect(exported.biology.wings).toBe('large');
  expect(exported.controls.locks['stat.STR']).toBe(exported.mechanics.characteristics.STR.current);
  await page.getByRole('button', { name: 'Next NPC' }).click();
  await expect(page.locator('#status')).toContainText('NPC 2 ready');
  await page.getByText('Open a saved referee record', { exact: true }).click();
  await page.getByLabel('Referee JSON file').setInputFiles({ name: 'referee.json', mimeType: 'application/json', buffer: json });
  await expect(page.locator('#status')).toContainText('Opened ' + exported.identity.commonName);
  await page.reload();
  await expect(page.locator('#status')).toContainText('Restored NPC 1');
  await expect(page.locator('#npc-name')).toHaveText(exported.identity.commonName);
});

test('player view and player export omit referee-only material and fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByText('Advanced referee facts', { exact: true }).click();
  await page.getByLabel('Campaign options in JSON').fill(JSON.stringify({
    partyRelationship: {
      target: { name: savedFixture }, role: 'Contact', cause: 'A past job', consequence: 'A private favor',
    },
  }));
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await page.getByText('Story, relationships and secrets', { exact: true }).click();
  await expect(page.locator('#story')).toContainText(savedFixture);
  await page.getByRole('button', { name: 'Player view', exact: true }).click();
  await expect(page.getByLabel('Generation settings')).toBeHidden();
  await expect(page.locator('#referee')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Referee record · JSON' })).toBeHidden();
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Player card · TXT' }).click();
  const intro = await readFile(await (await waiting).path(), 'utf8');
  expect(intro.trim()).toBe(await page.locator('#npc-intro').innerText());
  expect(intro).not.toMatch(/Referee-only relationship|private favor|seed/i);
  await page.getByRole('button', { name: 'Return to referee view' }).click();
  await expect(page.locator('#referee')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
