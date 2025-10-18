function mapProfileToDto(profile) {
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
    wins: profile.wins,
    games: profile.games,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function mapRoomSummary(room) {
  const state = room.game.getState();
  return {
    roomId: room.id,
    phase: state.phase,
    players: state.players,
    hostId: state.players[0]?.id ?? null,
    availableSeats: state.availableSeats,
    maxPlayers: state.maxPlayers,
  };
}

function registerGameSocketHandlers(io, {
  coordinator,
  sessionStore,
  profileRepository,
}) {
  async function broadcastRoom(room) {
    if (!room) {
      return;
    }
    await coordinator.runAiTurns(room);
    await coordinator.persistPendingResults(room);
    const state = coordinator.buildRoomState(room);
    io.to(room.id).emit('roomUpdate', mapRoomSummary(room));
    io.to(room.id).emit('gameState', state);
  }

  io.on('connection', (socket) => {
    socket.on('joinRoom', async (payload = {}, ack = () => {}) => {
      try {
        const { roomId, playerName, sessionToken, mode = 'authenticated' } = payload;
        if (!roomId || typeof roomId !== 'string') {
          ack({ error: 'Room ID is required' });
          return;
        }

        let profile = null;
        const isGuest = mode === 'guest' || !sessionToken;
        if (!isGuest) {
          const session = sessionStore.getSession(sessionToken);
          if (!session) {
            ack({ error: 'Invalid or expired session' });
            return;
          }
          profile = await profileRepository.findById(session.profileId);
          if (!profile) {
            ack({ error: 'Profile not found' });
            return;
          }
          socket.data.sessionToken = sessionToken;
        } else {
          socket.data.sessionToken = null;
        }

        const { player, room } = await coordinator.joinPlayer({
          roomId,
          socketId: socket.id,
          playerName,
          profile,
          isGuest,
        });

        const previousRoomId = socket.data.roomId;
        if (previousRoomId && previousRoomId !== room.id) {
          await socket.leave(previousRoomId);
        }
        await socket.join(room.id);

        socket.data.roomId = room.id;
        socket.data.playerId = player.id;
        socket.data.profileId = profile?.id ?? null;
        socket.data.isGuest = isGuest;

        ack({ ok: true, player, room: room.id, profile: mapProfileToDto(profile) });
        await broadcastRoom(room);
      } catch (error) {
        ack({ error: error.message || 'Failed to join room' });
      }
    });

    socket.on('addAiPlayer', async (payload = {}, ack = () => {}) => {
      try {
        const { roomId, playerId } = socket.data || {};
        if (!roomId) {
          ack({ error: 'Not in a room' });
          return;
        }
        const room = coordinator.getRoomOrFail(roomId);
        const hostSocketId = room.game.players[0]?.socketId;
        if (hostSocketId && hostSocketId !== socket.id) {
          ack({ error: 'Only the host can add AI players' });
          return;
        }
        const { player, room: updatedRoom } = await coordinator.addAiPlayer({
          roomId,
          difficulty: payload.difficulty,
        });
        ack({ ok: true, player });
        await broadcastRoom(updatedRoom);
      } catch (error) {
        ack({ error: error.message || 'Failed to add AI player' });
      }
    });

    socket.on('startGame', async (ack = () => {}) => {
      try {
        const { roomId, playerId } = socket.data || {};
        if (!roomId) {
          ack({ error: 'Not in a room' });
          return;
        }
        const room = coordinator.getRoomOrFail(roomId);
        const hostSocketId = room.game.players[0]?.socketId;
        if (hostSocketId && hostSocketId !== socket.id) {
          ack({ error: 'Only the host can start the game' });
          return;
        }
        const { room: updatedRoom } = await coordinator.startGame({ roomId, playerId });
        ack({ ok: true });
        await broadcastRoom(updatedRoom);
      } catch (error) {
        ack({ error: error.message || 'Failed to start game' });
      }
    });

    socket.on('rollDice', async (ack = () => {}) => {
      try {
        const { roomId, playerId } = socket.data || {};
        if (!roomId) {
          ack({ error: 'Not in a room' });
          return;
        }
        const { room, value } = await coordinator.rollDice({ roomId, playerId });
        ack({ ok: true, value });
        await broadcastRoom(room);
      } catch (error) {
        ack({ error: error.message || 'Failed to roll dice' });
      }
    });

    socket.on('moveToken', async (payload = {}, ack = () => {}) => {
      try {
        const { roomId, playerId } = socket.data || {};
        if (!roomId) {
          ack({ error: 'Not in a room' });
          return;
        }
        const { room } = await coordinator.moveToken({
          roomId,
          playerId,
          tokenIndex: payload.tokenIndex,
        });
        ack({ ok: true });
        await broadcastRoom(room);
      } catch (error) {
        ack({ error: error.message || 'Failed to move token' });
      }
    });

    socket.on('requestState', async (ack = () => {}) => {
      try {
        const { roomId } = socket.data || {};
        const { room } = await coordinator.requestState({ roomId });
        ack({ ok: true, state: coordinator.buildRoomState(room) });
      } catch (error) {
        ack({ error: error.message || 'No room state' });
      }
    });

    socket.on('debugEndGame', async (ack = () => {}) => {
      try {
        const { roomId, playerId } = socket.data || {};
        const room = coordinator.getRoomOrFail(roomId);
        const hostSocketId = room.game.players[0]?.socketId;
        if (hostSocketId && hostSocketId !== socket.id) {
          ack({ error: 'Only the host can trigger a test win' });
          return;
        }
        const { room: updatedRoom, winnerId } = await coordinator.debugEndGame({ roomId });
        ack({ ok: true, winnerId });
        await broadcastRoom(updatedRoom);
      } catch (error) {
        ack({ error: error.message || 'Failed to trigger test win' });
      }
    });

    socket.on('disconnect', async () => {
      const removal = await coordinator.removeSocket(socket.id);
      if (!removal || !removal.room) {
        return;
      }
      await broadcastRoom(removal.room);
    });
  });
}

module.exports = {
  registerGameSocketHandlers,
};
