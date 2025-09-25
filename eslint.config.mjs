import globals from 'globals';
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config';

export default defineConfig([
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
      '@stylistic/comma-dangle': [ 'error', 'always-multiline' ],
      '@stylistic/dot-location': [ 'error', 'property' ],
      '@stylistic/indent': [ 'error', 2 ],
      '@stylistic/max-len': [ 'error', { code: 120, ignoreComments: true } ],
      '@stylistic/quote-props': [ 'error', 'as-needed' ],
      '@stylistic/quotes': [ 'error', 'single', { avoidEscape: true, allowTemplateLiterals: 'avoidEscape' } ],
      'no-console': [ 'warn' ],
      'no-unused-vars': [ 'warn' ],
      'prefer-const': [ 'error' ],
    },
  },
]);
