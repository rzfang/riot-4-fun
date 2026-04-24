// import html from 'eslint-plugin-html';
import globals from 'globals';
import jsStrictConfig from 'rzjs/eslint/config.js.strict.mjs';
import jsStyleConfig from 'rzjs/eslint/config.js.style.mjs';
import processor from './processor.mjs';

const config = {
  extends: [ 'js/recommended' ],
  files: [ '**/*.riot' ],
  processor,
  languageOptions: {
    ...jsStrictConfig.languageOptions,
    globals: { ...globals.browser, ...globals.node },
  },
  // plugins: { ...jsStyleConfig.plugins, html },
  plugins: {
    ...jsStrictConfig.plugins,
    ...jsStyleConfig.plugins,
  },
  rules: {
    ...jsStrictConfig.rules,
    ...jsStyleConfig.rules,
  },
};

export default config;
