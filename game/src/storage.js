// INKBLADE persistence: the local leaderboard (top 10), the match history
// (last 20 runs) and the boss codex, all in localStorage. Nothing leaves
// the machine; a fresh browser simply starts with empty records.

const KEYS = {
  leaderboard: 'inkblade_leaderboard_v1',
  history: 'inkblade_history_v1',
  codex: 'inkblade_codex_v1',
  progress: 'inkblade_progress_v1',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export function loadLeaderboard() {
  const rows = read(KEYS.leaderboard, []);
  return Array.isArray(rows) ? rows : [];
}

export function recordScore(entry) {
  const rows = loadLeaderboard();
  rows.push({ ...entry, date: new Date().toISOString().slice(0, 10) });
  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, 10);
  write(KEYS.leaderboard, top);
  return top;
}

export function loadHistory() {
  const rows = read(KEYS.history, []);
  return Array.isArray(rows) ? rows : [];
}

export function recordRun(entry) {
  const rows = loadHistory();
  rows.unshift({ ...entry, date: new Date().toISOString().slice(0, 10) });
  const kept = rows.slice(0, 20);
  write(KEYS.history, kept);
  return kept;
}

export function loadCodex() {
  return read(KEYS.codex, {});
}

export function recordBossFight(bossId, won, seconds) {
  const codex = loadCodex();
  const row = codex[bossId] ?? { fights: 0, wins: 0, bestSeconds: null };
  row.fights += 1;
  if (won) row.wins += 1;
  if (won && (row.bestSeconds === null || seconds < row.bestSeconds)) row.bestSeconds = seconds;
  codex[bossId] = row;
  write(KEYS.codex, codex);
  return codex;
}

export function loadProgress() {
  const defaults = {
    unlockedScroll: 1, bestScore: 0, campaignWins: 0,
    rankPoints: 0, rankIndex: 0, brushStyle: 'standard', inkColor: 'black',
    combosDiscovered: [],
  };
  const saved = read(KEYS.progress, {});
  return { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export function saveProgress(progress) {
  write(KEYS.progress, progress);
}

export function recordComboDiscovered(progress, comboId) {
  if (!progress.combosDiscovered.includes(comboId)) {
    progress.combosDiscovered.push(comboId);
    saveProgress(progress);
    return true;
  }
  return false;
}
