const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  { ignores: ['dist', 'coverage', 'src/generated'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    plugins: {
      import: importPlugin,
    },
  },
  {
    files: ['**/*.spec.ts', '**/__tests__/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
