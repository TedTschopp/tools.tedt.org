import { has, integer, normalizeConfig, object, requireRule, text } from './config.mjs';
import { resolveEquipment } from './equipment.mjs';
import { encounterSpecies } from './encounter-species.mjs';
import { chooseBiology, isTalent, prepareMechanics, rollCharacteristics, upp } from './mechanics.mjs';
import { generateName, nameStyleFor } from './names.mjs';
import { diceOutcomes, pickDice, stableId, streams, sum } from './random.mjs';
import { cultures } from './species.mjs';
import {
  accessTable, affiliations, boundaries, contexts, employments, goals, legacyNamePack, looks, manner, names,
  occupationTable, packs, possessions, pressureConsequences, pressures, relationshipRoles,
  requests, risks, ruleProfile, schema, secrets, transition, version,
} from './tables.mjs';
import { checkWorkPool, chooseWork, skillValues } from './work.mjs';

export const fieldGroups = {
  Identity: [['name', 'Common name'], ['detail', 'Visible detail']],
  Biology: [['species', 'Species'], ['form', 'Adult form or caste'], ['wings', 'Droyne wings'], ['age', 'Age']],
  Mechanics: [['occupation', 'Occupation and specialty'], ['secondary', 'Secondary training'], ['competence', 'Competence'], ['skills', 'Resolved skills']],
  Background: [['upbringing', 'Upbringing'], ['background', 'Background grants'], ['homeworld', 'Homeworld'], ['history', 'History transition']],
  Resources: [['employment', 'Employment'], ['affiliation', 'Affiliation'], ['funds', 'Portable funds'], ['access', 'Institutional access'], ['possession', 'Personal possession']],
  Story: [['attitude', 'Attitude'], ['goal', 'Goal'], ['pressure', 'Pressure and debt'], ['manner', 'Manner'], ['boundary', 'Boundary'],
    ['risk', 'Risk tolerance'], ['secret', 'Secret'], ['network', 'Relationship']],
};
const ordinaryFields = Object.values(fieldGroups).flat().map(([key]) => key);
const statFields = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC', 'CHA', 'RES', 'TER', 'PSI'].map(stat => 'stat.' + stat);
const allFields = new Set([...ordinaryFields, ...statFields, 'specialty', 'senses', 'psionicTraining']);
const nonRerollable = ['skills'];
const legacyPacks = { ...packs, names: legacyNamePack };
const stateTitle = value => value[0].toUpperCase() + value.slice(1);
const orderFields = fields => fields.map(key => key === 'occupation' ? ['occupation', 'specialty'] : [key]).flat();
const relationshipValue = edge => edge && ({
  role: edge.role, target: edge.target, cause: edge.cause, consequence: edge.consequence,
});

function lockValues(npc) {
  const { identity, biology, story, places, work, resources } = npc;
  if (npc.encounter) return { name: identity.commonName, species: biology.profileId };
  return {
    name: identity.commonName, detail: identity.visibleDetail,
    species: biology.profileId === 'custom' ? { id: 'custom', definition: npc.controls.config.customProfile } : biology.profileId,
    form: biology.form, wings: biology.wings,
    age: biology.age.years, occupation: { id: work.occupation.id, title: work.occupation.title, field: work.occupation.field },
    secondary: work.secondary && { id: work.secondary.id, title: work.secondary.title, field: work.secondary.field },
    competence: work.competence.id, skills: skillValues(npc.mechanics.skills),
    upbringing: npc.culture.upbringing.row, background: npc.culture.upbringing.skills,
    homeworld: places.homeworld, history: identity.history.transition,
    employment: work.employment.roll, affiliation: work.employment.affiliation, funds: resources.portableFunds,
    access: resources.access.roll, possession: resources.possession, attitude: story.attitude,
    goal: story.goalIndex, pressure: { index: story.pressureIndex, debt: resources.debts.length ? resources.debts[0].amount : null },
    manner: story.mannerIndex, boundary: story.boundaryIndex, risk: story.riskIndex, secret: story.secret, network: relationshipValue(story.network),
    ...Object.fromEntries(Object.entries(npc.mechanics.characteristics).map(([key, value]) => ['stat.' + key, value.current])),
  };
}

function sameValue(a, b) {
  if (object(a) && object(b)) {
    return Object.keys(a).length === Object.keys(b).length
      && Object.entries(a).every(([key, value]) => has(b, key) && sameValue(value, b[key]));
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => sameValue(value, b[index]));
  return a === b;
}

export function setLock(npc, key, locked) {
  const values = lockValues(npc);
  requireRule(has(values, key), 'This record has no value for “' + key + '”.');
  const locks = structuredClone(npc.controls.locks);
  if (locked) locks[key] = structuredClone(values[key]);
  else delete locks[key];
  return locks;
}

export function rerollCounters(npc, fields) {
  const counters = { ...npc.provenance.rerollCounters };
  for (const key of orderFields(fields)) {
    if (!allFields.has(key) || nonRerollable.includes(key) || has(npc.controls.locks, key)
      || (key === 'specialty' && has(npc.controls.locks, 'occupation'))) continue;
    counters[key] = (counters[key] ?? 0) + 1;
  }
  return counters;
}

export async function rerollNpc(npc, fields) {
  const { seed, index, rerollCounters: previous } = npc.provenance;
  const counters = rerollCounters(npc, fields);
  requireRule(fields.some(key => counters[key] !== previous[key]), 'Unlock a field before rolling it again.');
  const onlyCosmetic = fields.every(key => ['name', 'detail', 'manner'].includes(key));
  const locks = onlyCosmetic ? npc.controls.rollLocks : npc.controls.locks;
  const updated = await generateNpc(npc.controls.config, {
    seed, index, counters, locks, namingPack: npc.provenance.packs.names,
  });
  if (onlyCosmetic) updated.controls.locks = structuredClone(npc.controls.locks);
  return updated;
}

async function rollAge(profile, tier, config, locks, rng) {
  const model = profile.age;
  const requested = config.clone?.chronologicalAge ?? config.age;
  const locked = has(locks, 'age');
  requireRule(!locked || requested === 'random' || requested === locks.age, 'Age is locked to ' + (locks.age ?? 'unspecified') + '.');
  const resolved = locked ? locks.age : requested;
  const hasConstraint = model.maximum !== undefined;
  const valid = age => age === null || ((model.adult === null || age >= model.adult) && (!hasConstraint || age <= model.maximum));
  if (resolved !== 'random' || model.adult === null) {
    const years = resolved === 'random' ? null : resolved;
    requireRule(valid(years), 'Age ' + years + ' is outside the ' + profile.name + ' adult profile.');
    rng.log({ label: 'Chronological age', result: years, method: locked ? 'locked value'
      : years === null ? 'unspecified adult age' : 'referee value' });
    return { years, model: model.adult === null ? 'Adult by development' : 'Adult snapshot', ...model };
  }
  const ageOf = (base, variation, extra) => Math.floor(Math.max(model.adult,
    model.adult + model.scale * (tier.ageOffset + base + (variation === 1 ? -8 : variation === 6 ? extra : 0))));
  let years;
  if (!hasConstraint) {
    const starting = (await rng.dice(tier.ageDice, 'Career-age starting dice')).total;
    const variation = await rng.draw(6, 'Age variation');
    const extra = variation === 6 ? (await rng.dice(4, 'Additional years')).total : 0;
    years = ageOf(starting, variation, extra);
  } else {
    const extraDice = diceOutcomes(4);
    const baseOptions = diceOutcomes(tier.ageDice).map(dice => {
      const base = sum(dice);
      const variations = [1, 2, 3, 4, 5, 6].map(value => {
        const extensions = value === 6 ? extraDice.filter(extra => valid(ageOf(base, value, sum(extra)))) : [];
        return { value, label: value, extensions, weight: value === 6 ? extensions.length
          : valid(ageOf(base, value, 0)) ? extraDice.length : 0 };
      }).filter(entry => entry.weight);
      return { dice, variations, weight: sum(variations.map(entry => entry.weight)) };
    }).filter(entry => entry.weight);
    requireRule(baseOptions.length, 'This competence tier has no age within the adult profile.');
    const starting = await pickDice(rng, baseOptions, tier.ageDice, 'Eligible career-age dice');
    const { variations } = baseOptions.find(item => item.dice.every((face, index) => face === starting[index]));
    const variation = await rng.pick(variations.map(value => ({ ...value, value })), 'Eligible age variation');
    const extra = variation.value === 6 ? sum(await pickDice(rng, variation.extensions.map(dice => ({ dice, weight: 1 })), 4,
      'Eligible additional years')) : 0;
    years = ageOf(sum(starting), variation.value, extra);
  }
  return { years, model: 'Adult snapshot', ...model };
}

async function legacyNpcName(rng) {
  const given = names[0][(await rng.draw(6, 'Given or trade name')) - 1];
  const surname = names[1][(await rng.draw(6, 'Family or adopted name')) - 1];
  return given + ' ' + surname;
}

async function identityAndPlaces(config, profile, work, locks, rng, characteristics, namingStyle) {
  const named = config.identity.commonName;
  requireRule(!named || !has(locks, 'name') || named === locks.name, 'The common name is locked to ' + locks.name + '.');
  const knownName = named ?? locks.name;
  const sex = config.identity.sex ?? (['Male', 'Female', 'Non-patriarch male', 'Patriarch', 'Female sophont'].includes(profile.form)
    ? (['Female', 'Female sophont'].includes(profile.form) ? 'Female' : 'Male') : null);
  const names = namingStyle
    ? await generateName(namingStyle, rng('name', 'names'), {
      sex, soc: characteristics.SOC?.baseline, nativeCulture: profile.culture,
      commonName: knownName, nativeName: config.identity.nativeName,
    })
    : { commonName: knownName ?? await legacyNpcName(rng('name', 'names')) };
  const name = names.commonName;
  const detail = locks.detail ?? looks[(await rng('detail', 'narrative').draw(6, 'Visible detail')) - 1];
  const role = work.tier.id === 'green' ? 'trainee ' + work.occupation.title.toLowerCase() : work.occupation.title.toLowerCase();
  const historyIndex = locks.history ?? (await rng('history', 'narrative').draw(6, 'History transition')) - 1;
  let homeworld = null;
  if (config.homeworld) {
    requireRule(!has(locks, 'homeworld') || locks.homeworld?.name === config.homeworld, 'The homeworld is locked to ' + (locks.homeworld?.name ?? 'unspecified') + '.');
    const found = config.homeworlds.find(entry => entry.name === config.homeworld);
    homeworld = { name: config.homeworld, uwp: found?.uwp ?? null, source: 'Referee' };
  }
  if (has(locks, 'homeworld')) homeworld = locks.homeworld;
  else if (!homeworld && config.homeworlds.length) {
    const selected = await rng('homeworld', 'culture').pick(config.homeworlds.map(world => ({ value: world, label: world.name, weight: world.weight })),
      'Weighted campaign homeworld');
    homeworld = { name: selected.name, uwp: selected.uwp, source: 'Campaign world list' };
  }
  const culture = cultures[profile.culture];
  return {
    identity: {
      ...config.identity, ...names, ancestry: config.identity.ancestry ?? profile.ancestry ?? null, sex,
      visibleDetail: detail, history: { transition: historyIndex, text: 'Raised in a setting described as '
        + work.background.name.toLowerCase() + ', ' + name + ' now works as a ' + role + '. They '
        + transition[historyIndex] + ' on the way to their current situation.' },
    },
    culture: {
      id: profile.culture, name: culture.name, source: culture.source ?? 'Campaign and generator culture pack',
      upbringing: work.background, citizenship: config.identity.citizenship,
      nativeCommunication: config.identity.communication ?? profile.communication ?? culture.communication,
    },
    places: {
      homeworld, current: config.placement.current, lastKnown: config.placement.last,
      uncertainty: config.placement.uncertainty, medium: config.placement.medium, localTL: config.placement.tl, law: config.placement.law,
    },
  };
}

function fundsBracket(roll) {
  if (roll <= 3) return [0, 'Almost no cash'];
  if (roll <= 5) return [10, 'Strained'];
  if (roll <= 8) return [100, 'Ordinary reserve'];
  if (roll <= 10) return [1000, 'Comfortable reserve'];
  if (roll === 11) return [10000, 'Substantial reserve'];
  return [100000, 'Very substantial reserve'];
}

async function employmentAndResources(config, work, locks, rng) {
  const context = contexts[config.context];
  const rolled = context.hiring ? 1 : locks.employment ?? await rng('employment', 'resources').draw(6, 'Employment status');
  const seeking = rolled === 1;
  const kit = work.occupation.kit;
  requireRule(!context.hiring || !has(locks, 'employment') || locks.employment === 1,
    'Hiring requires seeking work, but employment is locked to ' + employments[locks.employment - 1] + '.');
  let affiliation = config.affiliation ?? locks.affiliation;
  if (!affiliation) {
    const roll = await rng('affiliation', 'resources').draw(6, 'Affiliation');
    affiliation = affiliations[roll - 1];
    if (roll === 3 && kit === 'armed') affiliation = 'Corporate security organization';
    if (roll === 5 && kit === 'research') affiliation = 'Research institute or university';
    if (roll === 2 && kit === 'medical') affiliation = 'Local medical practice';
  }
  requireRule(!has(locks, 'funds') || config.funds === null || config.funds === locks.funds,
    'Portable funds are locked to Cr' + locks.funds + '.');
  const fundsRng = rng('funds', 'resources');
  let portableFunds = config.funds ?? locks.funds;
  let financialSituation = config.funds !== null ? 'Referee amount' : 'Locked amount';
  if (portableFunds == null) {
    const [multiplier, bracket] = fundsBracket((await fundsRng.dice(2, 'Portable-funds category')).total);
    const amount = multiplier ? (await fundsRng.dice(2, 'Portable-funds amount')).total : 0;
    portableFunds = amount * multiplier;
    financialSituation = bracket;
  }
  const index = locks.access ?? (await rng('access', 'resources').draw(6, 'Extra access')) - 1;
  const [resource, obligation] = accessTable[index];
  const access = {
    roll: index, resource, owner: index === 0 ? 'Individual contacts' : affiliation,
    permissionRequired: true, condition: seeking && index > 1 ? 'Conditional on a new agreement or former employer’s consent' : 'Arrange consent',
    obligation,
  };
  const possession = locks.possession ?? possessions[(await rng('possession', 'narrative').draw(6, 'Personal possession')) - 1];
  const authority = config.authority ?? (seeking ? 'Personal decisions and agreements about their own work'
    : 'Decisions within the assigned job');
  return {
    employment: { roll: rolled, status: employments[rolled - 1], seeking, affiliation, relationship: seeking ? 'Previous or ongoing association' : 'Work affiliation' },
    resources: { portableFunds, financialSituation, possession, access, authority, debts: [], personalAssets: [] },
  };
}

function orDie(locks, key, rng, label) {
  return has(locks, key) ? Promise.resolve(locks[key]) : rng(key, 'narrative').draw(6, label).then(roll => roll - 1);
}

async function storyFor(id, config, locks, work, resources, rng, namingStyle) {
  let attitude = locks.attitude;
  if (!attitude) {
    const score = (await rng('attitude', 'narrative').dice(2, 'Initial attitude')).total;
    attitude = score === 2 ? 'Hostile' : score <= 5 ? 'Guarded' : score <= 8 ? 'Neutral'
      : score <= 11 ? 'Welcoming' : 'Actively helpful';
  }
  const goalIndex = await orDie(locks, 'goal', rng, 'Immediate goal');
  const process = rng('pressure', 'narrative');
  const pressureIndex = locks.pressure?.index ?? (await process.draw(6, 'Current pressure')) - 1;
  if (pressureIndex === 2) resources.debts.push({
    amount: locks.pressure?.debt ?? (await process.dice(2, 'Debt amount')).total * 1000,
    creditor: null, source: 'Current pressure table',
  });
  const mannerIndex = await orDie(locks, 'manner', rng, 'Observable manner');
  const boundaryIndex = await orDie(locks, 'boundary', rng, 'Personal boundary');
  const riskIndex = await orDie(locks, 'risk', rng, 'Willingness to accept danger');
  let secret = locks.secret ?? null;
  if (!has(locks, 'secret')) {
    const secretRng = rng('secret', 'narrative');
    const gate = await secretRng.draw(6, 'Secret gate');
    if (gate >= 5) {
      const [subject, cause] = secrets[(await secretRng.draw(6, 'Secret subject')) - 1];
      secret = { type: gate === 5 ? 'Private fact' : 'Concealed complication', subject, cause };
    }
  }
  requireRule(!locks.network || !config.networkTarget || locks.network.target.id === config.networkTarget.id,
    'The relationship is locked to a different target.');
  let network = locks.network ? { ...locks.network, from: locks.network.target.id, to: id,
    direction: 'Target’s role in relation to this NPC' } : null;
  if (!has(locks, 'network')) {
    const networkRng = rng('network', 'narrative');
    const result = (await networkRng.dice(2, 'Network relationship')).total;
    if (relationshipRoles[result]) {
      const [role, cause, consequence] = relationshipRoles[result];
      const target = config.networkTarget ?? {
        id: id + '-network',
        name: namingStyle ? (await generateName(namingStyle, rng('network.name', 'names'))).commonName
          : await legacyNpcName(networkRng),
        // Draw four preserves the occupation result from before contact names had their own stream.
        occupation: occupationTable[(await networkRng.draw(36, 'Target occupation', namingStyle ? 4 : undefined)) - 1].title,
      };
      requireRule(target.id !== id, 'The network relationship cannot point to this NPC.');
      network = { role, target, from: target.id, to: id, direction: 'Target’s role in relation to this NPC', cause, consequence };
    }
  }
  const partyTarget = config.partyRelationship ? { ...config.partyRelationship.target,
    id: config.partyRelationship.target.id ?? id + '-party' } : null;
  const party = partyTarget ? { ...config.partyRelationship, target: partyTarget, direction: 'Target’s role in relation to this NPC',
    from: partyTarget.id, to: id } : null;
  requireRule(!party || party.from !== id, 'The party relationship target must differ from this NPC.');
  const primary = work.occupation.slots[0];
  const capability = work.tier.ratings[0] > 0 ? 'training in ' + primary : 'familiarity with ' + primary;
  const hook = requests[goalIndex] + ' in exchange for ' + capability + '. ' + pressureConsequences[pressureIndex] + '.';
  const mission = contexts[config.context].patron ? {
    request: requests[goalIndex],
    outsideHelp: 'They need an independent crew to handle work outside their normal assignment. ' + pressureConsequences[pressureIndex] + '.',
    offer: 'They can contribute ' + capability + ' and request ' + resources.access.resource.toLowerCase()
      + ' from ' + resources.access.owner + '. ' + resources.access.obligation + '.',
    complication: secret?.cause ?? pressureConsequences[pressureIndex] + '.',
  } : null;
  return {
    attitude, goalIndex, goal: goals[goalIndex], pressureIndex, pressure: pressures[pressureIndex],
    mannerIndex, manner: manner[mannerIndex], boundaryIndex, boundary: boundaries[boundaryIndex],
    riskIndex, risk: risks[riskIndex], hook, mission, secret, network, party,
  };
}

export function publicCard(npc) {
  const { identity, biology, work, story } = npc;
  if (npc.encounter) return { name: identity.commonName, species: biology.name, role: 'Encounter',
    introduction: identity.commonName + ' · ' + biology.name + '. ' + npc.encounter.scene };
  const species = biology.name.split(' · ')[0];
  const role = work.competence.id === 'green' ? 'trainee ' + work.occupation.title.toLowerCase() : work.occupation.title.toLowerCase();
  const article = /^[aeiou]/i.test(role) ? 'an ' : 'a ';
  const speciesPhrase = species === 'Human' ? 'human' : species === 'Standard Vargr' ? 'standard Vargr' : species;
  const speciesArticle = /^[aeiou]/i.test(speciesPhrase) ? 'an ' : 'a ';
  const introduction = identity.commonName + ', ' + speciesArticle + speciesPhrase + ', introduces themself as ' + article + role + '. '
    + 'They ' + identity.visibleDetail.replace(/^(has|wears|is)\b/, match => ({ has: 'have', wears: 'wear', is: 'are' })[match]) + ' and '
    + story.manner.replace(/^(speaks|checks|uses|watches|tells)\b/, match => match.replace(/(?:es|s)$/, ending => match === 'uses' ? 'e' : '')) + '.';
  return { name: identity.commonName, species, role: stateTitle(role), introduction };
}

async function generateSourceEncounter(config, profile, { id, provenance, locks, rng }) {
  requireRule(config.context === 'mixed' && config.occupation === 'random' && config.competence === 'random'
    && config.secondary === 'none' && config.culture === 'auto' && config.lifeform === 'standard'
    && ['auto', 'off'].includes(config.psion.mode)
    && ![config.requiredSkills, config.skillGrants, Object.keys(config.requiredCharacteristics), config.characteristicBoons,
      config.conditions, config.augmentations, config.gear].some(values => values.length),
  'This species uses a published encounter block. Clear the applied character requirements or choose a characteristic profile.');
  requireRule(Object.keys(locks).every(key => ['name', 'species'].includes(key))
    && (!locks.species || locks.species === config.species), 'Unlock the earlier character fields to use this encounter profile.');
  const knownName = config.identity.commonName ?? locks.name;
  requireRule(!locks.name || locks.name === knownName, 'The common name is locked to ' + locks.name + '.');
  const naming = config.nameStyle && config.nameStyle !== 'auto'
    ? await generateName(config.nameStyle, rng('name', 'names'), {
      sex: config.identity.sex, commonName: knownName, nativeName: config.identity.nativeName,
    })
    : {
      commonName: knownName ?? profile.labels[(await rng('name', 'names').draw(profile.labels.length, 'Contact label')) - 1],
      nativeName: config.identity.nativeName,
      naming: { id: 'encounter-contact', label: 'Contact label', basis: 'House field label', source: profile.source, formalName: null },
    };
  const scene = profile.scenes[(await rng('encounter', 'narrative').draw(profile.scenes.length, 'Encounter situation')) - 1];
  const hits = typeof profile.hits === 'object'
    ? (await rng('encounter.hits', 'species').dice(profile.hits.count, 'Adult Hits')).total + profile.hits.add
    : profile.hits ?? null;
  const encounter = {
    scene, hits, movement: profile.movement ?? null, protection: profile.protection ?? null,
    habitat: profile.habitat, communication: config.identity.communication ?? profile.communication,
    traits: profile.traits, skills: profile.skills ?? [], attacks: profile.attacks ?? [],
  };
  const npc = {
    schema, id, provenance, encounter, identity: { ...config.identity, ...naming },
    biology: {
      adult: true, living: true, sophont: true, name: profile.name, profileId: config.species, source: profile.source,
      age: { years: typeof config.age === 'number' ? config.age : null },
    },
    places: {
      current: config.placement.current, lastKnown: config.placement.last,
      homeworld: config.homeworld ? { name: config.homeworld } : null,
    },
    controls: { config, locks, rollLocks: structuredClone(locks) },
  };
  npc.player = publicCard(npc);
  return npc;
}

export async function generateNpc(input = {}, state = {}) {
  const legacyNames = state.namingPack === legacyNamePack;
  const tablePacks = legacyNames ? legacyPacks : packs;
  const config = normalizeConfig(input, { legacyNames });
  const seed = text(state.seed, 'Seed', { required: true, max: 256 });
  const index = integer(state.index ?? 1, 'NPC index', 1, Number.MAX_SAFE_INTEGER);
  const locks = structuredClone(state.locks ?? {});
  const counters = { ...(state.counters ?? {}) };
  requireRule(object(locks) && Object.keys(locks).every(key => allFields.has(key)), 'The saved record contains an unknown lock field.');
  for (const [key, count] of Object.entries(counters)) {
    requireRule(allFields.has(key), 'The saved record contains an unknown reroll field.');
    integer(count, 'Reroll counter for ' + key, 0, Number.MAX_SAFE_INTEGER);
  }
  for (const key of statFields.filter(key => has(locks, key))) integer(locks[key], key + ' lock', key === 'stat.END' ? -99 : 0, 999);
  for (const [key, min, max] of [['upbringing', 1, 6], ['history', 0, 5], ['employment', 1, 6],
    ['access', 0, 5], ['goal', 0, 5], ['manner', 0, 5], ['boundary', 0, 5], ['risk', 0, 5]]) {
    if (has(locks, key)) integer(locks[key], key + ' lock', min, max);
  }
  const rolls = [];
  const rng = streams(seed, index, { ...counters, 'network.name': counters.network }, rolls, tablePacks);
  const id = await stableId(seed, index);
  const provenance = { version, ruleProfile, packs: tablePacks, seed, index, rerollCounters: counters, rolls };
  const sourceProfile = has(encounterSpecies, config.species) && encounterSpecies[config.species];
  if (sourceProfile) return generateSourceEncounter(config, sourceProfile, { id, provenance, locks, rng });
  const checkWork = config.requiredSkills.length || config.skillGrants.length || has(locks, 'skills');
  const profile = await chooseBiology(config, locks, rng, checkWork ? (candidate, ceiling) =>
    checkWorkPool(config, locks, candidate, ceiling) : null);
  if (has(locks, 'wings') && locks.wings !== null) {
    const selected = config.profileOptions.wings;
    requireRule(selected === 'random' || selected === locks.wings, 'Droyne wings are locked to ' + locks.wings + '.');
  }
  const prepared = await prepareMechanics(profile, config, locks, rng);
  const work = await chooseWork(config, locks, prepared, rng);
  const age = await rollAge(profile, work.tier, config, locks, rng('age', 'age'));
  const characteristics = await rollCharacteristics(prepared, work.skillTotal, rng);
  const namingStyle = legacyNames ? null : nameStyleFor(config.nameStyle, profile);
  const identity = await identityAndPlaces(config, profile, work, locks, rng, characteristics, namingStyle);
  const { employment, resources } = await employmentAndResources(config, work, locks, rng);
  const story = await storyFor(id, config, locks, work, resources, rng, namingStyle);
  const zeroes = ['STR', 'DEX', 'END'].filter(stat => characteristics[stat].injured <= 0);
  if (profile.special === 'barnai' && profile.culture === 'florian') {
    resources.affiliationSupport = {
      owner: 'Florian household or institution', companions: Math.max(0, 1 + characteristics.SOC.dm),
      description: 'Feskal attendants expected under the Florian profile. Establish their availability in the scene.',
    };
  }
  const qualifications = [...work.checks, ...Object.entries(config.requiredCharacteristics).map(([stat, minimum]) => ({
    skill: stat, minimum, actual: characteristics[stat].current, met: true,
  }))];
  const psi = prepared.psi && { ...prepared.psi, talents: work.skills.filter(entry => isTalent(entry.skill)) };
  const innate = (profile.special === 'droyne' && !profile.uncast ? ['Invisibility', 'Homing', 'Link']
    : profile.special === 'dvora' ? ['Unconscious Clairvoyance'] : []).map(name =>
    ({ name, source: profile.source, consciousUse: profile.special !== 'dvora' }));
  const npc = {
    schema, id, provenance,
    ...identity,
    biology: {
      profileId: profile.id, name: profile.name, variant: profile.variant, form: profile.form,
      wings: profile.wings ?? null, lifeform: config.lifeform, clone: config.clone,
      adult: true, living: profile.living, sophont: profile.sophont, source: profile.source,
      body: profile.body, fit: profile.fit, needs: profile.needs, movement: profile.movement, senses: profile.senses,
      manipulators: profile.manipulators, traits: profile.traits, attacks: profile.attacks,
      forbidden: profile.forbidden ?? [], status: profile.status, age,
    },
    mechanics: {
      characteristics, order: [...profile.order, ...(psi ? ['PSI'] : [])], upp: upp(profile, characteristics),
      grants: work.grants, skills: work.skills, skillTotal: work.skillTotal,
      skillLimit: 3 * (characteristics.INT.uninjured + characteristics.EDU.uninjured),
      condition: { status: profile.special === 'hiver' && zeroes.length === 3 ? 'Dormant'
        : zeroes.length >= 2 ? 'Unconscious' : config.conditions.some(item => item.active) ? 'Active conditions' : 'Uninjured',
      records: config.conditions },
    },
    work: {
      occupation: work.occupation, competence: work.tier,
      secondary: work.secondary && { ...work.secondary, rating: work.tier.ratings[3] },
      employment, qualifications,
    },
    resources, story, abilities: { psion: psi, augmentations: config.augmentations, innate },
    controls: {
      config, locks, rollLocks: structuredClone(locks), overrides: { ...config.identity, skillGrants: config.skillGrants },
      valueSources: { profile: profile.source, occupation: 'House occupation pack', age: 'House demographics or referee',
        identity: config.identity.commonName ? 'Referee'
          : identity.identity.naming?.label ?? 'Imperial common-name pack',
        equipment: 'Source on each mechanical item', characteristics: 'Species, recorded dice, conditions and augmentations' },
      validationMessages: [],
    },
  };
  const gear = resolveEquipment(npc, config, resources.possession);
  npc.equipment = gear.equipment;
  npc.resources.personalAssets = ['clothing', 'identification', 'communication', 'possession', ...gear.personalAssets];
  if (characteristics.TER?.current) npc.resources.territory = characteristics.TER.current;
  npc.derived = {
    attacks: gear.attacks,
    naturalProtection: Math.max(0, ...profile.traits.map(trait => trait.protection ?? 0)),
  };
  npc.validity = {
    mechanical: { status: 'valid', message: 'The roll record meets the selected generation rules.' },
    job: { status: qualifications.length ? 'qualified' : 'unspecified',
      message: qualifications.length ? 'Meets the requested skill and characteristic minimums.'
        : 'Add required duties or skill ratings to test job suitability.' },
    environment: gear.environment, combat: gear.combat,
  };
  npc.controls.validationMessages = [
    ...gear.environment.missing, ...gear.combat.missing,
    ...gear.equipment.filter(item => item.trainingShortfall > 0)
      .map(item => item.name + ' requires ' + item.training.skill + ' ' + item.training.level + '.'),
  ];
  const finalValues = lockValues(npc);
  for (const [key, value] of Object.entries(locks)) {
    requireRule(has(finalValues, key) && sameValue(finalValues[key], value),
      'Locked ' + (ordinaryFields.includes(key) ? key : key.replace('stat.', '')) + ' conflicts with the selected inputs. Unlock it to change it.');
  }
  npc.player = publicCard(npc);
  return npc;
}

export async function restoreNpc(saved) {
  requireRule(object(saved) && saved.schema === schema, 'Choose a referee JSON record exported by this generator.');
  const prov = saved.provenance;
  requireRule(object(prov) && prov.version === version && (sameValue(prov.packs, packs) || sameValue(prov.packs, legacyPacks)),
    'The saved record uses a different generator or data-pack version.');
  requireRule(object(saved.controls) && object(saved.controls.config), 'The saved record is missing its generator controls.');
  const restored = await generateNpc(saved.controls.config, { seed: prov.seed, index: prov.index, counters: prov.rerollCounters,
    locks: saved.controls.rollLocks ?? saved.controls.locks, namingPack: prov.packs.names });
  requireRule(restored.id === saved.id, 'The NPC ID does not match the seed and index.');
  const currentLocks = saved.controls.locks;
  const finalValues = lockValues(restored);
  requireRule(object(currentLocks) && Object.entries(currentLocks).every(([key, value]) =>
    has(finalValues, key) && sameValue(finalValues[key], value)), 'A saved lock does not match its generated value.');
  restored.controls.locks = structuredClone(currentLocks);
  return restored;
}
