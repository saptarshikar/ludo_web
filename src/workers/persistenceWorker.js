const { toGameResultRecordedEvent } = require('../domain/events/GameResultRecorded');

function createPersistenceProcessor({ profileRepository, gameRepository, logger } = {}) {
  if (!profileRepository || typeof profileRepository.recordGameResult !== 'function') {
    throw new TypeError('profileRepository with recordGameResult method is required');
  }

  return async function process(jobPayload) {
    const { payload } = toGameResultRecordedEvent(jobPayload);
    const { idempotencyKey } = payload;

    if (gameRepository && typeof gameRepository.findByIdempotencyKey === 'function') {
      const existing = await gameRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        if (logger) {
          logger({ type: 'duplicate', idempotencyKey });
        }
        return { status: 'duplicate', idempotencyKey };
      }
    }

    if (gameRepository && typeof gameRepository.recordResult === 'function') {
      await gameRepository.recordResult(payload);
    }

    const tasks = payload.participants
      .filter((participant) => participant.profileId)
      .map((participant) =>
        profileRepository.recordGameResult(participant.profileId, {
          won: participant.score > 0,
          score: participant.score,
          roomId: payload.roomId,
          turnId: payload.turnId,
        }),
      );

    await Promise.all(tasks);

    if (logger) {
      logger({ type: 'persisted', idempotencyKey, processed: tasks.length });
    }

    return { status: 'persisted', idempotencyKey };
  };
}

function createPersistenceWorker({ queue, profileRepository, gameRepository, logger } = {}) {
  if (!queue || typeof queue.subscribe !== 'function') {
    throw new TypeError('queue with a subscribe function is required');
  }

  const processor = createPersistenceProcessor({ profileRepository, gameRepository, logger });

  const unsubscribe = queue.subscribe(async (job) => {
    await processor(job.payload, job);
  });

  const retryHandler = (job, error, delay) => {
    if (logger) {
      logger({ type: 'retrying', idempotencyKey: job.payload.idempotencyKey, delay, error });
    }
  };
  const failedHandler = (job, error) => {
    if (logger) {
      logger({ type: 'failed', idempotencyKey: job.payload.idempotencyKey, error });
    }
  };

  queue.on('retrying', retryHandler);
  queue.on('failed', failedHandler);

  return {
    stop() {
      unsubscribe();
      queue.off('retrying', retryHandler);
      queue.off('failed', failedHandler);
    },
  };
}

module.exports = {
  createPersistenceWorker,
  createPersistenceProcessor,
};
