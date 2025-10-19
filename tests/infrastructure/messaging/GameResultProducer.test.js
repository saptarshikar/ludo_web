const { GameResultProducer } = require('../../../src/infrastructure/messaging/GameResultProducer');

describe('GameResultProducer', () => {
  test('publishGameResult enqueues structured payload with idempotency job id', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add };
    const producer = new GameResultProducer({ queue });

    const event = await producer.publishGameResult({
      roomId: 'room-1',
      winnerPlayerId: 'player-a',
      turnId: 'turn-123',
      participants: [
        { playerId: 'player-a', profileId: 'profile-1' },
        { playerId: 'player-b', profileId: null },
      ],
      timestamp: 1720000000000,
    });

    expect(add).toHaveBeenCalledTimes(1);
    const [payload, options] = add.mock.calls[0];
    expect(payload).toMatchObject({
      roomId: 'room-1',
      turnId: 'turn-123',
      idempotencyKey: 'room-1:turn-123',
    });
    expect(options).toMatchObject({
      jobId: 'room-1:turn-123',
      attempts: expect.any(Number),
      backoff: { delay: expect.any(Number), strategy: undefined },
    });
    expect(event.payload.participants).toHaveLength(2);
    expect(event.payload.scores[0]).toMatchObject({ score: 1 });
  });
});
