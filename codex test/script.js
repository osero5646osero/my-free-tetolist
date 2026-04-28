const canvas = document.getElementById("game");
const context = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const linesElement = document.getElementById("lines");
const levelElement = document.getElementById("level");
const statusElement = document.getElementById("status");
const toggleButton = document.getElementById("toggleButton");
const scoreHistoryElement = document.getElementById("scoreHistory");

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const EMPTY = 0;
const SCORE_STORAGE_KEY = "mini-tetris-top-scores";

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

context.scale(BLOCK_SIZE, BLOCK_SIZE);
context.imageSmoothingEnabled = false;

const colors = {
  0: "#0f172a",
  I: "#38bdf8",
  J: "#818cf8",
  L: "#fb923c",
  O: "#facc15",
  S: "#4ade80",
  T: "#f472b6",
  Z: "#f87171",
};

const blockPalette = {
  I: { base: "#38bdf8", highlight: "#d7f4ff", shadow: "#0f6d93" },
  J: { base: "#818cf8", highlight: "#e0e7ff", shadow: "#3730a3" },
  L: { base: "#fb923c", highlight: "#ffedd5", shadow: "#c2410c" },
  O: { base: "#facc15", highlight: "#fef9c3", shadow: "#ca8a04" },
  S: { base: "#4ade80", highlight: "#dcfce7", shadow: "#15803d" },
  T: { base: "#f472b6", highlight: "#fce7f3", shadow: "#be185d" },
  Z: { base: "#f87171", highlight: "#fee2e2", shadow: "#b91c1c" },
};

const shapes = {
  I: [
    [0, 0, 0, 0],
    ["I", "I", "I", "I"],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    ["J", 0, 0],
    ["J", "J", "J"],
    [0, 0, 0],
  ],
  L: [
    [0, 0, "L"],
    ["L", "L", "L"],
    [0, 0, 0],
  ],
  O: [
    ["O", "O"],
    ["O", "O"],
  ],
  S: [
    [0, "S", "S"],
    ["S", "S", 0],
    [0, 0, 0],
  ],
  T: [
    [0, "T", 0],
    ["T", "T", "T"],
    [0, 0, 0],
  ],
  Z: [
    ["Z", "Z", 0],
    [0, "Z", "Z"],
    [0, 0, 0],
  ],
};

const state = {
  board: createBoard(),
  piece: null,
  score: 0,
  lines: 0,
  level: 1,
  dropCounter: 0,
  dropInterval: 800,
  lastTime: 0,
  animationId: 0,
  isRunning: false,
  isPaused: false,
  isGameOver: false,
  effects: [],
  topScores: loadTopScores(),
  hasSavedScore: false,
};

const touchState = {
  startX: 0,
  startY: 0,
  active: false,
  lastTapTime: 0,
};

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function randomPiece() {
  const keys = Object.keys(shapes);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const matrix = cloneMatrix(shapes[type]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  };
}

function resetGame() {
  state.board = createBoard();
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.dropCounter = 0;
  state.dropInterval = 800;
  state.lastTime = 0;
  state.isPaused = false;
  state.isGameOver = false;
  state.effects = [];
  state.hasSavedScore = false;
  state.piece = randomPiece();
  syncHud();
  setStatus("Playing");
}

function startGame() {
  resetGame();
  state.isRunning = true;
  toggleButton.textContent = "Restart Game";
  cancelAnimationFrame(state.animationId);
  state.animationId = requestAnimationFrame(update);
}

function togglePause() {
  if (!state.isRunning || state.isGameOver) {
    return;
  }

  state.isPaused = !state.isPaused;
  setStatus(state.isPaused ? "Paused" : "Playing");
  if (!state.isPaused) {
    state.lastTime = 0;
    state.animationId = requestAnimationFrame(update);
  }
}

function setStatus(text) {
  statusElement.textContent = text;
}

function syncHud() {
  scoreElement.textContent = state.score;
  linesElement.textContent = state.lines;
  levelElement.textContent = state.level;
}

function loadTopScores() {
  try {
    const raw = window.localStorage.getItem(SCORE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.slice(0, 5);
  } catch {
    return [];
  }
}

function persistTopScores() {
  try {
    window.localStorage.setItem(
      SCORE_STORAGE_KEY,
      JSON.stringify(state.topScores.slice(0, 5)),
    );
  } catch {
    // Ignore storage failures and keep the game playable.
  }
}

function renderTopScores() {
  if (!scoreHistoryElement) {
    return;
  }

  if (state.topScores.length === 0) {
    scoreHistoryElement.innerHTML = "<li>No scores yet</li>";
    return;
  }

  scoreHistoryElement.innerHTML = state.topScores
    .map(
      (entry) => `
        <li>
          <strong>${entry.score}</strong>
          <span class="meta">Lv ${entry.level}  Lines ${entry.lines}</span>
        </li>`,
    )
    .join("");
}

function saveScoreIfNeeded() {
  if (state.hasSavedScore || state.score <= 0) {
    return;
  }

  state.topScores = [
    ...state.topScores,
    {
      score: state.score,
      lines: state.lines,
      level: state.level,
      savedAt: Date.now(),
    },
  ]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.lines !== a.lines) {
        return b.lines - a.lines;
      }
      return b.level - a.level;
    })
    .slice(0, 5);

  state.hasSavedScore = true;
  persistTopScores();
  renderTopScores();
}

function collide(board, piece) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x]) {
        continue;
      }

      const boardY = y + piece.y;
      const boardX = x + piece.x;
      if (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        (boardY >= 0 && board[boardY][boardX] !== EMPTY)
      ) {
        return true;
      }
    }
  }
  return false;
}

function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        board[y + piece.y][x + piece.x] = value;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;
  const clearedRows = [];

  outer: for (let y = ROWS - 1; y >= 0; y -= 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (state.board[y][x] === EMPTY) {
        continue outer;
      }
    }

    clearedRows.push({
      y,
      values: [...state.board[y]],
    });
    const row = state.board.splice(y, 1)[0].fill(EMPTY);
    state.board.unshift(row);
    cleared += 1;
    y += 1;
  }

  if (cleared === 0) {
    return;
  }

  createLineClearEffects(clearedRows);
  const lineScores = [0, 100, 300, 500, 800];
  state.lines += cleared;
  state.score += lineScores[cleared] * state.level;
  state.level = Math.floor(state.lines / 10) + 1;
  state.dropInterval = Math.max(120, 800 - (state.level - 1) * 60);
  syncHud();
}

function createLineClearEffects(clearedRows) {
  clearedRows.forEach(({ y, values }) => {
    const anchor = values.find((value) => value !== EMPTY) || "I";
    const color = blockPalette[anchor].base;
    const glow = blockPalette[anchor].highlight;
    const sparks = values.flatMap((value, x) => {
      if (!value) {
        return [];
      }

      return [
        {
          x: x + 0.2 + Math.random() * 0.25,
          y: y + 0.3 + Math.random() * 0.25,
          dx: (Math.random() - 0.5) * 0.05,
          dy: -(0.03 + Math.random() * 0.05),
          size: 0.12 + Math.random() * 0.1,
          color: blockPalette[value].highlight,
        },
        {
          x: x + 0.55 + Math.random() * 0.15,
          y: y + 0.4 + Math.random() * 0.2,
          dx: (Math.random() - 0.5) * 0.08,
          dy: 0.01 + Math.random() * 0.04,
          size: 0.08 + Math.random() * 0.08,
          color: blockPalette[value].base,
        },
      ];
    });

    state.effects.push({
      type: "line-clear",
      y,
      age: 0,
      duration: 280,
      color,
      glow,
      sparks,
    });
  });
}

function spawnPiece() {
  state.piece = randomPiece();
  if (collide(state.board, state.piece)) {
    state.isGameOver = true;
    state.isRunning = false;
    setStatus("Game Over");
    toggleButton.textContent = "Play Again";
    saveScoreIfNeeded();
  }
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotatePiece() {
  if (!state.isRunning || state.isPaused || state.isGameOver) {
    return;
  }

  const originalX = state.piece.x;
  const rotated = rotateMatrix(state.piece.matrix);
  const kicks = [0, -1, 1, -2, 2];

  for (const offset of kicks) {
    state.piece.matrix = rotated;
    state.piece.x = originalX + offset;
    if (!collide(state.board, state.piece)) {
      return;
    }
  }

  state.piece.matrix = rotateMatrix(rotateMatrix(rotateMatrix(rotated)));
  state.piece.x = originalX;
}

function movePiece(offset) {
  if (!state.isRunning || state.isPaused || state.isGameOver) {
    return;
  }

  state.piece.x += offset;
  if (collide(state.board, state.piece)) {
    state.piece.x -= offset;
  }
}

function lockPiece() {
  merge(state.board, state.piece);
  clearLines();
  spawnPiece();
}

function softDrop() {
  if (!state.isRunning || state.isPaused || state.isGameOver) {
    return;
  }

  state.piece.y += 1;
  if (collide(state.board, state.piece)) {
    state.piece.y -= 1;
    lockPiece();
  }
  state.dropCounter = 0;
}

function hardDrop() {
  if (!state.isRunning || state.isPaused || state.isGameOver) {
    return;
  }

  while (!collide(state.board, state.piece)) {
    state.piece.y += 1;
  }
  state.piece.y -= 1;
  lockPiece();
  state.dropCounter = 0;
}

function drawCell(x, y, value, alpha = 1) {
  if (!value) {
    return;
  }

  const palette = blockPalette[value];
  context.globalAlpha = alpha;
  context.fillStyle = palette.base;
  context.fillRect(x, y, 1, 1);

  context.fillStyle = palette.highlight;
  context.fillRect(x + 0.08, y + 0.08, 0.78, 0.12);
  context.fillRect(x + 0.08, y + 0.08, 0.12, 0.78);

  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  context.fillRect(x + 0.24, y + 0.22, 0.34, 0.16);

  context.fillStyle = palette.shadow;
  context.fillRect(x + 0.12, y + 0.82, 0.76, 0.1);
  context.fillRect(x + 0.82, y + 0.12, 0.1, 0.76);

  context.strokeStyle = "rgba(8, 18, 33, 0.55)";
  context.lineWidth = 0.08;
  context.strokeRect(x + 0.04, y + 0.04, 0.92, 0.92);
  context.globalAlpha = 1;
}

function drawBoard() {
  context.fillStyle = colors[0];
  context.fillRect(0, 0, COLS, ROWS);

  state.board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(x, y, value);
      } else {
        context.strokeStyle = "rgba(148, 163, 184, 0.08)";
        context.strokeRect(x, y, 1, 1);
      }
    });
  });
}

function updateEffects(deltaTime) {
  state.effects = state.effects
    .map((effect) => {
      if (effect.type !== "line-clear") {
        return effect;
      }

      return {
        ...effect,
        age: effect.age + deltaTime,
        sparks: effect.sparks.map((spark) => ({
          ...spark,
          x: spark.x + spark.dx * deltaTime,
          y: spark.y + spark.dy * deltaTime,
        })),
      };
    })
    .filter((effect) => effect.age < effect.duration);
}

function drawEffects() {
  state.effects.forEach((effect) => {
    if (effect.type !== "line-clear") {
      return;
    }

    const progress = effect.age / effect.duration;
    const alpha = 1 - progress;
    const width = COLS * Math.min(1, progress * 1.7 + 0.15);
    const offsetX = (COLS - width) / 2;

    context.save();
    context.globalAlpha = alpha * 0.9;
    context.fillStyle = effect.color;
    context.fillRect(offsetX, effect.y + 0.18, width, 0.64);

    context.globalAlpha = alpha;
    context.fillStyle = effect.glow;
    context.fillRect(offsetX, effect.y + 0.34, width, 0.28);

    effect.sparks.forEach((spark) => {
      context.globalAlpha = alpha;
      context.fillStyle = spark.color;
      context.fillRect(spark.x, spark.y, spark.size, spark.size);
    });
    context.restore();
  });
}

function drawPiece(piece, alpha = 1) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(x + piece.x, y + piece.y, value, alpha);
      }
    });
  });
}

function createGhostPiece() {
  const ghost = {
    ...state.piece,
    matrix: state.piece.matrix,
    x: state.piece.x,
    y: state.piece.y,
  };

  while (!collide(state.board, ghost)) {
    ghost.y += 1;
  }
  ghost.y -= 1;
  return ghost;
}

function drawScene() {
  drawBoard();
  if (state.piece) {
    drawPiece(createGhostPiece(), 0.2);
    drawPiece(state.piece, 1);
  }
  drawEffects();
  drawOverlay();
}

function drawOverlay() {
  if (!state.isGameOver) {
    return;
  }

  context.save();
  context.fillStyle = "rgba(4, 10, 24, 0.74)";
  context.fillRect(0, 0, COLS, ROWS);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fff7ed";
  context.font = "bold 1.5px 'Arial Rounded MT Bold', sans-serif";
  context.fillText("GAME OVER", COLS / 2, ROWS / 2 - 0.8);

  context.fillStyle = "#fda4af";
  context.font = "0.6px 'Arial Rounded MT Bold', sans-serif";
  context.fillText("Press Start To Retry", COLS / 2, ROWS / 2 + 0.35);
  context.restore();
}

function update(time = 0) {
  if (state.lastTime === 0) {
    state.lastTime = time;
  }

  const deltaTime = time - state.lastTime;
  state.lastTime = time;

  if (!state.isPaused) {
    updateEffects(deltaTime);
  }

  if (state.isRunning && !state.isPaused && !state.isGameOver) {
    state.dropCounter += deltaTime;

    if (state.dropCounter >= state.dropInterval) {
      softDrop();
    }
  }

  drawScene();

  if ((state.isRunning && !state.isPaused) || (!state.isPaused && state.effects.length > 0)) {
    state.animationId = requestAnimationFrame(update);
  } else {
    state.animationId = 0;
  }
}

function handleAction(action) {
  switch (action) {
    case "left":
      movePiece(-1);
      break;
    case "right":
      movePiece(1);
      break;
    case "down":
      softDrop();
      break;
    case "rotate":
      rotatePiece();
      break;
    case "drop":
      hardDrop();
      break;
    default:
      break;
  }
  drawScene();
}

function handleSwipe(dx, dy) {
  if (!state.isRunning || state.isPaused || state.isGameOver) {
    return;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    handleAction(dx > 0 ? "right" : "left");
    return;
  }

  if (dy > 0) {
    handleAction("down");
  } else {
    handleAction("rotate");
  }
}

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyP") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (!state.isRunning || state.isPaused || state.isGameOver) {
    return;
  }

  switch (event.code) {
    case "KeyA":
      event.preventDefault();
      movePiece(-1);
      break;
    case "KeyD":
      event.preventDefault();
      movePiece(1);
      break;
    case "KeyS":
      event.preventDefault();
      softDrop();
      break;
    case "KeyW":
      event.preventDefault();
      rotatePiece();
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
  drawScene();
});

toggleButton.addEventListener("click", () => {
  startGame();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    handleAction(button.dataset.action);
  });
});

canvas.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.changedTouches[0];
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.active = true;
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (event) => {
    if (!touchState.active) {
      return;
    }

    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchState.startX;
    const dy = touch.clientY - touchState.startY;
    const distance = Math.hypot(dx, dy);
    const now = Date.now();

    if (distance < 18) {
      if (now - touchState.lastTapTime < 300) {
        handleAction("drop");
        touchState.lastTapTime = 0;
      } else {
        touchState.lastTapTime = now;
      }
    } else {
      handleSwipe(dx, dy);
      touchState.lastTapTime = 0;
    }

    touchState.active = false;
  },
  { passive: true },
);

setStatus("Ready");
renderTopScores();
drawScene();
