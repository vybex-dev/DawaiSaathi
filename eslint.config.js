// ESLint flat config (the format Expo's current docs use).
// This replaces the old .eslintrc file, which newer ESLint versions no longer read by default.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'build/*',
      'android/*',
      '.expo/*',
      'supabase/functions/**',
    ],
  },
  {
    rules: {
      // Project rule: TypeScript strict, no any.
      '@typescript-eslint/no-explicit-any': 'error',
      // Privacy rule: no medicine lists or personal data in logs.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
