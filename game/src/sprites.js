// INKBLADE sprites: every creature and decoration is drawn in code with
// canvas paths — brush-stroke bodies, ink-wash fills, no external images.
// Bosses face left, toward the painter; each has its own silhouette and its
// element's colour, plus a giant watermark kanji behind it.

import { ELEMENT_BY_ID } from './config.js';

// The rice paper, rendered once to an offscreen canvas at 2x (HD) so the
// grain stays crisp: warm off-white with fibre flecks, faint laid lines,
// soft age spots and a vignette, so every frame costs one drawImage.
let paperCanvas = null;
export function drawPaper(ctx, w, h) {
  if (paperCanvas === null) {
    paperCanvas = document.createElement('canvas');
    paperCanvas.width = w * 2;
    paperCanvas.height = h * 2;
    const p = paperCanvas.getContext('2d');
    p.scale(2, 2);
    p.fillStyle = '#f6efdd';
    p.fillRect(0, 0, w, h);
    // Faint laid lines: handmade paper shows the mould's horizontal wires.
    p.strokeStyle = 'rgba(120, 95, 60, 0.045)';
    p.lineWidth = 1;
    for (let y = 9; y < h; y += 18) {
      p.beginPath();
      p.moveTo(0, y);
      p.lineTo(w, y);
      p.stroke();
    }
    // Fibre flecks: short pale and dark fibres scattered through the sheet.
    for (let i = 0; i < 4200; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      p.strokeStyle = Math.random() < 0.5 ? 'rgba(120, 95, 60, 0.05)' : 'rgba(255, 255, 255, 0.4)';
      p.lineWidth = 0.7;
      p.beginPath();
      p.moveTo(x, y);
      p.lineTo(x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 3);
      p.stroke();
    }
    // Age spots: soft warm clouds where the paper has darkened.
    for (let i = 0; i < 34; i += 1) {
      p.fillStyle = 'rgba(150, 120, 70, 0.05)';
      p.beginPath();
      p.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 80, 14 + Math.random() * 36, Math.random(), 0, Math.PI * 2);
      p.fill();
    }
    // A few tiny ink specks, as if the brush shook once, long ago.
    for (let i = 0; i < 22; i += 1) {
      p.fillStyle = 'rgba(26, 21, 18, 0.08)';
      p.beginPath();
      p.arc(Math.random() * w, Math.random() * h, 0.5 + Math.random() * 1.4, 0, Math.PI * 2);
      p.fill();
    }
    // Vignette: the sheet darkens gently toward the edges.
    const vig = p.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(120, 95, 60, 0)');
    vig.addColorStop(1, 'rgba(120, 95, 60, 0.10)');
    p.fillStyle = vig;
    p.fillRect(0, 0, w, h);
  }
  ctx.drawImage(paperCanvas, 0, 0, w, h);
}

// A vermilion frame with corner seals, drawn around a screen.
export function drawFrame(ctx, w, h) {
  ctx.strokeStyle = '#b02a1e';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.strokeStyle = 'rgba(176, 42, 30, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  // Small corner seals: the frame is stamped, not just drawn.
  const corners = [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]];
  for (const [cx, cy] of corners) {
    ctx.fillStyle = 'rgba(193, 39, 27, 0.85)';
    ctx.fillRect(cx - 6, cy - 6, 12, 12);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = '700 9px "Noto Serif JP", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('墨', cx, cy + 0.5);
  }
  ctx.textBaseline = 'alphabetic';
}

// A red seal stamp: rounded square, white kanji inside, slightly rotated.
// Colour is vermilion by default; rank seals use their own colour.
export function drawSeal(ctx, x, y, size, text, alpha = 1, color = '#c1271b') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.14);
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.font = `700 ${size * 0.58}px "Noto Serif JP", "Hiragino Mincho ProN", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.03);
  ctx.restore();
}

function brushEllipse(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eye(ctx, x, y, r, angry = 0) {
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1512';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 1.3);
    ctx.lineTo(x + r, y - r * 0.6);
    ctx.stroke();
  }
}

// A bokkotsu wash: a boneless, gradient-filled shape with no hard outline —
// light where the wash is thin, dark where the ink pooled. The sumi-e way
// to give a body volume without drawing its edge.
function wash(ctx, x, y, rx, ry, inner, outer, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-rx * 0.25, -ry * 0.3, rx * 0.08, 0, 0, Math.max(rx, ry) * 1.05);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A tarashikomi pool: wet ink dropped into wet ink, a soft dark bloom.
function pool(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(x + (i - 1) * r * 0.28, y + Math.sin(i * 2.1) * r * 0.14, r * (0.72 - i * 0.12), r * 0.5, i * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Deterministic ink splatter around a point (seeded, so it never flickers).
function splatter(ctx, x, y, r, color, n, seed = 1) {
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 233280 + 9301) % 233280;
    return s / 233280;
  };
  ctx.fillStyle = color;
  for (let i = 0; i < n; i += 1) {
    const a = rand() * Math.PI * 2;
    const d = r * (0.55 + rand() * 0.95);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0.8 + rand() * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A demon's eye: golden iris, vertical slit pupil, a glint of light.
function slitEye(ctx, x, y, r, iris = '#ffd43b') {
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1512';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.22, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.3, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

// A heavy furrowed brow: one thick stroke slanting down toward the nose.
function brow(ctx, x, y, r, flip = 1) {
  ctx.strokeStyle = '#1a1512';
  ctx.lineWidth = r * 0.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + r * 1.1 * flip, y - r * 1.5);
  ctx.lineTo(x - r * 1.2 * flip, y - r * 0.55);
  ctx.stroke();
}

// A soft shadow grounding a boss on the paper.
function groundShadow(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(43, 33, 24, 0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.18, r * 1.05, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Each boss painter draws at (x, y) facing left, sized by r, animated by t.
const BOSS_ART = {
  kagaribi(ctx, x, y, r, t) {
    // Ember Oni, after the sumi-e oni reference: a textured red sun-disc
    // behind, crimson skin shaded by washes, curved ivory horns, wild black
    // hair, golden slit eyes under heavy brows, fangs, gold ornaments and
    // a clawed hand reaching for the painter.
    groundShadow(ctx, x, y, r);
    // The red sun-disc, with worn texture arcs.
    ctx.save();
    ctx.globalAlpha = 0.92;
    wash(ctx, x + r * 0.35, y - r * 0.25, r * 1.2, r * 1.2, '#d9483b', '#a61e1e');
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#7a1414';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x + r * 0.35, y - r * 0.25, r * (0.5 + i * 0.28), 0.6 + i * 0.5, 2.2 + i * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    // Flame hair: gradient tongues licking upward.
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI * 0.9 + i * 0.32;
      const fx = x + Math.cos(a) * r * 0.55;
      const fy = y - r * 0.72 + Math.sin(a) * r * 0.22 + Math.sin(t * 6 + i * 1.3) * 3;
      wash(ctx, fx, fy, r * 0.2, r * 0.36, '#ffd43b', i % 2 ? '#ff922b' : '#e8590c', a * 0.3);
    }
    // Body: crimson wash, darker toward the belly.
    wash(ctx, x, y, r, r * 0.92, '#e03131', '#8f1d1d');
    pool(ctx, x, y + r * 0.35, r * 0.55, '#5c1212', 0.35);
    // Wild hair: loose black strands whipping off the head.
    ctx.strokeStyle = '#1a1512';
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i += 1) {
      const sx = x - r * 0.55 + i * r * 0.18;
      const sway = Math.sin(t * 4 + i * 1.7) * 4;
      ctx.lineWidth = r * (0.05 + (i % 3) * 0.02);
      ctx.beginPath();
      ctx.moveTo(sx, y - r * 0.62);
      ctx.quadraticCurveTo(sx - r * 0.25 + sway, y - r * 1.05, sx - r * 0.1 + sway * 1.5, y - r * 1.25 - (i % 2) * r * 0.1);
      ctx.stroke();
    }
    // Curved ivory horns.
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#f6efdd';
      ctx.strokeStyle = '#c9b896';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.34, y - r * 0.62);
      ctx.quadraticCurveTo(x + side * r * 0.75, y - r * 1.05, x + side * r * 0.62, y - r * 1.28);
      ctx.quadraticCurveTo(x + side * r * 0.48, y - r * 1.0, x + side * r * 0.52, y - r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Golden slit eyes under heavy brows.
    slitEye(ctx, x - r * 0.32, y - r * 0.12, r * 0.15);
    slitEye(ctx, x + r * 0.32, y - r * 0.12, r * 0.15);
    brow(ctx, x - r * 0.32, y - r * 0.12, r * 0.15, -1);
    brow(ctx, x + r * 0.32, y - r * 0.12, r * 0.15, 1);
    // Broad nose and a snarling mouth with white fangs.
    ctx.fillStyle = '#5c1212';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.08, y + r * 0.14, r * 0.06, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.08, y + r * 0.14, r * 0.06, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b0a0a';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.36, y + r * 0.32);
    ctx.quadraticCurveTo(x, y + r * 0.62, x + r * 0.36, y + r * 0.32);
    ctx.quadraticCurveTo(x, y + r * 0.42, x - r * 0.36, y + r * 0.32);
    ctx.fill();
    ctx.fillStyle = '#fdf6e3';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * r * 0.24, y + r * 0.34);
      ctx.lineTo(x + side * r * 0.14, y + r * 0.34);
      ctx.lineTo(x + side * r * 0.19, y + r * 0.52);
      ctx.closePath();
      ctx.fill();
    }
    // Gold ornaments on the shoulder.
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = '#e9b949';
      ctx.beginPath();
      ctx.arc(x + r * (0.62 + i * 0.14), y + r * (0.28 + i * 0.16), r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d1f';
      ctx.beginPath();
      ctx.arc(x + r * (0.62 + i * 0.14), y + r * (0.28 + i * 0.16), r * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    // The clawed hand, reaching toward the painter.
    const hx = x - r * 0.95;
    const hy = y + r * 0.55 + Math.sin(t * 3) * 3;
    wash(ctx, hx + r * 0.2, hy, r * 0.3, r * 0.24, '#e03131', '#8f1d1d', 0.4);
    for (let i = 0; i < 3; i += 1) {
      const fx = hx - r * 0.08 - i * r * 0.12;
      const fy = hy - r * 0.12 + i * r * 0.12;
      ctx.strokeStyle = '#c92a2a';
      ctx.lineWidth = r * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.05, hy - r * 0.05 + i * r * 0.1);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.fillStyle = '#1a1512';
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.05, fy);
      ctx.lineTo(fx + r * 0.02, fy - r * 0.05);
      ctx.lineTo(fx - r * 0.14, fy + r * 0.04);
      ctx.closePath();
      ctx.fill();
    }
    // Smoke wisps curling off the base.
    ctx.strokeStyle = 'rgba(73, 80, 87, 0.5)';
    ctx.lineWidth = r * 0.06;
    for (let i = 0; i < 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + r * (0.5 + i * 0.3), y + r * 0.9);
      ctx.quadraticCurveTo(x + r * (0.8 + i * 0.3), y + r * 0.6 + Math.sin(t * 2 + i) * 4, x + r * (0.55 + i * 0.35), y + r * 0.35);
      ctx.stroke();
    }
  },
  mizuchi(ctx, x, y, r, t) {
    // Tide Serpent: a coiling blue body shaded by washes, scale arcs along
    // the coils, a fin crest, long whiskers and fangs.
    groundShadow(ctx, x, y, r);
    // Coils, thick at the head, tapering to the tail; a pale highlight runs
    // along the top of each coil like light on water.
    for (let s = 3; s >= 0; s -= 1) {
      const sx = x + r * 0.95 - s * r * 0.45;
      const sy = y + Math.sin(t * 3 + s * 1.2) * r * 0.25;
      const wdt = r * (0.62 - s * 0.1);
      ctx.strokeStyle = '#1864ab';
      ctx.lineCap = 'round';
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(sx + r * 0.3, sy);
      ctx.quadraticCurveTo(sx, sy - r * 0.3, sx - r * 0.3, sy + Math.sin(t * 3 + s) * r * 0.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(116, 192, 252, 0.7)';
      ctx.lineWidth = wdt * 0.45;
      ctx.beginPath();
      ctx.moveTo(sx + r * 0.3, sy - wdt * 0.18);
      ctx.quadraticCurveTo(sx, sy - r * 0.3 - wdt * 0.18, sx - r * 0.3, sy + Math.sin(t * 3 + s) * r * 0.2 - wdt * 0.18);
      ctx.stroke();
    }
    // Scale arcs along the coils.
    ctx.strokeStyle = 'rgba(165, 216, 255, 0.55)';
    ctx.lineWidth = 1.5;
    for (let s = 0; s < 4; s += 1) {
      for (let k = 0; k < 3; k += 1) {
        const sx = x + r * (0.85 - s * 0.45 - k * 0.12);
        const sy = y + Math.sin(t * 3 + s * 1.2) * r * 0.25 + r * 0.12;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.1, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
    }
    // Head: wash-shaded, with a pale belly.
    wash(ctx, x - r * 0.35, y, r * 0.58, r * 0.5, '#4dabf7', '#1864ab');
    wash(ctx, x - r * 0.4, y + r * 0.18, r * 0.4, r * 0.26, '#a5d8ff', '#4dabf7');
    // Fin crest.
    ctx.fillStyle = '#74c0fc';
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - r * (0.5 - i * 0.18), y - r * 0.42);
      ctx.lineTo(x - r * (0.42 - i * 0.18), y - r * (0.85 - i * 0.1));
      ctx.lineTo(x - r * (0.28 - i * 0.18), y - r * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    slitEye(ctx, x - r * 0.55, y - r * 0.12, r * 0.13, '#ffe066');
    brow(ctx, x - r * 0.55, y - r * 0.12, r * 0.13, -1);
    // Snout, nostril, fang.
    ctx.fillStyle = '#1864ab';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.82, y + r * 0.08, r * 0.07, r * 0.1, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.72, y + r * 0.18);
    ctx.lineTo(x - r * 0.62, y + r * 0.18);
    ctx.lineTo(x - r * 0.67, y + r * 0.36);
    ctx.closePath();
    ctx.fill();
    // Long whiskers, curling like the sumi-e dragon's.
    ctx.strokeStyle = '#a5d8ff';
    ctx.lineWidth = r * 0.045;
    for (const side of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y + r * (0.05 + side * 0.12));
      ctx.quadraticCurveTo(x - r * 1.2, y + r * (0.3 + side * 0.15), x - r * 1.1, y + r * (0.55 + side * 0.15));
      ctx.stroke();
    }
    // Water droplets flung off the coils.
    ctx.fillStyle = 'rgba(77, 171, 247, 0.8)';
    for (let i = 0; i < 6; i += 1) {
      const dx = x + r * (0.2 + i * 0.18);
      const dy = y - r * 0.6 + Math.sin(t * 5 + i * 2) * 6;
      ctx.beginPath();
      ctx.arc(dx, dy, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  arashi(ctx, x, y, r, t) {
    // Gale Crow: layered wing feathers, a shaded black body, a hooked amber
    // beak, one fierce golden eye, talons, and green wind swirls.
    groundShadow(ctx, x, y, r);
    const flap = Math.sin(t * 7) * 0.3;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x, y - r * 0.1);
      ctx.rotate(side * (0.5 + flap * side));
      const wg = ctx.createLinearGradient(0, 0, side * r * 1.8, 0);
      wg.addColorStop(0, '#343a40');
      wg.addColorStop(1, '#121517');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(side * r * 0.85, -r * 0.25, r * 0.95, r * 0.34, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Feather rows: overlapping arcs along the wing edge.
      ctx.strokeStyle = 'rgba(134, 142, 150, 0.7)';
      ctx.lineWidth = 1.5;
      for (let row = 0; row < 2; row += 1) {
        for (let k = 0; k < 5; k += 1) {
          ctx.beginPath();
          ctx.arc(side * r * (0.45 + k * 0.28), -r * (0.1 + row * 0.22), r * 0.16, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    wash(ctx, x, y, r * 0.55, r * 0.7, '#495057', '#121517');
    // Head feathers: spiky strokes.
    ctx.strokeStyle = '#212529';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i += 1) {
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3 + i * r * 0.14, y - r * 0.62);
      ctx.lineTo(x - r * 0.38 + i * r * 0.16, y - r * 0.85 - (i % 2) * r * 0.08);
      ctx.stroke();
    }
    // Hooked amber beak with a nostril.
    ctx.fillStyle = '#f08c00';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.38);
    ctx.quadraticCurveTo(x - r * 0.95, y - r * 0.28, x - r * 1.0, y - r * 0.12);
    ctx.quadraticCurveTo(x - r * 0.7, y - r * 0.02, x - r * 0.5, y - r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a3c00';
    ctx.beginPath();
    ctx.arc(x - r * 0.62, y - r * 0.26, r * 0.035, 0, Math.PI * 2);
    ctx.fill();
    slitEye(ctx, x - r * 0.28, y - r * 0.32, r * 0.13, '#ffd43b');
    brow(ctx, x - r * 0.28, y - r * 0.32, r * 0.13, -1);
    // Talons below.
    ctx.strokeStyle = '#1a1512';
    ctx.lineWidth = r * 0.05;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.2 + i * r * 0.18, y + r * 0.62);
      ctx.quadraticCurveTo(x - r * 0.2 + i * r * 0.18, y + r * 0.85, x - r * 0.28 + i * r * 0.18, y + r * 0.95);
      ctx.stroke();
    }
    // Wind swirls trailing behind.
    ctx.strokeStyle = 'rgba(105, 219, 124, 0.85)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) {
      ctx.lineWidth = r * (0.09 - i * 0.015);
      ctx.beginPath();
      ctx.arc(x + r * (0.4 + i * 0.35), y + r * 0.6 + Math.sin(t * 5 + i) * 4, r * 0.16, 0.4, Math.PI * 1.4);
      ctx.stroke();
    }
  },
  raiko(ctx, x, y, r, t) {
    // Storm Kirin: a golden horse-body shaded by washes, a mane of live
    // lightning, a spiralled horn, hooves, and a bolt for a tail.
    groundShadow(ctx, x, y, r);
    // Legs and hooves.
    for (const lx of [-0.1, 0.55]) {
      wash(ctx, x + r * lx, y + r * 0.5, r * 0.13, r * 0.3, '#f08c00', '#a2622d');
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.roundRect(x + r * lx - r * 0.13, y + r * 0.72, r * 0.26, r * 0.12, 3);
      ctx.fill();
    }
    // Body and neck.
    wash(ctx, x + r * 0.2, y + r * 0.15, r * 0.82, r * 0.5, '#fab005', '#a2622d');
    wash(ctx, x - r * 0.45, y - r * 0.3, r * 0.4, r * 0.52, '#fab005', '#a2622d', -0.3);
    // Head: muzzle, nostril, slit eye.
    wash(ctx, x - r * 0.62, y - r * 0.62, r * 0.3, r * 0.26, '#ffd43b', '#e67700', -0.2);
    ctx.fillStyle = '#7a3c00';
    ctx.beginPath();
    ctx.arc(x - r * 0.84, y - r * 0.55, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    slitEye(ctx, x - r * 0.6, y - r * 0.72, r * 0.11, '#ffe066');
    // The spiralled golden horn.
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.62, y - r * 0.88);
    ctx.quadraticCurveTo(x - r * 0.55, y - r * 1.3, x - r * 0.38, y - r * 1.42);
    ctx.quadraticCurveTo(x - r * 0.5, y - r * 1.1, x - r * 0.44, y - r * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a2622d';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - r * (0.6 - i * 0.05), y - r * (0.98 + i * 0.12));
      ctx.lineTo(x - r * (0.48 - i * 0.06), y - r * (0.96 + i * 0.12));
      ctx.stroke();
    }
    // Mane of lightning along the neck.
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = r * 0.07;
    ctx.lineJoin = 'round';
    for (let i = 0; i < 4; i += 1) {
      const mx = x - r * 0.2 + i * r * 0.26;
      const flick = Math.sin(t * 8 + i * 1.4) * r * 0.06;
      ctx.beginPath();
      ctx.moveTo(mx, y - r * 0.3);
      ctx.lineTo(mx + r * 0.1 + flick, y - r * 0.55);
      ctx.lineTo(mx + r * 0.02, y - r * 0.52);
      ctx.lineTo(mx + r * 0.16 + flick, y - r * 0.8);
      ctx.stroke();
    }
    // Lightning tail.
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.95, y + r * 0.05);
    ctx.lineTo(x + r * 1.2, y - r * 0.25 + Math.sin(t * 6) * 4);
    ctx.lineTo(x + r * 1.05, y - r * 0.22);
    ctx.lineTo(x + r * 1.3, y - r * 0.5);
    ctx.stroke();
    // Sparks crackling around the hooves.
    ctx.fillStyle = '#ffe066';
    for (let i = 0; i < 5; i += 1) {
      const sx = x + r * (0.1 + i * 0.2);
      const sy = y + r * 0.85 + Math.sin(t * 9 + i * 2) * 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
  },
  iwao(ctx, x, y, r, t) {
    // Mountain Golem: stacked stones shaded like real boulders, glowing
    // cracks, a moss cap, and amber eyes under stone brow ridges.
    groundShadow(ctx, x, y, r);
    const bob = Math.sin(t * 1.4) * 2;
    // Stone fists at the sides.
    wash(ctx, x - r * 1.0, y + r * 0.4 + bob, r * 0.32, r * 0.3, '#a9805a', '#5c3d24');
    wash(ctx, x + r * 1.0, y + r * 0.4 + bob, r * 0.32, r * 0.3, '#a9805a', '#5c3d24');
    // Stacked body stones.
    wash(ctx, x, y + r * 0.45 + bob, r * 0.95, r * 0.5, '#a9805a', '#5c3d24');
    wash(ctx, x - r * 0.1, y + bob, r * 0.72, r * 0.55, '#b08a5e', '#6b4a2b');
    wash(ctx, x, y - r * 0.5 + bob, r * 0.45, r * 0.42, '#c49a6b', '#7a5230');
    // Dark seams between the stones.
    ctx.strokeStyle = 'rgba(43, 33, 24, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.22 + bob);
    ctx.quadraticCurveTo(x, y + r * 0.32 + bob, x + r * 0.7, y + r * 0.22 + bob);
    ctx.stroke();
    // Moss cap with leaf dots.
    wash(ctx, x - r * 0.15, y - r * 0.85 + bob, r * 0.3, r * 0.14, '#69db7c', '#2b8a3e');
    ctx.fillStyle = '#2b8a3e';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(x - r * 0.38 + i * r * 0.12, y - r * 0.88 + bob + (i % 2) * 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stone brow ridges and glowing amber eyes.
    ctx.strokeStyle = '#4a2f1a';
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.38, y - r * 0.68 + bob);
    ctx.lineTo(x - r * 0.08, y - r * 0.6 + bob);
    ctx.moveTo(x + r * 0.38, y - r * 0.68 + bob);
    ctx.lineTo(x + r * 0.08, y - r * 0.6 + bob);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.arc(x + side * r * 0.22, y - r * 0.5 + bob, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1512';
      ctx.beginPath();
      ctx.arc(x + side * r * 0.22, y - r * 0.5 + bob, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    // A grim stone mouth.
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.2, y - r * 0.28 + bob);
    ctx.lineTo(x + r * 0.2, y - r * 0.28 + bob);
    ctx.stroke();
    // Glowing gold cracks.
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = r * 0.045;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y + r * 0.1 + bob);
    ctx.lineTo(x - r * 0.2, y + r * 0.3 + bob);
    ctx.lineTo(x - r * 0.35, y + r * 0.5 + bob);
    ctx.moveTo(x + r * 0.4, y + bob);
    ctx.lineTo(x + r * 0.25, y + r * 0.25 + bob);
    ctx.lineTo(x + r * 0.38, y + r * 0.42 + bob);
    ctx.stroke();
  },
  hikari(ctx, x, y, r, t) {
    // Dawn Phoenix: a white-gold bird with layered wing feathers, a flame
    // crest, long tail plumes with eye-spots, and a soft halo.
    groundShadow(ctx, x, y, r);
    // Halo behind the head.
    ctx.save();
    ctx.globalAlpha = 0.35;
    wash(ctx, x - r * 0.2, y - r * 0.35, r * 0.55, r * 0.55, '#fff3bf', '#ffd43b');
    ctx.restore();
    // Tail plumes with eye-spots.
    for (let i = 0; i < 3; i += 1) {
      const ex = x + r * 1.35;
      const ey = y + r * (0.55 + i * 0.3) + Math.sin(t * 4 + i) * 4;
      ctx.strokeStyle = i % 2 ? '#ff922b' : '#ffd43b';
      ctx.lineWidth = r * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + r * 0.4, y + r * 0.2);
      ctx.quadraticCurveTo(x + r * 1.1, y + r * (0.3 + i * 0.25), ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#e8590c';
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3bf';
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wings: layered feathers in gold and white.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side * 0.45 + Math.sin(t * 3) * 0.08 * side);
      const wg = ctx.createLinearGradient(0, 0, side * r * 1.4, 0);
      wg.addColorStop(0, '#fff3bf');
      wg.addColorStop(1, '#f59f00');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(side * r * 0.7, -r * 0.2, r * 0.75, r * 0.26, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230, 119, 0, 0.6)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k += 1) {
        ctx.beginPath();
        ctx.arc(side * r * (0.4 + k * 0.24), -r * 0.12, r * 0.13, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }
    wash(ctx, x, y, r * 0.55, r * 0.68, '#fff9db', '#f59f00');
    wash(ctx, x - r * 0.05, y + r * 0.1, r * 0.35, r * 0.4, '#fff3bf', '#ffd43b');
    // Flame crest.
    for (let i = 0; i < 3; i += 1) {
      wash(ctx, x - r * 0.35 + i * r * 0.22, y - r * 0.72 + Math.sin(t * 6 + i) * 3, r * 0.1, r * 0.26, '#ffd43b', '#e8590c', -0.2 + i * 0.2);
    }
    // Beak and an elegant dark eye ringed in gold.
    ctx.fillStyle = '#e67700';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.38);
    ctx.quadraticCurveTo(x - r * 0.9, y - r * 0.28, x - r * 0.95, y - r * 0.14);
    ctx.quadraticCurveTo(x - r * 0.68, y - r * 0.04, x - r * 0.5, y - r * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1512';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  },
  yami(ctx, x, y, r, t) {
    // Ink Dragon, after the sumi-e dragon reference: a serpentine body
    // shaded from violet ink to near-black, scale arcs, a spiky mane,
    // long curling whiskers, glowing slit eyes, and ink drips and splatter.
    groundShadow(ctx, x, y, r);
    splatter(ctx, x, y, r * 1.3, 'rgba(95, 61, 196, 0.35)', 14, 7);
    // Serpentine coils, thick at the head, tapering to the tail.
    for (let s = 4; s >= 0; s -= 1) {
      const sx = x + r * 1.0 - s * r * 0.42;
      const sy = y + Math.sin(t * 2.4 + s * 1.1) * r * 0.3;
      const wdt = r * (0.55 - s * 0.07);
      ctx.strokeStyle = s % 2 ? '#5f3dc4' : '#4a2f9e';
      ctx.lineCap = 'round';
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(sx + r * 0.3, sy);
      ctx.quadraticCurveTo(sx, sy - r * 0.35, sx - r * 0.3, sy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(177, 151, 252, 0.6)';
      ctx.lineWidth = wdt * 0.4;
      ctx.beginPath();
      ctx.moveTo(sx + r * 0.3, sy - wdt * 0.2);
      ctx.quadraticCurveTo(sx, sy - r * 0.35 - wdt * 0.2, sx - r * 0.3, sy - wdt * 0.2);
      ctx.stroke();
    }
    // Scale arcs along the coils.
    ctx.strokeStyle = 'rgba(177, 151, 252, 0.5)';
    ctx.lineWidth = 1.5;
    for (let s = 0; s < 5; s += 1) {
      for (let k = 0; k < 2; k += 1) {
        const sx = x + r * (0.95 - s * 0.42 - k * 0.16);
        const sy = y + Math.sin(t * 2.4 + s * 1.1) * r * 0.3 + r * 0.1;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.09, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
    }
    // Spiky mane along the neck.
    ctx.strokeStyle = '#b197fc';
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i += 1) {
      const mx = x - r * 0.1 + i * r * 0.28;
      const my = y - r * 0.35 + Math.sin(t * 2.4 + i) * r * 0.1;
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + r * 0.12, my - r * 0.3 - (i % 2) * r * 0.1);
      ctx.stroke();
    }
    // Head: wash-shaded, pale belly, curved horns.
    wash(ctx, x - r * 0.4, y, r * 0.62, r * 0.52, '#7048e8', '#2b1a4d');
    wash(ctx, x - r * 0.42, y + r * 0.14, r * 0.42, r * 0.28, '#9775fa', '#5f3dc4');
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#b197fc';
      ctx.beginPath();
      ctx.moveTo(x - r * (0.55 + side * 0.25), y - r * 0.42);
      ctx.quadraticCurveTo(x - r * (0.5 + side * 0.3), y - r * 0.8, x - r * (0.32 + side * 0.34), y - r * 0.88);
      ctx.quadraticCurveTo(x - r * (0.42 + side * 0.28), y - r * 0.6, x - r * (0.38 + side * 0.22), y - r * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    slitEye(ctx, x - r * 0.58, y - r * 0.1, r * 0.14, '#ffe066');
    brow(ctx, x - r * 0.58, y - r * 0.1, r * 0.14, -1);
    // Open mouth: fangs and a forked tongue.
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, y + r * 0.12);
    ctx.quadraticCurveTo(x - r * 0.6, y + r * 0.42, x - r * 0.35, y + r * 0.2);
    ctx.quadraticCurveTo(x - r * 0.6, y + r * 0.22, x - r * 0.9, y + r * 0.12);
    ctx.fill();
    ctx.fillStyle = '#fdf6e3';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.82, y + r * 0.14);
    ctx.lineTo(x - r * 0.72, y + r * 0.14);
    ctx.lineTo(x - r * 0.77, y + r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e599f7';
    ctx.lineWidth = r * 0.045;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y + r * 0.3);
    ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.45, x - r * 0.85, y + r * 0.5);
    ctx.moveTo(x - r * 0.85, y + r * 0.5);
    ctx.lineTo(x - r * 0.95, y + r * 0.44);
    ctx.moveTo(x - r * 0.85, y + r * 0.5);
    ctx.lineTo(x - r * 0.92, y + r * 0.58);
    ctx.stroke();
    // Long whiskers, curling like the sumi-e dragon's.
    ctx.strokeStyle = '#d0bfff';
    ctx.lineWidth = r * 0.04;
    for (const side of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.85, y + r * (0.05 + side * 0.12));
      ctx.quadraticCurveTo(x - r * 1.3, y + r * (0.3 + side * 0.15), x - r * 1.15, y + r * (0.62 + side * 0.15));
      ctx.stroke();
    }
    // Ink drips falling from the coils.
    ctx.fillStyle = 'rgba(43, 26, 77, 0.8)';
    for (let i = 0; i < 4; i += 1) {
      const dx = x + r * (0.1 + i * 0.3);
      const drip = (t * 30 + i * 25) % 40;
      ctx.beginPath();
      ctx.ellipse(dx, y + r * 0.55 + drip, 2.5, 5 + drip * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// Draw a boss at (x, y) with radius r, animated by time t. flags: enraged,
// frozen, burning. A giant watermark of its element kanji sits behind it.
export function drawBoss(ctx, boss, x, y, r, t, flags = {}) {
  const el = ELEMENT_BY_ID[boss.element];
  const bob = Math.sin(t * 2) * 5;
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = el.color;
  ctx.font = `700 ${r * 3.1}px "Noto Serif JP", "Hiragino Mincho ProN", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(el.kanji, x, y + bob);
  ctx.restore();
  // Ink splatter in the boss's element colour, as if it burst onto the page.
  ctx.save();
  ctx.globalAlpha = 0.22;
  splatter(ctx, x, y + bob, r * 1.45, el.color, 12, boss.scroll * 3 + 1);
  ctx.restore();
  if (flags.enraged) {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(t * 9) * 0.08;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(x, y + bob, r * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const art = BOSS_ART[boss.id];
  if (art) art(ctx, x, y + bob, r, t);
  if (flags.frozen) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#66d9e8';
    ctx.beginPath();
    ctx.arc(x, y + bob, r * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (flags.burning) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i += 1) {
      const fx = x + Math.sin(t * 10 + i * 2) * r * 0.5;
      brushEllipse(ctx, fx, y + bob - r * (0.6 + (i % 3) * 0.25), 5 + (i % 2) * 3, 9, '#ff922b');
    }
    ctx.restore();
  }
}

// The painter: a small ink figure with a topknot and an oversized brush —
// gradient robe, vermilion sash, a determined face.
export function drawPlayer(ctx, x, y, t, shielded) {
  const bob = Math.sin(t * 4) * 2;
  if (shielded) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(t * 6) * 0.15;
    ctx.strokeStyle = '#d0a06a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y + bob, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Soft shadow under the painter.
  ctx.fillStyle = 'rgba(43, 33, 24, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 20, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Robe: a dark wash, lighter at the shoulder.
  wash(ctx, x, y + 8 + bob, 15, 17, '#4a3b2c', '#2b2118');
  // Vermilion sash.
  ctx.strokeStyle = '#c1271b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 13, y + 10 + bob);
  ctx.lineTo(x + 13, y + 4 + bob);
  ctx.stroke();
  // Sleeve reaching for the brush.
  ctx.strokeStyle = '#2b2118';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 2 + bob);
  ctx.lineTo(x + 14, y - 6 + bob);
  ctx.stroke();
  // Face: pale skin, ink hair swept back, a topknot with a red band.
  ctx.fillStyle = '#f6efdd';
  ctx.beginPath();
  ctx.arc(x, y - 12 + bob, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(x, y - 12 + bob, 11, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(x, y - 24 + bob, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c1271b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 3.5, y - 24 + bob);
  ctx.lineTo(x + 3.5, y - 24 + bob);
  ctx.stroke();
  // Determined eyes and a small set mouth.
  ctx.fillStyle = '#1a1512';
  ctx.beginPath();
  ctx.arc(x - 4, y - 12 + bob, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 12 + bob, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1512';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 6 + bob);
  ctx.lineTo(x + 3, y - 6 + bob);
  ctx.stroke();
  // The oversized brush, held up and to the right, ink dripping from the tip.
  ctx.save();
  ctx.translate(x + 10, y + 2 + bob);
  ctx.rotate(-0.7 + Math.sin(t * 3) * 0.06);
  const hg = ctx.createLinearGradient(0, 0, 0, -26);
  hg.addColorStop(0, '#6b4a2b');
  hg.addColorStop(1, '#a9805a');
  ctx.fillStyle = hg;
  ctx.fillRect(-2, -26, 4, 26);
  ctx.fillStyle = '#1a1512';
  ctx.beginPath();
  ctx.moveTo(-4, -26);
  ctx.lineTo(4, -26);
  ctx.lineTo(0, -38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- The player's equipped brush and ink (rank unlocks, set by main.js). ---
let equippedBrush = { width: 9, splatter: false, glow: false };
let equippedInk = '#1a1512';
let inkRainbow = false;

export function setBrushStyle(style, inkColor, rainbow = false) {
  equippedBrush = style;
  equippedInk = inkColor;
  inkRainbow = rainbow;
}

// A brush stroke through points, wider in the middle, tapering at the ends.
// With no colour given it uses the player's equipped ink and brush style
// (rank unlocks); the Master brush glows, Splatter throws ink drops.
// Nijimi: ink bleeding into the paper — a wide, faint halo is laid under
// the stroke first, so the line feels wet rather than printed. glowColor
// (the combat pad passes the selected element's glow) adds a coloured
// halo around the stroke so the live drawing reads from across the room.
export function drawBrushStroke(ctx, points, color = null, maxWidth = null, glowColor = null) {
  if (points.length < 2) return;
  const style = equippedBrush;
  const width = maxWidth ?? style.width;
  let strokeColor = color ?? equippedInk;
  if (color === null && inkRainbow) {
    strokeColor = `hsl(${(performance.now() / 12) % 360}, 75%, 45%)`;
  }
  ctx.save();
  if ((color === null && style.glow) || glowColor) {
    ctx.shadowColor = glowColor ?? strokeColor;
    ctx.shadowBlur = glowColor ? 14 : 10;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pass = (alpha, widthScale) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strokeColor;
    for (let i = 1; i < points.length; i += 1) {
      const f = i / points.length;
      const w = width * widthScale * (0.28 + 0.72 * Math.sin(Math.PI * Math.min(1, f * 1.15)));
      ctx.lineWidth = Math.max(1.2, w);
      ctx.beginPath();
      ctx.moveTo(points[i - 1][0], points[i - 1][1]);
      ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
    }
  };
  pass(0.12, 2.3); // the bleed halo
  pass(1, 1); // the stroke itself
  ctx.globalAlpha = 1;
  if (color === null && style.splatter) {
    ctx.fillStyle = strokeColor;
    for (let i = 0; i < 5; i += 1) {
      const p = points[Math.floor((i / 5) * (points.length - 1))];
      ctx.beginPath();
      ctx.arc(p[0] + (Math.sin(i * 7.3) * 9), p[1] + (Math.cos(i * 5.1) * 9), 1.6 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
