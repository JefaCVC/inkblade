// INKBLADE combat: the fight screen. The painter moves with WASD/arrows in
// the arena while the boss attacks; the player draws kanji in the ink pad to
// cast elemental spells. Bosses have distinct attack patterns, phases and a
// weakness; spells interact with the elemental wheel, combos and ink.

import { ARENA, BANNER, BOSSES, CAST_PAUSE_MS, COMBO, COMBOS, DIFFICULTY_BY_ID, ELEMENTS, ELEMENT_BY_ID, INK, MINIONS, PAD, PERFECT_THRESHOLD, PLAYER, STRONG_AGAINST, WINLOSE_STRIP, comboPartner, combosFrom, effectiveness, findCombo } from './config.js';
import { drawBoss, drawBrushStroke, drawPlayer, drawSeal } from './sprites.js';
import { burst, floatText, makeParticles, ring, spellBurst, trail, updateParticles, drawParticles } from './particles.js';
import { recognise, isRealStroke } from './strokes.js';
import { playBossRoar, playBrushSwish, playCombo, playElementImpact, playFizzle, playHurt, playPerfect, playSealStamp, playVictory } from './audio.js';

const ELEMENT_BUTTONS = { x: PAD.x, y: 446, w: 66, h: 40, gap: 4, perRow: 4 };

function buttonRect(i) {
  const col = i % ELEMENT_BUTTONS.perRow;
  const row = Math.floor(i / ELEMENT_BUTTONS.perRow);
  return {
    x: ELEMENT_BUTTONS.x + col * (ELEMENT_BUTTONS.w + ELEMENT_BUTTONS.gap),
    y: ELEMENT_BUTTONS.y + row * (ELEMENT_BUTTONS.h + ELEMENT_BUTTONS.gap),
    w: ELEMENT_BUTTONS.w, h: ELEMENT_BUTTONS.h,
  };
}

export function createCombat(scrollIndex, run, hooks = {}) {
  const def = BOSSES[scrollIndex];
  const diff = DIFFICULTY_BY_ID[run.difficulty] ?? DIFFICULTY_BY_ID.calligrapher;
  // Difficulty scales the boss; the chosen road may scale it further (the
  // River Path starts the boss wounded) or shrink the ink well.
  const bossHp = Math.round(def.hp * diff.bossHpMul * (run.roadBossHpMul ?? 1));
  const maxInk = Math.max(20, run.maxInk - (run.roadInkPenalty ?? 0));
  const c = {
    def, scrollIndex, run, hooks, difficulty: diff,
    phase: 'intro', phaseTimer: 0,
    time: 0,
    boss: {
      hp: bossHp, maxHp: bossHp, x: 450, y: 305, r: 100,
      attackTimer: 1.6, pattern: 0, frozenUntil: 0, burnUntil: 0, burnTick: 0, burnDmg: 3,
      knockX: 0, diving: null, enraged: false,
    },
    minionTimer: 10, minionsSpawned: 0, minionHpMul: run.roadMinionHpMul ?? 1,
    player: { x: PLAYER.startX, y: PLAYER.startY, hp: run.maxHp, maxHp: run.maxHp, shield: run.startShielded, invuln: 0 },
    ink: maxInk, maxInk, refill: run.refill,
    combo: { count: 0, timer: 0 },
    selected: 'fire',
    lastCast: null, comboBanner: null, pendingHits: [],
    rankPoints: 0,
    strokes: [], currentStroke: null, lastStrokeAt: 0, drawing: false,
    projectiles: [], summons: [], spells: [], telegraphs: [], pools: [],
    particles: makeParticles(),
    stats: { casts: 0, combos: 0, hits: 0, perfects: 0, damage: 0, damageTaken: 0, maxCombo: 0, accuracySum: 0, startTime: 0 },
    castFeedback: null,
    essenceEarned: 0,
    won: false,
  };
  return c;
}

function bossPos(c) {
  return { x: c.boss.x + c.boss.knockX, y: c.boss.y };
}

// The dedicated float-text zone: left of the boss, clear of the fusion
// banner (which hangs at the top of the arena, y 122..194). Damage
// numbers, WEAK!/RESISTED, ENRAGED! and SHATTER! all live here, so they
// can never overlap the banner no matter when they fire.
function floatZone(c, dy) {
  const b = bossPos(c);
  return { x: b.x - c.boss.r - 12, y: b.y + dy };
}

function spawnMinion(c) {
  const spec = MINIONS[c.def.element];
  const b = bossPos(c);
  const a = Math.random() * Math.PI * 2;
  const s = {
    x: b.x + Math.cos(a) * (c.boss.r + 30), y: b.y + Math.sin(a) * (c.boss.r + 30),
    vx: 0, vy: 0, r: 13, hp: Math.round(12 * c.minionHpMul), color: spec.color, kind: 'minion', age: 0,
    minion: true, name: spec.name,
  };
  s.x = Math.max(ARENA.x + 20, Math.min(ARENA.x + ARENA.w - 20, s.x));
  s.y = Math.max(ARENA.y + 20, Math.min(ARENA.y + ARENA.h - 20, s.y));
  c.summons.push(s);
  c.minionsSpawned += 1;
}

function minionCount(c) {
  return c.summons.filter((s) => s.minion).length;
}

// Fight grade, live on the HUD and final on the victory screen: accuracy
// carries the most weight, then damage taken, then speed.
export function fightGrade(c) {
  const acc = c.stats.casts > 0 ? c.stats.accuracySum / c.stats.casts : 1;
  const elapsed = Math.max(1, c.time - c.stats.startTime);
  const taken = c.stats.damageTaken;
  if (acc >= 0.9 && taken <= 10 && elapsed <= 120) return 'S';
  if (acc >= 0.8 && taken <= 30) return 'A';
  if (acc >= 0.65) return 'B';
  return 'C';
}

export const GRADE_COLORS = { S: '#ffd43b', A: '#69db7c', B: '#74c0fc', C: '#ced4da' };

function bossAttackInterval(c) {
  const base = 2.4 - c.scrollIndex * 0.16;
  return c.boss.enraged ? base * 0.65 : base;
}

function spawnProjectile(c, x, y, vx, vy, r, color, damage, kind = 'orb') {
  c.projectiles.push({ x, y, vx, vy, r, color, damage, kind, age: 0 });
}

function spawnSummon(c, x, y, kind, color, hp = 12) {
  c.summons.push({ x, y, vx: 0, vy: 0, r: 13, hp, color, kind, age: 0 });
}

function bossAttack(c) {
  const def = c.def;
  const kind = def.attacks[c.boss.pattern % def.attacks.length];
  c.boss.pattern += 1;
  const b = bossPos(c);
  const p = c.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const dist = Math.hypot(dx, dy) || 1;
  const frozen = c.time < c.boss.frozenUntil;
  const speedMul = frozen ? 0.5 : 1;
  // The boss's mouth: projectiles and summons leave from the body's front
  // edge, so they never spawn inside the (now much bigger) sprite.
  const mouth = b.x - c.boss.r * 0.7;
  switch (kind) {
    case 'fireball':
      spawnProjectile(c, mouth, b.y, (dx / dist) * 210 * speedMul, (dy / dist) * 210 * speedMul, 10, '#e8590c', 10, 'fire');
      break;
    case 'ember':
      spawnSummon(c, mouth, b.y + 30, 'ember', '#ff922b');
      spawnSummon(c, mouth + 20, b.y - 40, 'ember', '#ff922b');
      break;
    case 'jet':
      spawnProjectile(c, mouth, b.y, (dx / dist) * 310 * speedMul, (dy / dist) * 310 * speedMul, 8, '#1971c2', 9, 'jet');
      break;
    case 'wave':
      spawnSummon(c, mouth, b.y, 'wave', '#4dabf7', 16);
      break;
    case 'blade': {
      for (let i = -1; i <= 1; i += 1) {
        const a = Math.atan2(dy, dx) + i * 0.3;
        spawnProjectile(c, mouth, b.y, Math.cos(a) * 240 * speedMul, Math.sin(a) * 240 * speedMul, 8, '#2b8a3e', 9, 'blade');
      }
      break;
    }
    case 'dive':
      c.boss.diving = { tx: p.x, ty: p.y, back: false, t: 0 };
      break;
    case 'bolt':
      spawnProjectile(c, mouth, b.y - 10, (dx / dist) * 390 * speedMul, (dy / dist) * 390 * speedMul, 7, '#e67700', 12, 'bolt');
      break;
    case 'orb':
      spawnProjectile(c, mouth, b.y, (dx / dist) * 120 * speedMul, (dy / dist) * 120 * speedMul, 13, '#7048e8', 14, 'orb');
      break;
    case 'rock':
      spawnProjectile(c, mouth + 10, b.y - 20, (dx / dist) * 200 * speedMul, -160, 11, '#8d5a2b', 12, 'rock');
      break;
    case 'spikes':
      c.telegraphs.push({ kind: 'spikes', x: p.x, y: p.y, r: 52, timer: 0.8, damage: 15 });
      break;
    case 'beam':
      c.telegraphs.push({ kind: 'beam', y: p.y, timer: 0.9, damage: 18, fired: false, fireTimer: 0 });
      break;
    case 'feather': {
      for (let i = 0; i < 5; i += 1) {
        const a = Math.atan2(dy, dx) + (i - 2) * 0.22;
        spawnProjectile(c, mouth, b.y, Math.cos(a) * 220 * speedMul, Math.sin(a) * 220 * speedMul, 6, '#ffd43b', 7, 'feather');
      }
      break;
    }
    case 'pool':
      c.pools.push({ x: p.x, y: p.y, r: 46, timer: 4, tick: 0 });
      break;
    case 'summon':
      spawnSummon(c, mouth + 10, b.y + 40, 'wisp', '#b197fc', 14);
      spawnSummon(c, mouth + 10, b.y - 40, 'wisp', '#b197fc', 14);
      break;
    default:
      break;
  }
}

function damagePlayer(c, rawAmount) {
  if (c.player.invuln > 0 || c.phase !== 'fight') return;
  if (c.player.shield) {
    c.player.shield = false;
    c.player.invuln = 0.6;
    floatText(c.particles, c.player.x, c.player.y - 34, 'SHIELD!', '#d0a06a', 20);
    ring(c.particles, c.player.x, c.player.y, '#d0a06a', 60);
    return;
  }
  // Difficulty scales every boss hit.
  const amount = Math.max(1, Math.round(rawAmount * c.difficulty.bossDmgMul));
  c.player.hp = Math.max(0, c.player.hp - amount);
  c.player.invuln = 0.8;
  c.stats.damageTaken += amount;
  c.combo.count = 0;
  c.combo.timer = 0;
  playHurt();
  burst(c.particles, c.player.x, c.player.y, '#c1271b', 12, 140, 4, 0.5);
  if (c.player.hp <= 0) {
    c.phase = 'lost';
    c.phaseTimer = 0;
  }
}

// The shared win sequence: every way a boss can die — a spell, a burn
// tick, a Tempest strike — pays the same essence reward.
function winFight(c) {
  const b = bossPos(c);
  c.phase = 'won';
  c.phaseTimer = 0;
  c.won = true;
  const acc = c.stats.casts > 0 ? c.stats.accuracySum / c.stats.casts : 0;
  c.essenceEarned = 40 + c.scrollIndex * 15 + Math.round(acc * 30) + c.stats.maxCombo * 2;
  playSealStamp();
  playVictory();
  burst(c.particles, b.x, b.y, '#c1271b', 40, 260, 6, 1);
  ring(c.particles, b.x, b.y, '#c1271b', 140);
}

function damageBoss(c, amount, elementId, opts = {}) {
  const boss = c.boss;
  const eff = opts.eff ?? effectiveness(elementId, c.def.element);
  let dmg = amount * eff * (opts.crit ? 1.5 : 1);
  dmg = Math.round(dmg);
  boss.hp = Math.max(0, boss.hp - dmg);
  c.stats.damage += dmg;
  c.stats.hits += 1;
  const b = bossPos(c);
  const el = ELEMENT_BY_ID[elementId];
  spellBurst(c.particles, b.x, b.y, elementId, 1);
  const dmgAt = floatZone(c, -6);
  floatText(c.particles, dmgAt.x, dmgAt.y, `-${dmg}`, el.color, opts.crit ? 30 : 24, 'right');
  const effAt = floatZone(c, -34);
  if (eff >= 2) floatText(c.particles, effAt.x, effAt.y, 'WEAK! x2', '#c1271b', 22, 'right');
  else if (eff <= 0.5) floatText(c.particles, effAt.x, effAt.y, 'RESISTED', '#868e96', 18, 'right');
  // Splash: summons near the boss take half; lightning chains at full power,
  // and so does Storm Surge.
  const splash = elementId === 'lightning' || opts.fullSplash ? dmg : Math.round(dmg * 0.5);
  for (const s of c.summons) {
    if (Math.hypot(s.x - b.x, s.y - b.y) < 190 || elementId === 'lightning' || opts.fullSplash) {
      s.hp -= splash;
      burst(c.particles, s.x, s.y, el.glow, 8, 120, 4, 0.4);
    }
  }
  c.summons = c.summons.filter((s) => s.hp > 0);
  if (boss.hp <= 0 && c.phase === 'fight') winFight(c);
}

// A fusion combo: two elements cast in sequence inside the fusion window
// become one combined spell — bigger damage, its own name and visual, and a
// higher ink cost. The combo consumes the chain (lastCast clears).
function castCombo(c, combo, secondElement, accuracy, perfect) {
  c.ink -= combo.cost;
  c.stats.casts += 1;
  c.stats.combos += 1;
  c.stats.accuracySum += accuracy;
  if (perfect) {
    c.stats.perfects += 1;
    c.ink = Math.min(c.maxInk, c.ink + INK.perfectBonus);
    playPerfect();
  }
  if (c.combo.timer > 0) c.combo.count += 1;
  else c.combo.count = 1;
  c.combo.timer = c.run.comboWindow;
  c.stats.maxCombo = Math.max(c.stats.maxCombo, c.combo.count);
  const comboMult = Math.min(COMBO.maxMultiplier, 1 + COMBO.stepDamage * (c.combo.count - 1));
  const base = combo.damage * (1 + c.run.damage) * comboMult;
  const eff = Math.max(
    effectiveness(combo.first, c.def.element),
    effectiveness(combo.second, c.def.element),
  );
  const b = bossPos(c);
  c.spells.push({
    element: secondElement, combo, kanji: combo.kanji, color: combo.color, glow: combo.glow,
    x: c.player.x + 16, y: c.player.y - 10, tx: b.x, ty: b.y,
    t: 0, dur: 0.32, damage: base, crit: perfect, eff,
  });
  playCombo();
  playElementImpact(secondElement.id);
  const accPct = Math.round(accuracy * 100);
  const firstEl = ELEMENT_BY_ID[combo.first];
  const secondEl = ELEMENT_BY_ID[combo.second];
  c.castFeedback = {
    text: `${combo.kanji} ${combo.name.toUpperCase()} — ${accPct}%${perfect ? ' PERFECT!' : ''}`,
    color: combo.color, timer: 1.6, accuracy,
  };
  c.comboBanner = {
    combo, sub: `${firstEl.kanji} ${firstEl.name} + ${secondEl.kanji} ${secondEl.name}`,
    timer: 1.8,
  };
  c.rankPoints += 25 + Math.round(accuracy * 10);
  c.lastCast = null;
  if (c.hooks.onComboDiscovered) c.hooks.onComboDiscovered(combo.id);
  return true;
}

export function castSpell(c, element, accuracy) {
  const el = element;
  const perfect = accuracy >= PERFECT_THRESHOLD;
  // Fusion first: a second element inside the window, with enough ink,
  // becomes a combo spell instead of the plain element.
  if (c.lastCast && (c.time - c.lastCast.at) <= c.run.fusionWindow) {
    const combo = findCombo(c.lastCast.elementId, el.id);
    if (combo && c.ink >= combo.cost) return castCombo(c, combo, el, accuracy, perfect);
  }
  if (c.ink < el.cost) {
    c.castFeedback = { text: 'NOT ENOUGH INK', color: '#c1271b', timer: 1.2, accuracy: 0 };
    playFizzle();
    return false;
  }
  c.ink -= el.cost;
  c.stats.casts += 1;
  c.stats.accuracySum += accuracy;
  if (perfect) {
    c.stats.perfects += 1;
    c.ink = Math.min(c.maxInk, c.ink + INK.perfectBonus);
    playPerfect();
  }
  // Combo: consecutive casts inside the window multiply damage.
  if (c.combo.timer > 0) c.combo.count += 1;
  else c.combo.count = 1;
  c.combo.timer = c.run.comboWindow;
  c.stats.maxCombo = Math.max(c.stats.maxCombo, c.combo.count);
  const comboMult = Math.min(COMBO.maxMultiplier, 1 + COMBO.stepDamage * (c.combo.count - 1));
  const base = el.damage * (1 + c.run.damage) * comboMult;
  const b = bossPos(c);
  c.spells.push({
    element: el, combo: null, kanji: el.kanji, color: el.color, glow: el.glow,
    x: c.player.x + 16, y: c.player.y - 10, tx: b.x, ty: b.y,
    t: 0, dur: el.id === 'light' ? 0.12 : 0.26, damage: base, crit: perfect, eff: null,
  });
  playElementImpact(el.id);
  const accPct = Math.round(accuracy * 100);
  c.castFeedback = {
    text: `${el.kanji} ${el.name.toUpperCase()} — ${accPct}%${perfect ? ' PERFECT!' : ''}`,
    color: el.color, timer: 1.4, accuracy,
  };
  if (el.id === 'earth') {
    c.player.shield = true;
    floatText(c.particles, c.player.x, c.player.y - 34, 'SHIELD UP', '#d0a06a', 20);
  }
  c.lastCast = { elementId: el.id, at: c.time };
  c.rankPoints += Math.round(accuracy * 10);
  return true;
}

function tryAutoCast(c) {
  if (c.strokes.length === 0 || c.phase !== 'fight') return;
  if (performance.now() - c.lastStrokeAt < CAST_PAUSE_MS) return;
  const result = recognise(c.strokes);
  c.strokes = [];
  if (result.element) {
    castSpell(c, result.element, result.accuracy);
  } else {
    c.ink = Math.max(0, c.ink - INK.fizzleCost);
    c.castFeedback = { text: 'UNCLEAR STROKE — TRY AGAIN', color: '#868e96', timer: 1.2, accuracy: result.accuracy };
    playFizzle();
  }
}

export function forceCast(c) {
  if (c.strokes.length === 0) return;
  c.lastStrokeAt = 0;
  tryAutoCast(c);
}

export function clearStrokes(c) {
  c.strokes = [];
  c.currentStroke = null;
}

export function updateCombat(c, dt, keys) {
  c.time += dt;
  if (c.phase === 'intro') {
    c.phaseTimer += dt;
    if (c.phaseTimer === dt) playBossRoar();
    if (c.phaseTimer > 1.9) {
      c.phase = 'fight';
      c.stats.startTime = c.time;
      c.boss.attackTimer = 1.4;
      // The boss opens with three minion spirits, so the arena is alive
      // from the first second of the fight.
      spawnMinion(c);
      spawnMinion(c);
      spawnMinion(c);
    }
    updateParticles(c.particles, dt);
    return;
  }
  if (c.phase === 'won' || c.phase === 'lost') {
    c.phaseTimer += dt;
    updateParticles(c.particles, dt);
    return;
  }
  // Ink refills steadily.
  c.ink = Math.min(c.maxInk, c.ink + c.refill * dt);
  // Minions trickle back in: at most 3 alive at once, one every 10s.
  c.minionTimer -= dt;
  if (c.minionTimer <= 0) {
    c.minionTimer = 10;
    if (minionCount(c) < 3) spawnMinion(c);
  }
  if (c.combo.timer > 0) {
    c.combo.timer -= dt;
    if (c.combo.timer <= 0) c.combo.count = 0;
  }
  if (c.player.invuln > 0) c.player.invuln -= dt;
  if (c.castFeedback) {
    c.castFeedback.timer -= dt;
    if (c.castFeedback.timer <= 0) c.castFeedback = null;
  }
  // Player movement.
  const p = c.player;
  let mx = 0, my = 0;
  if (keys.has('arrowleft') || keys.has('a')) mx -= 1;
  if (keys.has('arrowright') || keys.has('d')) mx += 1;
  if (keys.has('arrowup') || keys.has('w')) my -= 1;
  if (keys.has('arrowdown') || keys.has('s')) my += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    p.x = Math.max(ARENA.x + 18, Math.min(ARENA.x + ARENA.w - 18, p.x + (mx / len) * PLAYER.speed * dt));
    p.y = Math.max(ARENA.y + 18, Math.min(ARENA.y + ARENA.h - 18, p.y + (my / len) * PLAYER.speed * dt));
  }
  // Boss state.
  const boss = c.boss;
  if (!boss.enraged && boss.hp < boss.maxHp * 0.5) {
    boss.enraged = true;
    const enrAt = floatZone(c, 24);
    floatText(c.particles, enrAt.x, enrAt.y, 'ENRAGED!', '#c1271b', 26, 'right');
  }
  if (boss.knockX !== 0) boss.knockX *= Math.pow(0.02, dt);
  if (Math.abs(boss.knockX) < 1) boss.knockX = 0;
  if (c.time < boss.burnUntil) {
    boss.burnTick -= dt;
    if (boss.burnTick <= 0) {
      boss.burnTick = 0.5;
      boss.hp = Math.max(0, boss.hp - boss.burnDmg);
      c.stats.damage += boss.burnDmg;
      trail(c.particles, boss.x, boss.y - 20, '#ff922b', 5);
      if (boss.hp <= 0 && c.phase === 'fight') winFight(c);
    }
  }
  if (boss.diving) {
    const d = boss.diving;
    d.t += dt;
    const speed = 420;
    if (!d.back) {
      const dx = d.tx - boss.x;
      const dy = d.ty - boss.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 24 || d.t > 1.2) d.back = true;
      else {
        boss.x += (dx / dist) * speed * dt;
        boss.y += (dy / dist) * speed * dt;
      }
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < boss.r + 14) damagePlayer(c, 14);
    } else {
      const dx = 450 - boss.x;
      const dy = 305 - boss.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) boss.diving = null;
      else {
        boss.x += (dx / dist) * speed * dt;
        boss.y += (dy / dist) * speed * dt;
      }
    }
  }
  const frozen = c.time < boss.frozenUntil;
  if (!frozen && !boss.diving) {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      bossAttack(c);
      boss.attackTimer = bossAttackInterval(c);
    }
  }
  // Projectiles.
  for (const pr of c.projectiles) {
    pr.age += dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.kind === 'rock') pr.vy += 500 * dt;
    if (pr.kind === 'fire' || pr.kind === 'bolt') trail(c.particles, pr.x, pr.y, pr.color, 3);
    if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + PLAYER.radius - 4) {
      damagePlayer(c, pr.damage);
      pr.dead = true;
    }
    if (pr.x < -20 || pr.x > 1030 || pr.y < -20 || pr.y > 600 || pr.age > 6) pr.dead = true;
  }
  c.projectiles = c.projectiles.filter((pr) => !pr.dead);
  // Summons drift toward the player.
  for (const s of c.summons) {
    s.age += dt;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Staged summons (screenshots) can be frozen in place.
    const sp = s.still ? 0 : 55 + c.scrollIndex * 6;
    s.x += (dx / dist) * sp * dt + Math.sin(s.age * 5) * 12 * dt;
    s.y += (dy / dist) * sp * dt;
    if (Math.hypot(s.x - p.x, s.y - p.y) < s.r + PLAYER.radius - 2) {
      damagePlayer(c, 8);
      s.hp = 0;
    }
  }
  c.summons = c.summons.filter((s) => s.hp > 0);
  // Telegraphs resolve.
  for (const t of c.telegraphs) {
    t.timer -= dt;
    if (t.kind === 'spikes' && t.timer <= 0 && !t.fired) {
      t.fired = true;
      t.fireTimer = 0.4;
      burst(c.particles, t.x, t.y, '#8d5a2b', 18, 160, 5, 0.5);
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) damagePlayer(c, t.damage);
    }
    if (t.kind === 'beam' && t.timer <= 0 && !t.fired) {
      t.fired = true;
      t.fireTimer = 0.45;
      playElementImpact('light');
      if (Math.abs(p.y - t.y) < 22 && p.x > ARENA.x) damagePlayer(c, t.damage);
    }
    if (t.fired) t.fireTimer -= dt;
  }
  c.telegraphs = c.telegraphs.filter((t) => !t.fired || t.fireTimer > 0);
  // Ink pools tick damage.
  for (const pool of c.pools) {
    pool.timer -= dt;
    pool.tick -= dt;
    if (pool.tick <= 0) {
      pool.tick = 0.5;
      if (Math.hypot(p.x - pool.x, p.y - pool.y) < pool.r) damagePlayer(c, 6);
    }
  }
  c.pools = c.pools.filter((pool) => pool.timer > 0);
  // Spells in flight.
  for (const s of c.spells) {
    s.t += dt;
    const f = Math.min(1, s.t / s.dur);
    const x = s.x + (s.tx - s.x) * f;
    const y = s.y + (s.ty - s.y) * f;
    trail(c.particles, x, y, s.glow, 6);
    if (f >= 1) {
      s.done = true;
      const el = s.element;
      if (s.combo) {
        const combo = s.combo;
        if (combo.id === 'tempest') {
          // Tempest lands as six rapid strikes: one now, five queued.
          damageBoss(c, Math.round(s.damage / 6), el.id, { crit: s.crit, eff: s.eff });
          c.pendingHits.push({ elementId: 'wind', damage: Math.round(s.damage / 6), left: 5, timer: 0.15, eff: s.eff });
        } else {
          damageBoss(c, s.damage, el.id, { crit: s.crit, eff: s.eff, fullSplash: combo.id === 'stormsurge' });
        }
        // A fusion lands as both elements at once: two flavoured bursts.
        spellBurst(c.particles, s.tx, s.ty, combo.first, 1.2);
        spellBurst(c.particles, s.tx, s.ty, combo.second, 1.2);
        ring(c.particles, s.tx, s.ty, combo.color, 130);
        if (combo.id === 'firestorm') { c.boss.burnUntil = c.time + 6; c.boss.burnDmg = 5; }
        if (combo.id === 'magma') { c.boss.burnUntil = c.time + 5; c.boss.burnDmg = 4; }
        if (combo.id === 'deepfreeze') {
          c.boss.frozenUntil = c.time + 7;
          damageBoss(c, 30, 'ice', { crit: false, eff: 1 });
          const shAt = floatZone(c, 52);
          floatText(c.particles, shAt.x, shAt.y, 'SHATTER!', '#66d9e8', 24, 'right');
        }
        if (combo.id === 'eclipse') {
          ring(c.particles, s.tx, s.ty, '#ffe066', 180);
          burst(c.particles, s.tx, s.ty, '#ffe066', 30, 300, 6, 1);
        }
      } else {
        damageBoss(c, s.damage, el.id, { crit: s.crit });
        if (el.id === 'fire') { c.boss.burnUntil = c.time + 4; c.boss.burnDmg = 3; }
        if (el.id === 'water') { c.boss.knockX += 34; c.boss.attackTimer += 1; }
        if (el.id === 'ice') { c.boss.frozenUntil = c.time + 4; }
        if (el.id === 'dark') {
          const heal = Math.round(s.damage * 0.5);
          c.player.hp = Math.min(c.player.maxHp, c.player.hp + heal);
          floatText(c.particles, c.player.x, c.player.y - 34, `+${heal} HP`, '#b197fc', 20);
        }
        if (el.id === 'light') ring(c.particles, s.tx, s.ty, el.glow, 120);
      }
      c.ink = Math.min(c.maxInk, c.ink + INK.refillPerHit);
    }
  }
  c.spells = c.spells.filter((s) => !s.done);
  // Tempest's queued strikes land one at a time.
  for (const h of c.pendingHits) {
    h.timer -= dt;
    if (h.timer <= 0 && c.phase === 'fight') {
      h.timer = 0.15;
      h.left -= 1;
      const b2 = bossPos(c);
      damageBoss(c, h.damage, h.elementId, { crit: false, eff: h.eff });
      burst(c.particles, b2.x, b2.y, '#ffd43b', 8, 160, 4, 0.4);
    }
  }
  c.pendingHits = c.pendingHits.filter((h) => h.left > 0);
  if (c.comboBanner) {
    c.comboBanner.timer -= dt;
    if (c.comboBanner.timer <= 0) c.comboBanner = null;
  }
  tryAutoCast(c);
  updateParticles(c.particles, dt);
}

// --- Input: the ink pad and the element buttons. ---

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function combatMouseDown(c, x, y) {
  if (c.phase !== 'fight') return false;
  if (inRect(x, y, PAD)) {
    c.drawing = true;
    c.currentStroke = [[x - PAD.x, y - PAD.y]];
    playBrushSwish();
    return true;
  }
  for (let i = 0; i < ELEMENTS.length; i += 1) {
    if (inRect(x, y, buttonRect(i))) {
      c.selected = ELEMENTS[i].id;
      return true;
    }
  }
  // Cast / clear buttons under the pad.
  if (inRect(x, y, { x: PAD.x, y: PAD.y + PAD.h + 8, w: 140, h: 34 })) { forceCast(c); return true; }
  if (inRect(x, y, { x: PAD.x + 148, y: PAD.y + PAD.h + 8, w: 140, h: 34 })) { clearStrokes(c); return true; }
  return false;
}

export function combatMouseMove(c, x, y) {
  if (!c.drawing || !c.currentStroke) return;
  const px = x - PAD.x;
  const py = y - PAD.y;
  const last = c.currentStroke[c.currentStroke.length - 1];
  if (Math.hypot(px - last[0], py - last[1]) > 3) c.currentStroke.push([px, py]);
}

export function combatMouseUp(c) {
  if (!c.drawing) return;
  c.drawing = false;
  if (c.currentStroke && isRealStroke(c.currentStroke)) {
    c.strokes.push(c.currentStroke);
    c.lastStrokeAt = performance.now();
  }
  c.currentStroke = null;
}

export function combatKey(c, key) {
  const n = parseInt(key, 10);
  if (n >= 1 && n <= 8) c.selected = ELEMENTS[n - 1].id;
  if (key === ' ') forceCast(c);
  if (key === 'c' || key === 'C') clearStrokes(c);
}

// --- Drawing the fight. ---

function drawBar(ctx, x, y, w, h, frac, fill, back = 'rgba(43, 33, 24, 0.25)') {
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(h, w * Math.max(0, Math.min(1, frac))), h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.stroke();
}

// A compact elemental wheel: the eight kanji around a circle, arrows for the
// strong-against links, so the player always sees what beats what. Exported
// for the tutorial's guide page.
export function drawWheel(ctx, x, y, r) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgba(246, 239, 221, 0.85)';
  ctx.beginPath();
  ctx.arc(x, y, r + 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(176, 42, 30, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const ids = ELEMENTS.map((e) => e.id);
  const pos = {};
  ids.forEach((id, i) => {
    const a = -Math.PI / 2 + (i / ids.length) * Math.PI * 2;
    pos[id] = [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.35)';
  ctx.lineWidth = 1;
  for (const [from, tos] of Object.entries(STRONG_AGAINST)) {
    for (const to of tos) {
      const [x1, y1] = pos[from];
      const [x2, y2] = pos[to];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x, y, x2, y2);
      ctx.stroke();
      const a = Math.atan2(y2 - y, x2 - x);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - 0.4) * 7, y2 - Math.sin(a - 0.4) * 7);
      ctx.lineTo(x2 - Math.cos(a + 0.4) * 7, y2 - Math.sin(a + 0.4) * 7);
      ctx.closePath();
      ctx.fillStyle = 'rgba(43, 33, 24, 0.35)';
      ctx.fill();
    }
  }
  ctx.font = '700 15px "Noto Serif JP", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const id of ids) {
    const [kx, ky] = pos[id];
    ctx.fillStyle = ELEMENT_BY_ID[id].color;
    ctx.fillText(ELEMENT_BY_ID[id].kanji, kx, ky);
  }
  ctx.restore();
}

// --- The arena landscape: every scroll has its own full Japanese scene
// filling the whole combat area, so no blank paper is ever visible in a
// fight. Placement is seeded (deterministic, never flickers); motion comes
// from time-based drift of the ambient motes.

function seededRand(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 233280 + 9301) % 233280;
    return s / 233280;
  };
}

function arenaSky(ctx, top, mid, bottom) {
  const g = ctx.createLinearGradient(0, ARENA.y, 0, ARENA.y + ARENA.h);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
}

function arenaMountains(ctx, color, seed, baseY) {
  const rand = seededRand(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ARENA.x, baseY);
  let x = ARENA.x;
  while (x < ARENA.x + ARENA.w) {
    const w = 90 + rand() * 120;
    const h = 50 + rand() * 90;
    ctx.lineTo(x + w / 2, baseY - h);
    ctx.lineTo(x + w, baseY);
    x += w;
  }
  ctx.lineTo(ARENA.x + ARENA.w, ARENA.y + ARENA.h);
  ctx.lineTo(ARENA.x, ARENA.y + ARENA.h);
  ctx.closePath();
  ctx.fill();
}

function arenaGround(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(ARENA.x, ARENA.y + ARENA.h - 44, ARENA.w, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(ARENA.x, ARENA.y + ARENA.h - 44, ARENA.w, 2);
}

function motes(ctx, time, n, seed, color, size, rise, drift) {
  const rand = seededRand(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i += 1) {
    const bx = ARENA.x + rand() * ARENA.w;
    const by = ARENA.y + rand() * ARENA.h;
    const speed = 12 + rand() * 22;
    const span = ARENA.h + 40;
    const y = rise
      ? ARENA.y + ARENA.h + 20 - ((by + time * speed) % span)
      : ARENA.y - 20 + ((by + time * speed) % span);
    const x = bx + Math.sin(time * 0.7 + i * 1.7) * drift;
    ctx.globalAlpha = 0.35 + (i % 4) * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, size * (0.6 + (i % 3) * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function torii(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - w * 0.06, y, w * 0.12, h); // left pillar
  ctx.fillRect(x + w * 0.94 - w * 0.06, y, w * 0.12, h); // right pillar
  ctx.fillRect(x - w * 0.14, y - h * 0.14, w * 1.28, h * 0.12); // top lintel
  ctx.fillRect(x - w * 0.04, y + h * 0.16, w * 1.08, h * 0.09); // second lintel
  ctx.fillRect(x + w * 0.44, y - h * 0.26, w * 0.12, h * 0.14); // centre tablet
}

function pine(ctx, x, y, s, color, lean = 0) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 20 * s, y - 40 * s, x + lean * 30 * s, y - 70 * s);
  ctx.stroke();
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(x + lean * (18 + i * 10) * s, y - (48 + i * 18) * s, 30 * s - i * 5 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function stoneLantern(ctx, x, y, s, glowColor) {
  ctx.fillStyle = '#6b5a44';
  ctx.fillRect(x - 4 * s, y - 26 * s, 8 * s, 26 * s);
  ctx.fillRect(x - 9 * s, y - 34 * s, 18 * s, 5 * s);
  ctx.fillRect(x - 7 * s, y - 44 * s, 14 * s, 10 * s);
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x - 4 * s, y - 42 * s, 8 * s, 6 * s);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#4a3b2c';
  ctx.beginPath();
  ctx.moveTo(x - 11 * s, y - 44 * s);
  ctx.lineTo(x, y - 54 * s);
  ctx.lineTo(x + 11 * s, y - 44 * s);
  ctx.closePath();
  ctx.fill();
}

const ARENA_SCENES = {
  kagaribi(ctx, time) {
    // Burning temple at dusk: ember sky, a vermilion torii, scorched
    // pines, ash ground, embers rising everywhere.
    arenaSky(ctx, '#5c1a1a', '#c92a2a', '#ff922b');
    ctx.fillStyle = 'rgba(255, 212, 59, 0.5)';
    ctx.beginPath();
    ctx.arc(ARENA.x + ARENA.w - 90, ARENA.y + 70, 34, 0, Math.PI * 2);
    ctx.fill();
    arenaMountains(ctx, 'rgba(60, 20, 16, 0.55)', 11, ARENA.y + ARENA.h - 44);
    torii(ctx, ARENA.x + 70, ARENA.y + ARENA.h - 170, 150, 126, '#e03131');
    pine(ctx, ARENA.x + 300, ARENA.y + ARENA.h - 44, 0.9, '#2b0f0a');
    pine(ctx, ARENA.x + 620, ARENA.y + ARENA.h - 44, 1.1, '#2b0f0a');
    arenaGround(ctx, '#3b2a20');
    ctx.fillStyle = 'rgba(255, 146, 43, 0.35)';
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.ellipse(ARENA.x + 60 + i * 75, ARENA.y + ARENA.h - 24, 26, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    motes(ctx, time, 16, 21, '#ffd43b', 3, true, 10);
  },
  mizuchi(ctx, time) {
    // Storm sea: deep blue water, a drowned gate, rain and a pale moon.
    arenaSky(ctx, '#0b3d66', '#1864ab', '#1c5f8a');
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#e7f5ff';
    ctx.beginPath();
    ctx.arc(ARENA.x + ARENA.w - 80, ARENA.y + 64, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0a2c4a';
    ctx.fillRect(ARENA.x + 110, ARENA.y + 120, 18, 190);
    ctx.fillRect(ARENA.x + 210, ARENA.y + 120, 18, 190);
    ctx.fillRect(ARENA.x + 88, ARENA.y + 112, 164, 14);
    ctx.fillStyle = '#0d3b5c';
    for (let row = 0; row < 3; row += 1) {
      ctx.beginPath();
      for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 8) {
        const y = ARENA.y + ARENA.h - 90 + row * 28 + Math.sin((x + time * 30 + row * 40) * 0.03) * 6;
        if (x === ARENA.x) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(ARENA.x + ARENA.w, ARENA.y + ARENA.h);
      ctx.lineTo(ARENA.x, ARENA.y + ARENA.h);
      ctx.closePath();
      ctx.fill();
    }
    arenaGround(ctx, '#0a2c4a');
    ctx.strokeStyle = 'rgba(165, 216, 255, 0.4)';
    ctx.lineWidth = 1.5;
    const rand = seededRand(31);
    for (let i = 0; i < 26; i += 1) {
      const bx = ARENA.x + rand() * ARENA.w;
      const span = ARENA.h + 60;
      const y = ARENA.y - 30 + ((rand() * span + time * 260) % span);
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.lineTo(bx - 8, y + 22);
      ctx.stroke();
    }
  },
  arashi(ctx, time) {
    // Storm ridge: grey-green sky, pines bent by the gale, gust spirals,
    // leaves tearing past, a broken fence.
    arenaSky(ctx, '#3f4a3c', '#6b7a5e', '#a9b39a');
    arenaMountains(ctx, 'rgba(43, 52, 40, 0.6)', 41, ARENA.y + ARENA.h - 44);
    pine(ctx, ARENA.x + 90, ARENA.y + ARENA.h - 44, 1.2, '#2b3428', 1);
    pine(ctx, ARENA.x + 560, ARENA.y + ARENA.h - 44, 0.9, '#2b3428', 1);
    ctx.strokeStyle = 'rgba(246, 239, 221, 0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      const gx = ARENA.x + 150 + i * 180 + Math.sin(time * 1.2 + i) * 14;
      const gy = ARENA.y + 120 + i * 60;
      ctx.beginPath();
      ctx.arc(gx, gy, 26 + i * 8, 0.4, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.strokeStyle = '#4a3b2c';
    ctx.lineWidth = 5;
    for (let i = 0; i < 5; i += 1) {
      const fx = ARENA.x + 200 + i * 60;
      ctx.beginPath();
      ctx.moveTo(fx, ARENA.y + ARENA.h - 44);
      ctx.lineTo(fx + 8, ARENA.y + ARENA.h - 44 - 26 - (i % 2) * 10);
      ctx.stroke();
    }
    arenaGround(ctx, '#5c6650');
    const rand = seededRand(51);
    for (let i = 0; i < 14; i += 1) {
      const span = ARENA.w + 60;
      const x = ARENA.x - 30 + ((rand() * span + time * (60 + i * 8)) % span);
      const y = ARENA.y + 60 + rand() * (ARENA.h - 140) + Math.sin(time * 3 + i) * 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 4 + i) * 0.8);
      ctx.fillStyle = i % 2 ? '#69db7c' : '#8ce99a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  raiko(ctx, time) {
    // Iron peaks in a lightning storm: jagged dark mountains, a flashing
    // bolt, stone lanterns, driving rain.
    arenaSky(ctx, '#1a0b2e', '#3b2a63', '#5f3dc4');
    ctx.fillStyle = '#241a3d';
    ctx.beginPath();
    ctx.moveTo(ARENA.x, ARENA.y + ARENA.h - 44);
    const peaks = [150, 90, 190, 70, 160, 110];
    peaks.forEach((h, i) => {
      const x = ARENA.x + ((i + 0.5) / peaks.length) * ARENA.w;
      ctx.lineTo(x, ARENA.y + ARENA.h - 44 - h);
      ctx.lineTo(ARENA.x + ((i + 1) / peaks.length) * ARENA.w, ARENA.y + ARENA.h - 44);
    });
    ctx.lineTo(ARENA.x + ARENA.w, ARENA.y + ARENA.h);
    ctx.lineTo(ARENA.x, ARENA.y + ARENA.h);
    ctx.closePath();
    ctx.fill();
    // The flash: a bolt that strobes in from the clouds every few seconds.
    const flash = Math.sin(time * 0.9) > 0.82 ? 1 : 0.08;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ARENA.x + 180, ARENA.y + 6);
    ctx.lineTo(ARENA.x + 160, ARENA.y + 90);
    ctx.lineTo(ARENA.x + 190, ARENA.y + 100);
    ctx.lineTo(ARENA.x + 150, ARENA.y + 190);
    ctx.stroke();
    ctx.restore();
    stoneLantern(ctx, ARENA.x + 90, ARENA.y + ARENA.h - 44, 1, '#ffd43b');
    stoneLantern(ctx, ARENA.x + 610, ARENA.y + ARENA.h - 44, 0.9, '#ffd43b');
    arenaGround(ctx, '#33284d');
    ctx.strokeStyle = 'rgba(255, 224, 102, 0.25)';
    ctx.lineWidth = 1.5;
    const rand = seededRand(61);
    for (let i = 0; i < 20; i += 1) {
      const bx = ARENA.x + rand() * ARENA.w;
      const span = ARENA.h + 60;
      const y = ARENA.y - 30 + ((rand() * span + time * 300) % span);
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.lineTo(bx - 6, y + 20);
      ctx.stroke();
    }
  },
  iwao(ctx, time) {
    // The sleeping mountain: warm rock face, boulders, moss, lanterns and
    // a lone pine on a ledge, dust drifting down.
    arenaSky(ctx, '#e8d5b0', '#c9a06a', '#a9805a');
    ctx.fillStyle = '#7a5230';
    ctx.beginPath();
    ctx.moveTo(ARENA.x, ARENA.y + ARENA.h - 44);
    ctx.lineTo(ARENA.x + 140, ARENA.y + 60);
    ctx.lineTo(ARENA.x + 320, ARENA.y + 150);
    ctx.lineTo(ARENA.x + 480, ARENA.y + 40);
    ctx.lineTo(ARENA.x + ARENA.w, ARENA.y + 130);
    ctx.lineTo(ARENA.x + ARENA.w, ARENA.y + ARENA.h);
    ctx.lineTo(ARENA.x, ARENA.y + ARENA.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ARENA.x + 140, ARENA.y + 60);
    ctx.lineTo(ARENA.x + 200, ARENA.y + 180);
    ctx.lineTo(ARENA.x + 170, ARENA.y + 260);
    ctx.moveTo(ARENA.x + 480, ARENA.y + 40);
    ctx.lineTo(ARENA.x + 440, ARENA.y + 170);
    ctx.stroke();
    ctx.fillStyle = '#8d5a2b';
    ctx.beginPath();
    ctx.ellipse(ARENA.x + 120, ARENA.y + ARENA.h - 60, 60, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(ARENA.x + 560, ARENA.y + ARENA.h - 56, 74, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#69db7c';
    ctx.beginPath();
    ctx.ellipse(ARENA.x + 300, ARENA.y + 210, 34, 12, 0.2, 0, Math.PI * 2);
    ctx.ellipse(ARENA.x + 500, ARENA.y + 130, 26, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    pine(ctx, ARENA.x + 470, ARENA.y + 150, 0.7, '#2b5a34');
    stoneLantern(ctx, ARENA.x + 80, ARENA.y + ARENA.h - 44, 1, '#ffd43b');
    arenaGround(ctx, '#6b4a2b');
    motes(ctx, time, 12, 71, '#e8d5b0', 2.5, false, 6);
  },
  hikari(ctx, time) {
    // The white dawn: gold sky, a huge rising sun with turning rays,
    // drifting clouds, a white torii, feathers falling.
    arenaSky(ctx, '#fff3bf', '#ffd43b', '#ff922b');
    const sx = ARENA.x + ARENA.w - 120;
    const sy = ARENA.y + 110;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(time * 0.05);
    ctx.strokeStyle = 'rgba(255, 243, 191, 0.8)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 12; i += 1) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(44, 0);
      ctx.lineTo(70, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#fff9db';
    ctx.beginPath();
    ctx.arc(sx, sy, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 4; i += 1) {
      const cx = ARENA.x + 80 + i * 150 + Math.sin(time * 0.2 + i) * 10;
      const cy = ARENA.y + 60 + (i % 2) * 50;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 52, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 24, cy - 10, 34, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    torii(ctx, ARENA.x + 60, ARENA.y + ARENA.h - 160, 130, 116, '#f6efdd');
    arenaGround(ctx, '#e8c877');
    const rand = seededRand(81);
    for (let i = 0; i < 10; i += 1) {
      const span = ARENA.h + 40;
      const y = ARENA.y - 20 + ((rand() * span + time * 14) % span);
      const x = ARENA.x + rand() * ARENA.w + Math.sin(time * 0.9 + i) * 14;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time + i) * 0.7);
      ctx.fillStyle = 'rgba(255, 249, 219, 0.95)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  yami(ctx, time) {
    // The final scroll: ink-wash night, a pale moon, a dead tree, ink
    // pools on the ground and violet wisps drifting.
    arenaSky(ctx, '#0d0620', '#1c1140', '#2b1a4d');
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#e5dbff';
    ctx.beginPath();
    ctx.arc(ARENA.x + 90, ARENA.y + 70, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(ARENA.x + 90, ARENA.y + 70, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#120a24';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ARENA.x + ARENA.w - 90, ARENA.y + ARENA.h - 44);
    ctx.lineTo(ARENA.x + ARENA.w - 100, ARENA.y + 140);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ARENA.x + ARENA.w - 100, ARENA.y + 180);
    ctx.lineTo(ARENA.x + ARENA.w - 150, ARENA.y + 120);
    ctx.moveTo(ARENA.x + ARENA.w - 100, ARENA.y + 160);
    ctx.lineTo(ARENA.x + ARENA.w - 60, ARENA.y + 100);
    ctx.moveTo(ARENA.x + ARENA.w - 100, ARENA.y + 200);
    ctx.lineTo(ARENA.x + ARENA.w - 140, ARENA.y + 190);
    ctx.stroke();
    arenaGround(ctx, '#171029');
    ctx.fillStyle = '#0d0620';
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(ARENA.x + 90 + i * 160, ARENA.y + ARENA.h - 22, 52, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(177, 151, 252, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(ARENA.x + 90 + i * 160, ARENA.y + ARENA.h - 22, 52, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    motes(ctx, time, 12, 91, '#b197fc', 5, true, 16);
  },
};

function drawArenaBackground(ctx, c, time) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12);
  ctx.clip();
  const scene = ARENA_SCENES[c.def.id];
  if (scene) scene(ctx, time);
  ctx.restore();
  // The arena's ink border, redrawn over the scene.
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h, 12);
  ctx.stroke();
}

export function drawCombat(ctx, c, time) {
  const def = c.def;
  const el = ELEMENT_BY_ID[def.element];
  const weak = ELEMENT_BY_ID[def.weakness];
  // Top bar: boss plate.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.92)';
  ctx.beginPath();
  ctx.roundRect(20, 20, 984, 56, 10);
  ctx.fill();
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 20px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`Scroll ${def.scroll} — ${def.name}`, 34, 44);
  ctx.font = 'italic 12px Georgia, serif';
  ctx.fillStyle = '#d9c9a8';
  ctx.fillText(def.title, 34, 62);
  const bossFrac = c.boss.hp / c.boss.maxHp;
  drawBar(ctx, 330, 26, 420, 18, bossFrac, el.color, 'rgba(246, 239, 221, 0.2)');
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${c.boss.hp} / ${c.boss.maxHp}`, 540, 60);
  ctx.fillStyle = weak.color;
  ctx.beginPath();
  ctx.roundRect(764, 24, 110, 28, 8);
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '700 13px Georgia, serif';
  ctx.fillText(`Weak: ${weak.kanji} ${weak.name}`, 819, 43);
  ctx.fillStyle = '#ffe066';
  ctx.font = '700 15px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Score ${c.run.score}`, 990, 38);
  ctx.fillStyle = c.combo.count > 1 ? '#ff922b' : '#d9c9a8';
  ctx.font = '700 15px Georgia, serif';
  ctx.fillText(c.combo.count > 1 ? `COMBO x${c.combo.count}` : 'COMBO —', 990, 60);
  ctx.textAlign = 'left';
  // WIN/LOSE strip: the stakes of the fight, always visible at the top of
  // the combat screen, with the live fight grade in the middle.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.88)';
  ctx.beginPath();
  ctx.roundRect(WINLOSE_STRIP.x, WINLOSE_STRIP.y, WINLOSE_STRIP.w, WINLOSE_STRIP.h, 8);
  ctx.fill();
  ctx.font = '700 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#69db7c';
  ctx.fillText(`✓ WIN — seal ${def.name}`, WINLOSE_STRIP.x + 12, WINLOSE_STRIP.y + 17);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff8787';
  ctx.fillText('✗ LOSE — HP reaches 0', WINLOSE_STRIP.x + WINLOSE_STRIP.w - 12, WINLOSE_STRIP.y + 17);
  const liveGrade = fightGrade(c);
  ctx.fillStyle = GRADE_COLORS[liveGrade];
  ctx.beginPath();
  ctx.roundRect(WINLOSE_STRIP.x + WINLOSE_STRIP.w / 2 - 52, WINLOSE_STRIP.y + 3, 104, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`GRADE ${liveGrade}`, WINLOSE_STRIP.x + WINLOSE_STRIP.w / 2, WINLOSE_STRIP.y + 16);
  ctx.textAlign = 'left';
  // The arena: a full themed landscape per scroll (no blank paper here).
  drawArenaBackground(ctx, c, time);
  // Pools, telegraphs.
  for (const pool of c.pools) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#5f3dc4';
    ctx.beginPath();
    ctx.ellipse(pool.x, pool.y, pool.r, pool.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const t of c.telegraphs) {
    if (t.kind === 'spikes') {
      ctx.save();
      ctx.globalAlpha = t.fired ? 0.9 : 0.35 + Math.sin(time * 10) * 0.15;
      ctx.fillStyle = '#c1271b';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (t.fired) {
        ctx.fillStyle = '#8d5a2b';
        for (let i = 0; i < 5; i += 1) {
          const sx = t.x - 34 + i * 17;
          ctx.beginPath();
          ctx.moveTo(sx - 7, t.y + 8);
          ctx.lineTo(sx, t.y - 26);
          ctx.lineTo(sx + 7, t.y + 8);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (t.kind === 'beam') {
      ctx.save();
      ctx.globalAlpha = t.fired ? 0.85 : 0.3 + Math.sin(time * 10) * 0.12;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(ARENA.x, t.y - 12, ARENA.w, 24);
      ctx.restore();
    }
  }
  // Boss and player. A soft light disc lifts the boss off the landscape
  // (Mizuchi's blue was washing into the sea), then a saturated elemental
  // aura glows behind the big centre-frame sprite.
  const b = bossPos(c);
  const spot = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, c.boss.r * 1.7);
  spot.addColorStop(0, 'rgba(255, 248, 230, 0.34)');
  spot.addColorStop(1, 'rgba(255, 248, 230, 0)');
  ctx.fillStyle = spot;
  ctx.beginPath();
  ctx.arc(b.x, b.y, c.boss.r * 1.7, 0, Math.PI * 2);
  ctx.fill();
  const aura = ctx.createRadialGradient(b.x, b.y, c.boss.r * 0.4, b.x, b.y, c.boss.r * 1.9);
  aura.addColorStop(0, `${el.glow}55`);
  aura.addColorStop(1, `${el.glow}00`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(b.x, b.y, c.boss.r * 1.9, 0, Math.PI * 2);
  ctx.fill();
  drawBoss(ctx, def, b.x, b.y, c.boss.r, time, {
    enraged: c.boss.enraged,
    frozen: c.time < c.boss.frozenUntil,
    burning: c.time < c.boss.burnUntil,
  });
  if (c.player.invuln > 0 && Math.floor(time * 12) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    drawPlayer(ctx, c.player.x, c.player.y, time, c.player.shield);
    ctx.restore();
  } else {
    drawPlayer(ctx, c.player.x, c.player.y, time, c.player.shield);
  }
  // Summons. Minion spirits glow in their element colour and wear a
  // darker cap, so they read as enemies at a glance.
  for (const s of c.summons) {
    ctx.save();
    if (s.minion) {
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (s.minion) {
      ctx.fillStyle = 'rgba(26, 21, 18, 0.55)';
      ctx.beginPath();
      ctx.arc(s.x, s.y - s.r * 0.45, s.r * 0.62, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = '#1a1512';
    ctx.beginPath();
    ctx.arc(s.x - 4, s.y - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(s.x + 4, s.y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Projectiles.
  for (const pr of c.projectiles) {
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(pr.x - pr.r * 0.3, pr.y - pr.r * 0.3, pr.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // Spell flights.
  for (const s of c.spells) {
    const f = Math.min(1, s.t / s.dur);
    const x = s.x + (s.tx - s.x) * f;
    const y = s.y + (s.ty - s.y) * f;
    const orbR = (s.combo ? 18 : 12) - f * 4;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = s.glow;
    ctx.beginPath();
    ctx.arc(x, y, orbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `700 ${(s.combo ? 34 : 26) - f * 6}px "Noto Serif JP", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.color;
    ctx.fillText(s.kanji, x, y);
    ctx.restore();
  }
  drawParticles(ctx, c.particles);
  // Combo banner: the fused spell's name, big, when one triggers. It hangs
  // at the top of the arena (y 122..194), clear of the boss's head, and
  // float texts live in their own zone left of the boss, never under it.
  if (c.comboBanner && c.comboBanner.timer > 0) {
    const ban = c.comboBanner;
    const age = 1.8 - ban.timer;
    const scale = age < 0.25 ? 0.7 + (age / 0.25) * 0.3 : 1;
    const alpha = ban.timer < 0.5 ? ban.timer / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ARENA.x + ARENA.w / 2, BANNER.cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(26, 21, 18, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-BANNER.w / 2, -BANNER.h / 2, BANNER.w, BANNER.h, 14);
    ctx.fill();
    ctx.strokeStyle = ban.combo.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = ban.combo.glow;
    ctx.font = '700 48px "Noto Serif JP", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ban.combo.kanji, -150, 2);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '700 26px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(ban.combo.name.toUpperCase(), -105, -10);
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillStyle = '#d9c9a8';
    ctx.fillText(ban.sub, -105, 12);
    ctx.fillStyle = '#ffd43b';
    ctx.font = '700 12px Georgia, serif';
    ctx.fillText('FUSION COMBO!', -105, 30);
    ctx.restore();
  }
  // Element wheel, bottom-left of the arena.
  drawWheel(ctx, ARENA.x + 62, ARENA.y + ARENA.h - 62, 34);
  // INCOMING panel: who is in this fight — the boss and its minions.
  {
    const px = ARENA.x + 8, py = ARENA.y + ARENA.h - 200, pw = 184, ph = 68;
    const minions = minionCount(c);
    const spec = MINIONS[def.element];
    ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.font = '700 11px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('INCOMING', px + 10, py + 16);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '700 13px Georgia, serif';
    ctx.fillText(`● ${def.name}`, px + 10, py + 36);
    ctx.fillStyle = '#d9c9a8';
    ctx.font = '11px Georgia, serif';
    ctx.fillText('BOSS', px + pw - 44, py + 36);
    ctx.fillStyle = spec.color;
    ctx.font = '700 13px Georgia, serif';
    ctx.fillText(`● ${spec.name}`, px + 10, py + 56);
    ctx.fillStyle = '#d9c9a8';
    ctx.font = '11px Georgia, serif';
    ctx.fillText(`x${minions}`, px + pw - 30, py + 56);
  }
  // Player HP + ink, bottom-left bar.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
  ctx.beginPath();
  ctx.roundRect(ARENA.x + 130, ARENA.y + ARENA.h - 52, 260, 42, 8);
  ctx.fill();
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 11px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('HP', ARENA.x + 140, ARENA.y + ARENA.h - 32);
  drawBar(ctx, ARENA.x + 168, ARENA.y + ARENA.h - 44, 200, 11, c.player.hp / c.player.maxHp, '#c1271b');
  ctx.fillStyle = '#f6efdd';
  ctx.fillText('INK', ARENA.x + 140, ARENA.y + ARENA.h - 16);
  drawBar(ctx, ARENA.x + 168, ARENA.y + ARENA.h - 28, 200, 11, c.ink / c.maxInk, '#1971c2');
  ctx.fillStyle = '#f6efdd';
  ctx.font = '700 11px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(c.player.hp)}`, ARENA.x + 382, ARENA.y + ARENA.h - 32);
  ctx.fillText(`${Math.floor(c.ink)}`, ARENA.x + 382, ARENA.y + ARENA.h - 16);
  ctx.textAlign = 'left';
  // COMBO READY: the last cast can still fuse — show what it pairs with.
  if (c.phase === 'fight' && c.lastCast) {
    const left = c.run.fusionWindow - (c.time - c.lastCast.at);
    if (left > 0) {
      const options = combosFrom(c.lastCast.elementId);
      if (options.length > 0) {
        const cx = ARENA.x + 400, cy = ARENA.y + ARENA.h - 52, cw = 260, ch = 42;
        ctx.fillStyle = 'rgba(43, 33, 24, 0.88)';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, 8);
        ctx.fill();
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#ffd43b';
        ctx.font = '700 12px Georgia, serif';
        ctx.textAlign = 'left';
        ctx.fillText(`COMBO READY! ${left.toFixed(1)}s`, cx + 10, cy + 15);
        ctx.fillStyle = '#f6efdd';
        ctx.font = '12px Georgia, serif';
        const parts = options.map((o) => {
          const partner = ELEMENT_BY_ID[comboPartner(o, c.lastCast.elementId)];
          return `${partner.kanji} ${o.name}`;
        });
        ctx.fillText(parts.join('  ·  '), cx + 10, cy + 32);
        ctx.fillStyle = 'rgba(246, 239, 221, 0.25)';
        ctx.fillRect(cx + 10, cy + ch - 6, cw - 20, 3);
        ctx.fillStyle = '#ffd43b';
        ctx.fillRect(cx + 10, cy + ch - 6, (cw - 20) * (left / c.run.fusionWindow), 3);
      }
    }
  }
  // Ink pad panel.
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.roundRect(PAD.x - 6, PAD.y - 28, PAD.w + 12, PAD.h + 194, 12);
  ctx.fill();
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#2b2118';
  ctx.font = '700 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('INK PAD — draw the kanji', PAD.x + PAD.w / 2, PAD.y - 12);
  ctx.fillStyle = '#fffdf5';
  ctx.beginPath();
  ctx.roundRect(PAD.x, PAD.y, PAD.w, PAD.h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Ghost guide: the selected element's strokes, faint, numbered.
  const ghost = ELEMENT_BY_ID[c.selected];
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = ghost.color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ghost.strokes.forEach((stroke, i) => {
    ctx.beginPath();
    stroke.forEach(([sx, sy], j) => {
      const px = PAD.x + sx * PAD.w;
      const py = PAD.y + sy * PAD.h;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    const [fx, fy] = stroke[0];
    ctx.fillStyle = ghost.color;
    ctx.font = '700 13px Georgia, serif';
    ctx.fillText(String(i + 1), PAD.x + fx * PAD.w - 8, PAD.y + fy * PAD.h - 6);
  });
  ctx.restore();
  // Drawn strokes: thick ink with the selected element's glow, so the
  // drawing reads as the heart of the fight, not a side panel.
  for (const stroke of c.strokes) {
    drawBrushStroke(ctx, stroke.map(([sx, sy]) => [PAD.x + sx, PAD.y + sy]), null, 12, ghost.glow);
  }
  if (c.currentStroke) {
    drawBrushStroke(ctx, c.currentStroke.map(([sx, sy]) => [PAD.x + sx, PAD.y + sy]), null, 12, ghost.glow);
  }
  // Cast feedback, inside the pad's bottom edge.
  if (c.castFeedback) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.castFeedback.timer);
    ctx.font = '700 14px Georgia, serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(c.castFeedback.text).width;
    ctx.fillStyle = 'rgba(253, 246, 227, 0.9)';
    ctx.beginPath();
    ctx.roundRect(PAD.x + PAD.w / 2 - tw / 2 - 10, PAD.y + PAD.h - 30, tw + 20, 24, 6);
    ctx.fill();
    ctx.fillStyle = c.castFeedback.color;
    ctx.fillText(c.castFeedback.text, PAD.x + PAD.w / 2, PAD.y + PAD.h - 13);
    ctx.restore();
  }
  // Cast / clear buttons.
  const castBtn = { x: PAD.x, y: PAD.y + PAD.h + 8, w: 140, h: 34 };
  const clearBtn = { x: PAD.x + 148, y: PAD.y + PAD.h + 8, w: 140, h: 34 };
  ctx.fillStyle = '#b02a1e';
  ctx.beginPath();
  ctx.roundRect(castBtn.x, castBtn.y, castBtn.w, castBtn.h, 8);
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.font = '700 14px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAST  (Space)', castBtn.x + castBtn.w / 2, castBtn.y + 22);
  ctx.fillStyle = 'rgba(43, 33, 24, 0.75)';
  ctx.beginPath();
  ctx.roundRect(clearBtn.x, clearBtn.y, clearBtn.w, clearBtn.h, 8);
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.fillText('CLEAR  (C)', clearBtn.x + clearBtn.w / 2, clearBtn.y + 22);
  // Element buttons.
  ELEMENTS.forEach((e, i) => {
    const r = buttonRect(i);
    const selected = c.selected === e.id;
    const completesCombo = c.phase === 'fight' && c.lastCast
      && (c.time - c.lastCast.at) <= c.run.fusionWindow
      && findCombo(c.lastCast.elementId, e.id) !== null;
    ctx.fillStyle = selected ? e.color : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = completesCombo ? '#ffd43b' : e.color;
    ctx.lineWidth = completesCombo ? 3 + Math.sin(time * 10) : (selected ? 3 : 1.5);
    ctx.stroke();
    ctx.fillStyle = selected ? '#fdf6e3' : e.color;
    ctx.font = '700 19px "Noto Serif JP", serif';
    ctx.fillText(e.kanji, r.x + r.w / 2, r.y + 22);
    ctx.font = '700 9px Georgia, serif';
    ctx.fillStyle = selected ? '#fdf6e3' : '#2b2118';
    ctx.fillText(`${e.name} · ${e.cost}`, r.x + r.w / 2, r.y + 34);
    if (completesCombo) {
      ctx.fillStyle = '#ffd43b';
      ctx.font = '700 13px Georgia, serif';
      ctx.fillText('★', r.x + r.w - 10, r.y + 13);
    }
  });
  // Difficulty chip: the active difficulty, always visible in the fight.
  // Text is centred slightly left and kept short: the SOUND button sits
  // over the chip's right end (x >= 944).
  ctx.fillStyle = 'rgba(43, 33, 24, 0.85)';
  ctx.beginPath();
  ctx.roundRect(PAD.x, PAD.y + PAD.h + 138, PAD.w, 22, 8);
  ctx.fill();
  ctx.fillStyle = c.difficulty.color;
  ctx.font = '700 12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${c.difficulty.kanji} ${c.difficulty.name}  ·  HP x${c.difficulty.bossHpMul}  ·  Score x${c.difficulty.scoreMul}`, PAD.x + PAD.w / 2 - 16, PAD.y + PAD.h + 153);
  ctx.textAlign = 'left';
  // Intro card.
  if (c.phase === 'intro') {
    ctx.save();
    ctx.fillStyle = 'rgba(26, 21, 18, 0.55)';
    ctx.fillRect(0, 0, 1024, 576);
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.roundRect(212, 150, 600, 260, 16);
    ctx.fill();
    ctx.strokeStyle = '#b02a1e';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b02a1e';
    ctx.font = '700 15px Georgia, serif';
    ctx.fillText(`— SCROLL ${def.scroll} OF 7 —`, 512, 190);
    ctx.fillStyle = el.color;
    ctx.font = '700 64px "Noto Serif JP", serif';
    ctx.fillText(el.kanji, 512, 258);
    ctx.fillStyle = '#2b2118';
    ctx.font = '700 34px Georgia, serif';
    ctx.fillText(def.name, 512, 306);
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#6b5a44';
    ctx.fillText(def.title, 512, 332);
    ctx.font = '13px Georgia, serif';
    ctx.fillText(def.blurb, 512, 360);
    ctx.font = '700 15px Georgia, serif';
    ctx.fillStyle = weak.color;
    ctx.fillText(`Weak against ${weak.kanji} ${weak.name} — draw it to deal double damage`, 512, 388);
    ctx.restore();
  }
  // Win / lose banners over the arena.
  if (c.phase === 'won') {
    ctx.save();
    ctx.fillStyle = 'rgba(26, 21, 18, 0.45)';
    ctx.fillRect(0, 0, 1024, 576);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '700 56px Georgia, serif';
    ctx.fillText('SCROLL SEALED!', 512, 240);
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText(`${def.name} falls. The story moves on.`, 512, 278);
    drawSeal(ctx, 512, 350, 84, '印', 1);
    ctx.restore();
  }
  if (c.phase === 'lost') {
    ctx.save();
    ctx.fillStyle = 'rgba(26, 21, 18, 0.6)';
    ctx.fillRect(0, 0, 1024, 576);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '700 56px Georgia, serif';
    ctx.fillText('THE INK RUNS DRY', 512, 250);
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('Your brush falls silent… but every scroll can be rewritten.', 512, 288);
    ctx.restore();
  }
}
