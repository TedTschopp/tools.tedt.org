/* <traveller-sheet> — a standalone character record for Mongoose Traveller 2e. */
(() => {
  "use strict";

  if (customElements.get("traveller-sheet")) return;
  const styleNonce = document.currentScript?.nonce;

  const core = {
    str: "Strength", dex: "Dexterity", end: "Endurance",
    int: "Intellect", edu: "Education", soc: "Social Standing",
  };
  const optional = {
    mrl: "Morale", lck: "Luck", sty: "Sanity", chr: "Charm", psi: "Psionics",
    std: "Standing", wlt: "Wealth Level", cha: "Charisma", res: "Resolve", ter: "Territory",
  };
  const characteristics = { ...core, ...optional };
  const ruleReminders = {
    str: ["Physical force", "Use STR to lift, force a hatch, or power a blow. STR is one of the physical scores that injury can reduce.", "Core Rulebook · Characteristics and Combat"],
    dex: ["Coordination and reflexes", "Think aiming, delicate work, or a quick getaway. DEX is one of the two choices for an initiative check.", "Core Rulebook · Skills and Tasks"],
    end: ["Stamina and resilience", "Use END when a Traveller must keep going through fatigue, harsh conditions, or illness. Ordinary combat damage reduces END first.", "Core Rulebook · Characteristics and Combat"],
    int: ["Quick thinking", "Use INT to notice a clue, improvise a solution, or react under pressure. You can choose INT for initiative.", "Core Rulebook · Skills and Tasks"],
    edu: ["Learning and training", "Think recalling technical knowledge or drawing on formal training. EDU’s DM also helps determine how many background skills you start with.", "Core Rulebook · Traveller Creation"],
    soc: ["Rank and social position", "Use SOC when status opens doors, such as getting an audience or being recognized at a formal event. Local customs can change what your standing is worth.", "Core Rulebook · Traveller Creation"],
    mrl: ["Courage under pressure", "Use a Morale check to see whether someone holds their ground, rallies, or presses on in spite of fear.", "Traveller Companion · Morale"],
    lck: ["Fortune outside your control", "Think an uncertain outcome where no skill applies. With the optional Luck rule, spending a point of current Luck can add DM+1 to a check.", "Traveller Companion · Luck"],
    sty: ["Composure under mental strain", "Use a Sanity check when shock or something deeply unsettling threatens a Traveller’s composure. The score can drop after severe experiences.", "Traveller Companion · Sanity"],
    chr: ["Personal charm and influence", "Think winning over a stranger through your manner. The Referee can use Charm alongside or in place of SOC for the campaign.", "Traveller Companion · Alternative Characteristics"],
    psi: ["Psionic strength", "Use the current PSI DM when making a psionic talent check. Track the PSI points the power costs and restore them as they recover.", "Core Rulebook · Psionics"],
    std: ["Standing with a group", "Use this to record the status or reputation your campaign tracks separately from SOC. Think access, deference, or influence with the group that recognizes it.", "Campaign tracking · Social Standing"],
    wlt: ["Abstract personal resources", "The score determines how much cash you can readily raise. Use the Wealth rules for personal purchases and keep ship finances in credits.", "Traveller Companion · Wealth"],
    cha: ["Vargr charisma", "Think influence and leadership among Vargr. How your pack sees your success or failure can change your CHA.", "Aliens of Charted Space Vol. 1 · Vargr"],
    res: ["Hiver conviction", "Think the will to follow through on a manipulation. RES 7 or higher is the benchmark for a Hiver to undertake a significant one.", "Aliens of Charted Space Vol. 2 · Hivers"],
    ter: ["Aslan landholdings", "Track a male Aslan’s own territory here. Family holdings help determine starting SOC for Aslan Travellers.", "Aliens of Charted Space Vol. 1 · Aslan"],
  };
  const profile = [
    ["charName", "Character name", "text", "wide"], ["playerName", "Player name", "text", "wide"],
    ["role", "Role or title"], ["species", "Species"], ["age", "Age", "integer"],
    ["homeworld", "Homeworld"], ["homeworldUWP", "Homeworld UWP"],
    ["upp", "Recorded UPP"], ["traits", "Traits", "area", "full"],
  ];
  const condition = [["rads", "Radiation dose (rads)", "integer"], ["condition", "Conditions", "text", "wide"]];
  const finances = [
    ["cashOnHand", "Cash on hand (Cr)", "decimal"], ["credits", "Bank balance (Cr)", "decimal"],
    ["debt", "Debt (Cr)", "decimal"], ["pension", "Monthly pension (Cr)", "decimal"],
    ["livingCosts", "Living costs (Cr)", "decimal"], ["shipPayments", "Ship payments (Cr)", "decimal"],
    ["shipCosts", "Ship costs (Cr)", "decimal"], ["financialNotes", "Financial notes", "area", "full"],
  ];
  const notes = [
    ["background", "Background", "area", "full"], ["notes", "Character and session notes", "area", "full"],
  ];
  const collections = {
    skills: {
      title: "Skills", item: "skill",
      fields: [["name", "Skill", "text", "wide"], ["specialization", "Specialization"],
        ["level", "Level", "integer", "short"], ["modifier", "Other DM", "integer", "short"]],
    },
    trainingSkills: {
      title: "Study periods", item: "study period",
      fields: [["skill", "Skill", "text", "wide"], ["specialization", "Specialization"],
        ["weeksSpent", "Weeks spent", "integer", "short"], ["weeksTotal", "Weeks required", "integer", "short"]],
    },
    psionics: {
      title: "Psionics and special abilities", item: "ability",
      fields: [["name", "Ability", "text", "wide"], ["level", "Level", "integer", "short"],
        ["cost", "PSI cost", "integer", "short"], ["target", "Target", "integer", "short"],
        ["time", "Time"], ["notes", "Description", "area", "full"]],
    },
    weapons: {
      title: "Weapons and attacks", item: "weapon or attack", gear: true,
      fields: [["name", "Weapon or attack", "text", "wide"], ["tl", "TL", "text", "short"],
        ["skill", "Skill"], ["damage", "Damage", "text", "short"], ["range", "Range"],
        ["weight", "Mass (kg)"], ["magazine", "Magazine"], ["ammo", "Rounds left", "integer", "short"]],
    },
    armor: {
      title: "Armour", item: "armour", gear: true,
      fields: [["name", "Armour", "text", "wide"], ["tl", "TL", "text", "short"],
        ["rating", "Protection", "text", "short"], ["radiation", "Rad protection", "text", "short"],
        ["weight", "Mass (kg)"], ["options", "Options", "text", "wide"]],
    },
    wounds: {
      title: "Wounds", item: "wound",
      fields: [["type", "Injury"], ["location", "Location"], ["recovery", "Recovery"],
        ["notes", "Notes", "area", "full"]],
    },
    equipment: {
      title: "Equipment", item: "item", gear: true,
      fields: [["name", "Equipment", "text", "wide"], ["tl", "TL", "text", "short"],
        ["mass", "Mass (kg)"], ["cost", "Cost (Cr)"]],
    },
    augments: {
      title: "Augments", item: "augment", gear: true,
      fields: [["type", "Augment", "text", "wide"], ["tl", "TL", "text", "short"],
        ["improvement", "Effect", "text", "wide"]],
    },
    preCareerOptions: {
      title: "Pre-career education", item: "education entry",
      fields: [["type", "Program", "text", "wide"], ["years", "Years", "integer", "short"],
        ["outcome", "Outcome"], ["benefits", "Benefits", "area", "full"]],
    },
    careers: {
      title: "Career history", item: "career",
      fields: [["career", "Career"], ["assignment", "Assignment"], ["rank", "Rank or title"],
        ["terms", "Terms", "integer", "short"], ["years", "Years", "integer", "short"],
        ["promotions", "Promotions", "integer", "short"], ["benefits", "Events and benefits", "area", "full"]],
    },
    relationships: {
      title: "Relationships", item: "relationship",
      fields: [["name", "Name", "text", "wide"],
        ["type", "Relationship", ["Ally", "Contact", "Rival", "Enemy", "Other"]],
        ["notes", "Notes", "area", "full"]],
    },
  };
  const gearFields = [
    ["quantity", "Quantity", "integer", "short"], ["carried", "Carried", "checkbox"],
  ];
  const gearDetails = [["equipped", "Equipped", "checkbox"], ["notes", "Item notes", "area", "full"]];
  const personalFields = [...profile, ...condition, ...finances, ...notes];
  const recordKeys = ["characteristics", "education", ...personalFields.map(([key]) => key), ...Object.keys(collections)];
  const tabs = [
    ["overview", "Overview"], ["skills", "Skills"], ["combat", "Combat"],
    ["inventory", "Inventory"], ["lifepath", "Lifepath"], ["notes", "Notes"],
  ];
  const blankCharacter = () => ({ charName: "", characteristics: {} });
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const string = value => value == null ? "" : String(value);
  const isChecked = value => [true, 1, "true", "yes", "1"].includes(value);
  const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const signed = value => value >= 0 ? "+" + value : "−" + Math.abs(value);
  const nameOf = value => string(value.charName).trim() || "Unnamed Traveller";
  const skillName = skill => skill.specialization ? `${skill.name} (${skill.specialization})` : string(skill.name);
  const skillKey = name => string(name).toLowerCase().replace(/[^a-z]/g, "");
  const jackOfAllTrades = skill => skillKey(skill.name) === "jackofalltrades";
  const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 3 });
  const eHex = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  // Traveller Companion, Wealth Level. The value is cash obtainable in credits.
  const wealthCash = [0, 100, 200, 400, 800, 1200, 1500, 2000, 3000, 5000, 7500, 10000, 12500, 15000, 17500, 20000];
  const cashAt = score => wealthCash[score] == null ? "" : "Cr " + numberFormat.format(wealthCash[score]);

  function integer(value) {
    const text = string(value).trim();
    return /^[+-]?\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
  }

  function modifier(value) {
    if (value === null) return null;
    const band = [0, 2, 5, 8, 11, 14].findIndex(max => value <= max);
    return band === -1 ? 3 : band - 3;
  }

  function effectiveScore(stat) {
    return integer(stat?.current) ?? integer(stat?.baseline);
  }

  function uppOf(record) {
    const recorded = string(record.upp).trim();
    if (recorded) return recorded;
    const digits = Object.keys(core).map(key => eHex[integer(record.characteristics[key]?.baseline)]);
    return digits.every(Boolean) ? digits.join("") : "—";
  }

  function asText(value, label) {
    if (value == null) return "";
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return String(value);
    throw new Error(`${label} must contain text or a number.`);
  }

  function normalizeCharacter(value) {
    const source = isRecord(value?.data) && typeof value.id === "string" ? value.data : value;
    if (!isRecord(source) || !recordKeys.some(key => Object.hasOwn(source, key))) {
      throw new Error("Choose a Traveller character JSON export.");
    }

    const record = clone(source);
    for (const [key, label] of personalFields) {
      if (Object.hasOwn(record, key)) record[key] = asText(record[key], label);
    }
    record.characteristics ??= {};
    if (!isRecord(record.characteristics)) throw new Error("Characteristics must be an object.");
    for (const [key, value] of Object.entries(record.characteristics)) {
      const stat = isRecord(value) ? value : { baseline: value };
      for (const field of ["current", "baseline"]) {
        stat[field] = asText(stat[field], characteristics[key] ?? "Characteristic");
      }
      Object.defineProperty(record.characteristics, key, { value: stat, enumerable: true, writable: true, configurable: true });
    }
    if (record.preCareerOptions == null && Object.hasOwn(record, "education")) {
      record.preCareerOptions = record.education;
    }
    for (const [key, { title, fields, gear }] of Object.entries(collections)) {
      if (!Object.hasOwn(record, key)) continue;
      if (!Array.isArray(record[key]) || !record[key].every(isRecord)) {
        throw new Error(`${title} must contain a list of entries.`);
      }
      for (const row of record[key]) {
        for (const [field, label] of fields) {
          if (Object.hasOwn(row, field)) row[field] = asText(row[field], label);
        }
        if (!gear) continue;
        if (row.state != null && !isRecord(row.state)) throw new Error(`${title} item state must be an object.`);
        const state = row.state ?? {};
        row.state = {
          ...state,
          quantity: asText(state.quantity ?? row.quantity ?? 1, "Quantity"),
          carried: isChecked(state.carried ?? row.carried ?? true),
          equipped: isChecked(state.equipped ?? row.equipped ?? false),
          notes: asText(state.notes ?? row.gearNotes, "Item notes"),
        };
      }
    }
    return record;
  }

  function readRoster(key) {
    const saved = localStorage.getItem(key);
    if (saved === null) return null;
    const roster = JSON.parse(saved);
    if (!isRecord(roster) || roster.version !== 1 || !Array.isArray(roster.characters)) throw new Error("Invalid roster");
    const ids = new Set();
    return {
      activeId: roster.activeId,
      characters: roster.characters.map(entry => {
        if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) {
          throw new Error("Invalid roster entry");
        }
        ids.add(entry.id);
        return { id: entry.id, data: normalizeCharacter(entry.data) };
      }),
    };
  }

  function carriedMass(record) {
    let total = 0;
    let unknown = 0;
    for (const [key, field] of [["equipment", "mass"], ["weapons", "weight"], ["armor", "weight"]]) {
      for (const row of record[key] ?? []) {
        if (!row.state.carried || !string(row.name).trim()) continue;
        const mass = string(row[field]).trim().match(/^(?:\d+(?:\.\d+)?|\.\d+)(?:\s*kg)?$/i);
        if (mass && Number.isFinite(parseFloat(mass[0]))) {
          total += parseFloat(mass[0]) * Math.max(1, integer(row.state.quantity) ?? 1);
        } else {
          unknown += 1;
        }
      }
    }
    return { total, unknown };
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function action(label, handler, className = "") {
    const button = element("button", className, label);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  }

  function addRuleReminder(tile, key, prefix) {
    const label = characteristics[key];
    const [description, cue, source] = ruleReminders[key];
    const tip = element("div", "rule-tip");
    tip.id = prefix + "-rule-" + key;
    tip.setAttribute("role", "tooltip");
    const popover = typeof tip.showPopover === "function";
    if (popover) tip.setAttribute("popover", "auto");
    else tip.hidden = true;
    tip.append(element("strong", "", description), element("p", "", cue), element("small", "", source));

    let pinned = false;
    let enterTimer;
    let leaveTimer;
    const shown = () => popover ? tip.matches(":popover-open") : !tip.hidden;
    const hide = () => {
      pinned = false;
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
      if (!shown()) return;
      if (popover) tip.hidePopover();
      else tip.hidden = true;
    };
    const show = () => {
      clearTimeout(leaveTimer);
      if (!tile.isConnected || shown()) return;
      if (!popover) {
        tip.hidden = false;
        return;
      }
      tip.showPopover();
      const bounds = tile.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const gap = 6;
      const edge = 8;
      const left = Math.max(edge, Math.min(bounds.left, width - tip.offsetWidth - edge));
      const below = bounds.bottom + gap;
      const top = below + tip.offsetHeight <= height - edge ? below : bounds.top - gap - tip.offsetHeight;
      tip.style.left = left + "px";
      tip.style.top = Math.max(edge, top) + "px";
    };
    const button = action("?", () => {
      if (pinned) hide();
      else {
        pinned = true;
        show();
      }
    }, "icon-button rule-trigger");
    button.setAttribute("aria-label", "Rules reminder for " + label);
    button.setAttribute("aria-describedby", tip.id);

    const scheduleHide = () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        if (!pinned && !tile.matches(":hover") && !tip.matches(":hover") && !button.matches(":focus")) hide();
      }, 160);
    };
    tile.addEventListener("pointerenter", event => {
      if (event.pointerType !== "mouse") return;
      clearTimeout(leaveTimer);
      enterTimer = setTimeout(show, 260);
    });
    tile.addEventListener("pointerleave", scheduleHide);
    tip.addEventListener("pointerenter", () => clearTimeout(leaveTimer));
    tip.addEventListener("pointerleave", scheduleHide);
    tip.addEventListener("toggle", event => {
      if (event.newState === "closed") pinned = false;
    });
    button.addEventListener("focus", show);
    button.addEventListener("blur", scheduleHide);
    tile.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !shown()) return;
      event.preventDefault();
      event.stopPropagation();
      hide();
    });
    tile.append(tip);
    return button;
  }

  function options(select, items) {
    const selected = select.value;
    select.replaceChildren(...items.map(([value, label]) => new Option(label, value)));
    if (items.some(([value]) => value === selected)) select.value = selected;
  }

  function field([key, label, kind = "text", size = ""], value, update, accessibleLabel) {
    const wrapper = element("label", `field ${size} ${kind === "checkbox" ? "check-field" : ""}`);
    const control = element(kind === "area" ? "textarea" : Array.isArray(kind) ? "select" : "input");
    if (kind === "area") {
      control.rows = 2;
    } else if (Array.isArray(kind)) {
      options(control, [["", "Choose…"], ...kind.map(option => [option, option])]);
    } else {
      control.type = { integer: "number", decimal: "number", checkbox: "checkbox" }[kind] ?? "text";
      if (kind === "decimal") control.step = "any";
    }
    if (accessibleLabel || Array.isArray(kind)) control.setAttribute("aria-label", accessibleLabel ?? label);
    control.name = key;
    if (kind === "checkbox") control.checked = Boolean(value);
    else control.value = string(value);
    control.addEventListener("input", () => {
      if (control.validity.badInput) return;
      update(kind === "checkbox" ? control.checked : control.value);
    });
    const caption = element("span", "field-label", label);
    wrapper.append(...(kind === "checkbox" ? [control, caption] : [caption, control]));
    return wrapper;
  }

  function card(title, className = "") {
    const section = element("section", `card ${className}`);
    const heading = element("div", "card-heading");
    heading.append(element("h2", "", title));
    section.append(heading);
    return section;
  }

  function readout(fields, record) {
    const list = element("dl", "readout");
    for (const [key, label, kind, size] of fields) {
      const value = record[key];
      if (value == null || value === "") continue;
      const pair = element("div", kind === "area" || size === "full" ? "full" : "");
      pair.append(element("dt", "", label), element("dd", "", typeof value === "boolean" ? value ? "Yes" : "No" : string(value)));
      list.append(pair);
    }
    return list;
  }

  function download(record) {
    const slug = nameOf(record).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2) + "\n"], { type: "application/json" }));
    const link = element("a");
    link.href = url;
    link.download = (slug || "traveller-character") + ".json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const layout = `
    <div class="screen">
      <div class="toolbar">
        <div class="product">
          <span class="mark" aria-hidden="true">✦</span>
          <div><strong>Traveller</strong><span class="edition">Character sheet</span></div>
        </div>
        <div class="tools">
          <div class="picker"><select data-picker aria-label="Saved characters"></select></div>
          <button type="button" data-new class="primary">New character</button>
          <button type="button" data-import>Import JSON</button>
          <details class="more">
            <summary aria-label="More character actions">More <span aria-hidden="true">⌄</span></summary>
            <div class="menu">
              <button type="button" data-export>Export JSON</button>
              <button type="button" data-print>Print sheet</button>
              <button type="button" data-duplicate>Duplicate character</button>
              <button type="button" data-delete class="danger">Delete character</button>
            </div>
          </details>
          <input data-file type="file" accept=".json,application/json" hidden>
        </div>
      </div>
      <header class="masthead" part="masthead">
        <div class="identity">
          <p class="edition">Mongoose Traveller 2e</p>
          <h1 data-name></h1>
          <p class="identity-details" data-identity hidden></p>
        </div>
        <div class="profile-code"><span>UPP</span><strong data-upp></strong></div>
      </header>
      <p class="notice" aria-live="polite" data-notice hidden></p>
      <div class="navigation">
        <div class="tabs" role="tablist" aria-label="Character sheet sections"></div>
        <button type="button" class="mobile-roll" data-quick-check>Dice roller ↓</button>
      </div>
      <div class="workspace">
        <div class="panels"></div>
        <aside class="roller card" aria-labelledby="check-heading">
          <div class="card-heading">
            <h2 id="check-heading">Dice roller</h2>
            <span class="dice-mark" aria-hidden="true">⚄</span>
          </div>
          <form data-check>
            <label class="field"><span class="field-label" id="roll-stat-label">Characteristic</span>
              <select name="stat" aria-labelledby="roll-stat-label"></select>
            </label>
            <label class="field"><span class="field-label" id="roll-skill-label">Skill</span>
              <select name="skill" aria-labelledby="roll-skill-label"></select>
            </label>
            <div class="roll-inputs">
              <label class="field"><span class="field-label">Difficulty</span>
                <input type="number" name="target" step="1" value="8" placeholder="—">
              </label>
              <label class="field"><span class="field-label">Situational DM</span>
                <input type="number" name="modifier" step="1" value="0">
              </label>
            </div>
            <fieldset class="modes">
              <legend class="sr-only">Dice mode</legend>
              <label><input type="radio" name="mode" value="normal" checked><span>Normal</span></label>
              <label><input type="radio" name="mode" value="boon"><span>Boon</span></label>
              <label><input type="radio" name="mode" value="bane"><span>Bane</span></label>
            </fieldset>
            <p class="formula" data-formula></p>
            <button class="primary roll" type="submit">Roll check</button>
          </form>
          <div class="result" role="status" aria-atomic="true" data-result hidden></div>
          <details class="roll-log" data-log hidden>
            <summary>Recent rolls</summary>
            <ol></ol>
          </details>
        </aside>
      </div>
      <footer class="footer">
        <span>Independent character sheet for Mongoose Traveller 2e</span>
        <span data-storage-status></span>
      </footer>
    </div>
    <article class="record"></article>
  `;

  class TravellerSheet extends HTMLElement {
    static observedAttributes = ["readonly"];

    #root;
    #roster;
    #seed;
    #storageKey;
    #storageProblem = false;
    #dirty = new Set();
    #removed = new Set();
    #tab = "overview";
    #rolls = [];
    #beforePrint = () => this.#renderRecord();

    constructor() {
      super();
      this.#root = this.attachShadow({ mode: "open" });
    }

    get character() {
      return clone(this.#roster ? this.#data : this.#seed ?? blankCharacter());
    }

    set character(value) {
      const data = value == null ? blankCharacter() : normalizeCharacter(value);
      if (!this.#roster) {
        this.#seed = data;
        return;
      }
      this.#active.data = data;
      this.#dirty.add(this.#active.id);
      this.#save();
      this.#resetRoller();
      this.#render();
    }

    get #active() {
      return this.#roster.characters.find(entry => entry.id === this.#roster.activeId);
    }

    get #data() {
      return this.#active.data;
    }

    #get(selector) {
      return this.#root.querySelector(selector);
    }

    connectedCallback() {
      window.addEventListener("beforeprint", this.#beforePrint);
      if (this.#roster) return;

      const style = element("style");
      if (styleNonce) style.nonce = styleNonce;
      style.textContent = styles;
      const template = element("template");
      template.innerHTML = layout;
      this.#root.append(style, template.content.cloneNode(true));
      this.#buildTabs();
      this.#bindActions();

      let seedProblem = "";
      let data = this.#seed ?? blankCharacter();
      const seed = this.querySelector(':scope > script[type="application/json"]');
      try {
        // Properties assigned before the browser upgraded the element are own properties.
        if (Object.hasOwn(this, "character")) {
          const assigned = this.character;
          delete this.character;
          if (assigned != null) data = normalizeCharacter(assigned);
        } else if (seed && !this.#seed) {
          data = normalizeCharacter(JSON.parse(seed.textContent));
        }
      } catch (error) {
        seedProblem = `Could not load the embedded character. ${error.message}`;
      }

      const key = this.getAttribute("storage-key")?.trim();
      if (key && !this.hasAttribute("readonly") && !this.hasAttribute("embedded")) {
        this.#storageKey = "traveller-sheet-v1:" + key;
        try {
          this.#roster = readRoster(this.#storageKey);
        } catch {
          this.#storageProblem = true;
        }
      }
      if (!this.#roster?.characters.length) {
        const id = uid();
        this.#roster = { activeId: id, characters: [{ id, data }] };
        this.#dirty.add(id);
      } else if (!this.#active) {
        this.#roster.activeId = this.#roster.characters[0].id;
      }
      this.#render();
      if (seedProblem) this.#notice(seedProblem, true);
    }

    disconnectedCallback() {
      window.removeEventListener("beforeprint", this.#beforePrint);
    }

    attributeChangedCallback() {
      if (this.#roster) this.#render();
    }

    #buildTabs() {
      const bar = this.#get(".tabs");
      const panels = this.#get(".panels");
      for (const [key, title] of tabs) {
        const tab = action(title, () => this.#showTab(key));
        tab.id = "tab-" + key;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", "panel-" + key);
        tab.dataset.tab = key;
        const panel = element("div", "panel");
        panel.id = "panel-" + key;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
        panel.tabIndex = 0;
        bar.append(tab);
        panels.append(panel);
      }
      bar.addEventListener("keydown", event => {
        if (!event.target.matches('[role="tab"]')) return;
        const keys = tabs.map(([key]) => key);
        const index = keys.indexOf(this.#tab);
        const nextIndex = {
          ArrowRight: (index + 1) % keys.length,
          ArrowLeft: (index + keys.length - 1) % keys.length,
          Home: 0,
          End: keys.length - 1,
        }[event.key];
        if (nextIndex === undefined) return;
        event.preventDefault();
        this.#showTab(keys[nextIndex]);
        this.#get("#tab-" + this.#tab).focus();
      });
    }

    #bindActions() {
      const file = this.#get("[data-file]");
      this.#get("[data-picker]").addEventListener("change", event => this.#select(event.target.value));
      this.#get("[data-new]").addEventListener("click", () => this.#insert(blankCharacter(), "Blank character created."));
      this.#get("[data-import]").addEventListener("click", () => file.click());
      file.addEventListener("change", async () => {
        const selected = file.files[0];
        file.value = "";
        if (!selected) return;
        try {
          if (selected.size > 2_000_000) throw new Error("Choose a JSON file under 2 MB.");
          const data = normalizeCharacter(JSON.parse(await selected.text()));
          this.#insert(data, `Imported ${nameOf(data)}.`);
        } catch (error) {
          this.#notice(`Could not import the character. ${error.message}`, true);
        }
      });

      const menu = this.#get(".more");
      menu.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !menu.open) return;
        menu.open = false;
        menu.querySelector("summary").focus();
      });
      this.#get("[data-export]").addEventListener("click", () => {
        download(this.#data);
        menu.open = false;
        this.#notice("Character JSON exported.");
        menu.querySelector("summary").focus();
      });
      this.#get("[data-print]").addEventListener("click", () => {
        menu.open = false;
        menu.querySelector("summary").focus();
        this.#renderRecord();
        window.print();
      });
      this.#get("[data-duplicate]").addEventListener("click", () => {
        menu.open = false;
        const data = this.character;
        data.charName = `${nameOf(data)} (copy)`;
        this.#insert(data, "Character duplicated.");
      });
      this.#get("[data-delete]").addEventListener("click", () => {
        menu.open = false;
        menu.querySelector("summary").focus();
        if (!window.confirm(`Delete ${nameOf(this.#data)} from this sheet?`)) return;
        const id = this.#roster.activeId;
        this.#roster.characters = this.#roster.characters.filter(entry => entry.id !== id);
        this.#removed.add(id);
        this.#dirty.delete(id);
        if (this.#roster.characters.length) {
          this.#select(this.#roster.characters[0].id);
          this.#notice("Character deleted.");
        } else {
          this.#insert(blankCharacter(), "Character deleted.");
        }
      });

      const check = this.#get("[data-check]");
      check.addEventListener("input", () => this.#updateFormula());
      check.addEventListener("submit", event => {
        event.preventDefault();
        this.#roll();
      });
      this.#get("[data-quick-check]").addEventListener("click", () => check.elements.stat.focus());
    }

    #select(id) {
      if (!this.#roster.characters.some(entry => entry.id === id)) return;
      this.#roster.activeId = id;
      this.#tab = "overview";
      this.#notice("");
      this.#save();
      this.#resetRoller();
      this.#render();
      this.#emitChange();
    }

    #insert(data, message) {
      const id = uid();
      this.#roster.characters.push({ id, data });
      this.#dirty.add(id);
      this.#select(id);
      this.#notice(message);
      this.#get('#panel-overview [name="charName"]').focus();
    }

    #save() {
      if (!this.#storageKey || this.hasAttribute("readonly")) return;
      try {
        // Merge changes to the active record with any other records saved in a second tab.
        const stored = readRoster(this.#storageKey);
        const entries = new Map((stored?.characters ?? []).map(entry => [entry.id, entry]));
        for (const entry of this.#roster.characters) {
          if (this.#dirty.has(entry.id)) entries.set(entry.id, entry);
        }
        for (const id of this.#removed) entries.delete(id);
        if (!entries.has(this.#active.id)) entries.set(this.#active.id, this.#active);
        const roster = { version: 1, activeId: this.#active.id, characters: [...entries.values()] };
        localStorage.setItem(this.#storageKey, JSON.stringify(roster));
        this.#roster = roster;
        this.#dirty.clear();
        this.#removed.clear();
        this.#storageProblem = false;
      } catch {
        this.#storageProblem = true;
      }
      this.#storageStatus();
    }

    #storageStatus() {
      this.#get("[data-storage-status]").textContent = this.#storageProblem
        ? "Browser storage unavailable. Export JSON to keep your work."
        : this.#storageKey ? "Autosaves in this browser" : "Session only";
    }

    #notice(message, error = false) {
      const notice = this.#get("[data-notice]");
      notice.textContent = message;
      notice.hidden = !message;
      notice.classList.toggle("error", error);
    }

    #emitChange() {
      this.dispatchEvent(new CustomEvent("traveller-change", {
        bubbles: true, composed: true, detail: { character: this.character },
      }));
    }

    #changed(updatePicker = false) {
      this.#dirty.add(this.#active.id);
      this.#save();
      this.#notice("");
      if (updatePicker) this.#picker();
      this.#refresh();
      this.#emitChange();
    }

    #picker() {
      const select = this.#get("[data-picker]");
      options(select, this.#roster.characters.map(entry => [entry.id, nameOf(entry.data)]));
      select.value = this.#roster.activeId;
    }

    #render() {
      this.#storageStatus();
      if (this.hasAttribute("readonly")) {
        this.#renderRecord();
        return;
      }
      this.#picker();
      this.#showTab(this.#tab);
    }

    #showTab(key) {
      if (this.#tab !== key) this.#get("#panel-" + this.#tab).replaceChildren();
      this.#tab = key;
      for (const [id] of tabs) {
        const tab = this.#get("#tab-" + id);
        tab.setAttribute("aria-selected", String(id === key));
        tab.tabIndex = id === key ? 0 : -1;
        this.#get("#panel-" + id).hidden = id !== key;
      }

      const panel = this.#get("#panel-" + key);
      panel.replaceChildren();
      switch (key) {
        case "overview":
          panel.append(this.#statsCard("Characteristics", core), this.#statsCard("Additional characteristics", optional),
            this.#fieldsCard("Personal details", profile));
          break;
        case "skills":
          panel.append(this.#collectionCard("skills"), this.#collectionCard("trainingSkills"), this.#collectionCard("psionics"));
          break;
        case "combat": {
          const status = this.#fieldsCard("Condition", condition);
          const initiative = action("Initiative check", () => {
            const bestAvailable = effectiveScore(this.#data.characteristics.dex) === null ? "int" : "dex";
            this.#prepareCheck(bestAvailable, "", 8);
          });
          initiative.title = "Select Dexterity or Intellect and use the Effect as initiative.";
          status.querySelector(".card-heading").append(initiative);
          panel.append(status, this.#collectionCard("weapons"), this.#collectionCard("armor"), this.#collectionCard("wounds"));
          break;
        }
        case "inventory":
          panel.append(this.#collectionCard("equipment"), this.#collectionCard("augments"), this.#fieldsCard("Finances", finances));
          break;
        case "lifepath":
          panel.append(this.#collectionCard("careers"), this.#collectionCard("preCareerOptions"));
          break;
        case "notes":
          panel.append(this.#fieldsCard("Journal", notes), this.#collectionCard("relationships"));
          break;
      }
      this.#refresh();
    }

    #fieldsCard(title, definitions) {
      const section = card(title);
      const grid = element("div", "field-grid");
      for (const definition of definitions) {
        const [key] = definition;
        grid.append(field(definition, this.#data[key], value => {
          this.#data[key] = value;
          this.#changed(key === "charName");
        }));
      }
      section.append(grid);
      return section;
    }

    #stat(key) {
      const title = characteristics[key];
      const stat = this.#data.characteristics[key];
      const tile = element("div", "stat");
      tile.dataset.stat = key;
      tile.setAttribute("role", "group");
      tile.setAttribute("aria-label", title);
      const top = element("div", "stat-top");
      const check = action("↗", () => this.#prepareCheck(key), "icon-button");
      check.setAttribute("aria-label", `Check ${title}`);
      check.title = `Check ${title}`;
      check.dataset.statCheck = "";
      top.append(element("span", "stat-code", key.toUpperCase()), addRuleReminder(tile, key, "edit"));
      const fields = element("div", "stat-scores");
      for (const [name, label] of [["current", "Current"], ["baseline", "Base"]]) {
        const score = field([name, label, "integer"], stat?.[name], value => {
          this.#data.characteristics[key] ??= {};
          this.#data.characteristics[key][name] = value;
          this.#changed();
        }, `${title} ${name}`);
        const input = score.querySelector("input");
        input.id = `sheet-${key}-${name}`;
        if (key === "wlt") {
          input.min = "0";
          input.max = "15";
        }
        fields.append(score);
      }
      const dm = element("div", "dm");
      const value = element("output", "current");
      value.dataset.dm = "";
      dm.append(element("span", "", "DM"), value, check);
      tile.append(top, element("div", "stat-title", title), fields, dm);
      if (key === "wlt") {
        const cash = element("output", "wealth-cash");
        cash.dataset.cash = "";
        cash.setAttribute("aria-label", "Obtainable cash");
        tile.append(cash);
      }
      return tile;
    }

    #statsCard(title, definitions) {
      const section = card(title);
      const stats = element("div", definitions === optional ? "stat-grid additional" : "stat-grid");
      stats.append(...Object.keys(definitions).map(key => this.#stat(key)));
      section.append(stats);
      return section;
    }

    #collectionCard(key) {
      const config = collections[key];
      const section = card(config.title, "collection");
      const list = element("div", "entries");
      const rows = this.#data[key] ?? [];
      const paint = () => {
        if (!rows.length) {
          list.replaceChildren(element("p", "empty", key === "skills" ?
            "Add a skill to use it in the dice roller." : "No entries yet."));
          return;
        }
        list.replaceChildren(...rows.map((row, index) => this.#entry(key, row, () => {
          const label = string(row[config.fields[0][0]]).trim();
          if (label && !window.confirm(`Remove ${label}?`)) return;
          rows.splice(index, 1);
          if (key === "skills") this.#get("[data-check]").elements.skill.value = "";
          paint();
          this.#changed();
          const next = list.children[Math.min(index, rows.length - 1)];
          (next?.querySelector("input, select") ?? add).focus();
        })));
      };
      const add = action("Add " + config.item, () => {
        this.#data[key] = rows;
        const row = {};
        if (config.gear) row.state = { quantity: "1", carried: true, equipped: false, notes: "" };
        if (key === "skills") row.level = "0";
        rows.push(row);
        paint();
        this.#changed();
        list.lastElementChild.querySelector("input, select").focus();
      });
      const heading = section.querySelector(".card-heading");
      if (key === "equipment") {
        const mass = element("p", "mass");
        mass.dataset.mass = "";
        heading.firstChild.after(mass);
      }
      heading.append(add);
      section.append(list);
      paint();
      return section;
    }

    #entry(key, row, remove) {
      const { fields, gear, item } = collections[key];
      const entry = element("div", `entry ${key}`);
      const grid = element("div", "field-grid");
      const check = key === "skills" ? action("Check skill", () => {
        this.#prepareCheck("", String(this.#data.skills.indexOf(row)));
      }) : null;
      const syncCheck = () => {
        if (!check) return;
        check.disabled = !string(row.name).trim() || jackOfAllTrades(row);
      };
      const make = (definition, data) => field(definition, data[definition[0]], value => {
        data[definition[0]] = value;
        syncCheck();
        this.#changed();
      });
      grid.append(...fields.map(definition => make(definition, row)));
      if (gear) {
        grid.append(...gearFields.map(definition => make(definition, row.state)));
      }
      const actions = element("div", "entry-actions");
      if (check) {
        syncCheck();
        actions.append(check);
      }
      const button = action("Remove", remove, "text-button");
      button.setAttribute("aria-label", "Remove " + item);
      actions.append(button);
      entry.append(grid, actions);
      if (gear) {
        const detail = element("details", "entry-detail");
        const more = element("div", "field-grid");
        more.append(...gearDetails.map(definition => make(definition, row.state)));
        more.append(make(["catalogueId", "Catalog reference", "text", "full"], row));
        detail.append(element("summary", "", "Item details"), more);
        entry.append(detail);
      }
      return entry;
    }

    #refresh() {
      const record = this.#data;
      this.#get("[data-name]").textContent = nameOf(record);
      this.#get("[data-upp]").textContent = uppOf(record);
      const identity = this.#get("[data-identity]");
      identity.textContent = [record.role, record.species, record.homeworld].filter(value => string(value).trim()).join(" · ");
      identity.hidden = !identity.textContent;

      for (const card of this.#root.querySelectorAll("[data-stat]")) {
        const stat = record.characteristics[card.dataset.stat];
        const now = effectiveScore(stat);
        const base = integer(stat?.baseline);
        const dm = modifier(now);
        const baselineDM = modifier(base);
        card.querySelector('input[name="current"]').placeholder = base === null ? "—" : String(base);
        card.querySelector('input[name="baseline"]').placeholder = "—";
        const output = card.querySelector("[data-dm]");
        output.textContent = dm === null ? "—" : signed(dm);
        output.title = baselineDM === null ? "" : "Baseline DM " + signed(baselineDM);
        const cash = card.querySelector("[data-cash]");
        if (cash) {
          cash.textContent = cashAt(now);
          cash.hidden = !cash.textContent;
        }
        card.querySelector("[data-stat-check]").disabled = dm === null;
        card.classList.toggle("reduced", now !== null && base !== null && now < base);
      }
      const mass = this.#get("[data-mass]");
      if (mass) {
        const { total, unknown } = carriedMass(record);
        mass.textContent = `${numberFormat.format(total)} kg carried${unknown ? ` · ${unknown} unknown` : ""}`;
        mass.title = "Total mass from carried equipment, weapons and armour with a known mass.";
      }
      this.#syncRoller();
    }

    #syncRoller() {
      const form = this.#get("[data-check]");
      const record = this.#data;
      const scores = Object.entries(characteristics).flatMap(([key, label]) => {
        const score = effectiveScore(record.characteristics[key]);
        return score === null ? [] : [[key, `${label} (${signed(modifier(score))})`]];
      });
      options(form.elements.stat, [["", "None"], ...scores]);
      const skills = (record.skills ?? []).flatMap((skill, index) => {
        if (!string(skill.name).trim() || jackOfAllTrades(skill)) return [];
        const level = integer(skill.level);
        return [[String(index), `${skillName(skill)} · ${level ?? "untrained"}`]];
      });
      options(form.elements.skill, [["", "None"], ["untrained", "Untrained"], ...skills]);
      this.#updateFormula();
    }

    #check() {
      const { stat, skill, mode, modifier: extra, target } = this.#get("[data-check]").elements;
      const skills = this.#data.skills ?? [];
      const chosen = skill.value === "" ? null : skills[skill.value];
      const scoreDM = modifier(effectiveScore(this.#data.characteristics[stat.value])) ?? 0;
      let skillDM = 0;
      if (skill.value) {
        const levels = skills.filter(jackOfAllTrades).map(entry => integer(entry.level) ?? 0);
        const untrained = -3 + Math.min(3, Math.max(0, ...levels));
        skillDM = (integer(chosen?.level) ?? untrained) + (integer(chosen?.modifier) ?? 0);
      }
      return {
        label: [chosen ? skillName(chosen) : skill.value === "untrained" ? "Untrained" : "", characteristics[stat.value]]
          .filter(Boolean).join(" + ") || "Check",
        mode: mode.value, target: integer(target.value), characteristicDM: scoreDM, skillDM,
        situationalDM: integer(extra.value) ?? 0,
      };
    }

    #updateFormula() {
      const { mode, target, characteristicDM, skillDM, situationalDM } = this.#check();
      const dm = characteristicDM + skillDM + situationalDM;
      this.#get("[data-formula]").textContent = `${mode === "normal" ? "2D" : mode === "boon" ? "3D keep highest 2" : "3D keep lowest 2"} ${signed(dm)}${target === null ? "" : ` vs ${target}+`}`;
    }

    #prepareCheck(stat = "", skill = "", target) {
      const form = this.#get("[data-check]");
      form.elements.stat.value = stat;
      form.elements.skill.value = skill;
      if (target !== undefined) form.elements.target.value = target;
      this.#updateFormula();
      form.querySelector('[type="submit"]').focus();
    }

    #roll() {
      const check = this.#check();
      const { mode, target, characteristicDM, skillDM, situationalDM } = check;
      const dice = Array.from({ length: mode === "normal" ? 2 : 3 }, () => 1 + Math.floor(Math.random() * 6));
      const discarded = mode === "normal" ? -1 : dice.indexOf(mode === "boon" ? Math.min(...dice) : Math.max(...dice));
      const subtotal = dice.reduce((sum, die, index) => sum + (index === discarded ? 0 : die), 0);
      const dm = characteristicDM + skillDM + situationalDM;
      const total = subtotal + dm;
      const effect = target === null ? null : total - target;
      const outcome = effect === null ? "" : effect >= 0 ? "Success" : "Failure";
      const result = this.#get("[data-result]");
      const diceRow = element("div", "dice");
      diceRow.append(...dice.map((die, index) => {
        const face = element("span", index === discarded ? "discarded" : "", String(die));
        if (index === discarded) face.setAttribute("aria-label", `${die}, discarded`);
        return face;
      }));
      const summary = effect === null ? `${total} total` : `${total} · ${outcome} · Effect ${signed(effect)}`;
      const breakdown = `Dice ${subtotal} · characteristic ${signed(characteristicDM)} · skill ${signed(skillDM)} · situational ${signed(situationalDM)}`;
      result.replaceChildren(element("strong", "result-title", check.label), diceRow,
        element("strong", "result-total", summary), element("p", "breakdown", breakdown));
      result.hidden = false;
      result.dataset.outcome = outcome.toLowerCase();
      result.scrollIntoView({ block: "nearest" });
      this.#rolls.unshift(`${check.label} · ${summary}`);
      this.#rolls = this.#rolls.slice(0, 8);
      const log = this.#get("[data-log]");
      log.hidden = false;
      log.querySelector("ol").replaceChildren(...this.#rolls.map(roll => element("li", "", roll)));
      this.dispatchEvent(new CustomEvent("traveller-roll", {
        bubbles: true, composed: true, detail: { ...check, dice, discarded, subtotal, dm, total, effect },
      }));
    }

    #resetRoller() {
      const check = this.#get("[data-check]");
      check.reset();
      check.elements.stat.value = "";
      check.elements.skill.value = "";
      const result = this.#get("[data-result]");
      result.hidden = true;
      result.replaceChildren();
      this.#get("[data-log]").hidden = true;
      this.#get("[data-log]").open = false;
      this.#rolls = [];
    }

    #renderRecord() {
      const data = this.#data;
      const record = this.#get(".record");
      const header = element("header", "record-header");
      header.append(element("p", "edition", "Mongoose Traveller 2e"),
        element("h1", "", nameOf(data)), element("p", "", "UPP " + uppOf(data)));

      record.replaceChildren(header);
      for (const [title, definitions] of [["Characteristics", core], ["Additional characteristics", optional]]) {
        const stats = card(title);
        const scores = element("div", "record-scores");
        for (const [key, label] of Object.entries(definitions)) {
          const stat = data.characteristics[key];
          const current = effectiveScore(stat);
          const dm = modifier(current);
          const score = element("div", "read-stat");
          const heading = element("div", "stat-top");
          heading.append(element("strong", "", label), addRuleReminder(score, key, "record"));
          score.append(heading, element("span", "",
            `${current ?? "—"} / ${integer(stat?.baseline) ?? "—"} · DM ${dm === null ? "—" : signed(dm)}`));
          if (key === "wlt" && cashAt(current)) score.append(element("span", "", cashAt(current)));
          scores.append(score);
        }
        stats.append(element("p", "muted", "Current / base"), scores);
        record.append(stats);
      }

      const metadata = (title, rows) => {
        const section = card(title);
        const values = readout(rows, data);
        if (!values.childElementCount) return;
        section.append(values);
        record.append(section);
      };
      metadata("Personal details", profile.filter(([key]) => key !== "charName"));
      metadata("Condition", condition);
      for (const [key, { title, fields, gear }] of Object.entries(collections)) {
        if (!data[key]?.length) continue;
        const section = card(title);
        const entries = element("div", "read-entries");
        for (const entry of data[key]) {
          const row = element("div", "read-entry");
          const fieldsList = readout(fields, entry);
          if (!fieldsList.childElementCount) continue;
          row.append(fieldsList);
          if (gear) {
            row.append(readout([...gearFields, ...gearDetails], entry.state));
            if (entry.catalogueId) row.append(readout([["catalogueId", "Catalog reference"]], entry));
          }
          entries.append(row);
        }
        if (entries.childElementCount) {
          section.append(entries);
          record.append(section);
        }
      }
      metadata("Finances", finances);
      metadata("Journal", notes);
    }
  }

  const styles = `
    :host {
      --ink: var(--traveller-ink, #333);
      --muted: var(--traveller-muted, #595959);
      --surface: var(--traveller-surface, #fff);
      --page: var(--traveller-background, #f0f0f0);
      --soft: var(--traveller-inset, #f5f5f5);
      --line: var(--traveller-border, #ddd);
      --accent: var(--traveller-accent, #b00);
      --signal: var(--traveller-signal, var(--accent));
      --accent-text: var(--traveller-accent-text, #fff);
      --mast: var(--traveller-masthead, #111);
      --mast-ink: var(--traveller-masthead-text, #fff);
      --radius: var(--traveller-radius, 3px);
      --title-font: var(--traveller-title, "Marcellus", Georgia, serif);
      --heading-font: var(--traveller-heading, "Arsenal", "Arial Narrow", Arial, sans-serif);
      --ui-font: var(--traveller-ui, "Roboto", Arial, sans-serif);
      --mono: var(--traveller-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace);
      --alert: var(--traveller-alert, #8b0000);
      display: block;
      min-inline-size: 0;
      container-type: inline-size;
      color: var(--ink);
      font: 400 15px/1.45 var(--traveller-font, "Arimo", Arial, sans-serif);
      color-scheme: var(--traveller-color-scheme, light);
      text-align: start;
    }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    h1, h2, p, dl, dd { margin: 0; }
    h2 { font: 700 1.16rem/1.25 var(--heading-font); letter-spacing: .035em; }
    button, input, select, textarea { font: inherit; }
    button, summary { font-family: var(--ui-font); }
    button, summary, input[type="checkbox"], select { cursor: pointer; }
    button, select, input:not([type="radio"], [type="checkbox"], [type="file"]), textarea {
      min-inline-size: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      color: var(--ink);
    }
    button, summary { touch-action: manipulation; }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-block-size: 36px;
      padding: .45rem .75rem;
      font-size: .83rem;
      font-weight: 650;
      line-height: 1.2;
    }
    button:hover, .more > summary:hover { background: var(--soft); border-color: var(--accent); }
    button:disabled { opacity: .45; cursor: default; }
    :focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
    input, select, textarea { accent-color: var(--accent); }
    input:not([type="radio"], [type="checkbox"], [type="file"]), select, textarea {
      display: block;
      width: 100%;
      padding: .45rem .55rem;
      min-block-size: 38px;
      background: var(--soft);
    }
    input[type="number"] { appearance: textfield; font-variant-numeric: tabular-nums; }
    input::-webkit-inner-spin-button { appearance: none; }
    input::placeholder, textarea::placeholder { color: var(--muted); opacity: 1; }
    textarea { resize: vertical; min-block-size: 64px; }
    .primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
    .primary:hover { background: color-mix(in srgb, var(--accent) 87%, black); }
    .sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .screen {
      border: 1px solid var(--line);
      border-radius: calc(var(--radius) + 4px);
      background: var(--page);
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: .7rem 1.3rem;
      padding: .8rem 1.15rem;
      border-radius: calc(var(--radius) + 3px) calc(var(--radius) + 3px) 0 0;
      background: var(--surface);
    }
    .product { display: flex; align-items: center; gap: .65rem; }
    .product strong { display: block; font: 400 1.15rem/1.15 var(--title-font); }
    .edition { font: 650 .68rem/1.45 var(--mono); letter-spacing: .07em; text-transform: uppercase; }
    .product .edition { display: block; margin-top: .18rem; color: var(--muted); }
    .mark {
      display: grid;
      place-items: center;
      width: 2.2rem;
      aspect-ratio: 1;
      border-radius: 8px;
      background: var(--mast);
      color: var(--mast-ink);
      font-size: 1.15rem;
    }
    .tools { display: flex; align-items: center; flex-wrap: wrap; gap: .45rem; }
    .picker { width: clamp(8.4rem, 19cqw, 13rem); }
    .picker select { font-size: .84rem; }
    .more { position: relative; }
    .more > summary {
      display: flex;
      align-items: center;
      gap: .4rem;
      min-block-size: 36px;
      padding: .45rem .65rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      font-size: .83rem;
      font-weight: 650;
      list-style: none;
    }
    .more > summary::-webkit-details-marker { display: none; }
    .menu {
      position: absolute;
      z-index: 4;
      inset: calc(100% + .35rem) 0 auto auto;
      min-inline-size: 11.5rem;
      display: grid;
      gap: .15rem;
      padding: .35rem;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--surface);
      box-shadow: 0 .5rem 1.6rem #1112;
    }
    .menu button { justify-content: flex-start; border-color: transparent; }
    .menu .danger { color: var(--alert); }
    .masthead {
      position: relative;
      overflow: hidden;
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 1rem;
      padding: clamp(1.2rem, 3.4cqw, 2.5rem);
      border-block-end: 4px solid var(--accent);
      background-color: var(--mast);
      background-image: var(--traveller-masthead-image, none);
      background-position: center;
      background-size: cover;
      color: var(--mast-ink);
    }
    .identity { min-inline-size: 0; }
    .masthead .edition { opacity: .78; letter-spacing: .11em; }
    .masthead h1 {
      margin-block: .28rem;
      font: 400 clamp(2.1rem, 4.8cqw, 3.65rem)/1.1 var(--title-font);
      letter-spacing: .025em;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .identity-details { margin-top: .5rem; font-size: .94rem; overflow-wrap: anywhere; }
    .profile-code {
      min-inline-size: 8.7rem;
      max-inline-size: 36%;
      padding: .6rem .8rem .65rem;
      border: 1px solid #fff6;
      border-radius: var(--radius);
      background: #fff1;
      font: .72rem/1.4 var(--mono);
    }
    .profile-code strong { display: block; font-size: 1.3rem; letter-spacing: .12em; overflow-wrap: anywhere; }
    .notice {
      padding: .6rem 1.15rem;
      border-block-end: 1px solid var(--line);
      background: var(--surface);
      color: var(--signal);
      overflow-wrap: anywhere;
    }
    .notice.error { color: var(--alert); }
    .navigation {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .4rem;
      padding-inline: 1.1rem;
      background: var(--surface);
      border-block-end: 1px solid var(--line);
    }
    .tabs { display: flex; flex-wrap: wrap; gap: .15rem; }
    .tabs button {
      min-block-size: 46px;
      padding: .62rem .85rem;
      border: 0;
      border-radius: 0;
      border-block-end: 3px solid transparent;
      background: transparent;
      color: var(--muted);
      font-size: .86rem;
    }
    .tabs button[aria-selected="true"] { border-color: var(--accent); color: var(--signal); }
    .tabs button:hover { background: var(--soft); }
    .mobile-roll { display: none; }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(15.8rem, 23%);
      align-items: start;
      gap: .95rem;
      padding: .95rem;
    }
    .panels { min-inline-size: 0; }
    .panel { display: grid; gap: .95rem; }
    .card {
      min-inline-size: 0;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .card-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .46rem .7rem;
      flex-wrap: wrap;
      margin-block-end: .8rem;
    }
    .card-heading h2 { border-inline-start: 3px solid var(--accent); padding-inline-start: .5rem; }
    .field-grid, .readout { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: .8rem .65rem; }
    .field, .readout > div { display: grid; align-content: start; gap: .28rem; min-inline-size: 0; }
    .field-grid > .field, .readout > div { grid-column: span 4; }
    .field.short { grid-column: span 2; }
    .field.wide { grid-column: span 6; }
    .field.full, .readout > .full { grid-column: 1 / -1; }
    .field-label, dt { color: var(--muted); font-size: .76rem; font-weight: 630; line-height: 1.35; }
    .field.check-field { display: flex; align-items: end; gap: .4rem; padding-block-end: .65rem; }
    .check-field input { margin: 0; width: 1.02rem; height: 1.02rem; }
    .stat-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: .55rem; }
    .stat-grid.additional { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .stat {
      position: relative;
      min-inline-size: 0;
      padding: .63rem .55rem .55rem;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--soft);
    }
    .stat.reduced { border-color: color-mix(in srgb, var(--alert) 54%, var(--line)); }
    .stat-top { display: flex; justify-content: space-between; align-items: center; gap: .25rem; }
    .stat-code { font: 700 .96rem/1 var(--heading-font); letter-spacing: .065em; color: var(--signal); }
    .stat-title { margin-block: .15rem .48rem; color: var(--ink); font: 700 .85rem/1.15 var(--heading-font); }
    .icon-button { min-block-size: 29px; min-inline-size: 28px; padding: .1rem .3rem; font-size: .96rem; }
    .rule-trigger { color: var(--signal); }
    .rule-tip {
      position: fixed;
      inset: auto;
      z-index: 10;
      margin: 0;
      inline-size: min(20rem, calc(100vw - 1rem));
      padding: .75rem .9rem;
      border: 1px solid var(--line);
      border-inline-start: 4px solid var(--accent);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 .5rem 1.5rem #1113;
      font-size: .88rem;
    }
    .rule-tip:not([popover]) { position: absolute; inset: calc(100% + 6px) auto auto 0; }
    .rule-tip strong { font: 700 1.08rem/1.2 var(--heading-font); }
    .rule-tip p { margin-block: .3rem .5rem; }
    .rule-tip small { color: var(--muted); font-size: .73rem; }
    .stat-scores { display: grid; grid-template-columns: 1fr 1fr; gap: .32rem; }
    .stat-scores .field-label { font-size: .65rem; }
    .stat-scores input[name] {
      background: var(--surface);
      text-align: center;
      font: 700 1rem/1 var(--ui-font);
      padding: .3rem .05rem;
    }
    .dm {
      display: flex;
      align-items: center;
      gap: .42rem;
      min-block-size: 24px;
      margin-top: .46rem;
      font: 700 .72rem/1.25 var(--mono);
      color: var(--muted);
    }
    .dm output {
      border-radius: 4px;
      padding: .18rem .36rem;
      background: color-mix(in srgb, var(--accent) 10%, var(--surface));
      color: var(--signal);
    }
    .dm .icon-button { margin-inline-start: auto; }
    .reduced .dm output { color: var(--alert); }
    .wealth-cash { display: block; margin-block-start: .35rem; color: var(--muted); font: .72rem/1.25 var(--mono); }
    summary { color: var(--muted); font-weight: 630; font-size: .83rem; }
    .empty { color: var(--muted); font-size: .9rem; padding-block: .25rem .45rem; }
    .entries { display: grid; gap: .65rem; }
    .entry {
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: .65rem;
    }
    .entry input:not([type="checkbox"]), .entry select, .entry textarea { background: var(--surface); }
    .entry-actions { display: flex; justify-content: flex-end; gap: .35rem; margin-top: .55rem; }
    .text-button { border-color: transparent; background: transparent; color: var(--muted); }
    .entry-detail { margin-block-start: .5rem; }
    .entry-detail .field-grid { margin-top: .55rem; }
    .entry.skills {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      gap: .6rem;
    }
    .entry.skills .field-grid { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) 4rem 5rem; }
    .entry.trainingSkills .field-grid { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) 5rem 6rem; }
    .entry.skills .field, .entry.trainingSkills .field { grid-column: auto; }
    .entry.skills .entry-actions { margin: 0; }
    .mass { color: var(--signal); font: 650 .75rem/1.4 var(--mono); margin-inline-end: auto; }
    .roller { position: sticky; top: .6rem; padding: .9rem; }
    .dice-mark { color: var(--signal); font-size: 1.35rem; line-height: 1; }
    .roller form { display: grid; gap: .72rem; }
    .roll-inputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
    .roll-inputs .field { grid-column: auto; }
    .modes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: .2rem;
      margin: 0;
      padding: .22rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--soft);
    }
    .modes label { display: grid; position: relative; text-align: center; }
    .modes input { position: absolute; inline-size: 100%; block-size: 100%; opacity: 0; margin: 0; cursor: pointer; }
    .modes span { padding: .38rem .2rem; border-radius: 5px; font-size: .78rem; font-weight: 650; }
    .modes input:checked + span { background: var(--surface); color: var(--signal); box-shadow: 0 1px 4px #1112; }
    .modes input:focus-visible + span { outline: 2px solid var(--signal); outline-offset: 0; }
    .formula { color: var(--muted); font: .72rem/1.4 var(--mono); overflow-wrap: anywhere; }
    .roll { inline-size: 100%; min-block-size: 42px; }
    .result {
      display: grid;
      gap: .5rem;
      margin-block-start: .78rem;
      padding: .7rem;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--soft);
      overflow-wrap: anywhere;
    }
    .result[data-outcome="success"] .result-total { color: var(--signal); }
    .result[data-outcome="failure"] .result-total { color: var(--alert); }
    .result-title { font-size: .88rem; }
    .result-total { font-weight: 700; }
    .breakdown { color: var(--muted); font-size: .75rem; }
    .dice { display: flex; gap: .35rem; }
    .dice span {
      display: grid;
      place-items: center;
      min-width: 2.1rem;
      aspect-ratio: 1;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      font: 650 1.05rem/1 var(--mono);
    }
    .dice .discarded { color: var(--muted); text-decoration: line-through; background: var(--soft); }
    .roll-log { margin-block-start: .75rem; }
    .roll-log ol { margin: .45rem 0 0; padding-inline-start: 1.35rem; font-size: .78rem; overflow-wrap: anywhere; }
    .roll-log li + li { margin-block-start: .25rem; }
    .footer {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0 .55rem;
      padding: 0 1rem .75rem;
      color: var(--muted);
      font-size: .73rem;
    }
    .record { display: none; }
    :host([embedded]) :is(.toolbar, .footer) { display: none; }
    :host([readonly]) .screen { display: none; }
    :host([readonly]) .record { display: grid; gap: .8rem; }
    .record-header {
      padding: 1.1rem 1.3rem;
      border-radius: var(--radius);
      background: var(--mast);
      color: var(--mast-ink);
      overflow-wrap: anywhere;
    }
    .record-header h1 { font: 400 clamp(1.6rem, 4cqw, 3rem)/1.15 var(--title-font); }
    .record-scores, .read-entries { display: grid; gap: .55rem; }
    .record-scores { grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); }
    .record-scores > div, .read-entry { padding: .55rem; border: 1px solid var(--line); border-radius: 8px; }
    .read-stat { position: relative; }
    .record-scores span { display: block; font: .8rem/1.4 var(--mono); }
    .muted { color: var(--muted); font-size: .78rem; margin-block-end: .4rem; }
    .readout + .readout { margin-block-start: .65rem; }
    .readout dd { white-space: pre-wrap; overflow-wrap: anywhere; }
    @container (max-width: 1000px) {
      .stat-grid, .stat-grid.additional { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .entry.skills { grid-template-columns: minmax(0, 1fr); }
    }
    @container (max-width: 780px) {
      .workspace { grid-template-columns: minmax(0, 1fr); }
      .navigation { padding-inline: .65rem; }
      .mobile-roll { display: inline-flex; }
      .roller { position: static; }
    }
    @container (max-width: 530px) {
      .toolbar { padding: .65rem; }
      .tools { width: 100%; }
      .picker { width: 100%; }
      .masthead { padding: 1.1rem .8rem; flex-wrap: wrap; }
      .profile-code { display: flex; align-items: center; gap: .45rem; min-inline-size: 0; max-inline-size: 100%; padding: .35rem .52rem; }
      .profile-code strong { font-size: .96rem; }
      .navigation { display: grid; grid-template-columns: minmax(0, 1fr) auto; padding: .23rem .6rem; }
      .tabs button { padding-inline: .57rem; min-block-size: 38px; }
      .mobile-roll { align-self: end; margin-block-end: .25rem; }
      .workspace { padding: .55rem; }
      .card { padding: .68rem; }
      .field-grid > .field, .readout > div { grid-column: span 6; }
      .field.full, .readout > .full { grid-column: 1 / -1; }
      .entry.skills .field-grid, .entry.trainingSkills .field-grid { grid-template-columns: 1fr 1fr; }
      .stat-title { min-block-size: 2.3em; }
      .roll-inputs .field { grid-column: auto; }
      .field input:not([type="checkbox"]), .field select, .field textarea { font-size: 16px; }
      .more .menu { inset-inline: auto 0; }
    }
    @container (max-width: 340px) {
      .navigation { grid-template-columns: minmax(0, 1fr); }
      .mobile-roll { justify-self: start; }
      .stat-grid, .stat-grid.additional { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .field-grid { grid-template-columns: 1fr; }
      .field-grid .field { grid-column: 1 / -1; }
    }
    @media print {
      :host {
        --ink: #171717;
        --surface: #fff;
        --muted: #444;
        --line: #a9a9a9;
        container-type: normal;
        font-size: 10pt;
      }
      .screen { display: none !important; }
      .record { display: block !important; }
      .rule-trigger, .rule-tip { display: none !important; }
      .record-header { border-block-end: 1px solid #777; border-radius: 0; background: #fff; color: #171717; padding: 0 0 .4rem; }
      .record-header h1 { font-size: 22pt; }
      .record .card { padding: .5rem 0; border: 0; border-radius: 0; }
      .record .card-heading { margin-bottom: .3rem; break-after: avoid; }
      .record .card-heading h2 { border: 0; padding: 0; }
      .record-scores, .read-entry, .readout > div { break-inside: avoid; }
      .record-scores { gap: .2rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .read-entries { display: block; }
      .read-entry + .read-entry { margin-top: .3rem; }
    }
  `;

  customElements.define("traveller-sheet", TravellerSheet);
})();
