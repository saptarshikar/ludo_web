const { LudoGame, GAME_PHASE } = require('../../src/domain/entities/LudoGame');
const {
  PLAYER_CONFIGS,
  TOKENS_PER_PLAYER,
  SAFE_TRACK_POSITIONS,
  FINISH_STEP,
  TRACK_LENGTH,
} = require('../../src/domain/constants');

describe('LudoGame', () => {
  let game;

  beforeEach(() => {
    game = new LudoGame('test-room');
  });

  test('adds players with unique colours and tokens', () => {
    const first = game.addPlayer({ socketId: 's1', name: 'Alice' });
    const second = game.addPlayer({ socketId: 's2', name: 'Bob' });

    expect(first.color).toBe(PLAYER_CONFIGS[0].color);
    expect(second.id).not.toBe(first.id);
    expect(game.playerTokens.get(first.id)).toHaveLength(TOKENS_PER_PLAYER);
  });

  test('startGame succeeds only for host', () => {
    const host = game.addPlayer({ socketId: 's1', name: 'Host' });
    game.addPlayer({ socketId: 's2', name: 'Guest' });

    game.startGame(host.id);
    expect(game.phase).toBe(GAME_PHASE.PLAYING);

    expect(() => game.startGame('blue')).toThrow('Game already started');
  });

  test('startGame rejects non-host invocation', () => {
    game.addPlayer({ socketId: 's1', name: 'Host' });
    const guest = game.addPlayer({ socketId: 's2', name: 'Guest' });

    expect(() => game.startGame(guest.id)).toThrow('Only the host can start the game');
  });

  test('rollDice produces deterministic value when Math.random mocked', () => {
    game.addPlayer({ socketId: 's1', name: 'Host' });
    game.addPlayer({ socketId: 's2', name: 'Guest' });
    game.startGame('red');

    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5); // -> 3 -> dice = 4
    const value = game.rollDice('red');
    expect(value).toBe(4);
    expect(game.turnState.lastRoll.value).toBe(4);
    spy.mockRestore();
  });

  test('moveToken captures opponents on unsafe squares', () => {
    const red = game.addPlayer({ socketId: 's1', name: 'Red' });
    const blue = game.addPlayer({ socketId: 's2', name: 'Blue' });
    game.startGame(red.id);

    const redTokens = game.playerTokens.get(red.id);
    const blueTokens = game.playerTokens.get(blue.id);

    redTokens[0].status = 'active';
    redTokens[0].steps = 5; // track index 5

    const targetIndex = 5;
    const blueSteps = game.playerPaths
      .get(blue.id)
      .findIndex((segment) => segment.type === 'track' && segment.index === targetIndex);

    blueTokens[0].status = 'active';
    blueTokens[0].steps = blueSteps;

    const diceValue = ((targetIndex - PLAYER_CONFIGS[0].startIndex + TRACK_LENGTH) % TRACK_LENGTH)
      - redTokens[0].steps;
    const normalizedDice = ((diceValue % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;

    game.turnState = {
      dice: normalizedDice,
      availableMoves: [{
        tokenIndex: 0,
        moveType: 'advance',
        target: { type: 'track', index: targetIndex },
        steps: redTokens[0].steps + normalizedDice,
      }],
      awaitingMove: true,
      lastRoll: { playerId: red.id, value: normalizedDice, at: Date.now() },
    };

    game.moveToken(red.id, 0);

    expect(blueTokens[0].status).toBe('base');
    expect(blueTokens[0].steps).toBeNull();
  });

  test('safe track positions prevent capture', () => {
    const red = game.addPlayer({ socketId: 's1', name: 'Red' });
    const blue = game.addPlayer({ socketId: 's2', name: 'Blue' });
    game.startGame(red.id);

    const safeIndex = SAFE_TRACK_POSITIONS[0];
    const redTokens = game.playerTokens.get(red.id);
    const blueTokens = game.playerTokens.get(blue.id);

    redTokens[0].status = 'active';
    redTokens[0].steps = 3;

    const blueSteps = game.playerPaths
      .get(blue.id)
      .findIndex((segment) => segment.type === 'track' && segment.index === safeIndex);
    blueTokens[0].status = 'active';
    blueTokens[0].steps = blueSteps;

    const diceValue = ((safeIndex - PLAYER_CONFIGS[0].startIndex + TRACK_LENGTH) % TRACK_LENGTH)
      - redTokens[0].steps;
    const normalizedDice = ((diceValue % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;

    game.turnState = {
      dice: normalizedDice,
      availableMoves: [{
        tokenIndex: 0,
        moveType: 'advance',
        target: { type: 'track', index: safeIndex },
        steps: redTokens[0].steps + normalizedDice,
      }],
      awaitingMove: true,
      lastRoll: { playerId: red.id, value: normalizedDice, at: Date.now() },
    };

    game.moveToken(red.id, 0);

    expect(blueTokens[0].status).toBe('active');
  });

  test('checkWin returns true when all tokens finished', () => {
    const red = game.addPlayer({ socketId: 's1', name: 'Red' });
    game.playerTokens.get(red.id).forEach((token) => {
      token.status = 'finished';
      token.steps = FINISH_STEP;
    });
    expect(game.checkWin(red.id)).toBe(true);
  });
});
