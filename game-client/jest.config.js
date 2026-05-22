/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/assets/scripts/app/$1',
    '^@core/(.*)$': '<rootDir>/assets/scripts/core/$1',
    '^@network/(.*)$': '<rootDir>/assets/scripts/network/$1',
    '^@game/(.*)$': '<rootDir>/assets/scripts/game/$1',
    '^@utils/(.*)$': '<rootDir>/assets/scripts/utils/$1'
  }
};
