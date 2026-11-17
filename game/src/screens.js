// INKBLADE screens: every screen except combat — the menu, the scroll map,
// the shop, the training dojo, the boss codex, the leaderboard, the match
// history, and the victory and defeat screens. Each draw function registers
// its buttons into g.buttons so one click router in main.js serves them all.

import { BOSSES, COMBOS, ELEMENTS, ELEMENT_BY_ID, UPGRADES, comboPartner, combosFrom, findCombo } from './config.js';
import { drawBoss, drawBrushStroke, drawFrame, drawSeal } from './sprites.js';
import { burst, drawParticles, floatText, makeParticles, ring, updateParticles } from './particles.js';
import { recognise, isRealStroke } from './strokes.js';
import { playBrushSwish, playClick, playCombo, playElementImpact } from './audio.js';
import { drawWheel } from './combat.js';
import {
  BRUSH_STYLES, INK_COLORS, RANKS, fusionWindowForRank, pointsToNextRank,
  rankIndexFromPoints, rankProgress, unlockedBrushes, unlockedInkColors,
} from './ranks.js';

export function registerButton(g, id, x, y, w, h) {
  g.buttons.push({ id, x, y, w, h });
}

export function drawButton(ctx, g, id, x, y, w, h, label, opts = {}) {
  const { fill = '#2b2118', text = '#fdf6e3', font = '700 16px Georgia, serif', disabled = false } = opts;
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(176, 42, 30, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = text;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  if (!disabled) registerButton(g, id, x, y, w, h);
}

function drawHeader(ctx, title, subtitle) {
  ctx.fillStyle = 'rgba(43, 33, 24, 0.92)';
  ctx.beginPath();
  ctx.roundRect(20, 20, 984, 62, 10);
  ctx.fill();
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 24px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, 34, 50);
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '#d9c9a8';
  ctx.fillText(subtitle, 34, 70);
}

function drawBackButton(ctx, g) {
  drawButton(ctx, g, 'menu', 20, 520, 130, 38, '← MENU', { fill: '#6b5a44' });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- Menu: dense, full of ink art, no empty space. ---
export function drawMenu(ctx, g, time) {
  const { progress } = g;
  // Ink mountains + red sun.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.10)';
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.lineTo(180, 240);
  ctx.lineTo(330, 420);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(43, 33, 24, 0.07)';
  ctx.beginPath();
  ctx.moveTo(700, 420);
  ctx.lineTo(880, 200);
  ctx.lineTo(1024, 420);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c1271b';
  ctx.beginPath();
  ctx.arc(830, 120, 44, 0, Math.PI * 2);
  ctx.fill();
  // Bamboo stalks at the edges.
  for (const bx of [44, 66, 958, 980]) {
    ctx.strokeStyle = 'rgba(43, 138, 62, 0.5)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(bx, 576);
    ctx.lineTo(bx + (bx < 500 ? 12 : -12), 300);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(43, 138, 62, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      const y = 360 + i * 50;
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.lineTo(bx + (bx < 500 ? 26 : -26), y - 16);
      ctx.stroke();
    }
  }
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 92px "Noto Serif JP", serif';
  ctx.fillText('墨刃', 512, 158);
  ctx.font = '700 54px Georgia, serif';
  ctx.fillText('INKBLADE', 512, 222);
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  ctx.fillText('Draw the kanji. Cast the magic. Seal all seven scrolls.', 512, 252);
  // Element strip: all eight kanji, coloured.
  ctx.font = '700 30px "Noto Serif JP", serif';
  ELEMENTS.forEach((e, i) => {
    const x = 512 - 245 + i * 70;
    ctx.fillStyle = e.color;
    ctx.fillText(e.kanji, x, 296);
    ctx.fillStyle = '#6b5a44';
    ctx.font = '700 10px Georgia, serif';
    ctx.fillText(e.name.toUpperCase(), x, 314);
    ctx.font = '700 30px "Noto Serif JP", serif';
  });
  // Buttons.
  const bw = 260, bh = 44, bx = 512 - bw / 2;
  drawButton(ctx, g, 'play', bx, 330, bw, bh, '▶  PLAY — CONTINUE', { fill: '#b02a1e', font: '700 18px Georgia, serif' });
  drawButton(ctx, g, 'scrolls', 382, 382, 126, 40, 'SCROLLS', { font: '700 14px Georgia, serif' });
  drawButton(ctx, g, 'dojo', 516, 382, 126, 40, 'DOJO', { font: '700 14px Georgia, serif' });
  drawButton(ctx, g, 'tutorial', 382, 430, 126, 40, 'TUTORIAL', { font: '700 14px Georgia, serif' });
  drawButton(ctx, g, 'combos', 516, 430, 126, 40, 'COMBOS', { font: '700 14px Georgia, serif' });
  drawButton(ctx, g, 'codex', 180, 486, 150, 36, 'CODEX', { fill: '#6b5a44', font: '700 13px Georgia, serif' });
  drawButton(ctx, g, 'rank', 342, 486, 150, 36, 'RANK', { fill: '#6b5a44', font: '700 13px Georgia, serif' });
  drawButton(ctx, g, 'leaderboard', 504, 486, 150, 36, 'LEADERBOARD', { fill: '#6b5a44', font: '700 13px Georgia, serif' });
  drawButton(ctx, g, 'history', 666, 486, 150, 36, 'HISTORY', { fill: '#6b5a44', font: '700 13px Georgia, serif' });
  // Bottom stats bar.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
  ctx.beginPath();
  ctx.roundRect(180, 536, 664, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 12px Georgia, serif';
  ctx.fillText(
    `Best score ${progress.bestScore}  ·  Scrolls unlocked ${progress.unlockedScroll}/7  ·  Campaigns sealed ${progress.campaignWins}  ·  M mute · P pause · WASD move · 1–8 pick element`,
    512, 553,
  );
  drawSeal(ctx, 150, 120, 56, '墨', 0.9);
  drawRankChip(ctx, g);
}

// The rank chip, top centre of the menu: current rank seal + name + a
// progress bar to the next rank.
export function drawRankChip(ctx, g) {
  const { progress } = g;
  const rankIndex = rankIndexFromPoints(progress.rankPoints);
  const rank = RANKS[rankIndex];
  const next = pointsToNextRank(progress.rankPoints);
  ctx.fillStyle = 'rgba(43, 33, 24, 0.88)';
  ctx.beginPath();
  ctx.roundRect(312, 16, 400, 44, 8);
  ctx.fill();
  drawSeal(ctx, 330, 38, 26, rank.seal, 1, rank.sealColor);
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 14px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(rank.name, 350, 31);
  ctx.fillStyle = '#ffd43b';
  ctx.font = '700 12px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${progress.rankPoints} pts`, 700, 31);
  if (next === null) {
    ctx.fillStyle = '#ffd43b';
    ctx.font = '700 12px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillText('HIGHEST RANK', 700, 50);
  } else {
    const barX = 350, barW = 230;
    ctx.fillStyle = 'rgba(246, 239, 221, 0.25)';
    ctx.beginPath();
    ctx.roundRect(barX, 44, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.roundRect(barX, 44, Math.max(8, barW * rankProgress(progress.rankPoints)), 8, 4);
    ctx.fill();
    ctx.fillStyle = '#d9c9a8';
    ctx.font = '700 11px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${next} to ${RANKS[rankIndex + 1].name}`, 700, 49);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
}

export function drawHelp(ctx, g) {
  ctx.fillStyle = 'rgba(26, 21, 18, 0.6)';
  ctx.fillRect(0, 0, 1024, 576);
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(162, 70, 700, 436, 16);
  ctx.fill();
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 26px Georgia, serif';
  ctx.fillText('How to play', 190, 116);
  ctx.font = '15px Georgia, serif';
  const lines = [
    '1. DRAW in the ink pad: every kanji is a spell. Draw 火 and fire erupts;',
    '    draw 水 and water bursts out. The ghost strokes show you the shape.',
    '2. CAST with Space, the CAST button, or just pause — the brush casts for you.',
    '    A clean stroke (90%+) is a PERFECT cast: critical damage + bonus ink.',
    '3. ELEMENTS beat each other: 水 beats 火, 火 beats 風, 風 beats 雷, 雷 beats 水,',
    '    土 beats 雷, 氷 beats 風 and 土, 光 and 闇 oppose. Weak hits deal double.',
    '4. MOVE with WASD or arrows to dodge the boss. 土 (earth) raises a shield.',
    '5. COMBOS: cast again within the window to multiply your damage, up to x2.',
    '6. SEAL all 7 scrolls. Between scrolls, spend essence in the shop.',
    '7. The DOJO trains every kanji with guides; the CODEX remembers each boss.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 190, 150 + i * 26));
  ctx.font = '700 15px Georgia, serif';
  ctx.fillStyle = '#b02a1e';
  ctx.fillText('Keys: 1–8 pick element · Space cast · C clear · P pause · M mute', 190, 352);
  ctx.fillText('Bosses are drawn in ink; their weakness is shown on their health bar.', 190, 378);
  drawButton(ctx, g, 'help-close', 412, 420, 200, 40, 'GOT IT', { fill: '#b02a1e' });
}

// --- Scroll map: the seven scrolls, seals for the cleared ones. ---
export function drawScrolls(ctx, g) {
  drawHeader(ctx, 'THE SEVEN SCROLLS', 'One boss per scroll. Seal them all to finish the story.');
  const { progress, codex } = g;
  BOSSES.forEach((boss, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 30 + col * 244;
    const y = 104 + row * 196;
    const unlocked = boss.scroll <= progress.unlockedScroll;
    const cleared = codex[boss.id] && codex[boss.id].wins > 0;
    const el = ELEMENT_BY_ID[boss.element];
    ctx.fillStyle = unlocked ? '#fdf6e3' : 'rgba(43, 33, 24, 0.15)';
    ctx.beginPath();
    ctx.roundRect(x, y, 224, 176, 12);
    ctx.fill();
    ctx.strokeStyle = unlocked ? el.color : 'rgba(43, 33, 24, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    if (!unlocked) {
      ctx.fillStyle = '#868e96';
      ctx.font = '700 44px Georgia, serif';
      ctx.fillText('🔒', x + 112, y + 84);
      ctx.font = '700 14px Georgia, serif';
      ctx.fillText(`SCROLL ${boss.scroll}`, x + 112, y + 120);
      ctx.font = 'italic 12px Georgia, serif';
      ctx.fillText('Seal the previous scroll', x + 112, y + 142);
      return;
    }
    ctx.fillStyle = el.color;
    ctx.font = '700 40px "Noto Serif JP", serif';
    ctx.fillText(el.kanji, x + 112, y + 56);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 18px Georgia, serif';
    ctx.fillText(boss.name, x + 112, y + 84);
    ctx.font = 'italic 11px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(boss.title, x + 112, y + 102);
    ctx.font = '12px Georgia, serif';
    ctx.fillStyle = '#2b2118';
    ctx.fillText(`HP ${boss.hp} · ${el.name} · Weak: ${ELEMENT_BY_ID[boss.weakness].kanji}`, x + 112, y + 124);
    const row2 = codex[boss.id];
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(row2 ? `Fought ${row2.fights} · Won ${row2.wins}` : 'Never faced', x + 112, y + 142);
    if (cleared) drawSeal(ctx, x + 192, y + 34, 40, '封', 0.95);
    drawButton(ctx, g, `fight-${boss.scroll}`, x + 42, y + 150, 140, 30, 'FIGHT →', { fill: el.color, font: '700 13px Georgia, serif' });
  });
  // Seventh scroll sits alone on the second row; fill the rest with a note.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.08)';
  ctx.beginPath();
  ctx.roundRect(30 + 3 * 244, 104 + 196, 224, 176, 12);
  ctx.fill();
  ctx.fillStyle = '#6b5a44';
  ctx.font = 'italic 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('The eighth scroll is blank.', 30 + 3 * 244 + 112, 104 + 196 + 80);
  ctx.fillText('Yours to write, once the', 30 + 3 * 244 + 112, 104 + 196 + 100);
  ctx.fillText('dragon is sealed.', 30 + 3 * 244 + 112, 104 + 196 + 120);
  drawBackButton(ctx, g);
}

// --- Shop: spend essence between scrolls. ---
export function drawShop(ctx, g) {
  drawHeader(ctx, 'THE INK MERCHANT', 'Spend essence before the next scroll. Upgrades last for this campaign.');
  const { run } = g;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 20px Georgia, serif';
  ctx.fillText(`Essence: ${run.essence}`, 34, 122);
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  ctx.fillText('Essence is earned by sealing scrolls — more for accuracy and long combos.', 34, 142);
  UPGRADES.forEach((u, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 30 + col * 324;
    const y = 160 + row * 150;
    const owned = run.upgradesOwned[u.id] ?? 0;
    const maxed = owned >= u.max;
    const afford = run.essence >= u.cost && !maxed;
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(x, y, 300, 130, 12);
    ctx.fill();
    ctx.strokeStyle = maxed ? '#2b8a3e' : '#b02a1e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 18px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(u.name, x + 18, y + 32);
    ctx.font = '14px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(u.desc, x + 18, y + 56);
    ctx.font = '700 13px Georgia, serif';
    ctx.fillStyle = '#2b2118';
    ctx.fillText(`Owned ${owned}/${u.max}`, x + 18, y + 80);
    drawButton(ctx, g, `buy-${u.id}`, x + 18, y + 92, 140, 30, maxed ? 'MAXED' : `${u.cost} essence`, {
      fill: afford ? '#b02a1e' : '#868e96', font: '700 13px Georgia, serif', disabled: !afford,
    });
  });
  drawButton(ctx, g, 'next-scroll', 674, 520, 330, 42, 'NEXT SCROLL  →', { fill: '#b02a1e', font: '700 17px Georgia, serif' });
  drawBackButton(ctx, g);
}

// --- Dojo: practice drawing each kanji with guides and accuracy feedback. ---
export const DOJO_PAD = { x: 362, y: 110, w: 300, h: 300 };

export function drawDojo(ctx, g, time) {
  drawHeader(ctx, 'TRAINING DOJO', 'Trace the ghost strokes. The brush judges your accuracy, kindly.');
  const d = g.dojo;
  const el = ELEMENT_BY_ID[d.selected];
  // Kanji picker, left column.
  ELEMENTS.forEach((e, i) => {
    const y = 108 + i * 52;
    const selected = d.selected === e.id;
    ctx.fillStyle = selected ? e.color : '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(30, y, 300, 44, 10);
    ctx.fill();
    ctx.strokeStyle = e.color;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.stroke();
    ctx.fillStyle = selected ? '#fdf6e3' : e.color;
    ctx.font = '700 24px "Noto Serif JP", serif';
    ctx.textAlign = 'left';
    ctx.fillText(e.kanji, 44, y + 31);
    ctx.fillStyle = selected ? '#fdf6e3' : '#2b2118';
    ctx.font = '700 15px Georgia, serif';
    ctx.fillText(`${e.name} — ${e.cost} ink`, 82, y + 27);
    registerButton(g, `dojo-${e.id}`, 30, y, 300, 44);
  });
  // Practice pad.
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.roundRect(DOJO_PAD.x, DOJO_PAD.y, DOJO_PAD.w, DOJO_PAD.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = el.color;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  el.strokes.forEach((stroke, i) => {
    ctx.beginPath();
    stroke.forEach(([sx, sy], j) => {
      const px = DOJO_PAD.x + sx * DOJO_PAD.w;
      const py = DOJO_PAD.y + sy * DOJO_PAD.h;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    const [fx, fy] = stroke[0];
    ctx.fillStyle = el.color;
    ctx.font = '700 14px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), DOJO_PAD.x + fx * DOJO_PAD.w - 8, DOJO_PAD.y + fy * DOJO_PAD.h - 6);
  });
  ctx.restore();
  for (const stroke of d.strokes) {
    drawBrushStroke(ctx, stroke.map(([sx, sy]) => [DOJO_PAD.x + sx, DOJO_PAD.y + sy]));
  }
  if (d.currentStroke) {
    drawBrushStroke(ctx, d.currentStroke.map(([sx, sy]) => [DOJO_PAD.x + sx, DOJO_PAD.y + sy]));
  }
  // Feedback panel, right column.
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(692, 110, 282, 300, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = el.color;
  ctx.font = '700 52px "Noto Serif JP", serif';
  ctx.fillText(el.kanji, 716, 178);
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 20px Georgia, serif';
  ctx.fillText(el.name, 716, 208);
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  const words = el.desc.split(' ');
  let line = '';
  let ly = 232;
  for (const word of words) {
    if ((line + ' ' + word).length > 34) {
      ctx.fillText(line, 716, ly);
      line = word;
      ly += 18;
    } else line = line ? line + ' ' + word : word;
  }
  ctx.fillText(line, 716, ly);
  ctx.font = '700 14px Georgia, serif';
  ctx.fillStyle = '#2b2118';
  ctx.fillText(`Damage ${el.damage} · Cost ${el.cost} ink`, 716, 300);
  ctx.fillText(`Effect: ${el.effect}`, 716, 322);
  if (d.feedback) {
    ctx.font = '700 22px Georgia, serif';
    ctx.fillStyle = d.feedback.accuracy >= 0.9 ? '#2b8a3e' : d.feedback.accuracy >= 0.55 ? '#2b2118' : '#c1271b';
    ctx.fillText(d.feedback.text, 716, 360);
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(`Best this session: ${Math.round(d.best * 100)}%`, 716, 384);
  }
  drawButton(ctx, g, 'dojo-judge', 692, 424, 136, 40, 'JUDGE IT', { fill: '#b02a1e' });
  drawButton(ctx, g, 'dojo-clear', 838, 424, 136, 40, 'CLEAR', { fill: '#6b5a44' });
  ctx.fillStyle = '#6b5a44';
  ctx.font = 'italic 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Draw in the pad, then JUDGE IT — or just pause and the brush judges itself.', 512, 492);
  drawBackButton(ctx, g);
}

export function dojoMouseDown(g, x, y) {
  const d = g.dojo;
  const p = DOJO_PAD;
  if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
    d.drawing = true;
    d.currentStroke = [[x - p.x, y - p.y]];
    playBrushSwish();
    return true;
  }
  return false;
}

export function dojoMouseMove(g, x, y) {
  const d = g.dojo;
  if (!d.drawing || !d.currentStroke) return;
  const p = DOJO_PAD;
  const px = x - p.x;
  const py = y - p.y;
  const last = d.currentStroke[d.currentStroke.length - 1];
  if (Math.hypot(px - last[0], py - last[1]) > 3) d.currentStroke.push([px, py]);
}

export function dojoMouseUp(g) {
  const d = g.dojo;
  if (!d.drawing) return;
  d.drawing = false;
  if (d.currentStroke && isRealStroke(d.currentStroke)) {
    d.strokes.push(d.currentStroke);
    d.lastStrokeAt = performance.now();
  }
  d.currentStroke = null;
}

export function dojoJudge(g) {
  const d = g.dojo;
  if (d.strokes.length === 0) return;
  const result = recognise(d.strokes);
  d.strokes = [];
  const acc = Math.round(result.accuracy * 100);
  d.best = Math.max(d.best, result.accuracy);
  if (result.element) {
    d.feedback = {
      accuracy: result.accuracy,
      text: `${result.element.kanji} ${result.element.name} — ${acc}%${result.accuracy >= 0.9 ? ' PERFECT!' : ''}`,
    };
    playElementImpact(result.element.id);
    const el = ELEMENT_BY_ID[d.selected];
    if (result.element.id !== d.selected) {
      d.feedback.text += ` (you drew ${result.element.name}, not ${el.name})`;
    }
  } else {
    d.feedback = { accuracy: result.accuracy, text: `Unclear — ${acc}%. Follow the ghost.` };
  }
}

// --- Codex: every boss met, with element, weakness and record. ---
export function drawCodex(ctx, g, time) {
  drawHeader(ctx, 'BOSS CODEX', 'Every demon the brush has met. Locked pages stay blank until you face them.');
  const { codex } = g;
  BOSSES.forEach((boss, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 30 + col * 244;
    const y = 104 + row * 196;
    const row2 = codex[boss.id];
    const met = !!row2;
    const el = ELEMENT_BY_ID[boss.element];
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(x, y, 224, 176, 12);
    ctx.fill();
    ctx.strokeStyle = met ? el.color : 'rgba(43, 33, 24, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    if (!met) {
      ctx.fillStyle = '#adb5bd';
      ctx.font = '700 56px Georgia, serif';
      ctx.fillText('?', x + 112, y + 96);
      ctx.font = '700 14px Georgia, serif';
      ctx.fillStyle = '#868e96';
      ctx.fillText(`SCROLL ${boss.scroll}`, x + 112, y + 132);
      ctx.font = 'italic 12px Georgia, serif';
      ctx.fillText('Not yet faced', x + 112, y + 152);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 8, 208, 78, 8);
    ctx.clip();
    drawBoss(ctx, boss, x + 112, y + 48, 30, time + i, {});
    ctx.restore();
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText(boss.name, x + 112, y + 110);
    ctx.font = '12px Georgia, serif';
    ctx.fillStyle = el.color;
    ctx.fillText(`${el.kanji} ${el.name}  ·  Weak: ${ELEMENT_BY_ID[boss.weakness].kanji} ${ELEMENT_BY_ID[boss.weakness].name}`, x + 112, y + 130);
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(`Fought ${row2.fights} · Sealed ${row2.wins}`, x + 112, y + 150);
    ctx.fillText(row2.bestSeconds !== null ? `Best seal ${Math.floor(row2.bestSeconds / 60)}:${String(Math.floor(row2.bestSeconds % 60)).padStart(2, '0')}` : 'Not yet sealed', x + 112, y + 168);
  });
  // Eighth cell: the wheel, drawn small.
  const x = 30 + 3 * 244, y = 104 + 196;
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(x, y, 224, 176, 12);
  ctx.fill();
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE WHEEL', x + 112, y + 28);
  ctx.font = '12px Georgia, serif';
  const lines = ['水 beats 火', '火 beats 風', '風 beats 雷', '雷 beats 水', '土 beats 雷', '氷 beats 風 · 土', '光 ⇄ 闇'];
  lines.forEach((line, i) => {
    ctx.fillStyle = '#2b2118';
    ctx.fillText(line, x + 112, y + 54 + i * 18);
  });
  drawBackButton(ctx, g);
}

// --- Leaderboard: top 10 runs. ---
export function drawLeaderboard(ctx, g) {
  drawHeader(ctx, 'LEADERBOARD', 'The ten finest brushes, kept on this machine.');
  const rows = g.leaderboard;
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(162, 104, 700, 400, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 14px Georgia, serif';
  ctx.fillText('RANK', 190, 134);
  ctx.fillText('SCORE', 280, 134);
  ctx.fillText('SCROLLS', 400, 134);
  ctx.fillText('ACCURACY', 510, 134);
  ctx.fillText('DATE', 650, 134);
  ctx.fillText('RESULT', 750, 134);
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.3)';
  ctx.beginPath();
  ctx.moveTo(190, 144);
  ctx.lineTo(834, 144);
  ctx.stroke();
  if (rows.length === 0) {
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.textAlign = 'center';
    ctx.fillText('No runs yet. The first brushstroke is yours.', 512, 300);
  }
  rows.forEach((row, i) => {
    const y = 172 + i * 32;
    ctx.font = i === 0 ? '700 16px Georgia, serif' : '15px Georgia, serif';
    ctx.fillStyle = i === 0 ? '#b02a1e' : '#2b2118';
    ctx.textAlign = 'left';
    ctx.fillText(i === 0 ? '🥇 1' : String(i + 1), 190, y);
    ctx.fillText(String(row.score), 280, y);
    ctx.fillText(`${row.scrolls}/7`, 400, y);
    ctx.fillText(`${Math.round((row.accuracy ?? 0) * 100)}%`, 510, y);
    ctx.fillText(row.date ?? '—', 650, y);
    ctx.fillText(row.result ?? '—', 750, y);
  });
  drawBackButton(ctx, g);
}

// --- Match history: the last 20 runs. ---
export function drawHistory(ctx, g) {
  drawHeader(ctx, 'MATCH HISTORY', 'Your last twenty runs, newest first.');
  const rows = g.history;
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(162, 104, 700, 400, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 14px Georgia, serif';
  ctx.fillText('DATE', 190, 134);
  ctx.fillText('SCROLL', 300, 134);
  ctx.fillText('BOSS', 400, 134);
  ctx.fillText('RESULT', 560, 134);
  ctx.fillText('SCORE', 660, 134);
  ctx.fillText('TIME', 750, 134);
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.3)';
  ctx.beginPath();
  ctx.moveTo(190, 144);
  ctx.lineTo(834, 144);
  ctx.stroke();
  if (rows.length === 0) {
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.textAlign = 'center';
    ctx.fillText('No runs yet. Every master was once a first stroke.', 512, 300);
  }
  rows.slice(0, 12).forEach((row, i) => {
    const y = 170 + i * 28;
    ctx.font = '14px Georgia, serif';
    ctx.fillStyle = '#2b2118';
    ctx.textAlign = 'left';
    ctx.fillText(row.date ?? '—', 190, y);
    ctx.fillText(`Scroll ${row.scroll}`, 300, y);
    ctx.fillText(row.boss ?? '—', 400, y);
    ctx.fillStyle = row.result === 'Sealed' ? '#2b8a3e' : '#c1271b';
    ctx.fillText(row.result ?? '—', 560, y);
    ctx.fillStyle = '#2b2118';
    ctx.fillText(String(row.score), 660, y);
    ctx.fillText(formatTime(row.seconds ?? 0), 750, y);
  });
  if (rows.length > 12) {
    ctx.font = 'italic 12px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.textAlign = 'center';
    ctx.fillText(`…and ${rows.length - 12} more`, 512, 492);
  }
  drawBackButton(ctx, g);
}

// --- Victory: the scroll stamped, the stats, the spoils. ---
export function drawVictory(ctx, g, time) {
  const v = g.lastResult;
  const boss = BOSSES[v.scrollIndex];
  const el = ELEMENT_BY_ID[boss.element];
  drawHeader(ctx, `SCROLL ${boss.scroll} SEALED`, `${boss.name} — ${boss.title}`);
  // The scroll itself.
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(62, 104, 560, 360, 12);
  ctx.fill();
  ctx.strokeStyle = el.color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = el.color;
  ctx.font = '700 84px "Noto Serif JP", serif';
  ctx.textAlign = 'center';
  ctx.fillText(el.kanji, 342, 216);
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 30px Georgia, serif';
  ctx.fillText(boss.name, 342, 268);
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  ctx.fillText(boss.title, 342, 292);
  drawSeal(ctx, 520, 180, 92, '封', 1);
  ctx.fillStyle = '#2b2118';
  ctx.font = '15px Georgia, serif';
  ctx.fillText('The scroll is sealed in red. The story moves on.', 342, 330);
  // The fight grade: a big coloured seal at the scroll's top-left corner.
  const grade = v.grade || '—';
  const gradeColors = { S: '#e67700', A: '#2b8a3e', B: '#1971c2', C: '#868e96' };
  ctx.fillStyle = gradeColors[grade] || '#868e96';
  ctx.beginPath();
  ctx.arc(140, 168, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fdf6e3';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '700 36px Georgia, serif';
  ctx.fillText(grade, 140, 181);
  ctx.fillStyle = '#6b5a44';
  ctx.font = '700 12px Georgia, serif';
  ctx.fillText('GRADE', 140, 218);
  if (v.campaignComplete) {
    ctx.fillStyle = '#b02a1e';
    ctx.font = '700 20px Georgia, serif';
    ctx.fillText('🏆 THE STORY IS COMPLETE — all seven scrolls sealed!', 342, 366);
  }
  // Rank: a rank-up celebration with the new seal, or the current rank line.
  // (awardRankPoints returns the new rank object itself, or null.)
  if (v.rankUp) {
    const rank = v.rankUp;
    const pulse = 1 + Math.sin(time * 4) * 0.06;
    ctx.save();
    ctx.translate(120, 408);
    ctx.scale(pulse, pulse);
    drawSeal(ctx, 0, 0, 52, rank.seal, 1, rank.sealColor);
    ctx.restore();
    ctx.fillStyle = rank.sealColor;
    ctx.font = '700 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ RANK UP! ★', 370, 396);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 17px Georgia, serif';
    ctx.fillText(`You are now ${rank.name}`, 370, 422);
    ctx.fillStyle = '#6b5a44';
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillText(`Unlocked: ${rank.unlock.text}`, 370, 444);
  } else {
    const idx = rankIndexFromPoints(g.progress.rankPoints);
    const rank = RANKS[idx];
    ctx.fillStyle = '#6b5a44';
    ctx.font = 'italic 14px Georgia, serif';
    ctx.textAlign = 'center';
    const next = pointsToNextRank(g.progress.rankPoints);
    ctx.fillText(
      next === null
        ? `Rank: ${rank.name} — the highest rank of all`
        : `Rank: ${rank.name} · ${g.progress.rankPoints} pts · ${next} to ${RANKS[idx + 1].name}`,
      342, 402,
    );
  }
  // Stats panel.
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.roundRect(652, 104, 310, 360, 12);
  ctx.fill();
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 18px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('BATTLE RECORD', 676, 138);
  const stats = [
    ['Time', formatTime(v.seconds)],
    ['Casts', String(v.casts)],
    ['Accuracy', `${Math.round(v.accuracy * 100)}%`],
    ['Perfect casts', String(v.perfects)],
    ['Max combo', `x${v.maxCombo}`],
    ['Damage dealt', String(v.damage)],
    ['Essence earned', `+${v.essence}`],
    ['Score', String(v.score)],
    ['Rank points', `+${v.rankPoints || 0}`],
    ['Grade', v.grade || '—'],
  ];
  ctx.font = '15px Georgia, serif';
  stats.forEach(([label, value], i) => {
    const y = 168 + i * 27;
    ctx.fillStyle = '#d9c9a8';
    ctx.fillText(label, 676, y);
    ctx.fillStyle = '#fdf6e3';
    ctx.textAlign = 'right';
    ctx.fillText(value, 938, y);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#ffe066';
  ctx.font = '700 15px Georgia, serif';
  ctx.fillText(`Total score ${g.run.score}  ·  Essence ${g.run.essence}`, 676, 444);
  if (v.campaignComplete) {
    drawButton(ctx, g, 'play-again', 652, 480, 310, 44, 'PLAY AGAIN — NEW STORY', { fill: '#b02a1e', font: '700 16px Georgia, serif' });
  } else {
    drawButton(ctx, g, 'shop', 652, 480, 148, 44, 'SHOP', { fill: '#b02a1e' });
    drawButton(ctx, g, 'next-scroll', 814, 480, 148, 44, 'NEXT →', { fill: '#2b8a3e' });
  }
  drawBackButton(ctx, g);
}

// --- Defeat: the record, and the choice to rewrite it. ---
export function drawDefeat(ctx, g) {
  const v = g.lastResult;
  const boss = BOSSES[v.scrollIndex];
  const el = ELEMENT_BY_ID[boss.element];
  drawHeader(ctx, 'THE INK RUNS DRY', `${boss.name} keeps its scroll — for now.`);
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(162, 104, 700, 300, 12);
  ctx.fill();
  ctx.strokeStyle = '#c1271b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = el.color;
  ctx.font = '700 64px "Noto Serif JP", serif';
  ctx.fillText(el.kanji, 512, 196);
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 26px Georgia, serif';
  ctx.fillText(boss.name, 512, 240);
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  ctx.fillText(`Weak against ${ELEMENT_BY_ID[boss.weakness].kanji} ${ELEMENT_BY_ID[boss.weakness].name} — draw it next time.`, 512, 270);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = '#2b2118';
  ctx.fillText(
    `You dealt ${v.damage} damage in ${formatTime(v.seconds)} · ${v.casts} casts at ${Math.round(v.accuracy * 100)}% accuracy · best combo x${v.maxCombo}`,
    512, 310,
  );
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  ctx.fillText('Every scroll can be rewritten. The dojo is open whenever you need it.', 512, 344);
  drawButton(ctx, g, 'retry', 312, 428, 180, 46, '↻  RETRY SCROLL', { fill: '#b02a1e', font: '700 17px Georgia, serif' });
  drawButton(ctx, g, 'dojo', 512, 428, 180, 46, 'TRAIN IN DOJO', { fill: '#2b2118', font: '700 17px Georgia, serif' });
  drawBackButton(ctx, g);
}

// --- Pause overlay. ---
export function drawPause(ctx, g) {
  ctx.fillStyle = 'rgba(26, 21, 18, 0.6)';
  ctx.fillRect(0, 0, 1024, 576);
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(312, 170, 400, 240, 16);
  ctx.fill();
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 32px Georgia, serif';
  ctx.fillText('PAUSED', 512, 222);
  ctx.font = 'italic 14px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  ctx.fillText('The brush rests. The ink waits.', 512, 248);
  drawButton(ctx, g, 'resume', 372, 272, 280, 42, 'RESUME  (P)', { fill: '#b02a1e' });
  drawButton(ctx, g, 'menu', 372, 324, 280, 42, 'ABANDON TO MENU', { fill: '#6b5a44' });
}

// --- Combo guide: every fusion pair, what it makes, and whether the
// player has cast it yet. ---
export function drawCombos(ctx, g) {
  drawHeader(ctx, 'FUSION COMBOS', 'Cast two elements within the fusion window and they fuse into one spell.');
  const discovered = new Set(g.progress.combosDiscovered ?? []);
  const windowSeconds = fusionWindowForRank(rankIndexFromPoints(g.progress.rankPoints));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 15px Georgia, serif';
  ctx.fillText(`Fusion window: ${windowSeconds} seconds after the first cast. Combos cost more ink — and hit much harder.`, 34, 108);
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillStyle = '#6b5a44';
  ctx.fillText(`${discovered.size} of ${COMBOS.length} combos discovered. Pairs work in either order.`, 34, 128);
  COMBOS.forEach((combo, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 30 + col * 324;
    const y = 144 + row * 176;
    const known = discovered.has(combo.id);
    const first = ELEMENT_BY_ID[combo.first];
    const second = ELEMENT_BY_ID[combo.second];
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(x, y, 300, 160, 12);
    ctx.fill();
    ctx.strokeStyle = known ? combo.color : 'rgba(43, 33, 24, 0.35)';
    ctx.lineWidth = known ? 3 : 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '700 30px "Noto Serif JP", serif';
    ctx.fillStyle = first.color;
    ctx.fillText(first.kanji, x + 52, y + 52);
    ctx.fillStyle = '#6b5a44';
    ctx.font = '700 20px Georgia, serif';
    ctx.fillText('+', x + 84, y + 48);
    ctx.fillStyle = second.color;
    ctx.font = '700 30px "Noto Serif JP", serif';
    ctx.fillText(second.kanji, x + 116, y + 52);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 20px Georgia, serif';
    ctx.fillText('→', x + 152, y + 48);
    ctx.fillStyle = combo.color;
    ctx.font = '700 34px "Noto Serif JP", serif';
    ctx.fillText(combo.kanji, x + 208, y + 56);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 19px Georgia, serif';
    ctx.fillText(combo.name, x + 150, y + 88);
    ctx.font = '12px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    const words = combo.desc.split(' ');
    let line = '';
    let ly = y + 108;
    for (const word of words) {
      if ((line + ' ' + word).length > 40) {
        ctx.fillText(line, x + 150, ly);
        line = word;
        ly += 15;
      } else line = line ? line + ' ' + word : word;
    }
    ctx.fillText(line, x + 150, ly);
    ctx.font = '700 13px Georgia, serif';
    ctx.fillStyle = '#2b2118';
    ctx.fillText(`Damage ${combo.damage}  ·  Ink ${combo.cost}`, x + 150, y + 146);
    if (known) drawSeal(ctx, x + 272, y + 30, 34, '知', 0.95, '#2b8a3e');
    else {
      ctx.fillStyle = '#adb5bd';
      ctx.font = 'italic 11px Georgia, serif';
      ctx.fillText('not yet cast', x + 262, y + 30);
    }
  });
  drawBackButton(ctx, g);
}

// --- Rank ladder: all 17 ranks, the player's place, and what each unlocks. ---
export function drawRank(ctx, g, time) {
  drawHeader(ctx, 'CALLIGRAPHY RANKS', 'Seventeen ranks, from 10th Kyu to Grand Calligrapher. Earn points with every stroke.');
  const { progress } = g;
  const rankIndex = rankIndexFromPoints(progress.rankPoints);
  const rank = RANKS[rankIndex];
  // Player summary strip.
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.roundRect(30, 92, 964, 44, 10);
  ctx.fill();
  drawSeal(ctx, 56, 114, 30, rank.seal, 1, rank.sealColor);
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 17px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`You are ${rank.name}`, 80, 115);
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = '#d9c9a8';
  ctx.fillText(`${progress.rankPoints} rank points  ·  Brush: ${BRUSH_STYLES[progress.brushStyle].name}  ·  Ink: ${INK_COLORS[progress.inkColor].name}`, 300, 115);
  const next = pointsToNextRank(progress.rankPoints);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe066';
  ctx.font = '700 13px Georgia, serif';
  ctx.fillText(next === null ? 'HIGHEST RANK' : `${next} pts to ${RANKS[rankIndex + 1].name}`, 974, 115);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // The ladder: 3 columns x 6 rows.
  RANKS.forEach((r, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 30 + col * 326;
    const y = 146 + row * 62;
    const current = i === rankIndex;
    const reached = i <= rankIndex;
    ctx.fillStyle = current ? '#fff3bf' : '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(x, y, 310, 54, 10);
    ctx.fill();
    ctx.strokeStyle = current ? '#e67700' : 'rgba(43, 33, 24, 0.3)';
    ctx.lineWidth = current ? 3 : 1.5;
    ctx.stroke();
    drawSeal(ctx, x + 26, y + 27, 34, r.seal, reached ? 1 : 0.35, r.sealColor);
    ctx.fillStyle = reached ? '#2b2118' : '#868e96';
    ctx.font = '700 15px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, x + 50, y + 22);
    ctx.font = '11px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(`${r.points} pts`, x + 50, y + 40);
    if (current) {
      ctx.fillStyle = '#e67700';
      ctx.font = '700 11px Georgia, serif';
      ctx.fillText('◀ YOU', x + 150, y + 22);
    }
    if (r.unlock) {
      ctx.fillStyle = reached ? '#2b2118' : '#868e96';
      ctx.font = '12px Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText(r.unlock.text, x + 300, y + 22);
      ctx.textAlign = 'left';
      // Equip buttons for brush / ink unlocks.
      if (reached && r.unlock.type === 'brush') {
        const equipped = progress.brushStyle === r.unlock.id;
        drawButton(ctx, g, `equip-brush-${r.unlock.id}`, x + 216, y + 28, 84, 20, equipped ? 'EQUIPPED' : 'EQUIP', {
          fill: equipped ? '#2b8a3e' : '#b02a1e', font: '700 10px Georgia, serif', disabled: equipped,
        });
      }
      if (reached && r.unlock.type === 'inkColor') {
        const equipped = progress.inkColor === r.unlock.id;
        drawButton(ctx, g, `equip-ink-${r.unlock.id}`, x + 216, y + 28, 84, 20, equipped ? 'EQUIPPED' : 'EQUIP', {
          fill: equipped ? '#2b8a3e' : '#b02a1e', font: '700 10px Georgia, serif', disabled: equipped,
        });
      }
    } else {
      ctx.fillStyle = '#6b5a44';
      ctx.font = 'italic 11px Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText('where every brush begins', x + 300, y + 22);
      ctx.textAlign = 'left';
    }
  });
  ctx.fillStyle = '#6b5a44';
  ctx.font = 'italic 12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Points: accuracy per cast (perfect = 10) · +25 per combo · +100 per boss · +50 per scroll · +150 for a no-damage clear', 512, 510);
  drawBackButton(ctx, g);
}

// --- Tutorial ("Cara Bermain"): three pages — an interactive lesson, an
// illustrated guide, and the full spells + combos reference. ---
export const TUT_PAD = { x: 490, y: 176, w: 300, h: 300 };

export function resetTutorial(g) {
  g.tutorial = {
    page: 'lesson', step: 0, strokes: [], currentStroke: null, drawing: false,
    lastStrokeAt: 0, dummyHp: 100, dummyMaxHp: 100, feedback: null,
    comboBanner: null, particles: makeParticles(), lastCastAt: null,
    lastHitAt: -10, completed: false,
  };
}

function drawTutorialTabs(ctx, g) {
  const tabs = [
    { id: 'tut-lesson', label: 'LESSON — TRY IT', page: 'lesson' },
    { id: 'tut-guide', label: 'GUIDE — HOW IT WORKS', page: 'guide' },
    { id: 'tut-spells', label: 'SPELLS & COMBOS', page: 'spells' },
  ];
  tabs.forEach((tab, i) => {
    const x = 30 + i * 208;
    const active = g.tutorial.page === tab.page;
    drawButton(ctx, g, tab.id, x, 88, 200, 30, tab.label, {
      fill: active ? '#b02a1e' : '#6b5a44', font: '700 12px Georgia, serif',
    });
  });
}

function drawPracticeDummy(ctx, x, y, r, time, hitAt) {
  const shake = time - hitAt < 0.3 ? Math.sin(time * 60) * 4 : 0;
  // Wooden stand.
  ctx.fillStyle = '#8d5a2b';
  ctx.fillRect(x - 5 + shake, y, 10, 70);
  ctx.fillRect(x - 34 + shake, y + 66, 68, 8);
  // Straw target: concentric rings, like a kyudo mato.
  const rings = [
    { r: 1.0, color: '#e8d9b0' },
    { r: 0.78, color: '#c9a86a' },
    { r: 0.55, color: '#e8d9b0' },
    { r: 0.34, color: '#c1271b' },
    { r: 0.16, color: '#2b2118' },
  ];
  for (const ringDef of rings) {
    ctx.fillStyle = ringDef.color;
    ctx.beginPath();
    ctx.arc(x + shake, y, r * ringDef.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + shake + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4);
    ctx.lineTo(x + shake + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
    ctx.stroke();
  }
}

function drawTutorialLesson(ctx, g, time) {
  const t = g.tutorial;
  const windowSeconds = fusionWindowForRank(rankIndexFromPoints(g.progress.rankPoints));
  const stepText = t.completed
    ? 'Lesson complete! You cast fire, then fused it into Firestorm. The scrolls await.'
    : t.step === 0
      ? 'Step 1: draw 火 (fire) in the ink pad — follow the numbered ghost strokes, then pause to cast.'
      : `Step 2: draw 風 (wind) within ${windowSeconds} seconds — fire + wind fuses into FIRESTORM!`;
  ctx.fillStyle = 'rgba(43, 33, 24, 0.92)';
  ctx.beginPath();
  ctx.roundRect(30, 128, 944, 38, 10);
  ctx.fill();
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stepText, 512, 148);
  ctx.textBaseline = 'alphabetic';
  // Dummy panel.
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(30, 176, 440, 300, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('PRACTICE DUMMY', 250, 202);
  ctx.fillStyle = 'rgba(43, 33, 24, 0.25)';
  ctx.beginPath();
  ctx.roundRect(150, 212, 200, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#c1271b';
  ctx.beginPath();
  ctx.roundRect(150, 212, Math.max(14, 200 * (t.dummyHp / t.dummyMaxHp)), 14, 7);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 12px Georgia, serif';
  ctx.fillText(`${Math.max(0, Math.round(t.dummyHp))} / ${t.dummyMaxHp}`, 250, 248);
  drawPracticeDummy(ctx, 250, 330, 62, time, t.lastHitAt);
  ctx.fillStyle = '#6b5a44';
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillText(t.dummyHp <= 0 ? 'The dummy is ash. Well struck!' : 'It never fights back. Probably.', 250, 452);
  drawParticles(ctx, t.particles);
  // Ink pad with the ghost guide for the current step.
  const ghostId = t.completed ? 'fire' : t.step === 0 ? 'fire' : 'wind';
  const ghost = ELEMENT_BY_ID[ghostId];
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.roundRect(TUT_PAD.x, TUT_PAD.y, TUT_PAD.w, TUT_PAD.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = ghost.color;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ghost.strokes.forEach((stroke, i) => {
    ctx.beginPath();
    stroke.forEach(([sx, sy], j) => {
      const px = TUT_PAD.x + sx * TUT_PAD.w;
      const py = TUT_PAD.y + sy * TUT_PAD.h;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    const [fx, fy] = stroke[0];
    ctx.fillStyle = ghost.color;
    ctx.font = '700 14px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), TUT_PAD.x + fx * TUT_PAD.w - 8, TUT_PAD.y + fy * TUT_PAD.h - 6);
  });
  ctx.restore();
  for (const stroke of t.strokes) {
    drawBrushStroke(ctx, stroke.map(([sx, sy]) => [TUT_PAD.x + sx, TUT_PAD.y + sy]));
  }
  if (t.currentStroke) {
    drawBrushStroke(ctx, t.currentStroke.map(([sx, sy]) => [TUT_PAD.x + sx, TUT_PAD.y + sy]));
  }
  // Side panel: steps, fusion countdown, feedback.
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(810, 176, 164, 300, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 14px Georgia, serif';
  ctx.fillText('LESSON', 826, 202);
  const steps = [
    { label: '1. Cast 火 Fire', done: t.step >= 1 || t.completed, now: t.step === 0 && !t.completed },
    { label: '2. Fuse 風 Wind', done: t.completed, now: t.step === 1 && !t.completed },
    { label: '3. Dummy down!', done: t.completed, now: false },
  ];
  ctx.font = '13px Georgia, serif';
  steps.forEach((s, i) => {
    ctx.fillStyle = s.done ? '#2b8a3e' : s.now ? '#b02a1e' : '#868e96';
    ctx.fillText(`${s.done ? '✓' : s.now ? '►' : '○'} ${s.label}`, 826, 228 + i * 24);
  });
  if (t.step === 1 && t.lastCastAt !== null && !t.completed) {
    const left = Math.max(0, windowSeconds - (g.time - t.lastCastAt));
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 13px Georgia, serif';
    ctx.fillText(`Fusion: ${left.toFixed(1)}s`, 826, 318);
    ctx.fillStyle = 'rgba(43, 33, 24, 0.2)';
    ctx.fillRect(826, 326, 132, 8);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(826, 326, 132 * (left / windowSeconds), 8);
  }
  if (t.feedback) {
    ctx.fillStyle = t.feedback.color;
    ctx.font = '700 13px Georgia, serif';
    const words = t.feedback.text.split(' ');
    let line = '';
    let ly = 360;
    for (const word of words) {
      if ((line + ' ' + word).length > 20) {
        ctx.fillText(line, 826, ly);
        line = word;
        ly += 17;
      } else line = line ? line + ' ' + word : word;
    }
    ctx.fillText(line, 826, ly);
  }
  // Combo banner on success.
  if (t.comboBanner && t.comboBanner.timer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.comboBanner.timer);
    ctx.translate(250, 250);
    ctx.fillStyle = 'rgba(26, 21, 18, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-180, -44, 360, 88, 14);
    ctx.fill();
    ctx.strokeStyle = '#e8590c';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff922b';
    ctx.font = '700 40px "Noto Serif JP", serif';
    ctx.fillText('炎嵐', 0, -2);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '700 22px Georgia, serif';
    ctx.fillText('FIRESTORM!', 0, 30);
    ctx.restore();
  }
  drawButton(ctx, g, 'tut-reset', 30, 492, 150, 32, 'RESET LESSON', { fill: '#6b5a44', font: '700 12px Georgia, serif' });
  if (t.completed) {
    drawButton(ctx, g, 'play', 824, 492, 150, 32, 'PLAY NOW →', { fill: '#b02a1e', font: '700 12px Georgia, serif' });
  }
  drawBackButton(ctx, g);
}

function drawTutorialGuide(ctx, g, time) {
  // Card 1: drawing, with an animated example stroke.
  const cards = [
    { x: 30, title: '1. DRAW THE KANJI', body: 'Press and drag inside the ink pad. Numbered ghost strokes show the shape and order — trace them with your mouse.' },
    { x: 362, title: '2. ACCURACY MATTERS', body: 'Every cast is scored. Clean strokes hit harder; 90% or better is PERFECT: critical damage and bonus ink.' },
    { x: 694, title: '3. MIND YOUR INK', body: 'Every cast costs ink. It refills over time and when spells land. Big spells — and combos — cost more.' },
  ];
  cards.forEach((card, i) => {
    const w = i === 2 ? 280 : 300;
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(card.x, 128, w, 172, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 15px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.title, card.x + 16, 152);
  });
  // Animated mini-pad: the fire kanji draws itself, stroke by stroke.
  const mini = { x: 50, y: 164, w: 110, h: 110 };
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.roundRect(mini.x, mini.y, mini.w, mini.h, 8);
  ctx.fill();
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const fire = ELEMENT_BY_ID.fire;
  const cycle = (time % 4) / 4;
  const total = fire.strokes.length;
  fire.strokes.forEach((stroke, si) => {
    const start = si / total;
    const end = (si + 1) / total;
    if (cycle <= start) return;
    const f = Math.min(1, (cycle - start) / (end - start));
    const pts = stroke.map(([sx, sy]) => [mini.x + sx * mini.w, mini.y + sy * mini.h]);
    const shown = pts.slice(0, Math.max(2, Math.ceil(pts.length * f)));
    drawBrushStroke(ctx, shown, '#1a1512', 7);
  });
  ctx.fillStyle = '#6b5a44';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'left';
  const wrap = (text, x, y, maxLen) => {
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      if ((line + ' ' + word).length > maxLen) {
        ctx.fillText(line, x, ly);
        line = word;
        ly += 16;
      } else line = line ? line + ' ' + word : word;
    }
    ctx.fillText(line, x, ly);
  };
  wrap(cards[0].body, 172, 176, 22);
  // Accuracy meter diagram.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.2)';
  ctx.beginPath();
  ctx.roundRect(378, 200, 268, 18, 9);
  ctx.fill();
  const grad = ctx.createLinearGradient(378, 0, 646, 0);
  grad.addColorStop(0, '#c1271b');
  grad.addColorStop(0.55, '#e67700');
  grad.addColorStop(0.9, '#2b8a3e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(378, 200, 268 * 0.92, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#2b8a3e';
  ctx.font = '700 16px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('92% — PERFECT!', 512, 246);
  ctx.fillStyle = '#6b5a44';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'left';
  wrap(cards[1].body, 378, 268, 44);
  // Ink meter diagram.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.2)';
  ctx.beginPath();
  ctx.roundRect(710, 180, 248, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#1971c2';
  ctx.beginPath();
  ctx.roundRect(710, 180, 248 * 0.64, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('INK 64 / 100', 834, 216);
  ctx.font = '700 13px Georgia, serif';
  ['火 18', '水 20', '雷 24', '光 35'].forEach((chip, i) => {
    ctx.fillStyle = 'rgba(43, 33, 24, 0.08)';
    ctx.beginPath();
    ctx.roundRect(710 + i * 62, 228, 56, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.fillText(chip, 738 + i * 62, 245);
  });
  ctx.fillStyle = '#6b5a44';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'left';
  wrap(cards[2].body, 710, 272, 40);
  // Row 2: combos, the wheel, controls.
  const row2 = [
    { x: 30, w: 300, title: '4. FUSE COMBOS' },
    { x: 362, w: 300, title: '5. THE ELEMENTAL WHEEL' },
    { x: 694, w: 280, title: 'CONTROLS' },
  ];
  row2.forEach((card) => {
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(card.x, 312, card.w, 168, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 15px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.title, card.x + 16, 336);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8590c';
  ctx.font = '700 30px "Noto Serif JP", serif';
  ctx.fillText('火', 80, 392);
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 18px Georgia, serif';
  ctx.fillText('+', 112, 388);
  ctx.fillStyle = '#2b8a3e';
  ctx.font = '700 30px "Noto Serif JP", serif';
  ctx.fillText('風', 144, 392);
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 18px Georgia, serif';
  ctx.fillText('→', 178, 388);
  ctx.fillStyle = '#e8590c';
  ctx.font = '700 30px "Noto Serif JP", serif';
  ctx.fillText('炎嵐', 226, 392);
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 14px Georgia, serif';
  ctx.fillText('FIRESTORM', 180, 420);
  const wfrac = 1 - ((time % 4) / 4);
  ctx.fillStyle = 'rgba(43, 33, 24, 0.2)';
  ctx.fillRect(46, 432, 268, 8);
  ctx.fillStyle = '#ffd43b';
  ctx.fillRect(46, 432, 268 * wfrac, 8);
  ctx.fillStyle = '#6b5a44';
  ctx.font = '12px Georgia, serif';
  ctx.fillText('Cast two elements within 4 seconds to fuse them.', 180, 460);
  drawWheel(ctx, 512, 402, 52);
  ctx.fillStyle = '#6b5a44';
  ctx.font = '12px Georgia, serif';
  ctx.fillText('Arrows point from winner to loser.', 512, 472);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2118';
  ctx.font = '13px Georgia, serif';
  const controls = [
    'Mouse — draw in the ink pad',
    'WASD / arrows — move, dodge',
    '1–8 — pick an element',
    'Space — cast now · C — clear',
    'P — pause · M — mute',
  ];
  controls.forEach((line, i) => ctx.fillText(line, 710, 360 + i * 22));
  drawBackButton(ctx, g);
}

function drawTutorialSpells(ctx, g) {
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 15px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('THE EIGHT SPELLS — draw the kanji to cast', 34, 112);
  ELEMENTS.forEach((e, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 30 + col * 244;
    const y = 124 + row * 84;
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(x, y, 224, 76, 10);
    ctx.fill();
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = e.color;
    ctx.font = '700 36px "Noto Serif JP", serif';
    ctx.textAlign = 'left';
    ctx.fillText(e.kanji, x + 12, y + 50);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 14px Georgia, serif';
    ctx.fillText(e.name, x + 62, y + 26);
    ctx.font = '11px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(`${e.effect} · DMG ${e.damage} · INK ${e.cost}`, x + 62, y + 44);
    ctx.fillText(`${e.strokes.length} strokes`, x + 62, y + 60);
  });
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 15px Georgia, serif';
  ctx.fillText('THE SIX FUSIONS — cast the pair within the fusion window', 34, 306);
  COMBOS.forEach((combo, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 30 + col * 324;
    const y = 318 + row * 78;
    const first = ELEMENT_BY_ID[combo.first];
    const second = ELEMENT_BY_ID[combo.second];
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(x, y, 304, 70, 10);
    ctx.fill();
    ctx.strokeStyle = combo.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = first.color;
    ctx.font = '700 26px "Noto Serif JP", serif';
    ctx.fillText(first.kanji, x + 12, y + 42);
    ctx.fillStyle = '#6b5a44';
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText('+', x + 44, y + 38);
    ctx.fillStyle = second.color;
    ctx.font = '700 26px "Noto Serif JP", serif';
    ctx.fillText(second.kanji, x + 62, y + 42);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText('→', x + 94, y + 38);
    ctx.fillStyle = combo.color;
    ctx.font = '700 26px "Noto Serif JP", serif';
    ctx.fillText(combo.kanji, x + 116, y + 42);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 14px Georgia, serif';
    ctx.fillText(combo.name, x + 162, y + 28);
    ctx.font = '11px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(`DMG ${combo.damage} · INK ${combo.cost} · ${combo.effect}`, x + 162, y + 46);
  });
  drawBackButton(ctx, g);
}

export function drawTutorial(ctx, g, time) {
  drawHeader(ctx, 'CARA BERMAIN — HOW TO PLAY', 'Learn the brush in minutes, then master the storm.');
  drawTutorialTabs(ctx, g);
  if (g.tutorial.page === 'lesson') drawTutorialLesson(ctx, g, time);
  else if (g.tutorial.page === 'guide') drawTutorialGuide(ctx, g, time);
  else drawTutorialSpells(ctx, g);
}

export function tutorialMouseDown(g, x, y) {
  const t = g.tutorial;
  if (t.page !== 'lesson' || t.completed) return false;
  const p = TUT_PAD;
  if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
    t.drawing = true;
    t.currentStroke = [[x - p.x, y - p.y]];
    playBrushSwish();
    return true;
  }
  return false;
}

export function tutorialMouseMove(g, x, y) {
  const t = g.tutorial;
  if (!t.drawing || !t.currentStroke) return;
  const p = TUT_PAD;
  const px = x - p.x;
  const py = y - p.y;
  const last = t.currentStroke[t.currentStroke.length - 1];
  if (Math.hypot(px - last[0], py - last[1]) > 3) t.currentStroke.push([px, py]);
}

export function tutorialMouseUp(g) {
  const t = g.tutorial;
  if (!t.drawing) return;
  t.drawing = false;
  if (t.currentStroke && isRealStroke(t.currentStroke)) {
    t.strokes.push(t.currentStroke);
    t.lastStrokeAt = performance.now();
  }
  t.currentStroke = null;
}

export function tutorialJudge(g) {
  const t = g.tutorial;
  if (t.strokes.length === 0 || t.completed) return;
  const result = recognise(t.strokes);
  t.strokes = [];
  const windowSeconds = fusionWindowForRank(rankIndexFromPoints(g.progress.rankPoints));
  if (t.step === 0) {
    if (result.element && result.element.id === 'fire') {
      const acc = Math.round(result.accuracy * 100);
      t.dummyHp = Math.max(0, t.dummyHp - 34);
      t.lastHitAt = g.time;
      t.feedback = { text: `火 Fire — ${acc}%! The dummy burns.`, color: '#e8590c' };
      burst(t.particles, 250, 330, '#ff922b', 24, 200, 5, 0.8);
      ring(t.particles, 250, 330, '#e8590c', 90);
      playElementImpact('fire');
      t.step = 1;
      t.lastCastAt = g.time;
    } else if (result.element) {
      t.feedback = { text: `That was ${result.element.kanji} ${result.element.name} — draw 火 (fire)!`, color: '#868e96' };
    } else {
      t.feedback = { text: 'Unclear stroke — follow the ghost numbers.', color: '#868e96' };
    }
    return;
  }
  // Step 1: wind inside the fusion window.
  const withinWindow = t.lastCastAt !== null && (g.time - t.lastCastAt) <= windowSeconds;
  if (!withinWindow) {
    t.feedback = { text: 'Too slow — draw 火 again to restart the fusion.', color: '#c1271b' };
    t.step = 0;
    t.lastCastAt = null;
    return;
  }
  if (result.element && result.element.id === 'wind') {
    t.dummyHp = 0;
    t.lastHitAt = g.time;
    t.completed = true;
    t.step = 2;
    t.comboBanner = { timer: 2.5 };
    t.feedback = { text: 'FIRESTORM! Fire + wind fused. Lesson complete!', color: '#e8590c' };
    burst(t.particles, 250, 330, '#ff922b', 40, 280, 6, 1);
    burst(t.particles, 250, 330, '#69db7c', 24, 220, 5, 0.9);
    ring(t.particles, 250, 330, '#e8590c', 140);
    playCombo();
  } else if (result.element) {
    t.feedback = { text: `That was ${result.element.kanji} — draw 風 (wind) to fuse!`, color: '#868e96' };
  } else {
    t.feedback = { text: 'Unclear stroke — follow the ghost numbers.', color: '#868e96' };
  }
}

export function updateTutorial(g, dt) {
  const t = g.tutorial;
  updateParticles(t.particles, dt);
  if (t.comboBanner) {
    t.comboBanner.timer -= dt;
    if (t.comboBanner.timer <= 0) t.comboBanner = null;
  }
  if (t.page === 'lesson' && !t.completed) {
    if (t.strokes.length > 0 && !t.drawing && performance.now() - t.lastStrokeAt > 900) {
      tutorialJudge(g);
    }
    if (t.step === 1 && t.lastCastAt !== null) {
      const windowSeconds = fusionWindowForRank(rankIndexFromPoints(g.progress.rankPoints));
      if (g.time - t.lastCastAt > windowSeconds) {
        t.feedback = { text: 'The fusion window closed — draw 火 again.', color: '#c1271b' };
        t.step = 0;
        t.lastCastAt = null;
      }
    }
  }
}

// Keep the unused imports honest: the dojo's judging bursts ink on success.
export function dojoCelebrate(particles, x, y, color) {
  burst(particles, x, y, color, 16, 160, 5, 0.6);
  floatText(particles, x, y - 20, 'Well drawn!', color, 18);
}
