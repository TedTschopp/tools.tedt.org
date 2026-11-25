import { has, integer, object, requireRule, text } from './config.mjs';
import { optionalCharacteristics } from './optional-characteristics.mjs';

export const coreCharacteristics = {
  str: 'Strength', dex: 'Dexterity', end: 'Endurance', int: 'Intelligence', edu: 'Education', soc: 'Social Standing',
};
export const additionalCharacteristics = Object.fromEntries(Object.entries(optionalCharacteristics)
  .filter(([key]) => key !== 'WLT').map(([key, { name }]) => [key.toLowerCase(), name]));
export const speciesCharacteristics = { cha: 'Charisma (CHA)', res: 'Resolve (RES)', ter: 'Territory (TER)' };
const characteristicNames = { ...coreCharacteristics, ...additionalCharacteristics, ...speciesCharacteristics, wlt: 'Wealth Level' };
export const scoreFields = ['current', 'baseline'];
export const scoreLimits = key => key === 'wlt' ? [0, 15] : [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
// Traveller Companion, p. 3. WLT 0 supplies no spending cash.
const wealth = [0, 100, 200, 400, 800, 1200, 1500, 2000, 3000, 5000, 7500, 10000, 12500, 15000, 17500, 20000];
export function obtainableCash(score) {
  return wealth[score] == null ? '' : 'Cr ' + wealth[score].toLocaleString('en-US');
}

export const personalFields = [
  ['charName', 'Character name'], ['species', 'Species'], ['age', 'Age', 'count'],
  ['homeworld', 'Homeworld'], ['homeworldUWP', 'Homeworld UWP'], ['rads', 'Radiation dose (rads)', 'count'], ['upp', 'UPP'],
  ['playerName', 'Player name'], ['role', 'Role or title'], ['traits', 'Traits', 'notes'], ['condition', 'Conditions'],
];
export const financialFields = [
  ['credits', 'Credits (Cr)', 'money'], ['cashOnHand', 'Cash on hand (Cr)', 'money'], ['pension', 'Pension (Cr)', 'money'],
  ['livingCosts', 'Living costs (Cr)', 'money'], ['shipPayments', 'Ship payments (Cr)', 'money'],
  ['shipCosts', 'Ship costs (Cr)', 'money'], ['debt', 'Debt (Cr)', 'money'], ['financialNotes', 'Financial notes', 'notes'],
];
export const notesField = ['notes', 'Character notes', 'notes'];
const singleFields = [...personalFields, ...financialFields, notesField, ['background', 'Background', 'notes']];

const gearFields = [
  ['quantity', 'Quantity', 'quantity'], ['equipped', 'Equipped', 'equipped'], ['catalogueId', 'Catalog reference'],
  ['gearNotes', 'Item notes', 'notes'], ['carried', 'Carried', 'equipped'],
];
export const sheetSections = [
  ['Skills and training', [
    ['skills', 'Skills', [['name', 'Skill'], ['specialization', 'Specialization'], ['level', 'Level', 'integer'], ['modifier', 'Other DM', 'integer']]],
    ['trainingSkills', 'Training', [['skill', 'Skill'], ['specialization', 'Specialization'],
      ['weeksSpent', 'Weeks spent', 'count'], ['weeksTotal', 'Total weeks', 'count']]],
    ['psionics', 'Psionics and special abilities', [['name', 'Ability'], ['level', 'Level', 'integer'],
      ['cost', 'PSI cost', 'count'], ['target', 'Target', 'integer'], ['time', 'Time'], ['notes', 'Description', 'notes']]],
  ]],
  ['Education and careers', [
    ['preCareerOptions', 'Pre-career education', [['type', 'Option'], ['years', 'Years', 'count'],
      ['outcome', 'Outcome'], ['benefits', 'Benefits', 'notes']]],
    ['careers', 'Careers', [['career', 'Career'], ['assignment', 'Assignment'], ['promotions', 'Promotions received', 'count'],
      ['years', 'Years in career', 'count'], ['rank', 'Rank and title'], ['benefits', 'Benefits', 'notes'], ['terms', 'Terms', 'count']]],
  ]],
  ['Weapons, armour and equipment', [
    ['weapons', 'Weapons and attacks', [['name', 'Weapon or attack'], ['tl', 'TL'], ['skill', 'Skill'],
      ['damage', 'Damage'], ['range', 'Range'], ['weight', 'Weight'], ['magazine', 'Magazine'], ['ammo', 'Rounds left', 'count'], ...gearFields]],
    ['armor', 'Armour', [['name', 'Armour'], ['rating', 'Protection'], ['tl', 'TL'], ['radiation', 'Rad protection'], ['weight', 'Weight'], ['options', 'Options'], ...gearFields]],
    ['augments', 'Augments', [['type', 'Type'], ['tl', 'TL'], ['improvement', 'Improvement'], ...gearFields]],
    ['equipment', 'Equipment', [['name', 'Equipment'], ['tl', 'TL'], ['mass', 'Mass'], ['cost', 'Cost (Cr)'], ...gearFields]],
  ]],
];
const collections = [...sheetSections.flatMap(([, groups]) => groups),
  ['wounds', 'Wounds', [['type', 'Injury'], ['location', 'Location'], ['recovery', 'Recovery'], ['notes', 'Notes', 'notes']]],
  ['relationships', 'Relationships', [['name', 'Name'], ['type', 'Relationship'], ['notes', 'Notes', 'notes']]],
];
export const sheetRowLimit = 100;

export const fieldLimit = type => type === 'notes' ? 8000 : 500;
function sheetValue(value, label, type) {
  const string = text(value, label, { max: fieldLimit(type) }) ?? '';
  if (!string) return '';
  if (type === 'equipped') requireRule(['yes', 'no'].includes(string), label + ' must be Yes or No.');
  if (type === 'money') {
    requireRule(Number.isFinite(Number(string)), label + ' must be a number.');
    return String(Number(string));
  }
  if (['count', 'quantity', 'integer'].includes(type)) {
    const lower = type === 'quantity' ? 1 : type === 'count' ? 0 : Number.MIN_SAFE_INTEGER;
    return String(integer(Number(string), label, lower, Number.MAX_SAFE_INTEGER));
  }
  return string;
}

export function normalizeCharacterSheet(input) {
  if (input == null) return {};
  requireRule(object(input), 'The character sheet must be an object.');
  const sheet = {};
  for (const [key, label, type] of singleFields) {
    if (has(input, key)) sheet[key] = sheetValue(input[key], label, type);
  }
  if (has(input, 'characteristics')) {
    requireRule(object(input.characteristics), 'Character sheet scores must be an object.');
    const stats = {};
    for (const [key, values] of Object.entries(input.characteristics)) {
      requireRule(has(characteristicNames, key) && object(values), 'Unrecognized character sheet characteristic.');
      const statsForKey = {};
      for (const field of scoreFields) {
        if (!has(values, field)) continue;
        statsForKey[field] = values[field] == null ? null
          : integer(values[field], characteristicNames[key] + ' ' + field, ...scoreLimits(key));
      }
      if (Object.keys(statsForKey).length) stats[key] = statsForKey;
    }
    if (Object.keys(stats).length) sheet.characteristics = stats;
  }
  for (const [key, label, fields] of collections) {
    if (!has(input, key)) continue;
    const rows = input[key];
    requireRule(Array.isArray(rows) && rows.length <= sheetRowLimit, label + ' can hold up to ' + sheetRowLimit + ' rows.');
    sheet[key] = rows.map(row => {
      requireRule(object(row), label + ' rows must be objects.');
      return Object.fromEntries(fields.map(([field, title, type]) => [field, sheetValue(row[field], title, type)])
        .filter(([, value]) => value !== ''));
    }).filter(row => Object.keys(row).length);
  }
  return sheet;
}

function sheetSkill(skill, level) {
  const [, name, specialization] = skill.match(/^(.+?)(?: \((.+)\))?$/) ?? [];
  return { name: name ?? skill, ...(specialization && { specialization }), level: String(level) };
}

export function rolledCharacterSheet(npc) {
  const { identity, biology, places, mechanics, encounter, resources, abilities, player } = npc;
  const gear = npc.equipment ?? [];
  const gearDetails = item => ({
    name: item.name, ...(item.tl != null && { tl: String(item.tl) }), quantity: '1',
    ...(item.location === 'worn' && item.ready !== false && { equipped: 'yes' }),
    ...(item.catalogueId && { catalogueId: item.catalogueId }),
  });
  const publishedSkills = (encounter?.skills ?? []).map(entry => {
    const rated = entry.match(/^(.*) (-?\d+)$/);
    return rated ? sheetSkill(rated[1], rated[2]) : { name: entry };
  });
  const naturalAttacks = npc.derived?.attacks.filter(attack => attack.natural)
    .map(({ name, skill, damage }) => ({ name, skill, damage }))
    ?? (encounter?.attacks ?? []).map(attack => {
      const described = attack.match(/^(.*) \(([^)]+)\)$/);
      return described ? { name: described[1], damage: described[2] } : { name: attack };
    });
  return {
    charName: identity.commonName,
    role: player?.role ?? '',
    traits: [identity.visibleDetail, ...(biology.traits ?? []).map(trait => trait.name)].filter(Boolean).join(' · '),
    background: identity.history?.text ?? '',
    condition: mechanics?.condition?.status ?? '',
    species: biology.name,
    age: String(biology.age.years ?? ''),
    homeworld: places.homeworld?.name ?? '',
    homeworldUWP: places.homeworld?.uwp ?? '',
    upp: mechanics?.upp ?? '',
    cashOnHand: String(resources?.portableFunds ?? ''),
    characteristics: Object.fromEntries(Object.entries(mechanics?.characteristics ?? {}).map(([key, { current, baseline }]) =>
      [key.toLowerCase(), { current, baseline }])),
    skills: mechanics?.skills.map(({ skill, level }) => sheetSkill(skill, level)) ?? publishedSkills,
    trainingSkills: [],
    psionics: [
      ...(abilities?.psion?.talents ?? []).map(({ skill, level }) => ({ name: skill, level: String(level) })),
      ...(abilities?.innate ?? []).map(({ name }) => ({ name, notes: 'Innate ability' })),
    ],
    wounds: [],
    relationships: [],
    preCareerOptions: [],
    careers: [],
    weapons: [...gear.filter(item => item.kind === 'weapon').map(item =>
      ({ ...gearDetails(item), skill: item.equipmentSkill, damage: item.damage })), ...naturalAttacks],
    armor: gear.filter(item => item.kind === 'armour').map(item => ({ ...gearDetails(item), rating: String(item.protection) })),
    augments: (abilities?.augmentations ?? []).map(item => ({
      type: item.name,
      improvement: Object.entries(item.modifiers).map(([stat, value]) => stat + ' ' + (value >= 0 ? '+' : '') + value).join(', '),
      ...(!item.active && { equipped: 'no' }),
    })),
    equipment: gear.filter(item => !['weapon', 'armour'].includes(item.kind)).map(gearDetails),
  };
}

export function characterSheet(npc) {
  const starting = rolledCharacterSheet(npc);
  const edits = npc.controls.characterSheet ?? {};
  return {
    ...starting, ...edits,
    characteristics: {
      ...starting.characteristics,
      ...Object.fromEntries(Object.entries(edits.characteristics ?? {}).map(([key, stat]) =>
        [key, { ...starting.characteristics[key], ...stat }])),
    },
  };
}

export function characterSheetEdits(npc, input) {
  const starting = rolledCharacterSheet(npc);
  const edits = normalizeCharacterSheet(input);
  const differences = {};
  for (const [key] of singleFields) {
    if (has(edits, key) && edits[key] !== (starting[key] ?? '')) differences[key] = edits[key];
  }
  for (const [key, , fields] of collections) {
    // Compare in field order so a projected row and a saved edit have the same representation.
    const original = starting[key].map(row => Object.fromEntries(fields
      .filter(([field]) => row[field]).map(([field]) => [field, row[field]])));
    if (has(edits, key) && JSON.stringify(edits[key]) !== JSON.stringify(original)) differences[key] = edits[key];
  }
  const characteristicEdits = {};
  for (const [key, stats] of Object.entries(edits.characteristics ?? {})) {
    const changed = Object.fromEntries(Object.entries(stats)
      .filter(([field, value]) => value !== (starting.characteristics[key]?.[field] ?? null)));
    if (Object.keys(changed).length) characteristicEdits[key] = changed;
  }
  if (Object.keys(characteristicEdits).length) differences.characteristics = characteristicEdits;
  return differences;
}

export function setCharacterSheet(npc, data) {
  const sheet = normalizeCharacterSheet(data);
  if (Object.keys(sheet).length) npc.controls.characterSheet = sheet;
  else delete npc.controls.characterSheet;
}

export function setMemberSheet(record, member, data) {
  setCharacterSheet(member, data);
  const sheets = Object.fromEntries(record.members.filter(({ npc }) => npc.controls.characterSheet)
    .map(({ npc }) => [npc.id, npc.controls.characterSheet]));
  if (Object.keys(sheets).length) record.controls.memberSheets = sheets;
  else delete record.controls.memberSheets;
}

export function applyMemberSheets(record, sheets) {
  if (sheets == null) return;
  requireRule(object(sheets) && Object.keys(sheets).length <= record.members.length, 'Invalid saved member sheets.');
  for (const [id, sheet] of Object.entries(sheets)) {
    const member = record.members.find(({ npc }) => npc.id === id);
    requireRule(member, 'A character sheet refers to a missing member.');
    setMemberSheet(record, member.npc, sheet);
  }
}
