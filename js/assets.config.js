// ═══════════════════════════════════════════════════════
//  GLITZ — ASSET CONNECTOR
//  js/assets.config.js
//  Satu tempat untuk semua path asset + audio sprite segments.
//  Kalau nambah/rename file di GitHub asset/ folder, cukup
//  update object di bawah — nggak perlu sentuh battle logic.
// ═══════════════════════════════════════════════════════

const ASSET_ROOT = 'asset';

// ─────────────────────────────────────────────────────
//  3D MODELS  (asset/units/)
// ─────────────────────────────────────────────────────
const UNIT_MODELS = {
  sword:  `${ASSET_ROOT}/units/swordman.gltf`,
  archer: `${ASSET_ROOT}/units/archer.gltf`,
  horse:  `${ASSET_ROOT}/units/horseman.gltf`,
  spear:  `${ASSET_ROOT}/units/spearman.gltf`,
};

// ─────────────────────────────────────────────────────
//  UNIT AUDIO  (asset/audfx/)
//  Sekarang baru ada 7 file, belum lengkap a-f per unit.
//  Setiap kategori punya fallback ke file umum kalau
//  file khusus unit itu belum ada — jadi nggak error,
//  tinggal isi filenya belakangan pas asset nambah.
//
//  tap: satu file, dibagi jadi 3 segmen waktu (start/end
//  detik) sesuai brief kamu — 90% / 60% / 20% confidence.
//  Ganti angka start/end setelah kamu tau durasi asli file.
// ─────────────────────────────────────────────────────
const UNIT_AUDIO = {
  sword: {
    tap:        { file: `${ASSET_ROOT}/audfx/Swordmen.. ready.wav`, segments: { high: [0, 0.6], mid: [0.6, 1.3], low: [1.3, 2.0] } },
    move:       `${ASSET_ROOT}/audfx/step march foot.wav`,
    attack:     `${ASSET_ROOT}/audfx/sword sure.wav`,
    critical:   null,   // TODO: belum ada file — fallback ke attack
    hit:        null,   // TODO: suara kena damage (defender)
    special:    null,   // TODO: suara trigger efek khusus (turn/push/run)
    defCritical:null,   // LATER: nunggu mechanic block/parry ada dulu
    lose:       null,   // TODO
  },
  archer: {
    tap:        { file: `${ASSET_ROOT}/audfx/tapped_common.wav`, segments: { high: [0, 0.6], mid: [0.6, 1.3], low: [1.3, 2.0] } },
    move:       `${ASSET_ROOT}/audfx/step march foot.wav`,
    attack:     `${ASSET_ROOT}/audfx/fly archers.wav`,
    critical:   null,
    hit:        null,
    special:    null,
    defCritical:null,
    lose:       null,
  },
  horse: {
    tap:        { file: `${ASSET_ROOT}/audfx/horsie tapp.wav`, segments: { high: [0, 0.6], mid: [0.6, 1.3], low: [1.3, 2.0] } },
    move:       `${ASSET_ROOT}/audfx/horse manuver.wav`,
    attack:     null,   // TODO
    critical:   null,
    hit:        null,
    special:    null,   // TODO: neigh/charge saat trigger 'run'
    defCritical:null,
    lose:       null,
  },
  spear: {
    tap:        { file: `${ASSET_ROOT}/audfx/tapped_common.wav`, segments: { high: [0, 0.6], mid: [0.6, 1.3], low: [1.3, 2.0] } },
    move:       `${ASSET_ROOT}/audfx/step march foot.wav`,
    attack:     null,   // TODO
    critical:   null,
    hit:        null,
    special:    null,   // TODO: brace sound saat trigger 'push'
    defCritical:null,
    lose:       null,
  },
};

// ─────────────────────────────────────────────────────
//  AMBIENCE  (asset/audfx/ambience/ — belum dibuat)
//  Loop bed pelan di bawah BGM + one-shot acak per weather.
//  Semua null sekarang — tinggal isi filename pas ada asset,
//  ambient system di battle.html udah siap pakai ini langsung.
// ─────────────────────────────────────────────────────
const AMBIENCE = {
  Moon: { loopBed: null, oneShots: [] },  // TODO: owl hoot, distant wolf, twig snap
  Sun:  { loopBed: null, oneShots: [] },  // TODO: bird chirps, wind gust
  Rain: { loopBed: null, oneShots: [] },  // optional: closer thunder crack
};

// ─────────────────────────────────────────────────────
//  BGM  (asset/bgm/)
//  Split by weather so the right mood plays under the right
//  sky — previously one slot played for every weather roll,
//  which is why rain/thunder played under a sunny "Sun" draw.
//  Each key only fires when STATE.weather.id matches; null
//  means silent (no wrong-mood fallback) until a real track
//  is recorded and tagged for that weather.
// ─────────────────────────────────────────────────────
const BGM_TRACKS = {
  weatherSun:   null,   // TODO: bright/day track not recorded yet
  weatherMoon:  null,   // TODO: night track not recorded yet
  weatherRain:  `${ASSET_ROOT}/bgm/rainy_thunder_field.ogg`, // matches its own name/tag
  firstConflict:`${ASSET_ROOT}/bgm/confront_trigger.ogg`,
  nearVictory:  null,   // TODO: belum ada file
  toughFight:   null,   // TODO: belum ada file
};

// ─────────────────────────────────────────────────────
//  TERRAIN  (asset/terrain/object/, asset/terrain/texture/)
//  Belum ada file model — masih placeholder txt.
// ─────────────────────────────────────────────────────
const TERRAIN_OBJECTS = {
  tree: null,  // TODO
  bush: null,  // TODO
  rock: null,  // TODO
};

// ─────────────────────────────────────────────────────
//  HELPER — play a tap segment by confidence tier
//  Sama pola dengan gunshot sprite: 1 buffer, banyak segmen,
//  irit HTTP request buat mobile.
// ─────────────────────────────────────────────────────
function playTapSegment(audioCtx, buffer, tier /* 'high' | 'mid' | 'low' */) {
  const unitKey = Object.keys(UNIT_AUDIO).find(k => UNIT_AUDIO[k].tap);
  // Caller biasanya sudah tau unit-nya; contoh generic:
  const seg = buffer._segments?.[tier];
  if (!seg) return;
  const [start, end] = seg;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0, start, end - start);
}

// Resolve audio path with fallback, so missing files don't crash the game.
// Only 'critical' borrows the attack sound as a placeholder — hit/special/
// defCritical/lose stay silent (return null) until real files are added,
// so we don't play a confusing "wrong" sound in their place.
function resolveUnitSound(unitType, category) {
  const unit = UNIT_AUDIO[unitType];
  if (!unit) return null;
  const entry = unit[category];
  if (entry && typeof entry === 'string') return entry;
  if (entry && entry.file) return entry.file;
  if (category === 'critical') return unit.attack || null;
  if (category === 'tap') return `${ASSET_ROOT}/audfx/tapped_common.wav`;
  return null;
}
