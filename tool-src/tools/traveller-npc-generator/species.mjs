import { characteristicOrder, core } from './tables.mjs';

const volume1 = 'Aliens of Charted Space Vol. 1 (2020 library edition)';
const volume2 = 'Aliens of Charted Space Vol. 2 (2020 library edition)';
const front = 'The Solomani Front';
const rift = 'The Great Rift, Book 1';
const drInax = 'The Pirates of Drinax, Book 2: The Trojan Reach';
const imperium = 'The Third Imperium';
const castrobancla = 'Castrobancla, The City of Aliens';
const nearSide = 'Deepnight Revelation: The Near Side of Yonder';
const volume3 = 'Aliens of Charted Space Vol. 3';
const trait = (name, text, options = {}) => ({ name, text, ...options });
const senses = trait('Heightened senses', 'DM+1 on Recon and Survival checks.', { skills: { Recon: 1, Survival: 1 } });
const vargrDarkness = trait('Darkness', 'DM−1 on sight-dependent checks in darkness.', { dark: -1 });
const natural = (name, damage) => ({ name, damage, skill: 'Melee (natural)', characteristic: 'STR' });
const common = {
  variant: 'Standard adult', living: true, sophont: true, order: characteristicOrder,
  dice: {}, modifiers: {}, minimums: {}, age: { adult: 18, scale: 1 },
  movement: 'Terrestrial', manipulators: 'Hands', senses: 'Sight, hearing and smell',
  needs: ['breathable'], body: 'Humanlike biped', traits: [], attacks: [], grants: [],
  culture: 'imperial', weight: 0, other: {},
};
const profile = (name, fit, source, details = {}) => ({ ...common, name, fit, source, ...details });
const aslan = {
  modifiers: { STR: 2, DEX: -2 }, body: 'Furred biped with retractable dewclaws',
  traits: [senses], attacks: [natural('Dewclaw', '1D+2')], senses: 'Enhanced hearing and scent',
};
const vargr = {
  modifiers: { STR: -1, DEX: 1, END: -1 }, body: 'Canid biped with a muzzle and tail',
  senses: 'Enhanced hearing and scent, reduced vision in darkness',
  traits: [senses, vargrDarkness], attacks: [natural('Bite', '1D+1')],
};
const ape = {
  body: 'Uplifted ape with a nonstandard equipment fit', modifiers: { STR: 1, END: 1, SOC: -1 },
  senses: 'Enhanced hearing and scent', traits: [senses],
};
const vargrLineage = (name, page, body, details = {}) => profile('Vargr · ' + name, 'vargr',
  volume1 + ', p. ' + page + ' (ancestry); Core Rulebook standard Vargr (characteristics)', {
    ...vargr, variant: name + ' ancestry · standard Vargr characteristic model', ancestry: name, body, ...details,
  });
const unknownAge = { adult: null, scale: null };
const semiaquatic = ['breathable', 'water'];
const water = ['water'];
const cetacean = {
  age: unknownAge, needs: ['water', 'airAccess'], senses: 'Echolocation to 100 m',
  manipulators: 'Requires fitted equipment for fine manipulation',
};
const cetaceanTraits = depth => [
  trait('Cold resistance', 'DM+4 to resist cold.'),
  trait('Deep diver', 'Can dive to ' + depth + ' m and hold its breath for up to 15 minutes.'),
  trait('Distress-call response', 'Use the book’s succour syndrome check when a distress call triggers the response.'),
];
export const species = {
  human: profile('Human', 'human', core + ', pp. 8–9', { weight: 80 }),
  vargr: profile('Standard Vargr', 'vargr', core + ', p. 54 and August 2024 errata', { ...vargr, weight: 12 }),
  aslan: profile('Aslan', 'aslan', core + ', pp. 52–53', { ...aslan, weight: 8 }),
  'aslan-hierate': profile('Aslan · Hierate', 'aslan', volume1 + ', pp. 15–18', {
    ...aslan, variant: 'Hierate upbringing', culture: 'hierate', adultOptions: ['Female', 'Male'],
    age: { adult: 14, scale: 1 }, special: 'hierate',
    traits: [...aslan.traits, trait('Territory', 'Male Aslan track TER separately. Family Territory determines starting SOC. Confirm personal holdings with the referee.')],
  }),
  'vargr-extents': profile('Vargr · Extents', 'vargr', volume1 + ', p. 179', {
    ...vargr, variant: 'Extents upbringing', culture: 'extents', modifiers: { ...vargr.modifiers, STR: -2 },
    order: ['STR', 'DEX', 'END', 'INT', 'EDU', 'CHA'], dice: { CHA: { count: 1, sides: 6, add: 2 } },
    traits: [...vargr.traits, trait('Charisma', 'CHA records standing within a Vargr pack.')],
  }),
  kkree: profile('K’kree', 'kkree', volume1 + ', pp. 124–129', {
    culture: 'herd', adultOptions: ['Patriarch', 'Non-patriarch male', 'Female'], special: 'kkree',
    age: unknownAge, body: 'Large six-limbed, four-legged herbivore',
    movement: 'Quadrupedal', needs: ['breathable', 'room', 'herd', 'herbivore'],
    traits: [
      trait('Big and tough', 'Halve applicable END losses, rounding down. Double END when determining the duration of physical activity.', { halvesEndLoss: true }),
      trait('Claustrophobic', 'Confinement can require END checks. Referee resolves the space and circumstances.'),
      trait('Gregarious', 'Needs company or an explicitly supported substitute.'),
      trait('Patriarchy', 'Use Patriarchy for leadership or diplomacy within K’kree society. Ordinary social skills still apply outside it.'),
    ],
  }),
  droyne: profile('Droyne', 'droyne', volume2 + ', pp. 165–170, 186–193', {
    culture: 'oytrip', adultOptions: ['Worker', 'Warrior', 'Drone', 'Technician', 'Sport', 'Leader'],
    age: { adult: 12, scale: 1 }, order: ['STR', 'DEX', 'END', 'INT', 'EDU'], special: 'droyne',
    dice: { STR: { count: 1, add: 2 }, DEX: { count: 1, add: 2 }, END: { count: 1, add: 2 },
      INT: { count: 1, add: 2 }, EDU: { count: 1, add: 2 } },
    body: 'Small winged body with gripping claws', movement: 'Ground movement and wing-dependent flight',
    attacks: [natural('Claws', '1D+2')], senses: 'Species-specific senses and wing awareness',
    traits: [
      trait('Casted adult', 'Caste shapes the characteristics. PSI is tested at casting.'),
      trait('Claw grip', 'DM+1 to stay anchored when claws can grip.'),
      trait('Close combat aversion', 'DM−2 when fighting unarmed. Impact injuries can cause additional damage.', { unarmed: -2 }),
      trait('Flight', 'Wing size determines whether a Flight familiarity is granted. Check gravity, atmosphere, and clearance in play.'),
    ],
  }),
  hiver: profile('Hiver', 'hiver', volume2 + ', pp. 255–258', {
    culture: 'nest', age: unknownAge, special: 'hiver', forbidden: ['Leadership'],
    order: ['STR', 'DEX', 'END', 'INT', 'EDU', 'RES'], dice: { RES: { count: 1, add: 6 } },
    modifiers: { STR: -2 }, needs: ['breathable', 'hiverDiet'],
    body: 'Low, six-limbed radial body with leathery skin',
    movement: 'Multi-limbed ground movement', manipulators: 'Multiple grasping limbs',
    senses: 'May have a limited sense of smell',
    traits: [
      trait('Hiver physiology', 'Natural Protection 2 and DM+2 to resist disease or chemical toxins. May become dormant after severe injury.', { protection: 2 }),
      trait('Physical cowardice', 'Nearby physical aggression can require an immediate RES check.'),
      trait('Stability', 'The body can brace against difficult footing when its limbs have purchase.'),
      trait('Leadership restriction', 'Hivers may use other influence skills. Leadership is unavailable.'),
    ],
  }),
  sylean: profile('Sylean human', 'human', imperium + ', p. 171', {
    variant: 'Sylean ancestry', modifiers: { STR: -1, EDU: 1 }, ancestry: 'Sylean',
  }),
  selenite: profile('Selenite human', 'selenite', front + ', p. 6', {
    variant: 'Low-gravity human adaptation', ancestry: 'Selenite',
    dice: { STR: { count: 2, sides: 3, add: 1 }, END: { count: 1, add: 1 } },
    modifiers: { DEX: 2 }, body: 'Slender low-gravity humanoid',
    traits: [
      trait('Low-G', 'DM+2 to physical activity checks in low or microgravity. Maintains spatial orientation in complex three-dimensional spaces.', { lowGravity: 2 }),
      trait('Great indoors', 'Evidence of uncontrolled outdoor conditions can require a Routine (6+) INT check.'),
    ],
  }),
  aquamorph: profile('Aquamorph human', 'aquamorph', front + ', pp. 7–8', {
    variant: 'Amphibious human adaptation', ancestry: 'Aquamorph', needs: [...semiaquatic, 'humid'],
    body: 'Amphibious humanoid needing regular hydration',
    movement: 'Land and water', senses: 'Hearing adapted to water', special: 'aquamorph',
    traits: [
      trait('Aquatic adaptation', 'DM+2 to swimming checks. Can breathe underwater and dive safely to about 30 m.', { swimming: 2 }),
      trait('Underwater hearing', 'Recon gains DM+2 underwater or DM−2 on land.', { waterRecon: 2 }),
      trait('Land operation', 'Treat STR as half when operating out of water. Record its full uninjured value independently.'),
    ],
  }),
  ape: profile('Uplifted ape', 'ape', front + ', p. 10', {
    ...ape, body: 'Uplifted primate with a nonstandard equipment fit',
  }),
  gurungan: profile('Gurungan', 'gurungan', front + ', pp. 11–12', {
    culture: 'gurungan', adultOptions: ['Female sophont'], body: 'Aquatic, pressure-supported six-tentacled body',
    movement: '8 m in water; 2 m out of water', manipulators: 'Tentacles', senses: 'Sonar 120 m and chemical sensing',
    needs: water, modifiers: { DEX: 2 }, age: unknownAge, attacks: [natural('Bite', '1D')],
    traits: [
      trait('Aquatic', 'Breathes underwater. Dehydration or time out of water requires the source’s escalating END checks.'),
      trait('Deep diver', 'Able to dive to 1,000 m.'),
      trait('Sonar', '120 m in water or darkness when the medium supports it.'),
    ],
  }),
  ladybug: profile('Ladybug', 'ladybug', front + ', p. 14', {
    age: unknownAge, body: 'Slender blue-violet humanoid with faceted eyes and feathery ears',
    dice: { STR: { count: 1, add: 2 }, DEX: { count: 2, add: 3 }, END: { count: 1, add: 2 },
      INT: { count: 2, sides: 3 }, EDU: { count: 2, sides: 3 }, SOC: { count: 1, add: 2 } },
    traits: [trait('Gentle soul', 'DM+2 to obtain assistance. See the source for attacker hesitation.', { assistance: 2 })],
  }),
  vegan: profile('Vegan', 'vegan', front + ', pp. 69–73', {
    culture: 'vegan', age: { adult: 50, scale: 4 }, adultOptions: ['Searching for a tuhuir', 'Established tuhuir'],
    modifiers: { EDU: 2, SOC: -2 }, special: 'vegan', body: 'Broad-footed low-gravity humanoid',
    senses: 'Vision extends into infrared', traits: [
      trait('Eye membrane', 'Protects against dust and grit. Vision functions like infrared goggles.'),
      trait('Heat tolerance', 'Can ignore a number of points of heat damage equal to END per hour.'),
      trait('Tuhuir', 'The settled adult’s committed field or vocation shapes status and work.'),
    ],
  }),
  bwap: profile('Bwap', 'bwap', 'Traveller Companion (MGP2007-G), p. 12', {
    age: unknownAge, body: 'Small, moisture-dependent biped', needs: ['breathable', 'humid'],
    modifiers: { STR: -4, END: -4 },
    traits: [trait('Structured mind', 'Boon on Admin and Science checks. Bane when testing PSI potential.', { boonSkills: ['Admin', 'Science'] })],
  }),
  ssienjhiovla: profile('Ssienjhiovla', 'ssienjhiovla', imperium + ', p. 238', {
    age: unknownAge, culture: 'ssienjhiovla', body: 'Shelled molluscoid with four arms and two adhesive feet',
    manipulators: 'Four six-fingered hands', senses: 'Acute sight and smell; weak hearing',
    needs: ['breathable', 'humid'], modifiers: { STR: -2, DEX: 1 },
    traits: [
      trait('Carapace', 'Natural Protection 6.', { protection: 6 }),
      trait('Composite imaging', 'On appropriate Atmosphere 3–7 worlds, scents can reveal events within 1 km in the same unsealed environment.'),
      trait('Pheromonal communication', 'Complex signaling up to 5 km with suitable conditions. Gesture and fitted voice interfaces support close communication.'),
    ],
  }),
  yont: profile('Yont', 'yont', drInax + ', p. 197', {
    age: unknownAge, culture: 'yont', body: 'Yont; verify workwear fit to individual anatomy',
    modifiers: { END: 2, INT: -2, EDU: -2 },
    traits: [trait('Natural armour', 'Natural Protection 1.', { protection: 1 })],
  }),
  ascondi: profile('Ascondi', 'ascondi', rift + ', pp. 12–14', {
    culture: 'ascondi', age: { adult: 20, scale: 1, maximum: 79 }, body: 'Small, scaly humanoid',
    modifiers: { END: 1 }, adultOptions: ['Hunter', 'Finder', 'Hearthkeeper'], special: 'ascondi',
    traits: [trait('Natural armour', 'Natural Protection 1.', { protection: 1 }),
      trait('Casted adult phase', 'Caste changes physiology and status. Enter the adult’s current SOC as a campaign fact when known.')],
  }),
  'empire-human': profile('Human · Glorious Empire adaptation', 'human', 'The Glorious Empire, pp. 55–57', {
    variant: 'Glorious Empire modified human', culture: 'empire', modifiers: { END: 1, EDU: -2 },
    traits: [trait('Glorious Empire status', 'A legal position in the Empire determines SOC. Choose the current status explicitly.')],
    adultOptions: ['Enslaved', 'Freed · SOC 1', 'Freed · SOC 2'], special: 'empire',
  }),
  feskal: profile('Floriani · Feskal', 'feskal', drInax + ', p. 122', {
    variant: 'Feskal human adaptation', culture: 'florian', ancestry: 'Floriani',
    modifiers: { STR: 2, END: 2, INT: -2, EDU: -2, SOC: -2 }, body: 'Large human biped',
  }),
  barnai: profile('Floriani · Barnai', 'barnai', drInax + ', p. 122', {
    variant: 'Barnai human adaptation', culture: 'florian', ancestry: 'Floriani', special: 'barnai',
    modifiers: { INT: 2, EDU: 2, STR: -2, END: -2 }, body: 'Light human frame with a larger head',
    traits: [trait('Florian companions', 'In a Florian setting, expect Feskal attendants based on SOC. Confirm actual access at the encounter.')],
  }),
  whistler: profile('Oo-ne-beto-pon-tee (Whistler)', 'whistler', imperium + ', pp. 202–204', {
    culture: 'whistler', special: 'whistler', age: unknownAge,
    adultOptions: ['Independent neuter', 'Matcher', 'Male', 'Female'],
    body: 'Small climber with adhesive, clawed feet', movement: 'Climbs many surfaces',
    senses: 'Hearing from roughly 20 Hz to 60 kHz',
    dice: { STR: { count: 1, sides: 3 }, DEX: { count: 1, add: 4 }, END: { count: 1, sides: 3 },
      INT: { add: -1 }, SOC: { count: 1, sides: 3 } },
    grants: [{ skill: 'Stealth', level: 2 }],
    traits: [
      trait('Sticky feet', 'Can grip and climb most surfaces without additional training.'),
      trait('High-frequency hearing and communication', 'Can hear and use signaling beyond the ordinary human range.'),
      trait('Group dependence', 'Most forms need a stable community of their own kind. Independent neuters can serve apart from a group.'),
    ],
  }),
  bandaluk: profile('Bandaluk', 'bandaluk', castrobancla + ', PDF pp. 55–58', {
    setting: 'castrobancla', culture: 'castrobancla', age: unknownAge, body: 'Strong-armed furred biped with splayed feet',
    movement: 'Ground speed 10', senses: 'Acute hearing',
    modifiers: { STR: 1, END: 2, INT: 1, EDU: -1, SOC: -2 },
    traits: [trait('Acute hearing', 'DM+2 on Recon and Survival using hearing.', { hearing: { Recon: 2, Survival: 2 } }),
      trait('Fast metabolism', 'Use the setting’s Fast Metabolism (+2) trait.')],
  }),
  dvora: profile('Dvora', 'dvora', castrobancla + ', PDF p. 59', {
    setting: 'castrobancla', culture: 'castrobancla', age: unknownAge, special: 'dvora',
    body: 'Squat biped with strong jaws and clawed hands', modifiers: { STR: 2, DEX: 1, SOC: -2 },
    senses: 'Acute sight and scent tuned to decay',
    attacks: [{ ...natural('Venomous bite', '1D+3'), traits: 'See the source for the fictional paralysing venom effect.' }],
    traits: [
      trait('Sense decay', 'DM+2 on Recon and Investigate concerning death or decay.', { decay: { Recon: 2, Investigate: 2 } }),
      trait('Unconscious Clairvoyance', 'Innate and instinctive in this setting. Use the source to adjudicate manifestations.'),
    ],
  }),
  kubotaur: profile('Kubotaur', 'kubotaur', castrobancla + ', PDF p. 60', {
    setting: 'castrobancla', culture: 'castrobancla', age: unknownAge, body: 'Tough-skinned hunter with scent barbels',
    modifiers: { STR: 2, INT: 1 }, attacks: [natural('Claws or teeth', '1D+1')],
    traits: [trait('Hide', 'Natural Protection 1.', { protection: 1 }), trait('Fast metabolism', 'See the source for the fast-metabolism trait.'),
      trait('Acute scent', 'DM+2 on Recon and Investigate using scent.', { scent: { Recon: 2, Investigate: 2 } })],
  }),
  pelacur: profile('Pelacur', 'pelacur', castrobancla + ', PDF pp. 61–62', {
    setting: 'castrobancla', culture: 'castrobancla', age: unknownAge, body: 'Slender biped with long fingers',
    modifiers: { DEX: 2, SOC: 1 }, senses: 'Acute sense of smell',
    traits: [
      trait('Pheromonal lure', 'Can modify some social checks and Stealth against susceptible targets. The effect is stronger on humans.',
        { lure: { Carouse: 1, Deception: 1, Diplomat: 1, Persuade: 1, Steward: 1, Stealth: -1 } }),
      trait('Acute scent', 'DM+3 on Recon and Investigate using scent.', { scent: { Recon: 3, Investigate: 3 } }),
    ],
  }),
  settler: profile('Amarjan Settler', 'settler', castrobancla + ', PDF p. 63', {
    setting: 'castrobancla', culture: 'castrobancla', age: unknownAge, body: 'Tall biped with an enclosed stillsuit',
    modifiers: { STR: 2, DEX: 2, END: 4 }, needs: ['breathable', 'amarja', 'humid'],
    traits: [
      trait('Amarja-dependent', 'Confirm the encounter is on Amarja and the required stillsuit or home environment is available.'),
      trait('Sense', 'See the setting’s INT-based sense ability on Amarja. It uses no PSI points.'),
    ],
  }),
  'aslan-empire': profile('Aslan · Glorious Empire', 'aslan', 'The Glorious Empire, pp. 55–56; ' + volume1 + ', pp. 15–18', {
    ...aslan, variant: 'Tokouea’we clan', culture: 'empire', adultOptions: ['Female', 'Male'],
    age: { adult: 14, scale: 1 }, special: 'hierate',
    traits: [...aslan.traits, trait('Territory', 'Male Aslan track TER separately. Confirm personal holdings with the referee.')],
  }),
  'ape-chimpanzee': profile('Uplifted ape · chimpanzee-like', 'ape', front + ', pp. 9–10', {
    ...ape, variant: 'Chimpanzee-like adult', body: 'Chimpanzee-like uplifted ape',
  }),
  urzaeng: vargrLineage('Urzaeng', 171, 'Large, powerfully built canid biped'),
  kokasha: vargrLineage('Kokasha', 172, 'Small, lightly built canid biped'),
  akumgeda: vargrLineage('Akumgeda', 172, 'Canid biped with a spotted coat'),
  nakagun: vargrLineage('Nakagun', 172, 'Compact canid biped'),
  'roth-thokken': vargrLineage('Roth Thokken', 172, 'Compact canid biped with congenital blindness', {
    senses: 'Congenital blindness; strong hearing and scent',
    traits: [senses, trait('Blind from birth', 'Use hearing, scent or an appropriate accommodation to resolve tasks that would ordinarily use sight.')],
  }),
  cheval: profile('Cheval (human host)', 'human', castrobancla + ', PDF pp. 64–65', {
    setting: 'castrobancla', culture: 'castrobancla', variant: 'Human joined to a single active symbiont',
    body: 'Human host carrying a sophont symbiont', senses: 'Human senses and the Host’s life detection',
    modifiers: Object.fromEntries(characteristicOrder.map(stat => [stat, 1])),
    traits: [
      trait('Life detection', 'The joined host can detect life at Long range. Use the source to resolve individual situations.'),
      trait('Symbiosis', 'Uses the adjustment for one active symbiont. Note healing, earlier symbioses and biological age as campaign facts.'),
    ],
  }),
  darrian: profile('Darrian', 'human', 'Behind the Claw, Darrian Travellers; ' + volume3 + ', pp. 4–5 (anatomy)', {
    culture: 'darrian', ancestry: 'Darrian', body: 'Tall, light-framed human with slightly tapered ears',
    modifiers: { STR: -1, DEX: 1, END: -1, INT: 1, EDU: 1 },
    senses: 'Enhanced hearing and sight',
    grants: [{ skill: 'Science', level: 0 }],
    traits: [
      trait('Heightened senses', 'DM+1 on Recon and Survival checks that use hearing or sight.', { hearing: { Recon: 1, Survival: 1 } }),
      trait('Ozone immunity', 'Unaffected by environmental ozone poisoning.'),
      trait('Temperature resistance', 'Reduce damage from environmental temperature extremes by 1.'),
    ],
  }),
  dolphin: profile('Uplifted dolphin', 'dolphin', volume3 + ', pp. 155–168', {
    ...cetacean, modifiers: { STR: 4, END: 2, SOC: -4 },
    body: 'Air-breathing aquatic cetacean', movement: '12 m in water',
    traits: cetaceanTraits(300),
  }),
  orca: profile('Uplifted orca', 'orca', volume3 + ', pp. 196, 218–219', {
    ...cetacean, needs: [...cetacean.needs, 'room'], modifiers: { STR: 8, END: 4, SOC: -4 },
    body: 'Large, air-breathing aquatic cetacean', movement: '16 m in water',
    traits: [
      ...cetaceanTraits(260),
      trait('Big and tough', 'Halve applicable END losses, rounding down. Double END for activity duration. The orca needs a much larger fitted space.', { halvesEndLoss: true }),
    ],
  }),
  ithklur: profile('Ithklur', 'ithklur', 'Journal of the Travellers’ Aid Society Vol. 7, pp. 37–40; ' + volume2 + ', p. 219 (anatomy)', {
    culture: 'ithklur', modifiers: { STR: 1, END: 1 },
    body: 'Heavy, lightly scaled biped with a thick balancing tail and prominent claws',
    senses: 'Sharp scent and a pair of infrared sense organs',
    order: ['STR', 'DEX', 'END', 'INT', 'EDU', 'RES'], dice: { EDU: { count: 1, add: 1 }, RES: { count: 1, add: 1 } },
    attacks: [natural('Claws', '1D+2'), { ...natural('Tail strike', '2D'), attackDM: -2 }],
    grants: [{ skill: 'Melee', level: 0 }, { skill: 'Survival', level: 0 }],
    traits: [
      senses,
      trait('Large', 'Targeting the Ithklur with ranged attacks gains DM+1.'),
      trait('Superior balance', 'DM+1 on applicable DEX checks. Attempts to grapple the Ithklur take DM−1.'),
    ],
  }),
  tenipal: profile('Tenipal', 'tenipal', nearSide + ', pp. 11–14', {
    age: unknownAge, culture: 'tenipal', modifiers: { STR: 2, END: 2, INT: -2, EDU: -3 },
    body: 'Powerfully built biped with tawny fur and a second, clawed thumb',
    manipulators: 'Six digits per hand, including a clawed second thumb',
    attacks: [natural('Thumb claw', '1D+2')],
    traits: [
      trait('Climbing claws', 'Uncovered claws give DM+2 to grip or climb suitable surfaces.'),
      trait('Unfamiliar concepts', 'DM−2 when a check requires a wholly new idea or an imaginative leap.'),
    ],
  }),
  hiidamo: profile('Hiidamo human', 'human', imperium + ', pp. 217–218 (anatomy); Core Rulebook (human characteristics)', {
    culture: 'hiidamo', ancestry: 'Hiidamo', variant: 'Hiilev ancestry · standard Human characteristics',
    body: 'Dark, leathery skin and enlarged lungs',
    traits: [
      trait('Hiilev adaptation', 'Can breathe Hiilev’s very thin, sulphurous atmosphere. Check local air conditions before applying this elsewhere.'),
    ],
  }),
  kifnell: profile('Kifnell human', 'human', 'The Great Rift, Book 3: Touchstone and Afawahisa, p. 68; Core Rulebook (human characteristics)', {
    culture: 'kifnell', ancestry: 'Kifnell', variant: 'Transplanted Humaniti · standard Human characteristics',
  }),
  'droyne-uncast': profile('Uncast adult Droyne', 'droyne', volume2 + ', pp. 138, 148–150, 191', {
    culture: 'oytrip', variant: 'Adult without an Iskyar casting', age: unknownAge,
    order: characteristicOrder.slice(0, 5), special: 'droyne', uncast: true,
    dice: Object.fromEntries(characteristicOrder.slice(0, 5).map(stat => [stat, { count: 1, add: 1 }])),
    body: 'Small winged, reptile-and-bird-like body', movement: 'Ground movement and wing-dependent flight',
    manipulators: 'Four-digit hands', senses: 'Wide field of view from compound eyes',
    traits: [
      trait('Uncast characteristics', 'Uses the book’s pre-casting dice and unmodified PSI as a snapshot of an uncast adult.'),
      trait('Flight', 'Wing size determines Flight familiarity. Check gravity, atmosphere and clearance in play.'),
    ],
  }),
};
export const cultures = {
  imperial: { name: 'Imperial cosmopolitan', communication: 'Galanglic speech or a compatible interface' },
  solomani: { name: 'Solomani', communication: 'Solomani or Galanglic by upbringing', fits: ['human', 'selenite', 'aquamorph', 'ape'] },
  vilani: { name: 'Vilani', communication: 'Vilani or Galanglic by upbringing', fits: ['human'] },
  'sword-worlds': { name: 'Sword Worlds', communication: 'Sword Worlds languages or a trade language', fits: ['human'],
    source: 'Sword Worlds, pp. 99–101' },
  zhodani: { name: 'Zhodani Consulate', communication: 'Zdetl speech or a compatible interface', fits: ['human'], source: volume1 + ', pp. 253–254' },
  darrian: { name: 'Darrian Confederation', communication: 'Darrian or Galanglic by upbringing', fits: ['human'], source: volume3 + ', pp. 4–5' },
  hierate: { name: 'Aslan Hierate', communication: 'Trokh', profiles: ['aslan-hierate'] },
  extents: { name: 'Vargr Extents', communication: 'Vargr language or trade dialect', profiles: ['vargr-extents'] },
  herd: { name: 'K’kree herd society', communication: 'K’kree speech and herd signaling', fits: ['kkree'] },
  oytrip: { name: 'Droyne oytrip', communication: 'Oynprith', fits: ['droyne'] },
  nest: { name: 'Hive Federation', communication: 'Hiver tactile signs; voder for mixed-species speech', fits: ['hiver'] },
  ithklur: { name: 'Hive Federation · Ithklur', communication: 'Ithklur speech or a Federation trade language', fits: ['ithklur'] },
  tenipal: { name: 'Tenipal community', communication: 'Local Tenipal speech or interpretation', fits: ['tenipal'], source: nearSide },
  hiidamo: { name: 'Hiilev · Hiidamo', communication: 'Local language or a trade language', profiles: ['hiidamo'], source: imperium + ', pp. 217–218' },
  kifnell: { name: 'Kifnell', communication: 'Local language or interpretation', profiles: ['kifnell'], source: 'The Great Rift, Book 3, p. 68' },
  gurungan: { name: 'Gurungan enclave', communication: 'Aquatic signaling; a fitted speech or sign interface with outsiders', fits: ['gurungan'] },
  vegan: { name: 'Vegan Autonomous District', communication: 'Vegan language', fits: ['vegan'] },
  ssienjhiovla: { name: 'Ssienjhiovla community', communication: 'Pheromones, gesture and voice interface', fits: ['ssienjhiovla'] },
  yont: { name: 'Yont community', communication: 'Local language; specify when relevant', fits: ['yont'] },
  ascondi: { name: 'Ascondi community', communication: 'Ascondi speech', fits: ['ascondi'] },
  empire: { name: 'Glorious Empire', communication: 'Galanglic or Trokh by upbringing', fits: ['human', 'aslan'] },
  florian: { name: 'Florian League', communication: 'Florian language or Galanglic by upbringing', profiles: ['feskal', 'barnai'] },
  whistler: { name: 'Whistler community', communication: 'High-frequency signaling and an adapted interface', fits: ['whistler'] },
  castrobancla: { name: 'Castrobancla', communication: 'Local language and a trade interface where needed',
    profiles: ['bandaluk', 'dvora', 'kubotaur', 'pelacur', 'settler', 'cheval'] },
};
export const needs = {
  breathable: 'Breathable atmosphere or fitted life support',
  water: 'Suitable water habitat or aquatic accommodation',
  humid: 'Suitable moisture or a fitted hydration system',
  airAccess: 'Breathable surface access or fitted breathing support',
  room: 'Clearance and a space the individual can tolerate',
  herd: 'Company or a supported substitute for the herd',
  herbivore: 'Suitable plant-based food',
  hiverDiet: 'Complete Hiver diet',
  whistlerGroup: 'Stable company of other Whistlers',
  amarja: 'A location on Amarja',
};

export function compatibleCulture(profileId, cultureId, subject = species[profileId]) {
  if (cultureId === 'auto') return true;
  const culture = cultures[cultureId];
  return (!culture.profiles || culture.profiles.includes(profileId))
    && (!culture.fits || culture.fits.includes(subject.fit))
    && (!['aslan-hierate', 'aslan-empire', 'vargr-extents'].includes(profileId) || cultureId === subject.culture);
}
