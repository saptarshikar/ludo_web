const SAFE_TRACK_POSITIONS = Object.freeze([0, 8, 13, 21, 26, 34, 39, 47]);

const PLAYER_CONFIGS = Object.freeze([
  { id: 'red', label: 'Red', startIndex: 0, color: '#ef4444' },
  { id: 'blue', label: 'Blue', startIndex: 13, color: '#3b82f6' },
  { id: 'yellow', label: 'Yellow', startIndex: 26, color: '#facc15' },
  { id: 'green', label: 'Green', startIndex: 39, color: '#22c55e' },
]);

const TOKENS_PER_PLAYER = 4;
const TRACK_LENGTH = 52;
const HOME_STEPS = 6;
const FINISH_STEP = TRACK_LENGTH + HOME_STEPS - 1;
const MAX_PLAYERS = PLAYER_CONFIGS.length;

module.exports = {
  SAFE_TRACK_POSITIONS,
  PLAYER_CONFIGS,
  TOKENS_PER_PLAYER,
  TRACK_LENGTH,
  HOME_STEPS,
  FINISH_STEP,
  MAX_PLAYERS,
};

