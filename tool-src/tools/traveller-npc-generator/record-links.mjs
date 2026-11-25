import { requireRule } from './config.mjs';
import { groupSchema } from './group-encounters.mjs';
import { decodeLinkPayload, encodeLinkPayload } from './link-payload.mjs';
import { schema as npcSchema } from './tables.mjs';

const legacyRefereeLinkPrefix = '#record=';
const refereeLinkPrefix = '#r1=';
const maxLinkLength = 2_000_000;

export const isRefereeLink = hash => hash.startsWith(refereeLinkPrefix) || hash.startsWith(legacyRefereeLinkPrefix);

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
  const url = new URL(location);
  url.search = '';
  try {
    url.hash = refereeLinkPrefix + encodeLinkPayload(recordInputs(record), maxLinkLength);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new Error('This record is too large for a bookmark. Export the referee JSON to keep it.');
  }
  requireRule(url.hash.length <= maxLinkLength, 'This record is too large for a bookmark. Export the referee JSON to keep it.');
  return url.href;
}

export function readRefereeLink(hash) {
  requireRule(isRefereeLink(hash) && hash.length <= maxLinkLength, 'The referee link is incomplete or too large.');
  if (hash.startsWith(refereeLinkPrefix)) {
    try { return decodeLinkPayload(hash.slice(refereeLinkPrefix.length), maxLinkLength); }
    catch { throw new Error('The referee link is incomplete or invalid.'); }
  }
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
