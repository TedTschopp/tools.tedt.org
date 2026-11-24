const notes = (name, page, note, art) => ({ name, page, note, art });
const entries = rows => rows.map(([name, page]) => notes(name, page));
const mongoose = slug => 'https://www.mongoosepublishing.com/products/' + slug;

// Page locators are printed pages, except where "PDF" is stated.
export const referenceGroups = [
  {
    book: 'The Great Rift, Book 1',
    entries: [
      notes('Kursae', 'pp. 11–12', 'The remains suggest an insectoid species. Living individuals and their anatomy are unconfirmed.'),
    ],
  },
  {
    book: 'Aliens of Charted Space Vol. 2',
    url: mongoose('aliens-of-charted-space-vol-2'),
    entries: [
      notes('Chirper', 'pp. 143, 150, 191', 'Wild relative of the Droyne. The casted Droyne model requires a different developmental history.', 'chirper'),
    ],
  },
  {
    book: 'Spinward Marches 1: The Bowman Arm',
    entries: [notes('Otarri', 'p. 9', 'An amphibious sophont dependent on wet conditions. This entry documents habitat and population.')],
  },
  {
    book: 'Aliens of Charted Space Vol. 3',
    url: mongoose('aliens-of-charted-space-vol-3'),
    entries: entries([['Geonee', 'pp. 92, 118'], ['Llyrnian', 'p. 113']]),
  },
  {
    book: 'Aliens of Charted Space Vol. 4',
    url: mongoose('aliens-of-charted-space-vol-4'),
    entries: [
      notes('Suerrat', 'Suerrat Travellers chapter', 'A Humaniti lineage whose culture emphasises living within local ecologies.'),
      notes('Za’tachk', 'p. 70; also Vol. 2, p. 219', 'Uses four limbs for locomotion and manipulation.', 'zatachk'),
      notes('Gurvin', 'p. 167; also Vol. 2, p. 219', 'Six-limbed members of the Hive Federation. A Gurvin naming style is available.', 'gurvin'),
      notes('Tezcat', 'p. 179', 'A species of the Vanguard Reaches. The book includes its own Traveller creation rules.'),
    ],
  },
  {
    book: 'Behind the Claw',
    url: mongoose('behind-the-claw'),
    entries: entries([
      ['Chokari', 'p. 35'], ['Foelen dolphin', 'p. 35'], ['Ebokin', 'p. 48'], ['Llellewyloly', 'p. 51'],
      ['Saurian', 'p. 66'], ['Crenduthaar', 'p. 167'], ['Gl’lu', 'p. 169'], ['Kirissukyoya', 'p. 172'],
      ['Lurent', 'p. 173'], ['Martian', 'p. 174'], ['Segani', 'p. 175'], ['Shi’awei', 'p. 176'],
      ['Souggvuez', 'p. 177'], ['Yafizethe', 'p. 178'],
    ]),
  },
  {
    book: 'The Trailing Frontier',
    url: mongoose('the-trailing-frontier'),
    entries: [
      notes('Luriani', 'People of the Trailing Frontier', 'A Luriani naming style is available.'),
      ...entries([
        ['Jonkeereen', 'People of the Trailing Frontier'], ['Sydites', 'p. 25'], ['Akeed', 'p. 28'], ['Capry', 'p. 29'],
        ['Droashav', 'p. 30'], ['Faar', 'p. 31'], ['Ursa', 'p. 33'], ['Wandering People', 'p. 35'],
      ]),
    ],
  },
  {
    book: 'The Deep and the Dark',
    url: mongoose('the-deep-and-the-dark'),
    entries: entries([
      ['Bruhre', 'p. 22'], ['Happrhani', 'Sophonts chapter'], ['Iltharan', 'p. 25'], ['J’aadje', 'p. 25'],
      ['Ormine', 'p. 27'], ['Tlyetrai', 'p. 28'], ['Ulane', 'p. 29'], ['Virushi', 'p. 30; also JTAS 5, p. 54'], ['Yn-Tsai', 'p. 32'],
    ]),
  },
  {
    book: 'The Spinward Extents',
    url: mongoose('the-spinward-extents'),
    entries: entries([
      ['Aniyun', 'pp. 72–74'], ['Gmina', 'p. 77'], ['Katangan', 'Beyond species'], ['Kemlae', 'p. 80'],
      ['Ktiauao', 'p. 82'], ['Mal’Gnar', 'p. 84'], ['Storm Knights', 'Beyond species'], ['Teakhea', 'p. 88'],
      ['Eslyat', 'p. 238'], ['Freni', 'p. 241'], ['Ghenani', 'Vanguard Reaches species'], ['Murian', 'p. 246'],
      ['Resavolk', 'p. 249'], ['Thonane', 'p. 250'], ['Zhdianshe', 'p. 253'],
    ]),
  },
  {
    book: 'Deepnight Revelation and Expeditions',
    entries: entries([
      ['Alikaia', 'Riftsedge Transit, p. 60'], ['Erline', 'The Near Side of Yonder, p. 15'],
      ['Dewdellae', 'Expeditions, p. 23'], ['Haix', 'Expeditions, p. 13'], ['Brutes', 'The Far Side of Nowhere'],
      ['Lowgees', 'The Far Side of Nowhere'], ['Firbolg', 'The Far Side of Nowhere'],
      ['Nentsedl', 'The Core Expeditions, p. 63'], ['Rammak', 'The Rim Expeditions, p. 78'],
    ]),
  },
  {
    book: 'Journal of the Travellers’ Aid Society (Mongoose 2E)',
    entries: entries([
      ['Dynchia', 'Vol. 1, p. 49'], ['Girug’kagh', 'Vol. 1, p. 112'], ['Githiaskio', 'Vol. 2, p. 38'],
      ['Ael Yael', 'Vol. 3, p. 47'], ['Hlanssai', 'Vol. 4, p. 44'], ['Halkans', 'Vol. 8, p. 98'], ['Amindii', 'Vol. 9, p. 62'],
      ['Nenlat', 'Vol. 10, p. 61'], ['Aezorgh', 'Vol. 11, p. 61'], ['Caprisaps', 'Vol. 12, p. 19'],
      ['Hhkar', 'Vol. 12, p. 90'], ['Mewey', 'Vol. 13, p. 11'], ['Krotan', 'Vol. 15, p. 2'],
      ['Lhshana', 'Vol. 16, p. 36'], ['Weregre', 'Vol. 16, p. 80'], ['Bosaki', 'Vol. 17, p. 106'],
    ]),
  },
];
