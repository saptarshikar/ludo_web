const { GameCoordinator } = require('../../src/application/services/GameCoordinator');
const { RoomRegistry } = require('../../src/infrastructure/rooms/RoomRegistry');

describe('GameCoordinator', () => {
  let roomRegistry;
  let profileRepository;
  let resultPublisher;
  let coordinator;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    roomRegistry = new RoomRegistry();
    profileRepository = {
      recordGameResult: jest.fn().mockResolvedValue({}),
    };
    resultPublisher = {
      publishGameResult: jest.fn().mockResolvedValue({}),
    };
    coordinator = new GameCoordinator({ roomRegistry, profileRepository, resultPublisher });
  });

  test('joinPlayer adds human player and sets guest flag', async () => {
    const { player, room } = await coordinator.joinPlayer({
      roomId: 'Room42',
      socketId: 'socket-1',
      playerName: 'Alice',
      profile: null,
      isGuest: true,
    });

    expect(player.name).toBe('Alice');
    expect(player.isGuest).toBe(true);
    expect(roomRegistry.getRoom('room42').game.players).toHaveLength(1);
  });

  test('joinPlayer rejects duplicate profile in same room', async () => {
    const profile = { id: 'profile-1', name: 'Alice' };
    await coordinator.joinPlayer({
      roomId: 'lab',
      socketId: 's1',
      playerName: 'Alice',
      profile,
      isGuest: false,
    });

    await expect(
      coordinator.joinPlayer({
        roomId: 'lab',
        socketId: 's2',
        playerName: 'Alice',
        profile,
        isGuest: false,
      }),
    ).rejects.toThrow('You are already in this room from another session');
  });

  test('addAiPlayer inserts AI into room', async () => {
    await coordinator.joinPlayer({ roomId: 'ai-room', socketId: 's1', playerName: 'Host', isGuest: true });
    const { player } = await coordinator.addAiPlayer({ roomId: 'ai-room', difficulty: 'hard' });
    expect(player.isAi).toBe(true);
    expect(player.difficulty).toBe('hard');
  });

  test('debugEndGame assigns random winner and prepares pending results', async () => {
    const roomId = 'end-test';
    const host = (await coordinator.joinPlayer({ roomId, socketId: 's1', playerName: 'Host' })).player;
    await coordinator.joinPlayer({ roomId, socketId: 's2', playerName: 'Guest' });

    const { winnerId } = await coordinator.debugEndGame({ roomId });
    expect(winnerId).toBeDefined();

    const room = roomRegistry.getRoom(roomId);
    expect(room.game.phase).toBe('finished');
    expect(room.game.pendingResults).not.toBeNull();

    await coordinator.persistPendingResults(room);
    expect(resultPublisher.publishGameResult).toHaveBeenCalledTimes(1);
  });

  test('runAiTurns rolls for AI with no available moves and returns turn to human', async () => {
    const roomId = 'ai-pass';
    const host = await coordinator.joinPlayer({ roomId, socketId: 'host', playerName: 'Host', isGuest: true });
    const ai = await coordinator.addAiPlayer({ roomId, difficulty: 'easy' });
    await coordinator.startGame({ roomId, playerId: host.player.id });

    const room = roomRegistry.getRoom(roomId);
    room.game.turnIndex = room.game.players.findIndex((player) => player.id === ai.player.id);
    room.game.turnState = room.game.createInitialTurnState();

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.2); // dice rolls 2 -> no moves from base

    const actions = await coordinator.runAiTurns(room);

    expect(actions.map((action) => action.type)).toEqual(['roll']);
    expect(room.game.currentPlayer.id).toBe(host.player.id);
    expect(room.game.turnState.awaitingMove).toBe(false);

    randomSpy.mockRestore();
  });

  test('runAiTurns executes AI move when available', async () => {
    const roomId = 'ai-move';
    const host = await coordinator.joinPlayer({ roomId, socketId: 'host', playerName: 'Host' });
    const ai = await coordinator.addAiPlayer({ roomId, difficulty: 'medium' });
    await coordinator.startGame({ roomId, playerId: host.player.id });

    const room = roomRegistry.getRoom(roomId);
    room.game.turnIndex = room.game.players.findIndex((player) => player.id === ai.player.id);
    room.game.turnState = room.game.createInitialTurnState();

    const aiTokens = room.game.playerTokens.get(ai.player.id);
    aiTokens[0].status = 'active';
    aiTokens[0].steps = 0;

    const randomValues = [0.3, 0.1];
    jest.spyOn(Math, 'random').mockImplementation(() => {
      if (randomValues.length > 0) {
        return randomValues.shift();
      }
      return 0.5;
    });

    const actions = await coordinator.runAiTurns(room);

    expect(actions.map((action) => action.type)).toEqual(['roll', 'move']);
    expect(aiTokens[0].steps).toBe(2);
    expect(room.game.currentPlayer.id).toBe(host.player.id);
    expect(room.game.turnState.awaitingMove).toBe(false);
  });
});
