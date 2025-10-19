const { randomUUID } = require('crypto');

const GAME_RESULT_RECORDED = 'domain.game_result.recorded';

const DEFAULT_SCORE_FOR_WINNER = 1;
const DEFAULT_SCORE_FOR_PARTICIPANT = 0;

function ensureNonEmptyString(value, label) {
  if (!value || typeof value !== 'string') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function ensureParticipants(participants) {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new TypeError('participants must be a non-empty array');
  }
  return participants;
}

function normalizeParticipant(participant, winnerPlayerId) {
  if (!participant || typeof participant !== 'object') {
    throw new TypeError('participant must be an object');
  }
  const playerId = ensureNonEmptyString(participant.playerId, 'participant.playerId');
  const profileId = participant.profileId ? String(participant.profileId) : null;
  const score = typeof participant.score === 'number'
    ? participant.score
    : playerId === winnerPlayerId
    ? DEFAULT_SCORE_FOR_WINNER
    : DEFAULT_SCORE_FOR_PARTICIPANT;

  return {
    playerId,
    profileId,
    score,
  };
}

function computeIdempotencyKey(roomId, turnId) {
  return `${roomId}:${turnId}`;
}

function createGameResultRecordedPayload(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }
  const roomId = ensureNonEmptyString(input.roomId, 'roomId');
  const winnerPlayerId = ensureNonEmptyString(input.winnerPlayerId, 'winnerPlayerId');
  const turnId = input.turnId ? String(input.turnId) : randomUUID();
  const timestamp = typeof input.timestamp === 'number' ? input.timestamp : Date.now();
  const participants = ensureParticipants(input.participants).map((participant) =>
    normalizeParticipant(participant, winnerPlayerId),
  );
  const winnerParticipant = participants.find((participant) => participant.playerId === winnerPlayerId) || null;
  const winnerProfileId = winnerParticipant?.profileId ?? null;
  const idempotencyKey = input.idempotencyKey || computeIdempotencyKey(roomId, turnId);

  return {
    roomId,
    turnId,
    timestamp,
    winnerPlayerId,
    winnerProfileId,
    idempotencyKey,
    participants,
    scores: participants.map((participant) => ({
      playerId: participant.playerId,
      profileId: participant.profileId,
      score: participant.score,
    })),
  };
}

function createGameResultRecordedEvent(input) {
  const payload = createGameResultRecordedPayload(input);
  return {
    type: GAME_RESULT_RECORDED,
    payload,
  };
}

function toGameResultRecordedEvent(data) {
  if (!data) {
    throw new TypeError('data is required');
  }
  if (data.type === GAME_RESULT_RECORDED && data.payload) {
    return {
      type: GAME_RESULT_RECORDED,
      payload: createGameResultRecordedPayload(data.payload),
    };
  }
  return {
    type: GAME_RESULT_RECORDED,
    payload: createGameResultRecordedPayload(data),
  };
}

module.exports = {
  GAME_RESULT_RECORDED,
  createGameResultRecordedEvent,
  createGameResultRecordedPayload,
  toGameResultRecordedEvent,
  computeIdempotencyKey,
};
