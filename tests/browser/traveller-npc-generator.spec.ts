import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { decodeLinkPayload } from '../../tool-src/tools/traveller-npc-generator/link-payload.mjs';
import { routeHeaderAssets } from '../shared-header.mjs';

const url = '/traveller-npc-generator.html';
const savedFixture = 'Referee-only relationship';

function handoutPayload(href: string) {
  const { hash } = new URL(href);
  expect(hash).toMatch(/^#h1=[A-Za-z0-9_-]+$/);
  return decodeLinkPayload(hash.slice('#h1='.length), 150_000);
}

async function captureClipboard(page: Page) {
  await page.addInitScript(() => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => { copied = value; },
        readText: async () => copied,
      },
    });
  });
}

async function copyPlayerLink(page: Page) {
  const card = page.getByRole('region', { name: 'Encounter card' });
  await card.getByRole('button', { name: 'Copy Player Link', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Player link copied.');
  await expect(page.getByRole('dialog', { name: 'Player handout' })).toBeHidden();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(link).pathname).toBe(url);
  return link;
}

test.beforeEach(async ({ page }) => { await routeHeaderAssets(page); });

test('species portraits enlarge in settings, player view, and the field guide', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByLabel('Species profile').selectOption('hiver');
  const preview = page.locator('#settings-plate').getByRole('button', { name: 'Enlarge Hiver portrait' });
  await preview.focus();
  await preview.press('Enter');
  const viewer = page.getByRole('dialog', { name: 'Hiver' });
  await expect(viewer).toBeVisible();
  const full = viewer.getByRole('img', { name: /Hiver/ });
  await expect.poll(() => full.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 384)).toBe(true);
  expect((await full.boundingBox())!.width).toBeGreaterThan((await preview.boundingBox())!.width);
  await expect(viewer).toContainText('Aliens of Charted Space Vol. 2');
  await expect(viewer.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(preview).toBeFocused();

  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#npc-role')).toContainText('Hiver');
  await page.getByRole('button', { name: 'Player view', exact: true }).click();
  await page.locator('#encounter-plate').getByRole('button', { name: 'Enlarge Hiver portrait' }).click();
  await expect(viewer).toBeVisible();
  await viewer.getByRole('button', { name: 'Close' }).click();
  await expect(viewer).toBeHidden();
  await expect(page.locator('#referee')).toBeHidden();

  await page.getByRole('button', { name: 'Return to referee view' }).click();
  await page.setViewportSize({ width: 320, height: 600 });
  await page.getByRole('link', { name: 'Species field guide', exact: true }).click();
  await page.getByLabel('Find a species or source').fill('Chirper');
  await page.locator('#species-guide').getByRole('button', { name: 'Enlarge Chirper portrait' }).click();
  const mobileViewer = page.getByRole('dialog', { name: 'Chirper' });
  await expect(mobileViewer.getByRole('img')).toBeVisible();
  const bounds = (await mobileViewer.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
});

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

test('switches from a ship’s medic to crew roles and labels a retained roll', async ({ page }) => {
  await page.goto(url);
  const status = page.locator('#status');
  const role = page.locator('#npc-role');
  const occupation = page.getByRole('combobox', { name: 'Occupation', exact: true });
  const retained = page.locator('#retained-record');
  const minimums = page.locator('#active-skill-minimums');
  const medic = page.getByRole('button', { name: 'Medic 2 hiring', exact: true });
  const crew = page.getByRole('button', { name: 'Pilot and astrogator hiring', exact: true });

  await expect(status).toContainText('NPC 1 ready');
  await page.getByLabel('Species profile').selectOption('human');
  await page.getByText('Seed and rerolls', { exact: true }).click();
  await page.getByLabel('Seed', { exact: true }).fill('role-switch-reproduction');
  await page.getByText('Required skills and characteristics', { exact: true }).click();
  await occupation.selectOption('15');
  await medic.click();
  await expect(role).toHaveText('Human · Ship’s medic');
  await expect(minimums).toContainText('Medic = 2');

  await crew.click();
  await expect(role).toHaveText(/Human · (jump navigator|merchant pilot)/i);
  await expect(occupation).toHaveValue('random');
  const qualifications = page.getByRole('region', { name: 'Job and crew qualifications' });
  await expect(qualifications).toContainText('Pilot (spacecraft)');
  await expect(qualifications).toContainText('Astrogation');
  await occupation.selectOption('12');
  await crew.click();
  await expect(role).toHaveText('Human · Jump navigator');

  await occupation.selectOption('15');
  await medic.click();
  await expect(role).toHaveText('Human · Ship’s medic');
  await occupation.selectOption('12');
  await expect(retained).toBeVisible();
  await expect(page.locator('#settings-feedback')).toContainText('Settings changed');
  await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  await expect(page.locator('#settings-feedback')).toContainText('Medic 2+');
  await expect(retained).toHaveText('Last successful roll. The current settings could not generate an NPC.');
  await expect(role).toHaveText('Human · Ship’s medic');

  await page.getByRole('button', { name: 'Clear skill minimums and roll', exact: true }).click();
  await expect(role).toContainText(/jump navigator/i);
  await expect(minimums).toBeHidden();
  await expect(retained).toBeHidden();
  await occupation.selectOption('11');
  await page.getByRole('button', { name: 'Next NPC', exact: true }).click();
  await expect(role).toContainText(/merchant pilot/i);
  await expect(status).toContainText('NPC 2 ready');
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
  await page.getByText('Generation settings', { exact: true }).click();
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
  await expect(page.locator('#referee-brief')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Referee record · JSON' })).toBeHidden();
  const name = await page.locator('#npc-name').innerText();
  await page.reload();
  await expect(page.locator('#npc-name')).toHaveText(name);
  await expect(page.getByRole('button', { name: 'Return to referee view' })).toBeVisible();
  await expect(page.locator('#referee')).toBeHidden();
  await expect(page.locator('#referee-brief')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Keep NPC' })).toBeHidden();
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Introduction · TXT' }).click();
  const intro = await readFile(await (await waiting).path(), 'utf8');
  expect(intro.trim()).toBe(await page.locator('#npc-intro').innerText());
  expect(intro).not.toMatch(/Referee-only relationship|private favor|seed/i);
  await page.getByRole('button', { name: 'Return to referee view' }).click();
  await expect(page.locator('#referee')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a player handout opens in another browser session with only opted-in facts', async ({ page, browser }) => {
  await captureClipboard(page);
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByLabel('Species profile').selectOption('human');
  await page.getByText('Campaign, age and identity', { exact: true }).click();
  await page.getByLabel('Common name', { exact: true }).fill('Éla Vár');
  await page.getByText('Advanced referee facts', { exact: true }).click();
  await page.getByLabel('Campaign options in JSON').fill(JSON.stringify({ partyRelationship: {
    target: { name: savedFixture }, role: 'Contact', cause: 'A past job', consequence: 'A private favor',
  } }));
  await page.getByText('Required skills and characteristics', { exact: true }).click();
  await page.getByRole('button', { name: 'Medic 2 hiring' }).click();
  await expect(page.locator('#npc-name')).toHaveText('Éla Vár');
  const brief = page.getByRole('region', { name: 'Referee quick reference' });
  await expect(brief).toContainText(/Medic [23]/);
  await expect(brief).toContainText('Seeking work or between positions');

  const quickLink = await copyPlayerLink(page);
  await page.getByRole('button', { name: 'Share handout' }).click();
  const share = page.getByRole('dialog', { name: 'Player handout' });
  const open = share.getByRole('link', { name: 'Open handout' });
  await expect(open).toHaveAttribute('href', quickLink);
  const handoutData = async () => handoutPayload((await open.getAttribute('href'))!);
  expect(Object.keys(await handoutData()).sort()).toEqual(['introduction', 'name', 'portrait', 'role', 'species', 'version']);
  await share.getByLabel('Qualifications', { exact: true }).check();
  await share.getByLabel('Availability', { exact: true }).check();
  await share.getByLabel('Pay offer (optional)', { exact: true }).fill('Cr4,000 per month');
  const data = await handoutData();
  expect(Object.keys(data).sort()).toEqual(['availability', 'introduction', 'name', 'pay', 'portrait', 'qualifications', 'role', 'species', 'version']);
  expect(data.qualifications).toEqual([['Medic', expect.any(Number)]]);
  expect(JSON.stringify(data)).not.toMatch(/Referee-only relationship|private favor|seed/i);
  const optedInLink = (await open.getAttribute('href'))!;
  await share.getByRole('button', { name: 'Close' }).click();
  expect(await copyPlayerLink(page)).toBe(quickLink);

  const recipient = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const handout = await recipient.newPage();
    await routeHeaderAssets(handout);
    await handout.goto(optedInLink);
    await expect(handout.getByRole('heading', { name: 'Éla Vár' })).toBeVisible();
    await expect(handout.locator('#handout-plate img')).toBeVisible();
    await expect(handout.locator('#handout-facts')).toContainText('Cr4,000 per month');
    await expect(handout.locator('#handout-facts')).toContainText(/Medic [23]/);
    await expect(handout.locator('#handout-facts')).toContainText('Seeking work or between positions');
    expect(await handout.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tedt-traveller-')))).toEqual([]);
    await handout.reload();
    await expect(handout.getByRole('heading', { name: 'Éla Vár' })).toBeVisible();
    await expect(handout.getByRole('region', { name: 'Referee quick reference' })).toBeHidden();
    await handout.emulateMedia({ media: 'print' });
    await expect(handout.getByRole('button', { name: 'Print or save as PDF' })).toBeHidden();
    await expect(handout.getByRole('heading', { name: 'Éla Vár' })).toHaveCSS('color', 'rgb(12, 15, 20)');
    await expect(handout.locator('#handout-plate img')).toBeVisible();
    await handout.goto(new URL(url + '#handout=%', handout.url()).href);
    await expect(handout.getByRole('heading', { name: 'Handout link is incomplete or invalid.' })).toBeVisible();
    await expect(handout.locator('#generator')).toBeHidden();
  } finally { await recipient.close(); }
});

test('Copy Player Link selects the short handout URL when clipboard access is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } },
    });
  });
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByRole('button', { name: 'Copy Player Link', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Player handout' });
  await expect(dialog.getByRole('status')).toHaveText('Copy the selected handout link.');
  const link = dialog.getByRole('textbox', { name: 'Handout link' });
  await expect(link).toBeFocused();
  expect(await link.evaluate((input: HTMLInputElement) => input.selectionStart === 0 && input.selectionEnd === input.value.length)).toBe(true);
  expect(handoutPayload(await link.inputValue()).introduction).toBe(await page.locator('#npc-intro').innerText());
});

test('mobile rolls keep the card in view and show the patron job above the dossier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  const encounter = page.getByRole('region', { name: 'Encounter card' });
  await expect(encounter.getByRole('heading', { name: 'Encounter card' })).toBeInViewport();
  await expect(page.getByLabel('Seed', { exact: true })).toBeHidden();
  await encounter.getByRole('button', { name: 'Next NPC' }).click();
  await expect(page.locator('#status')).toContainText('NPC 2 ready');
  await expect(encounter).toBeFocused();
  await page.getByText('Generation settings', { exact: true }).click();
  await page.getByLabel('Encounter context').selectOption('patron');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(encounter).toBeFocused();
  await expect(page.getByLabel('Encounter context')).toBeHidden();
  const brief = page.getByRole('region', { name: 'Referee quick reference' });
  for (const field of ['Request', 'Offer', 'Complication']) await expect(brief.locator('dt', { hasText: field })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the field guide searches all profiles and rolls from both generator rulesets', async ({ page }) => {
  await page.goto(url + '#species-guide');
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  const guide = page.getByRole('region', { name: 'Species field guide' });
  const search = guide.getByLabel('Find a species or source');
  await search.fill('hiver aliens');
  await expect(guide.getByText('1 entry found', { exact: true })).toBeVisible();
  await expect(guide.getByRole('img', { name: /Hiver/ })).toBeVisible();
  await guide.getByRole('button', { name: 'Roll NPC for Hiver' }).click();
  await expect(page.locator('#npc-role')).toContainText('Hiver');
  await expect(page.locator('#encounter')).toBeFocused();

  await search.fill('ganmeid');
  await guide.getByRole('button', { name: 'Roll encounter for Ganmeid' }).click();
  await expect(page.locator('#npc-role')).toHaveText('Ganmeid · Encounter');
  const brief = page.getByRole('region', { name: 'Referee quick reference' });
  await expect(brief).toContainText('Hits24');
  await expect(brief).toContainText('Movement12 m swimming');

  await search.fill('chirper');
  await expect(guide.getByRole('img', { name: /Chirper/ })).toBeVisible();
  await expect(guide.getByRole('button', { name: /^Roll/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Player view', exact: true }).click();
  await search.fill('hiver');
  await expect(guide.getByRole('img', { name: /Hiver/ })).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Roll NPC for Hiver' })).toBeHidden();
});

test('the campaign roster recalls exact rolls and keeps distinct builds at the same seed and index', async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByLabel('Species profile').selectOption('human');
  await page.getByText('Campaign, age and identity', { exact: true }).click();
  const name = page.getByLabel('Common name', { exact: true });
  const occupation = page.getByRole('combobox', { name: 'Occupation', exact: true });
  const keep = page.getByRole('button', { name: 'Keep NPC' });
  const activeRecord = () => page.evaluate(() => JSON.parse(localStorage.getItem('tedt-traveller-npc-v1')!));
  await name.fill('Veda Pike');
  await occupation.selectOption('12');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#npc-name')).toHaveText('Veda Pike');
  await page.getByText('Locks and rerolls', { exact: true }).click();
  await page.getByLabel('Lock STR', { exact: true }).check();
  const navigator = await activeRecord();
  await keep.click();
  await expect(page.locator('#card-feedback')).toContainText('Veda Pike is in the campaign roster');
  await keep.click();

  await name.fill('Rai Sen');
  await occupation.selectOption('11');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#npc-name')).toHaveText('Rai Sen');
  expect((await activeRecord()).id).toBe(navigator.id);
  await keep.click();
  await expect(page.locator('#card-feedback')).toContainText('Rai Sen is in the campaign roster');
  await page.getByRole('button', { name: 'Next NPC' }).click();
  await expect(page.locator('#status')).toContainText('NPC 2 ready');
  await page.reload();
  await expect(page.locator('#status')).toContainText('Restored NPC 2');
  await page.getByRole('button', { name: 'Campaign roster' }).click();
  const roster = page.getByRole('dialog', { name: 'Campaign roster' });
  await expect(roster.getByRole('listitem')).toHaveCount(2);
  await roster.getByRole('button', { name: 'Open Veda Pike' }).click();
  await expect(roster).toBeHidden();
  await expect(page.locator('#status')).toContainText('Opened Veda Pike from the roster');
  expect(await activeRecord()).toEqual(navigator);
  await page.getByRole('button', { name: 'Campaign roster' }).click();
  page.once('dialog', confirmation => confirmation.accept());
  await roster.getByRole('button', { name: 'Remove Rai Sen' }).click();
  await expect(roster.getByRole('listitem')).toHaveCount(1);
});

test('Group Encounter rolls a scene-filtered team and keeps the group intact when opening a member', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const status = page.locator('#status');
  await expect(status).toContainText('NPC 1 ready');
  const originalNpc = await page.locator('#npc-name').innerText();
  const groupMode = page.getByRole('button', { name: 'Group Encounter', exact: true });
  await groupMode.click();
  await expect(status).toContainText('Group 1 ready');
  const settings = page.getByRole('region', { name: 'Group encounter settings' });
  await settings.getByText('Group encounter settings', { exact: true }).click();
  const types = settings.getByRole('combobox', { name: 'Group type', exact: true });
  await expect(types.locator('option')).toHaveCount(19);
  await settings.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('space');
  await expect(types.locator('option[value="hunt"]')).toHaveCount(0);
  await types.selectOption('naval');
  await settings.getByRole('combobox', { name: 'Member species' }).selectOption('human');
  await settings.getByRole('button', { name: 'Roll group' }).click();
  await expect(status).toContainText('Naval inspection or boarding detail');
  await expect(page.locator('#encounter')).toBeFocused();
  await expect(types).toBeHidden();
  const group = await page.evaluate(() => JSON.parse(localStorage.getItem('tedt-traveller-group-v1')!));
  const brief = page.getByRole('region', { name: 'Referee quick reference' });
  await expect(brief).toContainText(group.purpose);
  await expect(brief).toContainText(group.affiliation);
  await expect(brief).toContainText(group.reaction.attitude);
  const members = page.getByRole('list', { name: 'Leader and specialists' });
  await expect(members.getByRole('listitem')).toHaveCount(group.members.length);
  await expect(members.locator('[data-group-member="leader"]')).toContainText('Detail officer');
  expect(group.size).toBe(group.members.length + group.others.count);
  const lead = group.members[0].npc.player.name;

  await page.getByRole('button', { name: 'Keep group' }).click();
  await expect(page.locator('#card-feedback')).toContainText('is in the campaign roster');
  await page.getByRole('button', { name: 'Single NPC', exact: true }).click();
  await expect(page.locator('#npc-name')).toHaveText(originalNpc);
  await groupMode.click();
  await page.getByRole('button', { name: 'Open NPC record for ' + lead, exact: true }).click();
  await expect(page.locator('#npc-name')).toHaveText(lead);
  await expect(page.locator('#referee')).toBeVisible();
  await page.getByText('Locks and rerolls', { exact: true }).click();
  await page.getByLabel('Lock STR', { exact: true }).check();
  await groupMode.click();

  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Referee record · JSON' }).click();
  const saved = await readFile(await (await waiting).path());
  expect(JSON.parse(saved.toString())).toEqual(group);
  await page.getByRole('button', { name: 'Next group' }).click();
  await expect(status).toContainText('Group 2 ready');
  await page.getByRole('button', { name: 'Campaign roster' }).click();
  const roster = page.getByRole('dialog', { name: 'Campaign roster' });
  await roster.getByRole('button', { name: 'Open Naval inspection or boarding detail led by ' + lead }).click();
  await expect(status).toContainText('Opened Naval inspection or boarding detail from the roster');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tedt-traveller-group-v1')!))).toEqual(group);
  await page.getByRole('button', { name: 'Next group' }).click();
  await expect(status).toContainText('Group 2 ready');
  await settings.getByText('Group encounter settings', { exact: true }).click();
  await settings.getByText('Open a saved group', { exact: true }).click();
  await settings.getByLabel('Saved group JSON').setInputFiles({ name: 'referee.json', mimeType: 'application/json', buffer: saved });
  await expect(status).toHaveText('Opened Naval inspection or boarding detail.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tedt-traveller-group-v1')!))).toEqual(group);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('group handouts preserve the visible encounter and leave the referee facts private', async ({ page, browser }) => {
  await captureClipboard(page);
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByRole('button', { name: 'Group Encounter', exact: true }).click();
  await expect(page.locator('#status')).toContainText('Group 1 ready');
  await page.getByRole('combobox', { name: 'Group type', exact: true }).selectOption('smugglers');
  await page.getByRole('button', { name: 'Roll group' }).click();
  await expect(page.locator('#npc-name')).toHaveText('Portside associates');
  const group = await page.evaluate(() => JSON.parse(localStorage.getItem('tedt-traveller-group-v1')!));
  await page.getByRole('button', { name: 'Referee link', exact: true }).click();
  const refereeDialog = page.getByRole('dialog', { name: 'Referee link' });
  const refereeHref = await refereeDialog.getByLabel('Encounter URL').inputValue();
  expect(new URL(refereeHref).hash).toMatch(/^#r1=[A-Za-z0-9_-]+$/);
  expect(refereeHref.length).toBeLessThan(300);
  await refereeDialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Share handout' }).click();
  const handoutDialog = page.getByRole('dialog', { name: 'Player handout' });
  const href = (await handoutDialog.getByRole('link', { name: 'Open handout' }).getAttribute('href'))!;
  await handoutDialog.getByRole('button', { name: 'Close' }).click();
  expect(await copyPlayerLink(page)).toBe(href);
  const data = handoutPayload(href);
  expect(Object.keys(data).sort()).toEqual(['introduction', 'kind', 'name', 'portrait', 'role', 'version']);
  expect(data.introduction).toBe(group.player.introduction);
  expect(JSON.stringify(data)).not.toContain(group.affiliation);
  expect(JSON.stringify(data)).not.toContain(group.purpose);
  await page.getByRole('button', { name: 'Player view', exact: true }).click();
  await page.reload();
  await expect(page.locator('#npc-name')).toHaveText('Portside associates');
  await expect(page.locator('#group-referee')).toBeHidden();
  await expect(page.locator('#referee-brief')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Referee link', exact: true })).toBeHidden();

  const recipient = await browser.newContext();
  try {
    const reader = await recipient.newPage();
    await routeHeaderAssets(reader);
    await reader.goto(refereeHref);
    await expect(reader.locator('#status')).toContainText('Restored Group 1');
    await expect(reader.locator('#brief-content')).toContainText(group.purpose);
    await expect(reader.locator('#brief-content')).toContainText(group.affiliation);
    await expect(reader.locator('[data-group-member="leader"] h3')).toHaveText(group.members[0].npc.player.name);
    expect(await reader.evaluate(() => localStorage.getItem('tedt-traveller-group-v1'))).toBeNull();
    await reader.goto(href);
    await expect(reader.getByRole('heading', { name: 'Portside associates' })).toBeVisible();
    await expect(reader.locator('#handout-intro')).toHaveText(group.player.introduction);
    await expect(reader.locator('#handout-plate img')).toBeVisible();
    await expect(reader.locator('#generator')).toBeHidden();
  } finally { await recipient.close(); }
});

test('referee links restore a character in a fresh browser without making it the default save', async ({ page, browser }) => {
  await page.goto(url);
  await expect(page.locator('#status')).toContainText('NPC 1 ready');
  await page.getByText('Campaign, age and identity', { exact: true }).click();
  await page.getByLabel('Common name', { exact: true }).fill('Éla & Vár');
  await page.getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#npc-name')).toHaveText('Éla & Vár');
  await page.getByText('Locks and rerolls', { exact: true }).click();
  await page.getByLabel('Lock STR', { exact: true }).check();
  await page.getByRole('button', { name: 'Referee link', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Referee link' });
  const href = await dialog.getByLabel('Encounter URL').inputValue();
  expect(new URL(href).hash).toMatch(/^#r1=[A-Za-z0-9_-]+$/);
  expect(href.length).toBeLessThan(350);
  await dialog.getByRole('button', { name: 'Use in address bar' }).click();
  await expect(page).toHaveURL(href);
  await dialog.getByRole('button', { name: 'Close' }).click();

  const recipient = await browser.newContext();
  try {
    const receiver = await recipient.newPage();
    await routeHeaderAssets(receiver);
    await receiver.goto(href);
    await expect(receiver.locator('#status')).toContainText('Restored NPC 1 · Éla & Vár');
    await expect(receiver.locator('#npc-name')).toHaveText('Éla & Vár');
    await receiver.getByText('Locks and rerolls', { exact: true }).click();
    await expect(receiver.getByLabel('Lock STR', { exact: true })).toBeChecked();
    expect(await receiver.evaluate(() => localStorage.getItem('tedt-traveller-npc-v1'))).toBeNull();
    await receiver.getByRole('button', { name: 'Next NPC' }).click();
    await expect(receiver.locator('#status')).toContainText('NPC 2 ready');
    expect(new URL(receiver.url()).hash).toBe('');
  } finally { await recipient.close(); }
});
