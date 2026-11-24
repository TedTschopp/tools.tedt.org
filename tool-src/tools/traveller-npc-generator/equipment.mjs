import { has, integer, object, option, requireRule, skillName, text, validateRating } from './config.mjs';
import { rating, taskCheck } from './mechanics.mjs';
import { needs } from './species.mjs';
import { equipmentCatalogue, kit } from './tables.mjs';

const accessOptions = ['immediate', 'permission required', 'conditional', 'unavailable'];
const locations = ['carried', 'worn', 'lodging', 'vehicle', 'ship', 'facility'];
const conditions = ['serviceable', 'worn', 'damaged', 'inoperable'];
const legalities = ['unknown', 'permitted', 'restricted', 'illegal'];

function trainingRule(value) {
  if (value == null) return null;
  requireRule(object(value), 'Equipment training needs a skill and level.');
  const skill = skillName(value.skill);
  validateRating(skill, value.level, 'Equipment training level');
  return { skill, level: value.level };
}

export function catalogueGear(item, index, npc) {
  requireRule(object(item), 'Equipment entry ' + (index + 1) + ' must be an object.');
  const catalogueId = text(item.catalogueId, 'Catalogue ID', { required: true, max: 100 });
  const known = has(equipmentCatalogue, catalogueId) ? equipmentCatalogue[catalogueId] : null;
  const spec = known ?? item;
  const kind = option(spec.kind, ['weapon', 'armour', 'tool'], 'Equipment kind');
  const fit = item.fit;
  requireRule(Array.isArray(fit) && fit.length && fit.every(entry => typeof entry === 'string' && entry.trim()),
    'Equipment ' + catalogueId + ' requires a fit list, such as ["human"] or ["universal"] for a handheld item.');
  const fitted = fit.includes(npc.biology.fit) || (kind !== 'armour' && fit.includes('universal'));
  const source = text(spec.source, 'Equipment source for ' + catalogueId, { required: true });
  const name = text(spec.name, 'Equipment name', { required: true });
  const owner = text(item.owner, name + ' owner', { required: true });
  const access = option(item.access, accessOptions, name + ' access');
  const condition = option(item.condition ?? 'serviceable', conditions, name + ' condition');
  const location = option(item.location, locations, name + ' location');
  const legality = option(item.legality ?? 'unknown', legalities, name + ' legality');
  const training = trainingRule(spec.training);
  const tl = integer(spec.tl, name + ' tech level', 0, 99);
  const protection = kind === 'armour' ? integer(spec.protection, name + ' Protection', 0, 99) : null;
  const equipmentSkill = kind === 'weapon' ? skillName(spec.skill) : null;
  const attackCharacteristic = kind === 'weapon' ? option(spec.attackCharacteristic,
    Object.keys(npc.mechanics.characteristics).filter(stat => stat !== 'PSI'), name + ' attack characteristic') : null;
  const damage = kind === 'weapon' ? text(spec.damage, name + ' base damage', { required: true }) : null;
  requireRule(!damage || /^(?:\d+D{1,2}(?:[+-]\d+)?|\d+)$/.test(damage), 'Damage for ' + name + ' must be a dice expression such as 2D+1.');
  const environments = spec.environments ?? [];
  requireRule(Array.isArray(environments) && environments.every(environment => ['vacuum', 'unbreathable', 'water'].includes(environment)),
    name + ' has an unsupported equipment environment.');
  const accommodation = spec.accommodation ?? [];
  requireRule(Array.isArray(accommodation) && accommodation.every(key => has(needs, key)), name + ' has an unsupported accommodation.');
  const requiresAmmo = kind === 'weapon' && spec.requiresAmmo === true;
  const ammunition = item.ammunition == null ? null : integer(item.ammunition, name + ' ammunition', 0, 100000);
  const level = training ? rating(npc.mechanics.skills, training.skill) : null;
  const trainingShortfall = training ? Math.max(0, training.level - (level ?? -1)) : 0;
  const ready = fitted && access === 'immediate' && ['serviceable', 'worn'].includes(condition) && (!requiresAmmo || ammunition > 0);
  const imported = item.imported === true;
  const localTL = npc.places.localTL;
  const supply = imported ? 'Imported' : localTL !== null && tl > localTL ? 'Above local TL; verify supply and maintenance' : null;
  return {
    id: 'assigned-' + (index + 1), catalogueId, name, kind, source, url: known?.url ?? null, owner, access,
    location, condition, fit, fitted, legality, imported, supply, tl, protection, damage,
    equipmentSkill, attackCharacteristic, training, trainingShortfall, requiresAmmo, ammunition,
    traits: text(spec.traits, name + ' traits'), environments, accommodation, ready,
  };
}

function descriptiveGear(npc, possession) {
  const descriptive = (id, name, owner, location, access) => ({
    id, catalogueId: null, name, owner, location, access, condition: 'Serviceable by description',
    fit: [npc.biology.fit], kind: 'descriptive',
  });
  const personal = (id, name, location = 'carried') => descriptive(id, name, 'Personal', location, 'immediate');
  const affiliation = npc.work.employment.affiliation;
  const hiring = npc.work.employment.seeking;
  const category = npc.work.occupation.kit;
  const ship = ['ship', 'gunnery'].includes(category)
    || (category === 'engineering' && ['13', '26', 'engineer-power', 'engineer-mdrive'].includes(npc.work.occupation.id));
  const shipAsset = ship ? 'Assigned vessel' : affiliation;
  const work = kit[category].map((name, index) => descriptive('kit-' + (index + 1), name, shipAsset,
    ship ? 'ship' : 'facility', hiring ? 'conditional' : 'permission required'));
  return [
    personal('clothing', 'Weather-appropriate covering fitted for ' + npc.biology.name, 'worn'),
    personal('identification', 'Ordinary personal identification'),
    personal('communication', 'Personal communications interface · ' + npc.culture.nativeCommunication),
    personal('possession', possession),
    ...work,
  ];
}

function habitat(npc, assigned, placement) {
  const requirements = npc.biology.needs;
  const native = ['breathable', 'water'].includes(placement.medium) ? [placement.medium] : [];
  const nativeMedium = native.some(medium => requirements.includes(medium));
  const support = new Set(placement.accommodations.map(item => item.need));
  if (placement.medium === 'water' && npc.biology.profileId === 'aquamorph') support.add('humid');
  if (/^amarja\b/i.test(placement.current ?? '')) support.add('amarja');
  for (const item of assigned.filter(entry => entry.ready)) {
    for (const need of item.accommodation) support.add(need);
    if (item.environments.includes(placement.medium) && ['vacuum', 'unbreathable'].includes(placement.medium)) support.add('breathable');
    if (placement.medium === 'breathable' && item.environments.includes('water')) support.add('water');
  }
  const mediumNeeds = requirements.filter(key => ['breathable', 'water'].includes(key));
  const requiredMedium = mediumNeeds.length && !nativeMedium && !mediumNeeds.some(key => support.has(key));
  const missing = [
    ...(requiredMedium ? [mediumNeeds.map(key => needs[key]).join(' or ')] : []),
    ...requirements.filter(key => !mediumNeeds.includes(key) && !support.has(key)).map(key => needs[key]),
  ];
  if (placement.medium === 'unknown') return {
    status: 'unverified', message: placement.current ? 'Environment is unspecified at this location.' : 'Confirm the setting and any required accommodations.', missing,
  };
  return missing.length ? { status: 'missing support', message: 'This placement needs accommodation.', missing }
    : { status: 'ready', message: 'The specified environment and available accommodations meet the profile’s needs.', missing: [] };
}

export function resolveEquipment(npc, config, possession) {
  const assigned = config.gear.map((item, index) => catalogueGear(item, index, npc));
  const armor = assigned.filter(item => item.kind === 'armour');
  const weapons = assigned.filter(item => item.kind === 'weapon');
  const incomplete = assigned.filter(item => item.kind !== 'tool' && !item.ready).map(item => item.name);
  const armed = npc.work.occupation.kit === 'armed';
  const missing = [];
  if (armed && !weapons.some(item => item.ready)) missing.push('An immediately available, fitted weapon and any required ammunition');
  if (armed && !armor.some(item => item.ready)) missing.push('Immediately available, fitted armour');
  for (const item of incomplete) missing.push(item + ' needs a fit, access, condition, or ammunition check');
  const combat = {
    status: missing.length ? 'incomplete' : armor.length || weapons.length ? 'loadout resolved' : 'profile only',
    missing,
  };
  const attacks = [
    ...npc.biology.attacks.map(attack => ({ ...attack, source: npc.biology.source, natural: true,
      check: taskCheck(npc, attack.skill, attack.characteristic, { unarmed: true, other: attack.attackDM }),
      meleeDamageDM: npc.mechanics.characteristics.STR.dm })),
    ...weapons.filter(item => item.ready).map(item => ({
      name: item.name, skill: item.equipmentSkill, characteristic: item.attackCharacteristic,
      damage: item.damage, source: item.source, natural: false,
      check: taskCheck(npc, item.equipmentSkill, item.attackCharacteristic),
      ammunition: item.ammunition, traits: item.traits,
      meleeDamageDM: item.equipmentSkill.startsWith('Melee (') ? npc.mechanics.characteristics.STR.dm : null,
    })),
  ];
  return {
    equipment: [...descriptiveGear(npc, possession), ...assigned],
    personalAssets: assigned.filter(item => item.owner.toLowerCase() === 'personal').map(item => item.id),
    attacks, combat, environment: habitat(npc, assigned, config.placement),
  };
}
