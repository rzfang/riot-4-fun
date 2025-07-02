import globals from 'globals';
import js from '@eslint/js';
import json from '@eslint/json';
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
    files: [ '**/*.{js,mjs,cjs}' ],
    plugins: { js }, extends: [ 'js/recommended' ],
    rules: {
      'no-console': [ 'warn' ],
      "no-unused-vars": [ 'warn' ],
    },
  },
]);
