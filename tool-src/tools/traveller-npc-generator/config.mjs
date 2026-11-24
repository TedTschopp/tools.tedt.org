import { contexts, characteristicOrder, occupationChoices, occupationTable, specialties, specialtyFamilies, tiers } from './tables.mjs';
import { cultures, needs, species } from './species.mjs';
import { nameStyles } from './names.mjs';
import { portraits } from './species-art.mjs';

export class RuleConflict extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuleConflict';
  }
}
export function requireRule(condition, message) {
  if (!condition) throw new RuleConflict(message);
}

export const has = (object, key) => Object.hasOwn(object, key);
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function text(value, field, { required = false, max = 500 } = {}) {
  if (value === null || value === undefined || value === '') {
    requireRule(!required, field + ' is required.');
    return null;
  }
  requireRule(typeof value === 'string' && value.length <= max, field + ' must be text of at most ' + max + ' characters.');
  requireRule(!required || value.trim(), field + ' is required.');
  return value.trim() || null;
}
export function integer(value, field, min, max) {
  requireRule(Number.isInteger(value) && value >= min && value <= max,
    field + ' must be a whole number from ' + min + ' to ' + max + '.');
  return value;
}
export function option(value, choices, field) {
  requireRule(choices.includes(value), field + ' has an unsupported value: ' + String(value) + '.');
  return value;
}

export const statKeys = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC', 'CHA', 'RES', 'TER', 'PSI'];
const skillNames = [
  'Admin', 'Advocate', 'Animals', 'Art', 'Astrogation', 'Athletics', 'Broker', 'Carouse', 'Caste',
  'Deception', 'Diplomat', 'Drive', 'Electronics', 'Engineer', 'Explosives', 'Flight', 'Flyer', 'Gambler',
  'Gun Combat', 'Gunner', 'Heavy Weapons', 'Investigate', 'Jack-of-all-Trades', 'Language', 'Leadership',
  'Mechanic', 'Medic', 'Melee', 'Navigation', 'Outsider', 'Patriarchy', 'Persuade', 'Pilot', 'Profession',
  'Recon', 'Science', 'Seafarer', 'Stealth', 'Steward', 'Streetwise', 'Survival', 'Tactics', 'Vacc Suit',
  ...specialties.psion, 'Zhodani',
];
const skillLabels = new Map(skillNames.map(name => [name.toLowerCase(), name]));

export function skillName(value) {
  const raw = text(value, 'Skill name', { required: true, max: 120 }).replace(/\s+/g, ' ');
  const match = /^([^()]+?)(?:\s*\(([^()]+)\))?$/.exec(raw);
  requireRule(match, 'Use Skill or Skill (specialty) for “' + raw + '”.');
  const base = match[1].trim();
  const field = match[2]?.trim().toLowerCase();
  const label = skillLabels.get(base.toLowerCase()) ?? base;
  return field ? label + ' (' + field + ')' : label;
}
export const family = name => name.split(' (')[0];
export const skillKey = name => name.toLowerCase();
export function validateRating(skill, level, label, requirement = false) {
  integer(level, label, 0, 4);
  const group = family(skill);
  requireRule(!/\((any|selected .*|field|specialty)\)$/i.test(skill), 'Resolve the specialty for ' + skill + '.');
  requireRule(!level || skill !== group || !specialtyFamilies.has(group),
    (requirement ? 'Choose a specialty for the required ' : 'Choose a specialty for ') + group + ' rating.');
}

function checkedList(value, field, max) {
  const list = value ?? [];
  requireRule(Array.isArray(list) && list.length <= max, field + ' must be a list of at most ' + max + ' entries.');
  return list;
}

function weightMap(value, existing, field) {
  const weights = value ?? {};
  requireRule(object(weights), field + ' must map IDs to whole-number weights.');
  return Object.fromEntries(Object.entries(weights).map(([key, weight]) => [
    option(key, existing, field), integer(weight, field + ' for ' + key, 0, 1000),
  ]));
}

function skillList(value, field, override = false) {
  return checkedList(value, field, 60).map(entry => {
    requireRule(object(entry), field + ' entries need a skill and level.');
    const skill = skillName(entry.skill);
    validateRating(skill, entry.level, skill + ' level', !override);
    return {
      skill, level: entry.level,
      ...(override ? { reason: text(entry.reason, 'Override reason for ' + skill, { required: true }) } : {}),
    };
  });
}

function identity(value = {}) {
  requireRule(object(value), 'Identity facts must be an object.');
  const fields = ['commonName', 'nativeName', 'pronouns', 'sex', 'gender', 'ancestry', 'citizenship', 'communication', 'description'];
  return {
    ...Object.fromEntries(fields.map(key => [key, text(value[key], key)])),
    aliases: checkedList(value.aliases, 'Aliases', 20).map(alias => text(alias, 'Alias', { required: true })),
  };
}

function adjustments(value, type) {
  return checkedList(value, type, 30).map(entry => {
    requireRule(object(entry), type + ' entries must be objects.');
    const result = {
      id: text(entry.id, type + ' ID', { required: true }),
      name: text(entry.name, type + ' name', { required: true }),
      source: text(entry.source, type + ' source', { required: true }),
      active: entry.active !== false,
    };
    if (type === 'Condition') return {
      ...result, characteristic: option(entry.characteristic, statKeys, 'Condition characteristic'),
      loss: integer(entry.loss, 'Characteristic loss', 1, 99),
      recovery: text(entry.recovery, 'Recovery state') ?? 'Active',
    };
    requireRule(object(entry.modifiers ?? {}), 'Augmentation modifiers must map characteristics to adjustments.');
    return {
      ...result, type: option(entry.type ?? 'implant', ['implant', 'genetic'], 'Augmentation type'),
      modifiers: Object.fromEntries(Object.entries(entry.modifiers ?? {}).map(([stat, amount]) => [
        option(stat, statKeys, 'Augmentation characteristic'), integer(amount, 'Augmentation modifier', -20, 20),
      ])),
      requiresSpecies: checkedList(entry.requiresSpecies, 'Compatible species', 40).map(id =>
        option(id, ['custom', ...Object.keys(species)], 'Compatible species')),
      requirements: text(entry.requirements, 'Augmentation requirements'),
    };
  });
}

function optionalAge(value, label) {
  return value === null || value === undefined ? null : integer(value, label, 0, 99999);
}

function refereeProfile(value) {
  if (value == null) return null;
  requireRule(object(value) && value.living === true && value.sophont === true,
    'A referee species profile must describe a living biological sophont.');
  const name = text(value.name, 'Referee profile name', { required: true });
  const source = text(value.source, name + ' source and edition', { required: true });
  const order = checkedList(value.order, 'Referee characteristic order', 6);
  const required = characteristicOrder.slice(0, 5);
  requireRule(required.every(stat => order.includes(stat)) && new Set(order).size === order.length
    && order.every(stat => [...required, 'SOC', 'RES', 'CHA'].includes(stat)),
  'A referee profile needs STR, DEX, END, INT and EDU, with optional SOC, RES or CHA.');
  requireRule(object(value.characteristics) && order.every(stat => object(value.characteristics[stat])),
    'Specify dice and adjustments for each characteristic in the referee profile.');
  const dice = {};
  const modifiers = {};
  const minimums = {};
  const maximums = {};
  for (const stat of order) {
    const entry = value.characteristics[stat];
    dice[stat] = {
      count: integer(entry.count, stat + ' dice', 1, 3),
      sides: option(entry.sides, [3, 6], stat + ' die sides'),
      add: integer(entry.add ?? 0, stat + ' dice offset', -20, 30),
    };
    modifiers[stat] = integer(entry.adjustment ?? 0, stat + ' adjustment', -20, 20);
    minimums[stat] = integer(entry.minimum ?? 1, stat + ' minimum', 0, 50);
    if (entry.maximum != null) maximums[stat] = integer(entry.maximum, stat + ' maximum', minimums[stat], 99);
  }
  requireRule(object(value.age) && has(value.age, 'adult'), 'Supply the adult age model or set age.adult to null.');
  const adult = optionalAge(value.age.adult, 'Adult reference age');
  const age = { adult, scale: adult === null ? null : integer(value.age.scale, 'Demographic age scale', 1, 20) };
  if (value.age.maximum != null) age.maximum = integer(value.age.maximum, 'Last age in the demographic range', adult ?? 1, 99999);
  requireRule(Array.isArray(value.needs) && value.needs.length > 0, 'Specify the referee profile’s environmental needs.');
  const requirements = [...new Set(value.needs.map(need => option(need, Object.keys(needs), 'Environmental need')))];
  const grants = skillList(value.grants, 'Species grants');
  requireRule(!grants.some(grant => [...specialties.psion, 'Zhodani'].includes(grant.skill)),
    'Use the psionics option for active talents in a referee profile.');
  const attacks = checkedList(value.attacks, 'Innate attacks', 8).map(attack => {
    requireRule(object(attack), 'An innate attack needs a name, skill, characteristic and damage.');
    const damage = text(attack.damage, 'Innate damage', { required: true });
    requireRule(/^(?:\d+D{1,2}(?:[+-]\d+)?|\d+)$/.test(damage), 'Enter an innate damage expression such as 1D+1.');
    return { name: text(attack.name, 'Innate attack name', { required: true }), damage,
      skill: skillName(attack.skill), characteristic: option(attack.characteristic, order, 'Innate attack characteristic') };
  });
  return {
    name, source, living: true, sophont: true, variant: 'Referee-defined adult', fit: 'custom', weight: 0,
    ...(value.appearance != null && { appearance: option(value.appearance, Object.keys(portraits), 'Species plate') }),
    order, dice, modifiers, minimums, maximums, age, needs: requirements, grants, attacks, culture: 'imperial',
    body: text(value.body, 'Referee profile anatomy', { required: true }),
    movement: text(value.movement, 'Referee profile movement', { required: true }),
    senses: text(value.senses, 'Referee profile senses', { required: true }),
    manipulators: text(value.manipulators, 'Referee profile manipulators', { required: true }),
    communication: text(value.communication, 'Referee profile communication', { required: true }),
    psionics: option(value.psionics ?? 'optional', ['optional', 'prohibited'], 'Referee profile psionics'),
    traits: checkedList(value.traits, 'Traits', 25).map(entry => {
      requireRule(object(entry), 'Traits need a name and description.');
      return { name: text(entry.name, 'Trait name', { required: true }),
        text: text(entry.text, 'Trait description', { required: true }) };
    }),
    characteristics: Object.fromEntries(order.map(stat => [stat, {
      ...dice[stat], adjustment: modifiers[stat], minimum: minimums[stat], maximum: maximums[stat] ?? null,
    }])),
  };
}

export function normalizeConfig(input = {}, { legacyNames = false } = {}) {
  requireRule(object(input), 'Generator settings must be an object.');
  const roleIds = occupationChoices.map(row => row.id);
  const contextsKeys = Object.keys(contexts);
  const context = option(input.context ?? 'mixed', contextsKeys, 'Encounter context');
  const customProfile = refereeProfile(input.customProfile);
  const speciesId = option(input.species ?? 'random', ['random', 'custom', ...Object.keys(species)], 'Species profile');
  requireRule(speciesId !== 'custom' || customProfile, 'Add a customProfile object under Advanced referee facts to use this species.');
  const culture = option(input.culture ?? 'auto', ['auto', ...Object.keys(cultures)], 'Culture');
  const occupation = option(input.occupation ?? 'random', ['random', ...roleIds], 'Occupation');
  const competence = option(input.competence ?? 'random', ['random', ...tiers.map(tier => tier.id)], 'Competence');
  const secondary = option(input.secondary ?? 'none', ['none', 'random', ...roleIds.filter(id => id !== 'psion')], 'Secondary occupation');
  const age = input.age === 'random' || input.age === undefined ? 'random' : optionalAge(input.age, 'Age');
  const lifeform = option(input.lifeform ?? 'standard', ['standard', 'clone', 'modified'], 'Lifeform');
  const clone = input.clone ?? {};
  requireRule(object(clone), 'Clone facts must be an object.');
  const chronAge = optionalAge(clone.chronologicalAge, 'Clone chronological age');
  requireRule(lifeform !== 'clone' || age === 'random' || age === null || chronAge === null || age === chronAge,
    'The clone’s chronological age conflicts with the selected age.');
  const conditions = adjustments(input.conditions, 'Condition');
  const augmentations = adjustments(input.augmentations, 'Augmentation');
  requireRule(new Set([...conditions, ...augmentations].map(entry => entry.id)).size === conditions.length + augmentations.length,
    'Condition and augmentation IDs must be unique.');
  requireRule(lifeform !== 'modified' || augmentations.some(item => item.type === 'genetic'),
    'A modified individual needs a sourced genetic augmentation record.');

  const psion = input.psion ?? {};
  requireRule(object(psion), 'Psionic options must be an object.');
  const mode = occupation === 'psion' ? 'trained' : option(psion.mode ?? 'auto', ['auto', 'off', 'latent', 'trained'], 'Psionics mode');
  const talent = option(psion.talent ?? 'random', ['random', ...specialties.psion], 'Psionic talent');
  const placement = input.placement ?? {};
  requireRule(object(placement), 'Placement details must be an object.');
  const profileOptions = input.profileOptions ?? {};
  requireRule(object(profileOptions), 'Species options must be an object.');
  const requirementValues = input.requiredCharacteristics ?? {};
  requireRule(object(requirementValues), 'Required characteristics must map characteristic IDs to minimums.');
  const characteristicBoons = [...new Set(checkedList(input.characteristicBoons, 'Characteristic boons', 6)
    .map(stat => option(stat, statKeys.filter(key => key !== 'PSI'), 'Boon characteristic')))];
  const identityFacts = identity(input.identity);
  const population = weightMap(input.population, [...Object.keys(species), ...(customProfile ? ['custom'] : [])], 'Population weight');
  const occupationWeights = weightMap(input.occupationWeights, occupationTable.map(row => row.id), 'Occupation weight');
  const homeworlds = checkedList(input.homeworlds, 'Homeworlds', 200).map(world => {
    requireRule(object(world), 'Homeworld entries need a name and weight.');
    return {
      name: text(world.name, 'Homeworld name', { required: true }),
      weight: integer(world.weight ?? 1, 'Homeworld weight', 1, 1000),
      uwp: text(world.uwp, 'Supplied UWP', { max: 30 }),
    };
  });
  const party = input.partyRelationship ?? null;
  const networkTarget = input.networkTarget ?? null;
  function target(entry, label, requireId) {
    requireRule(object(entry), label + ' must be an object.');
    return {
      id: text(entry.id, label + ' ID', { required: requireId }),
      name: text(entry.name, label + ' name', { required: !entry.id }),
      occupation: text(entry.occupation, label + ' occupation'),
    };
  }
  const funds = input.funds ?? null;
  return {
    context, species: speciesId, culture, occupation, competence, secondary, age, lifeform, customProfile,
    ...(!legacyNames && { nameStyle: option(input.nameStyle ?? 'auto', ['auto', ...Object.keys(nameStyles)], 'Naming style') }),
    specialty: text(input.specialty, 'Occupation specialty', { max: 90 }),
    secondarySpecialty: text(input.secondarySpecialty, 'Secondary specialty', { max: 90 }),
    profileOptions: {
      adultForm: text(profileOptions.adultForm, 'Adult form or caste', { max: 80 }),
      wings: option(profileOptions.wings ?? 'random', ['random', 'vestigial', 'small', 'large'], 'Droyne wings'),
      territory: optionalAge(profileOptions.territory, 'Personal Territory'),
      ascondiSoc: profileOptions.ascondiSoc == null ? null : integer(profileOptions.ascondiSoc, 'Ascondi SOC', 3, 10),
      zhodaniHighPsi: profileOptions.zhodaniHighPsi === true,
    },
    identity: identityFacts,
    clone: lifeform === 'clone' ? {
      donorId: text(clone.donorId, 'Donor ID'), chronologicalAge: chronAge,
      biologicalAge: optionalAge(clone.biologicalAge, 'Clone biological age'),
      memoryHistory: text(clone.memoryHistory, 'Clone memory history'),
    } : null,
    conditions, augmentations, characteristicBoons,
    psion: { mode, talent, potential: psion.potential == null ? null : integer(psion.potential, 'Latent PSI potential', 0, 12),
      current: psion.current == null ? null : integer(psion.current, 'Current PSI', 0, 12),
      weights: weightMap(psion.weights, specialties.psion, 'Talent weight') },
    requiredSkills: skillList(input.requiredSkills, 'Required skills'),
    skillGrants: skillList(input.skillGrants, 'Referee skill grants', true),
    requiredCharacteristics: Object.fromEntries(Object.entries(requirementValues).map(([stat, minimum]) => [
      option(stat, statKeys, 'Required characteristic'), integer(minimum, stat + ' minimum', 0, 99),
    ])),
    placement: {
      current: text(placement.current, 'Current location'), last: text(placement.last, 'Last known location'),
      uncertainty: text(placement.uncertainty, 'Location uncertainty'),
      medium: option(placement.medium ?? 'unknown', ['unknown', 'breathable', 'water', 'vacuum', 'unbreathable'], 'Environment'),
      tl: placement.tl == null ? null : integer(placement.tl, 'Local technology level', 0, 99),
      law: placement.law == null ? null : integer(placement.law, 'Local law level', 0, 99),
      accommodations: checkedList(placement.accommodations, 'Accommodations', 20).map(entry => {
        requireRule(object(entry), 'An accommodation needs a need ID and description.');
        return {
          need: option(entry.need, Object.keys(needs), 'Accommodation need'),
          description: text(entry.description, 'Accommodation description', { required: true }),
        };
      }),
    },
    population, occupationWeights, homeworlds, homeworld: text(input.homeworld, 'Fixed homeworld'),
    backgroundWeights: weightMap(input.backgroundWeights, ['1', '2', '3', '4', '5', '6'], 'Upbringing weight'),
    funds: funds === null ? null : integer(funds, 'Portable funds', 0, Number.MAX_SAFE_INTEGER),
    affiliation: text(input.affiliation, 'Affiliation'), authority: text(input.authority, 'Authority'),
    networkTarget: networkTarget && target(networkTarget, 'Network target', true),
    partyRelationship: party && {
      target: target(party.target, 'Party relationship target', false),
      role: text(party.role, 'Party relationship role', { required: true }),
      cause: text(party.cause, 'Party relationship cause', { required: true }),
      consequence: text(party.consequence, 'Party relationship consequence', { required: true }),
      status: option(party.status ?? 'established', ['established', 'proposed'], 'Party relationship status'),
    },
    gear: checkedList(input.gear, 'Equipment', 30),
  };
}
