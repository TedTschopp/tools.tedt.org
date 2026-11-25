import { has, normalizeConfig, object, requireRule, skillName } from './config.mjs';
import { fieldGroups, generateNpc, rerollNpc, restoreNpc, setLock } from './generator.mjs';
import { encounterSpecies } from './encounter-species.mjs';
import { generateGroup, groupsForScene, isGroupEncounter, normalizeGroupConfig, restoreGroup } from './group-encounters.mjs';
import { groupScenes } from './group-types.mjs';
import { isTalent, taskCheck } from './mechanics.mjs';
import { fanNameSources, imperialNameCounts, nameStyleFor, nameStyles } from './names.mjs';
import { freshSeed } from './random.mjs';
import { isRefereeLink, readRefereeLink, refereeLink } from './record-links.mjs';
import { portraitFor } from './species-art.mjs';
import { referenceGroups } from './species-reference.mjs';
import { cultures, needs, species } from './species.mjs';
import { contexts, coreUrl, equipmentCatalogue, errataUrl, occupationChoices, occupationTable, packs, specialties, tiers, version } from './tables.mjs';
import { fieldsFor } from './work.mjs';
import { handoutUrl, isHandoutLink, portraitId, qualificationsFor, readHandout } from './handout.mjs';
import { keepInRoster, readRoster, removeFromRoster } from './roster.mjs';

const $ = id => document.getElementById(id);
const field = id => $(id).value.trim();
const integerField = id => field(id) === '' ? null : Number(field(id));
const hidden = (id, value) => { $(id).hidden = value; };
const currency = amount => 'Cr' + amount.toLocaleString('en-US');
const signed = value => value < 0 ? '−' + Math.abs(value) : '+' + value;
const shown = value => value == null || value === '' ? 'Unspecified' : String(value);
const cap = string => string ? string[0].toUpperCase() + string.slice(1) : '';
const storageKeys = { npc: 'tedt-traveller-npc-v1', group: 'tedt-traveller-group-v1' };
const playerViewKey = 'tedt-traveller-player-view-v1';
const encounterModeKey = 'tedt-traveller-mode-v1';
const compactLayout = matchMedia('(max-width: 56rem)');
let npc = null;
let group = null;
let mode = 'npc';
let busy = false;
let playerView = false;

const activeRecord = () => mode === 'group' ? group : npc;
const recordMode = record => isGroupEncounter(record) ? 'group' : 'npc';
const recordName = record => isGroupEncounter(record) ? record.type : record.player.name;
const playerSubtitle = ({ species, role }) => [species, role].filter(Boolean).join(' · ');
const restoreEncounter = record => isGroupEncounter(record) ? restoreGroup(record) : restoreNpc(record);

function element(tag, content, attrs = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  const children = Array.isArray(content) ? content : [content];
  for (const child of children) {
    if (child !== null && child !== undefined) node.append(child instanceof Node ? child : String(child));
  }
  return node;
}
const p = (value, classes) => element('p', value, classes ? { class: classes } : {});
const h = value => element('h3', value);
const code = value => element('code', value);
const link = (label, href) => element('a', label, { href });
const list = entries => element('ul', entries.map(entry => element('li', entry)));
function portraitImage(plate, lazy = false) {
  return element('img', null, { src: 'img/traveller-npc/' + plate.asset + '.webp', width: '384', height: '384',
    alt: 'Vitruvian anatomy study of ' + plate.title, decoding: 'async', ...(lazy && { loading: 'lazy' }) });
}

function portraitCaption(plate) {
  return element('figcaption', [plate.description, element('span', plate.comparison), element('span', plate.source)], { class: 'hint' });
}

function renderPortrait(figure, profileId, { lazy = false } = {}) {
  const plate = portraitFor(profileId);
  figure.hidden = !plate;
  if (!plate) {
    figure.replaceChildren();
    return;
  }
  if (figure.dataset.profile === profileId && figure.firstChild) return;
  figure.dataset.profile = profileId;
  const trigger = element('button', [portraitImage(plate, lazy), element('span', '+', { 'aria-hidden': 'true' })], {
    type: 'button', class: 'portrait-trigger', 'aria-label': 'Enlarge ' + plate.title + ' portrait', 'aria-haspopup': 'dialog',
  });
  trigger.addEventListener('click', () => {
    $('portrait-viewer-title').textContent = plate.title;
    $('portrait-viewer-figure').replaceChildren(portraitImage(plate), portraitCaption(plate));
    $('portrait-viewer').showModal();
  });
  figure.replaceChildren(trigger, portraitCaption(plate));
}

function definition(entries, classes = 'values') {
  return element('dl', entries.flatMap(([key, value]) => [element('dt', key), element('dd', value ?? 'Unspecified')]), { class: classes });
}
function table(headers, rows, { label, classes = 'scroll' } = {}) {
  const contents = element('table', [
    element('thead', element('tr', headers.map(header => element('th', header, { scope: 'col' })))),
    element('tbody', rows.map(row => element('tr', row.map(cell => element('td', cell))))),
  ]);
  return element('div', contents, { class: classes, role: 'region', tabindex: '0', 'aria-label': label ?? headers.join(', ') });
}

function select(id, options, selected) {
  const el = $(id);
  const value = selected ?? el.value;
  el.replaceChildren(...options.map(option => Array.isArray(option[1])
    ? element('optgroup', option[1].map(([key, label]) => element('option', label, { value: key })), { label: option[0] })
    : element('option', option[1], { value: option[0] })));
  if ([...el.options].some(option => option.value === value)) el.value = value;
}

function roleOptions(secondary = false) {
  return [
    ...(secondary ? [['none', 'Off'], ['random', 'On · roll on 6']] : [['random', 'Roll on d66']]),
    ['Occupation table', occupationTable.map(row => [row.id, row.id + ' · ' + row.title])],
    ['Other variants', occupationChoices.filter(row => !occupationTable.includes(row) && (!secondary || row.id !== 'psion'))
      .map(row => [row.id, row.title])],
  ];
}

function renderSkillMinimums() {
  const minimums = field('required-skills');
  hidden('active-skill-minimums', !minimums || has(encounterSpecies, field('species')));
  $('skill-minimums-summary').textContent = 'Skill minimums · ' + minimums.replace(/\s*\n\s*/g, ', ');
}

function updateProfileControls(config) {
  const profileId = field('species');
  const isEncounter = has(encounterSpecies, profileId);
  hidden('source-encounter-note', !isEncounter);
  for (const node of document.querySelectorAll('[data-character-setting]')) node.hidden = isEncounter;
  const profile = species[profileId];
  const selected = profileId === 'random' ? npc?.biology.profileId : profileId;
  const customPlate = (config ?? npc?.controls.config)?.customProfile?.appearance;
  renderPortrait($('settings-plate'), selected === 'custom' ? customPlate : selected);
  const explicitStyle = field('name-style');
  const candidate = profile ? { ...profile, id: profileId, culture: field('culture') === 'auto' ? profile.culture : field('culture') } : null;
  const naming = nameStyles[explicitStyle === 'auto' && candidate ? nameStyleFor('auto', candidate) : explicitStyle];
  $('name-style-note').textContent = naming ? naming.label + ' · ' + naming.basis
    : isEncounter ? 'Automatic uses a field contact name.' : 'Follows the NPC’s species and culture.';
  const options = profile?.adultOptions ?? [];
  const form = config?.profileOptions.adultForm ?? field('adult-form');
  hidden('adult-label', !options.length);
  select('adult-form', [['', profile?.special === 'whistler' ? 'Independent neuter by default' : 'Roll adult form'],
    ...options.map(value => [value, value])], form);
  const droyne = profile?.special === 'droyne';
  hidden('wings-label', !droyne);
  hidden('territory-label', profile?.special !== 'hierate' || field('adult-form') === 'Female');
  hidden('ascondi-soc-label', profile?.special !== 'ascondi');
  const zhodani = field('culture') === 'zhodani';
  hidden('zhodani-psi-label', !zhodani);
  const specialtyOptions = (slot, id) => {
    const row = occupationChoices.find(row => row.id === field(slot));
    const fields = row && row.profile !== 'psion' ? fieldsFor(row) : [];
    hidden(id + '-label', isEncounter || !fields.length);
    select(id, [['', 'Roll for this occupation'], ...fields.map(value => [value, value])],
      id === 'specialty' ? config?.specialty : config?.secondarySpecialty);
  };
  specialtyOptions('occupation', 'specialty');
  specialtyOptions('secondary', 'secondary-specialty');
  const trained = field('psi-mode') === 'trained' || field('occupation') === 'psion';
  hidden('talent-label', !trained);
  hidden('potential-label', field('psi-mode') !== 'latent' || droyne || zhodani);
  hidden('psi-current-label', !trained && !droyne && !zhodani && field('psi-mode') !== 'latent');
  hidden('age-label', field('age-mode') !== 'fixed');
  renderSkillMinimums();
}

function advancedFrom(config) {
  const advanced = {};
  for (const key of ['population', 'occupationWeights', 'backgroundWeights']) {
    if (Object.keys(config[key]).length) advanced[key] = config[key];
  }
  for (const key of ['conditions', 'augmentations', 'skillGrants', 'gear']) {
    if (config[key].length) advanced[key] = config[key];
  }
  for (const key of ['clone', 'funds', 'affiliation', 'authority', 'networkTarget', 'partyRelationship']) {
    if (config[key] !== null) advanced[key] = config[key];
  }
  if (config.lifeform !== 'standard') advanced.lifeform = config.lifeform;
  const identity = Object.fromEntries(Object.entries(config.identity).filter(([key, value]) =>
    !['commonName', 'nativeName', 'pronouns'].includes(key) && (Array.isArray(value) ? value.length : value !== null)));
  if (Object.keys(identity).length) advanced.identity = identity;
  if (config.placement.uncertainty || config.placement.accommodations.length) {
    advanced.placement = { uncertainty: config.placement.uncertainty, accommodations: config.placement.accommodations };
  }
  if (Object.keys(config.psion.weights).length) advanced.psion = { weights: config.psion.weights };
  if (config.customProfile) advanced.customProfile = Object.fromEntries([
    'name', 'source', 'appearance', 'living', 'sophont', 'order', 'characteristics', 'age', 'needs', 'grants', 'attacks', 'body',
    'movement', 'senses', 'manipulators', 'communication', 'psionics', 'traits',
  ].map(key => [key, config.customProfile[key]]));
  for (const [slot, key] of [['occupation', 'specialty'], ['secondary', 'secondarySpecialty']]) {
    const row = occupationChoices.find(row => row.id === config[slot]);
    if (config[key] && !row?.profile?.includes('psion') && !fieldsFor(row ?? {}).includes(config[key])) advanced[key] = config[key];
  }
  return advanced;
}

function fillSettings(config, seed) {
  for (const key of ['context', 'species', 'culture', 'occupation', 'competence', 'secondary']) $(key).value = config[key];
  $('seed').value = seed;
  $('required-skills').value = config.requiredSkills.map(entry => entry.skill + ' = ' + entry.level).join('\n');
  $('stat-minimums').value = Object.entries(config.requiredCharacteristics).map(([stat, level]) => stat + ' = ' + level).join('\n');
  $('characteristic-boons').value = config.characteristicBoons.join(', ');
  $('current-location').value = config.placement.current ?? '';
  $('last-location').value = config.placement.last ?? '';
  $('medium').value = config.placement.medium;
  $('local-tl').value = config.placement.tl ?? '';
  $('law').value = config.placement.law ?? '';
  $('homeworld').value = config.homeworld ?? '';
  $('worlds').value = config.homeworlds.map(world =>
    [world.name, world.weight, world.uwp].filter(value => value !== null).join(' | ')).join('\n');
  $('age-mode').value = config.age === null ? 'unknown' : config.age === 'random' ? 'random' : 'fixed';
  $('age-years').value = typeof config.age === 'number' ? config.age : '';
  $('common-name').value = config.identity.commonName ?? '';
  $('native-name').value = config.identity.nativeName ?? '';
  $('name-style').value = config.nameStyle ?? 'auto';
  $('pronouns').value = config.identity.pronouns ?? '';
  $('wings').value = config.profileOptions.wings;
  $('territory').value = config.profileOptions.territory ?? '';
  $('ascondi-soc').value = config.profileOptions.ascondiSoc ?? '';
  $('zhodani-high-psi').checked = config.profileOptions.zhodaniHighPsi;
  $('psi-mode').value = config.psion.mode;
  $('talent').value = config.psion.talent;
  $('potential').value = config.psion.potential ?? '';
  $('psi-current').value = config.psion.current ?? '';
  const advanced = advancedFrom(config);
  $('advanced').value = Object.keys(advanced).length ? JSON.stringify(advanced, null, 2) : '';
  updateProfileControls(config);
  renderAssignedGear(config.gear);
  showSettingsFeedback('', '', 'npc');
}

function updateGroupTypes(selected) {
  select('group-type', [['random', 'Roll for group type'], ...groupsForScene(field('group-scene'))
    .map(([id, type]) => [id, type.name])], selected);
}

function fillGroupSettings(config, seed) {
  $('group-scene').value = config.scene;
  updateGroupTypes(config.type);
  $('group-species').value = config.species;
  $('group-seed').value = seed;
  showSettingsFeedback('', '', 'group');
}

function advancedOptions() {
  const input = field('advanced');
  let advanced = {};
  if (input) {
    try { advanced = JSON.parse(input); }
    catch { throw new Error('Advanced referee facts must be valid JSON.'); }
  }
  requireRule(object(advanced), 'Advanced referee facts must be a JSON object.');
  const supported = ['population', 'occupationWeights', 'backgroundWeights', 'conditions', 'augmentations', 'skillGrants',
    'gear', 'clone', 'funds', 'affiliation', 'authority', 'networkTarget', 'partyRelationship', 'lifeform', 'identity', 'customProfile',
    'placement', 'psion', 'specialty', 'secondarySpecialty'];
  const unexpected = Object.keys(advanced).find(key => !supported.includes(key));
  requireRule(!unexpected, '“' + unexpected + '” is not an advanced option. Use the labelled controls or the option formats below.');
  return advanced;
}

function pairs(id) {
  return field(id).split(/\r?\n/).flatMap(line => {
    if (!line.trim()) return [];
    const match = /^(.+?)\s*=\s*(\d+)\s*$/.exec(line.trim());
    requireRule(match, 'Enter “' + line.trim() + '” in the form name = minimum.');
    return [[match[1].trim(), Number(match[2])]];
  });
}

function readSettings() {
  const isEncounter = has(encounterSpecies, field('species'));
  const advanced = isEncounter ? {} : advancedOptions();
  const ageMode = field('age-mode');
  const age = ageMode === 'random' ? 'random' : ageMode === 'unknown' ? null : integerField('age-years');
  requireRule(ageMode !== 'fixed' || age !== null, 'Enter the NPC’s age in years.');
  const common = {
    species: field('species'), nameStyle: field('name-style'), age,
    identity: { ...advanced.identity, commonName: field('common-name'),
      nativeName: field('native-name') || advanced.identity?.nativeName, pronouns: field('pronouns') },
    placement: {
      ...advanced.placement, current: field('current-location'), last: field('last-location'),
      medium: field('medium'), tl: integerField('local-tl'), law: integerField('law'),
    },
    homeworld: field('homeworld'),
  };
  if (isEncounter) return common;
  return {
    ...advanced, ...common,
    context: field('context'), culture: field('culture'),
    occupation: field('occupation'), competence: field('competence'), secondary: field('secondary'),
    specialty: field('specialty') || advanced.specialty,
    secondarySpecialty: field('secondary-specialty') || advanced.secondarySpecialty,
    requiredSkills: pairs('required-skills').map(([skill, level]) => ({ skill, level })),
    requiredCharacteristics: Object.fromEntries(pairs('stat-minimums').map(([stat, level]) => [stat.toUpperCase(), level])),
    characteristicBoons: field('characteristic-boons').toUpperCase().split(/[\s,]+/).filter(Boolean),
    profileOptions: {
      adultForm: $('adult-label').hidden ? null : field('adult-form'),
      wings: $('wings-label').hidden ? 'random' : field('wings'),
      territory: $('territory-label').hidden ? null : integerField('territory'),
      ascondiSoc: $('ascondi-soc-label').hidden ? null : integerField('ascondi-soc'),
      zhodaniHighPsi: !$('zhodani-psi-label').hidden && $('zhodani-high-psi').checked,
    },
    psion: {
      ...advanced.psion, mode: field('psi-mode'), talent: $('talent-label').hidden ? 'random' : field('talent'),
      potential: $('potential-label').hidden ? null : integerField('potential'),
      current: $('psi-current-label').hidden ? null : integerField('psi-current'),
    },
    homeworlds: field('worlds').split(/\r?\n/).filter(line => line.trim()).map(line => {
      const [name, weight, uwp, ...extra] = line.split('|').map(part => part.trim());
      requireRule(!extra.length, 'Enter one homeworld per line as name | weight | UWP.');
      return { name, weight: weight ? Number(weight) : 1, uwp };
    }),
  };
}

function status(message, state = 'ready') {
  $('status').textContent = message;
  $('status').dataset.state = state;
}

function feedback(id, message = '') {
  $(id).textContent = message;
}

const settingsFeedback = type => $(type === 'group' ? 'group-settings-feedback' : 'settings-feedback');

function showSettingsFeedback(state, message, type = mode) {
  const note = settingsFeedback(type);
  note.dataset.state = state;
  note.textContent = message;
  note.hidden = !message;
  updateRetainedRecord();
}

function updateRetainedRecord() {
  const note = settingsFeedback(mode);
  const retained = $('retained-record');
  const noun = mode === 'group' ? 'a group' : 'an NPC';
  const action = mode === 'group' ? 'Roll group' : 'Apply settings';
  retained.textContent = note.dataset.state === 'error'
    ? 'Last successful roll. The current settings could not generate ' + noun + '.'
    : 'Last successful roll. Use ' + action + ' to update this card.';
  retained.hidden = !note.textContent || !activeRecord();
}

function settingsChanged(message = 'Settings changed. Apply settings or roll the next NPC.') {
  if (settingsFeedback(mode).textContent === message) return;
  showSettingsFeedback('pending', message);
  status(message);
}

function remember(record) {
  try { localStorage.setItem(storageKeys[recordMode(record)], JSON.stringify(record)); return true; }
  catch { return false; }
}

function setMode(value) {
  mode = value;
  try { sessionStorage.setItem(encounterModeKey, mode); }
  catch { /* The mode selector works without storage. */ }
}

function readyMessage(record, verb = '') {
  const label = isGroupEncounter(record) ? 'Group' : 'NPC';
  return verb + label + ' ' + record.provenance.index + (verb ? '' : ' ready') + ' · ' + recordName(record) + '.';
}

function clearRefereeLink() {
  if (!isRefereeLink(location.hash)) return;
  const url = new URL(location.href);
  url.hash = '';
  try { history.replaceState(history.state, '', url.href); }
  catch { location.hash = ''; }
}

async function setRecord(action, message, { fill = false, report = true, persist = true, onError } = {}) {
  if (busy) return;
  busy = true;
  const busyRegions = ['config-form', 'group-form', 'results'].map($);
  for (const region of busyRegions) region.setAttribute('aria-busy', 'true');
  try {
    const record = await action();
    setMode(recordMode(record));
    if (mode === 'group') group = record;
    else npc = record;
    if (fill) {
      const fillForm = mode === 'group' ? fillGroupSettings : fillSettings;
      fillForm(record.controls.config, record.provenance.seed);
    }
    if (persist) clearRefereeLink();
    const saveResult = !persist || remember(record);
    renderRecord();
    const label = typeof message === 'function' ? message(record) : message;
    status(label + (saveResult ? '' : ' Local storage is unavailable. Export JSON to keep this record.'), 'success');
    return record;
  } catch (error) {
    if (!report) throw error;
    const problem = error.message || 'Generation failed.';
    status(problem, 'error');
    onError?.(problem);
  } finally {
    busy = false;
    for (const region of busyRegions) region.removeAttribute('aria-busy');
  }
}

async function openEncounterMode(target) {
  if (busy) return;
  if (mode !== target) clearRefereeLink();
  setMode(target);
  renderRecord();
  const record = activeRecord();
  if (record) {
    status(readyMessage(record), 'success');
    return;
  }
  status(mode === 'group' ? 'Preparing your first group.' : 'Preparing your first NPC.');
  try {
    const saved = localStorage.getItem(storageKeys[target]);
    if (saved) {
      await setRecord(() => restoreEncounter(JSON.parse(saved)), record => readyMessage(record, 'Restored '),
        { fill: true, report: false });
      return;
    }
  } catch {
    // A saved record that cannot be restored does not block a new roll.
  }
  await generation({ reveal: false });
}

function revealEncounter() {
  if (compactLayout.matches) $(mode === 'group' ? 'group-options' : 'settings-options').open = false;
  $('encounter').focus({ preventScroll: true });
  $('encounter').scrollIntoView({ block: 'start' });
}

async function generation({ next = false, seedChange = false, reveal = compactLayout.matches } = {}) {
  if (busy) return;
  const rollingGroup = mode === 'group';
  const record = await setRecord(() => {
    const seed = seedChange ? freshSeed() : field(rollingGroup ? 'group-seed' : 'seed');
    const previous = activeRecord()?.provenance;
    const sameSeed = seed === previous?.seed;
    const index = sameSeed ? previous.index + Number(next) : 1;
    if (rollingGroup) {
      return generateGroup({ scene: field('group-scene'), type: field('group-type'), species: field('group-species') }, { seed, index });
    }
    const settings = readSettings();
    const sameModel = has(encounterSpecies, settings.species) === Boolean(npc?.encounter);
    const counters = sameSeed && sameModel && !next ? previous.rerollCounters : {};
    return generateNpc(settings, { seed, index, counters, locks: npc?.controls.locks });
  }, readyMessage, {
    fill: true,
    onError: message => showSettingsFeedback('error', message),
  });
  if (reveal && record) revealEncounter();
  else if (reveal) {
    $(rollingGroup ? 'group-options' : 'settings-options').open = true;
    $(rollingGroup ? 'apply-group' : 'apply-settings').focus();
  }
}

function applyHiringPreset(context, roleIds, minimums) {
  if (busy) return;
  if (!roleIds.includes(field('occupation'))) {
    $('occupation').value = 'random';
    if (field('psi-mode') === 'trained') $('psi-mode').value = 'auto';
  }
  $('context').value = context;
  $('required-skills').value = minimums;
  updateProfileControls();
  return generation();
}

function reroll(fields) {
  return setRecord(() => rerollNpc(npc, fields), 'Rerolled the selected fields.');
}

function renderValidity() {
  const { mechanical, job, environment, combat } = npc.validity;
  const statuses = [['Rules', mechanical], ['Job', job], ['Habitat', environment], ['Combat data', combat]];
  $('validity').replaceChildren(...statuses.map(([label, entry]) => element('div', [
    element('dt', label), element('dd', cap(entry.status)),
  ], { title: entry.message ?? entry.missing.join('. '),
    'data-warning': String(['incomplete', 'missing support'].includes(entry.status)) })));
}

function renderCharacteristics() {
  const stats = npc.mechanics;
  const bio = npc.biology;
  const grid = element('dl', stats.order.map(stat => {
    const value = stats.characteristics[stat];
    return element('div', [element('dt', stat), element('dd', value.current, { class: 'score' }),
      element('dd', 'DM ' + signed(value.dm), { class: 'dm' })], { class: 'stat' });
  }), { class: 'characteristics' });
  const meta = [stats.upp && 'UPP ' + stats.upp, stats.condition.status, bio.form, bio.status].filter(Boolean).join(' · ');
  const body = definition([['Profile', bio.name + ' · ' + bio.variant], ['Body and movement', bio.body + ' · ' + bio.movement],
    ['Senses and manipulation', bio.senses + ' · ' + bio.manipulators], ['Age', bio.age.years == null ? 'Adult, age unspecified' : bio.age.years + ' years'],
    ['Wing development', bio.wings], ['Source', bio.source]].filter(([key, value]) => key !== 'Wing development' || value));
  const traits = bio.traits.length ? list(bio.traits.map(trait => [element('strong', trait.name + '. '), trait.text])) : null;
  const changes = table(['Characteristic', 'Raw', 'Adjustment', 'Baseline', 'Augmentation', 'Loss', 'Current'], stats.order.map(stat => {
    const value = stats.characteristics[stat];
    return [stat, shown(value.raw), signed(value.adjustment), value.baseline, signed(value.augment), value.loss, value.current];
  }), { label: 'Characteristic calculation' });
  const effects = [...stats.condition.records, ...npc.abilities.augmentations];
  const details = element('details', [element('summary', 'Raw rolls and current condition'), changes, effects.length ? list(effects.map(entry =>
    entry.name + ' · ' + entry.source + (entry.recovery ? ' · ' + entry.recovery : '') + (entry.active ? '' : ' · inactive'))) : null], { class: 'group' });
  $('characteristics').replaceChildren(grid, p(meta, 'meta'), body, ...(traits ? [traits] : []), details);
}

function renderSkills() {
  const { occupation, competence, secondary, qualifications } = npc.work;
  const { skills, skillTotal, skillLimit, grants } = npc.mechanics;
  const qualificationsNode = qualifications.length ? table(['Requirement', 'Required', 'Actual'], qualifications.map(entry =>
    [entry.skill, entry.minimum, entry.actual]), { label: 'Job and crew qualifications' }) : p(npc.validity.job.message, 'hint');
  const psi = npc.abilities.psion;
  const entries = [
    p([element('strong', occupation.title + ' · ' + competence.name), occupation.field ? ' · ' + occupation.field : '']),
    secondary ? p('Secondary training · ' + secondary.title + ' · ' + secondary.slots[0] + ' ' + secondary.rating) : null,
    p('Positive levels ' + skillTotal + ' / ' + skillLimit + '. Level 0 is familiarity. Absent ordinary skills are untrained.', 'hint'),
    table(['Skill', 'Level', 'Training source'], skills.map(skill =>
      [skill.skill, element('span', skill.level, { class: 'number' }), skill.implied ? 'Implied familiarity' : skill.sources[0]]), { label: 'Resolved skills' }),
    h('Qualifications'), qualificationsNode,
    npc.controls.config.context === 'crew' ? p('For a crew complement, assign concurrent duties explicitly.', 'hint') : null,
    psi ? h('Psionics') : null,
    psi ? p('PSI ' + psi.current + ' / ' + psi.maximum + ' · DM ' + signed(psi.dm) + '. '
      + (psi.talents.length ? 'Available talents include ' + psi.talents.map(talent => talent.skill + ' ' + talent.level).join(', ') + '.'
        : 'No learned talent is recorded.')
      + ' Use the source for actions, costs, and limits.') : null,
    psi ? p(psi.source, 'hint') : null,
    ...npc.abilities.innate.map(ability => p(ability.name + ' · ' + ability.source)),
    element('details', [element('summary', 'Underlying skill grants'), table(['Grant', 'Level', 'Source'],
      grants.map(grant => [grant.skill, grant.level, grant.source]), { label: 'Underlying skill grants' })], { class: 'group' }),
  ];
  $('skills').replaceChildren(...entries.filter(Boolean));
  const initialized = field('check-skill');
  select('check-stat', npc.mechanics.order.map(stat => [stat, stat]), initialized ? field('check-stat') : 'EDU');
  if (!initialized) $('check-skill').value = occupation.slots[0];
  $('skill-options').replaceChildren(...skills.map(skill => element('option', null, { value: skill.skill })));
  for (const context of ['hearing', 'scent', 'decay', 'lure']) {
    const enabled = npc.biology.traits.some(trait => trait[context]);
    hidden('check-' + context + '-label', !enabled);
    if (!enabled && context === 'lure') $('check-lure').value = '';
    else if (!enabled) $('check-' + context).checked = false;
  }
  renderCheck();
}

function renderCheck() {
  if (!npc) return;
  try {
    const skill = skillName(field('check-skill'));
    const stat = isTalent(skill) ? 'PSI' : field('check-stat');
    const other = Number(field('check-other') || 0);
    requireRule(Number.isInteger(other) && Math.abs(other) <= 99, 'Enter an Other DM from −99 to +99.');
    const bits = {
      dark: $('check-dark').checked, unarmed: $('check-unarmed').checked,
      lowGravity: $('check-lowg').checked, swimming: $('check-swim').checked, assistance: $('check-help').checked,
      hearing: $('check-hearing').checked, scent: $('check-scent').checked, decay: $('check-decay').checked, lure: field('check-lure'),
      medium: field('check-medium') || npc.places.medium,
      other,
    };
    const result = taskCheck(npc, skill, stat, bits);
    const explanation = result.available
      ? (result.boon ? 'Boon on 2D' : '2D') + ' ' + signed(result.total) + ' · '
        + [skill + ' ' + signed(result.skillDM), stat + ' ' + signed(result.characteristicDM),
          ...result.modifiers.map(modifier => modifier.name + ' ' + signed(modifier.value))].join(' · ')
      : result.reason;
    $('check-result').textContent = explanation;
  } catch (error) {
    $('check-result').textContent = error.message;
  }
}

function renderIdentity() {
  const { identity, culture, places, work, resources, biology } = npc;
  const facts = [
    ['Common name', identity.commonName], ['Native name', identity.nativeName], ['Aliases', identity.aliases.join(', ') || null], ['Pronouns', identity.pronouns],
    ['Ancestry', identity.ancestry], ['Biological sex or form', identity.sex], ['Cultural gender', identity.gender],
    ['Culture', culture.name], ['Upbringing', culture.upbringing.name], ['Native communication', culture.nativeCommunication],
    ['Citizenship', culture.citizenship], ['Description', identity.description], ['Homeworld', places.homeworld
      ? places.homeworld.name + (places.homeworld.uwp ? ' · supplied UWP ' + places.homeworld.uwp : '') : null],
    ['Current location', places.current], ['Last known location', places.lastKnown], ['Location uncertainty', places.uncertainty],
    ['Employment', work.employment.status], [work.employment.relationship, work.employment.affiliation],
    ['Authority', resources.authority], ['Portable funds', currency(resources.portableFunds) + ' · ' + resources.financialSituation],
    ['Debts', resources.debts.length ? resources.debts.map(debt => currency(debt.amount)).join(', ') : 'None'],
  ];
  if (identity.naming) {
    facts.splice(2, 0, ['Name source', [identity.naming.label, identity.naming.basis, identity.naming.source].join(' · ')]);
    if (identity.naming.formalName) facts.splice(2, 0, ['Formal name', identity.naming.formalName]);
  }
  if (biology.clone) facts.push(['Clone donor', biology.clone.donorId], ['Chronological age', biology.clone.chronologicalAge],
    ['Biological age', biology.clone.biologicalAge], ['Memory history', biology.clone.memoryHistory]);
  if (resources.affiliationSupport) facts.push(['Affiliation support', resources.affiliationSupport.companions
    + ' Feskal attendants · ' + resources.affiliationSupport.description]);
  $('identity-record').replaceChildren(p(identity.history.text), definition(facts));
}

function renderEquipment() {
  const { environment, combat } = npc.validity;
  const { access } = npc.resources;
  const availability = npc.equipment.map(item => [
    [element('strong', item.name), item.source ? element('div', item.source, { class: 'meta' }) : null].filter(Boolean).reduce((node, child) => {
      node.append(child); return node;
    }, element('span')),
    item.owner + ' · ' + item.location + ' · ' + item.access,
    item.catalogueId ? [
      'TL' + item.tl, item.protection != null && 'Protection ' + item.protection, item.damage && 'Base damage ' + item.damage,
      item.training && item.training.skill + ' ' + item.training.level + (item.trainingShortfall ? ' (shortfall ' + item.trainingShortfall + ')' : ''),
      item.condition, item.fitted ? 'Fitted' : 'Wrong fit', item.legality === 'unknown' ? 'Legality unknown' : cap(item.legality),
      item.supply, item.requiresAmmo && 'Ammunition ' + shown(item.ammunition),
    ].filter(Boolean).join(' · ') : 'Descriptive kit',
  ]);
  const attackRows = npc.derived.attacks.map(attack =>
    [attack.name + (attack.natural ? ' · innate' : ''), attack.damage
      + (attack.meleeDamageDM != null ? ' · ' + signed(attack.meleeDamageDM) + ' STR DM on damage' : ''),
      attack.check.available ? '2D ' + signed(attack.check.total)
      + ' (' + attack.skill + ' ' + signed(attack.check.skillDM)
      + ', ' + attack.characteristic + ' ' + signed(attack.check.characteristicDM)
      + (attack.check.modifiers.length ? ', ' + attack.check.modifiers.map(mod => mod.name + ' ' + signed(mod.value)).join(', ') : '') + ')'
      : attack.check.reason]);
  $('equipment-record').replaceChildren(
    h('Environment'), p(environment.message),
    list(npc.biology.needs.map(need => needs[need])),
    ...(environment.missing.length && environment.status === 'missing support' ? [p('Missing · ' + environment.missing.join(', '))] : []),
    definition([['Current medium', npc.places.medium], ['Local technology', npc.places.localTL], ['Local law', npc.places.law],
      ['Natural Protection', npc.derived.naturalProtection]]),
    h('Access'), definition([['Resource', access.resource], ['Owner', access.owner], ['Permission', access.condition], ['Obligation', access.obligation]]),
    h('Equipment'), table(['Item', 'Owner, location, and access', 'Mechanics and fit'], availability, { label: 'NPC equipment' }),
    h('Combat'), ...(combat.missing.length ? [list(combat.missing)] : []),
    attackRows.length ? table(['Attack', 'Base damage', 'Check before situational modifiers'], attackRows, { label: 'Attack entries' })
      : p('No natural attack or ready catalogue weapon is recorded.', 'hint'),
  );
}

function relationship(edge, fallback) {
  if (!edge) return p(fallback, 'hint');
  return definition([
    ['Other person', [edge.target.name ?? edge.target.id, edge.target.occupation].filter(Boolean).join(' · ')],
    ['Their role', edge.role], ['Cause', edge.cause], ['Consequence', edge.consequence], ...(edge.status ? [['Status', cap(edge.status)]] : []),
  ]);
}

function renderStory() {
  const story = npc.story;
  $('story').replaceChildren(
    definition([['Attitude', story.attitude], ['Immediate goal', story.goal], ['Pressure', story.pressure], ['Manner', cap(story.manner)],
      ['Boundary', story.boundary], ['Risk tolerance', story.risk]]),
    h('Encounter hook'), p(story.hook),
    ...(story.mission ? [h('Patron job'), definition([['Request', story.mission.request], ['Outside help', story.mission.outsideHelp],
      ['What they offer', story.mission.offer], ['Complication', story.mission.complication]])] : []),
    h('NPC’s own network'), relationship(story.network, 'No significant relationship rolled.'),
    h('Connection to the Travellers'), relationship(story.party, 'A stranger to the party.'),
    h('Secret'), story.secret ? definition([['Type', story.secret.type], ['Subject', story.secret.subject], ['Why it matters', story.secret.cause]])
      : p('No special secret.', 'hint'),
  );
}

function rollTable(rolls, label) {
  return table(['Field', 'Roll or selection', 'Result', 'Method'], rolls.map(roll =>
    [roll.field, roll.label, Array.isArray(roll.result) ? roll.result.join(', ') : shown(roll.result),
      roll.dice ?? roll.method ?? 'Recorded result']), { label, classes: 'rolls scroll' });
}

function renderRolls() {
  const prov = npc.provenance;
  $('rolls').replaceChildren(
    definition([['NPC ID', code(npc.id)], ['Seed', code(prov.seed)], ['NPC index', prov.index], ['Generator', prov.version],
      ['Rules profile', prov.ruleProfile], ['Table versions', Object.entries(prov.packs).map(([key, value]) => key + ' ' + value).join(' · ')],
      ['Reroll counters', Object.entries(prov.rerollCounters).map(([key, value]) => key + ' ' + value).join(', ') || 'None']]),
    rollTable(prov.rolls, 'Ordered roll record'),
  );
}

function renderLocks() {
  const groups = npc.encounter ? [['Identity', [['name', 'Common name']]]]
    : Object.entries(fieldGroups).map(([name, fields]) => [name, fields.filter(([key]) =>
      key !== 'wings' || npc.biology.wings).filter(([key]) => key !== 'form' || npc.biology.form)]);
  if (!npc.encounter) groups.splice(3, 0, ['Characteristics', npc.mechanics.order.map(stat => ['stat.' + stat, stat])]);
  $('locks').replaceChildren(
    p('Lock the current value before applying new settings or rolling again. Derived values recalculate.', 'hint'),
    ...groups.map(([group, fields]) => element('div', [
      element('div', [h(group), element('button', 'Reroll ' + group.toLowerCase(), { type: 'button', class: 'quiet compact',
        'data-reroll': fields.filter(([key]) => key !== 'skills').map(([key]) => key).join(',') })], { class: 'summary-row' }),
      ...fields.map(([key, label]) => {
        const checked = has(npc.controls.locks, key);
        const input = element('input', null, { type: 'checkbox', 'data-lock': key });
        input.checked = checked;
        const button = key === 'skills' ? null : element('button', 'Reroll', { type: 'button', class: 'quiet compact',
          'data-reroll': key, 'aria-label': 'Reroll ' + label });
        if (button) button.disabled = checked;
        return element('div', [element('label', [input, 'Lock ' + label], { class: 'check-line' }), button], { class: 'lock-row' });
      }),
    ], { class: 'lock-group' })),
  );
}

function renderSourceEncounter() {
  const { encounter, biology, identity, places } = npc;
  const { placement } = npc.controls.config;
  const facts = [
    ['Source', biology.source], ['Hits', encounter.hits], ['Protection', encounter.protection],
    ['Movement', encounter.movement], ['Habitat', encounter.habitat], ['Communication', encounter.communication],
    ['Skills', encounter.skills.join(', ') || null], ['Natural attacks', encounter.attacks.join(', ') || null],
    ['Age', biology.age.years], ['Native name', identity.nativeName], ['Naming', identity.naming.label],
    ['Current location', places.current], ['Last known location', places.lastKnown], ['Homeworld', places.homeworld?.name],
    ['Environment', placement.medium === 'unknown' ? null : cap(placement.medium)],
    ['Local TL', placement.tl], ['Law level', placement.law],
  ].filter(([, value]) => value != null);
  $('source-encounter-record').replaceChildren(h('Published encounter'), definition(facts), list(encounter.traits));
}

const qualificationText = npc => qualificationsFor(npc).map(([skill, level]) => skill + ' ' + level).join(' · ');

function renderRefereeBrief() {
  let facts;
  if (npc.encounter) {
    const { hits, protection, movement, habitat, attacks } = npc.encounter;
    facts = [['Hits', hits], ['Protection', protection], ['Movement', movement],
      ['Natural attacks', attacks.join(', ') || null], ['Habitat', habitat]];
  } else if (npc.story.mission) {
    const { request, offer, complication } = npc.story.mission;
    facts = [['Request', request], ['Offer', offer], ['Complication', complication]];
  } else if (contexts[npc.controls.config.context].hiring) {
    facts = [['Qualifications', qualificationText(npc)], ['Availability', npc.work.employment.status]];
  } else {
    facts = [['Encounter hook', npc.story.hook], ['Attitude', npc.story.attitude], ['UPP', npc.mechanics.upp]];
  }
  $('brief-content').replaceChildren(definition(facts.filter(([, value]) => value != null && value !== '')));
}

function renderNpcRecord() {
  if (field('species') === 'random') renderPortrait($('settings-plate'), portraitId(npc));
  $('reroll-name').disabled = has(npc.controls.locks, 'name');
  const isEncounter = Boolean(npc.encounter);
  hidden('source-encounter-record', !isEncounter);
  for (const node of document.querySelectorAll('[data-character-record]')) node.hidden = isEncounter;
  if (isEncounter) renderSourceEncounter();
  else {
    renderValidity();
    renderCharacteristics();
    renderSkills();
    renderIdentity();
    renderEquipment();
    renderStory();
  }
  renderRolls();
  renderLocks();
  renderRefereeBrief();
}

function renderGroupRecord() {
  const { type, scene, size, purpose, affiliation, reaction, members, others, provenance } = group;
  $('brief-content').replaceChildren(definition([
    ['Encounter type', type], ['Scene', groupScenes[scene]], ['People present', size],
    ['Purpose', purpose], ['Affiliation', affiliation],
    ['Initial reaction', reaction.attitude + ' · 2D = ' + reaction.total],
  ]));
  const entries = members.map(({ position, leader, npc: member }) => {
    const { characteristics, order, upp } = member.mechanics;
    const stats = upp ? 'UPP ' + upp : order.map(stat => stat + ' ' + characteristics[stat].current).join(' · ');
    const details = element('button', 'Open NPC record', { type: 'button', class: 'quiet compact',
      'aria-label': 'Open NPC record for ' + member.player.name });
    details.addEventListener('click', async () => {
      if (playerView) return;
      const opened = await setRecord(() => structuredClone(member), member => 'Opened ' + member.player.name + ' from the group.', { fill: true });
      if (opened) revealEncounter();
    });
    return element('li', [
      h(member.player.name),
      p((leader ? 'Leader · ' : '') + position + ' · ' + member.player.species),
      p([code(stats), ' · ' + member.work.competence.name], 'hint'),
      p(qualificationText(member), 'hint'),
      element('div', details, { class: 'actions' }),
    ], { 'data-group-member': leader ? 'leader' : 'specialist' });
  });
  $('group-members').replaceChildren(
    element('ol', entries, { class: 'group-member-list', 'aria-label': 'Leader and specialists', role: 'list' }),
    others.count ? p('Also present · ' + others.count + ' ' + others.description + '.', 'hint') : null,
  );
  $('group-rolls').replaceChildren(
    definition([['Seed', code(provenance.seed)], ['Group index', provenance.index], ['Group tables', provenance.packs.group],
      ['NPC generator', provenance.npcVersion]]),
    rollTable(provenance.rolls, 'Ordered group rolls'),
  );
}

function renderRecord() {
  const record = activeRecord();
  const player = record?.player;
  $('npc-name').textContent = player?.name ?? (mode === 'group' ? 'Your group' : 'Your NPC');
  $('npc-role').textContent = player ? playerSubtitle(player) : '';
  $('npc-intro').textContent = player?.introduction ?? 'The encounter introduction appears here.';
  renderPortrait($('encounter-plate'), record ? portraitId(record) : null);
  hidden('npc-role', !record);
  for (const id of ['next-npc', 'player-view', 'copy-player-link', 'share-handout', 'keep-npc', 'copy-card', 'player-export', 'save-referee-link', 'ref-export']) $(id).disabled = !record;
  if (record) {
    if (mode === 'group') renderGroupRecord();
    else renderNpcRecord();
  }
  feedback('card-feedback');
  updateRetainedRecord();
  updatePlayerView();
}

function updatePlayerView() {
  const showingGroup = mode === 'group';
  const record = activeRecord();
  $('generator').dataset.playerView = String(playerView);
  $('single-mode').setAttribute('aria-pressed', String(!showingGroup));
  $('group-mode').setAttribute('aria-pressed', String(showingGroup));
  $('player-view').setAttribute('aria-pressed', String(playerView));
  $('player-view').textContent = playerView ? 'Return to referee view' : 'Player view';
  $('next-npc').textContent = showingGroup ? 'Next group' : 'Next NPC';
  $('keep-npc').textContent = showingGroup ? 'Keep group' : 'Keep NPC';
  for (const id of ['status', 'encounter-mode', 'next-npc', 'open-roster', 'keep-npc', 'save-referee-link', 'ref-export']) hidden(id, playerView);
  hidden('settings', playerView || showingGroup);
  hidden('group-settings', playerView || !showingGroup);
  hidden('reroll-name', playerView || showingGroup || !record);
  hidden('referee', playerView || showingGroup || !record);
  hidden('group-referee', playerView || !showingGroup || !record);
  hidden('referee-brief', playerView || !record);
}

function shareableHandoutUrl(href) {
  if (location.protocol !== 'file:') return href;
  const canonical = document.querySelector('link[rel="canonical"]').href;
  return new URL(new URL(href).hash, canonical).href;
}

function updateHandoutLink() {
  const shareHiring = !$('handout-disclosures').hidden;
  const href = handoutUrl(location.href, activeRecord(), {
    qualifications: shareHiring && $('handout-qualifications').checked,
    availability: shareHiring && $('handout-availability').checked,
    pay: shareHiring ? field('handout-pay') : '',
  });
  $('open-handout').href = href;
  $('handout-link').value = shareableHandoutUrl(href);
}

function openHandoutDialog() {
  if (!activeRecord() || busy) return;
  const hiring = mode === 'npc' && !playerView && !npc.encounter && contexts[npc.controls.config.context].hiring;
  hidden('handout-disclosures', !hiring);
  $('handout-qualifications').checked = false;
  $('handout-availability').checked = false;
  $('handout-pay').value = '';
  if (hiring) {
    $('handout-qualifications-preview').textContent = qualificationText(npc);
    $('handout-availability-preview').textContent = npc.work.employment.status;
  }
  hidden('handout-link-label', true);
  feedback('handout-share-status');
  updateHandoutLink();
  $('handout-dialog').showModal();
}

function selectHandoutLink() {
  hidden('handout-link-label', false);
  $('handout-link').focus();
  $('handout-link').select();
  feedback('handout-share-status', 'Copy the selected handout link.');
}

async function copyPlayerLink() {
  const record = activeRecord();
  if (!record || busy) return;
  const link = shareableHandoutUrl(handoutUrl(location.href, record));
  try {
    await navigator.clipboard.writeText(link);
    if (activeRecord() === record) feedback('card-feedback', 'Player link copied.');
  } catch {
    if (activeRecord() !== record || busy || $('handout-dialog').open) return;
    openHandoutDialog();
    selectHandoutLink();
  }
}

function openRefereeLinkDialog() {
  const record = activeRecord();
  if (busy || playerView || !record) return;
  try {
    $('referee-link-url').value = refereeLink(location.href, record);
    feedback('referee-link-status');
    $('referee-link-dialog').showModal();
  } catch (error) { feedback('card-feedback', error.message); }
}

function renderSharedHandout() {
  document.documentElement.dataset.travellerHandout = '';
  hidden('generator', true);
  hidden('shared-handout', false);
  const handout = readHandout(location.hash);
  hidden('handout-error', !!handout);
  if (!handout) return;
  document.title = 'Traveller player handout';
  $('handout-name').textContent = handout.name;
  $('handout-role').textContent = playerSubtitle(handout);
  $('handout-intro').textContent = handout.introduction;
  renderPortrait($('handout-plate'), handout.portrait);
  const facts = [
    ['Qualifications', handout.qualifications?.map(([skill, level]) => skill + ' ' + level).join(' · ')],
    ['Availability', handout.availability], ['Pay offer', handout.pay],
  ].filter(([, value]) => value);
  $('handout-facts').replaceChildren(definition(facts));
  hidden('handout-facts', !facts.length);
  $('print-handout').addEventListener('click', () => window.print());
  hidden('handout-card', false);
}

function renderRoster() {
  try {
    const { entries, unreadable } = readRoster(localStorage);
    $('roster-list').replaceChildren(...entries.map(({ key, record }) => {
      const { name, role, lead } = record.player;
      const rosterName = lead ? name + ' led by ' + lead : name;
      const open = element('button', 'Open', { type: 'button', class: 'quiet compact', 'aria-label': 'Open ' + rosterName });
      open.addEventListener('click', async () => {
        const opened = await setRecord(() => restoreEncounter(record), record => 'Opened ' + recordName(record) + ' from the roster.', {
          fill: true, onError: message => feedback('roster-feedback', message),
        });
        if (!opened) return;
        $('campaign-roster').close();
        revealEncounter();
      });
      const remove = element('button', 'Remove', { type: 'button', class: 'quiet compact', 'aria-label': 'Remove ' + rosterName });
      remove.addEventListener('click', () => {
        if (!window.confirm('Remove ' + rosterName + ' from the campaign roster?')) return;
        try {
          removeFromRoster(localStorage, key);
          renderRoster();
          $('campaign-roster').querySelector('form button').focus();
        } catch {
          feedback('roster-feedback', 'The browser could not remove this record.');
        }
      });
      return element('li', [element('div', [h(name), p(lead ? role + ' · Lead ' + lead : playerSubtitle(record.player), 'hint')]),
        element('div', [open, remove], { class: 'actions' })], { class: 'summary-row' });
    }));
    feedback('roster-feedback', unreadable ? 'Some saved records could not be read.'
      : entries.length ? '' : 'Use Keep NPC or Keep group on the Encounter card.');
  } catch {
    $('roster-list').replaceChildren();
    feedback('roster-feedback', 'The browser could not open the local roster.');
  }
}

function file(content, type, suffix, record = activeRecord()) {
  const base = record.player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'traveller-encounter';
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = element('a', null, { href: url, download: base + '-' + record.provenance.index + '-' + suffix });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderAssignedGear(gear) {
  $('gear-list').replaceChildren(...gear.map((item, index) => element('div', [
    (equipmentCatalogue[item.catalogueId]?.name ?? item.name ?? item.catalogueId) + ' · ' + item.owner,
    element('button', 'Remove', { type: 'button', class: 'quiet compact', 'data-remove-gear': String(index),
      'aria-label': 'Remove ' + (equipmentCatalogue[item.catalogueId]?.name ?? item.name ?? 'item') }),
  ], { class: 'lock-row' })));
}

function updateGear(change) {
  try {
    const advanced = advancedOptions();
    const gear = [...(advanced.gear ?? [])];
    change(gear);
    if (gear.length) advanced.gear = gear;
    else delete advanced.gear;
    $('advanced').value = Object.keys(advanced).length ? JSON.stringify(advanced, null, 2) : '';
    renderAssignedGear(gear);
    settingsChanged('Equipment settings updated. Apply settings to resolve access and fit.');
  } catch (error) { status(error.message, 'error'); }
}

function renderRules() {
  const sourceRows = Object.entries(species).map(([id, profile]) => [profile.name, code(id), profile.source,
    profile.age.adult === null ? 'Adult age supplied or unspecified' : 'Adult model from ' + profile.age.adult]);
  $('rules-content').replaceChildren(
    p('The starter pool is 80% Human, 12% standard Vargr, and 8% Aslan. Library profiles are selectable or can be added to a campaign population by weight. Sources identify the exact rules used.'),
    p('The generator assigns competencies and current traits directly. The starter species are drawn from the Imperial model. Occupation, demographic, and narrative probability tables use the draft dated 24 November 2026.'),
    table(['2D', 'Competence', 'Primary', 'Supports 1, 2, 3'], tiers.map((tier, index) => [
      (index ? tiers[index - 1].high + 1 : 2) + (index === 3 ? '' : '–' + tier.high), tier.name, tier.ratings[0], tier.ratings.slice(1).join(', '),
    ]), { label: 'Competence roll table' }),
    p('The Vegan age scale follows the source’s longer terms. Ascondi standing uses a house adult-phase draw unless you supply it.'),
    p('A seed, NPC index, settings, data versions, and individual counters reproduce a roll. Ability requirements sample the eligible distribution.'),
    h('Group encounters'),
    p('House encounter tables roll the size, purpose, affiliation and shared 2D reaction. Then the 2E NPC generator builds an experienced leader and competent specialists. The headcount includes unnamed participants.'),
    p('The single reaction for the whole group draws on Classic Traveller Book 3, pp. 24–27. Group types and roles draw on the original Mongoose 2E Core Rulebook, pp. 85–90, High Guard, pp. 20–21, and Referee’s Briefing 4, pp. 7–8.'),
    p('The optional characteristic Boon uses the highest two of three dice where the profile uses ordinary 2D. Source · Traveller Companion, p. 11.'),
    h('Worked example from the draft'),
    p('Kessa Varr is a standard Vargr jump engineer. The example’s raw scores 7, 8, 8, 9, 10, and 6 become UPP 6979A6 after species adjustments. Experienced gives Engineer (j-drive) 2, Engineer (power) 1, Engineer (m-drive) 1, and Mechanic 1. The EDU-based jump-drive check starts at 2D + 3.'),
    h('Species profiles'), table(['Profile', 'Population key', 'Source', 'Age model'], sourceRows, { label: 'Enabled species sources' }),
    h('Published encounters'),
    table(['Profile', 'Source', 'Rules'], Object.values(encounterSpecies).map(profile =>
      [profile.name, profile.source, profile.hits == null ? 'Encounter traits' : 'Encounter Hits']),
    { label: 'Published encounter sources' }),
    h('Names and naming sources'),
    p('Automatic naming follows culture and species. The Imperial Galanglic pool has ' + imperialNameCounts.personal
      + ' given names and ' + imperialNameCounts.family + ' family names. Native names and formal variants appear in the referee record.'),
    element('details', [element('summary', 'Naming rules and references'),
      table(['Style', 'Basis', 'Source'], Object.values(nameStyles).map(style =>
        [style.label, style.basis, element('span', [style.source, ...(style.links ?? []).map(([label, href]) =>
          element('span', [' · ', link(label, href)]))])]), { label: 'Naming rules and sources' }),
      p(fanNameSources.flatMap(([label, href], index) => [index ? ' · ' : null, link(label, href)])),
    ]),
    p([link('Core Rulebook Update 2022', coreUrl), ' · ', link('August 2024 FAQ and errata', errataUrl), ' · ',
      link('Traveller Character Sheet', 'https://tedt.org/RPG/Traveller/Character-Sheet.html'), ' · ',
      link('Traveller Ship Sheet', 'https://tedt.org/RPG/Traveller/Ship-Sheet.html')]),
    p('Generator ' + version + ' · Species pack ' + packs.species + '. Traveller is a registered trademark of Far Future Enterprises.', 'hint'),
  );
  const example = {
    population: { human: 60, vargr: 30, droyne: 10, aslan: 0 },
    occupationWeights: { 13: 4, 41: 0 },
    backgroundWeights: { 1: 2, 2: 3 },
    identity: { nativeName: 'Campaign name', aliases: ['Port nickname'], ancestry: 'Optional', citizenship: 'Optional' },
    placement: { uncertainty: 'Last report is a day old', accommodations: [{ need: 'water', description: 'Fitted aquatic habitat' }] },
    skillGrants: [{ skill: 'Medic', level: 4, reason: 'Referee specified a specialist' }],
    augmentations: [{ id: 'au-1', name: 'Sourced implant', type: 'implant', modifiers: { DEX: 1 }, source: 'Campaign rule' }],
    conditions: [{ id: 'inj-1', name: 'Current injury', characteristic: 'END', loss: 1, source: 'Last session', recovery: 'Recovering' }],
    networkTarget: { id: 'contact-1', name: 'Another NPC', occupation: 'Broker' },
    partyRelationship: { target: { id: 'party', name: 'The Travellers' }, role: 'Contact', cause: 'A past job', consequence: 'Owes an introduction', status: 'proposed' },
    gear: [{ catalogueId: 'he-vacc-9', fit: ['human'], owner: 'Ship', location: 'ship', access: 'permission required' }],
  };
  $('option-docs').replaceChildren(
    p('Copy the entries you want into the advanced options. Population weights replace the defaults by profile key. Background weights refer to the six upbringing rows.'),
    element('pre', JSON.stringify(example, null, 2)),
    p('Use lifeform “clone” with clone fields donorId, chronologicalAge, biologicalAge, and memoryHistory. Use lifeform “modified” with a sourced genetic augmentation.'),
    p('To add a mechanical gear entry, supply catalogueId, name, source, kind, tl, fit, owner, location, access, and condition. Armour needs protection. A weapon needs damage, skill, attackCharacteristic, and requirements such as ammunition. Use fit IDs from the body selector.'),
    p('Additional options include fixed funds, affiliation, authority, custom specialties, and psion.weights. Habitat needs may include '
      + Object.keys(needs).join(', ') + '.'),
    p('Choose Referee-defined species to use a source you supply. Provide adult biology, dice, and habitat explicitly. This option supports STR, DEX, END, INT and EDU with optional SOC, RES or CHA.'),
    element('pre', JSON.stringify({
      customProfile: {
        name: 'Campaign sophont', source: 'Referee notes, version 1', living: true, sophont: true,
        body: 'Define the anatomy', movement: 'Define movement', senses: 'Define senses',
        manipulators: 'Define manipulators', communication: 'Define communication',
        needs: ['breathable'], age: { adult: null },
        order: ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'],
        characteristics: Object.fromEntries(['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'].map(stat =>
          [stat, { count: 2, sides: 6, adjustment: 0 }])),
      },
    }, null, 2)),
  );
}

const searchText = value => value.normalize('NFD').replace(/\p{M}|['’‘]/gu, '').toLowerCase();

function guideEntry({ name, source, portrait, note, profileId, action }) {
  const plate = portraitFor(portrait);
  const figure = plate ? element('figure', null, { class: 'species-plate' }) : null;
  if (figure) renderPortrait(figure, portrait, { lazy: true });
  const roll = action ? element('button', action, { type: 'button', class: 'quiet compact guide-roll',
    'data-roll-profile': profileId, 'aria-label': action + ' for ' + name }) : null;
  const node = element('li', [
    element('div', [element('div', [h(name), p(source, 'hint')]), roll], { class: 'summary-row' }),
    note ? p(note, 'hint') : null,
    portrait && !action ? p(['Plate ', code(portrait)], 'hint') : null,
    figure,
  ]);
  const query = searchText([name, source, profileId, plate?.title, plate?.source].filter(Boolean).join(' '));
  return { node, query };
}

function guideGroup(label, items, url) {
  return { items, node: element('details', [
    element('summary', label), url ? p(link('Publisher’s book page', url), 'hint') : null,
    element('ul', items.map(item => item.node), { class: 'guide-list', role: 'list' }),
  ], { class: 'group' }) };
}

function renderSpeciesGuide() {
  const profiles = (data, action) => Object.entries(data).sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([profileId, profile]) => guideEntry({ name: profile.name, source: profile.source, portrait: profileId, profileId, action }));
  const rollable = [guideGroup('NPC profiles', profiles(species, 'Roll NPC')),
    guideGroup('Published encounters', profiles(encounterSpecies, 'Roll encounter'))];
  const books = referenceGroups.map(({ book, url, entries }) => guideGroup(book, entries.map(entry => guideEntry({
    name: entry.name, source: book + ', ' + entry.page, portrait: entry.art, note: entry.note,
  })), url));
  const references = element('details', [element('summary', 'Book references'),
    element('div', books.map(group => group.node))], { class: 'group' });
  const search = element('input', null, { id: 'search-species', type: 'search', placeholder: 'Species or sourcebook',
    autocomplete: 'off', 'aria-controls': 'reference-results' });
  const matches = element('p', '', { class: 'hint feedback', role: 'status' });
  function filterGroups(groups, terms) {
    let count = 0;
    for (const { node, items } of groups) {
      let visible = 0;
      for (const item of items) {
        item.node.hidden = !terms.every(term => item.query.includes(term));
        if (!item.node.hidden) visible++;
      }
      node.hidden = !visible;
      node.open = Boolean(terms.length && visible);
      count += visible;
    }
    return count;
  }
  search.addEventListener('input', () => {
    const terms = searchText(search.value.trim()).split(/\s+/).filter(Boolean);
    const bookCount = filterGroups(books, terms);
    references.hidden = !bookCount;
    references.open = Boolean(terms.length && bookCount);
    const count = filterGroups(rollable, terms) + bookCount;
    matches.textContent = terms.length ? count + (count === 1 ? ' entry found' : ' entries found') : '';
  });
  $('guide-content').replaceChildren(
    element('label', ['Find a species or source', search], { for: 'search-species' }), matches,
    element('div', [...rollable.map(group => group.node), references], { id: 'reference-results' }),
  );
}

async function initialize() {
  let initialMode = 'npc';
  try {
    playerView = sessionStorage.getItem(playerViewKey) === 'true';
    if (sessionStorage.getItem(encounterModeKey) === 'group') initialMode = 'group';
  }
  catch { /* Storage can be unavailable when the document is opened locally. */ }
  $('settings-options').open = !compactLayout.matches;
  $('group-options').open = !compactLayout.matches;
  updatePlayerView();
  select('context', Object.entries(contexts).map(([key, value]) => [key, value.name]));
  const starter = ['human', 'vargr', 'aslan'];
  select('species', [['random', 'Roll from campaign population'],
    ['Imperial starter profiles', starter.map(key => [key, species[key].name])],
    ['Library species and variants', Object.entries(species).filter(([key, value]) =>
      !starter.includes(key) && !value.setting).map(([key, value]) => [key, value.name])],
    ['Castrobancla campaign', Object.entries(species).filter(([, value]) => value.setting === 'castrobancla').map(([key, value]) => [key, value.name])],
    ['Published encounters', Object.entries(encounterSpecies).map(([key, value]) => [key, value.name])],
    ['custom', 'Referee-defined species']]);
  select('group-scene', Object.entries(groupScenes));
  select('group-species', [['random', 'Roll from the Imperial starter pool'],
    ...Object.entries(species).map(([id, entry]) => [id, entry.name])]);
  select('name-style', [['auto', 'Automatic · species and culture'],
    ...Object.entries(nameStyles).map(([key, value]) => [key, value.label])]);
  select('culture', [['auto', 'Species default'], ...Object.entries(cultures).map(([key, value]) => [key, value.name])]);
  select('occupation', roleOptions());
  select('secondary', roleOptions(true));
  select('competence', [['random', 'Roll 2D'], ...tiers.map(tier => [tier.id, tier.name])]);
  select('talent', [['random', 'Roll a permitted talent'], ...specialties.psion.map(name => [name, name])]);
  select('gear-item', Object.entries(equipmentCatalogue).map(([id, item]) => [id, item.name + ' · TL' + item.tl]));
  select('gear-fit', [['universal', 'Universal handheld'], ['custom', 'Referee-defined body'], ...Object.entries(Object.fromEntries(Object.values(species).reverse()
    .map(profile => [profile.fit, profile.name]))).sort((a, b) => a[1].localeCompare(b[1])).map(([key, label]) => [key, label])], 'human');
  updateProfileControls();
  renderRules();
  renderSpeciesGuide();
  for (const entry of document.querySelectorAll('a[href="#species-guide"]')) {
    entry.addEventListener('click', () => $('search-species').focus({ preventScroll: true }));
  }
  $('guide-content').addEventListener('click', async event => {
    const profile = event.target.closest('[data-roll-profile]')?.dataset.rollProfile;
    if (!profile || busy || playerView) return;
    if (mode === 'group') await openEncounterMode('npc');
    $('species').value = profile;
    updateProfileControls();
    void generation({ next: true, reveal: true });
  });
  $('config-form').addEventListener('submit', event => { event.preventDefault(); void generation(); });
  $('group-form').addEventListener('submit', event => { event.preventDefault(); void generation(); });
  $('single-mode').addEventListener('click', () => void openEncounterMode('npc'));
  $('group-mode').addEventListener('click', () => void openEncounterMode('group'));
  $('seed').addEventListener('invalid', () => { $('seed-settings').open = true; });
  $('group-seed').addEventListener('invalid', () => { $('group-seed-settings').open = true; });
  $('group-scene').addEventListener('change', () => updateGroupTypes());
  $('group-form').addEventListener('input', ({ target }) => {
    if (target.id !== 'import-group') settingsChanged('Settings changed. Roll group to update the encounter.');
  });
  $('config-form').addEventListener('input', ({ target }) => {
    if (target.id === 'import-npc' || target.id.startsWith('gear-')) return;
    if (target.id === 'required-skills') renderSkillMinimums();
    settingsChanged();
  });
  $('clear-skill-minimums').addEventListener('click', () => {
    if (busy) return;
    $('required-skills').value = '';
    renderSkillMinimums();
    settingsChanged();
    $('apply-settings').focus();
    $('config-form').requestSubmit($('apply-settings'));
  });
  $('next-npc').addEventListener('click', () => void generation({ next: true }));
  $('new-seed').addEventListener('click', () => void generation({ seedChange: true }));
  $('group-new-seed').addEventListener('click', () => void generation({ seedChange: true }));
  for (const id of ['species', 'culture', 'name-style', 'occupation', 'secondary', 'adult-form', 'age-mode', 'psi-mode']) {
    $(id).addEventListener('change', () => {
      if (id === 'psi-mode' && field('psi-mode') === 'trained') $('occupation').value = 'psion';
      if (id === 'occupation' && field('occupation') !== 'psion' && field('psi-mode') === 'trained') $('psi-mode').value = 'auto';
      updateProfileControls();
    });
  }
  $('medic-preset').addEventListener('click', () => void applyHiringPreset('hiring', ['random', '15', '53'], 'Medic = 2'));
  $('pilot-preset').addEventListener('click', () => void applyHiringPreset('crew', ['random', '11', '12'], 'Pilot (spacecraft) = 1\nAstrogation = 1'));
  $('add-gear').addEventListener('click', () => updateGear(gear => gear.push({
    catalogueId: field('gear-item'), fit: [field('gear-fit')], owner: field('gear-owner'), access: field('gear-access'),
    location: field('gear-location'), legality: field('gear-legality'), ammunition: integerField('gear-ammo'),
  })));
  $('gear-list').addEventListener('click', event => {
    const index = event.target.dataset.removeGear;
    if (index !== undefined) updateGear(gear => gear.splice(Number(index), 1));
  });
  const importRecord = async event => {
    const selected = event.target.files[0];
    if (!selected) return;
    event.target.value = '';
    const opened = await setRecord(async () => {
      requireRule(selected.size <= 2_000_000, 'Choose a referee JSON record under 2 MB.');
      let saved;
      try { saved = JSON.parse(await selected.text()); }
      catch { throw new Error('The selected referee record is not valid JSON.'); }
      return restoreEncounter(saved);
    }, record => 'Opened ' + recordName(record) + '.', { fill: true });
    if (opened && compactLayout.matches) revealEncounter();
  };
  for (const id of ['import-npc', 'import-group']) $(id).addEventListener('change', importRecord);
  $('locks').addEventListener('change', event => {
    if (busy || !npc || !event.target.dataset.lock) return;
    const key = event.target.dataset.lock;
    const checked = event.target.checked;
    npc.controls.locks = setLock(npc, key, checked);
    clearRefereeLink();
    remember(npc);
    $('reroll-name').disabled = has(npc.controls.locks, 'name');
    const button = event.target.closest('.lock-row').querySelector('button');
    if (button) button.disabled = checked;
    status(checked ? 'Value locked.' : 'Value unlocked.');
  });
  $('locks').addEventListener('click', event => {
    const fields = event.target.closest('[data-reroll]')?.dataset.reroll;
    if (fields) void reroll(fields.split(','));
  });
  $('reroll-name').addEventListener('click', () => void reroll(['name']));
  $('player-view').addEventListener('click', () => {
    playerView = !playerView;
    try { sessionStorage.setItem(playerViewKey, String(playerView)); }
    catch { /* The separate handout can still be opened without storage. */ }
    feedback('card-feedback');
    updatePlayerView();
  });
  $('copy-player-link').addEventListener('click', copyPlayerLink);
  $('share-handout').addEventListener('click', openHandoutDialog);
  $('handout-disclosures').addEventListener('input', () => {
    updateHandoutLink();
    feedback('handout-share-status');
  });
  $('copy-handout-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('handout-link').value);
      feedback('handout-share-status', 'Handout link copied.');
    } catch {
      selectHandoutLink();
    }
  });
  $('save-referee-link').addEventListener('click', openRefereeLinkDialog);
  $('copy-referee-link').addEventListener('click', async () => {
    const input = $('referee-link-url');
    try {
      await navigator.clipboard.writeText(input.value);
      feedback('referee-link-status', 'Referee link copied.');
    } catch {
      input.focus();
      input.select();
      feedback('referee-link-status', 'Copy the selected referee link.');
    }
  });
  $('bookmark-address').addEventListener('click', () => {
    try {
      history.replaceState(history.state, '', $('referee-link-url').value);
      feedback('referee-link-status', 'The referee link is in the address bar. You can bookmark this page.');
    } catch {
      $('referee-link-url').focus();
      $('referee-link-url').select();
      feedback('referee-link-status', 'Copy the selected link to bookmark this encounter.');
    }
  });
  $('keep-npc').addEventListener('click', async () => {
    const record = activeRecord();
    if (!record || playerView || busy) return;
    const name = recordName(record);
    try {
      await keepInRoster(localStorage, record);
      if (!playerView) feedback('card-feedback', name + ' is in the campaign roster.');
    } catch {
      if (!playerView) feedback('card-feedback', 'The browser could not save this encounter. Export the referee JSON to keep it.');
    }
  });
  $('open-roster').addEventListener('click', () => {
    if (playerView) return;
    renderRoster();
    $('campaign-roster').showModal();
  });
  $('copy-card').addEventListener('click', async () => {
    const record = activeRecord();
    try {
      await navigator.clipboard.writeText(record.player.introduction);
      feedback('card-feedback', 'Player introduction copied.');
    } catch {
      file(record.player.introduction + '\n', 'text/plain', 'player.txt', record);
      feedback('card-feedback', 'Downloaded the player introduction.');
    }
  });
  $('player-export').addEventListener('click', () => file(activeRecord().player.introduction + '\n', 'text/plain', 'player.txt'));
  $('ref-export').addEventListener('click', () => file(JSON.stringify(activeRecord(), null, 2) + '\n', 'application/json', 'referee.json'));
  $('check-section').addEventListener('input', renderCheck);
  $('check-section').addEventListener('change', renderCheck);

  fillSettings(normalizeConfig(), freshSeed());
  fillGroupSettings(normalizeGroupConfig(), freshSeed());
  let linkProblem;
  if (isRefereeLink(location.hash)) {
    const opened = await setRecord(() => restoreEncounter(readRefereeLink(location.hash)),
      record => readyMessage(record, 'Restored '), { fill: true, persist: false, onError: error => { linkProblem = error; } });
    if (opened) return;
  }
  await openEncounterMode(initialMode);
  if (linkProblem) status('Could not open the referee link. ' + linkProblem, 'error');
}

window.addEventListener('hashchange', () => {
  if (isHandoutLink(location.hash) || isRefereeLink(location.hash) || !$('shared-handout').hidden) location.reload();
});
if (isHandoutLink(location.hash)) renderSharedHandout();
else void initialize().catch(error => status(error.message || 'The generator failed to initialize.', 'error'));
