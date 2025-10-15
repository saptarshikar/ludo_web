const SAFE_TRACK_POSITIONS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const PLAYER_CONFIGS = [
  { id: 'red', label: 'Red', startIndex: 0, color: '#ef4444' },
  { id: 'blue', label: 'Blue', startIndex: 13, color: '#3b82f6' },
  { id: 'yellow', label: 'Yellow', startIndex: 26, color: '#facc15' },
  { id: 'green', label: 'Green', startIndex: 39, color: '#22c55e' },
];

const TOKENS_PER_PLAYER = 4;
const TRACK_LENGTH = 52;
const HOME_STEPS = 6; // steps inside the home stretch, including the final goal
const FINISH_STEP = TRACK_LENGTH + HOME_STEPS - 1; // inclusive index of final square
const MAX_PLAYERS = PLAYER_CONFIGS.length;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

class LudoGame {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = []; // [{ id, name, socketId, color, isAi, difficulty, profileId, avatar, wins }]
    this.playerTokens = new Map(); // playerId -> token array
    this.playerPaths = new Map(); // playerId -> path descriptions
    this.turnIndex = 0;
    this.phase = 'waiting'; // waiting | playing | finished
    this.turnState = {
      dice: null,
      availableMoves: [],
      awaitingMove: false,
      lastRoll: null,
    };
    this.lastEvent = null;
    this.history = [];
    this.winnerId = null;
    this.createdAt = Date.now();
    this.pendingResults = null;
  }

  get availableColors() {
    const taken = new Set(this.players.map((p) => p.id));
    return PLAYER_CONFIGS.filter((config) => !taken.has(config.id));
  }

  addPlayer({ socketId, name, profileId, avatar, wins, games, isGuest } = {}) {
    if (this.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full');
    }
    const [config] = this.availableColors;
    if (!config) {
      throw new Error('No colors available');
    }
    const player = {
      id: config.id,
      name: name?.trim() || config.label,
      socketId: socketId || null,
      color: config.color,
      label: config.label,
      isAi: false,
      difficulty: null,
      profileId: profileId || null,
      avatar: avatar || null,
      wins: typeof wins === 'number' ? wins : null,
      games: typeof games === 'number' ? games : null,
      isGuest: Boolean(isGuest),
    };
    this.players.push(player);
    this.playerTokens.set(player.id, this.createInitialTokens(player.id));
    this.playerPaths.set(player.id, this.buildPath(config.startIndex));
    return player;
  }

  addAiPlayer(difficulty = 'easy') {
    if (this.phase === 'playing') {
      throw new Error('Cannot add AI during an active game');
    }
    if (this.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full');
    }
    const [config] = this.availableColors;
    if (!config) {
      throw new Error('No colors available');
    }
    const normalizedDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'easy';
    const aiNameBase = `AI (${normalizedDifficulty[0].toUpperCase()}${normalizedDifficulty.slice(1)})`;
    const duplicateCount = this.players.filter((p) => p.isAi && p.difficulty === normalizedDifficulty).length;
    const aiName = duplicateCount > 0 ? `${aiNameBase} #${duplicateCount + 1}` : aiNameBase;
    const player = {
      id: config.id,
      name: aiName,
      socketId: null,
      color: config.color,
      label: config.label,
      isAi: true,
      difficulty: normalizedDifficulty,
      profileId: null,
      avatar: null,
      wins: null,
      games: null,
    };
    this.players.push(player);
    this.playerTokens.set(player.id, this.createInitialTokens(player.id));
    this.playerPaths.set(player.id, this.buildPath(config.startIndex));
    return player;
  }

  removePlayer(socketId) {
    const index = this.players.findIndex((p) => p.socketId === socketId);
    if (index === -1) {
      return null;
    }
    const [removed] = this.players.splice(index, 1);
    this.playerTokens.delete(removed.id);
    this.playerPaths.delete(removed.id);
    if (this.turnIndex >= this.players.length) {
      this.turnIndex = 0;
    }
    if (this.players.length < 2 && this.phase === 'playing') {
      this.phase = 'waiting';
      this.resetTurnState();
    }
    if (this.players.length === 0) {
      this.phase = 'waiting';
      this.resetTurnState();
      this.winnerId = null;
      this.pendingResults = null;
    }
    return removed;
  }

  buildPath(startIndex) {
    const path = [];
    for (let i = 0; i < TRACK_LENGTH; i += 1) {
      path.push({
        type: 'track',
        index: (startIndex + i) % TRACK_LENGTH,
      });
    }
    for (let i = 0; i < HOME_STEPS; i += 1) {
      path.push({
        type: 'home',
        index: i,
      });
    }
    return path;
  }

  createInitialTokens(playerId) {
    return Array.from({ length: TOKENS_PER_PLAYER }, (_, idx) => ({
      id: `${playerId}-${idx}`,
      status: 'base',
      steps: null,
    }));
  }

  findPlayer(playerId) {
    return this.players.find((p) => p.id === playerId);
  }

  get currentPlayer() {
    return this.players[this.turnIndex] || null;
  }

  startGame(requestingPlayerId) {
    if (this.phase === 'playing') {
      throw new Error('Game already started');
    }
    if (this.players.length < 2) {
      throw new Error('Need at least two players to start');
    }
    if (this.players[0]?.id !== requestingPlayerId) {
      throw new Error('Only the host can start the game');
    }
    this.resetGameState();
    this.phase = 'playing';
    this.turnIndex = 0;
    this.resetTurnState();
    this.pushHistory({
      type: 'system',
      message: 'Game started',
    });
  }

  resetGameState() {
    for (const player of this.players) {
      this.playerTokens.set(player.id, this.createInitialTokens(player.id));
    }
    this.winnerId = null;
    this.history = [];
    this.lastEvent = null;
    this.pendingResults = null;
  }

  resetTurnState() {
    this.turnState = {
      dice: null,
      availableMoves: [],
      awaitingMove: false,
      lastRoll: this.turnState.lastRoll ?? null,
    };
  }

  rollDice(playerId) {
    if (this.phase !== 'playing') {
      throw new Error('Game not in progress');
    }
    if (this.currentPlayer?.id !== playerId) {
      throw new Error("It is not this player's turn");
    }
    if (this.turnState.awaitingMove) {
      throw new Error('Must complete move before rolling again');
    }
    const value = Math.floor(Math.random() * 6) + 1;
    const moves = this.getAvailableMoves(playerId, value);
    this.turnState.dice = value;
    this.turnState.availableMoves = moves;
    this.turnState.awaitingMove = moves.length > 0;
    this.turnState.lastRoll = { playerId, value, at: Date.now() };
    this.lastEvent = {
      type: 'dice',
      playerId,
      value,
      moves: moves.map((move) => ({
        tokenId: this.playerTokens.get(playerId)[move.tokenIndex].id,
        moveType: move.moveType,
      })),
      timestamp: Date.now(),
    };
    if (moves.length === 0) {
      this.pushHistory({
        type: 'dice',
        playerId,
        value,
        detail: 'No moves available',
      });
      // Skip turn immediately when no moves exist.
      this.advanceTurn(false);
      this.resetTurnState();
    } else {
      this.pushHistory({
        type: 'dice',
        playerId,
        value,
        detail: 'Awaiting move',
      });
    }
    return value;
  }

  getAvailableMoves(playerId, diceValue) {
    const tokens = this.playerTokens.get(playerId) || [];
    const path = this.playerPaths.get(playerId);
    const moves = [];
    tokens.forEach((token, idx) => {
      if (token.status === 'finished') {
        return;
      }
      if (token.status === 'base') {
        if (diceValue === 6) {
          moves.push({
            tokenIndex: idx,
            moveType: 'enter',
            target: path[0],
            steps: 0,
          });
        }
        return;
      }
      const newSteps = token.steps + diceValue;
      if (newSteps > FINISH_STEP) {
        return;
      }
      const target = path[newSteps];
      moves.push({
        tokenIndex: idx,
        moveType: newSteps === FINISH_STEP ? 'finish' : 'advance',
        target,
        steps: newSteps,
      });
    });
    return moves;
  }

  moveToken(playerId, tokenIndex) {
    if (this.phase !== 'playing') {
      throw new Error('Game not in progress');
    }
    if (this.currentPlayer?.id !== playerId) {
      throw new Error("It is not this player's turn");
    }
    if (!this.turnState.awaitingMove || this.turnState.dice === null) {
      throw new Error('Must roll dice before moving');
    }

    const move = this.turnState.availableMoves.find((m) => m.tokenIndex === tokenIndex);
    if (!move) {
      throw new Error('Invalid move for selected token');
    }
    const tokens = this.playerTokens.get(playerId);
    const token = tokens[tokenIndex];
    const diceValue = this.turnState.dice;
    const path = this.playerPaths.get(playerId);

    const from = this.describePosition(playerId, token);

    if (token.status === 'base') {
      token.status = 'active';
      token.steps = 0;
    } else {
      token.steps = move.steps;
      if (move.moveType === 'finish') {
        token.status = 'finished';
      }
    }

    const to = this.describePosition(playerId, token);

    const captured = [];
    if (to.type === 'track') {
      const opponents = this.getOpponentsOnTrack(playerId, to.index);
      if (opponents.length > 0 && !SAFE_TRACK_POSITIONS.has(to.index)) {
        for (const opponent of opponents) {
          const oppTokens = this.playerTokens.get(opponent.playerId);
          const oppToken = oppTokens[opponent.tokenIndex];
          oppToken.status = 'base';
          oppToken.steps = null;
          captured.push({
            playerId: opponent.playerId,
            tokenId: oppToken.id,
          });
          this.pushHistory({
            type: 'capture',
            playerId,
            victimId: opponent.playerId,
            tokenId: oppToken.id,
            location: to.index,
          });
        }
      }
    }

    if (token.status === 'finished') {
      this.pushHistory({
        type: 'finish',
        playerId,
        tokenId: token.id,
      });
    }

    const extraTurn = diceValue === 6 && this.phase === 'playing';
    this.lastEvent = {
      type: 'move',
      playerId,
      tokenId: token.id,
      from,
      to,
      diceValue,
      captured,
      extraTurn,
      timestamp: Date.now(),
    };

    this.turnState.dice = null;
    this.turnState.availableMoves = [];
    this.turnState.awaitingMove = false;

    if (this.checkWin(playerId)) {
      this.phase = 'finished';
      this.winnerId = playerId;
      this.pushHistory({
        type: 'win',
        playerId,
      });
      this.pendingResults = {
        winnerId: playerId,
        participants: this.players.map((player) => ({
          playerId: player.id,
          profileId: player.profileId,
        })),
      };
    } else if (!extraTurn) {
      this.advanceTurn(false);
    } else {
      this.pushHistory({
        type: 'bonus',
        playerId,
        detail: 'Rolled a six and received another turn',
      });
    }
  }

  advanceTurn(shuffleOrder = false) {
    if (shuffleOrder) {
      const ids = this.players.map((p) => p.id);
      const shuffled = shuffle(ids);
      this.players.sort((a, b) => shuffled.indexOf(a.id) - shuffled.indexOf(b.id));
      this.turnIndex = 0;
      return;
    }
    if (this.players.length === 0) {
      this.turnIndex = 0;
      return;
    }
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    if (this.currentPlayer?.socketId === undefined) {
      this.advanceTurn();
    }
  }

  checkWin(playerId) {
    const tokens = this.playerTokens.get(playerId) || [];
    return tokens.every((token) => token.status === 'finished');
  }

  getOpponentsOnTrack(playerId, trackIndex) {
    const opponents = [];
    for (const player of this.players) {
      if (player.id === playerId) {
        continue;
      }
      const tokens = this.playerTokens.get(player.id) || [];
      tokens.forEach((token, idx) => {
        if (token.status !== 'active') {
          return;
        }
        const position = this.describePosition(player.id, token);
        if (position.type === 'track' && position.index === trackIndex) {
          opponents.push({ playerId: player.id, tokenIndex: idx });
        }
      });
    }
    return opponents;
  }

  describePosition(playerId, token) {
    if (token.status === 'base') {
      return { type: 'base', index: null };
    }
    if (token.status === 'finished') {
      return { type: 'goal', index: FINISH_STEP };
    }
    const path = this.playerPaths.get(playerId);
    const step = token.steps;
    const segment = path?.[step];
    if (!segment) {
      return { type: 'unknown', index: null };
    }
    if (segment.type === 'track') {
      return { type: 'track', index: segment.index };
    }
    return { type: 'home', index: segment.index };
  }

  pushHistory(entry) {
    this.history.push({ ...entry, timestamp: Date.now() });
    if (this.history.length > 50) {
      this.history.shift();
    }
  }

  assignNewHostIfNeeded() {
    if (this.players.length === 0) {
      return null;
    }
    return this.players[0].id;
  }

  getState() {
    const players = this.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      label: player.label,
      isHost: this.players[0]?.id === player.id,
      isCurrent: this.currentPlayer?.id === player.id,
      isAi: player.isAi,
      difficulty: player.difficulty,
      profileId: player.profileId,
      avatar: player.avatar,
      wins: player.wins,
      games: player.games,
      isGuest: player.isGuest,
    }));
    const tokens = {};
    for (const player of this.players) {
      tokens[player.id] = (this.playerTokens.get(player.id) || []).map((token) => ({
        id: token.id,
        status: token.status,
        steps: token.steps,
        position: this.describePosition(player.id, token),
      }));
    }
    return {
      roomId: this.roomId,
      phase: this.phase,
      players,
      currentPlayerId: this.currentPlayer?.id ?? null,
      turn: {
        dice: this.turnState.dice,
        awaitingMove: this.turnState.awaitingMove,
        availableMoves: this.turnState.availableMoves,
        lastRoll: this.turnState.lastRoll,
      },
      tokens,
      lastEvent: this.lastEvent,
      history: this.history.slice(-10),
      winnerId: this.winnerId,
      maxPlayers: MAX_PLAYERS,
      availableSeats: MAX_PLAYERS - this.players.length,
      availableColors: this.availableColors.map((config) => config.id),
    };
  }

  consumeResults() {
    if (!this.pendingResults) {
      return null;
    }
    const results = this.pendingResults;
    this.pendingResults = null;
    return results;
  }
}

module.exports = {
  LudoGame,
  PLAYER_CONFIGS,
  SAFE_TRACK_POSITIONS,
  TOKENS_PER_PLAYER,
  TRACK_LENGTH,
  HOME_STEPS,
  FINISH_STEP,
  MAX_PLAYERS,
};
