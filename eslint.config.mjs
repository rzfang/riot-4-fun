import globals from 'globals';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config';

import r4fConfig from './eslint/config.mjs';

export default defineConfig([
  r4fConfig,
  {
    files: [ '**/*.{js,mjs,cjs}' ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, jQuery: true },
    },
  },
  {
    extends: [ 'json/recommended' ],
    files: [ '**/*.json' ],
    ignores: [ 'package-lock.json' ],
    language: 'json/json',
    plugins: { json },
  },
  {
    extends: [ 'markdown/recommended' ],
    files: [ '**/*.md' ],
    language: 'markdown/gfm',
    plugins: { markdown },
  },
  {
    extends: [ 'js/recommended' ],
    files: [ '**/*.{js,mjs,cjs}' ],
    ignores: [ 'DST/*' ],
    plugins: { '@stylistic': stylistic, js },
    rules: {
      '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
      '@stylistic/dot-location': [ 'error', 'property' ],
      '@stylistic/indent': [ 'error', 2 ],
      '@stylistic/max-len': [ 'error', { code: 120, ignoreComments: true } ],
      '@stylistic/quote-props': [ 'error', 'as-needed' ],
      '@stylistic/quotes': [ 'error', 'single', { avoidEscape: true, allowTemplateLiterals: 'avoidEscape' } ],
      'no-console': [ 'warn' ],
      'no-unused-vars': [ 'warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' } ],
      'prefer-const': [ 'error' ],
      '@stylistic/comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
          imports: 'always-multiline',
          objects: 'always-multiline',
        },
      ],
    },
  },
]);
