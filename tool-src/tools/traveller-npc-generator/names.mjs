const words = text => text.trim().split(/\s+/);

const imperialPersonal = words(`
  Ader Adia Ailin Aisla Akemi Alejo Alia Alon Amara Amin Amita Anik Anisa Ansel Ara Arin Arlo
  Asha Aven Belen Bem Benja Brin Cael Cai Calia Caro Carys Cato Celin Chao Chavi Corin
  Dalen Dara Darien Daya Deia Devin Dima Doran Edrin Eiko Elan Elara Eleni Elio Emil Enna Eren
  Esme Evren Farah Farin Fia Gaia Galen Hadi Hana Hanu Haro Hessa Idris Ikenna Ilar Imani Ines
  Ira Iria Isak Ishi Iskra Ivo Jalen Jara Javi Jia Jin Jiro Joren Juna Kael Kai Kalin Kalyan Kato
  Kaya Keiko Kenji Kessa Kiran Kito Koa Kori Kova Lale Leda Lena Leor Lina Lio Lira Liora Luan
  Luka Luz Maar Madi Mahin Malin Mara Marek Maris Mei Mika Milo Mira Miro Nadi Nami Nara Nasim
  Navin Nia Nico Niko Noa Nuri Oda Olin Orin Osa Osei Pala Pari Priya Qasim Rao Rava Ravi
  Remi Ren Rhea Rian Roan Romi Rumi Rune Sada Safia Saira Samir Sanna Sari Selen Sen Serra
  Sia Sima Sol Sora Sorin Suvi Tafa Tahir Tal Tali Tamsin Tarek Taro Tasmin Tavi Tayo Teri
  Thea Tilo Toma Tova Ula Uma Una Vada Vale Vara Veda Vela Vian Vika Wren Xian Yara Yelena
  Yuki Yuna Zaid Zale Zarin Zena Zia Zuri
`);
const imperialFamily = words(`
  Adari Adesh Ahn Akiro Alari Alden Aman Anwar Appiah Aral Ardent Arden Armit Arno Asare Ashan
  Atwood Avens Ayala Badran Baird Bako Baner Basri Bekan Belin Besar Bhandari Bhandu Bodan
  Brenner Calder Cane Caron Cato Chandra Chen Chinh Cho Cordel Corvo Cress Cruz Darzi Dane
  Delara Demir Dervan Dey Dinh Doran Doss Drevik Duan Dume Duvall Edren Elam Elgin Endo Eren
  Ersoy Espar Essam Estevan Falco Fane Faris Fen Ferran Foss Gan Ghosh Giron Grovek Hakim
  Hallan Han Haran Harrow Hashi Havel Hiran Holt Hsu Ibarra Idani Idran Ilan Imrei Inoue
  Ionescu Iqbal Irmak Ivers Jafari Jahan Jara Jardine Jin Kade Kader Kallam Kanna Kano Karu
  Kassan Kaur Kaveh Keita Kellan Kemal Khin Kito Kobay Kota Kovalen Kuga Laghari Laska Lau Lawin
  Leal Lenar Leong Leroux Lin Lira Lucan Maal Mahdi Makari Malek Marin Marr Nader Nagai Nara
  Narul Nassir Neri Nguen Noori Nordin Novak Nwosu Okafor Olani Onari Orban Ordel Osei Ovan
  Ozaki Pahl Pavan Penn Perera Rahal Rai Ralston Rana Rava Relan Reyes Rhee Rios Rook Rusk
  Saad Sahin Salim Salvi Sanz Sato Saye Sen Serrano Shah Shimizu Sibi Solak Sorrel Sova Stroud
  Surin Tabor Talla Tan Tarek Tavares Thane Thapa Torin Tran Tsuji Varga Varo Varr Venn Veras
  Voss Wade Wale Wen Wren Wu Xuan Yanez Yazdi Yoon Zahir Zaman Zhen Zhou
`);
export const imperialNameCounts = { personal: imperialPersonal.length, family: imperialFamily.length };

const solomaniPersonal = words(`
  Ada Adedayo Aditi Akira Amina Andrés Anika Anna Anong Arun Ayanda Bako Béatrice Camila
  Chinedu Chiyo Daniela Daria Deepa Diego Elif Emi Fatima Felipe Fiona Gabriel Grace Hakan
  Hassan Hayato Hyejin Iara Ibrahim Imani Inez Ingrid Ismail Ivan Jiahao Jihye João Jun
  Kalyani Karolina Kavita Kazuo Kelechi Kenji Khalid Kofi Kwame Leandro Lina Ling Lúcia Luz
  Maaike Malika Marisol Mateo Meryem Mei Ming Mira Nadia Nasrin Natsuko Nia Nikhil Noor
  Nyasha Omar Oriana Paola Pavel Rania Remedios Rina Rohan Ruslan Salma Samira Santiago
  Saori Seong Shirin Siobhan Sunita Tadashi Tana Tomas Uyen Ved Vidya Wanjiku Xia Yael
  Yasmin Yeong Youssef Zahra Zoya
`);
const solomaniFamily = words(`
  Abebe Abiola Adeyemi Ahmad Álvarez Antonov Aoki Arslan Awuah Bautista Berger Blom Cárdenas
  Carvalho Celik Chandra Chen Choudhury Correia Dlamini Doan Dubois Esposito Farah Fjeld
  Flores Forster Gao González Gutiérrez Haddad Hasegawa Hassan Hayashi Ibrahim Ionescu
  Iyer Jansen Kamau Kang Kapoor Karimi Kavanagh Kim Kowalski Kozlov Laurent Lee Lima Liu
  López MacLeod Mensah Morales Moyo Müller Murakami Mwangi Nair Nakamura Nascimento
  Ndiaye Nguyen Njoku Ochoa Okeke Ole Olsen Persaud Petrov Pham Quispe Rahman Ramírez
  Ramos Rathore Rivera Rocha Rossi Saito Salazar Santoso Schmid Sen Seo Sharma Silva
  Singh Sørensen Svensson Takahashi Tanaka Tavares Tesfaye Tran Valdez Vásquez Vo Wong
  Yamamoto Yilmaz Zaw Zhang Zhou
`);

const sources = {
  aocs1: 'Aliens of Charted Space Vol. 1',
  aocs2: 'Aliens of Charted Space Vol. 2',
  front: 'The Solomani Front',
  imperium: 'The Third Imperium',
  companion: 'Traveller Companion',
  drinax: 'The Pirates of Drinax, Book 2',
  rift: 'The Great Rift, Book 1',
  castrobancla: 'Castrobancla, The City of Aliens',
};
const structure = 'Book naming structure with original components';
const house = 'House naming convention';
const extrapolation = 'House names informed by published language or setting';
const style = (label, basis, source, options = {}) => ({ label, basis, source, ...options });
export const nameStyles = {
  imperial: style('Imperial Galanglic', house, 'Ted’s Tools Imperial name pool'),
  solomani: style('Solomani', structure, sources.aocs2 + ', p. 124', {
    links: [['Solomani name tables by Taunoyen', 'https://taunoyen.com/traveller/solomaninames.html']],
  }),
  vilani: style('Vilani', 'Fan naming structure with original components', 'MegaTraveller Referee’s Companion, pp. 87–89', {
    links: [['Vilani Personal Names by Jeff Zeitlin', 'https://www.freelancetraveller.com/features/culture/customs/vilnames.html']],
  }),
  'sword-worlds': style('Sword Worlds', structure, 'Sword Worlds (MgT2e), Sagamaal; GURPS Traveller: Sword Worlds, p. 110'),
  zhodani: style('Zhodani', structure, sources.aocs1 + ', p. 253; Alien Module 4: Zhodani (MgT1e), pp. 3–4'),
  aslan: style('Aslan · Trokh', extrapolation, sources.aocs1 + ', pp. 10–13, 17'),
  vargr: style('Vargr · Gvegh-influenced', structure, sources.aocs1 + ', pp. 177–179; Vargr (MgT1e), pp. 44–45'),
  kkree: style('K’kree', structure, sources.aocs1 + ', p. 112; Classic Traveller Alien Module 2: K’kree, PDF p. 9'),
  droyne: style('Droyne · Oynprith', structure, sources.aocs2 + ', Droyne; Classic Traveller Alien Module 5: Droyne, pp. 40–41'),
  hiver: style('Hiver · public alias and nest sign', structure, sources.aocs2 + ', pp. 211–214; GURPS Traveller: Alien Races 3, Hiver Personal Names'),
  darrian: style('Darrian', structure, 'Alien Module 3: Darrians (MgT1e), pp. 4–5'),
  luriani: style('Luriani', structure, 'Minor Alien Module 1: Luriani (MgT1e), p. 26'),
  sylean: style('Sylean', extrapolation, sources.imperium + ', p. 171'),
  gurungan: style('Gurungan · sonar calls', extrapolation, sources.front + ', pp. 11–12'),
  vegan: style('Vegan · Tyui', extrapolation, sources.front + ', pp. 69–73; Solomani Rim (MgT1e), Vegan Word Generation'),
  bwap: style('Bwap', extrapolation, sources.companion + ', p. 12'),
  ssienjhiovla: style('Ssienjhiovla · translated handles', extrapolation, sources.imperium + ', p. 238'),
  yont: style('Yont', house, sources.drinax + ', p. 197'),
  ascondi: style('Ascondi · translated calls', extrapolation, sources.rift + ', pp. 12–14'),
  empire: style('Glorious Empire · Galanglic', house, 'The Glorious Empire, pp. 55–57'),
  florian: style('Floriani', extrapolation, sources.drinax + ', p. 122'),
  whistler: style('Whistler · transcribed calls', extrapolation, sources.imperium + ', pp. 202–204'),
  bandaluk: style('Bandaluk', house, sources.castrobancla + ', PDF pp. 55–58'),
  dvora: style('Dvora', house, sources.castrobancla + ', PDF p. 59'),
  kubotaur: style('Kubotaur', house, sources.castrobancla + ', PDF p. 60'),
  pelacur: style('Pelacur', house, sources.castrobancla + ', PDF pp. 61–62'),
  settler: style('Amarjan Settler', house, sources.castrobancla + ', PDF p. 63'),
  castrobancla: style('Castrobancla · trade names', house, sources.castrobancla),
  dolphin: style('Dolphin · public call sign', extrapolation, sources.front + ', pp. 10–11'),
  orca: style('Orca · public call sign', extrapolation, 'Aliens of Charted Space Vol. 3, Orca'),
  ithklur: style('Ithklur', extrapolation, sources.aocs2 + ', Ithklur'),
  gurvin: style('Gurvin · trade names', extrapolation, sources.aocs2 + ', Gurvin'),
  tenipal: style('Tenipal', house, 'Deepnight Revelation: The Near Side of Yonder, pp. 11–14'),
};
export const fanNameSources = [
  ['Traveller-style word generation by Joshua Bell', 'https://inexorabletash.github.io/model2/article2/wordgen.html'],
  ['Naming Your Travellers by Jeff Zeitlin', 'https://www.freelancetraveller.com/features/preproom/webnames.html'],
  ['Traveller language and name generators by Alvin Plummer', 'https://stellarreaches.wordpress.com/2022/03/06/traveller-languages-update/'],
];

const cultureStyles = {
  hierate: 'aslan', extents: 'vargr', herd: 'kkree', oytrip: 'droyne', nest: 'hiver',
  solomani: 'solomani', vilani: 'vilani', 'sword-worlds': 'sword-worlds', zhodani: 'zhodani',
  darrian: 'darrian', luriani: 'luriani', gurungan: 'gurungan', vegan: 'vegan', ithklur: 'ithklur', tenipal: 'tenipal',
  ssienjhiovla: 'ssienjhiovla', yont: 'yont', ascondi: 'ascondi', florian: 'florian', whistler: 'whistler',
};
const speciesStyles = {
  aslan: 'aslan', vargr: 'vargr', kkree: 'kkree', droyne: 'droyne', hiver: 'hiver', sylean: 'sylean',
  selenite: 'solomani', aquamorph: 'solomani', ape: 'solomani', ladybug: 'imperial', bwap: 'bwap', dolphin: 'dolphin', orca: 'orca',
  gurungan: 'gurungan', vegan: 'vegan', ssienjhiovla: 'ssienjhiovla', yont: 'yont', ascondi: 'ascondi',
  feskal: 'florian', barnai: 'florian', whistler: 'whistler', bandaluk: 'bandaluk', dvora: 'dvora',
  kubotaur: 'kubotaur', pelacur: 'pelacur', settler: 'settler', ithklur: 'ithklur', gurvin: 'gurvin',
};
export function nameStyleFor(requested, profile) {
  if (requested !== 'auto') return requested;
  if (profile.culture === 'empire') return profile.fit === 'aslan' ? 'aslan' : 'empire';
  return cultureStyles[profile.culture] ?? speciesStyles[profile.id] ?? speciesStyles[profile.fit]
    ?? (profile.culture === 'castrobancla' ? 'castrobancla' : 'imperial');
}

const syllables = Object.fromEntries(Object.entries({
  aslan: ['ae ah eai ei ea fta hao hea hla ihe iwa kha khu kua la lau re rha sa sia teu tya uar ye'],
  'aslan-middle': ['ai ah ea eia hiy ih iyk iy khea khiy owa raa rai sa ta uah ui wa ya'],
  'aslan-end': ['ah aiy ak ar eah ea ear eikh eo hei iakh ihal ihirl ir iyu owi rai rakh ri ua ual uhte'],
  vargr: ['aeg arr az dz egh fa farr gva gvar hakh irr kho kogh kza ong ourr rakh rrog tha uek urr va vhe za zha'],
  'vargr-end': ['adh ak arr arz aurr egh ekh ga ghakh gzan irk izz kagh khan oz ragh roek uek ur urr var zekh zorr'],
  kkree: ['ch’ g’ gr’ hk’ k’ kr’ ngh’ s’ t’ tr’ ts’ tz’'],
  'kkree-middle': ['aeh ae ee ei i ie ir oa oou rr u uu'],
  'kkree-end': ['gh ghik ghu hk khee kr krr ghri ra rakh rk sth tch tz'],
  droyne: ['a ach ak ay ch chi d dey droy e en eo i iv k ke kr loy o oy poy r re ro sho te troy u v voy y'],
  'droyne-end': ['a ab ad ah ak ay che dak dey e ene es ey in ir it kh loy oy ran reen ro sh tek ti trit voy ya yen'],
  vilani: ['a ab ar ba dar di dum en ga gida gu ig il in ka ki lam len mar na ni nu pa ra ri sa si ta tu u va zi zu'],
  'vilani-end': ['ad am an ar da dam en gi id in ir ka kur la lan li lum men mur na nu ra ren sa sha tan um ur za zul'],
  zhodani: ['a abr ad al an at bra dlan dli dria dza ebr ed ev iep jda kla liah nad ni prio qra shia sta tla tsa vra zda zh'],
  'zhodani-end': ['ad ats av datl dro ebr elgn en ets ev ibn ish ivr ovql riet ris rvla shev ste sti vaz vra vri zha ziet zl'],
  sylean: ['al an ar den er kai ker lan le ma mor na nar o rai ral sel sur tal te va ye zi'],
  'sylean-end': ['ain ala am an ar as el en ere es in isa is or os ova ren ri us'],
  vegan: ['aa ae ai ia io oe oo ta te ti toa tue tyi uae ui uo ya ye yu'],
  'vegan-end': ['ael ai eia eoi et hu ia il iar iem ir it oae ou ti tuir uy ya yeu'],
  bwap: ['baa bau bewa bwi da dwa kwa maba mba na nwa pa pwa taw thu wab wapa wii'],
  'bwap-end': ['ba bal dam dwa gwa ma mar mba nab nam pan ram tap wat wea wid wip'],
  yont: ['a ak bo dra igo ka ken kra or ra sa taz tor u ya yon zo'],
  'yont-end': ['ad ak ar dor enf eth ga at ir kas les ok ost tok ur von yas'],
  florian: ['al an at ber da e fa fe hal i il lor ma mil ne o sa sel tal tel vel'],
  'florian-end': ['a al an ard en eon er es os ia ie in is on or ral ren ris su ta'],
  whistler: ['ae ee fwee hii ooo pi swee tee thii too uue vee whee yii'],
  'whistler-end': ['bii be pi pon tso tow tee tik to u woo ye zii'],
  bandaluk: ['ban bei by da lo kor lan ma no qa ru ta tek vo ya'],
  'bandaluk-end': ['a an am duk ek en ih kal lak le luk mir nal nar rin tek'],
  dvora: ['dvo dra dro ga grak kra krr ord sk ta thek va vek vro zra'],
  'dvora-end': ['a ak ben dar es ger gra ker kor ne ok orn rak ret ro ska'],
  kubotaur: ['bok du got ka khu ku nar o ro sho ta tor trom ur va'],
  'kubotaur-end': ['ak ba dar gom kal kan kur mok nath or ostra thal um var'],
  pelacur: ['ae ala be da dia elia ila im la lio lu nai pa pe sal sei val'],
  'pelacur-end': ['ala an anel ar aul aya ela elen esa ian ila ina ira irel or ura uru'],
  settler: ['ad al amar ara ce eran fa hal is ma no ol re ser tal ul ver'],
  'settler-end': ['a al am ar eir ek el em es il io ir iy o se tel ul um'],
  ithklur: ['ath ch’ dr ek gri ik ka khr kla sha sth tha thra tk u zk'],
  'ithklur-end': ['ak esh ich ikh it kesh kr kuk lo rr th thak thr ul'],
  gurvin: ['a ber dal fa ghal gur kan le mu na nor pre su ve vi za'],
  'gurvin-end': ['a al an e eb em er if im in or ram ran sel vin'],
  tenipal: ['a ama bel cor de e fen hal im ir kar kel len mar nei pal ral ser tel var'],
  'tenipal-end': ['al am an ar dem el em en es et il is om on ran rel ten um ver'],
}).map(([key, [list]]) => [key, words(list)]));

async function take(rng, pool, label) {
  return pool[(await rng.draw(pool.length, label)) - 1];
}

const capitalize = text => text[0].toUpperCase() + text.slice(1);

async function word(rng, model, label) {
  const start = await take(rng, syllables[model], label + ' opening');
  const middle = syllables[model + '-middle'];
  const medial = middle && (model === 'kkree' || await rng.draw(3, label + ' length') === 3)
    ? await take(rng, middle, label + ' middle') : '';
  const end = await take(rng, syllables[model + '-end'], label + ' ending');
  return capitalize(start + medial + end);
}

const waterTerms = words('Brine Current Deep Drift Eddy Echo Foam Gyre Kelp Ledge Pool Rain Reef Rill Shoal Swell Tide Trench Wake Wave');
const senseTerms = words('Amber Arc Cypress Dusk Ember Glass Granite Indigo Lichen Median Mist Moss Ochre Ozone Quartz Reeds Rime Sable Salt Silver Umber Wind');
const translated = words('Ask Balance Count Cross Find Fold Gather Guide Hush Inquire Keep Lean Listen Mark Mend Mirror Pace Return Shelter Trace Turn');
const namesForHiver = [
  'Quiet Circuit', 'Patient Cartographer', 'Spiral Ledger', 'Linking Harbors', 'Copper Abacus', 'Inclined to Listen',
  'Folding Maps', 'Kindly Estimate', 'Equal Measure', 'Curious Margin', 'Notes in Order', 'Sorting Stones',
  'Bridge of Small Steps', 'Second Revision', 'Considered Answer', 'Harmonic Index', 'Soft Question', 'Parallel Survey',
  'Returning Light', 'Growing Lattice', 'Twelve Reasons', 'Careful Outline', 'Open Passage', 'Attentive Listener',
];
const zhodaniRanks = ['iepr', 'atl', 'stebr', 'tlas', 'tlasche’', 'iashav'];
const sagamaalBase = words('Arn Birg Brand Dag Eidr Egil Eir Finn Frey Geir Gudrun Gunnar Hal Helga Hrafn Ivar Kari Ketil Leif Liv Magni Oda Orm Ragn Ran Rolf Sif Sig Sol Stein Thora Tryg Ulf Vig Yng');
const sagamaalFemale = words('Alda Anja Astrid Brynja Dagny Edda Elin Embla Freyja Frida Gudrun Helga Hilda Inga Jorun Kari Linnea Liv Ragna Runa Signe Sigrid Solveig Thora Tora Ylva');
const sagamaalMale = words('Arvid Arn Birk Brand Dagr Eidar Einar Egil Erik Finn Freyr Geir Gunnar Halfdan Harald Hrafn Ingvar Ivar Ketil Leif Mikkel Olaf Orm Ragnar Soren Stein Torsten Ulf');
const darrianFamily = words('Alderbank Ashvale Brackenridge Brightwater Coldmere Coppergrove Deepford Dunfell Evermere Fernbrook Flintridge Glassfen Greenholt Hazelshore Ironpool Juniperfell Lightstone Longrun Mossmere Northledge Reedbank Sablewood Silverfen Southwind Starvale Stonebrae Tidewater Whitecleft');
const darrianPersonal = words('Adar Aelwen Anir Arion Belat Caedar Caran Deiran Elain Elar Eren Galen Gwenn Ilan Irwen Lareth Leor Liran Mered Nara Nerys Olwen Orian Rhael Saeran Saryn Talar Taran Terel Vaen Yrian');
const lurianiPersonal = words('Alera Aniel Ariola Avio Balea Belan Catario Celio Damara Delian Elava Enrico Erilia Fiara Ilario Iolanta Kalia Larena Lisena Loria Lucan Marella Marino Nerio Oriana Palena Riala Rian Salia Selio Talia Tavena Vario Velia');
const lurianiFamily = words('Arada Balanta Balero Casari Casiano Dalcora Dalena Estelo-Farin Farento Fiorela Frascio Galeno Galleria Ianta Lariano Lasca Lorento Malcora Messava Monteiro Nevari Oliva Orari Palanco Pasari Rivar-Solari Salina Serria Sorela Taleri Varese Velani Ventara');

async function culturalName(id, rng, { sex, soc, nativeCulture }) {
  if (id === 'imperial' || id === 'solomani' || id === 'empire' || id === 'castrobancla') {
    const given = await take(rng, id === 'solomani' ? solomaniPersonal : imperialPersonal, 'Given or trade name');
    const family = await take(rng, id === 'solomani' ? solomaniFamily : imperialFamily, 'Family or adopted name');
    return { commonName: given + ' ' + family };
  }
  if (id === 'zhodani') {
    const given = await word(rng, id, 'Zdetl adult name');
    const rank = nativeCulture === id && soc >= 10 ? zhodaniRanks[Math.min(soc, 15) - 10] : null;
    if (rank) return { commonName: given + rank };
    const family = await word(rng, id, 'Zdetl family name');
    return { commonName: given + ' ' + family };
  }
  if (id === 'vilani') {
    const given = await word(rng, id, 'Vilani personal name');
    const clan = await word(rng, id, 'Vilani clan name');
    const origin = await word(rng, id, 'Vilani social origin');
    return { commonName: given + ' ' + clan, formalName: [given, origin, clan].join(' ') };
  }
  if (id === 'sword-worlds') {
    const female = sex === 'female';
    const male = sex === 'male';
    const given = await take(rng, female ? sagamaalFemale : male ? sagamaalMale : [...sagamaalFemale, ...sagamaalMale], 'Sagamaal personal name');
    const parent = await take(rng, sagamaalBase, 'Sagamaal parent’s name');
    const suffix = female ? 'dottir' : male ? 'sson' : sagamaalFemale.includes(given) ? 'dottir' : 'sson';
    const family = await take(rng, words('Brahe Bratt Eid Eken Falk Grann Holm Hovland Kvist Lund Myr Nord Osk Rud Skar Solberg Strom Vald Vik'), 'Sagamaal family name');
    const commonName = given + ' ' + parent + suffix;
    return { commonName, formalName: commonName + ' ' + family };
  }
  if (id === 'darrian') {
    const birth = await take(rng, darrianPersonal, 'Darrian birth name');
    const taken = await take(rng, darrianPersonal.filter(name => name !== birth), 'Darrian taken name');
    const family = await take(rng, darrianFamily, 'Darrian family name');
    return { commonName: family + ' ' + taken, nativeName: taken, formalName: family + ' ' + birth + ' ' + taken };
  }
  if (id === 'luriani') {
    const given = await take(rng, lurianiPersonal, 'Luriani personal name');
    const firstParent = await take(rng, lurianiPersonal.filter(name => name !== given), sex === 'female' ? 'Mother’s name' : sex === 'male' ? 'Father’s name' : 'First parent’s name');
    const secondParent = await take(rng, lurianiPersonal.filter(name => name !== firstParent && name !== given), sex === 'female' ? 'Father’s name' : sex === 'male' ? 'Mother’s name' : 'Second parent’s name');
    const family = await take(rng, lurianiFamily, 'Luriani birth family name');
    return { commonName: given + ' ' + family, formalName: [given, firstParent, secondParent, family, family].join(' ') };
  }
  if (id === 'hiver') {
    const commonName = await take(rng, namesForHiver, 'Hiver public alias');
    const sign = await take(rng, translated, 'Nest sign gesture');
    const image = await take(rng, senseTerms, 'Nest sign association');
    return { commonName, nativeName: '[Nest sign: ' + sign.toLowerCase() + ', ' + image.toLowerCase() + ']' };
  }
  const acoustic = ['gurungan', 'dolphin', 'orca'].includes(id);
  if (acoustic || id === 'ssienjhiovla' || id === 'ascondi') {
    const motif = await take(rng, acoustic ? waterTerms : senseTerms, 'Translated motif');
    const gesture = await take(rng, translated, 'Translated gesture or action');
    const signal = acoustic ? 'Acoustic signature' : id === 'ssienjhiovla' ? 'Gesture and scent signature' : 'Local call';
    const commonName = id === 'orca' ? gesture + ' of the ' + motif : motif + ' ' + gesture;
    return { commonName, nativeName: '[' + signal + ': ' + gesture.toLowerCase() + ' ' + motif.toLowerCase() + ']' };
  }

  const given = await word(rng, id, nameStyles[id].label + ' personal name');
  if (id === 'aslan') {
    const clan = nativeCulture === 'empire' ? 'Tokouea’we' : await word(rng, id, 'Trokh clan name');
    return { commonName: given, nativeName: given, formalName: given + ' of clan ' + clan };
  }
  if (id === 'kkree') {
    const family = await word(rng, id, 'K’kree family name');
    return { commonName: given + ' ' + family, nativeName: family };
  }
  if (id === 'whistler') {
    const tail = await word(rng, id, 'Second transcribed call');
    return { commonName: given + '–' + tail.toLowerCase() };
  }
  if (['vargr', 'droyne', 'bwap', 'dvora', 'kubotaur', 'vegan', 'ithklur'].includes(id)) return { commonName: given };
  const family = await word(rng, id, nameStyles[id].label + ' second name');
  return { commonName: given + ' ' + family };
}

export async function generateName(id, rng, { sex, soc, nativeCulture, commonName, nativeName } = {}) {
  const { label, basis, source } = nameStyles[id];
  const result = commonName && (nativeName || !['hiver', 'ssienjhiovla', 'gurungan', 'ascondi', 'dolphin', 'orca'].includes(id))
    ? {} : await culturalName(id, rng, { sex: sex?.toLowerCase(), soc, nativeCulture });
  return {
    commonName: commonName ?? result.commonName,
    nativeName: nativeName ?? result.nativeName ?? null,
    naming: { id, label, basis, source, formalName: commonName ? null : result.formalName ?? null },
  };
}
