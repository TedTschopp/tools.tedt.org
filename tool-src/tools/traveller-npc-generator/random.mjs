import { packs, version } from './tables.mjs';

const encoder = new TextEncoder();
const wordCount = 1n << 32n;

export const sum = values => values.reduce((total, value) => total + value, 0);
export const totalWeight = entries => entries.reduce((total, entry) => total + BigInt(entry.weight), 0n);

export function lcm(left, right) {
  let a = left;
  let b = right;
  while (b) [a, b] = [b, a % b];
  return left / a * right;
}

export function freshSeed() {
  return [...crypto.getRandomValues(new Uint8Array(10))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hash(parts) {
  return new DataView(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(parts))));
}

export async function stableId(seed, index) {
  const bytes = await hash([version, seed, index, 'npc-id']);
  return 'npc-' + [0, 4, 8].map(offset => bytes.getUint32(offset).toString(16).padStart(8, '0')).join('');
}

export function streams(seed, index, counters, record, tablePacks = packs) {
  const cursors = new Map();
  return function stream(key, pack) {
    const tableVersion = tablePacks[pack];
    const reroll = counters[key] ?? 0;
    async function uniform(bound, position) {
      const limit = BigInt(bound);
      if (limit < 1n) throw new RangeError('A random pool must contain at least one outcome.');
      let words = 1;
      let range = wordCount;
      while (range < limit) {
        words++;
        range *= wordCount;
      }
      let rejection = 0;
      const draw = position ?? cursors.get(key) ?? 0;
      cursors.set(key, draw + 1);
      const ceiling = range - range % limit;
      for (;;) {
        let value = 0n;
        for (let word = 0; word < words; word++) {
          const parts = [version, seed, index, key, tableVersion, reroll, draw, rejection];
          if (word) parts.push(word);
          const digest = await hash(parts);
          value = value * wordCount + BigInt(digest.getUint32(0));
        }
        if (value < ceiling) return { value: value % limit + 1n, draw, rejection };
        rejection++;
      }
    }
    function log(outcome) {
      record.push({ field: key, tableVersion, reroll, ...outcome });
    }
    async function draw(bound, label, position) {
      const { value, draw, rejection } = await uniform(bound, position);
      const rolled = Number(value);
      log({ label, dice: 'd' + bound, result: rolled, draw, rejection });
      return rolled;
    }
    return {
      draw,
      log,
      async dice(count, label, sides = 6) {
        const dice = [];
        for (let i = 0; i < count; i++) dice.push(await draw(sides, label + ' · die ' + (i + 1)));
        return { dice, total: sum(dice) };
      },
      async pick(entries, label) {
        if (entries.length === 1) {
          log({ label, result: entries[0].label, method: 'only eligible result' });
          return entries[0].value;
        }
        const total = totalWeight(entries);
        const { value, draw, rejection } = await uniform(total);
        let remaining = value;
        for (const entry of entries) {
          remaining -= BigInt(entry.weight);
          if (remaining <= 0n) {
            log({ label, result: entry.label, method: 'weighted draw', ticket: String(value),
              eligibleWeight: String(total), draw, rejection });
            return entry.value;
          }
        }
        throw new Error('The selected weighted result is outside the pool.');
      },
    };
  };
}

export const faces = [1, 2, 3, 4, 5, 6];
export function diceOutcomes(count, sides = 6) {
  const values = faces.slice(0, sides);
  return Array.from({ length: count }, () => values).reduce(
    (paths, die) => paths.flatMap(path => die.map(face => [...path, face])), [[]],
  );
}

export async function pickDice(rng, options, count, label, sides = 6) {
  if (options.length === sides ** count && options.every(option => option.weight === options[0].weight)) {
    return (await rng.dice(count, label, sides)).dice;
  }
  let remaining = options;
  const result = [];
  for (let index = 0; index < count; index++) {
    const entries = faces.slice(0, sides).flatMap(face => {
      const paths = remaining.filter(option => option.dice[index] === face);
      return paths.length ? [{ value: face, weight: totalWeight(paths), label: face }] : [];
    });
    const face = await rng.pick(entries, label + ' · eligible die ' + (index + 1));
    result.push(face);
    remaining = remaining.filter(option => option.dice[index] === face);
  }
  rng.log({ label, result, method: 'conditioned dice' });
  return result;
}
