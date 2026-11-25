import { isGroupEncounter } from './group-encounters.mjs';
import { rating } from './mechanics.mjs';
import { portraitFor } from './species-art.mjs';

export const handoutPrefix = '#handout=';

export function portraitId(record) {
  const npc = isGroupEncounter(record) ? record.members[0].npc : record;
  return npc.biology.profileId === 'custom' ? npc.controls.config.customProfile?.appearance : npc.biology.profileId;
}

export function qualificationsFor(npc) {
  const { work } = npc;
  if (!work) return [];
  if (work.qualifications.length) return work.qualifications.map(({ skill, actual }) => [skill, actual]);
  const slots = work.secondary ? [...work.occupation.slots.slice(0, -1), work.secondary.slots[0]] : work.occupation.slots;
  return slots.map(skill => [skill, rating(npc.mechanics.skills, skill)]).filter(([, level]) => level !== null);
}

export function handoutUrl(location, record, { qualifications, availability, pay } = {}) {
  const { name, species, role, introduction } = record.player;
  const portrait = portraitId(record);
  const handout = { version: 1, name, species, role, introduction };
  if (portraitFor(portrait)) handout.portrait = portrait;
  if (isGroupEncounter(record)) handout.kind = 'group';
  else {
    if (qualifications) handout.qualifications = qualificationsFor(record);
    if (availability && record.work) handout.availability = record.work.employment.status;
    if (pay) handout.pay = pay;
  }
  const url = new URL(location);
  url.search = '';
  url.hash = handoutPrefix + encodeURIComponent(JSON.stringify(handout));
  return url.href;
}

export function readHandout(hash) {
  try {
    if (!hash.startsWith(handoutPrefix) || hash.length > 150_000) return null;
    const { version, kind, name, species, role, introduction, portrait, qualifications, availability, pay } =
      JSON.parse(decodeURIComponent(hash.slice(handoutPrefix.length)));
    const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
    if (version !== 1 || !text(name, 500) || !text(role, 500) || !text(introduction, 3000)) return null;
    if (kind === 'group' ? species !== undefined : kind !== undefined || !text(species, 500)) return null;
    if (qualifications !== undefined && (!Array.isArray(qualifications) || qualifications.length > 80
      || !qualifications.every(entry => Array.isArray(entry) && entry.length === 2 && text(entry[0], 120)
        && Number.isInteger(entry[1]) && entry[1] >= -99 && entry[1] <= 999))) return null;
    if ((availability !== undefined && !text(availability, 500)) || (pay !== undefined && !text(pay, 140))) return null;
    return { name, species, role, introduction, qualifications, availability, pay,
      portrait: typeof portrait === 'string' && portraitFor(portrait) ? portrait : null };
  } catch {
    return null;
  }
}
