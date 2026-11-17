// INKBLADE Playwright smoke test + screenshot capture.
// Run with the game served: `node serve.ts` (port 8080), then
//   node tests/smoke.mjs
// (Playwright is imported by absolute path from the shared install; the
// browser binaries live in ~/.cache/ms-playwright.)
// It loads the game, plays a real fight (draws real kanji with the mouse),
// fuses a combo spell, walks every screen (including the tutorial lesson,
// the combos guide and the rank ladder), reaches victory and defeat, checks
// localStorage persistence, and captures the 4 entry screenshots at
// 1280x720 into screenshots/. Exits 1 on any failed check. No network
// request outside localhost allowed.

import { chromium } from '/home/hatch/workspace/makefun/agentstrike-shots/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ARENA, BANNER, BATTLE_RECORD_PANEL, BOTTOM_ROW, ELEMENT_BY_ID, FUSION_SEALS_PANEL, PAD, WINLOSE_STRIP } from '../game/src/config.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = 'http://localhost:8080';
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`;
  results.push(line);
  console.log(line);
  if (!ok) failures += 1;
}

// Draw one element's kanji with real mouse strokes, in any pad. Two
// interpolated moves per segment at 5 ms: each mouse round-trip costs
// ~80 ms in this VM, so 5 moves/segment made a draw take ~3 s — the
// 900 ms auto-cast pause fired mid-kanji and the fire→wind cast gap
// blew past the 4 s fusion window. Two moves is plenty for the
// recogniser (it resamples each stroke to 16 points anyway) and keeps
// a draw near ~1 s with a comfortable fusion margin.
async function drawKanjiAt(page, elementId, padX, padY, padW, padH) {
  const el = ELEMENT_BY_ID[elementId];
  for (const stroke of el.strokes) {
    const pts = stroke.map(([sx, sy]) => [padX + sx * padW, padY + sy * padH]);
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      for (let s = 1; s <= 2; s += 1) {
        await page.mouse.move(x0 + ((x1 - x0) * s) / 3, y0 + ((y1 - y0) * s) / 3);
        await page.waitForTimeout(5);
      }
    }
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
}

// Draw one element's kanji in the combat ink pad with real mouse strokes.
async function drawKanji(page, elementId) {
  await drawKanjiAt(page, elementId, PAD.x, PAD.y, PAD.w, PAD.h);
}

async function clickButton(page, x, y) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(250);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1024, height: 576 } });
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const outsideRequests = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => pageErrors.push(String(err)));
page.on('request', (req) => {
  if (!req.url().startsWith('http://localhost:8080')) outsideRequests.push(req.url());
});

// --- 1. Menu loads. ---
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const screen0 = await page.evaluate(() => window.__inkblade.screen);
check('menu loads', screen0 === 'menu', `screen=${screen0}`);

// --- 2. Play -> combat intro -> fight. ---
await clickButton(page, 782, 380); // PLAY button (menu dashboard, right column)
await page.waitForTimeout(2600);
const screen1 = await page.evaluate(() => window.__inkblade.screen);
const phase1 = await page.evaluate(() => window.__inkblade.combat?.phase);
check('combat starts', screen1 === 'combat' && phase1 === 'fight', `screen=${screen1} phase=${phase1}`);

// --- 2b. The fix round: big boss, minions, WIN/LOSE strip, bigger pad. ---
const combatLayout = await page.evaluate(() => ({
  bossR: window.__inkblade.combat.boss.r,
  bossY: window.__inkblade.combat.boss.y,
  minions: window.__inkblade.combat.summons.filter((s) => s.minion).length,
}));
check('boss is big and centre-frame', combatLayout.bossR >= 90, `r=${combatLayout.bossR}`);
check('minions spawn with the fight', combatLayout.minions >= 2, `minions=${combatLayout.minions}`);
check('ink pad is bigger', PAD.w >= 296 && PAD.h >= 288, `pad ${PAD.w}x${PAD.h}`);
check('WIN/LOSE strip sits above the arena, clear of the pad',
  WINLOSE_STRIP.y + WINLOSE_STRIP.h <= ARENA.y && WINLOSE_STRIP.x + WINLOSE_STRIP.w <= PAD.x,
  `strip ${WINLOSE_STRIP.w}x${WINLOSE_STRIP.h} at y${WINLOSE_STRIP.y}, arena y${ARENA.y}`);
check('fusion banner clears the boss head',
  BANNER.cy + BANNER.h / 2 < combatLayout.bossY - combatLayout.bossR,
  `banner bottom ${BANNER.cy + BANNER.h / 2}, boss top ${combatLayout.bossY - combatLayout.bossR}`);
check('bottom row sits below the arena, clear of the pad and the frame',
  BOTTOM_ROW.y >= ARENA.y + ARENA.h && BOTTOM_ROW.y + BOTTOM_ROW.h <= 576 && BOTTOM_ROW.x + BOTTOM_ROW.w <= PAD.x,
  `row y${BOTTOM_ROW.y}..${BOTTOM_ROW.y + BOTTOM_ROW.h}, arena ends ${ARENA.y + ARENA.h}, pad x${PAD.x}`);
check('bottom row panels tile the row exactly, same height, 8px gap',
  BATTLE_RECORD_PANEL.y === BOTTOM_ROW.y && FUSION_SEALS_PANEL.y === BOTTOM_ROW.y
  && BATTLE_RECORD_PANEL.h === BOTTOM_ROW.h && FUSION_SEALS_PANEL.h === BOTTOM_ROW.h
  && BATTLE_RECORD_PANEL.x === BOTTOM_ROW.x
  && FUSION_SEALS_PANEL.x === BATTLE_RECORD_PANEL.x + BATTLE_RECORD_PANEL.w + 8
  && FUSION_SEALS_PANEL.x + FUSION_SEALS_PANEL.w === BOTTOM_ROW.x + BOTTOM_ROW.w,
  `record ${BATTLE_RECORD_PANEL.w} + seals ${FUSION_SEALS_PANEL.w} = row ${BOTTOM_ROW.w}`);

// Keep the painter safe while the test draws, and silence the boss's
// attacks: taking a hit resets the combo chain, which would make the
// combo test flaky. (The defeat section re-enables damage on purpose.)
// The minions are cleared too — they drift into the painter and hit just
// like a boss attack. Their spawn was already verified in section 2b.
await page.evaluate(() => {
  const c = window.__inkblade.combat;
  c.player.hp = 1000;
  c.boss.attackTimer = 999;
  c.summons = [];
  c.minionTimer = 999;
});
const bossHpBefore = await page.evaluate(() => window.__inkblade.combat.boss.hp);

// --- 3. Draw a real fire kanji; it must cast and damage the boss. ---
await drawKanji(page, 'fire');
await page.waitForTimeout(1800);
const afterFire = await page.evaluate(() => ({
  bossHp: window.__inkblade.combat.boss.hp,
  casts: window.__inkblade.combat.stats.casts,
  combo: window.__inkblade.combat.combo.count,
  ink: window.__inkblade.combat.ink,
}));
check('fire kanji casts', afterFire.casts >= 1, `casts=${afterFire.casts}`);
check('boss takes damage', afterFire.bossHp < bossHpBefore, `hp ${bossHpBefore} -> ${afterFire.bossHp}`);
check('combo counts', afterFire.combo >= 1, `combo=${afterFire.combo}`);

// --- 4. Draw water right away; a second cast inside the 6s window chains
// the combo. (This runs before the fizzle test: that section takes ~8s,
// longer than the combo window.)
await drawKanji(page, 'water');
await page.waitForTimeout(1800);
const afterWater = await page.evaluate(() => ({
  casts: window.__inkblade.combat.stats.casts,
  combo: window.__inkblade.combat.combo.count,
}));
check('water kanji casts, combo chains', afterWater.casts >= 2 && afterWater.combo >= 2, `casts=${afterWater.casts} combo=${afterWater.combo}`);

// --- 4b. Insufficient ink: an empty well refuses the cast with feedback.
// The refill is paused too, or the well refills mid-draw and the cast lands.
await page.evaluate(() => {
  const c = window.__inkblade.combat;
  c.ink = 0;
  c.refill = 0;
  c.boss.attackTimer = 999;
});
const castsBeforeFizzle = await page.evaluate(() => window.__inkblade.combat.stats.casts);
await drawKanji(page, 'fire');
await page.waitForTimeout(1800);
const afterFizzle = await page.evaluate(() => ({
  casts: window.__inkblade.combat.stats.casts,
  feedback: window.__inkblade.combat.castFeedback?.text,
}));
check('empty ink refuses the cast', afterFizzle.casts === castsBeforeFizzle && afterFizzle.feedback === 'NOT ENOUGH INK', JSON.stringify(afterFizzle));
await page.evaluate(() => {
  const c = window.__inkblade.combat;
  c.ink = 100;
  c.refill = 6;
  c.boss.attackTimer = 999;
});

// --- 4c. Fusion: fire then wind inside the window becomes FIRESTORM. ---
await page.evaluate(() => {
  const c = window.__inkblade.combat;
  c.boss.hp = 500; // keep the boss alive through the fusion test
  c.ink = 100;
  c.boss.attackTimer = 999;
});
await drawKanji(page, 'fire');
await page.waitForTimeout(1000); // just past the 900ms auto-cast pause
await drawKanji(page, 'wind');
// --- 4d. Float texts never overlap the fusion banner: sample the live
// float positions for 1.5s while the fusion lands and check every one
// stays outside the banner rect.
let floatsSeen = 0;
let floatsClear = true;
for (let i = 0; i < 15; i += 1) {
  const sample = await page.evaluate(({ bx, by, bw, bh }) => {
    const c = window.__inkblade.combat;
    const inside = c.particles.texts.filter((t) =>
      t.x > bx - bw / 2 && t.x < bx + bw / 2 && t.y > by - bh / 2 && t.y < by + bh / 2);
    return { n: c.particles.texts.length, inside: inside.length };
  }, { bx: ARENA.x + ARENA.w / 2, by: BANNER.cy, bw: BANNER.w, bh: BANNER.h });
  floatsSeen = Math.max(floatsSeen, sample.n);
  if (sample.inside > 0) floatsClear = false;
  await page.waitForTimeout(100);
}
check('float texts never overlap the fusion banner', floatsClear && floatsSeen > 0, `floats seen=${floatsSeen} clear=${floatsClear}`);
await page.waitForTimeout(800);
const afterFusion = await page.evaluate(() => ({
  combos: window.__inkblade.combat.stats.combos,
  discovered: window.__inkblade.progress.combosDiscovered,
}));
check('fire+wind fuses into a combo', afterFusion.combos >= 1, JSON.stringify(afterFusion));
check('combo is recorded in the codex', afterFusion.discovered.includes('firestorm'), JSON.stringify(afterFusion.discovered));

// --- 4e. Battle record + fusion seals: the bottom row reads real data. ---
const record = await page.evaluate(() => {
  const c = window.__inkblade.combat;
  return {
    log: c.battleLog.map((e) => e.text),
    stats: { casts: c.stats.casts, damage: c.stats.damage, maxCombo: c.stats.maxCombo },
    seals: [...c.discoveredCombos],
  };
});
check('battle log records real events (spell hit + fusion)',
  record.log.some((t) => t.includes('Fire hits for')) && record.log.some((t) => t.includes('Firestorm fused!')),
  record.log.join(' | '));
check('battle log never exceeds 5 entries',
  record.log.length <= 5, `${record.log.length} entries`);
check('battle stats update during the fight',
  record.stats.casts >= 3 && record.stats.damage > 0 && record.stats.maxCombo >= 1,
  `casts ${record.stats.casts}, damage ${record.stats.damage}, max combo x${record.stats.maxCombo}`);
check('a fused combo lights its seal',
  record.seals.includes('firestorm'), `discovered: ${record.seals.join(', ') || '(none)'}`);

// --- 5. Pause and resume. ---
await page.keyboard.press('p');
await page.waitForTimeout(300);
const paused = await page.evaluate(() => window.__inkblade.paused);
await clickButton(page, 512, 293); // RESUME
const resumed = await page.evaluate(() => window.__inkblade.paused);
check('pause/resume works', paused === true && resumed === false, `paused=${paused} resumed=${resumed}`);

// --- 6. Finish the boss -> victory screen -> shop -> next scroll. ---
await page.evaluate(() => { window.__inkblade.combat.boss.hp = 1; });
await drawKanji(page, 'water');
await page.waitForTimeout(3000);
const screen2 = await page.evaluate(() => window.__inkblade.screen);
check('victory screen reached', screen2 === 'victory', `screen=${screen2}`);
const victoryResult = await page.evaluate(() => window.__inkblade.lastResult);
check('victory stats recorded', victoryResult && victoryResult.damage > 0 && victoryResult.casts >= 2, JSON.stringify(victoryResult));
check('fight grade awarded', victoryResult && ['S', 'A', 'B', 'C'].includes(victoryResult.grade), `grade=${victoryResult?.grade}`);
const rankAfterFight = await page.evaluate(() => window.__inkblade.progress.rankPoints);
check('rank points awarded', victoryResult.rankPoints > 0 && rankAfterFight >= victoryResult.rankPoints, `fight +${victoryResult.rankPoints}, total ${rankAfterFight}`);
const victoryLog = await page.evaluate(() => window.__inkblade.combat.battleLog.map((e) => e.text));
check('battle log caps at 5, keeps the seal last',
  victoryLog.length === 5 && victoryLog[victoryLog.length - 1] === 'Kagaribi sealed!'
  && victoryLog.some((t) => t.includes('fused!')) && victoryLog.some((t) => t.includes('enraged!')),
  victoryLog.join(' | '));
// --- 6b. Feats: the first seal and the first fusion unlocked. ---
const featsAfterFight = await page.evaluate(() => window.__inkblade.feats);
check('feats unlock on fight milestones', featsAfterFight.includes('first-seal') && featsAfterFight.includes('first-fusion'), JSON.stringify(featsAfterFight));
const bestByDiff = await page.evaluate(() => window.__inkblade.progress.bestScores);
check('best score stored per difficulty', bestByDiff.calligrapher > 0, JSON.stringify(bestByDiff));
await clickButton(page, 726, 502); // SHOP
await page.waitForTimeout(300);
const screen3 = await page.evaluate(() => window.__inkblade.screen);
check('shop opens', screen3 === 'shop', `screen=${screen3}`);
const essenceBefore = await page.evaluate(() => window.__inkblade.run.essence);
await clickButton(page, 118, 267); // buy Deep Ink Well (first card)
const bought = await page.evaluate(() => ({
  owned: window.__inkblade.run.upgradesOwned.well ?? 0,
  essence: window.__inkblade.run.essence,
}));
check('shop purchase works', bought.owned === 1 && bought.essence < essenceBefore, `owned=${bought.owned} essence ${essenceBefore}->${bought.essence}`);
// --- 6c. Between scrolls: the shop's NEXT SCROLL routes to the draft. ---
await clickButton(page, 839, 541); // NEXT SCROLL
await page.waitForTimeout(300);
check('draft opens after victory', (await page.evaluate(() => window.__inkblade.screen)) === 'draft');
// Reroll: fund the essence, pay the rising cost, get a fresh hand.
// (Wait a beat after funding: the reroll button only re-registers as
// enabled on the next frame after the essence changes.)
await page.evaluate(() => { window.__inkblade.run.essence = 100; });
await page.waitForTimeout(300);
await clickButton(page, 512, 462); // REROLL
const draftAfterReroll = await page.evaluate(() => ({
  cards: [...window.__inkblade.draft.cards],
  rerolls: window.__inkblade.draft.rerolls,
  essence: window.__inkblade.run.essence,
}));
check('draft reroll costs essence and redeals', draftAfterReroll.rerolls === 1 && draftAfterReroll.essence === 80 && draftAfterReroll.cards.length === 3, JSON.stringify(draftAfterReroll));
// Pick the first blessing: the run must change and the roads must open.
const runBeforePick = await page.evaluate(() => {
  const r = window.__inkblade.run;
  return { maxInk: r.maxInk, damage: r.damage, refill: r.refill, maxHp: r.maxHp, comboWindow: r.comboWindow, essence: r.essence, startShielded: r.startShielded, fusionWindow: r.fusionWindow };
});
await clickButton(page, 180, 379); // PICK on the first blessing card
await page.waitForTimeout(300);
check('roads open after the draft pick', (await page.evaluate(() => window.__inkblade.screen)) === 'roads');
const runAfterPick = await page.evaluate(() => {
  const r = window.__inkblade.run;
  return { maxInk: r.maxInk, damage: r.damage, refill: r.refill, maxHp: r.maxHp, comboWindow: r.comboWindow, essence: r.essence, startShielded: r.startShielded, fusionWindow: r.fusionWindow };
});
const pickChanged = Object.keys(runBeforePick).some((k) => runBeforePick[k] !== runAfterPick[k]);
check('blessing applies to the run', pickChanged, `${JSON.stringify(runBeforePick)} -> ${JSON.stringify(runAfterPick)}`);
// --- 6d. Roads: take the Mountain Path (+60 essence, tougher minions). ---
const essenceBeforeRoad = await page.evaluate(() => window.__inkblade.run.essence);
await clickButton(page, 266, 411); // TAKE THIS ROAD (Mountain Path)
await page.waitForTimeout(300);
check('shop opens after the road choice', (await page.evaluate(() => window.__inkblade.screen)) === 'shop');
const roadApplied = await page.evaluate(() => ({
  essence: window.__inkblade.run.essence,
  minionMul: window.__inkblade.run.roadMinionHpMul,
}));
check('mountain road grants essence and toughens minions', roadApplied.essence === essenceBeforeRoad + 60 && roadApplied.minionMul === 1.5, JSON.stringify(roadApplied));
await clickButton(page, 839, 541); // NEXT SCROLL
await page.waitForTimeout(2600);
const screen4 = await page.evaluate(() => window.__inkblade.screen);
const scroll2 = await page.evaluate(() => window.__inkblade.combat?.def.scroll);
check('next scroll starts', screen4 === 'combat' && scroll2 === 2, `screen=${screen4} scroll=${scroll2}`);
const roadMinions = await page.evaluate(() => window.__inkblade.combat.summons.filter((s) => s.minion).map((s) => s.hp));
check('road minions have +50% HP', roadMinions.length >= 2 && roadMinions.every((hp) => hp === 18), `minion hp=${JSON.stringify(roadMinions)}`);

// --- 7. Defeat path: 1 HP, stand still, let the boss land a hit. ---
await page.evaluate(() => {
  const c = window.__inkblade.combat;
  c.player.hp = 1;
  c.player.x = 150;
  c.player.y = 380;
});
await page.waitForTimeout(12000);
const screen5 = await page.evaluate(() => window.__inkblade.screen);
check('defeat screen reached', screen5 === 'defeat', `screen=${screen5}`);
const defeatLog = await page.evaluate(() => window.__inkblade.combat.battleLog.map((e) => e.text));
check('battle log records damage taken',
  defeatLog.some((t) => t.includes('You took')), defeatLog.join(' | '));
await clickButton(page, 402, 451); // RETRY
await page.waitForTimeout(2600);
const screen6 = await page.evaluate(() => window.__inkblade.screen);
check('retry restarts the fight', screen6 === 'combat', `screen=${screen6}`);

// --- 8. Back to menu; walk the dojo, codex, leaderboard, history. ---
await page.keyboard.press('p');
await page.waitForTimeout(300);
await clickButton(page, 512, 345); // ABANDON TO MENU
await page.waitForTimeout(300);
const backMenu = await page.evaluate(() => window.__inkblade.screen);
check('abandon returns to menu', backMenu === 'menu', `screen=${backMenu}`);
await clickButton(page, 202, 495); // DOJO
await page.waitForTimeout(300);
const screenDojo = await page.evaluate(() => window.__inkblade.screen);
check('dojo opens', screenDojo === 'dojo', `screen=${screenDojo}`);
// Draw fire in the dojo pad (DOJO_PAD 362,110 300x300).
{
  await drawKanjiAt(page, 'fire', 362, 110, 300, 300);
  await page.waitForTimeout(1400);
  const judged = await page.evaluate(() => window.__inkblade.dojo.feedback);
  check('dojo judges a drawn kanji', judged && judged.accuracy >= 0.55, JSON.stringify(judged));
}
await clickButton(page, 85, 539); // MENU
await clickButton(page, 574, 495); // CODEX
await page.waitForTimeout(300);
check('codex opens', (await page.evaluate(() => window.__inkblade.screen)) === 'codex');
await clickButton(page, 85, 539); // MENU
await clickButton(page, 822, 495); // LEADERBOARD
await page.waitForTimeout(300);
check('leaderboard opens', (await page.evaluate(() => window.__inkblade.screen)) === 'leaderboard');
await clickButton(page, 85, 539); // MENU
await clickButton(page, 946, 495); // HISTORY
await page.waitForTimeout(300);
check('history opens', (await page.evaluate(() => window.__inkblade.screen)) === 'history');

// --- 8b. Tutorial: the interactive lesson (fire, then wind = Firestorm). ---
await clickButton(page, 85, 539); // MENU
await clickButton(page, 326, 495); // TUTORIAL
await page.waitForTimeout(300);
check('tutorial opens', (await page.evaluate(() => window.__inkblade.screen)) === 'tutorial');
await drawKanjiAt(page, 'fire', 490, 176, 300, 300);
await page.waitForTimeout(1200);
const tutStep1 = await page.evaluate(() => window.__inkblade.tutorial.step);
check('tutorial lesson step 1: fire casts', tutStep1 === 1, `step=${tutStep1}`);
await drawKanjiAt(page, 'wind', 490, 176, 300, 300);
await page.waitForTimeout(1500);
const tutDone = await page.evaluate(() => ({
  completed: window.__inkblade.tutorial.completed,
  dummyHp: window.__inkblade.tutorial.dummyHp,
}));
check('tutorial lesson completes with a Firestorm', tutDone.completed === true && tutDone.dummyHp <= 0, JSON.stringify(tutDone));
await clickButton(page, 338, 103); // GUIDE tab
await page.waitForTimeout(200);
check('tutorial guide tab opens', (await page.evaluate(() => window.__inkblade.tutorial.page)) === 'guide');
await clickButton(page, 546, 103); // SPELLS & COMBOS tab
await page.waitForTimeout(200);
check('tutorial spells tab opens', (await page.evaluate(() => window.__inkblade.tutorial.page)) === 'spells');

// --- 8c. Combos guide and rank ladder. ---
await clickButton(page, 85, 539); // MENU
await clickButton(page, 450, 495); // COMBOS
await page.waitForTimeout(300);
check('combos screen opens', (await page.evaluate(() => window.__inkblade.screen)) === 'combos');
const comboShown = await page.evaluate(() => window.__inkblade.progress.combosDiscovered.includes('firestorm'));
check('combos screen shows the discovered Firestorm', comboShown === true);
await clickButton(page, 85, 539); // MENU
await clickButton(page, 698, 495); // RANK
await page.waitForTimeout(300);
check('rank screen opens', (await page.evaluate(() => window.__inkblade.screen)) === 'rank');
const rankShown = await page.evaluate(() => window.__inkblade.progress.rankPoints);
check('rank screen shows earned points', rankShown > 0, `rankPoints=${rankShown}`);

// --- 9. localStorage persistence across reload. ---
const storedBefore = await page.evaluate(() => ({
  history: JSON.parse(localStorage.getItem('inkblade_history_v1') ?? '[]').length,
  codex: Object.keys(JSON.parse(localStorage.getItem('inkblade_codex_v1') ?? '{}')).length,
}));
check('history + codex persisted', storedBefore.history >= 2 && storedBefore.codex >= 1, JSON.stringify(storedBefore));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const storedAfter = await page.evaluate(() => ({
  history: JSON.parse(localStorage.getItem('inkblade_history_v1') ?? '[]').length,
  progress: JSON.parse(localStorage.getItem('inkblade_progress_v1') ?? '{}').unlockedScroll,
}));
check('records survive reload', storedAfter.history === storedBefore.history && storedAfter.progress >= 2, JSON.stringify(storedAfter));
const featsAfterReload = await page.evaluate(() => window.__inkblade.feats);
check('feats survive reload', featsAfterReload.includes('first-seal') && featsAfterReload.includes('first-fusion'), JSON.stringify(featsAfterReload));

// --- 9b. Difficulty select: Master makes the boss tougher, and the
// choice persists. (After the reload the run is fresh, so PLAY starts a
// new run on the selected difficulty.)
await clickButton(page, 441, 380); // Grand Master card
const diffMaster = await page.evaluate(() => window.__inkblade.progress.difficulty);
check('difficulty select picks Master', diffMaster === 'master', `difficulty=${diffMaster}`);
await clickButton(page, 782, 380); // PLAY
await page.waitForTimeout(2600);
const masterFight = await page.evaluate(() => ({
  maxHp: window.__inkblade.combat.boss.maxHp,
  diffId: window.__inkblade.combat.difficulty.id,
  dmgMul: window.__inkblade.combat.difficulty.bossDmgMul,
}));
check('master difficulty scales the boss', masterFight.maxHp === 312 && masterFight.diffId === 'master' && masterFight.dmgMul === 1.25, JSON.stringify(masterFight));
await page.keyboard.press('p');
await page.waitForTimeout(300);
await clickButton(page, 512, 345); // ABANDON TO MENU
await page.waitForTimeout(300);
await clickButton(page, 271, 380); // Calligrapher card (back to default)
const diffBack = await page.evaluate(() => window.__inkblade.progress.difficulty);
check('difficulty select returns to Calligrapher', diffBack === 'calligrapher', `difficulty=${diffBack}`);

// --- 10. No console errors, no page errors, no outside requests. ---
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
check('no network requests outside localhost', outsideRequests.length === 0, outsideRequests.slice(0, 3).join(' | '));

// --- 11. Screenshots (the entry's 4) at 1280x720 — the largest the
// submission allows — so the HD detail shows.
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(600);
const shots = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));
for (const shot of shots) {
  await page.goto(`${BASE}/${shot.query}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  if (shot.name === '4-victory.jpg') {
    const campaign = await page.evaluate(() => ({
      screen: window.__inkblade.screen,
      complete: window.__inkblade.lastResult?.campaignComplete,
      grades: window.__inkblade.run.scrollGrades.length,
      scores: window.__inkblade.run.scrollScores.length,
    }));
    check('campaign dashboard staged for shot 4', campaign.screen === 'victory' && campaign.complete === true && campaign.grades === 7 && campaign.scores === 7, JSON.stringify(campaign));
  }
  const path = join(ROOT, 'screenshots', shot.name);
  await page.screenshot({ path, type: 'jpeg', quality: 82 });
  const size = statSync(path).size;
  check(`screenshot ${shot.name} <= 256 KiB`, size <= 262144, `${size} bytes`);
}

await browser.close();
console.log(failures === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
