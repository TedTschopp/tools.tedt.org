import {
  additionalCharacteristics, characterSheet, characterSheetEdits, coreCharacteristics, fieldLimit, financialFields,
  notesField, obtainableCash, personalFields, scoreDM, scoreFields, scoreLimits, sheetRowLimit, sheetSections, speciesCharacteristics,
} from './character-sheet.mjs';

export function editCharacterSheet(dialog, element, npc, save) {
  const form = dialog.querySelector('form');
  const content = dialog.querySelector('.sheet-content');
  const feedback = form.querySelector('[role="alert"]');
  const sheet = characterSheet(npc);
  const lists = {};
  const scores = {};
  const readFields = parent => Object.fromEntries(Array.from(parent.querySelectorAll('[name]'), input => [input.name, input.value]));

  function inputField([key, label, type], value) {
    let input;
    if (type === 'notes') {
      input = element('textarea', null, { name: key, maxlength: fieldLimit(type), rows: key === 'notes' ? 5 : 2 });
    } else if (type === 'equipped') {
      input = element('select', ['', 'yes', 'no'].map((name, index) =>
        element('option', ['Unspecified', 'Yes', 'No'][index], { value: name })), { name: key });
    } else {
      const numeric = ['count', 'money', 'quantity', 'integer'].includes(type);
      input = element('input', null, {
        name: key, type: numeric ? 'number' : 'text',
        ...(numeric ? { step: type === 'money' ? 'any' : '1' } : { maxlength: fieldLimit(type) }),
        ...(type === 'count' && { min: '0' }), ...(type === 'quantity' && { min: '1' }),
      });
    }
    input.value = value ?? '';
    return element('label', [label, input], { class: type === 'notes' ? 'wide' : '' });
  }

  function fieldGrid(fields, values) {
    return element('div', fields.map(field => inputField(field, values[field[0]])), { class: 'sheet-fields' });
  }

  function disclose(label, body) {
    return element('details', [element('summary', label), body], { class: 'sheet-section' });
  }

  function statGrid(stats) {
    return element('div', Object.entries(stats).map(([key, label]) => {
      const card = element('fieldset', element('legend', label), { class: 'sheet-stat' });
      scores[key] = {};
      card.append(element('div', scoreFields.map(field => {
        const part = field === 'current' ? 'Current' : 'Baseline';
        const id = 'sheet-' + key + '-' + field;
        const [min, max] = scoreLimits(key);
        const input = element('input', null, {
          type: 'number', step: '1', min, max, placeholder: '—', id,
          'aria-label': label + ' ' + part.toLowerCase(),
        });
        input.value = sheet.characteristics[key]?.[field] ?? '';
        scores[key][field] = input;
        const modifier = element('output', null, { for: id, class: 'sheet-dm ' + field, 'aria-label': part + ' dice modifier' });
        const cash = key === 'wlt' ? element('output', null, { for: id, class: 'sheet-cash' }) : null;
        const update = () => {
          const value = input.value === '' || !input.validity.valid ? null : input.valueAsNumber;
          const dm = scoreDM(value);
          modifier.textContent = dm == null ? '—' : (dm >= 0 ? '+' : '−') + Math.abs(dm);
          if (cash) cash.textContent = obtainableCash(value) || '—';
        };
        input.addEventListener('input', update);
        update();
        return element('div', [element('label', part, { for: id }), input, modifier, cash], { class: 'sheet-score' });
      }), { class: 'sheet-score-pair' }));
      return card;
    }), { class: 'sheet-stats' });
  }

  function sheetCollection([key, label, fields]) {
    const rows = element('div', null, { class: 'sheet-rows' });
    lists[key] = rows;
    const add = element('button', 'Add row', { type: 'button', class: 'quiet compact', 'aria-label': 'Add row to ' + label });
    function appendRow(data) {
      const summary = element('summary');
      const editor = fieldGrid(fields, data);
      const remove = element('button', 'Remove row', { type: 'button', class: 'quiet compact' });
      const row = element('details', [summary, editor, remove], { class: 'sheet-row' });
      const refreshTitle = () => {
        const values = readFields(editor);
        const name = values[fields[0][0]];
        const description = [values.specialization, values.level !== undefined && values.level !== '' && 'Level ' + values.level]
          .filter(Boolean).join(' · ');
        summary.textContent = [name || 'New row', description].filter(Boolean).join(' · ');
      };
      editor.addEventListener('input', refreshTitle);
      remove.addEventListener('click', () => {
        const next = row.nextElementSibling ?? row.previousElementSibling;
        row.remove();
        add.disabled = false;
        (next?.querySelector('summary') ?? add).focus();
      });
      rows.append(row);
      refreshTitle();
      return row;
    }
    sheet[key].forEach(appendRow);
    add.disabled = rows.children.length >= sheetRowLimit;
    add.addEventListener('click', () => {
      const row = appendRow({});
      row.open = true;
      add.disabled = rows.children.length >= sheetRowLimit;
      row.querySelector('input').focus();
    });
    const title = 'sheet-table-' + key;
    return element('section', [element('h4', label, { id: title }), rows, add], { class: 'sheet-table', 'aria-labelledby': title });
  }

  const extraSpecies = Object.fromEntries(Object.entries(speciesCharacteristics).filter(([key]) => sheet.characteristics[key]));
  const personal = fieldGrid(personalFields, sheet);
  const finances = fieldGrid(financialFields, sheet);
  const notes = fieldGrid([notesField], sheet);
  content.replaceChildren(
    element('p', 'For ' + npc.player.name + '. Rolls fill in the starting values. Use this sheet to track changes during play.', { class: 'hint' }),
    element('h3', 'Characteristics', { class: 'sheet-heading' }),
    statGrid({ ...coreCharacteristics, ...extraSpecies }),
    disclose('Additional characteristics', statGrid(additionalCharacteristics)),
    disclose('Personal data', personal),
    ...sheetSections.map(([label, tables]) => disclose(label, element('div', tables.map(sheetCollection)))),
    disclose('Finances', element('div', [
      statGrid({ wlt: 'Wealth Level · Cash obtainable' }), finances,
    ])),
    disclose('Notes', notes),
  );
  function revealInvalid(event) {
    for (let details = event.target.closest('details'); details; details = details.parentElement.closest('details')) {
      details.open = true;
    }
  }
  form.addEventListener('invalid', revealInvalid, true);
  dialog.addEventListener('close', () => {
    form.removeEventListener('invalid', revealInvalid, true);
    form.onsubmit = null;
    content.replaceChildren();
  }, { once: true });
  form.onsubmit = event => {
    event.preventDefault();
    try {
      const data = { ...readFields(personal), ...readFields(finances), ...readFields(notes) };
      for (const [key, rows] of Object.entries(lists)) data[key] = Array.from(rows.children, readFields);
      data.characteristics = Object.fromEntries(Object.entries(scores).map(([key, fields]) => [key, Object.fromEntries(
        Object.entries(fields).map(([field, input]) => [field, input.value === '' ? null : input.valueAsNumber]),
      )]));
      save(characterSheetEdits(npc, data));
      dialog.close();
    } catch (error) {
      feedback.textContent = error.message;
    }
  };
  feedback.textContent = '';
  dialog.showModal();
  content.scrollTop = 0;
}
