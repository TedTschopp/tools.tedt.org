export const version = '1.0.0';
export const schema = 'tedstools.traveller-npc/1';
export const ruleProfile = 'Mongoose Traveller 2E · adult NPC snapshot';
export const legacyNamePack = 'imperial-common/1';
export const packs = Object.freeze({
  characteristics: 'core-2022-aug2024/1', species: 'core-and-library/1', culture: 'imperial-and-library/1',
  occupation: 'draft-2026-11-24/1', competence: 'draft-2026-11-24/1', age: 'snapshot/1',
  names: 'traveller-names/2', resources: 'draft-2026-11-24/1', narrative: 'draft-2026-11-24/1',
  equipment: 'core-2016-and-2022-aug2024/1', psionics: 'core-and-library/1',
});
export const core = 'Traveller Core Rulebook Update 2022';
export const coreUrl = 'https://www.mongoosepublishing.com/products/traveller-core-rulebook-update-2022';
export const errataUrl = 'https://cdn.shopify.com/s/files/1/0609/6139/0839/files/Traveller_Core_Rulebook_Update_2022_FAQ_Aug24.pdf?v=1724164236';
export const characteristicOrder = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];
export const contexts = {
  mixed: { name: 'Mixed adventure encounter' },
  hiring: { name: 'Professional hiring', hiring: true },
  crew: { name: 'Crew hiring', hiring: true },
  patron: { name: 'Party patron', patron: true },
};
export function attitudeFor(score) {
  return score === 2 ? 'Hostile' : score <= 5 ? 'Guarded' : score <= 8 ? 'Neutral'
    : score <= 11 ? 'Welcoming' : 'Actively helpful';
}
export const tiers = [
  { id: 'green', name: 'Green', high: 4, ratings: [0, 0, 0, 0], ageDice: 1, ageOffset: -1 },
  { id: 'competent', name: 'Competent', high: 9, ratings: [1, 1, 1, 0], ageDice: 3, ageOffset: 0 },
  { id: 'experienced', name: 'Experienced', high: 11, ratings: [2, 1, 1, 1], ageDice: 3, ageOffset: 8 },
  { id: 'elite', name: 'Elite', high: 12, ratings: [3, 2, 2, 1], ageDice: 4, ageOffset: 12 },
];
export const backgrounds = [
  ['Urban or industrial', 'Admin', 'Drive', 'Electronics', 'Streetwise'],
  ['Orbital or shipboard', 'Athletics', 'Electronics', 'Mechanic', 'Vacc Suit'],
  ['Rural or frontier', 'Animals', 'Navigation', 'Survival', 'Mechanic'],
  ['Academic', 'Art', 'Electronics', 'Language', 'Science'],
  ['Commercial or cosmopolitan', 'Admin', 'Carouse', 'Diplomat', 'Language'],
  ['Manual work or precarious employment', 'Athletics', 'Drive', 'Profession', 'Streetwise'],
];
export const names = [
  ['Aven', 'Dara', 'Iria', 'Kessa', 'Niko', 'Tavi'],
  ['Calder', 'Dane', 'Marr', 'Rusk', 'Varr', 'Venn'],
];

const packageFor = (label, kit, rated, familiar) => ({
  label, kit, slots: rated.split('; '), familiarities: familiar.split('; '),
});
export const occupations = {
  captain: packageFor('Ship captain', 'ship', 'Leadership; Tactics (naval); Pilot (spacecraft); Admin', 'Astrogation; Diplomat; Electronics; Vacc Suit'),
  pilot: packageFor('Spacecraft pilot', 'ship', 'Pilot (spacecraft); Astrogation; Electronics (sensors); Mechanic', 'Engineer; Navigation; Recon; Vacc Suit'),
  astrogator: packageFor('Astrogator', 'ship', 'Astrogation; Electronics (computers); Science (astronomy); Pilot (spacecraft)', 'Admin; Mechanic; Navigation; Vacc Suit'),
  engineer: packageFor('Ship engineer', 'engineering', 'Engineer (j-drive); Engineer (power); Engineer (m-drive); Mechanic', 'Admin; Electronics; Science; Vacc Suit'),
  electronics: packageFor('Electronics specialist', 'engineering', 'Electronics (sensors); Electronics (comms); Electronics (computers); Mechanic', 'Admin; Investigate; Science; Vacc Suit'),
  gunner: packageFor('Ship gunner', 'gunnery', 'Gunner (turret); Electronics (sensors); Mechanic; Tactics (naval)', 'Athletics; Engineer; Recon; Vacc Suit'),
  medic: packageFor('Medical professional', 'medical', 'Medic; Science (biology); Investigate; Electronics (computers)', 'Admin; Persuade; Survival; Vacc Suit'),
  steward: packageFor('Steward or host', 'hospitality', 'Steward; Carouse; Persuade; Diplomat', 'Admin; Medic; Profession; Streetwise'),
  trader: packageFor('Merchant or broker', 'commerce', 'Broker; Persuade; Admin; Streetwise', 'Carouse; Deception; Diplomat; Electronics'),
  official: packageFor('Administrator', 'commerce', 'Admin; Diplomat; Advocate; Leadership', 'Broker; Electronics; Investigate; Persuade'),
  scientist: packageFor('Scientist', 'research', 'Science (field); Investigate; Electronics (computers); Admin', 'Mechanic; Medic; Persuade; Survival'),
  performer: packageFor('Artist or entertainer', 'art', 'Art (field); Carouse; Persuade; Deception', 'Admin; Diplomat; Electronics; Streetwise'),
  soldier: packageFor('Soldier or armed guard', 'armed', 'Gun Combat (slug); Recon; Athletics (endurance); Tactics (military)', 'Medic; Melee; Survival; Vacc Suit'),
  investigator: packageFor('Investigator', 'inquiry', 'Investigate; Recon; Streetwise; Persuade', 'Admin; Advocate; Electronics; Gun Combat'),
  agent: packageFor('Covert operative', 'inquiry', 'Deception; Stealth; Investigate; Electronics (computers)', 'Diplomat; Gun Combat; Recon; Streetwise'),
  thief: packageFor('Thief or burglar', 'inquiry', 'Stealth; Streetwise; Deception; Mechanic', 'Athletics; Electronics; Melee; Recon'),
  explorer: packageFor('Explorer or guide', 'field', 'Survival; Recon; Navigation; Athletics (endurance)', 'Animals; Drive; Medic; Stealth'),
  worker: packageFor('Manual or technical worker', 'trade', 'Profession (field); Mechanic; Drive (wheel); Athletics (strength)', 'Admin; Electronics; Persuade; Survival'),
  psion: packageFor('Psionic specialist', 'inquiry', 'Talent (field); Investigate; Deception; Science (psionicology)', 'Admin; Electronics; Stealth; Streetwise'),
};
export const specialties = {
  scientist: ['astronomy', 'biology', 'chemistry', 'physics', 'planetology', 'psychology'],
  performer: ['holography', 'instrument', 'performer', 'visual media', 'write'],
  worker: ['cargo handling', 'construction', 'farming', 'mining', 'fabrication', 'equipment servicing'],
  melee: ['blade', 'bludgeon'],
  psion: ['Telepathy', 'Clairvoyance', 'Telekinesis', 'Awareness', 'Teleportation'],
};
export const specialtyFamilies = new Set([
  'Animals', 'Art', 'Athletics', 'Drive', 'Electronics', 'Engineer', 'Flyer', 'Gun Combat', 'Gunner',
  'Heavy Weapons', 'Language', 'Melee', 'Pilot', 'Profession', 'Science', 'Seafarer', 'Tactics',
]);
export const variants = {
  'pilot-small': { swapIn: [0, 'Pilot (small craft)'] },
  'pilot-capital': { swapIn: [0, 'Pilot (capital ships)'] },
  'engineer-power': { swap: 1 },
  'engineer-mdrive': { swap: 2 },
  'engineer-life': { swapIn: [0, 'Engineer (life support)'] },
  'electronics-comms': { swap: 1 },
  'electronics-computers': { swap: 2 },
  'electronics-remote': { swapIn: [0, 'Electronics (remote ops)'] },
  'official-diplomat': { swap: 1 },
  'official-advocate': { swap: 2 },
  'soldier-energy': { swapIn: [0, 'Gun Combat (energy)'] },
  'soldier-archaic': { swapIn: [0, 'Gun Combat (archaic)'] },
  'soldier-melee': { swapIn: [0, 'Melee (field)'], choices: specialties.melee },
  'captain-military': { slots: ['Leadership', 'Tactics (military)', 'Recon', 'Admin'], kit: 'armed' },
  'trader-smuggler': { slots: ['Streetwise', 'Broker', 'Deception', 'Persuade'] },
  'performer-journalist': { slots: ['Art (write)', 'Investigate', 'Persuade', 'Electronics (computers)'], kit: 'inquiry', field: 'write' },
};
export const occupationTable = [
  ['11', 'pilot', 'Merchant pilot'], ['12', 'astrogator', 'Jump navigator'],
  ['13', 'engineer', 'Jump engineer'], ['14', 'electronics', 'Sensor operator'],
  ['15', 'medic', 'Ship’s medic'], ['16', 'steward', 'Passenger steward'],
  ['21', 'captain', 'Shipmaster'], ['22', 'pilot', 'Shuttle pilot', 'pilot-small'],
  ['23', 'gunner', 'Turret gunner'], ['24', 'soldier', 'Shipboard marine'],
  ['25', 'electronics', 'Communications specialist', 'electronics-comms'],
  ['26', 'engineer', 'Life-support technician', 'engineer-life'],
  ['31', 'trader', 'Freight broker'], ['32', 'official', 'Port administrator'],
  ['33', 'official', 'Diplomatic representative', 'official-diplomat'],
  ['34', 'official', 'Legal advocate', 'official-advocate'],
  ['35', 'steward', 'Hotel host'], ['36', 'worker', 'Cargo-handling specialist', null, 'cargo handling'],
  ['41', 'soldier', 'Infantry trooper'], ['42', 'soldier', 'Armed security guard'],
  ['43', 'captain', 'Unit commander', 'captain-military'], ['44', 'investigator', 'Security investigator'],
  ['45', 'agent', 'Intelligence operative'], ['46', 'gunner', 'Naval weapons specialist'],
  ['51', 'worker', 'Workshop technician'], ['52', 'performer', 'Local entertainer'],
  ['53', 'medic', 'Clinic practitioner'], ['54', 'thief', 'Burglar'],
  ['55', 'trader', 'Contraband intermediary', 'trader-smuggler'], ['56', 'investigator', 'Private investigator'],
  ['61', 'explorer', 'Wilderness guide'], ['62', 'explorer', 'Survey expedition guide'],
  ['63', 'scientist', 'Research scientist'], ['64', 'scientist', 'Field scholar'],
  ['65', 'worker', 'Mining specialist', null, 'mining'],
  ['66', 'performer', 'Frontier correspondent', 'performer-journalist'],
].map(([id, profile, title, variant = null, field = null]) => ({ id, profile, title, variant, field }));
const manualRows = [
  ['pilot-capital', 'pilot', 'Capital-ship pilot'],
  ['engineer-power', 'engineer', 'Power engineer'],
  ['engineer-mdrive', 'engineer', 'Manoeuvre-drive engineer'],
  ['electronics-computers', 'electronics', 'Computer specialist'],
  ['electronics-remote', 'electronics', 'Remote operations specialist'],
  ['soldier-energy', 'soldier', 'Energy-weapons guard'],
  ['soldier-archaic', 'soldier', 'Archaic-weapons soldier'],
  ['soldier-melee', 'soldier', 'Melee specialist'],
  ['psion', 'psion', 'Psionic specialist'],
].map(([id, profile, title]) => ({ id, profile, title, variant: profile === 'psion' ? null : id, field: null }));
export const occupationChoices = [...occupationTable, ...manualRows];
export const kit = {
  ship: ['Assigned ship station', 'Fitted shipboard protection', 'Role-specific instruments'],
  engineering: ['Tools and test instruments', 'Workshop or ship systems access', 'Fitted protective gear'],
  gunnery: ['Assigned ship gunnery station and ship-owned weapons', 'Fitted shipboard protection', 'Gunnery instruments'],
  medical: ['Portable medical supplies', 'Clinical facilities where provided'],
  hospitality: ['Service supplies', 'Access to assigned passenger or guest facilities'],
  commerce: ['Working records and terminal', 'Institutional credentials', 'Transaction tools'],
  research: ['Recording equipment', 'Instruments for the selected field'],
  art: ['Materials or instruments for the selected medium', 'Recording or rehearsal equipment'],
  armed: ['Authorized weapon', 'Ammunition if applicable', 'Fitted armour', 'Field communications and essentials'],
  inquiry: ['Recorder and assignment communications', 'Authorized access tools'],
  field: ['Field tools and navigation aids', 'Protection for local hazards'],
  trade: ['Trade tools', 'Protection for the worksite'],
};
export const transition = [
  'finished an apprenticeship or course of training', 'left a previous position',
  'relocated to help family or community', 'moved for a better opportunity',
  'had to start over after a venture failed', 'returned after an absence or changed vocation',
];
export const looks = [
  'has distinctive coloring or grooming', 'has a noticeable healed mark',
  'wears carefully repaired gear', 'wears a memorable personal accessory',
  'is dressed unusually formally', 'wears a practical uniform altered for comfort',
];
export const manner = [
  'speaks briefly', 'checks details aloud', 'uses dry humor', 'watches before speaking',
  'tells short anecdotes', 'speaks with enthusiastic intensity',
];
export const goals = [
  'Earn dependable income', 'Protect someone', 'Leave or reach a place', 'Finish an important job',
  'Discover or expose something', 'Gain recognition or independence',
];
export const requests = [
  'Secure a reliable paid assignment', 'Help someone reach safety', 'Arrange passage or an escort',
  'Help finish a stalled assignment', 'Follow up on a lead', 'Find backing for an independent venture',
];
export const pressures = [
  'No major immediate pressure', 'A dependent needs help', 'An unpaid debt',
  'Employer or authority pressure', 'A health or maintenance burden', 'A duty or rivalry',
];
export const pressureConsequences = [
  'There is time to negotiate the terms', 'Someone is relying on a quick decision',
  'An advance would help with a payment coming due', 'Their employer or the authorities could intervene',
  'The timing must accommodate care or maintenance', 'A separate obligation could pull them away',
];
export const boundaries = [
  'Protects dependents', 'Keeps explicit promises', 'Avoids violence', 'Protects private information',
  'Respects essential safety procedures', 'Refuses humiliation or exploitation',
];
export const risks = [
  'Avoids avoidable risk', 'Protects livelihood first', 'Accepts ordinary occupational risk',
  'Accepts additional risk for a concrete benefit', 'Accepts serious risk for people or principles',
  'Readily accepts serious risk when the goal matters',
];
export const secrets = [
  ['Supports someone in private', 'Disclosing the support could expose the other person to pressure'],
  ['Conceals a failed project', 'Disclosure could cost them the next contract'],
  ['Holds sensitive information', 'Someone affected by the information would try to control who hears it'],
  ['Uses a different identity', 'Someone from their earlier life might recognize them'],
  ['Owes a significant favor', 'The favor could be called in at a difficult moment'],
  ['Plans to leave or change allegiance', 'Their present associates might intervene if they knew'],
];
export const relationshipRoles = {
  2: ['Enemy', 'A past dispute cost the other person something important', 'They seek serious harm if a practical opportunity arises'],
  3: ['Rival', 'They pursued the same position or contract', 'They compete for the next opportunity and may obstruct a deal'],
  4: ['Contact', 'They worked together once', 'They can provide limited information or an introduction'],
  10: ['Contact', 'They exchanged a useful introduction', 'They can offer a small favor within their own authority'],
  11: ['Ally', 'The other person stood by them during a difficult assignment', 'They will take a personal risk within agreed limits'],
  12: ['Patron or employer', 'The other person has sponsored their work', 'They may commission an assignment and expect an account of the result'],
};
export const employments = [
  'Seeking work or between positions', 'Independent contractor', 'Regular employee or member',
  'Regular employee or member', 'Regular employee or member', 'Owner, partner, or independent practitioner',
];
export const affiliations = [
  'Independent clients or household', 'Small local business', 'Larger company', 'Public service or government',
  'Guild, institution, or association', 'Family enterprise, clan, or patron',
];
export const accessTable = [
  ['Personal contacts', 'Respect the contact’s privacy and availability'],
  ['Local information or introductions', 'Explain the request before an introduction'],
  ['Workplace tools or workspace', 'Book the space or return borrowed tools'],
  ['Specialist records or expertise', 'Follow disclosure rules or arrange a consultation'],
  ['Help from a small team', 'Arrange time and agree on compensation'],
  ['Resources of a larger institution', 'Get authorization and accept institutional oversight'],
];
export const possessions = [
  'A photograph or image recording kept for the people in it', 'A long-used tool from training',
  'A token from a previous posting', 'A small keepsake from home', 'An annotated route guide',
  'A recording they return to when far from home',
];
export const equipmentCatalogue = {
  'autopistol-6-core2016': {
    name: 'Autopistol', kind: 'weapon', tl: 6, damage: '3D-3', skill: 'Gun Combat (slug)',
    attackCharacteristic: 'DEX', requiresAmmo: true, source: 'Traveller Core Rulebook (pre-2022 update), p. 118',
  },
  'cutlass-2-core2016': {
    name: 'Cutlass', kind: 'weapon', tl: 2, damage: '3D', skill: 'Melee (blade)',
    attackCharacteristic: 'STR', requiresAmmo: false, source: 'Traveller Core Rulebook (pre-2022 update), p. 116',
  },
  'he-vacc-9': {
    name: 'Hostile Environment Vacc Suit', kind: 'armour', tl: 9, protection: 8,
    training: { skill: 'Vacc Suit', level: 1 }, environments: ['vacuum', 'unbreathable'],
    source: core + ', p. 100 and August 2024 errata', url: errataUrl,
  },
  'combat-armour-10': {
    name: 'Combat Armour', kind: 'armour', tl: 10, protection: 13,
    training: { skill: 'Vacc Suit', level: 1 }, environments: ['vacuum', 'unbreathable'],
    source: core + ', p. 100 and August 2024 errata', url: errataUrl,
  },
};
