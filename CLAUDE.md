# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step, no dependencies. Open `index.html` directly or serve it with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Architecture

Three files, no framework:

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600 px) for the playfield, `<canvas id="next-canvas">` (120×120 px) for the preview, a side panel with score/lines/level displays, and an overlay div reused for both PAUSE and GAME OVER states.
- **`style.css`** — Dark/retro aesthetic. The overlay uses `backdrop-filter: blur` and is shown/hidden by toggling the `.hidden` class.
- **`game.js`** — All game logic in a single `'use strict'` file (~305 lines). No modules, no classes; plain functions and module-level variables.

### game.js internals

**State** — a handful of module-level `let` variables: `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`.

**Board** — `ROWS × COLS` array of numbers. `0` = empty; `1–7` = piece type (indexes into `COLORS` and `PIECES`).

**Pieces** — defined as 2D number matrices in `PIECES[]`. Clockwise rotation is computed as transpose + row-reverse (`rotateCW`). Wall kicks try column offsets `[0, -1, 1, -2, 2]` in `tryRotate`.

**Game loop** — `requestAnimationFrame`-based. `loop(ts)` accumulates elapsed time in `dropAccum`; when it exceeds `dropInterval` the piece drops one row or gets locked. Speed formula: `max(100, 1000 − (level−1) × 90)` ms per row.

**Piece locking** — `lockPiece()` calls `merge()` → `clearLines()` → `spawn()`. `clearLines` walks the board bottom-up, splices full rows out and unshifts an empty row at the top.

**Ghost piece** — `ghostY()` projects `current` straight down until collision; drawn with `globalAlpha = 0.2`.

**Scoring** — classic table `[0, 100, 300, 500, 800]` × level for line clears; +2 per row for hard drop, +1 per row for soft drop.

### Key tunable constants (top of `game.js`)

| Constant | Default | Effect |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | Board dimensions — also update canvas `width`/`height` in `index.html` |
| `BLOCK` | 30 | Pixel size per cell |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points per 1–4 line clear |