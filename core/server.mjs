import * as riot from 'riot';
import * as ssr from '@riotjs/ssr';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import url from 'url';
import { createServer } from 'vite';

import Is from '../SRC/Is.js';
import log from '../SRC/Log.js';
import mixin from '../SRC/Mixin.js';

async function loadR4fPageModules (vite, pageConfigMap) {
  const modules = {};

  const pageConfigs = Object.entries(pageConfigMap);

  for (const [ routePath, { body } ] of pageConfigs) {
    if (!routePath || !body || !body.component) {
      throw new Error(
        `config wrong at page route rule ${routePath}. ` +
        'missed component or something?'
      );
    }

    const filePath = path.resolve(process.cwd(), body.component);

    // // const { default: moduleInstance } = await import(path.resolve(process.cwd(), body.component));
    // const { default: moduleInstance } = await import(path.resolve(process.cwd(), body.component));
    const { default: moduleInstance } = await vite.ssrLoadModule(filePath);

    modules[routePath] = moduleInstance;
  }

  return modules;
}

/*
  @ riot-4-fun mixin instance.
  @ page config.
  < HTML header inner HTML string. */
function getHeader (r4fmi, pageConfig) {
  const r4fmiPageStore = r4fmi.StoreGet('PAGE') || {}; // riot-4-fun mixin instance page store.

  const {
    author,
    description,
    favicon,
    feed,
    keywords,
    title,
  } = { ...pageConfig, ...r4fmiPageStore };

  let headString = '';

  if (title) { headString += `<title>${title}</title>\n`; }

  if (description) { headString += `<meta name='description' content='${description}'/>\n`; }

  if (keywords) { headString += `<meta name='keywords' content='${keywords}'/>\n`; }

  if (author) { headString += `<meta name='author' content='${author}'/>\n`; }

  if (favicon) { headString += `<link rel='icon' href='favicon.ico' type='${favicon}'/>\n`; }

  if (feed) { headString += `<link rel='alternate' type='application/atom+xml' title='atom' href='${feed}'/>\n`; }

  headString +=
    `<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'/>\n`;

  return headString;
}

function riotRender (Rqst, Bd, Then) {
  const { component: Cmpnt, componentJs: CmpntJs, module: Mdl } = Bd;

  const JsNm = path.basename(CmpntJs);
  const { name: Nm } = path.parse(Cmpnt); // path info.

  const MdlNm = Nm.replace(/-\w/g, Str => Str.substr(1).toUpperCase()); // module name.
  const Rslt = { // result.
    HdStr: '', // head string.
    BdStr: '', // body string.
    ScrptStr: '', // script stream.
  };

  Bd.initialize(
    Rqst,
    url.parse(Rqst.url),
    (Cd, Dt) => {
      if (Cd < 0) { return Then(null, `<!-- can not render '${Nm}' component. -->`); }

      const { html: HTML, css: CSS } = ssr.fragments(Nm, Mdl, Dt);

      Rslt.BdStr = HTML + '\n';
      Rslt.ScrptStr = `
        <script type='module'>
          import ${MdlNm} from '/${JsNm}';

          const ${MdlNm}Shell = hydrate(${MdlNm});

          ${MdlNm}Shell(document.querySelector('${Nm}'));
        </script>
      `;

      if (CSS) { Rslt.HdStr += `<style>${CSS}</style>\n`; }

      Then(null, Rslt);
    });
}

/*
  @ HTTP request object.
  @ HTTP response object.
  @ path.
  @ page config object. */
function pageRespond (request, response, path, pageConfig, error500Config = null) {
  const { body } = pageConfig;

  if (!body) {
    log(path + '\ncan not handle the body for this path.', 'warn');
    response.status(500);

    if (error500Config) { pageRespond(request, response, path, error500Config); }
    else { response.send('Error 500.'); }

    return;
  }

  request.r4fMixInstance = new mixin(request); // put riot-4-fun mixin instance into request object.

  riot.install(component => { request.r4fMixInstance.Bind(component); }); // bind mixin functions to each component on server side rendering.

  return riotRender(
    request,
    body,
    (Cd, Rslt) => {
      const { css: Css, js: Js } = pageConfig;
      let BdStrs = '';
      let HdStrs = getHeader(request.r4fMixInstance, pageConfig);
      let ScrptStrs = body.type === 'riot' ? request.r4fMixInstance.StorePrint() : '';

      if (!Is.Array(Css)) { log(path + '\npage config css is not an array.', 'warn'); }
      else {
        for (let i = 0; i < Css.length; i++) {
          const CssPth = Css[i];

          if (!Is.String(CssPth)) {
            log('CSS path in page config is not a string.', 'warn');

            continue;
          }

          HdStrs += `<link rel='stylesheet' type='text/css' href='${CssPth}'/>\n`;
        }
      }

      if (!Is.Array(Js)) { log(path + '\npage config js is not an array.', 'warn'); }
      else {
        for (let i = 0; i < Js.length; i++) {
          const JsPth = Js[i];

          if (!Is.String(JsPth)) {
            log('Js path in page config is not a string.', 'warn');

            continue;
          }

          if (JsPth.substr(-5) === '.riot') { HdStrs += `<script type='riot' src='${JsPth}'></script>\n`; }
          else { HdStrs += `<script src='${JsPth}'></script>\n`; }
        }
      }

      if (Is.String(Rslt)) {
        BdStrs += Rslt;
      }
      else {
        const { HdStr, BdStr, ScrptStr } = Rslt;

        HdStrs += HdStr + `
          <script type='importmap'>
            {
              "imports": {
                "riot": "/riot.min.js"
              }
            }
          </script>
          <script type="module">
            import * as riot from '/riot.min.js';
            import hydrate from '/hydrate.min.js';

            window.riot = riot;
            window.hydrate = hydrate;
          </script>
        `;
        BdStrs += BdStr;
        ScrptStrs += ScrptStr;
      }

      response.writeHead(response.statusCode, { 'Content-Type': 'text/html' });
      response.write(
        '<!DOCTYPE HTML>\n<html>\n<head>\n<meta charset=\'utf-8\'/>\n' +
        HdStrs +
        '</head>\n<body>\n' +
        BdStrs +
        ScrptStrs +
        '</body>\n</html>\n');
      response.end();
    }
  );
}

async function run (config) {
  const app = express();
  const { errorPage, page, port, service, uploadFilePath } = config;

  log('initialize...');

  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false })); // header handle for security.

  // === vite middleware hooks express app. ===

  const r4fRootPath = path.resolve(process.cwd(), 'node_modules/riot-4-fun');

  const vite = await createServer({
    appType: 'custom',
    configFile: path.join(r4fRootPath, 'vite.config.mjs'), // To Do: config supports merged from user config and r4f defautl config.
    server: { middlewareMode: true },
  });

  app.use(vite.middlewares);

  // === set up all config variables. ===

  const route = [
    // append necessary files.
    // {
    //   path: /hydrate\.min.js$/,
    //   type: 'resource',
    //   location: './node_modules/riot-4-fun/DST',
    // },
    // {
    //   path: /riot\.min\.js$/,
    //   type: 'resource',
    //   location: './node_modules/riot-4-fun/DST',
    // },
    // {
    //   path: /riot-4-fun-mixin\.js$/,
    //   type: 'resource',
    //   location: './node_modules/riot-4-fun/SRC',
    //   fileName: 'mixin.js',
    // },
    ...config.route,
  ];

  // ==== resource route. ====

  // route.forEach(one => {
  //   const {
  //     fileName = '',
  //     location = '',
  //     nameOnly = false,
  //     path,
  //     type,
  //   } = one;

  //   if (!path || !type) {
  //     log('the route case misses path or type.', 'error');

  //     return;
  //   }

  //   app.get(path, (request, response, next) => {
  //     const { url } = request;
  //     let filePath;

  //     switch (type) {
  //       case 'resource':
  //       case 'static': // static file response.
  //         if (!location) {
  //           log('the resource type route case ' + url + ' misses the location or mime type.', 'warn');

  //           return;
  //         }

  //         filePath = decodeURI(url.charAt(0) === '/' ? url.substr(1) : url);
  //         filePath = path.resolve(process.env.PWD, location, fileName || (nameOnly ? path.basename(filePath) : filePath));

  //         return FileRespond(request, response, filePath);

  //       default:
  //         next();
  //     }
  //   });
  // });

  // ==== service route. ====

  // const SvcCsEntrs = Object.entries(service); // service case entries.

  // for (let i = 0; i < SvcCsEntrs.length; i++) {
  //   const [ path, Mthds ] = SvcCsEntrs[i];

  //   const MthdsEntrs = Object.entries(Mthds);

  //   for (let j = 0; j < MthdsEntrs.length; j++) {
  //     const [ Mthd, Service ] = MthdsEntrs[j];

  //     if (app[Mthd]) {
  //       app[Mthd](path, BodyParse); // parse body for each service.
  //       app[Mthd](path, (request, response) => { ServiceRespond(request, response, Service) });
  //     }
  //   }
  // }

  // ==== import page riot components then set up page route. ====

  const pageModuleMap = await loadR4fPageModules(vite, page);

  Object.entries(page).forEach(([ path, pageConfig ]) => {
    const { body, component } = pageConfig;

    if (!body.initialize) {
      body.initialize = (_request, _option, callback) => callback(0, null);
    }

    if (pageModuleMap[path]) {
      body.module = pageModuleMap[path];
    }

    app.get(path, async (request, response) => {
      console.log('--- 002');
      console.log(pageConfig);

      // body.module = jsModule;

      // app.get(path, (request, response) => pageRespond(request, response, path, pageConfig));
      response.write('hello r4f');
      response.end();
    });
  });

  // ==== 404 route. ====

  // app.use((request, response) => {
  //   const Pg404 = errorPage['404'] || null;

  //   response.status(404);

  //   if (Pg404) { pageRespond(request, response, request.url, Pg404); }
  //   else { response.send('Error 404.'); }
  // });

  // === start the server. ===

  log('run...');
  app.listen(port, () => { log('server has started - 127.0.0.1:' + port.toString()); });
}

export default run;
