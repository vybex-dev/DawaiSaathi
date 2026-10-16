// ESLint flat config (the format Expo's current docs use).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'build/*', 'android/*', '.expo/*', 'supabase/functions/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // Project rule: TypeScript strict, no any.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    rules: {
      // Privacy rule: no medicine lists or personal data in logs.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
