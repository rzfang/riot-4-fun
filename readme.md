riot-4-fun
====
Let's play riot 4+, FOR FUN.

## It is JUST for fun.
I try to have a HTTP server solution for my only need, so there is no much wise choice or best practice.  
Everything recalls a simple concept - easy using and fun for developer.

## This project uses
* HTML, Js, CSS
* [node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/)
* [Riot](https://riot.js.org/)
* [esbuild](https://esbuild.github.io/)
* [vite](https://vite.dev/)

## Features
* [Multiple components in one single file.](#multiple-components-in-one-single-file)
* [Support Store/Context.](#support-storecontext)
* [One Js file to configure everything.](#one-js-file-to-configure-everything)
* Server side rendering (SSR).
* Can import from npm packages.
* Bundle files by page.

### Multiple components in one single file
For eaiser code arrangement, we want to tear the whole component as several parts. For example a complex `li` in `ul`. But we clearly know that all parts work together and won't needed for any others, it is really unnecessary to have another files for these parts. So we can simply write code as followed:

```html
<part1>
  This is custom component 1.
</part1>

<part2>
  This is custom component 2.
  <script>
    export default {
      components: { part1 }
    };
  </script>
</part2>

<part-three>
  This is custom component 3.
</part-three>

<final>
  <part1/>
  <part2/>
  <part-three/>
  This is the component which will be exported as the default.

  <script>
    export default {
      components: { part1, part2, partThree },
    };
  </script>
</final>
```

**Be awared that all components in the file are exported, but only the last compnent in the file will be exported as the default.**

### Support Store/Context.
For easier handling datas as context/store acrossing components, here provide a simple `<store>` component which bases on riot plugin.

```html
<component>
  Let's try "store" - {count}.
  <store name='SAMPLE_STORE' listener={sampleStoreListen}/>
  <script>
    import store from 'riot-4-fun/core/store.riot';

    export default {
      components: { store },
      state: {
        count: 0
      },
      sampleStoreListen (store, params) {
        const { count } = store;

        this.update({ count });
      },
    };
  </script>
</component>
```

### One Js file to configure everything.
riot-4-fun needs only one Js file to configure route, resource, page, and everything.

```js
import homePage from './src/lib/homePage.js';
import signIn from './src/lib/signin.js';
import something from './src/lib/something.mjs';

export default { // riot-4-fun config.
  port: 3000,
  page: {
    '/home': {
      title: '',
      description: '',
      keywords: '',
      author: '',
      favicon: '',
      feed: '',
      css: [ '/style.css' ],
      js: [ '/library.js' ],
      body: {
        component: './src/components/home.riot',
        Initialize: homePage,
      },
    },
    '/page1': {
      body: {
        component: './src/components/page1.riot'
      },
    },
  },
  errorPage: {
    '404': {
      title: '404',
      body: { component: './src/components/error404.riot' },
    },
    '500': {
      title: '500',
      body: { component: './SRC/components/error500.riot' },
    },
  },
  service: {
    '/signin': {
      post: signIn,
    },
    '/something/list': {
      get: something.getList,
      post: something.addOne,
    },
  },
  route: [
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
```
