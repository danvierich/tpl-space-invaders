# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A standalone Space Invaders game built for the THEPEAKLAB 404 error page. Three files, no build step, no dependencies beyond a Google Fonts CDN import.

Open `index.html` directly in a browser to run the game.

## Architecture

| File | Role |
|---|---|
| `index.html` | Shell: HUD markup (brand, lives, score), canvas wrapper, overlay, mobile control buttons |
| `style.css` | Layout and theming. HUD sits outside the canvas in HTML; the canvas is 520×580 px fixed, scaled via CSS on mobile |
| `game.js` | All game logic in a single IIFE. No frameworks, no modules |

### game.js structure (top to bottom)
1. **Constants** – canvas dimensions, invader grid geometry, speeds, colors
2. **State variables** – mutable game state (score, lives, invaders array, bullets, timers)
3. **`reset()`** – reinitialises all state and calls `createInvaders()`
4. **Draw functions** – `drawInvader`, `drawPlayer`, `drawBullets`, `drawInvBullets`, `draw`
5. **Update functions** – `updatePlayer`, `updateBullets`, `updateInvaders`, `updateInvaderShoot`, `checkCollisions`
6. **Game-state transitions** – `endGame('over'|'won')`, `startPlaying`, `shoot`
7. **Input handlers** – keyboard (`keydown`/`keyup`) and mobile touch/mouse buttons
8. **Boot** – calls `reset()`, draws initial frame, shows start overlay

### Key design decisions
- **Triangle invaders**: every invader uses the same right-triangle shape (see `single.png`): bounding box is square, right angle at bottom-right, hypotenuse from top-right → bottom-left. Vertices: `(x+W, y)`, `(x+W, y+H)`, `(x, y+H)`.
- **Triangle collision**: uses a dot-product test against the hypotenuse normal `(INV_H, INV_W)` so bullets must hit the filled triangle area, not the empty upper-left corner.
- **Invader speed**: `moveInterval()` scales linearly with the fraction of invaders still alive, reaching a minimum of 60 ms when almost all are destroyed.
- **HUD is HTML, not canvas**: score and lives are DOM elements updated via `updateHUD()`, keeping rendering concerns separate.
- **Overlay** (`#overlay`) is an absolutely-positioned div over the canvas, toggled with the `.hidden` class, reused for start / game-over / victory screens.

## Visual style
Defined by `space-invaders.png` (kept in repo as reference):
- Background: `#ffffff`
- Invader / hearts: `#f77d7d` (coral)
- Player ship body: `#5a7ef0` (blue), caps: `#253ea0`
- Score text: `#5a7ef0`
- Font: *Press Start 2P* (Google Fonts)
