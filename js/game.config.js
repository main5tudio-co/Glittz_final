// ═══════════════════════════════════════════════════════
//  GLITZ OF HORIZON — MASTER GAME CONFIG
//  js/game.config.js
//  Edit file ini untuk adjust semua variable game
//  Jangan ubah struktur key — hanya nilai (value) nya
// ═══════════════════════════════════════════════════════

const GLITZ_CONFIG = {

  // ─────────────────────────────────────────────────────
  //  UNIT DEFINITIONS
  //  counters : unit ini kuat melawan siapa
  //  weakTo   : unit ini lemah melawan siapa
  //  modelPath: path ke file .glb (isi setelah asset siap)
  // ─────────────────────────────────────────────────────
  units: {
    sword: {
      sign:      '⚔️',
      label:     'Swordsman',
      hp:        1000,
      move:      3,
      range:     1,
      stDrain:   15,
      color:     0x607d8b,
      shape:     'square',
      modelPath: 'assets/units/sword.glb',
      scale:     [0.5, 0.7, 0.5],
      perk:      'Balanced Infantry. Holds the line.',
      counters:  ['archer'],
      weakTo:    ['horse'],
    },
    archer: {
      sign:      '🏹',
      label:     'Archer',
      hp:        800,
      move:      3,
      range:     3,
      stDrain:   15,
      color:     0x5c6bc0,
      shape:     'triangle',
      modelPath: 'assets/units/archer.glb',
      scale:     [0.5, 0.7, 0.5],
      perk:      'Wind affects arrows. Ranged threat.',
      counters:  ['horse'],
      weakTo:    ['sword'],
    },
    horse: {
      sign:      '♞',
      label:     'Horseman',
      hp:        1200,
      move:      5,
      range:     1,
      stDrain:   15,
      color:     0x424242,
      shape:     'long_rect',
      modelPath: 'assets/units/horse.glb',
      scale:     [0.5, 0.7, 0.9],
      perk:      'Flank causes run. High mobility.',
      counters:  ['sword'],
      weakTo:    ['spear'],
    },
    spear: {
      sign:      '⇂',
      label:     'Spearman',
      hp:        1000,
      move:      2,
      range:     1,
      stDrain:   25,
      color:     0x8d6e63,
      shape:     'stick',
      modelPath: 'assets/units/spear.glb',
      scale:     [0.15, 0.9, 0.15],
      perk:      'Pushback horses. Anti-cavalry.',
      counters:  ['horse'],
      weakTo:    ['archer'],
    }
  },

  // ─────────────────────────────────────────────────────
  //  TERRAIN TYPES
  //  moveCost     : berapa stamina extra untuk masuk tile ini
  //  defBonus     : % damage reduction saat diserang di sini
  //  canAmbush    : unit bisa bersembunyi di sini
  //  provideCover : unit tidak terlihat dari jauh
  //  blockedFor   : array unit type yang tidak bisa masuk
  //  rangeBonus   : extra jangkauan ranged unit di tile ini
  // ─────────────────────────────────────────────────────
  terrain: {
    plains: {
      label:        'Plains',
      icon:         '🌾',
      moveCost:     1,
      defBonus:     0,
      colorHex:     '#aed581',
      canAmbush:    false,
      provideCover: false,
      blockedFor:   [],
      rangeBonus:   0,
      desc:         'Open ground. No advantage.',
    },
    forest: {
      label:        'Forest',
      icon:         '🌲',
      moveCost:     2,
      defBonus:     15,
      colorHex:     '#388e3c',
      canAmbush:    true,
      provideCover: true,
      blockedFor:   [],
      rangeBonus:   0,
      desc:         'Slows movement. Units can hide here.',
    },
    hill: {
      label:        'Hill',
      icon:         '⛰️',
      moveCost:     2,
      defBonus:     20,
      colorHex:     '#8d6e63',
      canAmbush:    false,
      provideCover: false,
      blockedFor:   [],
      rangeBonus:   1,
      desc:         'High ground. Ranged +1 range.',
    },
    mud: {
      label:        'Mud',
      icon:         '💧',
      moveCost:     2,
      defBonus:     -10,
      colorHex:     '#795548',
      canAmbush:    false,
      provideCover: false,
      blockedFor:   [],
      rangeBonus:   0,
      desc:         'Created by Rain. Slows and weakens.',
    },
    river: {
      label:        'River',
      icon:         '🌊',
      moveCost:     3,
      defBonus:     -15,
      colorHex:     '#29b6f6',
      canAmbush:    false,
      provideCover: false,
      blockedFor:   ['horse'],
      rangeBonus:   0,
      desc:         'Horse cannot cross. Dangerous to cross.',
    },
    road: {
      label:        'Road',
      icon:         '🛤️',
      moveCost:     0,
      defBonus:     0,
      colorHex:     '#bdbdbd',
      canAmbush:    false,
      provideCover: false,
      blockedFor:   [],
      rangeBonus:   0,
      desc:         'Fast movement. No terrain bonus.',
    },
  },

  // ─────────────────────────────────────────────────────
  //  ENVIRONMENT OBJECTS
  //  Ditaruh di atas tile sebagai dekorasi + mechanic
  //  blocksMovement : tile tidak bisa dimasuki unit
  //  blocksVision   : tile di belakangnya tidak terlihat
  //  provideCover   : unit di tile ini bisa ambush
  // ─────────────────────────────────────────────────────
  environment: {
    tree: {
      modelPath:      'assets/environment/tree_low.glb',
      scale:          [0.4, 0.6, 0.4],
      provideCover:   true,
      blocksVision:   true,
      blocksMovement: false,
    },
    bush: {
      modelPath:      'assets/environment/bush.glb',
      scale:          [0.5, 0.3, 0.5],
      provideCover:   true,
      blocksVision:   false,
      blocksMovement: false,
    },
    rock: {
      modelPath:      'assets/environment/rock.glb',
      scale:          [0.4, 0.4, 0.4],
      provideCover:   false,
      blocksVision:   false,
      blocksMovement: true,
    },
  },

  // ─────────────────────────────────────────────────────
  //  WEATHER
  //  stDrainBonus  : tambahan stamina drain per aksi
  //  visionRange   : max tile jarak penglihatan
  //  archerAccMod  : multiplier akurasi archer (1.0 = normal)
  //  mudChance     : probabilitas tile plains jadi mud (0-1)
  //  moveMod       : pengurangan move semua unit
  //  fogOfWar      : semua enemy hidden kecuali adjacent
  // ─────────────────────────────────────────────────────
  weather: {
    sun: {
      icon:         '☀️',
      label:        'Bright',
      stDrainBonus: 15,
      visionRange:  10,
      archerAccMod: 1.0,
      mudChance:    0,
      moveMod:      0,
      fogOfWar:     false,
    },
    rain: {
      icon:         '🌧️',
      label:        'Mud Season',
      stDrainBonus: 0,
      visionRange:  4,
      archerAccMod: 0.8,
      mudChance:    0.3,
      moveMod:      -1,
      fogOfWar:     false,
    },
    moon: {
      icon:         '🌙',
      label:        'Night',
      stDrainBonus: 0,
      visionRange:  5,
      archerAccMod: 0.9,
      mudChance:    0,
      moveMod:      0,
      fogOfWar:     false,
    },
    fog: {
      icon:         '🌫️',
      label:        'Fog of War',
      stDrainBonus: 0,
      visionRange:  2,
      archerAccMod: 0.7,
      mudChance:    0,
      moveMod:      0,
      fogOfWar:     true,
    },
    snow: {
      icon:         '❄️',
      label:        'Blizzard',
      stDrainBonus: 10,
      visionRange:  3,
      archerAccMod: 0.8,
      mudChance:    0,
      moveMod:      -1,
      fogOfWar:     false,
    },
  },

  // ─────────────────────────────────────────────────────
  //  BATTLE RULES
  // ─────────────────────────────────────────────────────
  battle: {
    gridX:           10,
    gridZ:           14,
    tileSize:        1.0,
    tileGap:         0.02,
    walkSpeed:       4.5,
    baseDamage:      100,
    recoilRatio:     0.075,
    backstabMult:    1.30,
    sidestabMult:    1.10,
    stRecoverPerTurn:15,
    dailyBattleLimit:8,
    maxTurns:        30,
  },

  // ─────────────────────────────────────────────────────
  //  AMBUSH SYSTEM
  //  revealRange  : jarak (tile) musuh terlihat dari cover
  //  bonusDmgMult : damage multiplier serangan pertama
  // ─────────────────────────────────────────────────────
  ambush: {
    enabled:      true,
    revealRange:  1,
    bonusDmgMult: 1.5,
    requiresCover:true,
  },

  // ─────────────────────────────────────────────────────
  //  WIND DIRECTIONS
  //  Mempengaruhi akurasi dan damage archer
  // ─────────────────────────────────────────────────────
  winds: [
    { id:'N',  deg:0,   vec:{ x:0,  z:-1 } },
    { id:'NE', deg:45,  vec:{ x:1,  z:-1 } },
    { id:'E',  deg:90,  vec:{ x:1,  z:0  } },
    { id:'SE', deg:135, vec:{ x:1,  z:1  } },
    { id:'S',  deg:180, vec:{ x:0,  z:1  } },
    { id:'SW', deg:225, vec:{ x:-1, z:1  } },
    { id:'W',  deg:270, vec:{ x:-1, z:0  } },
    { id:'NW', deg:315, vec:{ x:-1, z:-1 } },
  ],

  // ─────────────────────────────────────────────────────
  //  PLAYER COMBAT TITLES
  //  Dihitung dari rasio unit yang paling sering dipakai
  // ─────────────────────────────────────────────────────
  titles: {
    'Iron Linebreaker':   'Tembok pertahanan pejal, dominasi garis depan.',
    'Blitz Cavalry':      'Pasukan kilat pengacau formasi musuh.',
    'Phantom Skirmisher': 'Taktik hit-and-run mematikan dari bayang-bayang.',
    'Phalanx Warden':     'Dinding tombak tak tergoyahkan.',
    'Balanced Vanguard':  'Seimbang dan tangguh di segala situasi.',
    'Eagle Eye Marksman': 'Fokus serangan jarak jauh yang presisi.',
    'Swift Flanker':      'Mobilitas tinggi untuk serangan sayap.',
    'Tactical Commander': 'Ahli strategi adaptif.',
    'Recruit':            'Memulai perjalanan di medan pertempuran.',
  },

  // ─────────────────────────────────────────────────────
  //  WORLD MAP BUILDINGS  (v2 — belum aktif)
  //  upgradesTo : null berarti level maksimal
  // ─────────────────────────────────────────────────────
  buildings: {
    camp:    { maxPop:50,   trainSlots:1, defBonus:5,  upgradesTo:'village' },
    village: { maxPop:200,  trainSlots:2, defBonus:10, upgradesTo:'town'    },
    town:    { maxPop:1000, trainSlots:3, defBonus:20, upgradesTo:'city'    },
    city:    { maxPop:5000, trainSlots:4, defBonus:35, upgradesTo:'castle'  },
    castle:  { maxPop:null, trainSlots:6, defBonus:60, upgradesTo:null      },
  },

  // ─────────────────────────────────────────────────────
  //  CLAN CHARACTER SYSTEM
  //  Generated once via the 50-question clan assessment (unlocked
  //  after 20 bandit + 10 pvp battles — same threshold Settings.html
  //  already gates on, no new plumbing needed there).
  //
  //  6 numeric stats, 1-20 at character creation, trainable up to
  //  100-130 later (training/job system not built yet — ties into
  //  the `buildings` config above: camp/village/town/city/castle
  //  jobs are the natural place for that boost to live).
  // ─────────────────────────────────────────────────────
  clanStats: ['leadership', 'martialDiscipline', 'calmDiscipline', 'battleIntellect', 'intellectual', 'political'],

  // Nature/terrain affinity — categorical, not numeric. Which terrain
  // this character performs best on. (Not yet wired into battle
  // mechanics/terrain bonuses — a future hook, not built now.)
  terrains: {
    plains:  { icon: '🌾', desc: 'Terbuka luas, ideal untuk formasi besar dan kavaleri.' },
    forest:  { icon: '🌲', desc: 'Rimbun dan tersembunyi, cocok untuk gerilya dan pemanah.' },
    mountain:{ icon: '⛰️', desc: 'Tinggi dan sulit, cocok untuk bertahan dan pengintaian.' },
    coastal: { icon: '🌊', desc: 'Perbatasan air, jalur logistik dan serangan dadakan.' },
    swamp:   { icon: '🐊', desc: 'Becek dan berbahaya, menguji kesabaran dan disiplin.' },
    urban:   { icon: '🏰', desc: 'Kota dan benteng, medan politik dan pertahanan berlapis.' },
  },

  // Trait pool — quiz tallies points per trait across 8 dedicated
  // questions; the 4 highest-scoring traits become the character's
  // permanent trait slots. `affinity` just documents which stat
  // theme a trait leans toward — not used in the scoring math itself.
  traits: {
    'Inspiring':          { affinity: 'leadership',       desc: 'Menaikkan semangat pasukan di sekitarnya.' },
    'Commanding Presence':{ affinity: 'leadership',       desc: 'Perintahnya jarang diragukan.' },
    'Iron Will':          { affinity: 'martialDiscipline',desc: 'Tak gentar walau terluka parah.' },
    'Relentless':         { affinity: 'martialDiscipline',desc: 'Terus menekan tanpa jeda.' },
    'Unshakeable':        { affinity: 'calmDiscipline',   desc: 'Tenang bahkan saat formasi runtuh.' },
    'Patient Tactician':  { affinity: 'calmDiscipline',   desc: 'Menunggu momen yang tepat, bukan yang cepat.' },
    'Battlefield Genius': { affinity: 'battleIntellect',  desc: 'Membaca pola musuh lebih cepat dari mereka sendiri.' },
    'Adaptive':           { affinity: 'battleIntellect',  desc: 'Mengubah taktik di tengah pertempuran tanpa ragu.' },
    'Scholar':            { affinity: 'intellectual',     desc: 'Belajar dari setiap pertempuran, menang atau kalah.' },
    'Strategist':         { affinity: 'intellectual',     desc: 'Melihat papan penuh, bukan cuma satu langkah.' },
    'Silver Tongue':      { affinity: 'political',        desc: 'Bisa meyakinkan siapa saja, kapan saja.' },
    'Diplomat':           { affinity: 'political',        desc: 'Mencari jalan damai sebelum jalan pedang.' },
    'Fearless':           { affinity: 'martialDiscipline',desc: 'Tidak mengenal ragu di depan bahaya.' },
    'Lucky':              { affinity: 'battleIntellect',  desc: 'Entah bagaimana, selalu selamat dari yang terburuk.' },
    'Reckless':           { affinity: 'martialDiscipline',desc: 'Menyerang duluan, berpikir belakangan.' },
    'Loyal':              { affinity: 'leadership',       desc: 'Setia sampai pertempuran terakhir.' },
    'Ambitious':          { affinity: 'political',        desc: 'Selalu mengincar posisi yang lebih tinggi.' },
    'Stoic':              { affinity: 'calmDiscipline',   desc: 'Emosi tak pernah terlihat di wajahnya.' },
  },

  // Talent grade tiers, low to high. Characters start low (D/D+/C
  // range) since this is a STARTER stat — climbing this ladder is
  // meant to take actual play, not one quiz.
  talentGrades: ['D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'Legend'],

  // Tech trees — promotion path per base unit type. Not wired into
  // any gameplay/UI yet (no promotion flow exists), this is the data
  // shape for when that's built.
  techTrees: {
    sword: {
      tier1: 'Swordsman',
      tier2: 'Infantry',
      tier3: ['Heavy Infantry', 'Duelist'],
    },
    archer: {
      tier1: 'Archer',
      tier2: 'Marksman',
      tier3: ['Ranger', 'Sharpshooter'],
    },
    horse: {
      tier1: 'Horseman',
      tier2: 'Cavalry',
      tier3: ['Lancer', 'Outrider'],
    },
    spear: {
      tier1: 'Spearman',
      tier2: 'Phalanx',
      tier3: ['Pikeman', 'Phalanx Warden'],
    },
  },

};

// ─────────────────────────────────────────────────────
//  HELPER FUNCTIONS
//  Fungsi kecil yang dipakai semua file
// ─────────────────────────────────────────────────────

// Ambil random weather berdasarkan key
function getRandomWeather() {
  const keys = Object.keys(GLITZ_CONFIG.weather);
  // Hanya sun/rain/moon untuk v1 — fog & snow dilock
  const v1Keys = ['sun', 'rain', 'moon'];
  const key = v1Keys[Math.floor(Math.random() * v1Keys.length)];
  return { id: key, ...GLITZ_CONFIG.weather[key] };
}

// Ambil random wind
function getRandomWind() {
  const winds = GLITZ_CONFIG.winds;
  return winds[Math.floor(Math.random() * winds.length)];
}

// Hitung combat title dari usage stats
function getCombatTitle(inf, arch, horse, spear) {
  const total = inf + arch + horse + spear;
  if (total === 0) return 'Recruit';
  const i = inf/total, a = arch/total, h = horse/total, s = spear/total;

  if (i >= 0.65 && h <= 0.1)  return 'Iron Linebreaker';
  if (h >= 0.65 && a <= 0.1)  return 'Blitz Cavalry';
  if (a >= 0.65 && i <= 0.1)  return 'Phantom Skirmisher';
  if (s >= 0.5)                return 'Phalanx Warden';
  if (i >= 0.4 && a >= 0.2 && h >= 0.2) return 'Balanced Vanguard';
  if (a >= 0.4 && i >= 0.2 && h >= 0.2) return 'Eagle Eye Marksman';
  if (h >= 0.4 && i >= 0.2 && a >= 0.2) return 'Swift Flanker';
  return 'Tactical Commander';
}

// Ambil deskripsi title
function getTitleDesc(title) {
  return GLITZ_CONFIG.titles[title] || GLITZ_CONFIG.titles['Recruit'];
}

// Starting talent grade per unit type, from clan stats. Deliberately
// capped low (index 0-3, i.e. D through C+) — this is a STARTER
// grade, climbing past that is meant to take real play, not one quiz.
// The unit type whose relevant stats score highest gets +1 tier as
// a natural talent bonus.
function getStartingTalentGrade(unitType, stats) {
  const relevantPairs = {
    sword: ['martialDiscipline', 'battleIntellect'],
    archer: ['calmDiscipline', 'battleIntellect'],
    horse: ['leadership', 'martialDiscipline'],
    spear: ['martialDiscipline', 'calmDiscipline'],
  };
  const pair = relevantPairs[unitType] || ['battleIntellect', 'battleIntellect'];
  const score = (stats[pair[0]] || 0) + (stats[pair[1]] || 0); // 0-40 range (each stat 0-20)

  let tier = 0; // D
  if (score >= 24) tier = 3;      // C+
  else if (score >= 18) tier = 2; // C
  else if (score >= 12) tier = 1; // D+

  return { grade: GLITZ_CONFIG.talentGrades[tier], tierIndex: tier };
}

// Computes starting grades for all 4 unit types at once, and marks
// which one is the character's best natural affinity (+1 tier bonus).
function getAllStartingTalents(stats) {
  const types = ['sword', 'archer', 'horse', 'spear'];
  const raw = types.map(t => ({ type: t, ...getStartingTalentGrade(t, stats) }));
  const best = raw.reduce((a, b) => (b.tierIndex > a.tierIndex ? b : a), raw[0]);
  const maxTier = GLITZ_CONFIG.talentGrades.length - 1;
  best.tierIndex = Math.min(best.tierIndex + 1, maxTier);
  best.grade = GLITZ_CONFIG.talentGrades[best.tierIndex];
  const result = {};
  raw.forEach(r => { result[r.type] = { grade: r.grade, tierIndex: r.tierIndex }; });
  return result;
}

