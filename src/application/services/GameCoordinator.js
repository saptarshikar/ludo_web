const { SAFE_TRACK_POSITIONS, FINISH_STEP } = require('../../domain/constants');

const MAX_AI_ITERATIONS = 40;

function isCaptureMove(game, playerId, move) {
  if (!move?.target || move.target.type !== 'track') {
    return false;
  }
  if (SAFE_TRACK_POSITIONS.includes(move.target.index)) {
    return false;
  }
  const opponents = game.getOpponentsOnTrack(playerId, move.target.index);
  return opponents.length > 0;
}

function selectMoveEasy(moves) {
  if (!moves.length) {
    return null;
  }
  const index = Math.floor(Math.random() * moves.length);
  return moves[index];
}

function selectMoveMedium(game, playerId, moves) {
  if (!moves.length) {
    return null;
  }
  const finishing = moves.filter((move) => move.moveType === 'finish');
  if (finishing.length) {
    return finishing[Math.floor(Math.random() * finishing.length)];
  }
  const capturing = moves.filter((move) => isCaptureMove(game, playerId, move));
  if (capturing.length) {
    return capturing[Math.floor(Math.random() * capturing.length)];
  }
  return selectMoveEasy(moves);
}

function scoreMoveHard(game, playerId, move) {
  if (!move) {
    return Number.NEGATIVE_INFINITY;
  }
  let score = Math.random() * 0.01; // jitter to avoid deterministic ties
  if (move.moveType === 'finish') {
    score += 150;
  }
  if (move.moveType === 'enter') {
    score += 20;
  }
  if (move.target?.type === 'track') {
    if (SAFE_TRACK_POSITIONS.includes(move.target.index)) {
      score += 8;
    }
    if (isCaptureMove(game, playerId, move)) {
      score += 60;
    }
  }

  const tokens = game.playerTokens.get(playerId) || [];
  const token = tokens[move.tokenIndex];
  const previousSteps = typeof token?.steps === 'number' ? token.steps : -1;
  const nextSteps =
    move.moveType === 'enter'
      ? 0
      : typeof move.steps === 'number'
      ? move.steps
      : previousSteps;

  if (typeof nextSteps === 'number') {
    const progress = nextSteps - previousSteps;
    score += progress * 3;

    const distanceToFinish = FINISH_STEP - nextSteps;
    score += (FINISH_STEP - distanceToFinish) * 0.5;
    if (distanceToFinish <= 6) {
      score += (6 - distanceToFinish) * 5;
    }
  }

  return score;
}

function selectMoveHard(game, playerId, moves) {
  if (!moves.length) {
    return null;
  }
  let best = moves[0];
  let bestScore = scoreMoveHard(game, playerId, best);
  for (let i = 1; i < moves.length; i += 1) {
    const score = scoreMoveHard(game, playerId, moves[i]);
    if (score > bestScore) {
      best = moves[i];
      bestScore = score;
    }
  }
  return best;
}

function selectAiMove(game, player, moves) {
  switch (player.difficulty) {
    case 'medium':
      return selectMoveMedium(game, player.id, moves) || selectMoveEasy(moves);
    case 'hard':
      return selectMoveHard(game, player.id, moves) || selectMoveMedium(game, player.id, moves) || selectMoveEasy(moves);
    case 'easy':
    default:
      return selectMoveEasy(moves);
  }
}

class GameCoordinator {
  constructor({ roomRegistry, profileRepository }) {
    this.roomRegistry = roomRegistry;
    this.profileRepository = profileRepository;
  }

  getRoomOrFail(roomId) {
    const room = this.roomRegistry.getRoom(roomId);
    if (!room) {
      throw new Error('Room missing');
    }
    return room;
  }

  async persistPendingResults(room) {
    if (!room || !room.game?.consumeResults) {
      return;
    }
    const results = room.game.consumeResults();
    if (!results) {
      return;
    }
    const { winnerId } = results;
    for (const participant of results.participants) {
      if (!participant.profileId) {
        // guest or AI – skip persistence
        // eslint-disable-next-line no-continue
        continue;
      }
      try {
        await this.profileRepository.recordGameResult(participant.profileId, {
          won: winnerId === participant.playerId,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to record game result', error);
      }
    }
  }

  async joinPlayer({ roomId, socketId, playerName, profile, isGuest = false }) {
    const room = this.roomRegistry.getOrCreate(roomId);
    if (profile) {
      const isDuplicate = room.game.players.some(
        (player) => player.profileId && player.profileId === profile.id,
      );
      if (isDuplicate) {
        throw new Error('You are already in this room from another session');
      }
    }
    const player = room.game.addPlayer({
      socketId,
      name: playerName || profile?.name,
      profileId: profile?.id,
      avatar: profile?.avatar,
      wins: profile?.wins,
      games: profile?.games,
      isGuest,
    });
    this.roomRegistry.setSocketRoom(socketId, room.id);
    return { player, room };
  }

  async addAiPlayer({ roomId, difficulty }) {
    const room = this.getRoomOrFail(roomId);
    const player = room.game.addAiPlayer(difficulty);
    return { player, room };
  }

  async startGame({ roomId, playerId }) {
    const room = this.getRoomOrFail(roomId);
    room.game.startGame(playerId);
    return { room };
  }

  async rollDice({ roomId, playerId }) {
    const room = this.getRoomOrFail(roomId);
    const value = room.game.rollDice(playerId);
    return { room, value };
  }

  async moveToken({ roomId, playerId, tokenIndex }) {
    const room = this.getRoomOrFail(roomId);
    room.game.moveToken(playerId, tokenIndex);
    return { room };
  }

  async requestState({ roomId }) {
    const room = this.getRoomOrFail(roomId);
    return { room };
  }

  async removeSocket(socketId) {
    const removal = this.roomRegistry.removeSocket(socketId);
    if (!removal) {
      return null;
    }
    const room = this.roomRegistry.getRoom(removal.roomId) || null;
    return { ...removal, room };
  }

  async debugEndGame({ roomId }) {
    const room = this.getRoomOrFail(roomId);
    if (room.game.phase === 'finished') {
      throw new Error('Game already finished');
    }
    if (room.game.players.length === 0) {
      throw new Error('No players available to declare winner');
    }
    const winnerIndex = Math.floor(Math.random() * room.game.players.length);
    const winner = room.game.players[winnerIndex];
    room.game.phase = 'finished';
    room.game.winnerId = winner.id;
    room.game.pendingResults = {
      winnerId: winner.id,
      participants: room.game.players.map((participant) => ({
        playerId: participant.id,
        profileId: participant.profileId,
      })),
    };
    room.game.pushHistory({ type: 'system', message: `[TEST] ${winner.name} declared winner` });
    return { room, winnerId: winner.id };
  }

  buildRoomState(room) {
    return room.game.getState();
  }

  async runAiTurns(room, maxIterations = MAX_AI_ITERATIONS) {
    const actions = [];
    if (!room || !room.game) {
      return actions;
    }
    for (let i = 0; i < maxIterations; i += 1) {
      const action = this.executeAiStep(room.game);
      if (!action) {
        break;
      }
      actions.push(action);
      if (room.game.phase !== 'playing') {
        break;
      }
    }
    return actions;
  }

  executeAiStep(game) {
    if (!game || game.phase !== 'playing') {
      return null;
    }
    const current = game.currentPlayer;
    if (!current || !current.isAi) {
      return null;
    }

    if (!game.turnState.awaitingMove) {
      game.rollDice(current.id);
      return { type: 'roll', playerId: current.id };
    }

    const moves = Array.isArray(game.turnState.availableMoves) ? game.turnState.availableMoves.slice() : [];
    if (moves.length === 0) {
      // No legal moves despite awaitingMove flag – reset to avoid deadlock.
      game.turnState.awaitingMove = false;
      game.advanceTurn(false);
      return { type: 'skip', playerId: current.id };
    }
    const move = selectAiMove(game, current, moves) || moves[0];
    game.moveToken(current.id, move.tokenIndex);
    return { type: 'move', playerId: current.id, move };
  }
}

module.exports = {
  GameCoordinator,
};
