const { registerGameSocketHandlers } = require('../../../src/interfaces/socket/registerGameSocketHandlers');

function createTestIo() {
  const roomEmitter = { emit: jest.fn() };
  return {
    on: jest.fn(),
    to: jest.fn(() => roomEmitter),
    roomEmitter,
  };
}

function createTestSocket(overrides = {}) {
  const handlers = {};
  const socket = {
    id: 'socket-1',
    data: {},
    join: jest.fn(() => Promise.resolve()),
    leave: jest.fn(() => Promise.resolve()),
    emit: jest.fn(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
      return socket;
    }),
    handlers,
    ...overrides,
  };
  return socket;
}

function createRoomState() {
  return {
    phase: 'lobby',
    players: [{ id: 'player-1', name: 'Test Player', label: 'red', socketId: 'socket-1' }],
    availableSeats: 3,
    maxPlayers: 4,
    history: [],
    turn: null,
    winnerId: null,
  };
}

describe('registerGameSocketHandlers', () => {
  let io;
  let coordinator;
  let sessionStore;
  let profileRepository;

  beforeEach(() => {
    io = createTestIo();
    coordinator = {
      joinPlayer: jest.fn(),
      persistPendingResults: jest.fn(() => Promise.resolve()),
      buildRoomState: jest.fn(),
      addAiPlayer: jest.fn(),
      startGame: jest.fn(),
      rollDice: jest.fn(),
      moveToken: jest.fn(),
      requestState: jest.fn(),
      removeSocket: jest.fn(),
      debugEndGame: jest.fn(),
    };
    sessionStore = { getSession: jest.fn() };
    profileRepository = { findById: jest.fn() };
  });

  function registerAndConnect(socketOverrides = {}) {
    registerGameSocketHandlers(io, {
      coordinator,
      sessionStore,
      profileRepository,
    });

    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    const connectionHandler = io.on.mock.calls.find(([event]) => event === 'connection')[1];
    const socket = createTestSocket(socketOverrides);
    connectionHandler(socket);
    return socket;
  }

  test('joins socket to the room when a player enters', async () => {
    const roomState = createRoomState();
    const room = {
      id: 'room-123',
      game: {
        getState: jest.fn(() => roomState),
        players: roomState.players,
        availableSeats: roomState.availableSeats,
        maxPlayers: roomState.maxPlayers,
      },
    };
    coordinator.joinPlayer.mockResolvedValue({
      player: roomState.players[0],
      room,
    });
    coordinator.buildRoomState.mockReturnValue(roomState);

    const socket = registerAndConnect();
    const ack = jest.fn();

    await socket.handlers.joinRoom(
      { roomId: room.id, mode: 'guest' },
      ack,
    );

    expect(socket.join).toHaveBeenCalledWith(room.id);
    expect(ack).toHaveBeenCalledWith({
      ok: true,
      player: roomState.players[0],
      room: room.id,
      profile: null,
    });
  });

  test('leaves previous room before joining another', async () => {
    const roomState = createRoomState();
    const newRoomState = {
      ...roomState,
      players: [{ id: 'player-2', name: 'Another Player', label: 'blue', socketId: 'socket-1' }],
    };
    const room = {
      id: 'room-abc',
      game: {
        getState: jest.fn(() => newRoomState),
        players: newRoomState.players,
        availableSeats: newRoomState.availableSeats,
        maxPlayers: newRoomState.maxPlayers,
      },
    };
    coordinator.joinPlayer.mockResolvedValue({
      player: newRoomState.players[0],
      room,
    });
    coordinator.buildRoomState.mockReturnValue(newRoomState);

    const socket = registerAndConnect({ data: { roomId: 'old-room' } });
    const ack = jest.fn();

    await socket.handlers.joinRoom(
      { roomId: room.id, mode: 'guest' },
      ack,
    );

    expect(socket.leave).toHaveBeenCalledWith('old-room');
    expect(socket.join).toHaveBeenCalledWith(room.id);
    expect(socket.leave.mock.invocationCallOrder[0]).toBeLessThan(
      socket.join.mock.invocationCallOrder[0],
    );
  });
});
