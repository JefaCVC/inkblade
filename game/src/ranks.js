// INKBLADE calligraphy ranks (kyu/dan, like real shodo ranks). Seventeen
// ranks from 10th Kyu to Grand Calligrapher. Points come from stroke accuracy,
// combos cast, bosses defeated, scrolls completed and no-damage clears.
// Every rank-up grants a new red seal-stamp design plus an unlock: brush
// styles, ink colours, ink capacity, or a longer fusion window.

export const RANKS = [
  { name: '10th Kyu', seal: '十', sealColor: '#c1271b', points: 0, unlock: null },
  { name: '9th Kyu', seal: '九', sealColor: '#c1271b', points: 100, unlock: { type: 'ink', amount: 10, text: '+10 max ink' } },
  { name: '8th Kyu', seal: '八', sealColor: '#c1271b', points: 250, unlock: { type: 'inkColor', id: 'vermilion', name: 'Vermilion Ink', color: '#c1271b', text: 'Ink colour: Vermilion' } },
  { name: '7th Kyu', seal: '七', sealColor: '#c1271b', points: 450, unlock: { type: 'brush', id: 'bold', name: 'Bold Brush', text: 'Brush style: Bold' } },
  { name: '6th Kyu', seal: '六', sealColor: '#c1271b', points: 700, unlock: { type: 'ink', amount: 10, text: '+10 max ink' } },
  { name: '5th Kyu', seal: '五', sealColor: '#c1271b', points: 1000, unlock: { type: 'inkColor', id: 'indigo', name: 'Indigo Ink', color: '#364fc7', text: 'Ink colour: Indigo' } },
  { name: '4th Kyu', seal: '四', sealColor: '#c1271b', points: 1400, unlock: { type: 'brush', id: 'fine', name: 'Fine Brush', text: 'Brush style: Fine' } },
  { name: '3rd Kyu', seal: '三', sealColor: '#c1271b', points: 1900, unlock: { type: 'ink', amount: 15, text: '+15 max ink' } },
  { name: '2nd Kyu', seal: '二', sealColor: '#c1271b', points: 2500, unlock: { type: 'fusion', amount: 1, text: 'Extra combo slot: +1s fusion window' } },
  { name: '1st Kyu', seal: '一', sealColor: '#c1271b', points: 3200, unlock: { type: 'inkColor', id: 'gold', name: 'Gold Ink', color: '#b58900', text: 'Ink colour: Gold' } },
  { name: '1st Dan', seal: '初', sealColor: '#b58900', points: 4000, unlock: { type: 'brush', id: 'splatter', name: 'Splatter Brush', text: 'Brush style: Splatter' } },
  { name: '2nd Dan', seal: '弐', sealColor: '#b58900', points: 5000, unlock: { type: 'ink', amount: 15, text: '+15 max ink' } },
  { name: '3rd Dan', seal: '参', sealColor: '#b58900', points: 6200, unlock: { type: 'fusion', amount: 1, text: 'Extra combo slot: +1s fusion window' } },
  { name: '4th Dan', seal: '四', sealColor: '#b58900', points: 7600, unlock: { type: 'inkColor', id: 'jade', name: 'Jade Ink', color: '#2b8a3e', text: 'Ink colour: Jade' } },
  { name: '5th Dan', seal: '五', sealColor: '#b58900', points: 9200, unlock: { type: 'brush', id: 'master', name: 'Master Brush', text: 'Brush style: Master' } },
  { name: 'Ink Master', seal: '墨', sealColor: '#5f3dc4', points: 12000, unlock: { type: 'ink', amount: 25, text: '+25 max ink' } },
  { name: 'Grand Calligrapher', seal: '神', sealColor: '#862e9c', points: 16000, unlock: { type: 'inkColor', id: 'rainbow', name: 'Rainbow Ink', color: '#f76707', text: 'Ink colour: Rainbow' } },
];

export const BRUSH_STYLES = {
  standard: { name: 'Standard Brush', width: 9, splatter: false, glow: false },
  bold: { name: 'Bold Brush', width: 14, splatter: false, glow: false },
  fine: { name: 'Fine Brush', width: 5, splatter: false, glow: false },
  splatter: { name: 'Splatter Brush', width: 10, splatter: true, glow: false },
  master: { name: 'Master Brush', width: 11, splatter: false, glow: true },
};

export const INK_COLORS = {
  black: { name: 'Black Ink', color: '#1a1512' },
  vermilion: { name: 'Vermilion Ink', color: '#c1271b' },
  indigo: { name: 'Indigo Ink', color: '#364fc7' },
  gold: { name: 'Gold Ink', color: '#b58900' },
  jade: { name: 'Jade Ink', color: '#2b8a3e' },
  rainbow: { name: 'Rainbow Ink', color: '#f76707' },
};

// Rank index from total points (0 = 10th Kyu).
export function rankIndexFromPoints(points) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (points >= RANKS[i].points) index = i;
  }
  return index;
}

// Points still needed for the next rank (null at the top).
export function pointsToNextRank(points) {
  const index = rankIndexFromPoints(points);
  if (index >= RANKS.length - 1) return null;
  return RANKS[index + 1].points - points;
}

// Progress 0..1 toward the next rank (1 at the top).
export function rankProgress(points) {
  const index = rankIndexFromPoints(points);
  if (index >= RANKS.length - 1) return 1;
  const from = RANKS[index].points;
  const to = RANKS[index + 1].points;
  return (points - from) / (to - from);
}

// Total bonus max ink from every ink unlock at or below this rank.
export function inkBonusForRank(rankIndex) {
  let bonus = 0;
  for (let i = 0; i <= rankIndex; i += 1) {
    const u = RANKS[i].unlock;
    if (u && u.type === 'ink') bonus += u.amount;
  }
  return bonus;
}

// Fusion window seconds at this rank (4 base, +1 per fusion unlock).
export function fusionWindowForRank(rankIndex) {
  let bonus = 0;
  for (let i = 0; i <= rankIndex; i += 1) {
    const u = RANKS[i].unlock;
    if (u && u.type === 'fusion') bonus += u.amount;
  }
  return 4 + bonus;
}

// Unlocks available at or below this rank, by type.
export function unlockedBrushes(rankIndex) {
  const ids = ['standard'];
  for (let i = 0; i <= rankIndex; i += 1) {
    const u = RANKS[i].unlock;
    if (u && u.type === 'brush') ids.push(u.id);
  }
  return ids;
}

export function unlockedInkColors(rankIndex) {
  const ids = ['black'];
  for (let i = 0; i <= rankIndex; i += 1) {
    const u = RANKS[i].unlock;
    if (u && u.type === 'inkColor') ids.push(u.id);
  }
  return ids;
}

// Award points and return the rank-up (the new rank object) if one happened.
export function awardRankPoints(progress, points) {
  const before = rankIndexFromPoints(progress.rankPoints);
  progress.rankPoints += points;
  const after = rankIndexFromPoints(progress.rankPoints);
  progress.rankIndex = after;
  if (after > before) return RANKS[after];
  return null;
}
