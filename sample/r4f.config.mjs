// TODO: this is a sample, should be updated.

import homePage from 'riot-4-fun/sample/libraries/homePage.js';
import something from 'riot-4-fun/sample/libraries/something.mjs';

export default { // riot-4-fun config.
  port: 3000,
  page: {
    '/': {
      title: '',
      favicon: '',
      feed: '',
      meta: [
        { name: 'author', content: '...' },
        { name: 'description', content: '...' },
        { name: 'keywords', content: '...' },
        { somethingElse: '...' },
      ],
      css: [ '/style.css' ],
      js: [ '/library.js' ],
      body: {
        component: './node_modules/riot-4-fun/sample/components/home.riot',
        initialize: homePage,
      },
    },
    '/page1': {
      body: {
        component: './node_modules/riot-4-fun/sample/components/page1.riot',
      },
    },
  },
  errorPage: {
    404: {
      title: '404',
      body: { component: './node_modules/riot-4-fun/sample/components/error404.riot' },
    },
    500: {
      title: '500',
      body: { component: './node_modules/riot-4-fun/sample/components/error500.riot' },
    },
  },
  service: {
    '/something/list': {
      get: something.doSomething,
      post: something.doAnother,
    },
  },
  raw: {
    '/simple-request': something.pureHttpHandle,
  },
  file: [
    {
      path: 'favicon.ico',
      location: './public',
    },
    // http://localhost:3000/somewhere/image/example.jpg > ./cache/example.jpg
    {
      path: /image\/.+\.jpg/,
      location: './cache',
      nameOnly: true,
    },
    // http://localhost:3000/somewhere/image/example.png > ./cache/somewhere/image/example.png
    {
      path: /image\/.+\.png/,
      location: './cache',
    },
  ],
};
