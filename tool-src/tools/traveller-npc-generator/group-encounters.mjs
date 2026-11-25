import { setCharacterSheet } from './character-sheet.mjs';
import { integer, normalizeAdditionalSelection, object, option, requireRule, text } from './config.mjs';
import { generateNpc } from './generator.mjs';
import { groupScenes, groupTypes } from './group-types.mjs';
import { stableId, streams } from './random.mjs';
import { species } from './species.mjs';
import { attitudeFor, packs, version as npcVersion } from './tables.mjs';

export const groupSchema = 'tedstools.traveller-group/1';
const version = '1.0.0';
const groupPacks = Object.freeze({ ...packs, group: 'group-encounters/1' });

export const isGroupEncounter = record => record?.schema === groupSchema;

export function groupsForScene(scene) {
  return Object.entries(groupTypes).filter(([, type]) => scene === 'any' || type.scenes.includes(scene));
}

export function normalizeGroupConfig(input = {}) {
  requireRule(object(input), 'Group settings must be an object.');
  const scene = option(input.scene ?? 'any', Object.keys(groupScenes), 'Scene');
  const additionalCharacteristics = normalizeAdditionalSelection(input.additionalCharacteristics);
  return {
    scene,
    type: option(input.type ?? 'random', ['random', ...groupsForScene(scene).map(([id]) => id)], 'Group type'),
    species: option(input.species ?? 'random', ['random', ...Object.keys(species)], 'Member species'),
    ...(additionalCharacteristics.length && { additionalCharacteristics }),
  };
}

export async function generateGroup(input = {}, state = {}) {
  const config = normalizeGroupConfig(input);
  const seed = text(state.seed, 'Group seed', { required: true, max: 256 });
  const index = integer(state.index ?? 1, 'Group index', 1, Number.MAX_SAFE_INTEGER);
  const id = (await stableId('group:' + seed, index)).replace(/^npc-/, 'group-');
  const rolls = [];
  const rng = streams(seed, index, {}, rolls, groupPacks);
  const draw = (key, choices, label) => rng('group.' + key, 'group').pick(choices.map(value =>
    ({ value, label: value, weight: 1 })), label);

  const eligibleTypes = config.type === 'random' ? groupsForScene(config.scene) : [[config.type, groupTypes[config.type]]];
  const typeId = await rng('group.type', 'group').pick(eligibleTypes.map(([value, type]) =>
    ({ value, label: type.name, weight: 1 })), 'Group type');
  const type = groupTypes[typeId];
  const scene = config.scene === 'any' ? await draw('scene', type.scenes, 'Scene within this group type') : config.scene;
  const [minimum, maximum] = type.size;
  const size = await draw('size', Array.from({ length: maximum - minimum + 1 }, (_, i) => minimum + i), 'People present');
  const purpose = await draw('purpose', type.purposes, 'Shared purpose');
  const affiliation = await draw('affiliation', type.affiliations, 'Affiliation');
  const reactionRng = rng('group.reaction', 'group');
  const { dice, total } = await reactionRng.dice(2, 'Initial reaction');
  const reaction = { dice, total, attitude: attitudeFor(total) };
  reactionRng.log({ label: 'Initial reaction', result: reaction.attitude, method: '2D total ' + total });

  const leadershipForbidden = species[config.species]?.forbidden?.includes('Leadership');
  const members = await Promise.all(type.roles.slice(0, size).map(async ([position, standard, alternate], slot) => {
    const occupation = leadershipForbidden && alternate ? alternate : standard;
    const npc = await generateNpc({
      species: config.species, occupation, affiliation,
      competence: slot === 0 ? 'experienced' : 'competent',
      placement: { current: groupScenes[scene] },
      additionalCharacteristics: config.additionalCharacteristics,
    }, {
      seed: id + '-member-' + (slot + 1),
      locks: { attitude: reaction.attitude, employment: 3 },
    });
    return { position, leader: slot === 0, npc };
  }));

  return {
    schema: groupSchema, id, typeId, type: type.name, scene, size, purpose, affiliation, reaction,
    members,
    others: { count: size - members.length, description: type.others },
    controls: { config },
    provenance: { version, npcVersion, packs: groupPacks, seed, index, rolls },
    player: {
      name: type.publicName ?? type.name,
      role: size + ' people',
      introduction: size + ' people ' + type.appearance,
    },
  };
}

export async function restoreGroup(saved) {
  requireRule(isGroupEncounter(saved), 'Choose a group referee JSON record exported by this generator.');
  const { provenance, controls } = saved;
  requireRule(object(provenance) && provenance.version === version && provenance.npcVersion === npcVersion
    && object(provenance.packs) && Object.entries(groupPacks).every(([key, value]) => provenance.packs[key] === value),
  'The saved group uses a different generator or data-pack version.');
  requireRule(object(controls) && object(controls.config), 'The saved group is missing its generator controls.');
  const restored = await generateGroup(controls.config, { seed: provenance.seed, index: provenance.index });
  requireRule(restored.id === saved.id, 'The group ID does not match the seed and index.');
  applyMemberSheets(restored, controls.memberSheets);
  return restored;
}

export function setMemberSheet(group, member, data) {
  setCharacterSheet(member, data);
  const sheets = Object.fromEntries(group.members.filter(({ npc }) => npc.controls.characterSheet)
    .map(({ npc }) => [npc.id, npc.controls.characterSheet]));
  if (Object.keys(sheets).length) group.controls.memberSheets = sheets;
  else delete group.controls.memberSheets;
}

export function applyMemberSheets(group, sheets) {
  if (sheets == null) return;
  requireRule(object(sheets) && Object.keys(sheets).length <= group.members.length, 'Invalid saved group member sheets.');
  for (const [id, sheet] of Object.entries(sheets)) {
    const member = group.members.find(({ npc }) => npc.id === id);
    requireRule(member, 'A character sheet refers to a missing group member.');
    setMemberSheet(group, member.npc, sheet);
  }
}
