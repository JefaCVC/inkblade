// INKBLADE particles: the visible magic. Every spell bursts into particles
// in its element's colour; damage numbers and call-outs float up as text.
// One small system, driven by spawn helpers per effect, updated and drawn
// by the game loop.

export function makeParticles() {
  return { list: [], texts: [] };
}

function add(list, p) {
  if (list.length > 500) list.splice(0, list.length - 500);
  list.push(p);
}

export function burst(particles, x, y, color, count, speed = 180, size = 5, life = 0.7, gravity = 0) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    add(particles.list, {
      x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 40,
      size: size * (0.5 + Math.random() * 0.8), color,
      life: life * (0.6 + Math.random() * 0.7), age: 0, gravity,
      shape: Math.random() < 0.3 ? 'ink' : 'dot',
    });
  }
}

export function trail(particles, x, y, color, size = 4) {
  add(particles.list, {
    x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30,
    size: size * (0.6 + Math.random() * 0.6), color, life: 0.45, age: 0, gravity: 0, shape: 'dot',
  });
}

export function ring(particles, x, y, color, maxRadius = 90) {
  add(particles.list, {
    x, y, vx: 0, vy: 0, size: 6, color, life: 0.5, age: 0, gravity: 0,
    shape: 'ring', maxRadius,
  });
}

// Element-flavoured spell bursts: embers rise for fire, droplets streak
// down for water, sparks star out for lightning, leaves flutter for wind,
// shards tumble for earth, crystals glitter for ice, rays rise for light,
// wisps drift for dark. Each element reads instantly from its particles.
const SPELL_BURSTS = {
  fire: { shape: 'ember', colors: ['#ff922b', '#ffd43b', '#e8590c'], count: 26, speed: 200, size: 5, life: 0.9, gravity: -80 },
  water: { shape: 'drop', colors: ['#4dabf7', '#74c0fc', '#1971c2'], count: 24, speed: 220, size: 6, life: 0.7, gravity: 320 },
  lightning: { shape: 'spark', colors: ['#ffd43b', '#ffe066', '#fab005'], count: 20, speed: 320, size: 6, life: 0.45, gravity: 0 },
  wind: { shape: 'leaf', colors: ['#69db7c', '#8ce99a', '#2b8a3e'], count: 22, speed: 260, size: 5, life: 0.8, gravity: -30 },
  earth: { shape: 'shard', colors: ['#d0a06a', '#a9805a', '#8d5a2b'], count: 18, speed: 180, size: 6, life: 0.8, gravity: 420 },
  ice: { shape: 'crystal', colors: ['#99e9f2', '#66d9e8', '#3bc9db'], count: 20, speed: 200, size: 5, life: 0.8, gravity: 60 },
  light: { shape: 'ray', colors: ['#ffe066', '#fff3bf', '#ffd43b'], count: 18, speed: 130, size: 8, life: 0.7, gravity: -120 },
  dark: { shape: 'wisp', colors: ['#b197fc', '#9775fa', '#7048e8'], count: 16, speed: 90, size: 9, life: 1.1, gravity: -20 },
};

export function spellBurst(particles, x, y, elementId, power = 1) {
  const spec = SPELL_BURSTS[elementId];
  if (!spec) { burst(particles, x, y, '#2b2118', 16); return; }
  const count = Math.round(spec.count * power);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = spec.speed * (0.3 + Math.random() * 0.7);
    add(particles.list, {
      x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 40,
      size: spec.size * (0.5 + Math.random() * 0.8),
      color: spec.colors[i % spec.colors.length],
      life: spec.life * (0.6 + Math.random() * 0.7), age: 0,
      gravity: spec.gravity, shape: spec.shape,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 12,
    });
  }
  ring(particles, x, y, spec.colors[0], 70 + 40 * power);
}

export function floatText(particles, x, y, text, color = '#2b2118', size = 22, align = 'center') {
  particles.texts.push({ x, y, text, color, size, life: 1.1, age: 0, align });
  if (particles.texts.length > 24) particles.texts.splice(0, particles.texts.length - 24);
}

export function updateParticles(particles, dt) {
  for (const p of particles.list) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
    if (p.vr) p.rot += p.vr * dt;
    if (p.shape === 'leaf') p.vx += Math.sin(p.age * 14 + p.rot) * 30 * dt;
  }
  particles.list = particles.list.filter((p) => p.age < p.life);
  for (const t of particles.texts) { t.age += dt; t.y -= 34 * dt; }
  particles.texts = particles.texts.filter((t) => t.age < t.life);
}

export function drawParticles(ctx, particles) {
  for (const p of particles.list) {
    const a = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, a);
    if (p.shape === 'ring') {
      const r = 8 + (p.maxRadius - 8) * (p.age / p.life);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4 * a + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.shape === 'ink') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, p.vx * 0.002, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'ember') {
      // A flickering ember: bright core, darker rim, shrinking as it cools.
      const flick = 0.75 + Math.sin(p.age * 40 + p.rot) * 0.25;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a * flick + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3bf';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a * flick * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'drop') {
      // A water droplet: a streak along its velocity.
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size * 0.4);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else if (p.shape === 'spark') {
      // A four-point lightning star.
      const s = p.size * a + 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.6);
      ctx.lineTo(p.x + s * 0.35, p.y - s * 0.35);
      ctx.lineTo(p.x + s * 1.6, p.y);
      ctx.lineTo(p.x + s * 0.35, p.y + s * 0.35);
      ctx.lineTo(p.x, p.y + s * 1.6);
      ctx.lineTo(p.x - s * 0.35, p.y + s * 0.35);
      ctx.lineTo(p.x - s * 1.6, p.y);
      ctx.lineTo(p.x - s * 0.35, p.y - s * 0.35);
      ctx.closePath();
      ctx.fill();
    } else if (p.shape === 'shard') {
      // A tumbling earth shard.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.6, -p.size * 0.4);
      ctx.lineTo(p.size * 0.7, -p.size * 0.2);
      ctx.lineTo(p.size * 0.3, p.size * 0.6);
      ctx.lineTo(-p.size * 0.5, p.size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.shape === 'crystal') {
      // An ice crystal: a small diamond with a bright core.
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.size);
      ctx.lineTo(p.x + p.size * 0.6, p.y);
      ctx.lineTo(p.x, p.y + p.size);
      ctx.lineTo(p.x - p.size * 0.6, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e7f5ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'ray') {
      // A shaft of holy light.
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size * 0.35);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.size);
      ctx.lineTo(p.x, p.y + p.size);
      ctx.stroke();
    } else if (p.shape === 'wisp') {
      // A drifting dark wisp: large, soft, half-transparent.
      ctx.globalAlpha = Math.max(0, a * 0.55);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.4), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'leaf') {
      // A wind-blown leaf: a small green ellipse, fluttering.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot + Math.sin(p.age * 10) * 0.6);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (const t of particles.texts) {
    const a = t.age < 0.7 ? 1 : 1 - (t.age - 0.7) / 0.4;
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `700 ${t.size}px Georgia, serif`;
    ctx.textAlign = t.align || 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(250, 244, 230, 0.9)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
