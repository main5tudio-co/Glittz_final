// ─────────────────────────────────────────────────────
//  CONDITION AUDIO  (asset/audfx/condition/)
//  One file per class. Segmented by HP or Stamina tier:
//    fresh    (>=90%)  0:00–0:04
//    normal   (50-89%) 0:04–0:08
//    low      (25-49%) 0:08–0:12
//    critical (<25%)   0:12–0:16
//  Add the file path once recorded; leave null until then.
// ─────────────────────────────────────────────────────
const CONDITION_AUDIO = {
  sword:  { file: null, segments: { fresh: [0,4], normal: [4,8], low: [8,12], critical: [12,16] } },
  archer: { file: null, segments: { fresh: [0,4], normal: [4,8], low: [8,12], critical: [12,16] } },
  horse:  { file: null, segments: { fresh: [0,4], normal: [4,8], low: [8,12], critical: [12,16] } },
  spear:  { file: null, segments: { fresh: [0,4], normal: [4,8], low: [8,12], critical: [12,16] } },
};

function getConditionTier(percent) {
  if (percent >= 90) return 'fresh';
  if (percent >= 50) return 'normal';
  if (percent >= 25) return 'low';
  return 'critical';
}

// Decodes and caches the full file once per class (Web Audio API,
// same idea as playTapSegment) — cheap after first load.
const _conditionBufferCache = {};
async function loadConditionBuffer(audioCtx, type) {
  if (_conditionBufferCache[type]) return _conditionBufferCache[type];
  const cfg = CONDITION_AUDIO[type];
  if (!cfg || !cfg.file) return null; // not recorded yet — silent
  const resp = await fetch(cfg.file);
  const arr = await resp.arrayBuffer();
  const buffer = await audioCtx.decodeAudioData(arr);
  buffer._segments = cfg.segments;
  _conditionBufferCache[type] = buffer;
  return buffer;
}

// Call this whenever you want a condition cue — e.g. on unit tap-select,
// or right after taking damage. `percent` = the HP% or Stamina% you're
// gating on (pick whichever governs "condition" for your design).
async function playConditionCue(audioCtx, unit, percent) {
  const buffer = await loadConditionBuffer(audioCtx, unit.type);
  if (!buffer) return;
  const tier = getConditionTier(percent);
  const [start, end] = buffer._segments[tier];
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(0, start, end - start);
}
