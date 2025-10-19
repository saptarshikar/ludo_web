const { createGameResultRecordedEvent } = require('../../domain/events/GameResultRecorded');

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF_DELAY = 1000;

class GameResultProducer {
  constructor({ queue, logger, defaultJobOptions } = {}) {
    if (!queue || typeof queue.add !== 'function') {
      throw new TypeError('queue with an add function is required');
    }
    this.queue = queue;
    this.logger = typeof logger === 'function' ? logger : null;
    this.defaultJobOptions = {
      attempts: DEFAULT_ATTEMPTS,
      backoff: {
        delay: DEFAULT_BACKOFF_DELAY,
      },
      ...(defaultJobOptions || {}),
    };
  }

  async publishGameResult(data) {
    const event = createGameResultRecordedEvent(data);
    const { payload } = event;
    const jobOptions = {
      jobId: payload.idempotencyKey,
      attempts: this.defaultJobOptions.attempts,
      backoff: {
        delay: this.defaultJobOptions.backoff.delay,
        strategy: this.defaultJobOptions.backoff.strategy,
      },
    };
    await this.queue.add(payload, jobOptions);
    if (this.logger) {
      this.logger({ type: 'enqueued', idempotencyKey: payload.idempotencyKey });
    }
    return event;
  }
}

module.exports = {
  GameResultProducer,
};
