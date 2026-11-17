// INKBLADE stroke recognition: template matching against the seal-script
// kanji in config.js. Forgiving by design — the player is a calligrapher, not
// a plotter. A stroke is resampled to fixed points, normalised to its own
// bounding box, then compared to the template stroke in the same order.
// The score is the mean stroke similarity minus a penalty for a wrong stroke
// count, so drawing 火 with three strokes instead of four still mostly works.

import { CAST_THRESHOLD, ELEMENTS } from './config.js';

const SAMPLE_POINTS = 16;
const COUNT_PENALTY = 0.12;

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

// Resample a polyline to exactly n evenly spaced points.
export function resample(points, n = SAMPLE_POINTS) {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: n }, () => [...points[0]]);
  const total = pathLength(points);
  const step = total / (n - 1);
  const out = [[...points[0]]];
  let carried = 0;
  let i = 1;
  while (out.length < n - 1 && i < points.length) {
    const prev = points[i - 1];
    const cur = points[i];
    const seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    if (carried + seg >= step) {
      const t = (step - carried) / (seg || 1);
      const nx = prev[0] + (cur[0] - prev[0]) * t;
      const ny = prev[1] + (cur[1] - prev[1]) * t;
      out.push([nx, ny]);
      points = [[nx, ny], ...points.slice(i)];
      i = 1;
      carried = 0;
    } else {
      carried += seg;
      i += 1;
    }
  }
  while (out.length < n) out.push([...points[points.length - 1]]);
  return out;
}

// Scale a point set into the unit square, keeping its aspect ratio.
function normalise(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const w = Math.max(maxX - minX, 1e-6);
  const h = Math.max(maxY - minY, 1e-6);
  const scale = 1 / Math.max(w, h);
  return points.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]);
}

// Similarity of two strokes, 0..1, after resampling and normalising both.
function strokeSimilarity(a, b) {
  const ra = normalise(resample(a.map((p) => [...p])));
  const rb = normalise(resample(b.map((p) => [...p])));
  let dist = 0;
  for (let i = 0; i < SAMPLE_POINTS; i += 1) {
    dist += Math.hypot(ra[i][0] - rb[i][0], ra[i][1] - rb[i][1]);
  }
  dist /= SAMPLE_POINTS;
  return Math.max(0, 1 - dist / 0.45);
}

// Score the drawn strokes against one element's template.
function scoreAgainst(drawn, template) {
  const paired = Math.min(drawn.length, template.length);
  if (paired === 0) return 0;
  let sum = 0;
  for (let i = 0; i < paired; i += 1) sum += strokeSimilarity(drawn[i], template[i]);
  const mean = sum / paired;
  const countPenalty = Math.abs(drawn.length - template.length) * COUNT_PENALTY;
  return Math.max(0, mean - countPenalty);
}

/**
 * Recognise drawn strokes (an array of strokes, each an array of [x, y] in
 * pad coordinates). Returns { element, accuracy } where accuracy is 0..1, or
 * { element: null, accuracy } when nothing matches well enough to cast.
 */
export function recognise(drawn) {
  let best = null;
  let bestScore = 0;
  for (const element of ELEMENTS) {
    const score = scoreAgainst(drawn, element.strokes);
    if (score > bestScore) {
      bestScore = score;
      best = element;
    }
  }
  if (best !== null && bestScore >= CAST_THRESHOLD) return { element: best, accuracy: bestScore };
  return { element: null, accuracy: bestScore, closest: best };
}

// A tiny stroke is a tap, not a stroke: ignore strokes shorter than this
// (in pad pixels) so accidental clicks never become a cast.
export function isRealStroke(points) {
  return pathLength(points) > 14;
}
