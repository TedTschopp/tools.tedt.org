import { isGroupEncounter } from './group-encounters.mjs';
import { stableId } from './random.mjs';
import { recordInputs } from './record-links.mjs';

const prefix = 'tedt-traveller-roster-v1:';

export async function keepInRoster(storage, record) {
  const { name, species, role } = record.player;
  const summary = isGroupEncounter(record) ? { name: record.type, role, lead: record.members[0].npc.player.name } : { name, species, role };
  // The restore functions rebuild dossiers and roll logs from these inputs.
  const snapshot = JSON.stringify({ ...recordInputs(record), player: summary });
  // Different saved builds can share an NPC ID when they use the same seed and index.
  const key = prefix + await stableId(snapshot, record.provenance.index);
  storage.setItem(key, snapshot);
}

export function readRoster(storage) {
  const entries = [];
  let unreadable = 0;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const record = JSON.parse(storage.getItem(key));
      if (!record || !['name', 'role', isGroupEncounter(record) ? 'lead' : 'species']
        .every(field => typeof record.player?.[field] === 'string')) {
        unreadable++;
        continue;
      }
      entries.push({ key, record });
    } catch {
      unreadable++;
    }
  }
  entries.sort((a, b) => a.record.player.name.localeCompare(b.record.player.name)
    || a.record.player.role.localeCompare(b.record.player.role));
  return { entries, unreadable };
}

export function removeFromRoster(storage, key) {
  if (key.startsWith(prefix)) storage.removeItem(key);
}
