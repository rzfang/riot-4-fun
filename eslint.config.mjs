import globals from 'globals';
import jsonConfig from 'rzjs/eslint/config.json.mjs';
import jsStrictConfig from 'rzjs/eslint/config.js.strict.mjs';
import jsStyleConfig from 'rzjs/eslint/config.js.style.mjs';
import mdConfig from 'rzjs/eslint/config.markdown.mjs';
import { defineConfig } from 'eslint/config';

import r4fConfig from './eslint/config.mjs';

export default defineConfig([
  {
    files: [ '**/*.{js,mjs,cjs}' ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, jQuery: true },
    },
  },
  jsonConfig,
  mdConfig,
  r4fConfig,
  { ...jsStrictConfig, ignores: [ 'dist/*' ] },
  { ...jsStyleConfig, ignores: [ 'dist/*' ] },
]);
