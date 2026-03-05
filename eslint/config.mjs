import globals from 'globals';
import html from 'eslint-plugin-html';
import js from '@eslint/js';
import processor from './processor.mjs';
import stylistic from '@stylistic/eslint-plugin';

const config = {
  extends: [ 'js/recommended' ],
  files: [ '**/*.riot' ],
  plugins: { '@stylistic': stylistic, html, js },
  processor,
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
  },
  rules: {
    '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
    '@stylistic/dot-location': [ 'error', 'property' ],
    '@stylistic/indent': [ 'error', 2 ],
    '@stylistic/max-len': [ 'error', { code: 120, ignoreComments: true } ],
    '@stylistic/no-multiple-empty-lines': [ 'error', { max: 2, maxEOF: 1 } ],
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
};

export default config;
