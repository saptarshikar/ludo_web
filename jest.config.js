module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/**/index.js'],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['js', 'json', 'node'],
};
