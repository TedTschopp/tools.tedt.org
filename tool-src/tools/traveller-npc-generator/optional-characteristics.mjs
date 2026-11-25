export const optionalCharacteristics = {
  MRL: { name: 'Morale', source: 'Traveller Companion, p. 5', rolled: true },
  LCK: { name: 'Luck', source: 'Traveller Companion, p. 4', rolled: true },
  STY: { name: 'Sanity', source: 'Traveller Companion, p. 7', rolled: true },
  CHR: { name: 'Charm', source: 'Traveller Companion, p. 10 (ordinary 2D starting roll)', rolled: true },
  PSI: { name: 'Psionics', source: 'Traveller Core Rulebook Update 2022, pp. 228–237' },
  STD: { name: 'Standing', source: 'Social Standing (SOC) on the Traveller character sheet' },
  WLT: { name: 'Wealth Level', source: 'Traveller Companion, p. 3' },
};

export const additionalRolls = Object.keys(optionalCharacteristics).filter(key => optionalCharacteristics[key].rolled);

export const careerAdjustmentFields = [
  { key: 'militaryTerms', label: 'Successful military terms', stat: 'MRL' },
  { key: 'disciplinedTerms', label: 'Successful disciplined civilian terms', stat: 'MRL' },
  { key: 'psiTerms', label: 'Completed terms before PSI testing', stat: 'PSI' },
  { key: 'cashBenefits', label: 'Cash Benefit rolls', stat: 'WLT' },
  { key: 'injuredCareers', label: 'Careers with an injury', stat: 'WLT' },
  { key: 'anagathics', label: 'Used anagathics', stat: 'WLT', checkbox: true },
];

export function psionMode(mode, selected) {
  return mode === 'auto' && selected?.includes('PSI') ? 'latent' : mode;
}
