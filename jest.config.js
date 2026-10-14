/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)', '<rootDir>/src/**/*.test.[jt]s?(x)'],
  // Mirrors the "@/" alias in tsconfig.json (Metro reads tsconfig, Jest does not).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // supabase/functions tests run with Deno (deno test), not Jest.
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/supabase/'],
};
