const { GameResultQueue } = require('../../../src/infrastructure/messaging/GameResultQueue');

describe('GameResultQueue', () => {
  test('pauses processing until retried job completes', async () => {
    const queue = new GameResultQueue({ backoffDelay: 5 });
    const processedOrder = [];
    let firstAttempt = true;

    queue.subscribe(async (job) => {
      processedOrder.push(job.payload.id);
      if (job.payload.id === 'first' && firstAttempt) {
        firstAttempt = false;
        throw new Error('boom');
      }
    });

    await queue.add({ id: 'first' });
    await queue.add({ id: 'second' });

    const flushImmediate = () => new Promise((resolve) => setImmediate(resolve));

    await flushImmediate();
    await flushImmediate();

    expect(processedOrder).toEqual(['first']);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(processedOrder).toEqual(['first', 'first', 'second']);
  });
});
