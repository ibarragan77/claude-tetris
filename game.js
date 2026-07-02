'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // N - nut (steel grey)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - nut (hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const overlayControls = document.getElementById('overlay-controls');
const startLevelSelect = document.getElementById('start-level-select');
const themeSwitch = document.getElementById('theme-switch');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const recordsList = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeSwitch.checked = theme === 'light';
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeSwitch.addEventListener('change', () => {
  const theme = themeSwitch.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

initTheme();

// ---- Visual skins ----
const SKIN_KEY = 'tetris-skin';

const SKINS = {
  // Reuses COLORS by reference so the retro skin is guaranteed pixel-identical
  // to the original, unskinned rendering.
  retro: { colors: COLORS },
  neon: {
    colors: [
      null,
      '#00fff2', '#faff00', '#ff00e6', '#00ff6a',
      '#ff003c', '#00aaff', '#ff8c00', '#c8c8ff',
    ],
  },
  pastel: {
    colors: [
      null,
      '#a8e0e8', '#fff3b8', '#dcb8ec', '#b8ecc4',
      '#f5b8ba', '#b8cdf5', '#f7d2a8', '#c9d3d8',
    ],
  },
  pixel: {
    colors: [
      null,
      '#26c6da', '#fdd835', '#ab47bc', '#66bb6a',
      '#ef5350', '#5c93e6', '#ffa726', '#78909c',
    ],
  },
};

let currentSkin = 'retro';

function getSkinColors() {
  return (SKINS[currentSkin] || SKINS.retro).colors;
}

function applySkin(skin) {
  currentSkin = Object.prototype.hasOwnProperty.call(SKINS, skin) ? skin : 'retro';
  skinSelect.value = currentSkin;
  document.body.setAttribute('data-skin', currentSkin);
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved);
}

skinSelect.addEventListener('change', () => {
  const skin = skinSelect.value;
  localStorage.setItem(SKIN_KEY, skin);
  applySkin(skin);
  // Board/pieces may not exist yet if this fires before the first init(),
  // but the change event can only occur after the page (and init()) has
  // loaded, so a re-render here is always safe.
  draw();
  drawNext();
});

initSkin();

/* ---- High scores / records ---- */
const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';
const MAX_HIGHSCORES = 5;
const DEFAULT_NAME = 'AAA';

// localStorage can throw (quota exceeded, private-mode restrictions, blocked
// by user settings); reads/writes are best-effort and never block gameplay.
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore write failures */
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore removal failures */
  }
}

function getHighScores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  safeSetItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function qualifiesForHighScore(scoreValue) {
  const list = getHighScores();
  if (list.length < MAX_HIGHSCORES) return true;
  return scoreValue > list[list.length - 1].score;
}

// Inserts { name, score } if it qualifies for the top MAX_HIGHSCORES.
// Returns { qualifies, rank } where rank is the zero-based index it landed at.
function tryInsertHighScore(name, scoreValue) {
  if (!qualifiesForHighScore(scoreValue)) return { qualifies: false, rank: -1 };
  const list = getHighScores();
  const entry = { name, score: scoreValue };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_HIGHSCORES);
  const rank = trimmed.indexOf(entry);
  if (rank === -1) return { qualifies: false, rank: -1 };
  saveHighScores(trimmed);
  return { qualifies: true, rank };
}

function getRecordNumber(key) {
  return Number(localStorage.getItem(key)) || 0;
}

function updateRecordNumber(key, value) {
  if (value > getRecordNumber(key)) safeSetItem(key, String(value));
}

function getBestCombo() {
  return getRecordNumber(BEST_COMBO_KEY);
}

function getMaxLinesRecord() {
  return getRecordNumber(MAX_LINES_KEY);
}

function updateBestCombo(value) {
  updateRecordNumber(BEST_COMBO_KEY, value);
}

function updateMaxLinesRecord(value) {
  updateRecordNumber(MAX_LINES_KEY, value);
}

function renderRecords(highlightRank) {
  const list = getHighScores();
  recordsList.innerHTML = '';
  for (let i = 0; i < MAX_HIGHSCORES; i++) {
    const entry = list[i];
    const row = document.createElement('div');
    row.className = 'record-row';
    if (i === highlightRank) row.classList.add('is-new-highscore');
    const rank = document.createElement('span');
    rank.className = 'record-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'record-name';
    name.textContent = entry ? entry.name : '---';
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'record-score';
    scoreSpan.textContent = entry ? entry.score.toLocaleString() : '-';
    row.append(rank, name, scoreSpan);
    recordsList.appendChild(row);
  }
  bestComboEl.textContent = getBestCombo();
  maxLinesEl.textContent = getMaxLinesRecord();
}

function resetRecords() {
  safeRemoveItem(HIGHSCORES_KEY);
  safeRemoveItem(BEST_COMBO_KEY);
  safeRemoveItem(MAX_LINES_KEY);
  renderRecords();
}

function saveScoreEntry() {
  const raw = (nameInput.value || '').trim().toUpperCase().slice(0, 10);
  const name = raw || DEFAULT_NAME;
  const result = tryInsertHighScore(name, score);
  nameEntry.classList.add('hidden');
  renderRecords(result.qualifies ? result.rank : -1);
}

nameInput.placeholder = DEFAULT_NAME;
saveScoreBtn.addEventListener('click', saveScoreEntry);
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveScoreEntry();
});
resetRecordsBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar todos los récords?')) resetRecords();
});

renderRecords();

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, maxCombo;
let startLevel = 1;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeonBlock(context, px, py, size, color) {
  context.shadowBlur = 12;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.shadowBlur = 0;
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.2)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawPastelBlock(context, px, py, size, color) {
  const x0 = px + 1, y0 = py + 1, w = size - 2, h = size - 2;
  const r = Math.min(6, w / 2, h / 2);
  roundedRectPath(context, x0, y0, w, h, r);
  context.fillStyle = color;
  context.fill();
  // highlight, clipped to the rounded shape so it doesn't poke past the corners
  context.save();
  roundedRectPath(context, x0, y0, w, h, r);
  context.clip();
  context.fillStyle = 'rgba(255,255,255,0.3)';
  context.fillRect(x0, y0, w, 4);
  context.restore();
}

function drawPixelBlock(context, px, py, size, color) {
  const x0 = px + 1, y0 = py + 1, w = size - 2, h = size - 2;
  context.fillStyle = color;
  context.fillRect(x0, y0, w, h);
  // dithered checker texture layered on top
  const cell = Math.max(4, Math.floor(size / 4));
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let yy = y0, row = 0; yy < y0 + h; yy += cell, row++) {
    for (let xx = x0, col = 0; xx < x0 + w; xx += cell, col++) {
      if ((row + col) % 2 === 0) {
        context.fillRect(xx, yy, Math.min(cell, x0 + w - xx), Math.min(cell, y0 + h - yy));
      }
    }
  }
  context.fillStyle = 'rgba(255,255,255,0.15)';
  for (let yy = y0, row = 0; yy < y0 + h; yy += cell, row++) {
    for (let xx = x0, col = 0; xx < x0 + w; xx += cell, col++) {
      if ((row + col) % 2 !== 0) {
        context.fillRect(xx, yy, Math.min(cell, x0 + w - xx), Math.min(cell, y0 + h - yy));
      }
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const colors = getSkinColors();
  const color = colors[colorIndex] || COLORS[colorIndex];
  const px = x * size;
  const py = y * size;
  context.save();
  context.globalAlpha = alpha ?? 1;
  switch (currentSkin) {
    case 'neon':
      drawNeonBlock(context, px, py, size, color);
      break;
    case 'pastel':
      drawPastelBlock(context, px, py, size, color);
      break;
    case 'pixel':
      drawPixelBlock(context, px, py, size, color);
      break;
    default:
      drawRetroBlock(context, px, py, size, color);
      break;
  }
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateBestCombo(maxCombo);
  updateMaxLinesRecord(lines);
  renderRecords();
  overlay.classList.remove('mode-pause');
  overlay.classList.add('mode-gameover');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  if (qualifiesForHighScore(score)) {
    nameInput.value = '';
    nameEntry.classList.remove('hidden');
    setTimeout(() => nameInput.focus(), 0);
  } else {
    nameEntry.classList.add('hidden');
  }
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlay.classList.remove('mode-gameover');
    overlay.classList.add('mode-pause');
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  combo = 0;
  maxCombo = 0;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  overlay.classList.remove('mode-pause', 'mode-gameover');
  overlayControls.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  // If a qualifying score is still awaiting a name, save it (with whatever
  // name was typed, defaulting to DEFAULT_NAME) instead of silently losing it.
  if (!nameEntry.classList.contains('hidden')) saveScoreEntry();
  init();
});
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
toggleControlsBtn.addEventListener('click', () => {
  overlayControls.classList.toggle('hidden');
});
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10) || 1;
});

init();
