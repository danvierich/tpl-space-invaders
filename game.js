'use strict';

(function () {

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas setup
  // ─────────────────────────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  const W = 520;
  const H = 580;
  canvas.width  = W;
  canvas.height = H;

  // ─────────────────────────────────────────────────────────────────────────
  // Colors  (matches reference image palette)
  // ─────────────────────────────────────────────────────────────────────────
  const COLOR = {
    bg:         '#ffffff',
    invader:    '#f77d7d',   // coral / salmon
    player:     '#5a7ef0',   // blue paddle body
    playerCap:  '#253ea0',   // darker cap dots
    bullet:     '#1a1a2e',   // player bullet (dark)
    invBullet:  '#f77d7d',   // invader bullet (coral)
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Game constants
  // ─────────────────────────────────────────────────────────────────────────
  const INV_COLS        = 11;
  const INV_ROWS        = 5;
  const INV_W           = 36;
  const INV_H           = 30;
  const INV_GAP_X       = 8;
  const INV_GAP_Y       = 8;
  const INV_TOTAL_W     = INV_COLS * INV_W + (INV_COLS - 1) * INV_GAP_X;
  const INV_START_X     = Math.round((W - INV_TOTAL_W) / 2);
  const INV_START_Y     = 60;
  const INV_STEP        = 8;      // px per move tick (horizontal)
  const INV_DROP        = 24;     // px drop on direction change
  const INV_BASE_MS     = 800;    // ms between moves at full population

  const PLAYER_W        = 66;
  const PLAYER_H        = 14;
  const PLAYER_SPEED    = 5;
  const PLAYER_Y        = H - 50;

  const BULLET_R        = 4;      // player bullet radius
  const BULLET_SPEED    = 9;
  const MAX_P_BULLETS   = 2;

  const INV_B_W         = 4;      // invader bullet width
  const INV_B_H         = 10;     // invader bullet height
  const INV_B_SPEED     = 4;
  const MAX_INV_BULLETS = 3;

  const INV_SHOOT_MIN   = 500;    // ms
  const INV_SHOOT_MAX   = 1600;

  const MAX_LIVES       = 3;
  const POINTS          = 10;
  const HIT_FLASH_MS    = 600;

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  let invaders   = [];
  let player     = {};
  let bullets    = [];
  let invBullets = [];

  let score         = 0;
  let lives         = MAX_LIVES;
  let invDirX       = 1;
  let invMoveTimer  = 0;
  let invShootTimer = 0;
  let nextShootIn   = 1000;
  let hitFlash      = 0;
  let gameState     = 'start';  // 'start' | 'playing' | 'over' | 'won'
  let lastTime      = 0;
  let animFrame     = null;
  let pCanShoot     = true;

  const keys       = {};
  const mobileKeys = { left: false, right: false };

  // ─────────────────────────────────────────────────────────────────────────
  // Init / reset
  // ─────────────────────────────────────────────────────────────────────────
  function reset() {
    score         = 0;
    lives         = MAX_LIVES;
    invDirX       = 1;
    invMoveTimer  = 0;
    invShootTimer = 0;
    nextShootIn   = rand(INV_SHOOT_MIN, INV_SHOOT_MAX);
    hitFlash      = 0;
    bullets       = [];
    invBullets    = [];
    pCanShoot     = true;

    player = { x: W / 2 - PLAYER_W / 2, y: PLAYER_Y };

    createInvaders();
    updateHUD();
  }

  function createInvaders() {
    invaders = [];
    for (let row = 0; row < INV_ROWS; row++) {
      for (let col = 0; col < INV_COLS; col++) {
        invaders.push({
          x:     INV_START_X + col * (INV_W + INV_GAP_X),
          y:     INV_START_Y + row * (INV_H + INV_GAP_Y),
          alive: true,
          col,
          row,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  function rand(a, b) { return a + Math.random() * (b - a); }

  function alive() { return invaders.filter(i => i.alive); }

  function invBounds() {
    const a = alive();
    if (!a.length) return null;
    return {
      minX: Math.min(...a.map(i => i.x)),
      maxX: Math.max(...a.map(i => i.x + INV_W)),
      maxY: Math.max(...a.map(i => i.y + INV_H)),
    };
  }

  function moveInterval() {
    const ratio = alive().length / (INV_COLS * INV_ROWS);
    return Math.max(60, INV_BASE_MS * ratio);
  }

  // Precise triangle hit-test for player bullets
  // Triangle vertices: top-right (x+W, y), bottom-right (x+W, y+H), bottom-left (x, y+H)
  // Hypotenuse runs from top-right → bottom-left
  // A point is inside if it lies on the bottom-right side of that hypotenuse
  function bulletHitsInvader(bx, by, inv) {
    const { x, y } = inv;
    if (bx < x || bx > x + INV_W || by < y || by > y + INV_H) return false;
    // Normal of hypotenuse pointing inward: (INV_H, INV_W)
    // Dot with (point − top-right vertex) ≥ 0 means inside
    return INV_H * (bx - (x + INV_W)) + INV_W * (by - y) >= 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Drawing
  // ─────────────────────────────────────────────────────────────────────────
  function drawInvader(inv) {
    // Right triangle: right-angle at bottom-right, hypotenuse from top-right → bottom-left
    // Matches single.png: square bounding box, staircase descends left-to-right
    ctx.fillStyle = COLOR.invader;
    ctx.beginPath();
    const { x, y } = inv;
    ctx.moveTo(x + INV_W, y);          // top-right
    ctx.lineTo(x + INV_W, y + INV_H);  // bottom-right
    ctx.lineTo(x,         y + INV_H);  // bottom-left
    ctx.closePath();
    ctx.fill();
  }

  function drawPlayer() {
    // Flash on hit
    if (hitFlash > 0 && Math.floor(hitFlash / 80) % 2 === 1) return;

    const { x, y } = player;
    const capR = Math.floor(PLAYER_H / 2);

    // Main body
    ctx.fillStyle = COLOR.player;
    ctx.beginPath();
    roundRect(ctx, x, y, PLAYER_W, PLAYER_H, 3);
    ctx.fill();

    // End caps (darker circles matching reference image)
    ctx.fillStyle = COLOR.playerCap;
    ctx.beginPath();
    ctx.arc(x + capR, y + PLAYER_H / 2, capR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + PLAYER_W - capR, y + PLAYER_H / 2, capR, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBullets() {
    ctx.fillStyle = COLOR.bullet;
    bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawInvBullets() {
    ctx.fillStyle = COLOR.invBullet;
    invBullets.forEach(b => {
      ctx.fillRect(b.x - INV_B_W / 2, b.y - INV_B_H / 2, INV_B_W, INV_B_H);
    });
  }

  function draw() {
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, W, H);
    invaders.forEach(inv => { if (inv.alive) drawInvader(inv); });
    drawPlayer();
    drawBullets();
    drawInvBullets();
  }

  // Polyfill-safe roundRect
  function roundRect(c, x, y, w, h, r) {
    if (typeof c.roundRect === 'function') {
      c.roundRect(x, y, w, h, r);
    } else {
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sound  (Web Audio API – only active after game start)
  // ─────────────────────────────────────────────────────────────────────────
  let audioCtx  = null;
  let soundOn   = false;   // stays false until first startPlaying()
  let marchStep = 0;

  // Classic 4-step invader march frequencies (low square-wave tones)
  const MARCH = [160, 130, 100, 130];

  function ac() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function tone(freq, type, dur, vol = 0.25, delay = 0) {
    if (!soundOn) return;
    try {
      const a   = ac();
      const osc = a.createOscillator();
      const g   = a.createGain();
      osc.connect(g);
      g.connect(a.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, a.currentTime + delay);
      g.gain.setValueAtTime(vol, a.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + delay + dur);
      osc.start(a.currentTime + delay);
      osc.stop(a.currentTime + delay + dur + 0.01);
    } catch (_) {}
  }

  function noise(dur, vol = 0.25) {
    if (!soundOn) return;
    try {
      const a      = ac();
      const frames = Math.ceil(a.sampleRate * dur);
      const buf    = a.createBuffer(1, frames, a.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource();
      src.buffer = buf;
      const g = a.createGain();
      src.connect(g);
      g.connect(a.destination);
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      src.start();
      src.stop(a.currentTime + dur + 0.01);
    } catch (_) {}
  }

  function sndShoot()      { tone(880, 'square',   0.07, 0.20);
                             tone(550, 'square',   0.07, 0.12, 0.05); }
  function sndInvaderHit() { noise(0.12, 0.35); }
  function sndPlayerHit()  { noise(0.40, 0.45); }
  function sndMarch()      { tone(MARCH[marchStep++ % 4], 'square', 0.055, 0.28); }
  function sndGameOver()   { [440, 330, 220, 110].forEach((f, i) =>
                               tone(f, 'sawtooth', 0.30, 0.35, i * 0.32)); }
  function sndVictory()    { [523, 659, 784, 1047].forEach((f, i) =>
                               tone(f, 'square',   0.18, 0.28, i * 0.14)); }

  // ─────────────────────────────────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('score').textContent = String(score).padStart(7, '0');

    const el = document.getElementById('hearts');
    el.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const s = document.createElement('span');
      s.textContent = '♥';
      s.className   = i < lives ? 'heart-active' : 'heart-empty';
      el.appendChild(s);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Overlay
  // ─────────────────────────────────────────────────────────────────────────
  function showOverlay(title, sub, prompt) {
    document.getElementById('ol-title').textContent  = title;
    document.getElementById('ol-sub').textContent    = sub;
    document.getElementById('ol-prompt').textContent = prompt;
    document.getElementById('overlay').classList.remove('hidden');
  }

  function hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update logic
  // ─────────────────────────────────────────────────────────────────────────
  function updatePlayer() {
    if (keys['ArrowLeft']  || keys['KeyA'] || mobileKeys.left)
      player.x = Math.max(0, player.x - PLAYER_SPEED);
    if (keys['ArrowRight'] || keys['KeyD'] || mobileKeys.right)
      player.x = Math.min(W - PLAYER_W, player.x + PLAYER_SPEED);
  }

  function updateBullets() {
    bullets    = bullets.filter(b => { b.y -= BULLET_SPEED;  return b.y > -BULLET_R; });
    invBullets = invBullets.filter(b => { b.y += INV_B_SPEED; return b.y < H + INV_B_H; });
  }

  function updateInvaders(dt) {
    invMoveTimer += dt;
    if (invMoveTimer < moveInterval()) return;
    invMoveTimer = 0;

    const b = invBounds();
    if (!b) return;

    let drop = false;
    if (invDirX ===  1 && b.maxX + INV_STEP > W) { invDirX = -1; drop = true; }
    if (invDirX === -1 && b.minX - INV_STEP < 0) { invDirX =  1; drop = true; }

    invaders.forEach(inv => {
      if (!inv.alive) return;
      if (drop) inv.y += INV_DROP;
      else      inv.x += INV_STEP * invDirX;
    });

    sndMarch();

    // Invaders reached player line → game over
    const b2 = invBounds();
    if (b2 && b2.maxY >= PLAYER_Y) { endGame('over'); }
  }

  function updateInvaderShoot(dt) {
    invShootTimer += dt;
    if (invShootTimer < nextShootIn) return;
    invShootTimer = 0;
    nextShootIn   = rand(INV_SHOOT_MIN, INV_SHOOT_MAX);

    if (invBullets.length >= MAX_INV_BULLETS) return;

    // Bottom-most invader per column
    const bottoms = {};
    alive().forEach(inv => {
      if (!bottoms[inv.col] || inv.y > bottoms[inv.col].y) bottoms[inv.col] = inv;
    });
    const pool = Object.values(bottoms);
    if (!pool.length) return;

    const shooter = pool[Math.floor(Math.random() * pool.length)];
    invBullets.push({ x: shooter.x + INV_W / 2, y: shooter.y + INV_H });
  }

  function checkCollisions() {
    // Player bullets vs invaders
    bullets = bullets.filter(b => {
      for (const inv of invaders) {
        if (!inv.alive) continue;
        if (bulletHitsInvader(b.x, b.y, inv)) {
          inv.alive = false;
          score    += POINTS;
          updateHUD();
          sndInvaderHit();
          return false;
        }
      }
      return true;
    });

    // Invader bullets vs player
    invBullets = invBullets.filter(b => {
      if (b.x >= player.x - 2 && b.x <= player.x + PLAYER_W + 2 &&
          b.y >= player.y - 2 && b.y <= player.y + PLAYER_H + 2) {
        lives--;
        updateHUD();
        hitFlash = HIT_FLASH_MS;
        sndPlayerHit();
        if (lives <= 0) endGame('over');
        return false;
      }
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Game states
  // ─────────────────────────────────────────────────────────────────────────
  function endGame(type) {
    gameState = type;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    draw();

    if (type === 'won') {
      sndVictory();
      showOverlay('YOU WIN!', 'SCORE: ' + String(score).padStart(7, '0'), 'PRESS SPACE TO PLAY AGAIN');
    } else {
      sndGameOver();
      showOverlay('GAME OVER', '', 'PRESS SPACE TO RETRY');
    }
  }

  function startPlaying() {
    soundOn   = true;   // unmute – only from here on
    marchStep = 0;
    hideOverlay();
    gameState = 'playing';
    lastTime  = performance.now();
    animFrame = requestAnimationFrame(loop);
  }

  function shoot() {
    if (!pCanShoot || bullets.length >= MAX_P_BULLETS) return;
    bullets.push({ x: player.x + PLAYER_W / 2, y: player.y });
    pCanShoot = false;
    sndShoot();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main loop
  // ─────────────────────────────────────────────────────────────────────────
  function loop(ts) {
    const dt = Math.min(ts - lastTime, 50);
    lastTime  = ts;

    updatePlayer();
    updateBullets();
    updateInvaders(dt);
    updateInvaderShoot(dt);
    checkCollisions();

    if (hitFlash > 0) hitFlash -= dt;

    if (gameState === 'playing' && alive().length === 0) {
      endGame('won');
      return;
    }

    if (gameState !== 'playing') return;

    draw();
    animFrame = requestAnimationFrame(loop);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Input – keyboard
  // ─────────────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    keys[e.code] = true;

    if (e.code === 'Space') {
      e.preventDefault();
      if (gameState !== 'playing') {
        reset();
        startPlaying();
      } else {
        shoot();
      }
    }
  });

  document.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Space') pCanShoot = true;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Input – mobile buttons
  // ─────────────────────────────────────────────────────────────────────────
  function bindMoveBtn(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;

    const press = (e) => {
      e.preventDefault();
      if (gameState !== 'playing') { reset(); startPlaying(); return; }
      mobileKeys[key] = true;
    };
    const release = (e) => {
      e.preventDefault();
      mobileKeys[key] = false;
    };

    btn.addEventListener('touchstart', press,   { passive: false });
    btn.addEventListener('touchend',   release, { passive: false });
    btn.addEventListener('touchcancel',release, { passive: false });
    btn.addEventListener('mousedown',  press);
    btn.addEventListener('mouseup',    release);
    btn.addEventListener('mouseleave', release);
  }

  bindMoveBtn('btn-left',  'left');
  bindMoveBtn('btn-right', 'right');

  const fireBtn = document.getElementById('btn-shoot');
  if (fireBtn) {
    const firePress = (e) => {
      e.preventDefault();
      if (gameState !== 'playing') { reset(); startPlaying(); return; }
      pCanShoot = true;
      shoot();
    };
    fireBtn.addEventListener('touchstart', firePress, { passive: false });
    fireBtn.addEventListener('click',      firePress);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────────────────────────────────
  reset();
  draw();
  showOverlay('404', 'PAGE NOT FOUND', 'PRESS SPACE TO PLAY');

})();
