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
    // '@stylistic/comma-dangle': [ 'error', 'always-multiline' ],
    '@stylistic/comma-dangle': [
      'error',
      {
        arrays: 'always-multiline',
        // dynamicImports: 'never',
        // enums: 'never',
        exports: 'always-multiline',
        functions: 'never',
        // generics: 'never',
        // importAttributes: 'never',
        imports: 'always-multiline',
        objects: 'always-multiline',
        // tuples: 'never',
      },
    ],
    '@stylistic/dot-location': [ 'error', 'property' ],
    '@stylistic/indent': [ 'error', 2 ],
    '@stylistic/max-len': [ 'error', { code: 120, ignoreComments: true } ],
    '@stylistic/quote-props': [ 'error', 'as-needed' ],
    '@stylistic/quotes': [ 'error', 'single', { avoidEscape: true, allowTemplateLiterals: 'avoidEscape' } ],
    'no-console': [ 'warn' ],
    'no-unused-vars': [ 'warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' } ],
    'prefer-const': [ 'error' ],
  },
};

export default config;
