import { requireRule } from './config.mjs';
import { groupSchema, isGroupEncounter } from './group-encounters.mjs';
import { schema as npcSchema } from './tables.mjs';

export const refereeLinkPrefix = '#record=';
const maxLinkLength = 2_000_000;

export function recordInputs(record) {
  const { schema, id, provenance, controls } = record;
  const { version, packs, seed, index, rerollCounters, npcVersion } = provenance;
  const { config, locks, rollLocks } = controls;
  return {
    schema, id, provenance: { version, packs, seed, index, rerollCounters, npcVersion },
    controls: { config, locks, rollLocks },
  };
}

export function refereeLink(location, record) {
  const { id, provenance, controls } = recordInputs(record);
  const { seed, index, version, npcVersion, packs, rerollCounters } = provenance;
  const variables = new URLSearchParams({
    record: isGroupEncounter(record) ? 'group' : 'npc',
    seed, index: String(index), id, version, settings: JSON.stringify(controls.config), packs: JSON.stringify(packs),
  });
  if (npcVersion) variables.set('npcVersion', npcVersion);
  for (const [key, value] of Object.entries({ rerollCounters, locks: controls.locks, rollLocks: controls.rollLocks })) {
    // Empty roll locks differ from absent roll locks when a lock was added after the roll.
    if (value !== undefined) variables.set(key, JSON.stringify(value));
  }
  const url = new URL(location);
  url.search = '';
  url.hash = variables.toString();
  requireRule(url.hash.length <= maxLinkLength, 'This record is too large for a bookmark. Export the referee JSON to keep it.');
  return url.href;
}

export function readRefereeLink(hash) {
  requireRule(hash.startsWith(refereeLinkPrefix) && hash.length <= maxLinkLength, 'The referee link is incomplete or too large.');
  const variables = new URLSearchParams(hash.slice(1));
  const kind = variables.get('record');
  requireRule(kind === 'npc' || kind === 'group', 'The referee link has an unknown record type.');
  function readJson(key, fallback) {
    if (!variables.has(key)) return fallback;
    try { return JSON.parse(variables.get(key)); }
    catch { throw new Error('The referee link has invalid ' + key + '.'); }
  }
  return {
    schema: kind === 'group' ? groupSchema : npcSchema,
    id: variables.get('id'),
    provenance: {
      seed: variables.get('seed'), index: Number(variables.get('index')), version: variables.get('version'),
      packs: readJson('packs'), npcVersion: variables.get('npcVersion'), rerollCounters: readJson('rerollCounters'),
    },
    controls: {
      config: readJson('settings'), locks: readJson('locks', {}), rollLocks: readJson('rollLocks'),
    },
  };
}
