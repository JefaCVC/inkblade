// INKBLADE configuration: the canvas, the eight elements with their kanji
// stroke templates, the elemental wheel, the seven bosses and the shop.
// Every number the game balances on lives here, so tuning never touches logic.

export const VIEW = { width: 1024, height: 576 };

// The ink pad (casting box) on the right of the combat screen. Wider and
// taller than v1: the drawing must feel central, not a side panel.
export const PAD = { x: 700, y: 104, w: 300, h: 292 };
// The arena where the painter and the boss fight, left of the pad. It
// starts below the WIN/LOSE strip (y 80..104) and keeps its old bottom edge.
export const ARENA = { x: 24, y: 112, w: 664, h: 364 };

// The WIN/LOSE strip between the boss plate and the arena, and the fusion
// banner geometry — exported so the smoke test can prove float texts never
// overlap the banner.
export const WINLOSE_STRIP = { x: 24, y: 80, w: 664, h: 24 };
export const BANNER = { w: 430, h: 72, cy: 158 }; // centred on the arena, y 122..194

// The bottom row below the arena (y 484..568): the live fight record and
// the discovered fusion seals. It spans exactly the arena's width and
// stops 8px short of the screen edge; the ink pad panel owns the right
// side, so the row never crosses x 688.
export const BOTTOM_ROW = { x: 24, y: 484, w: 664, h: 84 };
export const BATTLE_RECORD_PANEL = { x: 24, y: 484, w: 400, h: 84 };
export const FUSION_SEALS_PANEL = { x: 432, y: 484, w: 256, h: 84 };

// Boss minions: small spirits per element that drift toward the painter.
export const MINIONS = {
  fire: { name: 'Ember Imp', color: '#ff922b' },
  water: { name: 'Tide Wisp', color: '#4dabf7' },
  wind: { name: 'Gale Mite', color: '#69db7c' },
  lightning: { name: 'Spark Imp', color: '#ffd43b' },
  earth: { name: 'Pebble Imp', color: '#d0a06a' },
  light: { name: 'Dawn Mote', color: '#ffe066' },
  dark: { name: 'Shade Wisp', color: '#b197fc' },
};

export const PLAYER = {
  maxHp: 100,
  radius: 16,
  speed: 230,
  startX: 150,
  startY: 380,
};

export const INK = {
  max: 100,
  refillPerSecond: 6,
  refillPerHit: 8,
  perfectBonus: 15,
  fizzleCost: 4,
};

export const COMBO = { windowSeconds: 6, stepDamage: 0.1, maxMultiplier: 2.0 };

// Each element: its kanji, its colour, its ink cost, its base damage and the
// simplified seal-script strokes the player draws (each stroke a list of
// [x, y] points in a 0..1 box, x right, y down, in stroke order).
export const ELEMENTS = [
  {
    id: 'fire', kanji: '火', name: 'Fire', color: '#e8590c', glow: '#ff922b',
    cost: 18, damage: 34, effect: 'burn',
    desc: 'Burning bolt. Scorches the boss for damage over time.',
    strokes: [
      [[0.50, 0.06], [0.50, 0.26]],
      [[0.50, 0.34], [0.32, 0.52], [0.20, 0.74]],
      [[0.50, 0.34], [0.68, 0.52], [0.80, 0.74]],
      [[0.30, 0.86], [0.50, 0.72], [0.70, 0.86]],
    ],
  },
  {
    id: 'water', kanji: '水', name: 'Water', color: '#1971c2', glow: '#4dabf7',
    cost: 20, damage: 30, effect: 'knockback',
    desc: 'Crashing blast. Knocks the boss back and interrupts attacks.',
    strokes: [
      [[0.50, 0.08], [0.50, 0.55], [0.58, 0.72]],
      [[0.36, 0.24], [0.20, 0.44]],
      [[0.64, 0.24], [0.80, 0.44]],
      [[0.26, 0.68], [0.50, 0.86], [0.74, 0.68]],
    ],
  },
  {
    id: 'lightning', kanji: '雷', name: 'Lightning', color: '#e67700', glow: '#ffd43b',
    cost: 24, damage: 40, effect: 'chain',
    desc: 'Chain strike. The bolt arcs to every summon the boss has out.',
    strokes: [
      [[0.24, 0.14], [0.76, 0.14]],
      [[0.30, 0.24], [0.30, 0.44]],
      [[0.70, 0.24], [0.70, 0.44]],
      [[0.26, 0.56], [0.74, 0.56], [0.74, 0.86], [0.26, 0.86], [0.26, 0.56]],
    ],
  },
  {
    id: 'wind', kanji: '風', name: 'Wind', color: '#2b8a3e', glow: '#69db7c',
    cost: 16, damage: 26, effect: 'blades',
    desc: 'Three slicing blades. Cheap and fast; hits three times.',
    strokes: [
      [[0.20, 0.14], [0.80, 0.14], [0.80, 0.34]],
      [[0.30, 0.42], [0.70, 0.42]],
      [[0.36, 0.52], [0.30, 0.70], [0.46, 0.86]],
      [[0.64, 0.52], [0.70, 0.70], [0.54, 0.86]],
    ],
  },
  {
    id: 'earth', kanji: '土', name: 'Earth', color: '#8d5a2b', glow: '#d0a06a',
    cost: 22, damage: 22, effect: 'shield',
    desc: 'Stone shield plus rising spikes. Blocks the next boss hit.',
    strokes: [
      [[0.30, 0.20], [0.70, 0.20]],
      [[0.50, 0.26], [0.50, 0.86]],
      [[0.20, 0.86], [0.80, 0.86]],
    ],
  },
  {
    id: 'ice', kanji: '氷', name: 'Ice', color: '#1098ad', glow: '#66d9e8',
    cost: 20, damage: 28, effect: 'freeze',
    desc: 'Freezing shard. Slows the boss and its attacks for 4 seconds.',
    strokes: [
      [[0.20, 0.22], [0.30, 0.34]],
      [[0.20, 0.48], [0.32, 0.60]],
      [[0.56, 0.12], [0.56, 0.86]],
      [[0.56, 0.50], [0.80, 0.76], [0.86, 0.58]],
    ],
  },
  {
    id: 'light', kanji: '光', name: 'Light', color: '#b58900', glow: '#ffe066',
    cost: 35, damage: 62, effect: 'beam',
    desc: 'Holy beam. Huge damage, heavy ink cost. Darkness fears it.',
    strokes: [
      [[0.24, 0.18], [0.76, 0.18]],
      [[0.50, 0.24], [0.50, 0.58]],
      [[0.50, 0.58], [0.30, 0.86]],
      [[0.50, 0.58], [0.70, 0.86]],
    ],
  },
  {
    id: 'dark', kanji: '闇', name: 'Dark', color: '#5f3dc4', glow: '#b197fc',
    cost: 28, damage: 36, effect: 'drain',
    desc: 'Shadow drain. Wounds the boss and heals you for half the damage.',
    strokes: [
      [[0.20, 0.14], [0.80, 0.14]],
      [[0.26, 0.20], [0.26, 0.80]],
      [[0.26, 0.46], [0.74, 0.46]],
      [[0.74, 0.20], [0.74, 0.80]],
      [[0.26, 0.80], [0.80, 0.80]],
    ],
  },
];

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));

// The elemental wheel: attacker id -> ids it is strong against (2x damage).
// Water douses Fire, Fire feeds on Wind, Wind scatters Lightning, Lightning
// splits Water, Earth grounds Lightning, Ice stills Wind and shatters Earth,
// and Light and Dark oppose each other.
export const STRONG_AGAINST = {
  water: ['fire'],
  fire: ['wind'],
  wind: ['lightning'],
  lightning: ['water'],
  earth: ['lightning'],
  ice: ['wind', 'earth'],
  light: ['dark'],
  dark: ['light'],
};

export function effectiveness(attackerId, defenderId) {
  if ((STRONG_AGAINST[attackerId] ?? []).includes(defenderId)) return 2;
  if ((STRONG_AGAINST[defenderId] ?? []).includes(attackerId)) return 0.5;
  if (attackerId === defenderId) return 0.5;
  return 1;
}

// The seven scrolls: one boss each. hp grows down the campaign; every boss
// has an element, a weakness, a title and its own attack patterns.
export const BOSSES = [
  {
    id: 'kagaribi', scroll: 1, name: 'Kagaribi', title: 'Ember Oni of the First Flame',
    element: 'fire', weakness: 'water', hp: 240,
    attacks: ['fireball', 'ember'],
    blurb: 'A lantern-demon who mistook the temple for kindling.',
    tip: 'Water douses flame. Draw 水 first, and mind the embers.',
  },
  {
    id: 'mizuchi', scroll: 2, name: 'Mizuchi', title: 'Tide Serpent of the Drowned Gate',
    element: 'water', weakness: 'lightning', hp: 330,
    attacks: ['jet', 'wave'],
    blurb: 'She floods the ink-wells every spring and will not apologise.',
    tip: 'Lightning chains through water, and through her wisps.',
  },
  {
    id: 'arashi', scroll: 3, name: 'Arashi', title: 'Gale Crow of the Broken Sky',
    element: 'wind', weakness: 'ice', hp: 430,
    attacks: ['blade', 'dive'],
    blurb: 'He dives out of the sky without a sound. His shadow is the only warning.',
    tip: 'Ice stills the gale. Freeze him, then strike while he dives.',
  },
  {
    id: 'raiko', scroll: 4, name: 'Raiko', title: 'Storm Kirin of the Iron Peaks',
    element: 'lightning', weakness: 'earth', hp: 540,
    attacks: ['bolt', 'orb'],
    blurb: 'A kirin who answers every question with thunder.',
    tip: 'Earth grounds lightning. Raise 土 before his bolts land.',
  },
  {
    id: 'iwao', scroll: 5, name: 'Iwao', title: 'Mountain Golem of the Sleeping Stone',
    element: 'earth', weakness: 'ice', hp: 680,
    attacks: ['rock', 'spikes'],
    blurb: 'He has been napping for three centuries. You woke him.',
    tip: 'Ice shatters stone. Freeze, then shatter with Deep Freeze.',
  },
  {
    id: 'hikari', scroll: 6, name: 'Hikari', title: 'Dawn Phoenix of the White Sun',
    element: 'light', weakness: 'dark', hp: 820,
    attacks: ['beam', 'feather'],
    blurb: 'Her dawn never ends, and neither does her temper.',
    tip: 'Dark drinks the dawn. Draw 闇 against her light.',
  },
  {
    id: 'yami', scroll: 7, name: 'Yami', title: 'Ink Dragon of the Final Scroll',
    element: 'dark', weakness: 'light', hp: 1000,
    attacks: ['orb', 'pool', 'summon'],
    blurb: 'The dragon that drank the master\u2019s ink. He holds the final scroll.',
    tip: 'Light banishes the dark dragon. Save 光 for the end.',
  },
];

// Shop upgrades between scrolls, bought with ink-essence earned in combat.
export const UPGRADES = [
  { id: 'well', name: 'Deep Ink Well', desc: '+25 max ink', cost: 60, max: 3, apply: (u) => { u.maxInk += 25; } },
  { id: 'flow', name: 'Flowing Brush', desc: '+2 ink per second', cost: 50, max: 3, apply: (u) => { u.refill += 2; } },
  { id: 'power', name: 'Heavy Stroke', desc: '+15% spell damage', cost: 70, max: 4, apply: (u) => { u.damage += 0.15; } },
  { id: 'heart', name: 'Steady Heart', desc: '+20 max HP, heal 20', cost: 55, max: 3, apply: (u) => { u.maxHp += 20; u.hp = Math.min(u.maxHp, u.hp + 20); } },
  { id: 'chain', name: 'Long Combo', desc: '+1.5s combo window', cost: 45, max: 2, apply: (u) => { u.comboWindow += 1.5; } },
  { id: 'ward', name: 'Paper Ward', desc: 'Start each fight shielded', cost: 80, max: 1, apply: (u) => { u.startShielded = true; } },
];

// --- Difficulties (chosen on the menu, stored per run) ---
export const DIFFICULTIES = [
  {
    id: 'student', name: 'Student', kanji: '学', color: '#69db7c',
    desc: 'Gentle ink. Weaker bosses, smaller scores.',
    bossHpMul: 0.8, bossDmgMul: 0.8, scoreMul: 0.75,
  },
  {
    id: 'calligrapher', name: 'Calligrapher', kanji: '書', color: '#74c0fc',
    desc: 'The intended road. Bosses at full strength, scores at full value.',
    bossHpMul: 1, bossDmgMul: 1, scoreMul: 1,
  },
  {
    id: 'master', name: 'Grand Master', kanji: '師', color: '#ffd43b',
    desc: 'Tougher bosses, bigger scores.',
    bossHpMul: 1.3, bossDmgMul: 1.25, scoreMul: 1.5,
  },
];

export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));

// --- Blessings: the pick-1-of-3 draft between scrolls. Each blessing is
// free, applies to the run, and lasts for the rest of the campaign. RARE
// cards are stronger; one is a trade-off (+damage, -max HP).
export const BLESSINGS = [
  { id: 'inkwell', name: 'Deep Well', icon: '墨', rarity: 'COMMON', desc: '+25 max ink', apply: (run) => { run.maxInk += 25; } },
  { id: 'heavy', name: 'Heavy Stroke', icon: '筆', rarity: 'COMMON', desc: '+10% spell damage', apply: (run) => { run.damage += 0.1; } },
  { id: 'swift', name: 'Swift Brush', icon: '疾', rarity: 'COMMON', desc: '+2 ink per second', apply: (run) => { run.refill += 2; } },
  { id: 'heart', name: 'Steady Heart', icon: '心', rarity: 'COMMON', desc: '+20 max HP, heal 20', apply: (run) => { run.maxHp += 20; run.hp = Math.min(run.maxHp, run.hp + 20); } },
  { id: 'chain', name: 'Long Combo', icon: '連', rarity: 'COMMON', desc: '+1.5s combo window', apply: (run) => { run.comboWindow += 1.5; } },
  { id: 'harvest', name: 'Ink Harvest', icon: '金', rarity: 'COMMON', desc: '+60 essence now', apply: (run) => { run.essence += 60; } },
  { id: 'ward', name: 'Paper Ward', icon: '守', rarity: 'RARE', desc: 'Start every fight shielded', apply: (run) => { run.startShielded = true; } },
  { id: 'fuse', name: 'Patient Ink', icon: '忍', rarity: 'RARE', desc: '+1s fusion window', apply: (run) => { run.fusionWindow += 1; } },
  { id: 'glass', name: 'Glass Cannon', icon: '砕', rarity: 'RARE', desc: '+25% damage, −20 max HP', tradeoff: true, apply: (run) => { run.damage += 0.25; run.maxHp = Math.max(40, run.maxHp - 20); run.hp = Math.min(run.hp, run.maxHp); } },
];

export const BLESSING_BY_ID = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));

// --- Feats (achievements): ten named deeds, persisted across runs. ---
export const FEATS = [
  { id: 'first-seal', icon: '封', name: 'First Seal', desc: 'Seal your first scroll' },
  { id: 'first-fusion', icon: '炎', name: 'First Fusion', desc: 'Cast your first fusion combo' },
  { id: 'all-combos', icon: '嵐', name: 'Master of Fusions', desc: 'Discover all 6 fusion combos' },
  { id: 'perfect-fight', icon: '完', name: 'Flawless Brush', desc: 'Win a fight with 100% accuracy' },
  { id: 'no-damage', icon: '盾', name: 'Untouched', desc: 'Win a fight without taking damage' },
  { id: 's-grade', icon: '優', name: 'Grade S', desc: 'Earn an S grade in a fight' },
  { id: 'all-scrolls', icon: '龍', name: 'Dragon Sealer', desc: 'Seal all 7 scrolls' },
  { id: 'hundred-casts', icon: '百', name: 'Hundred Casts', desc: 'Cast 100 spells in total' },
  { id: 'first-dan', icon: '初', name: 'First Dan', desc: 'Reach 1st Dan rank' },
  { id: 'master-campaign', icon: '師', name: 'Grand Master', desc: 'Seal the campaign on Grand Master' },
];

export const FEAT_BY_ID = Object.fromEntries(FEATS.map((f) => [f.id, f]));

// --- Roads: the branching choice between scrolls. A modifier, not a
// route reorder — the next scroll is fixed, but the road changes the
// fight (and the reward) that waits at its end.
export const ROADS = [
  {
    id: 'mountain', name: 'Mountain Path', icon: '山',
    risk: 'Boss minions +50% HP', reward: '+60 essence',
    apply: (run) => { run.essence += 60; run.roadMinionHpMul = 1.5; },
  },
  {
    id: 'river', name: 'River Path', icon: '川',
    risk: '−20 max ink this fight', reward: 'Boss starts at 90% HP',
    apply: (run) => { run.roadInkPenalty = 20; run.roadBossHpMul = 0.9; },
  },
];

export const ROAD_BY_ID = Object.fromEntries(ROADS.map((r) => [r.id, r]));

// Campaign grade from the seven per-scroll grades (S=4, A=3, B=2, C=1).
export function campaignGrade(scrollGrades) {
  const values = { S: 4, A: 3, B: 2, C: 1 };
  const filled = scrollGrades.filter((g) => g);
  if (filled.length === 0) return 'C';
  const avg = filled.reduce((sum, g) => sum + (values[g] ?? 1), 0) / filled.length;
  if (avg >= 3.5) return 'S';
  if (avg >= 2.5) return 'A';
  if (avg >= 1.5) return 'B';
  return 'C';
}
export const PERFECT_THRESHOLD = 0.9;
export const CAST_THRESHOLD = 0.55;
export const CAST_PAUSE_MS = 900; // auto-cast this long after the last stroke

// --- Elemental combo spells (fusion) ---
// Cast two elements in sequence inside the fusion window and the second cast
// becomes a fused combo spell instead: bigger damage, a unique name and its
// own visual. Pairs match in either order. Combos cost more ink than either
// of their parts.
export const FUSION_WINDOW_BASE = 4;
export const COMBOS = [
  {
    id: 'firestorm', first: 'fire', second: 'wind', name: 'Firestorm', kanji: '炎嵐',
    damage: 95, cost: 30, effect: 'burn',
    desc: 'A whirling storm of flame. Heavy damage and the boss burns for 6 seconds.',
    color: '#e8590c', glow: '#ff922b',
  },
  {
    id: 'stormsurge', first: 'water', second: 'lightning', name: 'Storm Surge', kanji: '雷雨',
    damage: 105, cost: 32, effect: 'chain',
    desc: 'Lightning through water. Full damage to the boss and every summon it has out.',
    color: '#1971c2', glow: '#74c0fc',
  },
  {
    id: 'magma', first: 'fire', second: 'earth', name: 'Magma Eruption', kanji: '熔岩',
    damage: 120, cost: 34, effect: 'burn',
    desc: 'The ground splits and fire pours out. Heavy burst plus a 5-second burn.',
    color: '#c92a2a', glow: '#ff6b35',
  },
  {
    id: 'deepfreeze', first: 'water', second: 'ice', name: 'Deep Freeze', kanji: '氷結',
    damage: 90, cost: 30, effect: 'freeze',
    desc: 'Freezes the boss solid for 7 seconds and shatters it for bonus damage.',
    color: '#1098ad', glow: '#99e9f2',
  },
  {
    id: 'tempest', first: 'wind', second: 'lightning', name: 'Tempest', kanji: '嵐',
    damage: 110, cost: 30, effect: 'blades',
    desc: 'Six storm strikes, one after another.',
    color: '#2b8a3e', glow: '#ffd43b',
  },
  {
    id: 'eclipse', first: 'light', second: 'dark', name: 'Eclipse', kanji: '蝕',
    damage: 180, cost: 55, effect: 'beam',
    desc: 'Light and dark collapse into one another. Massive single hit, very heavy ink cost.',
    color: '#5f3dc4', glow: '#ffe066',
  },
];

export const COMBO_BY_ID = Object.fromEntries(COMBOS.map((c) => [c.id, c]));

// Find the combo for a pair of elements, in either order.
export function findCombo(firstId, secondId) {
  return COMBOS.find(
    (c) => (c.first === firstId && c.second === secondId) || (c.first === secondId && c.second === firstId),
  ) ?? null;
}

// Every combo a given element can start (for the COMBO READY indicator).
export function combosFrom(elementId) {
  return COMBOS.filter((c) => c.first === elementId || c.second === elementId);
}

export function comboPartner(combo, elementId) {
  return combo.first === elementId ? combo.second : combo.first;
}
