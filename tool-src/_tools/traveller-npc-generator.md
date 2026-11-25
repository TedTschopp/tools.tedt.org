---
title: "Traveller NPC Generator"
summary: "Roll individual NPCs and group encounters for Mongoose Traveller 2E. Hire crew by specialty, meet a patron, or generate a group with a leader and specialists."
subtitle: "Reproducible NPCs, crews and encounters"
status: active
tool_type: webapp
date: 2026-11-24
last_modified: 2026-11-24
featured: false
legacy_redirect: false
tags: [rpg, traveller, npc, sci-fi, generator]
tech: [HTML, CSS, JavaScript]
links:
  live: "/tools/traveller-npc-generator.html"
hero_image: "/img/2026-11/traveller-npc-generator-hero.webp"
image-alt: "A mixed-species crew reviews a cargo manifest in an orbital freight hangar."
features:
  - "Choose Imperial starter profiles, options from the Traveller library, or a sourced referee-defined species"
  - "Set exact skill and characteristic minimums for professional or crew hiring"
  - "Roll 18 types of group encounters with a shared purpose, affiliation and reaction"
  - "Reproduce each NPC from its seed, lock values, and reroll fields independently"
  - "Track characteristics, training, careers, gear, finances, and notes on each NPC’s editable character sheet"
  - "Choose which Traveller 2E optional characteristics to generate for an NPC or group"
  - "Share player handouts, bookmark referee records, and keep a local campaign roster"
  - "Roll species such as Ganmeids and Weeven with their published encounter rules"
---

## Roll an encounter

Open **Generation settings** to choose a species, occupation, and level of
competence. Open **Additional characteristics** to select campaign scores.
Open **More settings** for skill minimums, equipment, identity,
and seeds. Use **Next NPC** on the Encounter card to make another roll. The
**Species field guide** searches sourcebooks and species names and can roll
directly from eligible entries.

## Roll a group encounter

Choose **Group Encounter** and filter by scene or select a group type. The
group roll establishes headcount, purpose, affiliation and one shared
reaction. The existing 2E NPC rules build the leader and specialists. The
referee card accounts for everyone else in the group and lets you open any
named member’s full record.

The group templates are house rules informed by the published encounter and
crew tables. Use **Keep group** to save the full encounter in the campaign
roster, or **Share handout** to show the group’s visible introduction.

## Track a character

Under **Additional characteristics**, choose Morale, Luck, Sanity, Charm,
a PSI test, Standing, or Wealth Level. The same choices in **Group encounter
settings** apply to each named member. Morale, Luck, and Sanity use 2D from
the *Traveller Companion*, pp. 4–7. Charm uses an ordinary 2D characteristic
roll for the Companion’s optional Charm score (p. 10).

Standing starts from the sheet’s Social Standing (SOC) score. Wealth starts
from baseline SOC and uses the Companion’s cash table (p. 3). Profiles with
SOC can fill both fields. A PSI test rolls 2D minus completed terms as in the
*Traveller Core Rulebook* and uses the species rule where one applies.
For a single NPC, **Career adjustments** accepts known history for Morale,
Wealth, and PSI. Group members use starting values.

Open **Character sheet** on the Encounter card or beside any named group
member. The layout follows the [Traveller 2E character sheet](https://tedt.org/RPG/Traveller/Character-Sheet.html).
The roll fills in known personal data, characteristic scores, skills, gear,
and cash. Open the sections to record radiation dose, additional
characteristics, education and careers, training, weapons and armour,
augments, finances, and notes. Both Current and Baseline scores show their
dice modifiers. Wealth Level also shows cash obtainable.

Use **Save sheet** to keep updates with the current encounter. The campaign
roster, referee link, and referee JSON carry the sheet with the roll.

## Find a crew candidate

Set the required skill and specialty in **Required skills and characteristics**.
For example, enter **Engineer (j-drive) = 2** to search for a qualified jump
engineer. The generator draws from the eligible combinations using their
original weights. The referee record shows each rating and the underlying grant.

## Run and share

Use the **Referee quick reference** for the facts you need in the scene. The
**Referee record** holds the full mechanical details, motives, secrets, and
roll history. Switch to **Player view** to show the introduction and portrait.

Use **Copy Player Link** to share the current encounter. Under **More actions**,
**Share handout** opens a separate player card or copies its link. For a hiring
roll, it can include qualifications, availability, and a pay offer. Open the
handout and choose **Print or save as PDF** for a printable copy.

Choose a species under **Published encounters** to roll from its 2E encounter
block. The referee record shows the source and the species’ published Hits,
movement, attacks, or encounter traits where available.

## Keep a campaign roster

Use **Keep NPC** or **Keep group** on the Encounter card, then **Campaign
roster** to reopen a saved encounter. Under **More actions**, choose
**Referee link** to copy the
exact roll or put its link in the address bar for bookmarking. The link stores
the seed, roll number, and settings in the URL fragment. It reopens the full
record, including any locks. You can also export the referee JSON.

This uses original, unofficial NPC generation rules with source references for
the enabled Mongoose Traveller profiles. Traveller is a registered trademark of
Far Future Enterprises.
