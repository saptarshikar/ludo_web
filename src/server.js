const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { RoomManager } = require('./roomManager');
const { SAFE_TRACK_POSITIONS } = require('./game');
const { profileStore } = require('./profileStore');
const { sessionManager } = require('./sessionManager');

const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const oauthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const roomManager = new RoomManager();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/config', (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
  });
});

function getProfileSummary(profile) {
  if (!profile) {
    return null;
  }
  const { id, name, email, avatar, wins, games, createdAt, updatedAt } = profile;
  return {
    id,
    name,
    email,
    avatar,
    wins,
    games,
    createdAt,
    updatedAt,
  };
}

function processResults(room) {
  if (!room || typeof room.game.consumeResults !== 'function') {
    return;
  }
  const results = room.game.consumeResults();
  if (!results) {
    return;
  }
  const { winnerId } = results;
  results.participants.forEach(({ playerId, profileId }) => {
    if (!profileId) {
      return;
    }
    const updated = profileStore.recordGameResult(profileId, { won: winnerId === playerId });
    if (!updated) {
      return;
    }
    const player = room.game.players.find((entry) => entry.profileId === profileId);
    if (player) {
      player.wins = updated.wins;
      player.games = updated.games;
      player.avatar = updated.avatar;
      if (!player.name || player.name.trim().length === 0) {
        player.name = updated.name;
      }
    }
  });
}

function emitRoomUpdate(room) {
  processResults(room);
  const state = room.game.getState();
  io.to(room.id).emit('roomUpdate', {
    roomId: room.id,
    phase: state.phase,
    players: state.players,
    hostId: state.players[0]?.id ?? null,
    availableSeats: state.availableSeats,
    maxPlayers: state.maxPlayers,
  });
  io.to(room.id).emit('gameState', state);
}

function moveCaptures(game, playerId, move) {
  if (!move || move.target?.type !== 'track') {
    return false;
  }
  if (SAFE_TRACK_POSITIONS.has(move.target.index)) {
    return false;
  }
  const opponents = game.getOpponentsOnTrack(playerId, move.target.index);
  return opponents.length > 0;
}

function evaluateMoveScore(game, playerId, move) {
  if (!move) {
    return Number.NEGATIVE_INFINITY;
  }
  let score = 0;
  if (move.moveType === 'finish') {
    score += 120;
  }
  if (move.moveType === 'enter') {
    score += 18;
  }
  if (move.target?.type === 'home') {
    score += 35;
  }
  if (moveCaptures(game, playerId, move)) {
    score += 80;
  }
  if (typeof move.steps === 'number') {
    score += move.steps * 1.5;
  }
  if (move.moveType === 'advance' && move.target?.type === 'track') {
    score += 10;
  }
  return score;
}

function chooseAiMove(game, player) {
  const moves = game.turnState?.availableMoves || [];
  if (!moves.length) {
    return null;
  }
  const difficulty = player.difficulty || 'easy';
  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  const finishing = moves.filter((move) => move.moveType === 'finish');
  if (finishing.length) {
    return finishing[Math.floor(Math.random() * finishing.length)];
  }
  const capturing = moves.filter((move) => moveCaptures(game, player.id, move));
  if (difficulty === 'medium') {
    if (capturing.length) {
      return capturing[Math.floor(Math.random() * capturing.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }
  // Hard mode
  if (capturing.length) {
    return capturing.sort((a, b) => evaluateMoveScore(game, player.id, b) - evaluateMoveScore(game, player.id, a))[0];
  }
  const scored = moves
    .map((move) => ({ move, score: evaluateMoveScore(game, player.id, move) }))
    .sort((a, b) => b.score - a.score);
  const bestScore = scored[0]?.score ?? Number.NEGATIVE_INFINITY;
  const bestMoves = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.move);
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

async function verifyGoogleCredential(credential) {
  if (!oauthClient || !GOOGLE_CLIENT_ID) {
    throw new Error('Google sign-in is not configured');
  }
  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

function resolveSessionFromRequest(req) {
  const header = req.get('authorization');
  let token = null;
  if (header && header.toLowerCase().startsWith('bearer ')) {
    token = header.slice(7).trim();
  } else if (req.body?.token) {
    token = req.body.token;
  } else if (req.query?.token) {
    token = req.query.token;
  }
  if (!token) {
    return null;
  }
  const session = sessionManager.getSession(token);
  if (!session) {
    return null;
  }
  return { token, session };
}

app.post('/auth/google', async (req, res) => {
  try {
    if (!oauthClient) {
      res.status(500).json({ error: 'Google sign-in is not configured' });
      return;
    }
    const { credential } = req.body || {};
    if (!credential) {
      res.status(400).json({ error: 'Missing credential' });
      return;
    }
    const payload = await verifyGoogleCredential(credential);
    if (!payload?.sub) {
      res.status(401).json({ error: 'Invalid Google credential' });
      return;
    }
    const profile = profileStore.ensureProfile({
      googleSub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });
    const sessionToken = sessionManager.createSession(profile);
    res.json({
      ok: true,
      sessionToken,
      profile: getProfileSummary(profile),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Google auth error', error);
    res.status(401).json({ error: 'Failed to verify Google credential' });
  }
});

app.post('/auth/logout', (req, res) => {
  const { token } = req.body || {};
  if (token) {
    sessionManager.revokeSession(token);
  }
  res.json({ ok: true });
});

app.get('/auth/session', (req, res) => {
  const result = resolveSessionFromRequest(req);
  if (!result) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }
  const profile = profileStore.getById(result.session.profileId);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json({
    ok: true,
    sessionToken: result.token,
    profile: getProfileSummary(profile),
  });
});

function handleAiTurns(room) {
  const { game } = room;
  let iterationSafety = 0;
  while (game.phase === 'playing' && game.currentPlayer && game.currentPlayer.isAi) {
    iterationSafety += 1;
    if (iterationSafety > 40) {
      break;
    }
    const player = game.currentPlayer;
    try {
      game.rollDice(player.id);
      emitRoomUpdate(room);
      if (game.turnState.awaitingMove) {
        const choice = chooseAiMove(game, player);
        if (!choice) {
          game.turnState.awaitingMove = false;
          game.turnState.availableMoves = [];
          break;
        }
        game.moveToken(player.id, choice.tokenIndex);
        emitRoomUpdate(room);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`AI turn error in room ${room.id}:`, error);
      break;
    }
  }
}

io.on('connection', (socket) => {
  socket.on('joinRoom', (payload, ack = () => {}) => {
    const { roomId, playerName, sessionToken } = payload || {};
    if (!roomId || typeof roomId !== 'string') {
      ack({ error: 'Room ID is required' });
      return;
    }
    if (!sessionToken) {
      ack({ error: 'Authentication required' });
      return;
    }
    const session = sessionManager.getSession(sessionToken);
    if (!session) {
      ack({ error: 'Invalid or expired session' });
      return;
    }
    const profile = profileStore.getById(session.profileId);
    if (!profile) {
      ack({ error: 'Profile not found' });
      return;
    }
    const room = roomManager.getOrCreate(roomId);
    try {
      const duplicate = room.game.players.find(
        (existing) => existing.profileId && existing.profileId === profile.id,
      );
      if (duplicate) {
        ack({ error: 'You are already in this room from another session' });
        return;
      }
      const player = room.game.addPlayer({
        socketId: socket.id,
        name: playerName?.trim() || profile.name || profile.email || 'Player',
        profileId: profile.id,
        avatar: profile.avatar,
        wins: profile.wins,
        games: profile.games,
      });
      roomManager.setSocketRoom(socket.id, room.id);
      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.playerId = player.id;
      socket.data.profileId = profile.id;
      socket.data.sessionToken = sessionToken;
      ack({ ok: true, player, room: room.id, profile: getProfileSummary(profile) });
      emitRoomUpdate(room);
      handleAiTurns(room);
    } catch (err) {
      ack({ error: err.message });
    }
  });

  socket.on('addAiPlayer', (payload, ack = () => {}) => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId) {
      ack({ error: 'Not in a room' });
      return;
    }
    const room = roomManager.rooms.get(roomId);
    if (!room) {
      ack({ error: 'Room missing' });
      return;
    }
    const hostId = room.game.players[0]?.id;
    if (hostId !== playerId) {
      ack({ error: 'Only the host can add AI players' });
      return;
    }
    try {
      const { difficulty = 'easy' } = payload || {};
      const player = room.game.addAiPlayer(difficulty);
      ack({ ok: true, player });
      emitRoomUpdate(room);
      handleAiTurns(room);
    } catch (err) {
      ack({ error: err.message });
    }
  });

  socket.on('startGame', (ack = () => {}) => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId) {
      ack({ error: 'Not in a room' });
      return;
    }
    const room = roomManager.rooms.get(roomId);
    if (!room) {
      ack({ error: 'Room missing' });
      return;
    }
    try {
      room.game.startGame(playerId);
      emitRoomUpdate(room);
      handleAiTurns(room);
      ack({ ok: true });
    } catch (err) {
      ack({ error: err.message });
    }
  });

  socket.on('rollDice', (ack = () => {}) => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId) {
      ack({ error: 'Not in a room' });
      return;
    }
    const room = roomManager.rooms.get(roomId);
    if (!room) {
      ack({ error: 'Room missing' });
      return;
    }
    try {
      const value = room.game.rollDice(playerId);
      emitRoomUpdate(room);
      handleAiTurns(room);
      ack({ ok: true, value });
    } catch (err) {
      ack({ error: err.message });
    }
  });

  socket.on('moveToken', (payload, ack = () => {}) => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId) {
      ack({ error: 'Not in a room' });
      return;
    }
    const room = roomManager.rooms.get(roomId);
    if (!room) {
      ack({ error: 'Room missing' });
      return;
    }
    try {
      const { tokenIndex } = payload || {};
      room.game.moveToken(playerId, tokenIndex);
      emitRoomUpdate(room);
      handleAiTurns(room);
      ack({ ok: true });
    } catch (err) {
      ack({ error: err.message });
    }
  });

  socket.on('requestState', (ack = () => {}) => {
    const { roomId } = socket.data || {};
    const room = roomId ? roomManager.rooms.get(roomId) : null;
    if (!room) {
      ack({ error: 'No room state' });
      return;
    }
    ack({ ok: true, state: room.game.getState() });
  });

  socket.on('disconnect', () => {
    const removal = roomManager.removeSocket(socket.id);
    if (!removal) {
      return;
    }
    const { roomId } = removal;
    const room = roomManager.rooms.get(roomId);
    if (room) {
      emitRoomUpdate(room);
      handleAiTurns(room);
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ludo server listening on http://localhost:${PORT}`);
});
