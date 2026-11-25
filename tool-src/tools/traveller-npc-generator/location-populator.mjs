import { applyMemberSheets } from './character-sheet.mjs';
import { normalizeAdditionalSelection, integer, object, option, requireRule, text } from './config.mjs';
import { generateNpc, rerollNpc } from './generator.mjs';
import { locationAreas, locationScales, locationTypes } from './location-types.mjs';
import { stableId, streams } from './random.mjs';
import { species } from './species.mjs';
import { packs, version as npcVersion } from './tables.mjs';

export const locationSchema = 'tedstools.traveller-location/1';
const version = '1.0.0';
const locationPacks = Object.freeze({ ...packs, location: 'location-populator/1' });
const placeNames = [
  'Amber Reach', 'Ashwater', 'Bellwether', 'Breakwater', 'Burnished Vega', 'Cairn', 'Cinder Gate', 'Copper Meridian',
  'Dawn Crossing', 'Deep Lantern', 'Dunehaven', 'Ember Quay', 'Endeavour', 'Far Current', 'Gannet', 'Greywake',
  'Harbour Light', 'Iron Star', 'Keelwater', 'Kestrel', 'Long Horizon', 'Low Orbit', 'Marrow Bay', 'Near Dawn',
  'North Keel', 'Old Beacon', 'Peregrine', 'Quiet Shoal', 'Redhaven', 'Sable', 'Silverline', 'Still Spin',
  'Tern Drift', 'Third Lantern', 'Vale Crossing', 'Wayfarer', 'White Ridge', 'Windward',
];
const leadershipAlternates = { 21: '31', 32: '44', 33: '31', 34: '44', 43: '44' };

export const isLocation = record => record?.schema === locationSchema;

export function normalizeLocationConfig(input = {}) {
  requireRule(object(input), 'Location settings must be an object.');
  const additionalCharacteristics = normalizeAdditionalSelection(input.additionalCharacteristics);
  return {
    type: option(input.type ?? 'free-trader', ['random', ...Object.keys(locationTypes)], 'Location type'),
    scale: option(input.scale ?? 'standard', Object.keys(locationScales), 'Cast size'),
    species: option(input.species ?? 'random', ['random', ...Object.keys(species)], 'Cast species'),
    name: text(input.name, 'Location name', { max: 120 }),
    ...(additionalCharacteristics.length && { additionalCharacteristics }),
  };
}

export async function populateLocation(input = {}, state = {}) {
  const config = normalizeLocationConfig(input);
  const seed = text(state.seed, 'Location seed', { required: true, max: 256 });
  const index = integer(state.index ?? 1, 'Location index', 1, Number.MAX_SAFE_INTEGER);
  const id = (await stableId('location:' + seed, index)).replace(/^npc-/, 'location-');
  const rolls = [];
  const rng = streams(seed, index, {}, rolls, locationPacks);
  async function pick(field, values, label, describe = value => value) {
    return rng('location.' + field, 'location').pick(values.map(value => ({ value, label: describe(value), weight: 1 })), label);
  }

  const typeId = config.type === 'random' ? await pick('type', Object.keys(locationTypes), 'Location type', key => locationTypes[key].name) : config.type;
  const template = locationTypes[typeId];
  const name = config.name ?? await pick('name', placeNames, 'Location name');
  const operator = await pick('operator', template.operators, 'Operator');
  const [involved, description] = await pick('situation', template.situations, 'Current situation', ([, summary]) => summary);
  const [minimum, maximum] = locationScales[config.scale].supporting;
  const areas = [];
  const roles = [];
  for (const key of template.areas) {
    const area = locationAreas[key];
    const count = minimum - 1 + await rng('location.' + key + '.size', 'location')
      .draw(maximum - minimum + 1, area.name + ' supporting cast');
    const first = await rng('location.' + key + '.cast', 'location').draw(area.cast.length, area.name + ' starting role') - 1;
    areas.push({ id: key, name: area.name, supporting: count });
    roles.push({ area: key, position: area.position, occupation: area.occupation, authority: area.authority, important: true });
    for (let i = 0; i < count; i++) {
      const [position, occupation, visitor = false] = area.cast[(first + i) % area.cast.length];
      roles.push({ area: key, position, occupation, visitor, slot: i + 1, important: false });
    }
  }

  const leadershipForbidden = species[config.species]?.forbidden?.includes('Leadership');
  const members = await Promise.all(roles.sort((a, b) => Number(b.important) - Number(a.important))
    .map(async ({ area, position, occupation, authority, visitor, slot, important }) => {
      const npc = await generateNpc({
        species: config.species,
        occupation: leadershipForbidden ? leadershipAlternates[occupation] ?? occupation : occupation,
        competence: important ? 'experienced' : 'competent',
        affiliation: visitor ? null : operator,
        placement: { current: name + ' · ' + locationAreas[area].name },
        authority,
        additionalCharacteristics: config.additionalCharacteristics,
      }, {
        seed: id + '-' + typeId + '-' + area + '-' + (slot ?? 'contact'),
        locks: visitor ? {} : { employment: 3 },
      });
      return { area, position, important, npc };
    }));
  const names = new Set();
  for (const member of members) {
    for (let attempt = 0; attempt < 5 && names.has(member.npc.player.name); attempt++) {
      member.npc = await rerollNpc(member.npc, ['name']);
    }
    names.add(member.npc.player.name);
  }
  const contacts = involved.map(area => members.find(member => member.area === area && member.important).npc.id);

  return {
    schema: locationSchema, id, typeId, type: template.name, name, operator, areas,
    situation: { description, contacts }, members,
    controls: { config },
    provenance: { version, npcVersion, packs: locationPacks, seed, index, rolls },
    player: { name, role: template.name, introduction: template.appearance },
  };
}

export async function restoreLocation(saved) {
  requireRule(isLocation(saved), 'Choose a location referee record exported by this generator.');
  const { controls, provenance } = saved;
  requireRule(object(provenance) && provenance.version === version && provenance.npcVersion === npcVersion
    && object(provenance.packs) && Object.entries(locationPacks).every(([key, value]) => provenance.packs[key] === value),
  'The saved location uses a different generator or data-pack version.');
  requireRule(object(controls) && object(controls.config), 'The saved location is missing its generator controls.');
  const restored = await populateLocation(controls.config, { seed: provenance.seed, index: provenance.index });
  requireRule(restored.id === saved.id, 'The location ID does not match the seed and index.');
  applyMemberSheets(restored, controls.memberSheets);
  return restored;
}
