const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF_DELAY = 1000;

function exponentialBackoff(attempt, baseDelay = DEFAULT_BACKOFF_DELAY) {
  const exponent = Math.max(attempt - 1, 0);
  return Math.min(baseDelay * 2 ** exponent, 30000);
}

class GameResultQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.jobs = [];
    this.processing = false;
    this.processor = null;
    this.defaultAttempts = options.attempts || DEFAULT_ATTEMPTS;
    this.defaultBackoffDelay = options.backoffDelay || DEFAULT_BACKOFF_DELAY;
    this.backoffStrategy =
      typeof options.backoffStrategy === 'function' ? options.backoffStrategy : exponentialBackoff;
  }

  async add(payload, options = {}) {
    const job = {
      id: options.jobId || randomUUID(),
      payload,
      attemptsMade: 0,
      attempts: options.attempts || this.defaultAttempts,
      backoffDelay: options.backoff?.delay || this.defaultBackoffDelay,
      backoffStrategy:
        typeof options.backoff?.strategy === 'function' ? options.backoff.strategy : this.backoffStrategy,
    };
    this.jobs.push(job);
    this.emit('enqueued', job);
    this.schedule();
    return job;
  }

  subscribe(processor) {
    this.processor = processor;
    this.schedule();
    return () => {
      if (this.processor === processor) {
        this.processor = null;
      }
    };
  }

  schedule() {
    if (this.processing) {
      return;
    }
    if (!this.processor) {
      return;
    }
    if (this.jobs.length === 0) {
      return;
    }
    this.processing = true;
    setImmediate(() => this.runNext());
  }

  async runNext() {
    const job = this.jobs.shift();
    if (!job) {
      this.processing = false;
      return;
    }
    try {
      await this.processor(job);
      this.emit('completed', job);
    } catch (error) {
      job.attemptsMade += 1;
      if (job.attemptsMade >= job.attempts) {
        this.emit('failed', job, error);
      } else {
        const delay = job.backoffStrategy(job.attemptsMade, job.backoffDelay);
        this.emit('retrying', job, error, delay);
        setTimeout(() => {
          this.processing = false;
          this.jobs.unshift(job);
          this.schedule();
        }, delay);
        return;
      }
    }
    this.processing = false;
    this.schedule();
  }
}

module.exports = {
  GameResultQueue,
  exponentialBackoff,
};
