const { createPersistenceProcessor } = require('../../src/workers/persistenceWorker');
const { createGameResultRecordedEvent } = require('../../src/domain/events/GameResultRecorded');

describe('persistenceWorker', () => {
  test('processor persists new results and updates profiles', async () => {
    const recordGameResult = jest.fn().mockResolvedValue(undefined);
    const recordResult = jest.fn().mockResolvedValue(undefined);
    const findByIdempotencyKey = jest.fn().mockResolvedValue(null);

    const processor = createPersistenceProcessor({
      profileRepository: { recordGameResult },
      gameRepository: { recordResult, findByIdempotencyKey },
      logger: jest.fn(),
    });

    const event = createGameResultRecordedEvent({
      roomId: 'room-9',
      winnerPlayerId: 'player-1',
      participants: [
        { playerId: 'player-1', profileId: 'profile-1', score: 1 },
        { playerId: 'player-2', profileId: 'profile-2', score: 0 },
      ],
    });

    await processor(event.payload);

    expect(findByIdempotencyKey).toHaveBeenCalledWith(event.payload.idempotencyKey);
    expect(recordResult).toHaveBeenCalledWith(event.payload);
    expect(recordGameResult).toHaveBeenCalledTimes(2);
    expect(recordGameResult).toHaveBeenNthCalledWith(1, 'profile-1', expect.objectContaining({ won: true }));
    expect(recordGameResult).toHaveBeenNthCalledWith(2, 'profile-2', expect.objectContaining({ won: false }));
  });

  test('processor skips duplicates and does not update repositories', async () => {
    const recordGameResult = jest.fn().mockResolvedValue(undefined);
    const recordResult = jest.fn().mockResolvedValue(undefined);
    const findByIdempotencyKey = jest.fn().mockResolvedValue({ id: 'existing' });

    const processor = createPersistenceProcessor({
      profileRepository: { recordGameResult },
      gameRepository: { recordResult, findByIdempotencyKey },
    });

    const event = createGameResultRecordedEvent({
      roomId: 'room-4',
      winnerPlayerId: 'winner',
      participants: [
        { playerId: 'winner', profileId: 'profile-x' },
        { playerId: 'other', profileId: null },
      ],
    });

    const result = await processor(event.payload);

    expect(result).toEqual({ status: 'duplicate', idempotencyKey: event.payload.idempotencyKey });
    expect(recordResult).not.toHaveBeenCalled();
    expect(recordGameResult).not.toHaveBeenCalled();
  });
});
