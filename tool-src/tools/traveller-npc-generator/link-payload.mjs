import { deflateSync, Inflate } from 'fflate';

// These bytes are part of the r1 and h1 wire formats. Keep this dictionary fixed
// when generator defaults or data packs change. It only supplies common JSON text.
const npcPacks = {
  characteristics: 'core-2022-aug2024/1', species: 'core-and-library/1', culture: 'imperial-and-library/1',
  occupation: 'draft-2026-11-24/1', competence: 'draft-2026-11-24/1', age: 'snapshot/1',
  names: 'traveller-names/2', resources: 'draft-2026-11-24/1', narrative: 'draft-2026-11-24/1',
  equipment: 'core-2016-and-2022-aug2024/1', psionics: 'core-and-library/1',
};
const encoder = new TextEncoder();
const dictionary = encoder.encode([
  {
    schema: 'tedstools.traveller-npc/1', id: 'npc-',
    provenance: { version: '1.0.0', packs: npcPacks, seed: '', index: 1, rerollCounters: {} },
    controls: {
      config: {
        context: 'mixed', species: 'random', culture: 'auto', occupation: 'random', competence: 'random',
        secondary: 'none', age: 'random', lifeform: 'standard', customProfile: null, nameStyle: 'auto',
        specialty: null, secondarySpecialty: null,
        profileOptions: { adultForm: null, wings: 'random', territory: null, ascondiSoc: null, zhodaniHighPsi: false },
        identity: {
          commonName: null, nativeName: null, pronouns: null, sex: null, gender: null, ancestry: null,
          citizenship: null, communication: null, description: null, aliases: [],
        },
        clone: null, conditions: [], augmentations: [], characteristicBoons: [],
        psion: { mode: 'auto', talent: 'random', potential: null, current: null, weights: {} },
        requiredSkills: [], skillGrants: [], requiredCharacteristics: {},
        placement: { current: null, last: null, uncertainty: null, medium: 'unknown', tl: null, law: null, accommodations: [] },
        population: {}, occupationWeights: {}, homeworlds: [], homeworld: null, backgroundWeights: {},
        funds: null, affiliation: null, authority: null, networkTarget: null, partyRelationship: null, gear: [],
      },
      locks: {}, rollLocks: {},
    },
  },
  {
    schema: 'tedstools.traveller-group/1', id: 'group-',
    provenance: {
      version: '1.0.0', packs: { ...npcPacks, group: 'group-encounters/1' }, seed: '', index: 1, npcVersion: '1.0.0',
    },
    controls: { config: { scene: 'any', type: 'random', species: 'random' } },
  },
  {
    version: 1, name: '', species: '', role: '', introduction: '', portrait: '', kind: 'group',
    qualifications: [], availability: '', pay: '',
  },
].map(value => JSON.stringify(value)).join('\n'));

export function encodeLinkPayload(value, limit) {
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > limit) throw new RangeError('The link data is too large.');
  const compressed = deflateSync(bytes, { dictionary });
  let binary = '';
  for (let offset = 0; offset < compressed.length; offset += 4096) {
    binary += String.fromCharCode(...compressed.subarray(offset, offset + 4096));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeLinkPayload(token, limit) {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid link data.');
  const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let json = '';
  const inflate = new Inflate({ dictionary }, (chunk, final) => {
    length += chunk.length;
    if (length > limit) throw new RangeError('The link data is too large.');
    json += decoder.decode(chunk, { stream: !final });
  });
  // Check the expansion limit as chunks arrive, including for links received from other people.
  for (let offset = 0; offset < bytes.length; offset += 4096) {
    const end = offset + 4096;
    inflate.push(bytes.subarray(offset, end), end >= bytes.length);
  }
  return JSON.parse(json);
}
