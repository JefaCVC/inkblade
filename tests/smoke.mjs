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
import { ARENA, BANNER, ELEMENT_BY_ID, PAD, WINLOSE_STRIP } from '../game/src/config.js';

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

// Draw one element's kanji with real mouse strokes, in any pad. Five
// interpolated moves per segment at 5ms: fast enough that two kanji in a
// row fit inside the 4s fusion window, dense enough for the recogniser
// (it resamples each stroke to 16 points anyway).
async function drawKanjiAt(page, elementId, padX, padY, padW, padH) {
  const el = ELEMENT_BY_ID[elementId];
  for (const stroke of el.strokes) {
    const pts = stroke.map(([sx, sy]) => [padX + sx * padW, padY + sy * padH]);
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      for (let s = 1; s <= 5; s += 1) {
        await page.mouse.move(x0 + ((x1 - x0) * s) / 5, y0 + ((y1 - y0) * s) / 5);
        await page.waitForTimeout(5);
      }
    }
    await page.mouse.up();
    await page.waitForTimeout(120);
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
await clickButton(page, 512, 358); // PLAY button
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
await page.waitForTimeout(1100); // just past the 900ms auto-cast pause
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
await clickButton(page, 839, 541); // NEXT SCROLL
await page.waitForTimeout(2600);
const screen4 = await page.evaluate(() => window.__inkblade.screen);
const scroll2 = await page.evaluate(() => window.__inkblade.combat?.def.scroll);
check('next scroll starts', screen4 === 'combat' && scroll2 === 2, `screen=${screen4} scroll=${scroll2}`);

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
await clickButton(page, 579, 402); // DOJO
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
await clickButton(page, 255, 504); // CODEX
await page.waitForTimeout(300);
check('codex opens', (await page.evaluate(() => window.__inkblade.screen)) === 'codex');
await clickButton(page, 85, 539); // MENU
await clickButton(page, 579, 504); // LEADERBOARD
await page.waitForTimeout(300);
check('leaderboard opens', (await page.evaluate(() => window.__inkblade.screen)) === 'leaderboard');
await clickButton(page, 85, 539); // MENU
await clickButton(page, 741, 504); // HISTORY
await page.waitForTimeout(300);
check('history opens', (await page.evaluate(() => window.__inkblade.screen)) === 'history');

// --- 8b. Tutorial: the interactive lesson (fire, then wind = Firestorm). ---
await clickButton(page, 85, 539); // MENU
await clickButton(page, 445, 450); // TUTORIAL
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
await clickButton(page, 579, 450); // COMBOS
await page.waitForTimeout(300);
check('combos screen opens', (await page.evaluate(() => window.__inkblade.screen)) === 'combos');
const comboShown = await page.evaluate(() => window.__inkblade.progress.combosDiscovered.includes('firestorm'));
check('combos screen shows the discovered Firestorm', comboShown === true);
await clickButton(page, 85, 539); // MENU
await clickButton(page, 417, 504); // RANK
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
  const path = join(ROOT, 'screenshots', shot.name);
  await page.screenshot({ path, type: 'jpeg', quality: 82 });
  const size = statSync(path).size;
  check(`screenshot ${shot.name} <= 256 KiB`, size <= 262144, `${size} bytes`);
}

await browser.close();
console.log(failures === 0 ? `\nALL ${results.length} CHECKS PASSED` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
