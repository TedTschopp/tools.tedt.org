# Traveller Character Sheet

An independent web component for player characters in Mongoose Traveller 2nd Edition. The default layout includes the core and optional characteristics, skills and study, weapons and armour, inventory and finances, careers, and a journal. The dice roller uses current characteristic DMs, skill levels, situational DMs, and Normal, Boon, or Bane rolls. Difficulty is optional. When it is set, the result shows success or failure and Effect.

Open **index.html** in a browser from a checkout of this repository to try the example character, Iona Voss. Switch between **Full sheet**, **Sidebar**, and **Inline** to see the same character in each layout. The full sheet has **New character** for a blank record and **More** for JSON export, print, duplicate, and delete.

The Overview shows every characteristic, including optional and species-specific scores. Unset scores stay blank. Hover over a characteristic or focus or tap its **?** button for a short reminder of when to use it. An entered Wealth Level shows obtainable cash.

## Embed a blank sheet

Copy the [shared traveller-sheet.js source](../../tool-src/assets/traveller-sheet.js) into your site and add the following to the page. The component needs one script and has no runtime dependencies.

```html
<script src="/assets/traveller-sheet.js" defer></script>
<traveller-sheet storage-key="my-campaign"></traveller-sheet>
```

The example loads the same component source that the Traveller NPC Generator bundles.

Choose a unique `storage-key` for each roster on your site. The component autosaves to the current browser and site. Multiple pages on that site can use the same key to open the same roster. Omit the attribute to keep edits in memory for the current session. Use **Export JSON** and **Import JSON** to move a character to a different site or browser.

The print layout lists the character’s recorded fields across all sections. On an embedded page, the browser prints the surrounding page as well, according to the host site’s print stylesheet.

## Embed a published character

Place a character JSON object inside the element. Adding `readonly` displays it as a character record. For an editable sheet, omit `readonly`. If that sheet has a storage key and an existing saved roster, the saved roster takes precedence over the embedded example.

```html
<traveller-sheet readonly>
  <script type="application/json">
    {
      "charName": "Iona Voss",
      "species": "Human",
      "role": "Survey pilot",
      "characteristics": {
        "str": {"baseline": 7},
        "dex": {"baseline": 10},
        "end": {"baseline": 8, "current": 6},
        "int": {"baseline": 9},
        "edu": {"baseline": 8},
        "soc": {"baseline": 6}
      },
      "skills": [{"name": "Pilot", "specialization": "Spacecraft", "level": 2}]
    }
  </script>
</traveller-sheet>
```

Inline JSON is part of the page source. Include only the fields intended for readers, and escape `<` as `\u003c` when generating the script content from data.

## Display a character in an adventure or book

| Layout | Markup | Use |
| --- | --- | --- |
| Full sheet | `<traveller-sheet>` | The complete editor. Add `readonly` for a full record for readers. |
| Sidebar | `<traveller-sheet view="sidebar">` | A card with identity, UPP, recorded characteristics and their modifiers, skills, and rules reminders. |
| Inline | `<traveller-sheet view="inline">` | A stat line that wraps with the surrounding prose. It shows identity, UPP, changes to current scores, recorded additional scores, and skills. If there is no UPP, it lists the available scores. |

The compact layouts are read-only. Both use the same character object as the full sheet, and display only recorded scores. Supply it as embedded JSON or assign it to `.character` from your page.

```html
<aside aria-label="Character reference">
  <traveller-sheet id="contact-sidebar" view="sidebar"></traveller-sheet>
</aside>
<p>Contact <traveller-sheet id="contact-inline" view="inline"></traveller-sheet>.</p>
```

Choose the layout from JavaScript by assigning a variable to `.view`. Change it whenever you want to display the same record in another format.

```js
await customElements.whenDefined("traveller-sheet");
const sheet = document.querySelector("#contact-sidebar");
const displayMode = "sidebar"; // "full", "sidebar", or "inline"
const contact = { charName: "Sera Dain", role: "Station dispatcher" };

sheet.character = contact;
sheet.view = displayMode;
```

The `view` property and HTML attribute stay in sync. Use `"full"` to return to the editor.

## Load and listen from JavaScript

```js
await customElements.whenDefined("traveller-sheet");
const sheet = document.querySelector("traveller-sheet");

sheet.character = {
  charName: "Iona Voss",
  characteristics: { dex: { baseline: 10, current: 8 } },
};

sheet.addEventListener("traveller-change", event => {
  console.log(event.detail.character);
});

sheet.addEventListener("traveller-roll", event => {
  console.log(event.detail.total, event.detail.effect);
});
```

Reading `sheet.character` returns a copy of the active record. Assigning it replaces that record. The change event fires for edits, new characters, imports, and roster switches. For an editor that uses its host page’s save and cancel controls, add `embedded`. It hides the character library and lets the host own persistence.

The character format accepts individual TedT.org Traveller Character Sheet JSON exports. It keeps current and baseline scores, gear catalogue references and state, finances, notes, and the legacy draft data in the exported record. It also accepts character objects in the same field shape from other tools. The complete example in **index.html** shows the structure. A blank current score uses its baseline for checks. A skill with level 0 is trained. A blank level uses the untrained modifier, adjusted by any Jack of All Trades level. Carried mass totals the known weights and flags rows with unknown mass.

## Match your site

The default palette and fonts follow the TedT.org Traveller sheet. To load Marcellus, Arsenal, Arimo, and Roboto from your site, copy **traveller-sheet-fonts.css** with its **fonts/** directory and link the stylesheet in the page head. The demo includes these files. [TedT.org Traveller Character Sheet](https://tedt.org/RPG/Traveller/Character-Sheet.html)

Set CSS custom properties on the element or an ancestor. The controls use scoped styles.

```css
traveller-sheet {
  --traveller-font: "Inter", system-ui, sans-serif;
  --traveller-accent: #354c88;
  --traveller-masthead: #18233e;
  --traveller-masthead-image: none;
  --traveller-radius: 10px;
}
```

Additional theme properties include `--traveller-title` for the main title font, `--traveller-heading` for headings, `--traveller-ui` for controls, and `--traveller-signal` for accent-colored text. Background and foreground colors use `--traveller-ink`, `--traveller-muted`, `--traveller-surface`, `--traveller-background`, `--traveller-inset`, `--traveller-border`, `--traveller-accent-text`, and `--traveller-masthead-text`. You can also set `--traveller-mono` and `--traveller-color-scheme`.

## References

- [Official Roll20 sheet and release notes](https://github.com/Roll20/roll20-character-sheets/tree/master/Mongoose%20Traveller%202e%20Official)
- [Mongoose Traveller Core Rulebook Update 2022 preview](https://d1vzi28wh99zvq.cloudfront.net/pdf_previews/374454-sample.pdf)
- [Traveller Companion Update 2024](https://www.mongoosepublishing.com/products/traveller-companion-update-2024)
- [Aliens of Charted Space Vol. 1](https://www.mongoosepublishing.com/products/aliens-of-charted-space-vol-1)
- [Aliens of Charted Space Vol. 2](https://www.mongoosepublishing.com/products/aliens-of-charted-space-vol-2)
