// INKBLADE entry point: the canvas, the game loop, the state machine and
// the input router. Screens live in screens.js, the fight in combat.js; this
// file only wires them together, keeps the campaign run, and records every
// finished fight in the leaderboard, the history and the codex.

import { BLESSING_BY_ID, BLESSINGS, BOSSES, DIFFICULTY_BY_ID, ELEMENTS, ROAD_BY_ID, UPGRADES, VIEW } from './config.js';
import { createCombat, updateCombat, drawCombat, combatMouseDown, combatMouseMove, combatMouseUp, combatKey, fightGrade } from './combat.js';
import {
  drawMenu, drawScrolls, drawShop, drawDojo, drawCodex, drawLeaderboard,
  drawHistory, drawVictory, drawDefeat, drawPause, drawHelp, drawCombos,
  drawRank, drawTutorial, resetTutorial, drawDraft, drawRoads,
  dojoMouseDown, dojoMouseMove, dojoMouseUp, dojoJudge,
  tutorialMouseDown, tutorialMouseMove, tutorialMouseUp, updateTutorial,
} from './screens.js';
import { drawFrame, drawPaper, setBrushStyle } from './sprites.js';
import { stageShot } from './shots.js';
import {
  loadCodex, loadFeats, loadHistory, loadLeaderboard, loadProgress, recordComboDiscovered,
  recordBossFight, recordRun, recordScore, saveProgress, unlockFeat,
} from './storage.js';
import { isMuted, playClick, playRankUp, setMuted, startMusic, unlockAudio } from './audio.js';
import { awardRankPoints, fusionWindowForRank, inkBonusForRank, rankIndexFromPoints } from './ranks.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// HD: the backing store is 2x the logical 1024x576 view, so brush strokes,
// sprites and text render crisp instead of blurry. All game code still draws
// in logical coordinates; the frame loop scales the context by 2.
canvas.width = VIEW.width * 2;
canvas.height = VIEW.height * 2;
const statusEl = document.getElementById('status');

const progress = loadProgress();

function newRun() {
  const idx = rankIndexFromPoints(progress.rankPoints);
  return {
    scrollIndex: 0, score: 0, essence: 0,
    maxInk: 100 + inkBonusForRank(idx), refill: 6, damage: 0, maxHp: 100, hp: 100,
    comboWindow: 6, startShielded: false, upgradesOwned: {},
    fusionWindow: fusionWindowForRank(idx),
    difficulty: progress.difficulty ?? 'calligrapher',
    scrollGrades: [], scrollScores: [], featsEarned: [],
  };
}

const g = {
  screen: 'menu',
  buttons: [],
  run: newRun(),
  runStarted: false,
  progress,
  codex: loadCodex(),
  leaderboard: loadLeaderboard(),
  history: loadHistory(),
  feats: loadFeats(),
  newFeats: [],
  pendingDraft: false,
  pendingRoad: false,
  draft: null,
  combat: null,
  dojo: { selected: 'fire', strokes: [], currentStroke: null, drawing: false, lastStrokeAt: 0, feedback: null, best: 0 },
  tutorial: null,
  lastResult: null,
  showHelp: false,
  paused: false,
  keys: new Set(),
  time: 0,
  newRun,
};

// Apply the player's equipped brush + ink from the rank system.
setBrushStyle(g.progress.brushStyle, g.progress.inkColor, g.progress.inkColor === 'rainbow');

function setScreen(name) {
  g.screen = name;
  g.paused = false;
  g.showHelp = false;
  g.buttons = [];
  const labels = {
    menu: 'Main menu. Inkblade: draw kanji to cast magic.',
    scrolls: 'The seven scrolls. Choose a boss to fight.',
    shop: 'The ink merchant. Spend essence on upgrades.',
    dojo: 'Training dojo. Practice drawing the kanji.',
    codex: 'Boss codex. Every demon the brush has met.',
    leaderboard: 'Leaderboard. Your ten best runs.',
    history: 'Match history. Your last twenty runs.',
    tutorial: 'How to play. Learn the brush, the spells and the combos.',
    combos: 'Fusion combos. Which pairs of elements combine.',
    rank: 'Calligraphy rank. Your kyu and dan ladder.',
    combat: 'Combat. Draw kanji in the ink pad to cast spells.',
    victory: 'Scroll sealed. Victory.',
    defeat: 'Defeat. The ink runs dry.',
    draft: 'Choose a blessing. Pick one of three cards.',
    roads: 'Choose a road. Two paths to the next scroll.',
  };
  if (statusEl) statusEl.textContent = labels[name] ?? name;
}

function startFight(scrollIndex) {
  g.run.scrollIndex = scrollIndex;
  g.runStarted = true;
  g.newFeats = [];
  // The fight's seal strip reads the combos this profile has discovered.
  g.run.combosDiscovered = g.progress.combosDiscovered;
  g.combat = createCombat(scrollIndex, g.run, {
    // recordComboDiscovered mutates + saves in place and returns a boolean;
    // it is not an assignment.
    onComboDiscovered: (comboId) => {
      if (!recordComboDiscovered(g.progress, comboId)) return;
      // Feats: first fusion ever, and all six discovered.
      awardFeat('first-fusion');
      if (g.progress.combosDiscovered.length >= 6) awardFeat('all-combos');
    },
  });
  // The road's modifiers are consumed by this fight and no other.
  delete g.run.roadMinionHpMul;
  delete g.run.roadInkPenalty;
  delete g.run.roadBossHpMul;
  setScreen('combat');
}

// Unlock a feat (persisted). Newly unlocked feats are collected for the
// victory screen's NEW badges and for the campaign dashboard.
function awardFeat(featId) {
  if (!unlockFeat(featId)) return false;
  g.feats = loadFeats();
  if (!g.newFeats.includes(featId)) g.newFeats.push(featId);
  if (!g.run.featsEarned.includes(featId)) g.run.featsEarned.push(featId);
  return true;
}

function rollDraftCards() {
  const pool = [...BLESSINGS];
  const cards = [];
  while (cards.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    cards.push(pool.splice(i, 1)[0].id);
  }
  return cards;
}

function rerollCost() {
  return 20 * ((g.draft?.rerolls ?? 0) + 1);
}

function buyUpgrade(id) {
  const u = UPGRADES.find((item) => item.id === id);
  if (!u) return;
  const owned = g.run.upgradesOwned[id] ?? 0;
  if (owned >= u.max || g.run.essence < u.cost) return;
  g.run.essence -= u.cost;
  g.run.upgradesOwned[id] = owned + 1;
  u.apply(g.run);
  playClick();
}

function finishFight(won) {
  const c = g.combat;
  const seconds = Math.max(1, Math.round(c.time - c.stats.startTime));
  const accuracy = c.stats.casts > 0 ? c.stats.accuracySum / c.stats.casts : 0;
  const boss = BOSSES[c.scrollIndex];
  const grade = fightGrade(c);
  const diff = DIFFICULTY_BY_ID[g.run.difficulty] ?? DIFFICULTY_BY_ID.calligrapher;
  const campaignComplete = won && c.scrollIndex === 6;
  let fightScore = 0;
  if (won) {
    // Difficulty scales the score: Master pays half as much again.
    fightScore = Math.round((c.stats.damage + Math.max(0, 300 - seconds * 2) + Math.round(accuracy * 100) + c.stats.maxCombo * 10) * diff.scoreMul);
    g.run.score += fightScore;
    g.run.essence += c.essenceEarned;
    g.run.hp = c.player.hp;
    g.progress.unlockedScroll = Math.max(g.progress.unlockedScroll, Math.min(7, c.scrollIndex + 2));
    g.progress.bestScore = Math.max(g.progress.bestScore, g.run.score);
    g.progress.bestScores[g.run.difficulty] = Math.max(g.progress.bestScores[g.run.difficulty] ?? 0, g.run.score);
    g.progress.furthestScroll = Math.max(g.progress.furthestScroll, c.scrollIndex + 1);
    g.progress.lastGrade = grade;
    g.run.scrollGrades[c.scrollIndex] = grade;
    g.run.scrollScores[c.scrollIndex] = fightScore;
    if (campaignComplete) {
      g.progress.campaignWins += 1;
      g.leaderboard = recordScore({
        score: g.run.score, scrolls: 7, accuracy, result: 'Sealed all 7',
        difficulty: g.run.difficulty,
      });
    }
  }
  g.progress.totalCasts += c.stats.casts;
  saveProgress(g.progress);
  // Rank points: accuracy points + combo bonuses came from combat; bosses,
  // scrolls and no-damage clears add on top. A rank-up grows the ink well
  // and the fusion window mid-campaign (shop Well upgrades kept on top).
  const rankPoints = (c.rankPoints || 0) + (won ? 150 : 0) + (won && c.stats.damageTaken === 0 ? 150 : 0);
  const rankUp = awardRankPoints(g.progress, rankPoints);
  saveProgress(g.progress);
  if (rankUp !== null) {
    playRankUp();
    const idx = rankIndexFromPoints(g.progress.rankPoints);
    const wells = g.run.upgradesOwned.well ?? 0;
    g.run.maxInk = 100 + inkBonusForRank(idx) + wells * 25;
    g.run.fusionWindow = fusionWindowForRank(idx);
  }
  // Feats: checked at the end of every fight (and on combo discovery).
  if (won) awardFeat('first-seal');
  if (won && accuracy >= 0.999) awardFeat('perfect-fight');
  if (won && c.stats.damageTaken === 0) awardFeat('no-damage');
  if (won && grade === 'S') awardFeat('s-grade');
  if (campaignComplete) awardFeat('all-scrolls');
  if (campaignComplete && g.run.difficulty === 'master') awardFeat('master-campaign');
  if (g.progress.totalCasts >= 100) awardFeat('hundred-casts');
  if (rankIndexFromPoints(g.progress.rankPoints) >= 10) awardFeat('first-dan');
  g.codex = recordBossFight(boss.id, won, won ? seconds : null);
  g.history = recordRun({
    scroll: boss.scroll, boss: boss.name, result: won ? 'Sealed' : 'Fell',
    score: won ? fightScore : 0, seconds,
  });
  // A win opens the between-scrolls flow: blessing draft, then the road.
  g.pendingDraft = won && !campaignComplete;
  g.pendingRoad = won && !campaignComplete;
  g.draft = null;
  g.lastResult = {
    scrollIndex: c.scrollIndex, seconds, casts: c.stats.casts, accuracy,
    perfects: c.stats.perfects, maxCombo: c.stats.maxCombo, damage: c.stats.damage,
    essence: won ? c.essenceEarned : 0, score: fightScore,
    campaignComplete,
    rankPoints, rankUp, grade,
  };
  setScreen(won ? 'victory' : 'defeat');
}

function handleButton(id) {
  playClick();
  if (id === 'menu') { setScreen('menu'); return; }
  if (id === 'play') {
    if (!g.runStarted || g.run.scrollIndex >= 7) {
      g.run = newRun();
      g.runStarted = false;
    }
    startFight(g.run.scrollIndex);
    return;
  }
  if (id === 'scrolls') { setScreen('scrolls'); return; }
  if (id === 'dojo') { setScreen('dojo'); return; }
  if (id === 'codex') { setScreen('codex'); return; }
  if (id === 'leaderboard') { setScreen('leaderboard'); return; }
  if (id === 'history') { setScreen('history'); return; }
  if (id === 'tutorial') { resetTutorial(g); setScreen('tutorial'); return; }
  if (id === 'combos') { setScreen('combos'); return; }
  if (id === 'rank') { setScreen('rank'); return; }
  if (id === 'tut-lesson' || id === 'tut-guide' || id === 'tut-spells') {
    if (g.tutorial) g.tutorial.page = id.slice(4);
    return;
  }
  if (id === 'tut-reset') { resetTutorial(g); return; }
  if (id.startsWith('equip-brush-')) {
    g.progress.brushStyle = id.slice(12);
    saveProgress(g.progress);
    setBrushStyle(g.progress.brushStyle, g.progress.inkColor, g.progress.inkColor === 'rainbow');
    return;
  }
  if (id.startsWith('equip-ink-')) {
    g.progress.inkColor = id.slice(10);
    saveProgress(g.progress);
    setBrushStyle(g.progress.brushStyle, g.progress.inkColor, g.progress.inkColor === 'rainbow');
    return;
  }
  if (id === 'shop') { setScreen('shop'); return; }
  if (id === 'help') { g.showHelp = true; return; }
  if (id === 'help-close') { g.showHelp = false; return; }
  if (id === 'mute') { setMuted(!isMuted()); return; }
  if (id === 'resume') { g.paused = false; return; }
  if (id === 'retry') { startFight(g.lastResult.scrollIndex); return; }
  if (id === 'play-again') { g.run = newRun(); g.runStarted = false; startFight(0); return; }
  if (id === 'next-scroll') {
    const next = g.run.scrollIndex + 1;
    if (next > 6) { setScreen('menu'); return; }
    // Between scrolls: blessing draft first, then the road, then the shop.
    // The shop's NEXT SCROLL routes through any step still pending, so the
    // player can detour to the shop first without skipping the draft.
    if (g.pendingDraft) {
      if (!g.draft) g.draft = { cards: rollDraftCards(), rerolls: 0 };
      setScreen('draft');
      return;
    }
    if (g.pendingRoad) { setScreen('roads'); return; }
    startFight(next);
    return;
  }
  if (id.startsWith('diff-')) {
    const diffId = id.slice(5);
    if (!DIFFICULTY_BY_ID[diffId]) return;
    g.progress.difficulty = diffId;
    saveProgress(g.progress);
    // A run already in progress keeps its difficulty; the choice applies
    // to the next run. A fresh run picks it up in newRun().
    if (!g.runStarted) g.run.difficulty = diffId;
    return;
  }
  if (id.startsWith('draft-pick-')) {
    const idx = parseInt(id.slice(11), 10);
    const blessingId = g.draft?.cards[idx];
    const blessing = BLESSING_BY_ID[blessingId];
    if (!blessing) return;
    blessing.apply(g.run);
    g.pendingDraft = false;
    g.draft = null;
    setScreen(g.pendingRoad ? 'roads' : 'shop');
    return;
  }
  if (id === 'draft-reroll') {
    if (!g.draft) return;
    const cost = rerollCost();
    if (g.run.essence < cost) return;
    g.run.essence -= cost;
    g.draft.rerolls += 1;
    g.draft.cards = rollDraftCards();
    return;
  }
  if (id.startsWith('road-')) {
    const road = ROAD_BY_ID[id.slice(5)];
    if (!road) return;
    road.apply(g.run);
    g.pendingRoad = false;
    setScreen('shop');
    return;
  }
  if (id.startsWith('fight-')) {
    const scroll = parseInt(id.slice(6), 10);
    g.run = newRun();
    g.runStarted = false;
    startFight(scroll - 1);
    return;
  }
  if (id.startsWith('buy-')) { buyUpgrade(id.slice(4)); return; }
  if (id.startsWith('dojo-') && !id.startsWith('dojo-judge') && !id.startsWith('dojo-clear')) {
    g.dojo.selected = id.slice(5);
    g.dojo.strokes = [];
    g.dojo.feedback = null;
    return;
  }
  if (id === 'dojo-judge') { dojoJudge(g); return; }
  if (id === 'dojo-clear') { g.dojo.strokes = []; g.dojo.feedback = null; }
}

// --- Input: mouse coordinates are scaled from the displayed canvas. ---
function toCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (VIEW.width / rect.width),
    y: (event.clientY - rect.top) * (VIEW.height / rect.height),
  };
}

function buttonAt(x, y) {
  for (let i = g.buttons.length - 1; i >= 0; i -= 1) {
    const b = g.buttons[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

canvas.addEventListener('pointerdown', (event) => {
  unlockAudio();
  startMusic();
  const { x, y } = toCanvas(event);
  if (g.paused) {
    const id = buttonAt(x, y);
    if (id) handleButton(id);
    return;
  }
  const id = buttonAt(x, y);
  if (id) { handleButton(id); return; }
  if (g.screen === 'combat' && g.combat) combatMouseDown(g.combat, x, y);
  else if (g.screen === 'dojo') dojoMouseDown(g, x, y);
  else if (g.screen === 'tutorial' && g.tutorial) tutorialMouseDown(g, x, y);
});

canvas.addEventListener('pointermove', (event) => {
  const { x, y } = toCanvas(event);
  if (g.screen === 'combat' && g.combat) combatMouseMove(g.combat, x, y);
  else if (g.screen === 'dojo') dojoMouseMove(g, x, y);
  else if (g.screen === 'tutorial' && g.tutorial) tutorialMouseMove(g, x, y);
});

canvas.addEventListener('pointerup', () => {
  if (g.screen === 'combat' && g.combat) combatMouseUp(g.combat);
  else if (g.screen === 'dojo') dojoMouseUp(g);
  else if (g.screen === 'tutorial' && g.tutorial) tutorialMouseUp(g);
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'm') { setMuted(!isMuted()); return; }
  if (key === 'p' || key === 'escape') {
    if (g.screen === 'combat') g.paused = !g.paused;
    return;
  }
  if (key === 'h' && g.screen === 'menu') { g.showHelp = !g.showHelp; return; }
  if (g.screen === 'combat' && g.combat && !g.paused) combatKey(g.combat, key);
  g.keys.add(key);
});

window.addEventListener('keyup', (event) => {
  g.keys.delete(event.key.toLowerCase());
});

window.addEventListener('blur', () => { g.keys.clear(); });

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// --- The loop. ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  g.time += dt;
  g.buttons = [];
  if (!g.paused) {
    if (g.screen === 'combat' && g.combat) {
      updateCombat(g.combat, dt, g.keys);
      const c = g.combat;
      if ((c.phase === 'won' || c.phase === 'lost') && c.phaseTimer > 1.7) finishFight(c.phase === 'won');
    }
    if (g.screen === 'dojo' && g.dojo.strokes.length > 0 && performance.now() - g.dojo.lastStrokeAt > 900 && !g.dojo.drawing) {
      dojoJudge(g);
    }
    if (g.screen === 'tutorial' && g.tutorial) updateTutorial(g, dt);
  }
  // HD: scale every frame to the 2x backing store (logical 1024x576 coords).
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  drawPaper(ctx, VIEW.width, VIEW.height);
  drawFrame(ctx, VIEW.width, VIEW.height);
  switch (g.screen) {
    case 'menu': drawMenu(ctx, g, g.time); break;
    case 'scrolls': drawScrolls(ctx, g); break;
    case 'shop': drawShop(ctx, g); break;
    case 'dojo': drawDojo(ctx, g, g.time); break;
    case 'codex': drawCodex(ctx, g, g.time); break;
    case 'leaderboard': drawLeaderboard(ctx, g); break;
    case 'history': drawHistory(ctx, g); break;
    case 'tutorial': if (g.tutorial) drawTutorial(ctx, g, g.time); break;
    case 'combos': drawCombos(ctx, g); break;
    case 'rank': drawRank(ctx, g, g.time); break;
    case 'combat': if (g.combat) drawCombat(ctx, g.combat, g.time); break;
    case 'victory': drawVictory(ctx, g, g.time); break;
    case 'defeat': drawDefeat(ctx, g); break;
    case 'draft': drawDraft(ctx, g); break;
    case 'roads': drawRoads(ctx, g); break;
    default: drawMenu(ctx, g, g.time);
  }
  // Global chrome: mute always, help on the menu. The buttons are wide
  // enough for their labels — 44px clipped "SOUND" and "HELP ?".
  ctx.save();
  ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
  ctx.beginPath();
  ctx.roundRect(944, 528, 64, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isMuted() ? 'MUTE ✕' : 'SOUND ♪', 976, 544);
  ctx.restore();
  g.buttons.push({ id: 'mute', x: 944, y: 528, w: 64, h: 30 });
  if (g.screen === 'menu' && !g.showHelp) {
    ctx.save();
    ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
    ctx.beginPath();
    ctx.roundRect(944, 20, 64, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#f6efdd';
    ctx.font = '700 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HELP ?', 976, 36);
    ctx.restore();
    g.buttons.push({ id: 'help', x: 944, y: 20, w: 64, h: 30 });
  }
  if (g.showHelp && g.screen === 'menu') drawHelp(ctx, g);
  if (g.paused && g.screen === 'combat') drawPause(ctx, g);
  requestAnimationFrame(frame);
}

// Test hook for the Playwright smoke test (tests/smoke.mjs): exposes the
// live game state read-only for assertions. It changes nothing about play.
window.__inkblade = g;

// Screenshot staging (?shot=start|play|play2|end) happens before the first frame.
const params = new URLSearchParams(window.location.search);
if (params.has('shot')) stageShot(params.get('shot'), g);
setScreen(g.screen);
requestAnimationFrame(frame);
