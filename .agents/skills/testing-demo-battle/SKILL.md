---
name: testing-demo-battle
description: How to exercise the ChainStrat Phaser BattleScene end-to-end without a wallet — demoBattle URL, deterministic seed control, and on-page FX instrumentation when CDP is unavailable.
---

# Testing ChainStrat battle playback without a wallet

## Entry point
- `http://localhost:5173/?demoBattle=1` renders `DemoBattle` → `buildDemoMatch()` → `PhaserGame` with the full `BattleScene`. No wallet, worker, or chain access needed.
- `pnpm dev:web` (vite only) suffices; `pnpm dev` also starts wrangler on :8787 which the demo never calls.
- **`.env` is required even for the demo path**: `src/wagmi.ts` throws at module load if `VITE_WC_PROJECT_ID` is unset. `cp .env.example .env` (the `demo` placeholder works).

## Demo battle facts
- Default matchup is hardcoded in `src/lib/demoMatch.ts`: **warrior vs assassin**. Seed is picked by `pickSeed()` (first seed 1–399 with a crit + death + duration ≥ 8s; otherwise fallback 17).
- The default matchup has **no execute skill** — `blademaster.execution` is the only `motion: 'execute'` skill (see `src/lib/visuals.ts` `SKILL_LOOK`). To see execute FX (ANTICIPATE_EXEC, 终结一击 stamp, execute hit-stop), temporarily override the demo heroes/combos — e.g. add `?a`/`?b`/`?seed` URL-param plumbing to `buildDemoMatch` (revert afterward).
- Useful matchups (verified): `necromancer vs blademaster` seed 17 → exec cast @2.0s/9.5s, exec dmg 105 @2.6s, exec dmg 300 **kill** @10.1s (~10s battle). `guardian vs ranger` seed 17 → 60s timeout, zero highlights (pure control for "no FX on normal hits").
- The **再看一场** button remounts `PhaserGame` — same deterministic battle replays (same seed), cheap re-runs.

## Deterministic seed scanning
- `simulateBattle(heroA, comboA, heroB, comboB, seed)` in `src/lib/combat.ts` is pure — scan seeds offline in a temp vitest file (`src/lib/x.test.ts`, run `pnpm vitest run`).
- **vitest swallows console.log** in this config — write scan output to a file with `node:fs` `writeFileSync` instead of relying on stdout.

## Inspecting FX without devtools/CDP
- `browser_console` may fail with "Could not connect to Chrome via CDP" when Chrome wasn't launched with a debug port. Workaround: temporary instrumentation that renders state into the page — e.g. in `BattleScene.create()` append a fixed `<pre>` overlay (`window.__fxlog` + camera `midPoint.x`/`zoom`/`tweens.timeScale` each frame) and a `window.addEventListener('error')` hook that pushes `ERR ...` lines into the log. The overlay is readable in screenshots/recordings and doubles as a console-error detector.
- Camera assertions: at rest `scrollX=0`, `midPoint.x=480` (canvas 960×540, actors at x≈230/730); `blendFocus` pans to ≈333–343 (left actor) / ≈601–617 (right actor); `tweens.timeScale` is 0.8 at rest, 0.03 during hit-stop, `pulse.scale×0.8` during slow-mo.

## Recording evidence for short-lived FX
- Hit-stops (90–170ms) and stamps (~1.1s) are hard to screenshot live — record at 60fps and extract frames after: `ffmpeg -ss <t> -i raw-XXX.mkv -vf fps=8 out%03d.png`. Recordings are segmented (`*-raw-000.mkv` etc.); scan at `fps=1` + `tile=5x4` to locate a segment/battle quickly, then re-extract the window at higher fps.
