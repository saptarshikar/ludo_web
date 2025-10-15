const TRACK_COUNT = 52;
const HOME_COUNT = 6;
const SAFE_TRACK_POSITIONS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const PLAYER_DETAILS = {
  red: {
    name: 'Red',
    color: '#ef4444',
    accent: 'rgba(239,68,68,0.22)',
    startIndex: 0,
  },
  blue: {
    name: 'Blue',
    color: '#3b82f6',
    accent: 'rgba(59,130,246,0.22)',
    startIndex: 13,
  },
  yellow: {
    name: 'Yellow',
    color: '#facc15',
    accent: 'rgba(250,204,21,0.22)',
    startIndex: 26,
  },
  green: {
    name: 'Green',
    color: '#22c55e',
    accent: 'rgba(34,197,94,0.22)',
    startIndex: 39,
  },
};

function angleForTrackIndex(index) {
  return -Math.PI / 2 + (index * Math.PI * 2) / TRACK_COUNT;
}

function createQuadrantPoints(center, spacing) {
  const half = spacing / 2;
  return [
    { x: center.x - half, y: center.y - half },
    { x: center.x + half, y: center.y - half },
    { x: center.x - half, y: center.y + half },
    { x: center.x + half, y: center.y + half },
  ];
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
    this.center = { x: this.width / 2, y: this.height / 2 };
    this.trackRadius = Math.min(this.width, this.height) / 2 - 60;
    this.trackCoords = Array.from({ length: TRACK_COUNT }, (_, idx) => {
      const angle = angleForTrackIndex(idx);
      return {
        x: this.center.x + Math.cos(angle) * this.trackRadius,
        y: this.center.y + Math.sin(angle) * this.trackRadius,
      };
    });
    this.homeCoords = {};
    this.goalCoords = {};
    this.baseCenters = {};
    const homeStep = 40;
    const goalRadius = this.trackRadius - (HOME_COUNT + 1) * homeStep;
    const baseOffset = this.trackRadius + 40;
    Object.entries(PLAYER_DETAILS).forEach(([id, detail]) => {
      const startAngle = angleForTrackIndex(detail.startIndex);
      this.homeCoords[id] = Array.from({ length: HOME_COUNT }, (_, idx) => {
        const radius = this.trackRadius - (idx + 1) * homeStep;
        return {
          x: this.center.x + Math.cos(startAngle) * radius,
          y: this.center.y + Math.sin(startAngle) * radius,
        };
      });

      const goalCenter = {
        x: this.center.x + Math.cos(startAngle) * goalRadius,
        y: this.center.y + Math.sin(startAngle) * goalRadius,
      };
      this.goalCoords[id] = createQuadrantPoints(goalCenter, 26);

      const baseCenter = {
        x: this.center.x + Math.cos(startAngle) * baseOffset,
        y: this.center.y + Math.sin(startAngle) * baseOffset,
      };
      this.baseCenters[id] = baseCenter;
    });
    this.baseCoords = {};
    const baseSpacing = 44;
    Object.entries(this.baseCenters).forEach(([id, center]) => {
      this.baseCoords[id] = createQuadrantPoints(center, baseSpacing);
    });
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dprAgain = window.devicePixelRatio || 1;
    this.ctx.scale(dprAgain, dprAgain);
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
    const gradient = ctx.createRadialGradient(
      this.center.x,
      this.center.y,
      40,
      this.center.x,
      this.center.y,
      this.trackRadius + 120,
    );
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#020617');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    Object.entries(PLAYER_DETAILS).forEach(([id, detail]) => {
      const baseCenter = this.baseCenters[id];
      ctx.beginPath();
      ctx.fillStyle = detail.accent;
      ctx.arc(baseCenter.x, baseCenter.y, 90, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.lineWidth = 4;
    Object.entries(PLAYER_DETAILS).forEach(([id, detail]) => {
      const startCoord = this.trackCoords[detail.startIndex];
      const homes = this.homeCoords[id];
      ctx.beginPath();
      ctx.strokeStyle = detail.color;
      ctx.moveTo(startCoord.x, startCoord.y);
      homes.forEach((coord) => ctx.lineTo(coord.x, coord.y));
      ctx.stroke();
      homes.forEach((coord, idx) => {
        ctx.beginPath();
        ctx.fillStyle = idx === HOME_COUNT - 1 ? detail.color : '#0f172a';
        ctx.arc(coord.x, coord.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = detail.color;
        ctx.stroke();
      });
    });

    this.trackCoords.forEach((coord, idx) => {
      ctx.beginPath();
      const safe = SAFE_TRACK_POSITIONS.has(idx);
      if (safe) {
        const safeGradient = ctx.createRadialGradient(coord.x, coord.y, 4, coord.x, coord.y, 18);
        safeGradient.addColorStop(0, '#fef9c3');
        safeGradient.addColorStop(0.6, '#fbbf24');
        safeGradient.addColorStop(1, '#f59e0b');
        ctx.fillStyle = safeGradient;
      } else {
        ctx.fillStyle = '#1e293b';
      }
      ctx.arc(coord.x, coord.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = safe ? '#f97316' : '#0f172a';
      ctx.stroke();
      if (safe) {
        drawStar(ctx, coord.x, coord.y, 5, 10, 4.5, '#fefce8', '#fbbf24');
      }
    });

    if (this.context.currentPlayerId && PLAYER_DETAILS[this.context.currentPlayerId]) {
      const startIdx = PLAYER_DETAILS[this.context.currentPlayerId].startIndex;
      const highlightCoord = this.trackCoords[startIdx];
      ctx.beginPath();
      ctx.strokeStyle = PLAYER_DETAILS[this.context.currentPlayerId].color;
      ctx.lineWidth = 5;
      ctx.arc(highlightCoord.x, highlightCoord.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = '#1e293b';
    ctx.arc(this.center.x, this.center.y, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();
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
          entry.basePoint = this.goalCoords[playerId]?.[goalSlot] || this.center;
          finishedTracker[playerId] = goalSlot + 1;
        } else if (entry.positionType === 'base' || entry.status === 'base') {
          entry.basePoint = this.baseCoords[playerId]?.[index] || null;
          entry.positionType = 'base';
        }

        if (!entry.basePoint) {
          entry.basePoint = this.center;
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
    const outerRadius = 18;
    const innerRadius = 12;
    const coreRadius = 7;

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
      radius: outerRadius + 4,
      playerId: entry.playerId,
      tokenIndex: entry.tokenIndex,
      highlight: entry.highlight,
    });
  }

  computeOffsets(count) {
    if (count <= 1) {
      return [{ x: 0, y: 0 }];
    }
    const radius = count <= 3 ? 14 : 18;
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

const socket = io();

const SESSION_STORAGE_KEY = 'ludo_session_token';

const state = {
  player: null,
  roomId: null,
  game: null,
  auth: {
    profile: null,
    sessionToken: null,
    ready: false,
  },
  config: {
    googleClientId: null,
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
const renderer = new BoardRenderer(boardCanvas);
if (window.ResizeObserver) {
  const resizeObserver = new ResizeObserver(() => renderer.rescale());
  resizeObserver.observe(boardCanvas);
}

function randomRoomId() {
  const adjectives = ['lucky', 'swift', 'brave', 'spark', 'bright', 'eager', 'bold'];
  const nouns = ['ludo', 'dice', 'pawn', 'race', 'track', 'token'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.floor(Math.random() * 899 + 101);
  return `${adjective}-${noun}-${suffix}`.toLowerCase();
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
  if (!profile || !state.auth.sessionToken) {
    profileSummary.classList.add('hidden');
    if (googleSignInContainer) {
      googleSignInContainer.classList.remove('hidden');
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
  if (joinSubmitBtn) {
    joinSubmitBtn.disabled = !loggedIn;
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
    setAuthMessage('Sign in with Google to continue.');
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
    if (state.config.googleClientId) {
      initializeGoogleSignIn(state.config.googleClientId);
    } else {
      state.auth.ready = true;
      updateAuthUI();
    }
  } catch (error) {
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
    diceValue.textContent = '–';
    statusMessage.textContent = '';
    if (aiControls) {
      aiControls.classList.add('hidden');
    }
    return;
  }

  const isHost = game?.players?.[0]?.id === state.player.id;
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

  const displayValue =
    (game?.turn?.dice ?? game?.turn?.lastRoll?.value ?? null) !== null
      ? game.turn.dice ?? game.turn.lastRoll.value
      : '–';
  diceValue.textContent = displayValue;

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
  if (!game) {
    renderer.draw(null, {
      currentPlayerId: state.player?.id ?? null,
      availableMoves: new Set(),
    });
    return;
  }
  roomCode.textContent = state.roomId || '—';
  if (state.player) {
    const base = `${state.player.name} (${state.player.label || state.player.id})`;
    const wins =
      typeof state.auth.profile?.wins === 'number'
        ? state.auth.profile.wins
        : typeof state.player.wins === 'number'
        ? state.player.wins
        : null;
    const games =
      typeof state.auth.profile?.games === 'number'
        ? state.auth.profile.games
        : typeof state.player.games === 'number'
        ? state.player.games
        : null;
    let record = '';
    if (typeof wins === 'number' && typeof games === 'number') {
      record = ` • Record ${wins}/${games}`;
    } else if (typeof wins === 'number') {
      record = ` • Wins ${wins}`;
    }
    playerBadge.textContent = `${base}${record}`;
  } else {
    playerBadge.textContent = '—';
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

function emitJoin(roomId, name) {
  if (!state.auth.sessionToken) {
    setJoinError('Please sign in before joining a room.');
    return;
  }
  socket.emit(
    'joinRoom',
    { roomId, playerName: name, sessionToken: state.auth.sessionToken },
    (response) => {
      if (response?.error) {
        setJoinError(response.error);
        return;
      }
      state.player = response.player;
      state.roomId = response.room;
      if (response.profile) {
        state.auth.profile = { ...(state.auth.profile || {}), ...response.profile };
        updateAuthUI();
      }
      setJoinError('');
      showGameUI();
    },
  );
}

function requestMove(tokenIndex) {
  socket.emit('moveToken', { tokenIndex }, (response) => {
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
  if (!state.auth.sessionToken) {
    setJoinError('Please sign in before joining a room.');
    return;
  }
  let name = nameInput.value.trim();
  if (!name && state.auth.profile?.name) {
    name = state.auth.profile.name.trim();
    nameInput.value = name;
  }
  if (!name) {
    setJoinError('Please provide a display name.');
    return;
  }
  emitJoin(roomId, name);
});

randomRoomBtn.addEventListener('click', () => {
  roomInput.value = randomRoomId();
});

startBtn.addEventListener('click', () => {
  socket.emit('startGame', (response) => {
    if (response?.error) {
      statusMessage.textContent = response.error;
    }
  });
});

rollBtn.addEventListener('click', () => {
  socket.emit('rollDice', (response) => {
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

if (addAiBtn) {
  addAiBtn.addEventListener('click', () => {
    if (addAiBtn.disabled) {
      return;
    }
    const difficulty = aiDifficultySelect?.value ?? 'easy';
    socket.emit('addAiPlayer', { difficulty }, (response) => {
      if (response?.error) {
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

socket.on('roomUpdate', (payload) => {
  if (!payload) {
    return;
  }
  if (state.roomId && payload.roomId !== state.roomId) {
    return;
  }
  state.roomId = payload.roomId || state.roomId;
  renderGame();
});

socket.on('gameState', (gameState) => {
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
});

socket.on('disconnect', () => {
  statusMessage.textContent = 'Connection lost. Attempting to reconnect...';
});

socket.io.on('reconnect', () => {
  statusMessage.textContent = 'Reconnected.';
  if (state.roomId && state.player) {
    socket.emit('requestState', (response) => {
      if (response?.ok) {
        state.game = response.state;
        renderGame();
      }
    });
  }
});

updateAuthUI();
restoreSession();
loadAuthConfig();

renderer.draw(null, {
  currentPlayerId: null,
  availableMoves: new Set(),
});
