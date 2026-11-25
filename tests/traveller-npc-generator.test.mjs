import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { characterSheet, characterSheetEdits, obtainableCash, rolledCharacterSheet, setCharacterSheet } from '../tool-src/tools/traveller-npc-generator/character-sheet.mjs';
import { encounterSpecies } from '../tool-src/tools/traveller-npc-generator/encounter-species.mjs';
import { generateNpc, rerollNpc, restoreNpc, setLock } from '../tool-src/tools/traveller-npc-generator/generator.mjs';
import { generateGroup, restoreGroup, setMemberSheet } from '../tool-src/tools/traveller-npc-generator/group-encounters.mjs';
import { groupTypes } from '../tool-src/tools/traveller-npc-generator/group-types.mjs';
import { handoutUrl, readHandout } from '../tool-src/tools/traveller-npc-generator/handout.mjs';
import { decodeLinkPayload, encodeLinkPayload } from '../tool-src/tools/traveller-npc-generator/link-payload.mjs';
import { dm, rating, taskCheck } from '../tool-src/tools/traveller-npc-generator/mechanics.mjs';
import { imperialNameCounts, nameStyles } from '../tool-src/tools/traveller-npc-generator/names.mjs';
import { streams } from '../tool-src/tools/traveller-npc-generator/random.mjs';
import { readRefereeLink, recordInputs, refereeLink } from '../tool-src/tools/traveller-npc-generator/record-links.mjs';
import { portraitFor } from '../tool-src/tools/traveller-npc-generator/species-art.mjs';
import { referenceGroups } from '../tool-src/tools/traveller-npc-generator/species-reference.mjs';
import { species } from '../tool-src/tools/traveller-npc-generator/species.mjs';
import { occupationTable, packs, version } from '../tool-src/tools/traveller-npc-generator/tables.mjs';
import { fieldsFor } from '../tool-src/tools/traveller-npc-generator/work.mjs';

const make = (config = {}, state = {}) => generateNpc(config, { seed: 'sketch-82', ...state });

test('the character sheet projects the roll and preserves tracking edits through referee links', async () => {
  const npc = await make({
    species: 'vargr-extents', homeworld: 'Regina', homeworlds: [{ name: 'Regina', uwp: 'A788899-C' }],
    psion: { mode: 'latent', potential: 5, current: 0 }, funds: 700,
  });
  const starting = rolledCharacterSheet(npc);
  assert.equal(starting.charName, npc.player.name);
  assert.equal(starting.homeworldUWP, 'A788899-C');
  assert.equal(starting.cashOnHand, '700');
  assert.equal(starting.characteristics.cha.current, npc.mechanics.characteristics.CHA.current);
  assert.equal(starting.characteristics.chr, undefined);
  assert.equal(starting.characteristics.psi.current, 0);
  assert.deepEqual(characterSheetEdits(npc, starting), {});
  const supplement = {
    rads: '20', characteristics: { end: { current: null }, mrl: { current: 3, baseline: 8 },
      lck: { current: 0 }, sty: { current: 9 }, chr: { baseline: 6 }, std: { current: 5 }, wlt: { current: 0, baseline: 15 } },
    skills: [{ name: 'Gun Combat', specialization: 'slug', level: '1' }],
    trainingSkills: [{ skill: 'Medic', specialization: '', weeksSpent: '2', weeksTotal: '8' }],
    preCareerOptions: [{ type: 'University', years: '4', outcome: 'Graduate', benefits: 'Medic 0' }],
    careers: [{ career: 'Merchant', assignment: 'Free Trader', promotions: '2', years: '8', rank: 'First Officer', benefits: 'Ship share' }],
    weapons: [{ name: 'Cutlass', tl: '2', skill: 'Melee (blade)', damage: '3D', range: 'Melee', weight: '1 kg', magazine: '—' }],
    armor: [{ name: 'Vacc Suit', rating: '4', tl: '8', radiation: '10' }],
    augments: [{ type: 'Reflex implant', tl: '12', improvement: 'DEX +1' }],
    equipment: [{ name: 'Medkit', tl: '9–12', mass: '2 kg', cost: '800', quantity: '2', equipped: 'yes', gearNotes: 'One spare' }],
    credits: '1200', cashOnHand: '610', pension: '0', livingCosts: '240', shipPayments: '450', shipCosts: '70',
    debt: '1000', financialNotes: 'Private debt', notes: 'Private character history',
  };
  const edits = characterSheetEdits(npc, supplement);
  setCharacterSheet(npc, edits);
  const href = refereeLink('https://tools.tedt.org/traveller-npc-generator.html', npc);
  const restored = await restoreNpc(readRefereeLink(new URL(href).hash));
  assert.deepEqual(restored, npc);
  const sheet = characterSheet(restored);
  assert.equal(sheet.characteristics.end.current, null);
  assert.equal(sheet.characteristics.end.baseline, starting.characteristics.end.baseline);
  assert.equal(sheet.characteristics.lck.current, 0);
  assert.equal(obtainableCash(sheet.characteristics.wlt.current), 'Cr 0');
  assert.equal(obtainableCash(sheet.characteristics.wlt.baseline), 'Cr 20,000');
  for (const [key, value] of Object.entries(edits).filter(([key]) => key !== 'characteristics')) assert.deepEqual(sheet[key], value);
  assert.deepEqual((await rerollNpc(restored, ['name'])).controls.characterSheet, edits);
  const handout = JSON.stringify(readHandout(new URL(handoutUrl(href, restored)).hash));
  assert.ok(!handout.includes('Private character history'));
  assert.ok(!handout.includes('Private debt'));

  const published = rolledCharacterSheet(await make({ species: 'ganmeid' }));
  assert.deepEqual(published.characteristics, {});
  assert.equal(published.upp, '');
  assert.ok(published.skills.some(skill => skill.name === 'Athletics' && skill.specialization === 'dexterity'));
  assert.ok(published.weapons.some(attack => attack.name === 'Bite' && attack.damage === '1D+3'));
});

test('group referee links restore the edited sheets for the matching members', async () => {
  const group = await generateGroup({ type: 'naval' }, { seed: 'group-sheets' });
  const lead = group.members[0].npc;
  setMemberSheet(group, lead, { notes: 'Group leader notes' });
  const serialized = JSON.parse(JSON.stringify(group));
  assert.deepEqual(await restoreGroup(serialized), group);
  const href = refereeLink('https://tools.tedt.org/traveller-npc-generator.html', group);
  const restored = await restoreGroup(readRefereeLink(new URL(href).hash));
  assert.deepEqual(restored, group);
  assert.equal(characterSheet(restored.members[0].npc).notes, 'Group leader notes');
  assert.ok(restored.members.slice(1).every(({ npc }) => !npc.controls.characterSheet));
  setMemberSheet(restored, restored.members[0].npc, {});
  assert.equal(restored.controls.memberSheets, undefined);
});

test('selected Traveller 2E characteristics use separate rolls and known career adjustments', async () => {
  const config = { species: 'human', age: 38, occupation: '11' };
  const baseline = await make(config);
  const npc = await make({
    ...config, additionalCharacteristics: ['WLT', 'MRL', 'LCK', 'STY', 'CHR', 'PSI', 'STD'],
    careerAdjustments: { militaryTerms: 2, disciplinedTerms: 3, psiTerms: 5, cashBenefits: 20, injuredCareers: 1, anagathics: true },
  });
  const stats = npc.mechanics.characteristics;
  assert.equal(npc.player.name, baseline.player.name);
  assert.deepEqual(npc.work, baseline.work);
  assert.equal(npc.mechanics.upp, baseline.mechanics.upp);
  for (const [stat, value] of Object.entries(baseline.mechanics.characteristics)) assert.deepEqual(stats[stat], value);
  for (const stat of ['MRL', 'LCK', 'STY', 'CHR', 'PSI']) {
    const dice = npc.provenance.rolls.filter(roll => roll.field === 'stat.' + stat && roll.dice === 'd6');
    assert.equal(dice.length, 2, stat);
    assert.equal(stats[stat].raw, dice.reduce((sum, die) => sum + die.result, 0));
  }
  assert.equal(stats.MRL.current, Math.min(15, stats.MRL.raw + 3));
  for (const stat of ['LCK', 'STY', 'CHR']) assert.equal(stats[stat].current, stats[stat].raw);
  assert.equal(stats.PSI.current, Math.max(0, stats.PSI.raw - 5));
  assert.equal(npc.abilities.psion.mode, 'tested');
  assert.deepEqual(npc.abilities.psion.talents, []);
  assert.equal(stats.STD.current, stats.SOC.current);
  assert.equal(stats.WLT.raw, stats.SOC.baseline);
  assert.equal(stats.WLT.current, 11);
  for (const stat of npc.controls.config.additionalCharacteristics) {
    assert.equal(characterSheet(npc).characteristics[stat.toLowerCase()].current, stats[stat].current);
  }
  const href = refereeLink('https://tools.tedt.org/traveller-npc-generator.html', npc);
  assert.deepEqual(await restoreNpc(readRefereeLink(new URL(href).hash)), npc);

  npc.controls.locks = setLock(npc, 'stat.MRL', true);
  assert.equal((await rerollNpc(npc, ['stat.LCK'])).mechanics.characteristics.MRL.current, stats.MRL.current);
  const noSocial = await make({ species: 'vargr-extents', additionalCharacteristics: ['STD', 'CHR', 'WLT'] });
  assert.ok(noSocial.mechanics.characteristics.CHA && noSocial.mechanics.characteristics.CHR);
  assert.equal(noSocial.mechanics.characteristics.WLT, undefined);
  assert.equal(noSocial.mechanics.characteristics.STD, undefined);
  const noPotential = await make({ ...config, additionalCharacteristics: ['PSI'], careerAdjustments: { psiTerms: 12 } });
  assert.equal(noPotential.mechanics.characteristics.PSI.current, 0);
  const droyne = { species: 'droyne', profileOptions: { adultForm: 'Worker' } };
  const ordinaryDroyne = await make(droyne);
  const extraDroyne = await make({ ...droyne, additionalCharacteristics: ['PSI'], careerAdjustments: { psiTerms: 5 } });
  assert.deepEqual(extraDroyne.mechanics.characteristics.PSI, ordinaryDroyne.mechanics.characteristics.PSI);
});

test('group members inherit chosen additional characteristics through a referee link', async () => {
  const config = { type: 'naval', species: 'human' };
  const state = { seed: 'group-additional' };
  const original = await generateGroup(config, state);
  const group = await generateGroup({ ...config, additionalCharacteristics: ['MRL', 'WLT'] }, state);
  assert.deepEqual(group.provenance, original.provenance);
  assert.deepEqual(group.player, original.player);
  for (const { npc } of group.members) {
    assert.ok(npc.mechanics.characteristics.MRL);
    assert.equal(npc.mechanics.characteristics.WLT.current, npc.mechanics.characteristics.SOC.baseline);
    assert.equal(npc.mechanics.characteristics.LCK, undefined);
  }
  const href = refereeLink('https://tools.tedt.org/traveller-npc-generator.html', group);
  assert.deepEqual(await restoreGroup(readRefereeLink(new URL(href).hash)), group);
});

test('group templates roll the shared encounter before building all named roles with 2E profiles', async () => {
  assert.equal(Object.keys(groupTypes).length, 18);
  for (const [type, template] of Object.entries(groupTypes)) {
    const group = await generateGroup({ type }, { seed: 'group-template-check' });
    assert.equal(group.type, template.name);
    assert.ok(group.size >= template.size[0] && group.size <= template.size[1]);
    assert.ok(template.purposes.includes(group.purpose));
    assert.ok(template.affiliations.includes(group.affiliation));
    assert.deepEqual([...new Set(group.provenance.rolls.map(roll => roll.field))].slice(-4),
      ['group.size', 'group.purpose', 'group.affiliation', 'group.reaction']);
    assert.equal(group.reaction.dice.length, 2);
    assert.equal(group.reaction.total, group.reaction.dice[0] + group.reaction.dice[1]);
    assert.equal(group.members[0].leader, true);
    assert.equal(group.members.filter(member => member.leader).length, 1);
    assert.equal(group.members.length, Math.min(group.size, template.roles.length));
    assert.equal(group.members.length + group.others.count, group.size);
    assert.equal(new Set(group.members.map(({ npc }) => npc.id)).size, group.members.length);
    for (const { npc, position } of group.members) {
      assert.equal(npc.validity.mechanical.status, 'valid');
      assert.equal(npc.work.employment.affiliation, group.affiliation);
      assert.equal(npc.story.attitude, group.reaction.attitude);
      assert.equal(npc.work.occupation.id, template.roles.find(role => role[0] === position)[1]);
    }
  }
});

test('group rolls replay exactly, filter by scene and respect species restrictions', async () => {
  const input = { scene: 'space', type: 'naval', species: 'hiver' };
  const state = { seed: 'group-replay', index: 3 };
  const group = await generateGroup(input, state);
  assert.ok(group.members.every(member => member.npc.biology.profileId === 'hiver'));
  assert.equal(group.members[0].npc.work.occupation.id, '44');
  assert.ok(group.members.every(({ npc }) => rating(npc.mechanics.skills, 'Leadership') === null));
  assert.deepEqual(await restoreGroup(JSON.parse(JSON.stringify(group))), group);
  assert.deepEqual(await generateGroup(input, state), group);
  assert.notEqual((await generateGroup(input, { ...state, index: 4 })).id, group.id);
  for (let index = 1; index <= 8; index++) {
    const frontier = await generateGroup({ scene: 'frontier' }, { seed: 'group-scenes', index });
    assert.equal(frontier.scene, 'frontier');
    assert.ok(groupTypes[frontier.typeId].scenes.includes('frontier'));
  }
  await assert.rejects(generateGroup({ scene: 'urban', type: 'hunt' }, state), /Group type has an unsupported value/);
});

function legacyRefereeHash(record, kind) {
  const { seed, index, version, npcVersion, packs, rerollCounters } = record.provenance;
  const { config, locks, rollLocks } = record.controls;
  const variables = new URLSearchParams({
    record: kind,
    seed, index: String(index), id: record.id, version, settings: JSON.stringify(config), packs: JSON.stringify(packs),
  });
  if (npcVersion) variables.set('npcVersion', npcVersion);
  for (const [key, value] of Object.entries({ rerollCounters, locks, rollLocks })) {
    if (value !== undefined) variables.set(key, JSON.stringify(value));
  }
  return '#' + variables.toString();
}

test('short referee URLs replay the same records and open previously shared links', async () => {
  const npc = await make({ species: 'human', occupation: '12', identity: { commonName: 'Éla & Vár' } },
    { seed: 'Rain + shift / 3 🪐', index: 7 });
  const rerolled = await rerollNpc(npc, ['detail']);
  rerolled.controls.locks = setLock(rerolled, 'stat.STR', true);
  const group = await generateGroup({ scene: 'starport', type: 'dock' }, { seed: 'Saved group', index: 2 });
  const legacy = await make({}, { namingPack: 'imperial-common/1' });
  for (const [record, restore, kind] of [[rerolled, restoreNpc, 'npc'], [group, restoreGroup, 'group'], [legacy, restoreNpc, 'npc']]) {
    const url = new URL(refereeLink('https://tools.tedt.org/traveller-npc-generator.html?old=1#species-guide', record));
    const previousHash = legacyRefereeHash(record, kind);
    assert.equal(url.search, '');
    assert.match(url.hash, /^#r1=[A-Za-z0-9_-]+$/);
    assert.ok(url.hash.length < previousHash.length / 2);
    assert.deepEqual(readRefereeLink(url.hash), JSON.parse(JSON.stringify(recordInputs(record))));
    assert.deepEqual(await restore(readRefereeLink(url.hash)), record);
    assert.deepEqual(await restore(readRefereeLink(previousHash)), record);
  }
  // A saved v1 link must keep working even if a future encoder changes.
  const savedV1 = '#r1=I7XhZGFobmCSnJqSbJ6WaGRmlmhkapaUnGZhNpr0B1_SR6Tu4uzUkuQMXQuQA0dbVqMtq9GW1WjLaqBaVgA';
  assert.deepEqual(await restoreNpc(readRefereeLink(savedV1)), await make());
  assert.throws(() => readRefereeLink('#record=invalid'), /unknown record type/);
  assert.throws(() => readRefereeLink('#record=npc&settings=%7B'), /invalid settings/);
  assert.throws(() => readRefereeLink('#r1=%20'), /invalid/);
  const hash = new URL(refereeLink('https://tools.tedt.org/traveller-npc-generator.html', rerolled)).hash;
  assert.throws(() => readRefereeLink(hash.slice(0, -10)), /invalid/);
});

test('short and legacy player handouts show the same player-facing details', async () => {
  const npc = await make({ species: 'human', occupation: '12', identity: { commonName: 'Éla & Vár' } });
  const group = await generateGroup({ species: 'human', type: 'rivals' }, { seed: 'Handout comparison' });
  for (const record of [npc, group]) {
    const hash = new URL(handoutUrl('https://tools.tedt.org/traveller-npc-generator.html', record)).hash;
    assert.match(hash, /^#h1=[A-Za-z0-9_-]+$/);
    const payload = decodeLinkPayload(hash.slice('#h1='.length), 150_000);
    const legacy = '#handout=' + encodeURIComponent(JSON.stringify(payload));
    assert.ok(hash.length < legacy.length);
    const decoded = readHandout(hash);
    assert.equal(decoded.name, record.player.name);
    assert.equal(decoded.introduction, record.player.introduction);
    assert.equal(decoded.portrait, 'human');
    assert.deepEqual(decoded, readHandout(legacy));
  }
  assert.equal(readHandout('#h1=%'), null);
});

test('the link codec preserves multibyte text across blocks and bounds inflated data', () => {
  const text = Array.from({ length: 256 }, (_, index) => createHash('sha256').update(String(index)).digest('hex')).join(' 🪐 ');
  const payload = encodeLinkPayload({ text }, 30_000);
  assert.ok(payload.length > 5500);
  assert.deepEqual(decodeLinkPayload(payload, 30_000), { text });
  assert.throws(() => decodeLinkPayload(payload, 4000), /too large/);
  assert.throws(() => encodeLinkPayload({ text }, 4000), /too large/);
});

test('the name pack keeps old saved names and isolates a new NPC name reroll', async () => {
  const legacy = await make({}, { namingPack: 'imperial-common/1' });
  assert.equal(legacy.identity.commonName, 'Kessa Dane');
  assert.equal(legacy.story.network.target.name, 'Aven Marr');
  assert.equal(legacy.controls.config.nameStyle, undefined);
  assert.deepEqual(await restoreNpc(JSON.parse(JSON.stringify(legacy))), legacy);
  const modern = await make();
  assert.deepEqual(modern.mechanics, legacy.mechanics);
  assert.equal(modern.story.network.target.occupation, legacy.story.network.target.occupation);
  assert.equal(modern.player.name, modern.identity.commonName);
  assert.ok(imperialNameCounts.personal > 144 && imperialNameCounts.family > 144);
  const rerolled = await rerollNpc(modern, ['name']);
  assert.notEqual(rerolled.player.name, modern.player.name);
  assert.deepEqual(rerolled.story.network, modern.story.network);
  assert.deepEqual(rerolled.mechanics, modern.mechanics);
});

test('name styles follow the profile and protect native names in player data', async () => {
  const hiver = await make({ species: 'hiver' });
  assert.equal(hiver.identity.naming.id, 'hiver');
  assert.match(hiver.identity.nativeName, /^\[Nest sign:/);
  assert.ok(!JSON.stringify(hiver.player).includes(hiver.identity.nativeName));
  const imperial = await make({ species: 'hiver', nameStyle: 'imperial', identity: { commonName: 'Ellis Vale', nativeName: 'Saved Sign' } });
  assert.equal(imperial.identity.commonName, 'Ellis Vale');
  assert.equal(imperial.identity.nativeName, 'Saved Sign');
  const zhodani = await make({ culture: 'zhodani', species: 'human', requiredCharacteristics: { SOC: 12 } });
  assert.equal(zhodani.identity.naming.id, 'zhodani');
  assert.match(zhodani.player.name, /(?:stebr|tlas|tlasche’|iashav)$/u);
  const adopted = await make({ nameStyle: 'zhodani', species: 'human', requiredCharacteristics: { SOC: 12 } });
  assert.match(adopted.player.name, / /);
  for (const key of Object.keys(nameStyles)) assert.ok((await make({ nameStyle: key })).player.name, key);
});

test('every built-in profile and illustrated reference has its own plate data and a shipped image', async () => {
  const artIds = [...Object.keys(species), ...Object.keys(encounterSpecies),
    ...referenceGroups.flatMap(group => group.entries.map(entry => entry.art).filter(Boolean))];
  for (const id of artIds) {
    const plate = portraitFor(id);
    assert.ok(plate?.description && plate?.source && plate?.comparison, id);
    await access(new URL('../tool-src/img/traveller-npc/' + plate.asset + '.webp', import.meta.url));
  }
});

test('published encounter blocks roll and restore without invented characteristics', async () => {
  const weeven = await make({ species: 'weeven', identity: { nativeName: 'Referee label' } });
  assert.equal(weeven.biology.profileId, 'weeven');
  const hitRolls = weeven.provenance.rolls.filter(roll => roll.field === 'encounter.hits').map(roll => roll.result);
  assert.equal(hitRolls.length, 3);
  assert.equal(weeven.encounter.hits, 30 + hitRolls.reduce((a, b) => a + b, 0));
  assert.equal(weeven.encounter.protection, 10);
  assert.equal(weeven.mechanics, undefined);
  assert.doesNotMatch(weeven.player.introduction, /Referee label/);
  const locked = { ...weeven, controls: { ...weeven.controls, locks: setLock(weeven, 'name', true) } };
  assert.deepEqual(await restoreNpc(JSON.parse(JSON.stringify(locked))), locked);
  await assert.rejects(() => make({ species: 'weeven', requiredCharacteristics: { INT: 3 } }), /published encounter block/);
  for (const [species, hits] of [['ganmeid', 24], ['bhuoovaakaylaa', 70], ['host-colony', null]]) {
    const profile = await make({ species });
    assert.equal(profile.encounter.hits, hits);
    assert.deepEqual((await rerollNpc(profile, ['name'])).encounter, profile.encounter);
  }
});

test('uncast Droyne use pre-casting dice while retaining wings and PSI', async () => {
  const npc = await make({ species: 'droyne-uncast', profileOptions: { wings: 'large' } });
  const { characteristics } = npc.mechanics;
  for (const stat of ['STR', 'DEX', 'END', 'INT', 'EDU']) {
    assert.ok(characteristics[stat].raw >= 2 && characteristics[stat].raw <= 7);
    assert.equal(characteristics[stat].adjustment, 0);
  }
  assert.ok(characteristics.PSI);
  assert.equal(npc.biology.wings, 'large');
  assert.equal(npc.abilities.innate.length, 0);
  assert.equal(rating(npc.mechanics.skills, 'Flight'), 0);
});

test('expanded profiles apply book-based characteristics and aquatic needs', async () => {
  const orca = await make({ species: 'orca', placement: { medium: 'water' } });
  assert.equal(orca.mechanics.characteristics.STR.adjustment, 8);
  assert.equal(orca.mechanics.characteristics.END.adjustment, 4);
  assert.ok(orca.validity.environment.missing.some(item => item.includes('surface')));
  const tenipal = await make({ species: 'tenipal' });
  assert.equal(tenipal.mechanics.characteristics.EDU.adjustment, -3);
  assert.equal(tenipal.derived.attacks[0].damage, '1D+2');
  const ithklur = await make({ species: 'ithklur' });
  assert.match(ithklur.mechanics.order.join(','), /RES$/);
  assert.equal(ithklur.derived.attacks[1].check.modifiers.at(-1).value, -2);
});

test('named streams follow the documented SHA-256 draw contract', async () => {
  const record = [];
  const rng = streams('pocket-universe', 3, { name: 2 }, record)('name', 'names');
  for (let i = 0; i < 2; i++) {
    const bytes = createHash('sha256')
      .update(JSON.stringify([version, 'pocket-universe', 3, 'name', packs.names, 2, i, 0])).digest();
    assert.equal(await rng.draw(6, 'Name die'), bytes.readUInt32BE() % 6 + 1);
    assert.equal(record[i].draw, i);
  }
});

test('every d66 row yields the intended role and a resolved specialty', async () => {
  assert.equal(new Set(occupationTable.map(row => row.id)).size, 36);
  for (const row of occupationTable) {
    const npc = await make({ species: 'human', occupation: row.id, competence: 'elite' });
    assert.equal(npc.work.occupation.title, row.title);
    if (row.field) assert.equal(npc.work.occupation.field, row.field);
    assert.equal(npc.work.occupation.slots.length, 4);
    assert.ok(npc.mechanics.skillTotal <= 8);
    assert.ok(npc.mechanics.grants.every(grant => !grant.skill.includes('(field)')));
  }
  assert.equal(fieldsFor(occupationTable.find(row => row.id === '52')).length, 5);
});

test('the draft worked example applies adjustments, specialties, and DMs once', async () => {
  const locks = Object.fromEntries([6, 9, 7, 9, 10, 6].map((score, i) =>
    ['stat.' + ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'][i], score]));
  const npc = await make({
    species: 'vargr', occupation: '13', competence: 'experienced', age: 38,
    identity: { commonName: 'Kessa Varr' }, homeworld: 'Regina', funds: 700,
  }, { locks: { ...locks, upbringing: 2, background: ['Athletics', 'Electronics'] } });
  assert.equal(npc.mechanics.upp, '6979A6');
  assert.deepEqual(Object.values(npc.mechanics.characteristics).map(stat => stat.raw), [7, 8, 8, 9, 10, 6]);
  assert.equal(rating(npc.mechanics.skills, 'Engineer (j-drive)'), 2);
  assert.equal(rating(npc.mechanics.skills, 'Engineer (power)'), 1);
  assert.equal(rating(npc.mechanics.skills, 'Engineer (life support)'), 0);
  assert.equal(rating(npc.mechanics.skills, 'Electronics'), 0);
  assert.equal(taskCheck(npc, 'Engineer (j-drive)', 'EDU').total, 3);
  assert.equal(npc.derived.attacks[0].check.skillDM, -3);
  assert.equal(taskCheck(npc, 'Recon', 'INT', { dark: true }).modifiers.reduce((sum, value) => sum + value.value, 0), 0);
  assert.deepEqual(npc.places.homeworld, { name: 'Regina', uwp: null, source: 'Referee' });
});

test('hiring conditions occupation, background familiarity and competence without promotion', async () => {
  for (const seed of ['applicant-a', 'applicant-b', 'applicant-c', 'applicant-d']) {
    const npc = await make({ context: 'hiring', requiredSkills: [{ skill: 'Medic', level: 2 }] }, { seed });
    assert.equal(npc.work.occupation.profile, 'medic');
    assert.ok(['experienced', 'elite'].includes(npc.work.competence.id));
    assert.equal(npc.work.employment.seeking, true);
    assert.equal(npc.validity.job.status, 'qualified');
    assert.ok(npc.provenance.rolls.some(roll => roll.field === 'competence' && roll.method === 'conditioned dice'));
  }
  const npc = await make({
    occupation: '42', competence: 'green', requiredSkills: [{ skill: 'Language', level: 0 }],
  });
  assert.ok(npc.culture.upbringing.skills.includes('Language'));
  assert.equal(rating(npc.mechanics.skills, 'Language'), 0);
  assert.equal(rating(npc.mechanics.skills, 'Medic'), 0);
  assert.equal(rating(npc.mechanics.skills, 'Astrogation'), null);
  await assert.rejects(() => make({ occupation: '42', requiredSkills: [{ skill: 'Medic', level: 3 }] }), /Medic 3\+/);
  await assert.rejects(() => make({ requiredSkills: [{ skill: 'Pilot', level: 1 }] }), /specialty/);
});

test('cross-training replaces support 3 and keeps the assigned rating', async () => {
  const config = { species: 'human', occupation: '13', secondary: '15' };
  const competent = await make({ ...config, competence: 'competent' });
  assert.equal(competent.work.secondary.rating, 0);
  assert.equal(rating(competent.mechanics.skills, 'Medic'), 0);
  assert.ok(!competent.mechanics.grants.some(grant => grant.skill === 'Mechanic' && grant.source.startsWith('Occupation')));
  const elite = await make({ ...config, competence: 'elite', requiredSkills: [{ skill: 'Medic', level: 1 }] });
  assert.equal(elite.work.secondary.rating, 1);
  assert.equal(rating(elite.mechanics.skills, 'Medic'), 1);
  await assert.rejects(() => make({ occupation: '13', secondary: 'engineer-power' }), /differ/);
});

test('each library adapter generates a living adult and round-trips at matching versions', async () => {
  for (const id of Object.keys(species)) {
    const npc = await make({ species: id });
    assert.equal(npc.biology.profileId, id);
    assert.equal(npc.biology.sophont, true);
    assert.equal(npc.biology.adult, true);
    assert.equal(npc.biology.living, true);
    assert.equal(npc.validity.mechanical.status, 'valid');
    assert.deepEqual(await restoreNpc(JSON.parse(JSON.stringify(npc))), npc);
  }
  const hiver = await make({ species: 'hiver' });
  assert.equal(hiver.mechanics.upp, null);
  assert.ok(hiver.mechanics.characteristics.RES.raw >= 7);
  assert.equal(taskCheck(hiver, 'Leadership', 'RES').available, false);
  const droyne = await make({ species: 'droyne', profileOptions: { adultForm: 'Drone', wings: 'large' } });
  assert.equal(droyne.mechanics.order.includes('SOC'), false);
  assert.equal(droyne.mechanics.characteristics.INT.adjustment, 3);
  assert.equal(rating(droyne.mechanics.skills, 'Flight'), 0);
  assert.deepEqual(droyne.abilities.innate.map(ability => ability.name), ['Invisibility', 'Homing', 'Link']);
  assert.ok(droyne.biology.age.years >= 12);
  await assert.rejects(() => make({ species: 'droyne', psion: { mode: 'off' } }), /requires PSI/);
  assert.equal(rating((await make({ species: 'whistler' })).mechanics.skills, 'Stealth'), 2);
});

test('population and wing rolls account for species grants before conditioning an occupation', async () => {
  const npc = await make({ occupation: '13', competence: 'green',
    population: { human: 100, aslan: 0, vargr: 0, droyne: 1 }, requiredSkills: [{ skill: 'Flight', level: 0 }] });
  assert.equal(npc.biology.profileId, 'droyne');
  assert.ok(['small', 'large'].includes(npc.biology.wings));
  assert.equal(rating(npc.mechanics.skills, 'Flight'), 0);
});

test('stat locks and age constraints keep their values or give a specific conflict', async () => {
  assert.equal(dm(25), 3);
  const npc = await make({ species: 'aslan', requiredCharacteristics: { STR: 14 } });
  assert.equal(npc.mechanics.characteristics.STR.raw, 12);
  assert.equal(npc.mechanics.characteristics.STR.current, 14);
  const lock = setLock(npc, 'stat.STR', true);
  await assert.rejects(() => make({ species: 'vargr' }, { locks: lock }), /STR locked at 14/);
  await assert.rejects(() => make({ species: 'human', age: 11 }), /adult profile/);
  const exact = await make({ species: 'human', requiredCharacteristics: { STR: 12 }, age: null, funds: 0 });
  assert.equal(exact.biology.age.years, null);
  assert.equal(exact.places.homeworld, null);
  assert.equal(exact.resources.portableFunds, 0);
});

test('saving with new locks and rerolling a cosmetic field preserve the earlier mechanics', async () => {
  const config = { requiredSkills: [{ skill: 'Language', level: 0 }] };
  const npc = await make(config);
  npc.controls.locks = setLock(npc, 'occupation', true);
  const restored = await restoreNpc(JSON.parse(JSON.stringify(npc)));
  assert.deepEqual(restored, npc);
  const changed = await rerollNpc(npc, ['name']);
  assert.equal(changed.id, npc.id);
  assert.deepEqual(changed.mechanics, npc.mechanics);
  assert.deepEqual(changed.culture, npc.culture);
  assert.deepEqual(changed.provenance.rerollCounters, { name: 1 });
  assert.deepEqual(changed.controls.locks, npc.controls.locks);
  assert.deepEqual(await restoreNpc(JSON.parse(JSON.stringify(changed))), changed);
});

test('optional abilities and sourced gear never create skill grants indirectly', async () => {
  const psion = await make({ occupation: 'psion', psion: { talent: 'Telepathy', current: 0 } });
  assert.equal(psion.abilities.psion.current, 0);
  assert.notEqual(psion.work.competence.id, 'green');
  assert.ok(rating(psion.mechanics.skills, 'Telepathy') > 0);
  assert.equal(taskCheck(psion, 'Teleportation', 'PSI').available, false);
  await assert.rejects(() => make({ occupation: 'psion', competence: 'green' }), /Competent or better/);
  const config = {
    species: 'human', occupation: '54', competence: 'green',
    placement: { current: 'Hull exterior', medium: 'vacuum', tl: 8 },
    gear: [{ catalogueId: 'he-vacc-9', owner: 'Borrowed', location: 'worn', access: 'immediate', fit: ['human'] }],
  };
  const equipped = await make(config);
  assert.equal(equipped.validity.environment.status, 'ready');
  assert.equal(equipped.equipment.at(-1).protection, 8);
  assert.equal(equipped.equipment.at(-1).trainingShortfall, 2);
  assert.equal(rating(equipped.mechanics.skills, 'Vacc Suit'), null);
  const changed = await make({ ...config, species: 'aslan' });
  assert.equal(changed.validity.environment.status, 'missing support');
  assert.equal(changed.equipment.at(-1).fitted, false);
  assert.equal(changed.validity.combat.status, 'incomplete');
});

test('clone details and active condition and augmentation effects remain independent', async () => {
  const npc = await make({
    species: 'human', occupation: '31', competence: 'green', lifeform: 'clone',
    clone: { donorId: 'donor', chronologicalAge: 23, biologicalAge: 33, memoryHistory: 'Partial memories' },
    augmentations: [{ id: '01', name: 'Reflex implant', source: 'Campaign', modifiers: { DEX: 2 } }],
    conditions: [{ id: '02', name: 'Wound', source: 'Prior session', characteristic: 'DEX', loss: 1 }],
  });
  const dex = npc.mechanics.characteristics.DEX;
  assert.equal(dex.current, dex.raw + 1);
  assert.equal(npc.biology.age.years, 23);
  assert.equal(npc.biology.clone.biologicalAge, 33);
  assert.equal(npc.mechanics.skillTotal, 0);
});

test('a patron mission and a reference to the party stay in the referee record', async () => {
  const npc = await make({
    context: 'patron', identity: { commonName: 'Kessa Varr' },
    partyRelationship: { role: 'Rival', target: { id: 'pc-1', name: 'Referee-only person' },
      cause: 'Shared contract', consequence: 'They know the port captain', status: 'proposed' },
  });
  assert.equal(npc.story.party.from, 'pc-1');
  assert.equal(npc.story.party.to, npc.id);
  assert.ok(npc.story.mission.outsideHelp);
  assert.equal(npc.story.party.status, 'proposed');
  assert.doesNotMatch(JSON.stringify(npc.player), /Referee-only|Shared contract|complication|provenance|portableFunds/);
});

test('Companion Boons keep the best two dice and respect incompatible profile models', async () => {
  const npc = await make({ species: 'human', characteristicBoons: ['STR'] });
  const rolls = npc.provenance.rolls.filter(roll => roll.field === 'stat.STR' && roll.dice === 'd6').map(roll => roll.result);
  assert.equal(rolls.length, 3);
  assert.equal(npc.mechanics.characteristics.STR.raw, rolls.reduce((a, b) => a + b, 0) - Math.min(...rolls));
  await assert.rejects(() => make({ species: 'hiver', characteristicBoons: ['RES'] }), /ordinary 2D for RES/);
});

test('referee-defined profiles carry their own biology, characteristic model and definition lock', async () => {
  const order = ['STR', 'DEX', 'END', 'INT', 'EDU', 'RES'];
  const customProfile = {
    name: 'Campaign sophont', source: 'Referee rules v1', living: true, sophont: true, order,
    body: 'Aquatic biped', movement: 'Swims', senses: 'Sonar', manipulators: 'Fins',
    communication: 'Acoustic signaling', needs: ['water'], age: { adult: 25, scale: 2 }, psionics: 'prohibited',
    characteristics: { ...Object.fromEntries(order.map(stat => [stat, { count: 2, sides: 6 }])),
      RES: { count: 1, sides: 3, add: 5, adjustment: 2, maximum: 9 } },
  };
  const config = { species: 'custom', customProfile, placement: { current: 'Dock', medium: 'breathable' } };
  const npc = await make(config);
  assert.deepEqual(npc.mechanics.order, order);
  assert.equal(npc.biology.source, customProfile.source);
  assert.equal(npc.culture.nativeCommunication, 'Acoustic signaling');
  assert.equal(npc.validity.environment.status, 'missing support');
  assert.equal(npc.mechanics.upp, null);
  assert.ok(npc.mechanics.characteristics.RES.current <= 9);
  assert.ok(npc.biology.age.years >= 25);
  npc.controls.locks = setLock(npc, 'species', true);
  assert.deepEqual(await restoreNpc(JSON.parse(JSON.stringify(npc))), npc);
  await assert.rejects(() => make({ ...config, customProfile: { ...customProfile, name: 'Another species' } },
    { locks: npc.controls.locks }), /locked referee species definition/);
});
