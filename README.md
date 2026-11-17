# INKBLADE — Calligraphy Combat

Draw the kanji. Cast the magic. Seal all seven scrolls.

![make.fun](https://make.fun/badge.svg)

A complete original browser game for the [make.fun "Make the best game" bounty](https://make.fun/bounty/best-game-01). You are an ink painter fighting seven elemental bosses — not with a sword, but with a brush. Draw 火 in the ink pad and fire erupts; draw 水 and water bursts out. Every kanji is a spell, every stroke is judged.

## How it plays

- **Draw to cast** — mouse-draw kanji in the ink pad. Template matching recognises your strokes (forgivingly) and shows an accuracy % per cast. Clean strokes (90%+) are PERFECT: critical damage + bonus ink.
- **8 elemental spells** — 火 fire (burn), 水 water (knockback), 雷 lightning (chain), 風 wind (triple blades), 土 earth (shield + spikes), 氷 ice (freeze), 光 light (holy beam), 闇 dark (life drain).
- **The elemental wheel** — water beats fire, fire beats wind, wind beats lightning, lightning beats water, earth beats lightning, ice beats wind and earth, light and dark oppose. Weak hits deal double damage; the wheel is drawn on screen in every fight.
- **7 bosses, 7 scrolls** — each with its own element, weakness, attack patterns (projectiles, summons, charges, telegraphed area attacks) and an enrage phase below half health.
- **Ink, combos, upgrades** — casting costs ink, which refills over time and on hits. Chain casts to build a combo multiplier (up to x2). Between scrolls, spend essence in the shop: deeper ink well, faster refill, heavier strokes, more HP, longer combos, a starting ward.
- **Fusion combos** — cast two elements within the fusion window (4s, longer at high rank) and they fuse into one of six combined spells instead of the second spell alone: 炎嵐 Firestorm (fire+wind, AoE burn), 雷雨 Storm Surge (water+lightning, chain through water), 熔岩 Magma Eruption (fire+earth, heavy burst + burn), 氷結 Deep Freeze (water+ice, long freeze + shatter), 嵐 Tempest (wind+lightning, six rapid strikes), 蝕 Eclipse (light+dark, massive single hit). A COMBO READY chip shows the fusion window after every cast, and partner buttons glow gold. The COMBOS screen lists all six pairs and which ones you have discovered.
- **Tutorial ("Cara Bermain")** — a three-page how-to-play from the menu: an interactive lesson (draw 火 to burn a practice dummy, then fuse 風 into your first Firestorm), an illustrated guide (drawing, accuracy, ink, the combo window, the elemental wheel, controls), and the full reference of all 8 spells + all 6 fusions.
- **Calligraphy ranks** — 17 shodo ranks from 10th Kyu to Grand Calligrapher. Earn rank points from stroke accuracy, combos cast, bosses defeated, scrolls completed, and no-damage clears. Every rank-up grants a new red seal design plus an unlock: new brush styles (Bold, Fine, Splatter, Master), new ink colours (Vermilion, Indigo, Gold, Jade, Rainbow), +ink capacity, and a longer fusion window. Your rank, seal and progress bar live on the main menu; the RANK screen shows the whole ladder and lets you equip unlocked brushes and inks.
- **Training Dojo** — practise every kanji with numbered ghost-stroke guides and accuracy feedback.
- **Boss Codex, Leaderboard, Match History** — the codex remembers every demon met; the top 10 runs and last 20 matches persist in localStorage.
- **Procedural sound** — every sound is synthesised with Web Audio: brush swishes, one impact voice per element, boss roars, a sparse pentatonic pluck. M mutes.

## Controls

| Input | Action |
|---|---|
| Mouse (ink pad) | Draw kanji strokes |
| 1–8 | Pick element (shows its ghost guide) |
| Space / CAST | Cast now |
| C | Clear strokes |
| WASD / arrows | Move the painter, dodge attacks |
| P / Esc | Pause · M mute · H help |

## Run it

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

No build step, no network requests, no libraries — vanilla JS + canvas 2D, all art drawn in code. The canvas renders at 2x supersampling (2048×1152 backing store for the 1024×576 view) so strokes and sprites stay crisp; the art uses sumi-e techniques throughout — gradient washes with no hard outlines, ink-bleed halos under brush strokes, tarashikomi ink pools, splatter, and a fibre-grained rice-paper background. Spell impacts are element-flavoured particles: rising embers, streaking droplets, four-point sparks, tumbling shards, ice crystals, light rays, drifting wisps, fluttering leaves. `tests/smoke.mjs` is the Playwright smoke test (loads the game, draws a real fire spell, fuses a Firestorm, walks every screen including the tutorial lesson, reaches victory and defeat, checks localStorage).

## Layout

- `game/index.html` + `game/src/*.js` — the game (config, strokes, audio, particles, storage, sprites, combat, screens, shots, ranks, main)
- `screenshots/` — 4 real renders of the game (see `shots.json` for the staging queries)
- `main.ts` — hands the game in: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's library, unchanged

## License

MIT — see `LICENSE`.
