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
  },
  {
    id: 'mizuchi', scroll: 2, name: 'Mizuchi', title: 'Tide Serpent of the Drowned Gate',
    element: 'water', weakness: 'lightning', hp: 330,
    attacks: ['jet', 'wave'],
    blurb: 'She floods the ink-wells every spring and will not apologise.',
  },
  {
    id: 'arashi', scroll: 3, name: 'Arashi', title: 'Gale Crow of the Broken Sky',
    element: 'wind', weakness: 'ice', hp: 430,
    attacks: ['blade', 'dive'],
    blurb: 'His wings are the storm; his shadow is the warning.',
  },
  {
    id: 'raiko', scroll: 4, name: 'Raiko', title: 'Storm Kirin of the Iron Peaks',
    element: 'lightning', weakness: 'earth', hp: 540,
    attacks: ['bolt', 'orb'],
    blurb: 'A kirin who answers every question with thunder.',
  },
  {
    id: 'iwao', scroll: 5, name: 'Iwao', title: 'Mountain Golem of the Sleeping Stone',
    element: 'earth', weakness: 'ice', hp: 680,
    attacks: ['rock', 'spikes'],
    blurb: 'He has been napping for three centuries. You woke him.',
  },
  {
    id: 'hikari', scroll: 6, name: 'Hikari', title: 'Dawn Phoenix of the White Sun',
    element: 'light', weakness: 'dark', hp: 820,
    attacks: ['beam', 'feather'],
    blurb: 'Her dawn never ends, and neither does her temper.',
  },
  {
    id: 'yami', scroll: 7, name: 'Yami', title: 'Ink Dragon of the Final Scroll',
    element: 'dark', weakness: 'light', hp: 1000,
    attacks: ['orb', 'pool', 'summon'],
    blurb: 'The dragon that drank the master\u2019s ink. End the story.',
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
    desc: 'Six storm strikes in a heartbeat. Rapid multi-hit damage.',
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
