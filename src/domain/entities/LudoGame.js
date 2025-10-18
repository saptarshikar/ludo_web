const {
  SAFE_TRACK_POSITIONS,
  PLAYER_CONFIGS,
  TOKENS_PER_PLAYER,
  TRACK_LENGTH,
  HOME_STEPS,
  FINISH_STEP,
  MAX_PLAYERS,
} = require('../constants');
const { shuffle } = require('../utils/shuffle');

const GAME_PHASE = Object.freeze({
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
});

class LudoGame {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];
    this.playerTokens = new Map();
    this.playerPaths = new Map();
    this.turnIndex = 0;
    this.phase = GAME_PHASE.WAITING;
    this.turnState = this.createInitialTurnState();
    this.lastEvent = null;
    this.history = [];
    this.winnerId = null;
    this.createdAt = Date.now();
    this.pendingResults = null;
  }

  createInitialTurnState(lastRoll = null) {
    return {
      dice: null,
      availableMoves: [],
      awaitingMove: false,
      lastRoll,
    };
  }

  get availableColors() {
    const taken = new Set(this.players.map((player) => player.id));
    return PLAYER_CONFIGS.filter((config) => !taken.has(config.id));
  }

  createInitialTokens(playerId) {
    return Array.from({ length: TOKENS_PER_PLAYER }, (_, index) => ({
      id: `${playerId}-${index}`,
      status: 'base',
      steps: null,
    }));
  }

  buildPath(startIndex) {
    const path = [];
    for (let i = 0; i < TRACK_LENGTH; i += 1) {
      path.push({ type: 'track', index: (startIndex + i) % TRACK_LENGTH });
    }
    for (let i = 0; i < HOME_STEPS; i += 1) {
      path.push({ type: 'home', index: i });
    }
    return path;
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
      socketId: socketId ?? null,
      color: config.color,
      label: config.label,
      isAi: false,
      difficulty: null,
      profileId: profileId ?? null,
      avatar: avatar ?? null,
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
    if (this.phase === GAME_PHASE.PLAYING) {
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
    const baseName = `AI (${normalizedDifficulty[0].toUpperCase()}${normalizedDifficulty.slice(1)})`;
    const duplicateCount = this.players.filter(
      (player) => player.isAi && player.difficulty === normalizedDifficulty,
    ).length;
    const aiName = duplicateCount > 0 ? `${baseName} #${duplicateCount + 1}` : baseName;

    const aiPlayer = {
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
      isGuest: false,
    };

    this.players.push(aiPlayer);
    this.playerTokens.set(aiPlayer.id, this.createInitialTokens(aiPlayer.id));
    this.playerPaths.set(aiPlayer.id, this.buildPath(config.startIndex));
    return aiPlayer;
  }

  removePlayer(socketId) {
    const index = this.players.findIndex((player) => player.socketId === socketId);
    if (index === -1) {
      return null;
    }
    const [removed] = this.players.splice(index, 1);
    this.playerTokens.delete(removed.id);
    this.playerPaths.delete(removed.id);
    if (this.turnIndex >= this.players.length) {
      this.turnIndex = 0;
    }
    if (this.players.length < 2 && this.phase === GAME_PHASE.PLAYING) {
      this.phase = GAME_PHASE.WAITING;
      this.turnState = this.createInitialTurnState(this.turnState.lastRoll);
    }
    if (this.players.length === 0) {
      this.phase = GAME_PHASE.WAITING;
      this.turnState = this.createInitialTurnState();
      this.winnerId = null;
      this.pendingResults = null;
    }
    return removed;
  }

  get currentPlayer() {
    return this.players[this.turnIndex] || null;
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

  startGame(requestingPlayerId) {
    if (this.phase === GAME_PHASE.PLAYING) {
      throw new Error('Game already started');
    }
    if (this.players.length < 2) {
      throw new Error('Need at least two players to start');
    }
    if (this.players[0]?.id !== requestingPlayerId) {
      throw new Error('Only the host can start the game');
    }
    this.resetGameState();
    this.phase = GAME_PHASE.PLAYING;
    this.turnIndex = 0;
    this.turnState = this.createInitialTurnState();
    this.pushHistory({ type: 'system', message: 'Game started' });
  }

  getAvailableMoves(playerId, diceValue) {
    const tokens = this.playerTokens.get(playerId) || [];
    const path = this.playerPaths.get(playerId);
    const moves = [];

    tokens.forEach((token, index) => {
      if (token.status === 'finished') {
        return;
      }
      if (token.status === 'base') {
        if (diceValue === 6) {
          moves.push({ tokenIndex: index, moveType: 'enter', target: path[0], steps: 0 });
        }
        return;
      }
      const newSteps = token.steps + diceValue;
      if (newSteps > FINISH_STEP) {
        return;
      }
      const target = path[newSteps];
      moves.push({
        tokenIndex: index,
        moveType: newSteps === FINISH_STEP ? 'finish' : 'advance',
        target,
        steps: newSteps,
      });
    });
    return moves;
  }

  rollDice(playerId) {
    if (this.phase !== GAME_PHASE.PLAYING) {
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
    this.turnState = {
      dice: value,
      availableMoves: moves,
      awaitingMove: moves.length > 0,
      lastRoll: { playerId, value, at: Date.now() },
    };
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
      this.pushHistory({ type: 'dice', playerId, value, detail: 'No moves available' });
      this.advanceTurn(false);
      this.turnState = this.createInitialTurnState(this.turnState.lastRoll);
    } else {
      this.pushHistory({ type: 'dice', playerId, value, detail: 'Awaiting move' });
    }
    return value;
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
    return segment.type === 'track'
      ? { type: 'track', index: segment.index }
      : { type: 'home', index: segment.index };
  }

  getOpponentsOnTrack(playerId, trackIndex) {
    const opponents = [];
    for (const player of this.players) {
      if (player.id === playerId) {
        continue;
      }
      const tokens = this.playerTokens.get(player.id) || [];
      tokens.forEach((token, index) => {
        if (token.status !== 'active') {
          return;
        }
        const position = this.describePosition(player.id, token);
        if (position.type === 'track' && position.index === trackIndex) {
          opponents.push({ playerId: player.id, tokenIndex: index });
        }
      });
    }
    return opponents;
  }

  pushHistory(entry) {
    this.history.push({ ...entry, timestamp: Date.now() });
    if (this.history.length > 50) {
      this.history.shift();
    }
  }

  moveToken(playerId, tokenIndex) {
    if (this.phase !== GAME_PHASE.PLAYING) {
      throw new Error('Game not in progress');
    }
    if (this.currentPlayer?.id !== playerId) {
      throw new Error("It is not this player's turn");
    }
    if (!this.turnState.awaitingMove || this.turnState.dice === null) {
      throw new Error('Must roll dice before moving');
    }
    const move = this.turnState.availableMoves.find((candidate) => candidate.tokenIndex === tokenIndex);
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
      if (opponents.length > 0 && !SAFE_TRACK_POSITIONS.includes(to.index)) {
        for (const opponent of opponents) {
          const opponentTokens = this.playerTokens.get(opponent.playerId);
          const targetToken = opponentTokens[opponent.tokenIndex];
          targetToken.status = 'base';
          targetToken.steps = null;
          captured.push({ playerId: opponent.playerId, tokenId: targetToken.id });
          this.pushHistory({
            type: 'capture',
            playerId,
            victimId: opponent.playerId,
            tokenId: targetToken.id,
            location: to.index,
          });
        }
      }
    }

    if (token.status === 'finished') {
      this.pushHistory({ type: 'finish', playerId, tokenId: token.id });
    }

    const extraTurn = diceValue === 6 && this.phase === GAME_PHASE.PLAYING;
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

    this.turnState = this.createInitialTurnState(this.turnState.lastRoll);

    if (this.checkWin(playerId)) {
      this.phase = GAME_PHASE.FINISHED;
      this.winnerId = playerId;
      this.pushHistory({ type: 'win', playerId });
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
      this.pushHistory({ type: 'bonus', playerId, detail: 'Rolled a six and received another turn' });
    }
  }

  advanceTurn(shuffleOrder = false) {
    if (shuffleOrder) {
      const shuffledIds = shuffle(this.players.map((player) => player.id));
      this.players.sort((a, b) => shuffledIds.indexOf(a.id) - shuffledIds.indexOf(b.id));
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

/**
 * @typedef {ReturnType<LudoGame['getState']>} LudoGameState
 */

module.exports = {
  LudoGame,
  GAME_PHASE,
};

