const TRACK_COUNT = 52;
const HOME_COUNT = 6;
const SAFE_TRACK_POSITIONS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const PLAYER_DETAILS = {
  red: {
    name: 'Red',
    color: '#d9504a',
    startIndex: 0,
  },
  blue: {
    name: 'Blue',
    color: '#3a82f6',
    startIndex: 13,
  },
  yellow: {
    name: 'Yellow',
    color: '#f4b731',
    startIndex: 26,
  },
  green: {
    name: 'Green',
    color: '#2ea95f',
    startIndex: 39,
  },
};

const BOARD_GRID_SIZE = 15;
const BOARD_MARGIN = 0.05;

const TRACK_CELLS = [
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 5 },
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 },
  { col: 6, row: 1 },
  { col: 6, row: 0 },
  { col: 7, row: 0 },
  { col: 8, row: 0 },
  { col: 8, row: 1 },
  { col: 8, row: 2 },
  { col: 8, row: 3 },
  { col: 8, row: 4 },
  { col: 8, row: 5 },
  { col: 9, row: 6 },
  { col: 10, row: 6 },
  { col: 11, row: 6 },
  { col: 12, row: 6 },
  { col: 13, row: 6 },
  { col: 14, row: 6 },
  { col: 14, row: 7 },
  { col: 14, row: 8 },
  { col: 13, row: 8 },
  { col: 12, row: 8 },
  { col: 11, row: 8 },
  { col: 10, row: 8 },
  { col: 9, row: 8 },
  { col: 8, row: 9 },
  { col: 8, row: 10 },
  { col: 8, row: 11 },
  { col: 8, row: 12 },
  { col: 8, row: 13 },
  { col: 8, row: 14 },
  { col: 7, row: 14 },
  { col: 6, row: 14 },
  { col: 6, row: 13 },
  { col: 6, row: 12 },
  { col: 6, row: 11 },
  { col: 6, row: 10 },
  { col: 6, row: 9 },
  { col: 5, row: 8 },
  { col: 4, row: 8 },
  { col: 3, row: 8 },
  { col: 2, row: 8 },
  { col: 1, row: 8 },
  { col: 0, row: 8 },
  { col: 0, row: 7 },
  { col: 0, row: 6 },
];

const HOME_PATH_CELLS = {
  red: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
    { col: 7, row: 6 },
  ],
  blue: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
    { col: 8, row: 7 },
  ],
  yellow: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
    { col: 7, row: 8 },
  ],
  green: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
    { col: 6, row: 7 },
  ],
};

const BASE_TOKEN_CELLS = {
  red: [
    { col: 1, row: 1 },
    { col: 3, row: 1 },
    { col: 1, row: 3 },
    { col: 3, row: 3 },
  ],
  blue: [
    { col: 11, row: 1 },
    { col: 13, row: 1 },
    { col: 11, row: 3 },
    { col: 13, row: 3 },
  ],
  yellow: [
    { col: 11, row: 11 },
    { col: 13, row: 11 },
    { col: 11, row: 13 },
    { col: 13, row: 13 },
  ],
  green: [
    { col: 1, row: 11 },
    { col: 3, row: 11 },
    { col: 1, row: 13 },
    { col: 3, row: 13 },
  ],
};

const QUADRANT_AREAS = [
  { id: 'red', color: '#d9504a', startCol: 0, startRow: 0 },
  { id: 'blue', color: '#3a82f6', startCol: 9, startRow: 0 },
  { id: 'yellow', color: '#f4b731', startCol: 9, startRow: 9 },
  { id: 'green', color: '#2ea95f', startCol: 0, startRow: 9 },
];

const START_INDEX_TO_PLAYER = new Map([
  [PLAYER_DETAILS.red.startIndex, 'red'],
  [PLAYER_DETAILS.blue.startIndex, 'blue'],
  [PLAYER_DETAILS.yellow.startIndex, 'yellow'],
  [PLAYER_DETAILS.green.startIndex, 'green'],
]);

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const int = parseInt(expanded, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function hexToRgba(hex, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function detectDevicePixelRatio(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return dpr;
}

function drawStar(ctx, x, y, points, outerRadius, innerRadius, fillStyle, strokeStyle) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - outerRadius);
  for (let i = 1; i <= points * 2; i += 1) {
    const angle = (Math.PI * i) / points;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    ctx.lineTo(x + Math.sin(angle) * radius, y - Math.cos(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = 'rgba(253, 224, 71, 0.65)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hitRegions = [];
    this.context = {
      currentPlayerId: null,
      availableMoves: new Set(),
    };
    this.rescale();
    window.addEventListener('resize', () => this.rescale());
  }

  rescale() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    this.hitRegions = [];
    detectDevicePixelRatio(this.canvas);
    this.width = rect.width;
    this.height = rect.height;

    this.boardSize = Math.min(this.width, this.height) * (1 - BOARD_MARGIN * 2);
    this.boardOriginX = (this.width - this.boardSize) / 2;
    this.boardOriginY = (this.height - this.boardSize) / 2;
    this.cellSize = this.boardSize / BOARD_GRID_SIZE;

    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    this.ctx.scale(dpr, dpr);

    const toCenter = (col, row) => ({
      x: this.boardOriginX + (col + 0.5) * this.cellSize,
      y: this.boardOriginY + (row + 0.5) * this.cellSize,
    });

    this.trackCoords = TRACK_CELLS.map(({ col, row }) => toCenter(col, row));

    this.homeCoords = {};
    Object.entries(HOME_PATH_CELLS).forEach(([id, cells]) => {
      this.homeCoords[id] = cells.map(({ col, row }) => toCenter(col, row));
    });

    this.baseCoords = {};
    Object.entries(BASE_TOKEN_CELLS).forEach(([id, cells]) => {
      this.baseCoords[id] = cells.map(({ col, row }) => toCenter(col, row));
    });

    this.centerPoint = toCenter(7, 7);
    this.playerStartFill = {};
    Object.entries(PLAYER_DETAILS).forEach(([id, detail]) => {
      this.playerStartFill[id] = hexToRgba(detail.color, 0.45);
    });
    this.draw(null, this.context);
  }

  draw(state, uiContext = {}) {
    this.context = {
      currentPlayerId: uiContext.currentPlayerId || null,
      availableMoves: uiContext.availableMoves || new Set(),
    };
    this.hitRegions = [];
    this.drawBoardBase();
    if (state) {
      this.drawTokens(state);
    }
  }

  drawBoardBase() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const wood = ctx.createLinearGradient(0, 0, 0, this.height);
    wood.addColorStop(0, '#d5a56b');
    wood.addColorStop(0.5, '#c79457');
    wood.addColorStop(1, '#d9ae74');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawRoundedRect(
      this.boardOriginX,
      this.boardOriginY,
      this.boardSize,
      this.boardSize,
      this.cellSize * 1.4,
      '#f5dfb8',
      '#8b5a2b',
    );

    QUADRANT_AREAS.forEach((quad) => {
      this.drawQuadrant(quad);
      this.drawBasePads(quad.id);
    });

    TRACK_CELLS.forEach((cell, index) => {
      this.drawTrackCell(cell, index);
    });

    Object.keys(HOME_PATH_CELLS).forEach((playerId) => {
      this.drawHomePath(playerId);
    });

    this.drawCenterArea();

    if (this.context.currentPlayerId && PLAYER_DETAILS[this.context.currentPlayerId]) {
      const startIdx = PLAYER_DETAILS[this.context.currentPlayerId].startIndex;
      const cell = TRACK_CELLS[startIdx];
      const { x, y, size } = this.cellRect(cell.col, cell.row, this.cellSize * 0.02);
      ctx.save();
      ctx.lineWidth = Math.max(2.4, this.cellSize * 0.12);
      ctx.strokeStyle = hexToRgba(PLAYER_DETAILS[this.context.currentPlayerId].color, 0.9);
      ctx.strokeRect(x, y, size, size);
      ctx.restore();
    }
  }

  cellCenter(col, row) {
    return {
      x: this.boardOriginX + (col + 0.5) * this.cellSize,
      y: this.boardOriginY + (row + 0.5) * this.cellSize,
    };
  }

  cellRect(col, row, padding = 0) {
    const size = this.cellSize - padding * 2;
    return {
      x: this.boardOriginX + col * this.cellSize + padding,
      y: this.boardOriginY + row * this.cellSize + padding,
      size,
    };
  }

  drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = Math.max(2, this.cellSize * 0.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawQuadrant(quad) {
    const ctx = this.ctx;
    const x = this.boardOriginX + quad.startCol * this.cellSize;
    const y = this.boardOriginY + quad.startRow * this.cellSize;
    const size = this.cellSize * 6;
    const radius = this.cellSize * 1.6;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(quad.color, 0.92);
    ctx.fill();
    ctx.lineWidth = Math.max(2, this.cellSize * 0.08);
    ctx.strokeStyle = hexToRgba(quad.color, 0.55);
    ctx.stroke();
    ctx.restore();
  }

  drawBasePads(playerId) {
    const ctx = this.ctx;
    const color = PLAYER_DETAILS[playerId].color;
    const padding = this.cellSize * 0.1;
    BASE_TOKEN_CELLS[playerId].forEach(({ col, row }) => {
      const { x, y, size } = this.cellRect(col, row, padding);
      const center = this.cellCenter(col, row);
      const radius = size * 0.45;
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(color, 0.35);
      ctx.strokeStyle = hexToRgba(color, 0.65);
      ctx.lineWidth = Math.max(1.5, this.cellSize * 0.07);
      ctx.shadowColor = hexToRgba(color, 0.25);
      ctx.shadowBlur = radius * 0.4;
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  drawTrackCell(cell, index) {
    const ctx = this.ctx;
    const { x, y, size } = this.cellRect(cell.col, cell.row, this.cellSize * 0.08);
    const playerId = START_INDEX_TO_PLAYER.get(index);
    ctx.save();
    ctx.fillStyle = playerId ? this.playerStartFill[playerId] : '#f8e7c8';
    ctx.fillRect(x, y, size, size);
    ctx.lineWidth = Math.max(1.5, this.cellSize * 0.05);
    ctx.strokeStyle = '#b98a5a';
    ctx.strokeRect(x, y, size, size);
    if (SAFE_TRACK_POSITIONS.has(index)) {
      this.drawSafeMarker(x + size / 2, y + size / 2, size * 0.45);
    }
    ctx.restore();
  }

  drawHomePath(playerId) {
    const ctx = this.ctx;
    const color = PLAYER_DETAILS[playerId].color;
    const cells = HOME_PATH_CELLS[playerId];
    cells.forEach(({ col, row }, idx) => {
      const { x, y, size } = this.cellRect(col, row, this.cellSize * 0.08);
      const alpha = idx === HOME_COUNT - 1 ? 0.9 : 0.55;
      ctx.save();
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.fillRect(x, y, size, size);
      ctx.lineWidth = Math.max(1.5, this.cellSize * 0.05);
      ctx.strokeStyle = hexToRgba(color, 0.8);
      ctx.strokeRect(x, y, size, size);
      ctx.restore();
    });
  }

  drawCenterArea() {
    const ctx = this.ctx;
    const centerCells = [
      { col: 6, row: 6 },
      { col: 7, row: 6 },
      { col: 8, row: 6 },
      { col: 6, row: 7 },
      { col: 7, row: 7 },
      { col: 8, row: 7 },
      { col: 6, row: 8 },
      { col: 7, row: 8 },
      { col: 8, row: 8 },
    ];

    centerCells.forEach(({ col, row }) => {
      const { x, y, size } = this.cellRect(col, row, this.cellSize * 0.08);
      ctx.fillStyle = '#f9ead0';
      ctx.fillRect(x, y, size, size);
      ctx.lineWidth = Math.max(1.2, this.cellSize * 0.04);
      ctx.strokeStyle = '#c79b62';
      ctx.strokeRect(x, y, size, size);
    });

    const center = this.cellCenter(7, 7);
    const radius = this.cellSize * 0.9;

    const wedge = (angle, color) => {
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(
        center.x + Math.cos(angle - Math.PI / 4) * radius,
        center.y + Math.sin(angle - Math.PI / 4) * radius,
      );
      ctx.lineTo(
        center.x + Math.cos(angle + Math.PI / 4) * radius,
        center.y + Math.sin(angle + Math.PI / 4) * radius,
      );
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.45);
      ctx.fill();
    };

    wedge(-Math.PI / 2, PLAYER_DETAILS.red.color);
    wedge(0, PLAYER_DETAILS.blue.color);
    wedge(Math.PI / 2, PLAYER_DETAILS.yellow.color);
    wedge(Math.PI, PLAYER_DETAILS.green.color);

    ctx.beginPath();
    ctx.lineWidth = Math.max(1.2, this.cellSize * 0.04);
    ctx.strokeStyle = '#b98a5a';
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawSafeMarker(cx, cy, radius) {
    drawStar(this.ctx, cx, cy, 5, radius, radius * 0.5, '#fce28a', '#c27a2b');
  }

  getGoalPoint(playerId, slot) {
    const baseAngles = {
      red: -Math.PI / 2,
      blue: 0,
      yellow: Math.PI / 2,
      green: Math.PI,
    };
    const angle = (baseAngles[playerId] ?? 0) + ((slot % 4) * Math.PI) / 2;
    const radius = this.cellSize * 0.6;
    return {
      x: this.centerPoint.x + Math.cos(angle) * radius,
      y: this.centerPoint.y + Math.sin(angle) * radius,
    };
  }

  drawTokens(state) {
    const ctx = this.ctx;
    const tokensState = state.tokens || {};
    const players = state.players || [];
    const playerMap = new Map(players.map((player) => [player.id, player]));
    const entries = [];
    const finishedTracker = {};

    Object.keys(PLAYER_DETAILS).forEach((id) => {
      finishedTracker[id] = 0;
    });

    Object.entries(tokensState).forEach(([playerId, tokenArray]) => {
      const playerDetail = playerMap.get(playerId) || PLAYER_DETAILS[playerId];
      if (!tokenArray) {
        return;
      }
      tokenArray.forEach((token, index) => {
        const entry = {
          playerId,
          tokenIndex: index,
          status: token.status,
          color: playerDetail?.color || PLAYER_DETAILS[playerId]?.color || '#e2e8f0',
          positionType: token.position?.type || (token.status === 'base' ? 'base' : 'unknown'),
          positionIndex: token.position?.index ?? null,
          basePoint: null,
          highlight:
            playerId === this.context.currentPlayerId &&
            this.context.availableMoves instanceof Set &&
            this.context.availableMoves.has(index),
        };

        if (entry.positionType === 'track') {
          entry.basePoint = this.trackCoords[entry.positionIndex] || null;
        } else if (entry.positionType === 'home') {
          entry.basePoint = this.homeCoords[playerId]?.[entry.positionIndex] || null;
        } else if (entry.positionType === 'goal') {
          const goalSlot = finishedTracker[playerId] ?? 0;
        entry.basePoint = this.getGoalPoint(playerId, goalSlot);
        finishedTracker[playerId] = goalSlot + 1;
      } else if (entry.positionType === 'base' || entry.status === 'base') {
        entry.basePoint = this.baseCoords[playerId]?.[index] || null;
        entry.positionType = 'base';
      }

      if (!entry.basePoint) {
        entry.basePoint = this.centerPoint;
      }
      entries.push(entry);
      });
    });

    const groups = new Map();
    entries.forEach((entry) => {
      const key =
        entry.positionType === 'track'
          ? `track:${entry.positionIndex}`
          : entry.positionType === 'home'
          ? `home:${entry.playerId}:${entry.positionIndex}`
          : entry.positionType === 'goal'
          ? `goal:${entry.playerId}`
          : `base:${entry.playerId}:${entry.tokenIndex}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(entry);
    });

    groups.forEach((group) => {
      const offsets = this.computeOffsets(group.length);
      group.forEach((entry, idx) => {
        entry.offset = offsets[idx] || { x: 0, y: 0 };
      });
    });

    entries.forEach((entry) => {
      const x = entry.basePoint.x + (entry.offset?.x || 0);
      const y = entry.basePoint.y + (entry.offset?.y || 0);
      this.drawToken(x, y, entry);
    });
  }

  drawToken(x, y, entry) {
    const ctx = this.ctx;
    const outerRadius = Math.min(this.cellSize * 0.32, 22);
    const innerRadius = outerRadius * 0.65;
    const coreRadius = outerRadius * 0.4;

    ctx.save();
    if (entry.highlight) {
      ctx.shadowColor = entry.color;
      ctx.shadowBlur = 14;
    }

    ctx.beginPath();
    ctx.fillStyle = entry.highlight ? 'rgba(248,250,252,0.95)' : '#0f172a';
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = entry.highlight ? 4 : 2.5;
    ctx.strokeStyle = entry.color;
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = entry.color;
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#0f172a';
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    this.hitRegions.push({
      x,
      y,
      radius: outerRadius + 6,
      playerId: entry.playerId,
      tokenIndex: entry.tokenIndex,
      highlight: entry.highlight,
    });
  }

  computeOffsets(count) {
    if (count <= 1) {
      return [{ x: 0, y: 0 }];
    }
    const radius = this.cellSize * (count <= 3 ? 0.22 : 0.28);
    return Array.from({ length: count }, (_, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }

  pickToken(x, y) {
    for (let i = this.hitRegions.length - 1; i >= 0; i -= 1) {
      const region = this.hitRegions[i];
      const dx = x - region.x;
      const dy = y - region.y;
      if (Math.sqrt(dx * dx + dy * dy) <= region.radius) {
        return region;
      }
    }
    return null;
  }
}

let socket = null;
let socketConfiguredUrl = null;

const SESSION_STORAGE_KEY = 'ludo_session_token';

const state = {
  player: null,
  roomId: null,
  game: null,
  auth: {
    profile: null,
    sessionToken: null,
    ready: false,
    mode: 'unknown', // 'unknown' | 'authenticated' | 'guest'
  },
  config: {
    googleClientId: null,
    socketUrl: null,
  },
  ui: {
    lastDiceRollTimestamp: null,
    lastWinnerId: null,
    fireworksStopper: null,
  },
};

const joinSection = document.getElementById('join-section');
const gameSection = document.getElementById('game-section');
const joinForm = document.getElementById('join-form');
const joinSubmitBtn = joinForm.querySelector('button[type="submit"]');
const roomInput = document.getElementById('room-input');
const nameInput = document.getElementById('name-input');
const joinError = document.getElementById('join-error');
const randomRoomBtn = document.getElementById('random-room-btn');
const googleSignInContainer = document.getElementById('google-signin');
const authMessage = document.getElementById('auth-message');
const profileSummary = document.getElementById('profile-summary');
const profileName = document.getElementById('profile-name');
const profileStats = document.getElementById('profile-stats');
const profileAvatar = document.getElementById('profile-avatar');
const signoutBtn = document.getElementById('signout-btn');
const guestBtn = document.getElementById('guest-btn');
const roomCode = document.getElementById('room-code');
const playerBadge = document.getElementById('player-badge');
const startBtn = document.getElementById('start-btn');
const rollBtn = document.getElementById('roll-btn');
const diceValue = document.getElementById('dice-value');
const statusMessage = document.getElementById('status-message');
const playersList = document.getElementById('players-list');
const historyLog = document.getElementById('history-log');
const boardCanvas = document.getElementById('board-canvas');
const aiControls = document.getElementById('ai-controls');
const aiDifficultySelect = document.getElementById('ai-difficulty');
const addAiBtn = document.getElementById('add-ai-btn');
const diceOutput = document.getElementById('dice-output');
const diceFace = document.getElementById('dice-face');
const debugWinBtn = document.getElementById('debug-win-btn');
const renderer = new BoardRenderer(boardCanvas);
if (window.ResizeObserver) {
  const resizeObserver = new ResizeObserver(() => renderer.rescale());
  resizeObserver.observe(boardCanvas);
}

const fireworksLayer = document.getElementById('fireworks-layer');
const winnerBanner = document.getElementById('winner-banner');
const winnerName = document.getElementById('winner-name');

function randomRoomId() {
  const adjectives = ['lucky', 'swift', 'brave', 'spark', 'bright', 'eager', 'bold'];
  const nouns = ['ludo', 'dice', 'pawn', 'race', 'track', 'token'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.floor(Math.random() * 899 + 101);
  return `${adjective}-${noun}-${suffix}`.toLowerCase();
}

const DICE_PATTERNS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const diceDots = diceFace ? Array.from(diceFace.querySelectorAll('.dice-dot')) : [];
const diceState = {
  timeout: null,
};

function renderDice(value, animate = false) {
  if (!diceFace) {
    return;
  }
  const numeric = Number(value);
  const valid = Number.isInteger(numeric) && numeric >= 1 && numeric <= 6 ? numeric : null;
  const pattern = valid ? DICE_PATTERNS[valid] || [] : [];
  diceDots.forEach((dot, index) => {
    dot.classList.toggle('active', pattern.includes(index));
  });
  const label = valid ? `Dice shows ${valid}` : 'No dice rolled yet';
  if (diceOutput) {
    diceOutput.setAttribute('aria-label', label);
  }
  if (diceValue) {
    diceValue.textContent = valid ?? '–';
  }
  if (animate && valid) {
    diceFace.classList.remove('rolling');
    // Force reflow to restart animation
    void diceFace.offsetWidth;
    diceFace.classList.add('rolling');
    if (diceState.timeout) {
      clearTimeout(diceState.timeout);
    }
    diceState.timeout = setTimeout(() => {
      diceFace.classList.remove('rolling');
      diceState.timeout = null;
    }, 600);
  } else {
    diceFace.classList.remove('rolling');
  }
}

function clearFireworks() {
  if (!fireworksLayer) {
    return;
  }
  fireworksLayer.innerHTML = '';
}

function stopFireworks() {
  if (state.ui.fireworksStopper) {
    state.ui.fireworksStopper();
    state.ui.fireworksStopper = null;
  }
  if (fireworksLayer) {
    fireworksLayer.classList.add('hidden');
  }
  clearFireworks();
}

function spawnFirework(type) {
  if (!fireworksLayer) {
    return;
  }
  const firework = document.createElement('span');
  firework.className = `firework firework--${type}`;
  const hue = Math.floor(Math.random() * 360);
  const saturation = 80 + Math.random() * 20;
  const lightness = 55 + Math.random() * 20;
  const color = `hsl(${hue}deg ${saturation}% ${lightness}%)`;
  firework.style.background = color;
  firework.style.boxShadow = `0 0 16px ${color}`;

  if (type === 'rocket') {
    firework.style.left = `${Math.random() * 90 + 5}%`;
    firework.style.bottom = '-10%';
    firework.style.top = 'auto';
    firework.style.animationDelay = `${Math.random() * 0.5}s`;
  } else {
    firework.style.left = `${Math.random() * 100}%`;
    firework.style.top = `${Math.random() * 100}%`;
    firework.style.bottom = 'auto';
    firework.style.animationDelay = `${Math.random() * 1}s`;
  }

  fireworksLayer.appendChild(firework);
  setTimeout(() => {
    firework.remove();
  }, 2400);
}

function startFireworks() {
  if (!fireworksLayer) {
    return;
  }
  stopFireworks();
  clearFireworks();
  fireworksLayer.classList.remove('hidden');

  const durationMs = 15000;
  const startTime = Date.now();

  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed >= durationMs) {
      stopFireworks();
      return;
    }
    const burstCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burstCount; i += 1) {
      const roll = Math.random();
      const type = roll < 0.33 ? 'rocket' : roll < 0.66 ? 'cracker' : 'sparkle';
      spawnFirework(type);
    }
  }, 350);

  const timeout = setTimeout(() => {
    stopFireworks();
  }, durationMs + 500);

  state.ui.fireworksStopper = () => {
    clearInterval(interval);
    clearTimeout(timeout);
    fireworksLayer.classList.add('hidden');
    clearFireworks();
    state.ui.fireworksStopper = null;
  };
}

function showWinnerBanner(name) {
  if (!winnerBanner || !winnerName) {
    return;
  }
  winnerName.textContent = name || 'Winner';
  winnerBanner.classList.remove('hidden');
}

function hideWinnerBanner() {
  if (!winnerBanner) {
    return;
  }
  winnerBanner.classList.add('hidden');
  if (winnerName) {
    winnerName.textContent = '';
  }
}

function setAuthMessage(message) {
  if (authMessage) {
    authMessage.textContent = message || '';
  }
}

function setJoinError(message) {
  joinError.textContent = message || '';
}

function formatProfileStats(profile) {
  if (!profile) {
    return '';
  }
  const wins = typeof profile.wins === 'number' ? profile.wins : 0;
  const games = typeof profile.games === 'number' ? profile.games : 0;
  if (games === 0) {
    return 'Record 0/0';
  }
  const rate = games > 0 ? Math.round((wins / games) * 100) : 0;
  return `Record ${wins}/${games} · ${rate}% win`;
}

function updateProfileSummary(profile) {
  if (!profileSummary) {
    return;
  }
  if (state.auth.mode === 'guest') {
    profileSummary.classList.remove('hidden');
    if (googleSignInContainer) {
      googleSignInContainer.classList.remove('hidden');
    }
    if (signoutBtn) {
      signoutBtn.classList.add('hidden');
    }
    profileAvatar.src = '';
    profileAvatar.alt = '';
    profileAvatar.classList.add('hidden');
    profileName.textContent = 'Guest Player';
    profileStats.textContent = 'Progress is not saved while playing as a guest.';
    return;
  }
  if (!profile || !state.auth.sessionToken) {
    profileSummary.classList.add('hidden');
    if (googleSignInContainer) {
      googleSignInContainer.classList.remove('hidden');
    }
    if (signoutBtn) {
      signoutBtn.classList.add('hidden');
    }
    profileAvatar.src = '';
    profileAvatar.alt = '';
    profileAvatar.classList.add('hidden');
    profileName.textContent = 'Not signed in';
    profileStats.textContent = '';
    return;
  }
  profileSummary.classList.remove('hidden');
  if (googleSignInContainer) {
    googleSignInContainer.classList.add('hidden');
  }
  if (signoutBtn) {
    signoutBtn.classList.remove('hidden');
  }
  profileName.textContent = profile.name || profile.email || 'Player';
  profileStats.textContent = formatProfileStats(profile);
  if (profile.avatar) {
    profileAvatar.src = profile.avatar;
    profileAvatar.alt = `${profile.name || 'Player'} avatar`;
    profileAvatar.classList.remove('hidden');
  } else {
    profileAvatar.src = '';
    profileAvatar.alt = '';
    profileAvatar.classList.add('hidden');
  }
}

function updateAuthUI() {
  const loggedIn = Boolean(state.auth.sessionToken && state.auth.profile);
  const guestMode = state.auth.mode === 'guest';
  if (joinSubmitBtn) {
    joinSubmitBtn.disabled = !(loggedIn || guestMode);
  }
  if (guestBtn) {
    guestBtn.disabled = guestMode;
  }
  if (guestMode) {
    setAuthMessage('Playing as guest. Progress will not be saved.');
    updateProfileSummary(null);
    return;
  }
  if (loggedIn) {
    setAuthMessage('Signed in. Enter a room ID to play.');
    updateProfileSummary(state.auth.profile);
    if (!nameInput.value && state.auth.profile?.name) {
      nameInput.value = state.auth.profile.name;
    }
  } else if (!state.auth.ready) {
    updateProfileSummary(null);
    setAuthMessage('Loading sign-in options…');
  } else if (!state.config.googleClientId) {
    updateProfileSummary(null);
    setAuthMessage('Google sign-in is not configured for this server.');
  } else {
    updateProfileSummary(null);
    setAuthMessage('Sign in with Google or continue as guest.');
  }
}

async function fetchJSON(url, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  }
  const response = await fetch(url, opts);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message = data?.error || response.statusText || 'Request failed';
    const error = new Error(message);
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

let googleInitialized = false;

function waitForGoogle(callback, attempt = 0) {
  if (window.google?.accounts?.id) {
    callback();
    return;
  }
  if (attempt > 50) {
    setAuthMessage('Unable to load Google sign-in. Refresh the page to try again.');
    return;
  }
  setTimeout(() => waitForGoogle(callback, attempt + 1), 120);
}

function renderGoogleButton() {
  if (!googleSignInContainer || !state.config.googleClientId) {
    return;
  }
  googleSignInContainer.innerHTML = '';
  if (window.google?.accounts?.id) {
    window.google.accounts.id.renderButton(googleSignInContainer, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      type: 'standard',
    });
  }
}

function initializeGoogleSignIn(clientId) {
  if (!clientId) {
    state.auth.ready = true;
    updateAuthUI();
    return;
  }
  waitForGoogle(() => {
    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });
      googleInitialized = true;
    }
    renderGoogleButton();
    window.google.accounts.id.prompt(() => {});
    state.auth.ready = true;
    updateAuthUI();
  });
}

async function signInWithGoogleCredential(credential) {
  try {
    const data = await fetchJSON('/auth/google', {
      method: 'POST',
      body: { credential },
    });
    if (!data?.sessionToken) {
      throw new Error('Sign-in failed. Try again.');
    }
    state.auth.profile = data.profile || state.auth.profile || null;
    state.auth.sessionToken = data.sessionToken;
    state.auth.mode = 'authenticated';
    localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken);
    updateAuthUI();
    setAuthMessage('Signed in. Enter a room ID to play.');
  } catch (error) {
    setAuthMessage(error.message || 'Failed to sign in with Google.');
  }
}

function handleCredentialResponse(response) {
  if (!response?.credential) {
    setAuthMessage('Google sign-in returned an empty credential.');
    return;
  }
  signInWithGoogleCredential(response.credential);
}

async function restoreSession() {
  const savedToken = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!savedToken) {
    updateAuthUI();
    return;
  }
  try {
    const data = await fetchJSON(`/auth/session?token=${encodeURIComponent(savedToken)}`);
    state.auth.sessionToken = data.sessionToken;
    state.auth.profile = data.profile;
    state.auth.mode = 'authenticated';
    localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken);
  } catch (error) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setAuthMessage(error.message || 'Session expired. Please sign in again.');
  } finally {
    updateAuthUI();
  }
}

function clearAuth() {
  state.auth.profile = null;
  state.auth.sessionToken = null;
  state.auth.mode = 'unknown';
  localStorage.removeItem(SESSION_STORAGE_KEY);
  updateAuthUI();
  if (googleInitialized) {
    renderGoogleButton();
    window.google.accounts.id.prompt(() => {});
  }
}

async function loadAuthConfig() {
  try {
    const config = await fetchJSON('/config');
    state.config.googleClientId = config?.googleClientId || null;
    state.config.socketUrl = config?.socketUrl || null;
    initializeSocketConnection(state.config.socketUrl);
    if (state.config.googleClientId) {
      initializeGoogleSignIn(state.config.googleClientId);
    } else {
      state.auth.ready = true;
      updateAuthUI();
    }
  } catch (error) {
    state.config.socketUrl = null;
    initializeSocketConnection(null);
    state.auth.ready = true;
    setAuthMessage(error.message || 'Failed to load sign-in configuration.');
    updateAuthUI();
  }
}

function showGameUI() {
  joinSection.classList.add('hidden');
  gameSection.classList.remove('hidden');
  requestAnimationFrame(() => renderer.rescale());
}

function formatHistoryEntry(entry, playersMap) {
  const playerName = entry.playerId ? playersMap.get(entry.playerId)?.name || entry.playerId : '';
  const victimName = entry.victimId ? playersMap.get(entry.victimId)?.name || entry.victimId : '';
  switch (entry.type) {
    case 'system':
      return entry.message;
    case 'dice':
      return `${playerName} rolled a ${entry.value}${entry.detail ? ` – ${entry.detail}` : ''}`;
    case 'capture':
      return `${playerName} captured ${victimName}'s token`;
    case 'finish':
      return `${playerName} moved token ${entry.tokenId?.split('-').pop() || ''} home`;
    case 'bonus':
      return `${playerName} ${entry.detail || 'earned an extra turn'}`;
    case 'win':
      return `${playerName} wins the game!`;
    default:
      return entry.message || '—';
  }
}

function updateHistory(history = [], players = []) {
  const playersMap = new Map(players.map((p) => [p.id, p]));
  historyLog.innerHTML = '';
  history.slice().reverse().forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = formatHistoryEntry(entry, playersMap);
    historyLog.appendChild(li);
  });
}

function updatePlayers(players = [], currentPlayerId, winnerId) {
  playersList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'player-row';
    if (player.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'player-avatar';
      avatar.src = player.avatar;
      avatar.alt = `${player.name} avatar`;
      row.appendChild(avatar);
    }
    const marker = document.createElement('span');
    marker.className = 'marker';
    marker.style.backgroundColor = player.color;
    const name = document.createElement('span');
    name.textContent = player.name;
    row.append(marker, name);
    li.appendChild(row);

    const tags = [];
    if (player.id === winnerId) {
      tags.push({ text: 'Winner', className: 'tag--winner' });
    } else if (player.isCurrent) {
      tags.push({ text: 'Your turn', className: 'tag--turn' });
    }
    if (player.isHost) {
      tags.push({ text: 'Host', className: 'tag--host' });
    }
    if (player.isAi) {
      const difficultyLabel = player.difficulty
        ? `AI ${player.difficulty.charAt(0).toUpperCase()}${player.difficulty.slice(1)}`
        : 'AI';
      tags.push({ text: difficultyLabel, className: 'tag--ai' });
    }
    if (player.isGuest) {
      tags.push({ text: 'Guest', className: 'tag--guest' });
    }
    if (!player.isAi && (typeof player.wins === 'number' || typeof player.games === 'number')) {
      const wins = typeof player.wins === 'number' ? player.wins : 0;
      const games = typeof player.games === 'number' ? player.games : null;
      const recordText = games !== null ? `Record ${wins}/${games}` : `Wins ${wins}`;
      tags.push({ text: recordText, className: 'tag--record' });
    }

    if (tags.length > 0) {
      const tagContainer = document.createElement('div');
      tagContainer.className = 'status-tags';
      tags.forEach((tagInfo) => {
        const tag = document.createElement('span');
        tag.className = `tag ${tagInfo.className}`;
        tag.textContent = tagInfo.text;
        tagContainer.appendChild(tag);
      });
      li.appendChild(tagContainer);
    }

    playersList.appendChild(li);
  });
}

function updateControls() {
  const game = state.game;
  if (!state.player) {
    startBtn.disabled = true;
    rollBtn.disabled = true;
    renderDice(null, false);
    state.ui.lastDiceRollTimestamp = null;
    statusMessage.textContent = '';
    if (aiControls) {
      aiControls.classList.add('hidden');
    }
    return;
  }

  const isHost = Boolean(
    game?.players?.find((player) => player.id === state.player.id)?.isHost,
  );
  const availableSeats = Math.max(0, game?.availableSeats ?? 0);
  if (aiControls) {
    const showAiControls = Boolean(isHost);
    aiControls.classList.toggle('hidden', !showAiControls);
    const canAddAi = showAiControls && game?.phase !== 'playing' && availableSeats > 0;
    if (addAiBtn) {
      addAiBtn.disabled = !canAddAi;
      addAiBtn.textContent = canAddAi
        ? `Add AI Player (${availableSeats} slot${availableSeats === 1 ? '' : 's'} left)`
        : 'Add AI Player';
    }
    if (aiDifficultySelect) {
      aiDifficultySelect.disabled = !canAddAi;
    }
  }

  if (debugWinBtn) {
    const hasPlayers = (game?.players?.length ?? 0) > 0;
    debugWinBtn.disabled = !(isHost && hasPlayers && game?.phase !== 'finished');
  }

  const canStart =
    isHost &&
    game?.phase !== 'playing' &&
    (game?.players?.length ?? 0) >= 2 &&
    game?.winnerId === null;
  startBtn.disabled = !canStart;

  const isCurrent = game?.currentPlayerId === state.player.id;
  const awaitingMove = Boolean(game?.turn?.awaitingMove);
  const diceLocked = game?.turn?.dice !== null;
  const inPlay = game?.phase === 'playing';
  rollBtn.disabled = !(inPlay && isCurrent && !awaitingMove && !diceLocked);

  const rawDiceValue = game?.turn?.dice ?? game?.turn?.lastRoll?.value ?? null;
  const currentDiceValue = Number.isInteger(rawDiceValue) ? rawDiceValue : null;
  const lastRollTimestamp = game?.turn?.lastRoll?.at ?? null;
  const shouldAnimate = Boolean(
    currentDiceValue && lastRollTimestamp && state.ui.lastDiceRollTimestamp !== lastRollTimestamp,
  );
  renderDice(currentDiceValue, shouldAnimate);
  if (shouldAnimate) {
    state.ui.lastDiceRollTimestamp = lastRollTimestamp;
  } else if (!lastRollTimestamp && game?.turn?.dice == null) {
    state.ui.lastDiceRollTimestamp = null;
  }

  let message = '';
  if (!game) {
    message = 'Connected. Waiting for game state...';
  } else if (game.phase === 'waiting') {
    message =
      game.players.length < 2
        ? 'Waiting for at least two players to join.'
        : isHost
        ? 'Ready to start. Press start when your friends are in.'
        : 'Waiting for host to start the game.';
    if (isHost && availableSeats > 0) {
      message += ` You can add ${availableSeats} AI player${availableSeats === 1 ? '' : 's'} if needed.`;
    }
  } else if (game.phase === 'finished') {
    const winner = game.players.find((p) => p.id === game.winnerId);
    message = winner ? `${winner.name} wins the match!` : 'Game finished.';
  } else if (inPlay) {
    if (isCurrent) {
      if (!diceLocked) {
        message = 'Your turn. Roll the dice.';
      } else if (awaitingMove) {
        message = 'Select one of the highlighted tokens to move.';
      } else {
        message = 'Your turn continues.';
      }
    } else {
      const current = game.players.find((p) => p.id === game.currentPlayerId);
      message = current ? `Waiting for ${current.name}...` : 'Waiting for next player...';
    }
  }
  statusMessage.textContent = message;
}

function renderGame() {
  const game = state.game;
  roomCode.textContent = state.roomId || '—';
  if (!game) {
    renderer.draw(null, {
      currentPlayerId: state.player?.id ?? null,
      availableMoves: new Set(),
    });
    renderDice(null, false);
    state.ui.lastDiceRollTimestamp = null;
    state.ui.lastWinnerId = null;
    hideWinnerBanner();
    stopFireworks();
    return;
  }
  roomCode.textContent = state.roomId || '—';
  if (state.player) {
    const base = `${state.player.name} (${state.player.label || state.player.id})`;
    const wins = typeof state.player.wins === 'number' ? state.player.wins : null;
    const games = typeof state.player.games === 'number' ? state.player.games : null;
    let record = '';
    if (!state.player.isGuest) {
      if (typeof wins === 'number' && typeof games === 'number') {
        record = ` • Record ${wins}/${games}`;
      } else if (typeof wins === 'number') {
        record = ` • Wins ${wins}`;
      }
    } else {
      record = ' • Guest mode';
    }
    playerBadge.textContent = `${base}${record}`;
  } else {
    playerBadge.textContent = '—';
  }
  if (game.winnerId && state.ui.lastWinnerId !== game.winnerId) {
    const winner = game.players.find((p) => p.id === game.winnerId);
    if (winner) {
      startFireworks();
      showWinnerBanner(winner.name);
    }
    state.ui.lastWinnerId = game.winnerId;
  } else if (!game.winnerId && state.ui.lastWinnerId !== null) {
    hideWinnerBanner();
    stopFireworks();
    state.ui.lastWinnerId = null;
  }
  updatePlayers(game.players, game.currentPlayerId, game.winnerId);
  updateHistory(game.history || [], game.players);
  updateControls();
  const availableMovesSet =
    state.player && game.currentPlayerId === state.player.id
      ? new Set((game.turn?.availableMoves || []).map((move) => move.tokenIndex))
      : new Set();
  renderer.draw(game, {
    currentPlayerId: game.currentPlayerId,
    availableMoves: availableMovesSet,
  });
}

function getActiveSocket() {
  if (!socket) {
    statusMessage.textContent = 'Connecting to game server...';
    return null;
  }
  return socket;
}

function emitJoin(roomId, name) {
  if (!state.auth.sessionToken) {
    if (state.auth.mode !== 'guest') {
      setJoinError('Please sign in or continue as guest before joining a room.');
      return;
    }
  }
  const activeSocket = getActiveSocket();
  if (!activeSocket) {
    return;
  }
  activeSocket.emit(
    'joinRoom',
    {
      roomId,
      playerName: name,
      sessionToken: state.auth.sessionToken,
      mode: state.auth.mode,
    },
    (response) => {
      if (response?.error) {
        setJoinError(response.error);
        return;
      }
      state.player = response.player;
      state.roomId = response.room;
      if (response.profile) {
        state.auth.mode = 'authenticated';
        state.auth.profile = { ...(state.auth.profile || {}), ...response.profile };
      }
      setJoinError('');
      showGameUI();
      updateAuthUI();
    },
  );
}

function requestMove(tokenIndex) {
  const activeSocket = getActiveSocket();
  if (!activeSocket) {
    return;
  }
  activeSocket.emit('moveToken', { tokenIndex }, (response) => {
    if (response?.error) {
      statusMessage.textContent = response.error;
    }
  });
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const roomId = roomInput.value.trim().toLowerCase();
  if (!roomId) {
    setJoinError('Room ID is required.');
    return;
  }
  if (!state.auth.sessionToken && state.auth.mode !== 'guest') {
    setJoinError('Please sign in or continue as guest before joining.');
    return;
  }
  let name = nameInput.value.trim();
  if (!name && state.auth.profile?.name) {
    name = state.auth.profile.name.trim();
    nameInput.value = name;
  }
  if (!name && state.auth.mode !== 'guest') {
    setJoinError('Please provide a display name.');
    return;
  }
  emitJoin(roomId, name);
});

randomRoomBtn.addEventListener('click', () => {
  roomInput.value = randomRoomId();
});

startBtn.addEventListener('click', () => {
  const activeSocket = getActiveSocket();
  if (!activeSocket) {
    return;
  }
  activeSocket.emit('startGame', (response) => {
    if (response?.error) {
      statusMessage.textContent = response.error;
    }
  });
});

rollBtn.addEventListener('click', () => {
  const activeSocket = getActiveSocket();
  if (!activeSocket) {
    return;
  }
  activeSocket.emit('rollDice', (response) => {
    if (response?.error) {
      statusMessage.textContent = response.error;
    }
  });
});

if (signoutBtn) {
  signoutBtn.addEventListener('click', async () => {
    if (state.auth.sessionToken) {
      try {
        await fetchJSON('/auth/logout', {
          method: 'POST',
          body: { token: state.auth.sessionToken },
        });
      } catch (error) {
        // suppress logout errors on client
      }
    }
    const wasInGame = Boolean(state.roomId);
    clearAuth();
    if (wasInGame) {
      window.location.reload();
    }
  });
}

if (guestBtn) {
  guestBtn.addEventListener('click', () => {
    state.auth.mode = 'guest';
    state.auth.profile = null;
    state.auth.sessionToken = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setJoinError('');
    updateAuthUI();
  });
}

if (addAiBtn) {
  addAiBtn.addEventListener('click', () => {
    if (addAiBtn.disabled) {
      return;
    }
    const difficulty = aiDifficultySelect?.value ?? 'easy';
    const activeSocket = getActiveSocket();
    if (!activeSocket) {
      return;
    }
    activeSocket.emit('addAiPlayer', { difficulty }, (response) => {
      if (response?.error) {
        statusMessage.textContent = response.error;
      }
    });
  });
}

if (debugWinBtn) {
  debugWinBtn.addEventListener('click', () => {
    if (debugWinBtn.disabled) {
      return;
    }
    const activeSocket = getActiveSocket();
    if (!activeSocket) {
      return;
    }
    activeSocket.emit('debugEndGame', (response = {}) => {
      if (response.error) {
        statusMessage.textContent = response.error;
      }
    });
  });
}

function canvasCoordinates(event) {
  const rect = boardCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

boardCanvas.addEventListener('mousemove', (event) => {
  if (!state.game || !state.player) {
    boardCanvas.style.cursor = 'default';
    return;
  }
  const { x, y } = canvasCoordinates(event);
  const hit = renderer.pickToken(x, y);
  const availableSet =
    state.game.currentPlayerId === state.player.id
      ? new Set((state.game.turn?.availableMoves || []).map((move) => move.tokenIndex))
      : new Set();
  const canMove = Boolean(hit) && hit.playerId === state.player.id && availableSet.has(hit.tokenIndex);
  boardCanvas.style.cursor = canMove ? 'pointer' : 'default';
});

boardCanvas.addEventListener('click', (event) => {
  if (!state.game || !state.player) {
    return;
  }
  const { x, y } = canvasCoordinates(event);
  const hit = renderer.pickToken(x, y);
  if (!hit || hit.playerId !== state.player.id) {
    return;
  }
  const availableSet =
    state.game.currentPlayerId === state.player.id
      ? new Set((state.game.turn?.availableMoves || []).map((move) => move.tokenIndex))
      : new Set();
  if (!availableSet.has(hit.tokenIndex)) {
    return;
  }
  requestMove(hit.tokenIndex);
});

function handleRoomUpdate(payload) {
  if (!payload) {
    return;
  }
  if (state.roomId && payload.roomId !== state.roomId) {
    return;
  }
  state.roomId = payload.roomId || state.roomId;
  renderGame();
}

function handleGameState(gameState) {
  state.game = gameState;
  if (state.player) {
    const updatedSelf = gameState.players?.find((p) => p.id === state.player.id);
    if (updatedSelf) {
      state.player = updatedSelf;
    }
    if (!state.player.label) {
      const labelled = gameState.players?.find((p) => p.id === state.player.id);
      if (labelled) {
        state.player.label = labelled.label;
        state.player.name = labelled.name;
      }
    }
  }
  if (state.auth.profile) {
    const profilePlayer = gameState.players?.find((p) => p.profileId === state.auth.profile.id);
    if (profilePlayer) {
      state.auth.profile = {
        ...state.auth.profile,
        wins:
          typeof profilePlayer.wins === 'number'
            ? profilePlayer.wins
            : state.auth.profile.wins,
        games:
          typeof profilePlayer.games === 'number'
            ? profilePlayer.games
            : state.auth.profile.games,
        avatar: profilePlayer.avatar || state.auth.profile.avatar,
        name: profilePlayer.name || state.auth.profile.name,
      };
    }
  }
  updateAuthUI();
  renderGame();
}

function handleSocketDisconnect() {
  statusMessage.textContent = 'Connection lost. Attempting to reconnect...';
}

function handleSocketReconnect() {
  statusMessage.textContent = 'Reconnected.';
  if (state.roomId && state.player) {
    const activeSocket = getActiveSocket();
    if (!activeSocket) {
      return;
    }
    activeSocket.emit('requestState', (response) => {
      if (response?.ok) {
        state.game = response.state;
        renderGame();
      }
    });
  }
}

function bindSocketEvents(instance) {
  instance.on('connect', () => {
    statusMessage.textContent = '';
  });
  instance.on('connect_error', (error) => {
    statusMessage.textContent = error?.message || 'Failed to connect to game server.';
  });
  instance.on('roomUpdate', handleRoomUpdate);
  instance.on('gameState', handleGameState);
  instance.on('disconnect', handleSocketDisconnect);
  instance.io.on('reconnect', handleSocketReconnect);
}

function initializeSocketConnection(socketUrl) {
  const targetUrl = socketUrl || null;
  if (socket) {
    if (socketConfiguredUrl === targetUrl) {
      return socket;
    }
    socket.disconnect();
  }
  socketConfiguredUrl = targetUrl;
  const instance = socketConfiguredUrl ? io(socketConfiguredUrl) : io();
  socket = instance;
  statusMessage.textContent = 'Connecting to game server...';
  bindSocketEvents(instance);
  return instance;
}

updateAuthUI();
restoreSession();
loadAuthConfig();

renderer.draw(null, {
  currentPlayerId: null,
  availableMoves: new Set(),
});
renderDice(null, false);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    stopFireworks();
    hideWinnerBanner();
  }
});
