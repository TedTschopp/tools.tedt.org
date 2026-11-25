import '../../assets/traveller-sheet.js';
import { characterSheet, characterSheetEdits } from './character-sheet.mjs';

const gearSections = ['weapons', 'armor', 'augments', 'equipment'];

function toGeneratorSheet(record) {
  const characteristics = Object.fromEntries(Object.entries(record.characteristics).map(([key, stat]) => [
    key, Object.fromEntries(['current', 'baseline'].map(field => [
      field, String(stat[field] ?? '').trim() === '' ? null : Number(stat[field]),
    ])),
  ]));
  const result = { ...record, characteristics };
  for (const key of gearSections) {
    result[key] = (record[key] ?? []).map(({ state, ...row }) => ({
      ...row,
      ...(row.quantity || state.quantity !== '1' ? { quantity: state.quantity } : {}),
      ...(row.equipped || state.equipped ? { equipped: state.equipped ? 'yes' : 'no' } : {}),
      ...(row.carried || !state.carried ? { carried: state.carried ? 'yes' : 'no' } : {}),
      gearNotes: state.notes,
    }));
  }
  return result;
}

export function editCharacterSheet(dialog, npc, save) {
  const form = dialog.querySelector('form');
  const content = dialog.querySelector('.sheet-content');
  const feedback = form.querySelector('[role="alert"]');
  const sheet = document.createElement('traveller-sheet');
  sheet.setAttribute('embedded', '');
  sheet.character = characterSheet(npc);
  content.replaceChildren(sheet);

  dialog.addEventListener('close', () => {
    form.onsubmit = null;
    content.replaceChildren();
  }, { once: true });
  form.onsubmit = event => {
    event.preventDefault();
    try {
      save(characterSheetEdits(npc, toGeneratorSheet(sheet.character)));
      dialog.close();
    } catch (error) {
      feedback.textContent = error.message;
    }
  };
  feedback.textContent = '';
  dialog.showModal();
  content.scrollTop = 0;
}
