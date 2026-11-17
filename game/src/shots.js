// INKBLADE screenshot scenes behind ?shot=start|play|play2|end. Each one
// sets up a real game state — a real fight, mid-cast — so the frame is what
// playing really looks like, not a mock-up. The staged strokes are the real
// fire and lightning templates, drawn into the pad at the pad's own scale.

import { ELEMENT_BY_ID, PAD } from './config.js';
import { RANKS } from './ranks.js';
import { createCombat } from './combat.js';
import { floatText, spellBurst } from './particles.js';

function scaledStrokes(elementId, count) {
  const el = ELEMENT_BY_ID[elementId];
  return el.strokes.slice(0, count).map((stroke) =>
    stroke.map(([sx, sy]) => [sx * PAD.w, sy * PAD.h]),
  );
}

function stageFight(g, scrollIndex, opts) {
  const combat = createCombat(scrollIndex, g.run);
  combat.phase = 'fight';
  combat.stats.startTime = 0;
  combat.time = opts.time;
  combat.boss.hp = Math.round(combat.boss.maxHp * opts.bossHp);
  combat.boss.attackTimer = 1.2;
  combat.player.hp = opts.playerHp;
  combat.ink = opts.ink;
  combat.combo.count = opts.combo;
  combat.combo.timer = 3;
  combat.selected = opts.element;
  combat.strokes = scaledStrokes(opts.element, opts.strokesDone);
  combat.currentStroke = scaledStrokes(opts.element, opts.strokesDone + 1)[opts.strokesDone].slice(0, 2);
  combat.lastStrokeAt = performance.now();
  const b = { x: combat.boss.x, y: combat.boss.y };
  const el = ELEMENT_BY_ID[opts.element];
  combat.spells.push({
    element: el, combo: null, kanji: el.kanji, color: el.color, glow: el.glow,
    x: combat.player.x + 16, y: combat.player.y - 10,
    tx: b.x, ty: b.y, t: 0.14, dur: 0.26, damage: 30, crit: false, eff: null,
  });
  // Stage the fusion window too, so the COMBO READY chip shows: the staged
  // cast is the second element of a real pair (wind+fire = Firestorm,
  // water+lightning = Storm Surge).
  combat.lastCast = { elementId: opts.lastCast, at: combat.time - 1.2 };
  spellBurst(combat.particles, b.x, b.y, opts.element, 1.2);
  // The float lives in the dedicated zone left of the boss, never under
  // the fusion banner, right-aligned so it never touches the boss.
  floatText(combat.particles, b.x - combat.boss.r - 12, b.y - 6, '-42', ELEMENT_BY_ID[opts.element].color, 26, 'right');
  // Three minion spirits, so the INCOMING panel reads x3 and the arena
  // shows the fight's full cast. Staged frozen with deep HP: the staged
  // casts (a Firestorm splash, a lightning chain) would otherwise wipe
  // them, and a drifting one can reach the player before the shutter.
  const minionSpots = [[300, 250], [280, 390], [240, 320]];
  for (const [mx, my] of minionSpots) {
    combat.summons.push({
      x: mx, y: my, vx: 0, vy: 0, r: 13, hp: 500, color: opts.summon, kind: 'minion',
      age: 0, minion: true, name: 'Minion', still: true,
    });
  }
  if (opts.projectile) {
    combat.projectiles.push({
      x: 340, y: 190, vx: -120, vy: 60, r: 10, color: opts.projectile, damage: 10, kind: 'orb', age: 0,
    });
  }
  if (opts.summon) {
    combat.summons.push({ x: 330, y: 380, vx: 0, vy: 0, r: 13, hp: 500, color: opts.summon, kind: 'ember', age: 0, still: true });
  }
  g.combat = combat;
  g.screen = 'combat';
}

export function stageShot(name, g) {
  if (name === 'play') {
    g.run = g.newRun();
    stageFight(g, 0, {
      time: 42, bossHp: 0.85, playerHp: 82, ink: 64, combo: 3,
      element: 'fire', strokesDone: 3, lastCast: 'wind', projectile: '#e8590c', summon: '#ff922b',
    });
    return;
  }
  if (name === 'play2') {
    g.run = g.newRun();
    g.run.scrollIndex = 1;
    // lastCast 'fire' does NOT fuse with lightning, so this shot stays in
    // combat (a Storm Surge one-shot the serpent in an earlier staging).
    stageFight(g, 1, {
      time: 68, bossHp: 0.85, playerHp: 71, ink: 58, combo: 5,
      element: 'lightning', strokesDone: 3, lastCast: 'fire', projectile: '#1971c2', summon: '#4dabf7',
    });
    return;
  }
  if (name === 'end') {
    g.run = g.newRun();
    g.run.score = 1240;
    g.run.essence = 96;
    g.lastResult = {
      scrollIndex: 0, seconds: 96, casts: 14, accuracy: 0.86, perfects: 5,
      maxCombo: 6, damage: 268, essence: 96, score: 1240, campaignComplete: false,
      rankPoints: 210, rankUp: RANKS[1], grade: 'A',
    };
    g.screen = 'victory';
    return;
  }
  g.screen = 'menu';
}
