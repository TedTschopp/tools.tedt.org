import { has, requireRule, skillKey } from './config.mjs';
import { isTalent, rating, resolveSkills } from './mechanics.mjs';
import { diceOutcomes, lcm, pickDice, sum, totalWeight } from './random.mjs';
import { backgrounds, occupationChoices, occupationTable, occupations, specialties, tiers, variants } from './tables.mjs';

const dice2 = diceOutcomes(2);
const tierFor = value => tiers.find(tier => value <= tier.high);
const tierWeights = Object.fromEntries(tiers.map(tier => [tier.id, dice2.filter(dice => tierFor(sum(dice)) === tier).length]));
const pairs = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
];

export function fieldsFor(row) {
  const variant = variants[row.variant] ?? {};
  const field = variant.field ?? row.field;
  return field ? [field] : variant.choices ?? specialties[row.profile] ?? [];
}

function foldSlots(row, field) {
  const template = occupations[row.profile];
  const variant = variants[row.variant] ?? {};
  const slots = [...(variant.slots ?? template.slots)].map(skill =>
    skill === 'Talent (field)' ? field : skill.replace('(field)', '(' + field + ')'));
  if (variant.swap) [slots[0], slots[variant.swap]] = [slots[variant.swap], slots[0]];
  if (variant.swapIn) {
    const [index, skill] = variant.swapIn;
    slots[index] = skill.replace('(field)', '(' + field + ')');
  }
  return { ...row, field, slots, familiarities: template.familiarities, kit: variant.kit ?? template.kit };
}

function expandRows(rows, weights, explicitField, label, chooseTalentWeights = null) {
  const groups = rows.map(row => {
    const fields = fieldsFor(row);
    const fixed = row.field ?? variants[row.variant]?.field;
    if (explicitField && fixed && explicitField.toLowerCase() !== fixed.toLowerCase()) return null;
    const match = fields.find(field => field.toLowerCase() === explicitField?.toLowerCase());
    if (explicitField && (!fields.length || (!match && !['scientist', 'worker', 'performer'].includes(row.profile)))) return null;
    const choices = explicitField ? [match ?? explicitField.toLowerCase()] : fields.length ? fields : [null];
    const items = choices.map(field => ({
      value: foldSlots(row, field),
      weight: chooseTalentWeights ? (chooseTalentWeights[field] ?? 1) : 1,
    })).filter(choice => choice.weight);
    return { row, items, weight: weights[row.id] ?? 1, denominator: totalWeight(items) };
  }).filter(group => group?.weight && group.denominator > 0n);
  requireRule(groups.length || !explicitField, '“' + explicitField + '” is incompatible with the selected ' + label + '.');
  const scale = groups.reduce((value, group) => lcm(value, group.denominator), 1n);
  return groups.flatMap(group => group.items.map(({ value, weight }) => ({
    value, label: value.field ? value.title + ' · ' + value.field : value.title,
    weight: BigInt(group.weight * weight) * (scale / group.denominator),
  })));
}

export function generatedGrants(profile, work, secondary, tier, background, overrides) {
  const rated = work.slots.map((skill, index) => ({
    skill: index === 3 && secondary ? secondary.slots[0] : skill,
    level: tier.ratings[index],
    source: index === 3 && secondary ? 'Secondary training · support 3' : ['Occupation · primary', 'Occupation · support 1',
      'Occupation · support 2', 'Occupation · support 3'][index],
  }));
  return [
    ...rated,
    ...work.familiarities.map(skill => ({ skill, level: 0, source: 'Occupational familiarity' })),
    ...background.skills.map(skill => ({ skill, level: 0, source: 'Upbringing · ' + background.name })),
    ...profile.grants.map(grant => ({ ...grant, source: 'Species or culture · ' + profile.source })),
    ...overrides.map(grant => ({ ...grant, source: 'Referee · ' + grant.reason })),
  ];
}

export const skillValues = skills => Object.fromEntries(skills.map(entry => [skillKey(entry.skill), entry.level]));
function matchesSkills(skills, lock) {
  const exact = skillValues(skills);
  return Object.keys(exact).length === Object.keys(lock).length
    && Object.entries(lock).every(([key, value]) => exact[key] === value);
}

function jobRequirements(skills, requirements) {
  return requirements.map(({ skill, level }) => {
    const actual = rating(skills, skill);
    return { skill, minimum: level, actual, met: actual !== null && actual >= level };
  });
}

function primaryRows(config, locks) {
  let selected = config.psion.mode === 'trained' ? 'psion' : config.occupation;
  if (config.psion.mode === 'trained' && !['random', 'psion'].includes(config.occupation)) {
    requireRule(false, 'The trained psion profile replaces the normal occupation. Select Psionic specialist or clear the other occupation.');
  }
  if (locks.occupation) {
    requireRule(selected === 'random' || selected === locks.occupation.id, 'Occupation is locked to ' + locks.occupation.title + '.');
    selected = locks.occupation.id;
  }
  return selected === 'random' ? occupationTable : occupationChoices.filter(row => row.id === selected);
}

function buildWorkPool(config, locks, prepared) {
  const profile = prepared.profile;
  const desiredTier = locks.competence ?? config.competence;
  requireRule(!locks.competence || config.competence === 'random' || config.competence === locks.competence,
    'Competence is locked to ' + locks.competence + '.');
  const eligibleTiers = tiers.filter(tier => (desiredTier === 'random' || desiredTier === tier.id)
    && (config.psion.mode !== 'trained' || tier.id !== 'green'));
  requireRule(eligibleTiers.length, 'The trained psion profile requires Competent or better.');
  if (config.skillGrants.some(grant => isTalent(grant.skill))) {
    requireRule(prepared.psi && (prepared.psi.mode === 'trained' || profile.culture === 'zhodani'),
      'An explicit psionic talent grant requires a trained psion or Zhodani training profile.');
  }
  requireRule(!config.skillGrants.some(grant => profile.forbidden?.includes(grant.skill)),
    'A supplied skill is unavailable to the ' + profile.name + ' profile.');
  const primary = expandRows(primaryRows(config, locks), locks.occupation || config.occupation !== 'random'
    ? {} : config.occupationWeights, config.specialty ?? locks.occupation?.field, 'occupation',
  config.psion.mode === 'trained' ? config.psion.weights : null);
  requireRule(primary.length, 'There are no enabled primary occupations or psionic talents.');
  function optionsForSecondary(entry) {
    const cross = config.secondary;
    const locked = has(locks, 'secondary');
    const lock = locks.secondary;
    if (cross === 'none') {
      requireRule(!locked || !lock, 'Secondary training is locked to ' + lock?.title + '.');
      return { pool: [{ weight: 1n, value: null, label: 'Off' }], automatic: false };
    }
    if (locked && lock && cross !== 'random' && cross !== lock.id) return { pool: [], automatic: false };
    if (locked && !lock && cross !== 'random') return { pool: [], automatic: false };
    const random = cross === 'random' && !locked;
    const rowId = cross === 'random' ? lock?.id : cross;
    const rows = locked && !lock ? [] : rowId
      ? occupationChoices.filter(row => row.id === rowId) : occupationTable;
    const any = expandRows(rows, rowId ? {} : config.occupationWeights, rows.length
      ? config.secondarySpecialty ?? lock?.field : null, 'secondary occupation');
    const available = any.filter(item => !entry.value.slots.some(skill => skillKey(skill) === skillKey(item.value.slots[0])));
    if (random) {
      const mass = totalWeight(available);
      return { pool: mass ? [{ value: null, weight: 5n * mass, label: 'Original support 3' }, ...available]
        : [{ value: null, weight: 1n, label: 'No eligible secondary occupation' }],
      automatic: true };
    }
    if (locked && !lock) return { pool: [{ value: null, weight: 1n, label: 'Locked: no secondary training' }], automatic: false };
    return { pool: available, automatic: false };
  }
  const choices = primary.map(entry => {
    const secondary = optionsForSecondary(entry);
    return { ...entry, secondary, denominator: totalWeight(secondary.pool) };
  }).filter(entry => entry.denominator > 0n);
  requireRule(choices.length, 'The secondary occupation’s primary skill must differ from the first occupation’s four rated slots.');
  const scale = choices.reduce((value, entry) => lcm(value, entry.denominator), 1n);
  const forbidden = profile.forbidden ?? [];
  const mandatory = profile.grants;
  const minTotalBound = prepared.maxSkillTotal;
  const examineAll = has(locks, 'skills') || config.requiredSkills.length || config.skillGrants.length
    || minTotalBound < 8 + sum(mandatory.map(grant => grant.level));
  function workFor(background) {
    const result = [];
    for (const entry of choices) {
      const secondary = [];
      for (const candidate of entry.secondary.pool) {
        const relatedSkills = [...entry.value.slots.slice(0, 3), candidate.value?.slots[0] ?? entry.value.slots[3],
          ...entry.value.familiarities, ...background.skills];
        if (forbidden.some(skill => relatedSkills.includes(skill))) continue;
        const viable = eligibleTiers.filter(tier => {
          if (!examineAll) return true;
          const grants = generatedGrants(profile, entry.value, candidate.value, tier, background, config.skillGrants);
          const skills = resolveSkills(grants);
          return sum(skills.map(skill => skill.level)) <= minTotalBound
            && (!has(locks, 'skills') || matchesSkills(skills, locks.skills))
            && jobRequirements(skills, config.requiredSkills).every(result => result.met);
        });
        const evidence = sum(viable.map(tier => tierWeights[tier.id]));
        if (evidence) secondary.push({ ...candidate, value: { occupation: candidate.value, tiers: viable },
          weight: candidate.weight * BigInt(evidence), originalWeight: candidate.weight, evidence });
      }
      const weight = entry.weight * (scale / entry.denominator) * totalWeight(secondary);
      if (weight) result.push({ ...entry, weight, secondary: { ...entry.secondary, eligible: secondary } });
    }
    return result;
  }
  return workFor;
}

function completeBackground(row, indices) {
  const [name, ...skills] = backgrounds[row - 1];
  return { row, name, skills: indices.map(index => skills[index]).sort() };
}

function birthPool(config, locks) {
  return backgrounds.flatMap((_, index) => {
    const row = index + 1;
    const weight = config.backgroundWeights[row] ?? 1;
    if (!weight || (locks.upbringing && locks.upbringing !== row)) return [];
    return pairs.map(pair => ({ value: completeBackground(row, pair), weight }));
  }).filter(entry => !locks.background || entry.value.skills.join('|') === locks.background.join('|'));
}

async function rollBackground(pool, config, locks, workFor, rng) {
  const backgroundDependent = has(locks, 'skills') || config.requiredSkills.some(entry => entry.level === 0)
    || (!!locks.background && !locks.upbringing);
  let choices = pool;
  if (backgroundDependent) {
    choices = pool.map(entry => {
      const work = workFor(entry.value);
      return { ...entry, work, weight: BigInt(entry.weight) * totalWeight(work) };
    }).filter(entry => entry.weight);
    requireRule(choices.length, workConflict(config, locks));
  }
  const rowRng = rng('upbringing', 'culture');
  const rowChoices = [...new Set(choices.map(entry => entry.value.row))].map(row => ({
    value: row, label: backgrounds[row - 1][0], weight: totalWeight(choices.filter(entry => entry.value.row === row)),
  }));
  const row = rowChoices.length === 6 && rowChoices.every(choice => choice.weight === rowChoices[0].weight)
    ? await rowRng.draw(6, 'Upbringing') : await rowRng.pick(rowChoices, 'Eligible upbringing');
  const available = choices.filter(entry => entry.value.row === row);
  const bgRng = rng('background', 'culture');
  if (available.length === 6 && available.every(entry => entry.weight === available[0].weight)) {
    const indices = [0, 1, 2, 3];
    const first = indices.splice((await bgRng.draw(4, 'Background skill 1')) - 1, 1)[0];
    const second = indices[(await bgRng.draw(3, 'Background skill 2')) - 1];
    const selected = completeBackground(row, [first, second]);
    bgRng.log({ label: 'Background grants', result: selected.skills.join(', '), method: 'without replacement' });
    return { background: selected, work: workFor(selected) };
  }
  const entry = await bgRng.pick(available.map(entry => ({ value: entry, weight: entry.weight, label: entry.value.skills.join(', ') })),
    'Eligible background grants');
  return { background: entry.value, work: entry.work ?? workFor(entry.value) };
}

function workConflict(config, locks) {
  const requirement = config.requiredSkills.map(entry => entry.skill + ' ' + entry.level + '+').join(', ');
  if (has(locks, 'skills')) return 'The locked skill ratings conflict with the current occupation, background, competence, or requirements'
    + (requirement ? ' (' + requirement + ')' : '') + '. Unlock skills to change them.';
  if (requirement) return 'No eligible occupation and competence can provide ' + requirement + ' with the selected profile and settings.';
  return 'There is no compatible occupation, training, or competence under these settings and the 3 × (INT + EDU) skill limit.';
}

export function checkWorkPool(config, locks, profile, maxSkillTotal) {
  try {
    const possible = buildWorkPool(config, locks, {
      profile, maxSkillTotal, psi: config.psion.mode === 'trained' ? { mode: 'trained' } : null,
    });
    const birth = birthPool(config, locks);
    if (!birth.length) return 'The upbringing weights and background locks leave no eligible pair of background skills.';
    return birth.some(entry => possible(entry.value).length) ? null : workConflict(config, locks);
  } catch (error) {
    if (error.name !== 'RuleConflict') throw error;
    return error.message;
  }
}

export async function chooseWork(config, locks, prepared, rng) {
  if (locks.occupation && config.specialty) requireRule(locks.occupation.field?.toLowerCase() === config.specialty.toLowerCase(),
    'The occupation specialty is locked to ' + (locks.occupation.field ?? 'none') + '.');
  const workFor = buildWorkPool(config, locks, prepared);
  const birth = birthPool(config, locks);
  requireRule(birth.length, 'The upbringing weights and background locks leave no eligible pair of background skills.');
  const { background, work } = await rollBackground(birth, config, locks, workFor, rng);
  requireRule(work.length, workConflict(config, locks));
  const rows = [...new Set(work.map(entry => entry.value.id))].map(id => {
    const options = work.filter(entry => entry.value.id === id);
    return { value: options, label: id + ' · ' + options[0].value.title, weight: totalWeight(options) };
  });
  const occRng = rng('occupation', 'occupation');
  let row;
  if (rows.length === 36 && rows.every(entry => entry.weight === rows[0].weight)) {
    const roll = (await occRng.draw(6, 'd66 tens')) * 10 + await occRng.draw(6, 'd66 units');
    row = rows.find(entry => entry.value[0].value.id === String(roll)).value;
  } else row = await occRng.pick(rows, 'Eligible occupation row');
  const specialty = await rng('specialty', 'occupation').pick(row.map(entry => ({ ...entry, value: entry })),
    'Resolved specialty');
  const occ = specialty.value;
  const secondaryRng = rng('secondary', 'occupation');
  const eligible = specialty.secondary.eligible;
  let branch;
  if (specialty.secondary.automatic && eligible.length === specialty.secondary.pool.length
    && eligible.every(entry => entry.evidence === eligible[0].evidence)) {
    const roll = await secondaryRng.draw(6, 'Cross-training gate');
    branch = roll === 6 && eligible.length > 1
      ? await secondaryRng.pick(eligible.slice(1), 'Secondary occupation and specialty') : eligible[0].value;
    if (roll === 6 && eligible.length === 1) secondaryRng.log({ label: 'Cross-training', result: 'No eligible second occupation' });
  } else branch = await secondaryRng.pick(eligible, 'Eligible secondary training');
  const tierDice = dice2.filter(dice => branch.tiers.includes(tierFor(sum(dice))));
  const compRng = rng('competence', 'competence');
  const rolled = await pickDice(compRng, tierDice.map(dice => ({ dice, weight: 1 })), 2, 'Occupational competence');
  const tier = tierFor(sum(rolled));
  const secondary = branch.occupation;
  const grants = generatedGrants(prepared.profile, occ, secondary, tier, background, config.skillGrants);
  const skills = resolveSkills(grants);
  return {
    background, grants, skills, tier, occupation: occ, secondary,
    skillTotal: sum(skills.map(skill => skill.level)),
    checks: jobRequirements(skills, config.requiredSkills),
  };
}
