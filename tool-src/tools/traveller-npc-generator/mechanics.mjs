import { family, has, requireRule, skillKey } from './config.mjs';
import { compatibleCulture, species } from './species.mjs';
import { characteristicOrder, core, coreUrl, specialtyFamilies, specialties } from './tables.mjs';
import { diceOutcomes, faces, pickDice, sum } from './random.mjs';

const physical = characteristicOrder.slice(0, 3);
const usualDice = { count: 2, sides: 6, add: 0 };
const kkreeForms = {
  Patriarch: { STR: 6, INT: 2, EDU: 2 },
  'Non-patriarch male': { STR: 6, INT: -4, EDU: -4 },
  Female: { STR: 3, EDU: -5 },
};
const droyneForms = {
  Worker: { STR: 2, END: 4 },
  Warrior: { STR: 3, DEX: 1, END: 2 },
  Drone: { DEX: 1, INT: 3, EDU: 2 },
  Technician: { DEX: 2, INT: 3, EDU: 1 },
  Sport: { DEX: 1, END: 1, INT: 2, EDU: 2 },
  Leader: { INT: 4, EDU: 2 },
};
const ascondiForms = {
  Hunter: { STR: 1, END: 2, INT: -3, EDU: -3 },
  Finder: { STR: -2, DEX: 2, END: 1, INT: 2 },
  Hearthkeeper: { STR: -2, END: 1, EDU: 2, SOC: 2 },
};
const psiLearning = [
  ['Awareness', 1], ['Clairvoyance', 3], ['Telekinesis', 2], ['Telepathy', 4],
  ['Teleportation', 0], ['Zhodani', -3],
];

export function dm(score) {
  if (score === 0) return -3;
  if (score <= 2) return -2;
  if (score <= 5) return -1;
  if (score <= 8) return 0;
  if (score <= 11) return 1;
  if (score <= 14) return 2;
  return 3;
}

function profileForm(id, base, form, culture, config) {
  const profile = { ...base, id, form, culture, modifiers: { ...base.modifiers }, minimums: { ...base.minimums },
    dice: { ...base.dice }, order: [...base.order], grants: [...base.grants], fixed: {}, status: null };
  if (base.special === 'kkree') {
    profile.modifiers = kkreeForms[form];
    if (form === 'Patriarch') profile.grants.push(...['Patriarchy', 'Melee', 'Recon', 'Survival'].map(skill => ({ skill, level: 0 })));
  }
  if (base.special === 'droyne') profile.modifiers = droyneForms[form];
  if (base.special === 'hierate') {
    profile.minimums.SOC = 0;
    if (form === 'Male') {
      profile.order.push('TER');
      profile.minimums.TER = 0;
      profile.fixed.TER = config.profileOptions.territory ?? 0;
    }
  }
  if (base.special === 'ascondi') {
    profile.modifiers = ascondiForms[form];
    profile.minimums = { STR: 2, INT: 2, EDU: 2 };
    profile.dice.SOC = { count: 1, add: 3 };
    if (config.profileOptions.ascondiSoc !== null) profile.fixed.SOC = config.profileOptions.ascondiSoc;
    if (form === 'Hunter') profile.grants.push({ skill: 'Survival', level: 1 });
    if (form === 'Finder') profile.grants.push({ skill: 'Jack-of-all-Trades', level: 1 });
  }
  if (base.special === 'vegan' && form === 'Established tuhuir') profile.modifiers.SOC = 0;
  if (base.special === 'whistler' && form !== 'Independent neuter') profile.needs = [...base.needs, 'whistlerGroup'];
  if (base.special === 'empire') {
    profile.minimums.SOC = 0;
    profile.fixed.SOC = base.adultOptions.indexOf(form);
  }
  return profile;
}

function evaluateStat(profile, config, stat, raw, baseline, placed) {
  const augment = sum(config.augmentations.filter(item => item.active).map(item => item.modifiers[stat] ?? 0));
  const loss = sum(config.conditions.filter(item => item.active && item.characteristic === stat).map(item =>
    profile.special === 'kkree' && stat === 'END' ? Math.floor(item.loss / 2) : item.loss));
  const uninjured = baseline + augment;
  const injured = profile.special === 'hiver' && stat === 'END' ? uninjured - loss : Math.max(0, uninjured - loss);
  const current = placed && profile.special === 'aquamorph' && stat === 'STR' ? Math.floor(injured / 2) : injured;
  return { raw, adjustment: profile.modifiers[stat] ?? 0, baseline, augment, loss, uninjured, injured, current, dm: dm(Math.max(0, current)) };
}

const diceCache = new Map();
function outcomes(dice) {
  const key = dice.count + 'd' + dice.sides;
  if (!diceCache.has(key)) diceCache.set(key, diceOutcomes(dice.count, dice.sides));
  return diceCache.get(key);
}

function ancestralTerritory(roll) {
  const clan = roll[0] >= 4 ? 1 : 0;
  const ancient = [0, 0, 1, 1, 2, 2, 3][roll[1] + clan - 1];
  const values = [0, 0, 0, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6];
  let territory = ancient;
  for (const result of [roll[2] + roll[3], roll[4] + roll[5]]) {
    territory = result === 2 ? 0 : Math.max(0, territory + values[result]);
  }
  return territory;
}

function statOptions(profile, config, locks, stat, social = null) {
  const hierarchy = profile.special === 'hierate' && stat === 'SOC';
  const fixed = has(profile.fixed, stat);
  const model = { ...usualDice, ...profile.dice[stat] };
  if (hierarchy) model.count = 6;
  const boon = config.characteristicBoons.includes(stat);
  if (boon) model.count = 3;
  const dice = fixed ? [[]] : outcomes(model);
  const low = profile.minimums[stat] ?? 1;
  const minimum = config.requiredCharacteristics[stat] ?? -99;
  const lock = locks['stat.' + stat];
  const placed = config.placement.medium === 'breathable'
    || ['vacuum', 'unbreathable'].includes(config.placement.medium);
  const options = [];
  for (const path of dice) {
    const raw = fixed ? profile.fixed[stat] : hierarchy ? ancestralTerritory(path)
      : sum(path) - (boon ? Math.min(...path) : 0) + model.add;
    let baseline = Math.min(profile.maximums?.[stat] ?? Infinity, Math.max(low, raw + (profile.modifiers[stat] ?? 0)));
    if (stat === 'SOC' && social?.psi >= 9 && baseline <= 9) baseline = 10;
    if (stat === 'EDU' && social) {
      baseline = Math.min(baseline, social.soc);
      if (social.soc >= 10 && baseline <= 7) baseline = 8;
    }
    const value = evaluateStat(profile, config, stat, raw, baseline, placed);
    if (value.uninjured >= low && value.current >= minimum && (lock === undefined || value.current === lock)) {
      options.push({ dice: path, weight: 1, value });
    }
  }
  return { options, model, fixed, boon };
}

function profileIssue(profile, config, locks) {
  const supported = [...profile.order, 'PSI'];
  const applied = [...config.conditions.filter(item => item.active).map(item => item.characteristic),
    ...config.augmentations.filter(item => item.active).flatMap(item => Object.keys(item.modifiers))];
  const inputs = [...Object.keys(config.requiredCharacteristics), ...Object.keys(locks)
    .filter(key => key.startsWith('stat.')).map(key => key.slice(5)), ...applied];
  const absent = inputs.find(stat => !supported.includes(stat));
  if (absent) return profile.name + ' has no ' + absent + ' characteristic.';
  const boonConflict = config.characteristicBoons.find(stat => {
    const dice = { ...usualDice, ...profile.dice[stat] };
    return !profile.order.includes(stat) || has(profile.fixed, stat) || (profile.special === 'hierate' && stat === 'SOC')
      || dice.count !== 2 || dice.sides !== 6 || dice.add !== 0 || (profile.culture === 'zhodani' && stat === 'SOC');
  });
  if (boonConflict) return 'The Companion Boon option needs ordinary 2D for ' + boonConflict + ' in this profile.';
  if (applied.includes('PSI')) return 'Use Current PSI to record spent PSI. PSI condition and augmentation rules require a campaign-specific adapter.';
  const age = config.clone?.chronologicalAge ?? config.age;
  if (typeof age === 'number' && ((profile.age.adult === null ? age < 1 : age < profile.age.adult)
    || (profile.age.maximum !== undefined && age > profile.age.maximum))) {
    return 'Age ' + age + ' is outside the supported ' + profile.name + ' adult profile.';
  }
  if (config.augmentations.some(item => item.active && item.requiresSpecies.length && !item.requiresSpecies.includes(profile.id))) {
    return 'An active augmentation is incompatible with ' + profile.name + '.';
  }
  if ((profile.special === 'droyne' || profile.culture === 'zhodani') && config.psion.mode === 'off') {
    return profile.name + ' in this rules profile requires PSI testing. Choose profile default or enable psionics.';
  }
  if (profile.special === 'dvora' && config.psion.mode === 'off') return 'Dvora retain their innate unconscious Clairvoyance.';
  if (profile.psionics === 'prohibited' && ['trained', 'latent'].includes(config.psion.mode)) return 'The referee profile prohibits psionics.';
  const forbidden = config.requiredSkills.find(entry => profile.forbidden?.includes(entry.skill));
  if (forbidden) return profile.name + ' cannot meet ' + forbidden.skill + ' ' + forbidden.level + '+. This profile prohibits the skill.';
  if (config.profileOptions.territory !== null && profile.special !== 'hierate') return 'Personal Territory applies to the Hierate profile.';
  if (config.profileOptions.territory !== null && profile.form !== 'Male') return 'Personal Territory requires the male Hierate characteristic model.';
  if (config.profileOptions.wings !== 'random' && profile.special !== 'droyne') return 'The wings option applies to Droyne.';
  if (locks.wings && profile.special !== 'droyne') return 'Locked Droyne wings require a Droyne profile.';
  if (config.profileOptions.ascondiSoc !== null && profile.special !== 'ascondi') return 'Ascondi base SOC applies to Ascondi.';
  if (config.profileOptions.zhodaniHighPsi && profile.culture !== 'zhodani') return 'The high-PSI option requires Zhodani Consulate culture.';
  if (profile.special !== 'droyne' && profile.culture !== 'zhodani' && !['trained', 'latent'].includes(config.psion.mode)
    && (has(config.requiredCharacteristics, 'PSI') || has(locks, 'stat.PSI') || config.psion.current !== null)) {
    return 'PSI was requested, but this profile has no active PSI module.';
  }
  return null;
}

function filterWorkProfile(profile, config, locks, workIssue) {
  const ceiling = 3 * sum(['INT', 'EDU'].map(stat => {
    const entries = statOptions(profile, config, locks, stat).options;
    return Math.max(0, ...entries.map(entry => entry.value.uninjured));
  }));
  function withGrant(skill, level) {
    return { ...profile, grants: [...profile.grants, { skill, level }] };
  }
  if (profile.special === 'droyne') {
    const selected = config.profileOptions.wings === 'random' ? locks.wings ?? 'random' : config.profileOptions.wings;
    const plain = selected === 'random' || selected === 'vestigial' ? workIssue(profile, ceiling) : 'Wing size is set.';
    const flight = selected !== 'vestigial' ? workIssue(withGrant('Flight', 0), ceiling) : 'Wing size is set.';
    profile.allowedWingRolls = faces.filter(roll => roll <= 3 ? !plain : !flight);
    return profile.allowedWingRolls.length ? null : selected === 'vestigial' ? plain : flight ?? plain;
  }
  if (profile.special === 'hierate' && profile.form === 'Male') {
    const ranks = statOptions(profile, config, locks, 'SOC').options;
    const low = ranks.some(entry => entry.value.baseline < 10) ? workIssue(profile, ceiling) : 'SOC is 10+.';
    const high = ranks.some(entry => entry.value.baseline >= 10) ? workIssue(withGrant('Leadership', 1), ceiling) : 'SOC is below 10.';
    profile.hierateRankFilter = !low && !high ? null : !low ? 'low' : !high ? 'high' : null;
    return !low || !high ? null : ranks.some(entry => entry.value.baseline < 10) ? low : high;
  }
  return workIssue(profile, ceiling);
}

export async function chooseBiology(config, locks, rng, workIssue) {
  const available = config.customProfile ? { ...species, custom: config.customProfile } : species;
  const lockedSpecies = typeof locks.species === 'object' ? locks.species?.id : locks.species;
  if (lockedSpecies === 'custom') requireRule(JSON.stringify(locks.species.definition) === JSON.stringify(config.customProfile),
    'The locked referee species definition conflicts with the current profile.');
  const problems = new Set();
  const pool = [];
  for (const [id, base] of Object.entries(available)) {
    const weight = config.species === 'random' ? (config.population[id] ?? base.weight) : Number(config.species === id);
    if (!weight || (lockedSpecies && lockedSpecies !== id)) continue;
    const culture = config.culture === 'auto' ? base.culture : config.culture;
    if (!compatibleCulture(id, culture, base)) {
      problems.add(base.name + ' is incompatible with the selected culture rules.');
      continue;
    }
    const availableForms = base.adultOptions ?? [null];
    const requested = config.profileOptions.adultForm ?? locks.form ?? null;
    const forms = [];
    for (const form of availableForms) {
      if (requested !== null && requested !== form) continue;
      const profile = profileForm(id, base, form, culture, config);
      const problem = profileIssue(profile, config, locks);
      if (problem) {
        problems.add(problem);
        continue;
      }
      const impossible = profile.order.find(stat =>
        !(culture === 'zhodani' && ['SOC', 'EDU'].includes(stat))
        && (has(locks, 'stat.' + stat) || has(config.requiredCharacteristics, stat))
        && !statOptions(profile, config, locks, stat).options.length);
      if (impossible) {
        problems.add(profile.name + ' has no eligible roll for ' + impossible
          + (has(locks, 'stat.' + impossible) ? ' locked at ' + locks['stat.' + impossible]
            : ' ' + config.requiredCharacteristics[impossible] + '+') + '.');
        continue;
      }
      if (workIssue && culture !== 'zhodani') {
        const disqualified = filterWorkProfile(profile, config, locks, workIssue);
        if (disqualified) {
          problems.add(disqualified);
          continue;
        }
      }
      const formWeight = base.special === 'hierate' ? (form === 'Male' ? 10 : 26) : 1;
      forms.push({ weight: formWeight, label: form, value: profile });
    }
    if (forms.length) pool.push({ value: forms, label: base.name, weight, id });
    else if (requested && !availableForms.includes(requested)) problems.add(requested + ' is unavailable for ' + base.name + '.');
  }
  requireRule(pool.length, lockedSpecies && config.species !== 'random' && lockedSpecies !== config.species
    ? 'Species is locked to ' + available[lockedSpecies]?.name + '. Unlock it to select another profile.'
    : [...problems].join(' ') || 'The population has no enabled species that satisfy the settings.');
  const speciesRng = rng('species', 'species');
  let forms;
  if (pool.length === 3 && pool.every(entry => entry.weight === species[entry.id].weight)
    && pool.every(entry => ['human', 'vargr', 'aslan'].includes(entry.id))) {
    const roll = await speciesRng.draw(100, 'Starter population');
    forms = pool.find(entry => entry.id === (roll <= 80 ? 'human' : roll <= 92 ? 'vargr' : 'aslan')).value;
  } else {
    forms = await speciesRng.pick(pool, 'Eligible species');
  }
  const formRng = rng('form', 'species');
  const independent = forms[0].value.special === 'whistler' && forms.length > 1
    ? forms.find(entry => entry.value.form === 'Independent neuter') : null;
  const profile = independent?.value ?? await formRng.pick(forms, 'Adult form or caste');
  if (independent) formRng.log({ label: 'Adult form', result: profile.form, method: 'source default' });
  if (profile.special === 'droyne') {
    const wingRng = rng('wings', 'species');
    const wings = config.profileOptions.wings === 'random' ? locks.wings ?? 'random' : config.profileOptions.wings;
    if (wings === 'random') {
      const allowed = profile.allowedWingRolls ?? faces;
      const roll = allowed.length === 6 ? await wingRng.draw(6, 'Wing size')
        : await wingRng.pick(allowed.map(value => ({ value, weight: 1, label: value })), 'Eligible wing sizes');
      profile.wings = roll <= 3 ? 'vestigial' : roll <= 5 ? 'small' : 'large';
    } else {
      profile.wings = wings;
      wingRng.log({ label: 'Wing size', result: wings, method: 'referee selection' });
    }
    if (profile.wings !== 'vestigial') profile.grants.push({ skill: 'Flight', level: 0 });
  }
  if (profile.special === 'hiver') {
    profile.status = (await rng('senses', 'species').dice(2, 'Sense of smell')).total >= 9
      ? 'Limited sense of smell (DM−2 on relevant checks)' : 'No sense of smell';
  }
  return profile;
}

function psiOptions(config, locks, model, active) {
  const requested = config.requiredCharacteristics.PSI ?? 0;
  const locked = locks['stat.PSI'];
  if (!active) return [];
  return outcomes(model).flatMap(dice => {
    const maximum = sum(dice) + model.add;
    const current = config.psion.current ?? locked ?? maximum;
    return current <= maximum && current >= requested && (locked === undefined || current === locked)
      ? [{ dice, weight: 1, maximum, current }] : [];
  });
}

async function pickStat(pool, stat, rng, label = 'Raw ' + stat) {
  requireRule(pool.options.length, 'No eligible roll for ' + stat + ' under the current requirements and locks.');
  const field = rng('stat.' + stat, 'characteristics');
  const dice = pool.fixed ? [] : await pickDice(field, pool.options, pool.model.count, label + (pool.boon ? ' · Boon, keep two' : ''), pool.model.sides);
  const selected = pool.options.find(entry => entry.dice.every((face, index) => face === dice[index])).value;
  field.log({ label: stat, result: selected.current, raw: selected.raw,
    method: pool.fixed ? 'profile or referee value' : 'resolved characteristic' });
  return selected;
}

export async function prepareMechanics(profile, config, locks, rng) {
  const zhodani = profile.culture === 'zhodani';
  const mandatory = zhodani || profile.special === 'droyne';
  const trained = config.psion.mode === 'trained';
  const active = mandatory || trained || config.psion.mode === 'latent';
  const model = zhodani && config.profileOptions.zhodaniHighPsi ? { ...usualDice, count: 1, add: 6 } : usualDice;
  const available = psiOptions(config, locks, model, active);
  const psiRng = rng('stat.PSI', 'psionics');
  let social = null;
  let psi = null;
  if (active) {
    if (config.psion.mode === 'latent' && config.psion.potential !== null && !mandatory) {
      const maximum = config.psion.potential;
      const current = config.psion.current ?? locks['stat.PSI'] ?? maximum;
      requireRule(current <= maximum && current >= (config.requiredCharacteristics.PSI ?? 0)
        && (!has(locks, 'stat.PSI') || current === locks['stat.PSI']), 'The supplied PSI potential cannot meet the current PSI requirement or lock.');
      psi = { maximum, current, raw: null };
      psiRng.log({ label: 'Latent PSI potential', result: maximum, method: 'referee value' });
    } else {
      requireRule(available.length, 'No eligible PSI roll satisfies the current PSI settings or lock.');
      if (zhodani) {
        const cache = new Map();
        for (const entry of available) {
          if (!cache.has(entry.maximum)) {
            const soc = statOptions(profile, config, locks, 'SOC', { psi: entry.maximum });
            const pairs = soc.options.flatMap(rank => {
              const edu = statOptions(profile, config, locks, 'EDU', { psi: entry.maximum, soc: rank.value.baseline });
              return edu.options.length ? [{ ...rank, weight: edu.options.length, edu }] : [];
            });
            cache.set(entry.maximum, pairs);
          }
          entry.weight = sum(cache.get(entry.maximum).map(rank => rank.weight));
        }
        const eligible = available.filter(entry => entry.weight);
        requireRule(eligible.length, 'Zhodani PSI, SOC and EDU cannot meet the selected minimums or locks together.');
        const dice = await pickDice(psiRng, eligible, model.count, 'Zhodani PSI potential', model.sides);
        psi = eligible.find(entry => entry.dice.every((face, index) => face === dice[index]));
        const ranks = cache.get(psi.maximum);
        const rank = await pickStat({ options: ranks, model: usualDice, fixed: false }, 'SOC', rng, 'Social classification');
        const edu = ranks.find(entry => entry.value.raw === rank.raw).edu;
        social = { rank, edu };
        profile.status = rank.baseline >= 11 ? 'Noble' : rank.baseline === 10 ? 'Intendant' : 'Prole';
        if (rank.baseline >= 10) {
          const talentRng = rng('psionicTraining', 'psionics');
          for (const [index, [skill, bonus]] of psiLearning.entries()) {
            const attempt = await talentRng.dice(2, 'Learn ' + skill);
            if (attempt.total + dm(psi.maximum) + bonus - index >= 8) profile.grants.push({ skill, level: 0 });
          }
        }
      } else {
        const dice = await pickDice(psiRng, available, model.count, 'PSI potential', model.sides);
        psi = available.find(entry => entry.dice.every((face, index) => face === dice[index]));
      }
      psi = { maximum: psi.maximum, current: psi.current, raw: psi.maximum };
    }
    psi = { ...psi, dm: dm(psi.current), mode: trained ? 'trained' : 'tested',
      source: zhodani || profile.special === 'droyne' ? profile.source : core + ', pp. 228–237', url: coreUrl };
  }
  const pools = Object.fromEntries(profile.order.filter(stat => !social || !['EDU', 'SOC'].includes(stat)).map(stat =>
    [stat, statOptions(profile, config, locks, stat)]));
  if (social) pools.EDU = social.edu;
  for (const [stat, pool] of Object.entries(pools)) {
    requireRule(pool.options.length, 'No eligible roll for ' + stat + ' under the ' + profile.name + ' profile and current requirements or locks.');
  }
  if (profile.special === 'hierate' && profile.form === 'Male') {
    if (profile.hierateRankFilter) pools.SOC.options = pools.SOC.options.filter(entry =>
      (entry.value.baseline >= 10) === (profile.hierateRankFilter === 'high'));
    const soc = await pickStat(pools.SOC, 'SOC', rng, 'Ancestral Territory');
    if (soc.baseline >= 10) profile.grants.push({ skill: 'Leadership', level: 1 });
    delete pools.SOC;
    if (!social) social = {};
    social.rank = soc;
  }
  const best = stat => Math.max(...pools[stat].options.map(entry => entry.value.uninjured));
  const maxSkillTotal = 3 * (best('INT') + best('EDU'));
  return { profile, pools, psi, social, maxSkillTotal };
}

export async function rollCharacteristics(prepared, skillTotal, rng) {
  const { profile, pools, social, psi } = prepared;
  const values = {};
  let positive = false;
  for (const [index, stat] of physical.entries()) {
    const pool = pools[stat];
    const remaining = physical.slice(index + 1).map(next => pools[next].options);
    const validEnd = (end, otherPositive) => profile.special === 'hiver'
      ? (otherPositive ? end.injured >= 0 : end.injured >= -end.uninjured)
      : otherPositive || end.injured > 0;
    const options = pool.options.map(entry => {
      const anyPositive = positive || entry.value.injured > 0;
      let weight;
      if (remaining.length === 0) weight = Number(validEnd(entry.value, positive));
      else if (remaining.length === 1) weight = remaining[0].filter(end => validEnd(end.value, anyPositive)).length;
      else weight = sum(remaining[0].map(dex => remaining[1].filter(end =>
        validEnd(end.value, anyPositive || dex.value.injured > 0)).length));
      return { ...entry, weight };
    }).filter(entry => entry.weight);
    requireRule(options.length, 'The physical conditions and locks leave no eligible living result.');
    values[stat] = await pickStat({ ...pool, options }, stat, rng);
    positive ||= values[stat].injured > 0;
  }
  const minimumEdu = int => Math.ceil(skillTotal / 3) - int;
  const intel = pools.INT.options.map(entry => ({
    ...entry, weight: pools.EDU.options.filter(edu => edu.value.uninjured >= minimumEdu(entry.value.uninjured)).length,
  })).filter(entry => entry.weight);
  requireRule(intel.length, 'The requested skills exceed 3 × (INT + EDU) under the characteristic locks.');
  values.INT = await pickStat({ ...pools.INT, options: intel }, 'INT', rng);
  values.EDU = await pickStat({ ...pools.EDU, options: pools.EDU.options.filter(entry =>
    entry.value.uninjured >= minimumEdu(values.INT.uninjured)) }, 'EDU', rng);
  for (const stat of profile.order.filter(stat => !has(values, stat))) {
    values[stat] = stat === 'SOC' && social?.rank ? social.rank : await pickStat(pools[stat], stat, rng);
  }
  if (psi) values.PSI = { raw: psi.raw, adjustment: 0, baseline: psi.maximum, augment: 0,
    loss: psi.maximum - psi.current, uninjured: psi.maximum, current: psi.current, dm: psi.dm };
  return Object.fromEntries([...profile.order, ...(psi ? ['PSI'] : [])].map(stat => [stat, values[stat]]));
}

export function resolveSkills(grants) {
  const resolved = new Map();
  const assign = (skill, level, source, implied = false) => {
    const key = skillKey(skill);
    const value = resolved.get(key);
    if (!value) return resolved.set(key, { skill, level, implied, sources: [source] });
    value.level = Math.max(value.level, level);
    value.implied &&= implied;
    if (!value.sources.includes(source)) value.sources.push(source);
  };
  for (const { skill, level, source } of grants) {
    assign(skill, level, source);
    if (level > 0 && family(skill) !== skill && specialtyFamilies.has(family(skill))) {
      assign(family(skill), 0, skill + ' familiarity', true);
    }
  }
  return [...resolved.values()].sort((a, b) => b.level - a.level || a.skill.localeCompare(b.skill, 'en'));
}

export function rating(skills, input) {
  const exact = skills.find(entry => skillKey(entry.skill) === skillKey(input));
  if (exact) return exact.level;
  if (input !== family(input) && specialtyFamilies.has(family(input))) {
    return skills.some(entry => skillKey(entry.skill) === skillKey(family(input))) ? 0 : null;
  }
  return null;
}

export function isTalent(skill) {
  return [...specialties.psion, 'Zhodani'].some(talent => skillKey(talent) === skillKey(skill));
}

export function taskCheck(npc, skill, stat, context = {}) {
  const { characteristics, skills } = npc.mechanics;
  if (isTalent(skill) && (rating(skills, skill) === null || !npc.abilities.psion)) return { available: false, reason: 'This talent is unavailable.' };
  if (npc.biology.forbidden.includes(skill)) return { available: false, reason: 'This skill is unavailable to this species profile.' };
  if (!has(characteristics, stat)) return { available: false, reason: 'This NPC has no ' + stat + ' characteristic.' };
  const level = rating(skills, skill);
  const jack = rating(skills, 'Jack-of-all-Trades') ?? 0;
  const skillDM = level ?? Math.min(0, -3 + jack);
  const modifiers = [];
  const traitSkill = family(skill);
  for (const trait of npc.biology.traits) {
    const add = (value, name = trait.name) => { if (value) modifiers.push({ name, value }); };
    add(trait.skills?.[traitSkill]);
    if (context.dark) add(trait.dark);
    if (context.unarmed) add(trait.unarmed);
    if (context.lowGravity) add(trait.lowGravity);
    if (context.swimming) add(trait.swimming);
    if (context.assistance) add(trait.assistance);
    if (context.hearing) add(trait.hearing?.[traitSkill]);
    if (context.scent) add(trait.scent?.[traitSkill]);
    if (context.decay) add(trait.decay?.[traitSkill]);
    if (context.lure) add(trait.lure?.[traitSkill] * (context.lure === 'human' ? 3 : 2));
    if (['water', 'breathable'].includes(context.medium) && traitSkill === 'Recon') add(context.medium === 'water' ? trait.waterRecon : -trait.waterRecon);
  }
  if (context.other) modifiers.push({ name: 'Task or equipment', value: context.other });
  const characteristicDM = characteristics[stat].dm;
  const boon = npc.biology.traits.some(trait => trait.boonSkills?.includes(traitSkill));
  return { available: true, level, skillDM, characteristicDM, modifiers, boon,
    total: skillDM + characteristicDM + sum(modifiers.map(mod => mod.value)) };
}

export function upp(profile, values) {
  if (profile.order.join() !== characteristicOrder.join()) return null;
  const digits = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const characters = characteristicOrder.map(stat => digits[values[stat].current]);
  return characters.every(Boolean) ? characters.join('') : null;
}
