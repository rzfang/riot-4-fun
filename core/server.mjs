import * as riot from 'riot';
import * as ssr from '@riotjs/ssr';
import busboy from 'busboy';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import pathLib from 'path';
import url from 'url';
import { createServer } from 'vite';

import is from 'rzjs/is.mjs';
import log from 'rzjs/log.mjs';
import RiotPlugin from './plugin.mjs';

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

    const filePath = pathLib.resolve(process.cwd(), body.component);

    const { default: moduleInstance } = await vite.ssrLoadModule(filePath);

    modules[routePath] = moduleInstance;
  }

  return modules;
}

/* HTTP file respond. this should be the end action of a request.
  @ request object.
  @ response object.
  @ file path.
  @ expired second, default 1 hour (3600 seconds). */
function fileRespond (request, response, filePath, expireSeconds = 3600) {
  const mimeTypes = {
    '.bmp':  'image/x-windows-bmp',
    '.css':  'text/css',
    '.gif':  'image/gif',
    '.ico':  'image/x-icon',
    '.jpg':  'image/jpeg',
    '.js':   'application/javascript',
    '.mjs':  'application/javascript',
    '.png':  'image/png',
    '.riot': 'application/javascript',
    '.svg':  'image/svg+xml',
    '.tag':  'text/plain',
    '.tar':  'application/x-tar',
    '.txt':  'text/plain',
    '.xml':  'application/xml',
  };

  fs.stat(
    filePath,
    (error, stat) => {
      const mimeType = mimeTypes[pathLib.extname(filePath)] || 'text/plain';

      if (error) {
        response.writeHead(
          404,
          { 'Content-Type': mimeType,
            'Content-Length': 0 });
        response.write('');
        response.end();

        return;
      }

      const expiration = expireSeconds.toString();
      const ifModifiedSince = request.headers['if-modified-since'];
      const mms = stat.mtimeMs || (new Date(stat.mtime)).getTime(); // mtime milisecond.

      if (ifModifiedSince && ifModifiedSince !== 'Invalid Date') {
        const checkedMs = (new Date(ifModifiedSince)).getTime(); // checked milisecond.

        if (mms < checkedMs) {
          response.writeHead(
            304,
            { 'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=' + expiration,
              'Last-Modified': ifModifiedSince });
          response.write('\n');
          response.end();

          return;
        }
      }

      const readStream = fs.createReadStream(filePath); // ready stream.

      response.writeHead(
        200,
        {
          'Cache-Control': 'public, max-age=' + expiration,
          'Content-Type': mimeType + '; charset=utf-8',
          'Last-Modified': (new Date(mms + 1000)).toUTCString(),
        });

      readStream.pipe(response);
    });
}

/*
  @ HTTP request object.
  @ HTTP response object.
  @ service function. */
function serviceRespond (request, response, service) {
  service(
    request,
    response,
    {
      Bd: request.body, // To Do: deprecated.
      body: request.body,
      files: request.file,
      Fls: request.file, // To Do: deprecated.
      Url: request.query, // To Do: deprecated.
      url: request.query,
    },
    (error, result) => { // code, result object.
      if (error < 0) {
        response.writeHead(400, { 'Content-Type': 'text/html' });
        response.write(is.String(result) ? result : 'error');
        response.end();

        return -1;
      }

      if (!result) {
        response.writeHead(204, { 'Content-Type': 'text/html' });
        response.write('');
        response.end();

        return 1;
      }

      if (is.Function(result)) { // take over whole process to end.
        result(response, () => { response.end(); });

        return 2;
      }

      if (!is.Object(result)) {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.write(result);
        response.end();

        return 3;
      }

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write(JSON.stringify(result));
      response.end();

      return 0;
    }
  );
}

function riotRender (request, body, next) {
  const { component, initialize, module: bodyModule } = body;

  const { name } = pathLib.parse(component);

  function goNext (error, data) {
    if (error < 0 || !bodyModule) {
      return next(
        error,
        {
          body: `can not render '${name}'.`,
          head: '',
        });
    }

    const { html, css } = ssr.fragments(name, bodyModule, data);

    const body = html + '\n';
    const head = css ? `<style>${css}</style>\n` : '';

    next(0, { body, head });
  }

  if (!is.Function(initialize)) {
    return goNext(0, null);
  }

  initialize(request, url.parse(request.url), goNext);
}

/*
  @ riot plugin instance.
  @ page config.
  < HTML header inner HTML string. */
function getHeader (riotPlugin, pageConfig) {
  const pageStore = riotPlugin.StoreGet('PAGE') || {}; // riot plugin instance page store.

  const {
    author,
    description,
    favicon,
    feed,
    keywords,
    title,
  } = { ...pageConfig, ...pageStore };

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

/*
  @ HTTP request object.
  @ HTTP response object.
  @ vite instance.
  @ path.
  @ page config object. */
function pageRespond (request, response, vite = null, path, pageConfig, entryClientPath = null, error500Config = null) {
  const { body } = pageConfig;

  if (!body) {
    log(path + '\ncan not handle the body for this path.', 'warn');
    response.status(500);

    if (error500Config) { pageRespond(request, response, vite, path, error500Config, entryClientPath); }
    else { response.send('Error 500.'); }

    return;
  }

  request.riotPlugin = new RiotPlugin(request); // put riot plugin instance into request object.

  riot.install(component => { request.riotPlugin.Bind(component); }); // bind RiotPlugin functions to each component on server side rendering.

  return riotRender(
    request,
    body,
    (error, result) => {
      const { body, head } = result;

      // === handle html head part. ===

      const { css, js } = pageConfig;
      let headString = getHeader(request.riotPlugin, pageConfig) + head;

      if (!is.Array(css)) {
        log(path + '\npage config css is not an array.', 'warn');
      }
      else {
        css.forEach(cssPath => {
          if (!is.String(cssPath)) {
            return log('CSS path in page config is not a string.', 'warn');
          }

          headString += `<link rel='stylesheet' type='text/css' href='${cssPath}'/>\n`;
        });
      }

      if (!is.Array(js)) {
        log(path + '\npage config js is not an array.', 'warn');
      }
      else {
        js.forEach(jsPath => {
          if (!is.String(jsPath)) {
            return log('js path in page config is not a string.', 'warn');
          }

          headString += `<script src='${jsPath}'></script>\n`;
        });
      }

      if (vite) {
        headString += `
          <script type="module">
            import RiotPlugin from 'riot-4-fun/core/plugin.mjs';
            import { install, hydrate } from 'riot-4-fun/core/runtime.mjs';

            window.hydrate = hydrate;
            window.riotPlugin = new RiotPlugin();

            install(component => window.riotPlugin.Bind(component));
          </script>
        `;
      } else {
        headString += `<script type='module' src='/${entryClientPath}'></script>\n`;
      }

      // === handle html body part. ===

      let bodyString = '';

      if (is.String(result)) {
        bodyString += result;
      }
      else {
        bodyString += body;
      }

      // === handle html script part. ===

      const { component } = pageConfig.body;

      const { name } = pathLib.parse(component);

      const moduleName = name.replace(/-\w/g, one => one.slice(1).toUpperCase());

      let scriptString = request.riotPlugin.StorePrint();

      if (vite) {
        scriptString += `
          <script type='module'>
            import ${moduleName} from '/${component}';

            const ${moduleName}Shell = window.hydrate(${moduleName});

            ${moduleName}Shell(document.querySelector('${name}'));
          </script>
        `;
      } else {
        scriptString += `
          <script type='module'>
            const ${moduleName} = window.getPageInfo('${moduleName}').module;

            const ${moduleName}Shell = window.hydrate(${moduleName});

            ${moduleName}Shell(document.querySelector('${name}'));
          </script>
        `;
      }

      // ===

      const htmlString = `
        <!DOCTYPE HTML>
        <html>
        <head>
        <meta charset='utf-8'/>
        ${headString}
        </head>
        <body>
        ${bodyString}
        ${scriptString}
        </body>
        </html>
      `;

      if (vite) {
        vite
          .transformIndexHtml(path, htmlString)
          .then(html => {
            response.writeHead(response.statusCode, { 'Content-Type': 'text/html' });
            response.write(html.replace(/\n +/g, ''));
            response.end();
          });
      } else {
        response.writeHead(response.statusCode, { 'Content-Type': 'text/html' });
        response.write(htmlString.replace(/\n +/g, ''));
        response.end();
      }
    });
}

function bodyParse (request, response, next, uploadFilePath) {
  if (request.method === 'POST' && request.headers['content-type'] === 'application/json') {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk.toString(); // Convert Buffer to string
    });

    request.on('end', () => {
      try {
        request.body = JSON.parse(body);
      } catch (error) {
        log(error, 'warn');
      }

      next();
    });

    return;
  }

  if (!request.is('urlencoded', 'multipart')) { return next(); } // don't handle without multipart.

  const busboyInstance = busboy({ headers: request.headers, fileSize: 1024 * 1024 * 10, files: 100 }); // file size: 10mb.

  const fields = {}; // body fields.
  const files = []; // files.

  busboyInstance.on(
    'file',
    (key, fileStream, { filename }) => { // key, file stream, file name, encoding, mine type.
      const destinationPath = uploadFilePath + '/' + filename; // destination file path.

      fileStream.pipe(fs.createWriteStream(destinationPath));
      fileStream.on('end', () => files.push(destinationPath));
    });

  busboyInstance.on(
    'field',
    (key, value) => { // key, value, fieldnameTruncated, fieldnameTruncated, encoding, mimetype.
      if (key.slice(-2) !== '[]') {
        fields[key] = value;

        return;
      }

      // ==== handle array type fields. ====

      const arrayKey = key.slice(0, key.length -2); // array key.

      if (!Object.prototype.hasOwnProperty.call(fields, arrayKey)) { fields[arrayKey] = [ value ]; }
      else { fields[arrayKey].push(value); }
    });

  busboyInstance.on('filesLimit', () => { log('upload file size is out of limitation.', 'warn'); });
  busboyInstance.on('finish', () => {
    request.body = fields;
    request.file = files;

    next();
  });
  request.pipe(busboyInstance);
}

function resourceRoute (app, config) {
  const { route } = config;

  route.forEach(one => {
    const {
      fileName = '',
      location = '',
      nameOnly = false,
      path: routePath,
    } = one;

    if (!routePath) {
      log('the route case misses path.', 'error');

      return;
    }

    app.get(routePath, (request, response, _next) => {
      const { url } = request;
      let filePath;

      if (!location) {
        log('the resource type route case ' + url + ' misses the location or mime type.', 'warn');

        return;
      }

      filePath = decodeURI(url.charAt(0) === '/' ? url.slice(1) : url);
      filePath = pathLib.resolve(
        process.env.PWD, location, fileName ||
        (nameOnly ? pathLib.basename(filePath) : filePath));

      return fileRespond(request, response, filePath);
    });
  });
}

function serviceRoute (app, config) {
  const { service, uploadFilePath } = config;

  const SvcCsEntrs = Object.entries(service); // service case entries.

  for (let i = 0; i < SvcCsEntrs.length; i++) {
    const [ path, Mthds ] = SvcCsEntrs[i];

    const MthdsEntrs = Object.entries(Mthds);

    for (let j = 0; j < MthdsEntrs.length; j++) {
      const [ Mthd, service ] = MthdsEntrs[j];

      if (app[Mthd]) {
        app[Mthd](path, (request, response, next) => { bodyParse(request, response, next, uploadFilePath); }); // parse body for each service.
        app[Mthd](path, (request, response) => { serviceRespond(request, response, service); });
      }
    }
  }
}

async function pageConfigUpdateDev (config, vite) {
  const { errorPage, page } = config;

  // ==== import page riot components. ====

  const pageModuleMap = await loadR4fPageModules(vite, page);

  Object.entries(page).forEach(([ path, pageConfig ]) => {
    const { body } = pageConfig;

    if (!body.initialize) {
      body.initialize = (_request, _option, callback) => callback(0, null);
    }

    if (pageModuleMap[path]) {
      body.module = pageModuleMap[path];
    }
  });

  // ==== import error page riot components. ====

  if (!errorPage) {
    return;
  }

  const errorPageModuleMap = await loadR4fPageModules(vite, errorPage);

  Object.entries(errorPage).forEach(([ path, pageConfig ]) => {
    const { body } = pageConfig;

    if (!body.initialize) {
      body.initialize = (_request, _option, callback) => callback(0, null);
    }

    if (errorPageModuleMap[path]) {
      body.module = errorPageModuleMap[path];
    }
  });
}

async function run (config) {
  const app = express();
  const { errorPage, page, port } = config;

  log('initialize...');

  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false })); // header handle for security.

  // === vite middleware hooks express app. ===

  const r4fRootPath = pathLib.resolve(process.cwd(), 'node_modules/riot-4-fun');

  const vite = await createServer({
    appType: 'custom',
    configFile: pathLib.join(r4fRootPath, 'vite.config.mjs'), // To Do: config supports merged from user config and r4f defautl config.
    server: { middlewareMode: true },
  });

  app.use(vite.middlewares);

  resourceRoute(app, config); // resource route.
  serviceRoute(app, config); // service route.

  // === import page and error page riot component and update the config. ===

  await pageConfigUpdateDev(config, vite);

  // ==== set up page routes. ====

  Object.entries(page).forEach(([ path, pageConfig ]) => {
    app.get(
      path,
      (request, response, next) => {
        const accept = request.headers.accept || '';

        // asset | sourcemap | vite client.
        if (!accept.includes('text/html')) {
          return next();
        }

        pageRespond(request, response, vite, path, pageConfig, null, null);
      }
    );
  });

  // ==== 404 route. ====

  app.use((request, response) => {
    const Pg404 = errorPage['404'] || null;

    response.status(404);

    if (Pg404) {
      pageRespond(request, response, vite, request.url, Pg404);
    }
    else { response.send('Error 404.'); }
  });

  // === start the server. ===

  log('run...');
  app.listen(port, () => { log('server has started - 127.0.0.1:' + port.toString()); });
}

const runDev = run;

function pageConfigUpdateProd (config, getPageInfo) {
  const { errorPage, page } = config;

  // ==== import page riot components. ====

  Object.entries(page).forEach(([ path, pageConfig ]) => {
    const { body } = pageConfig;
    const pageInfo = getPageInfo(path);

    if (!body.initialize) {
      body.initialize = (_request, _option, callback) => callback(0, null);
    }

    if (pageInfo.module) {
      body.module = pageInfo.module;
    }
  });

  // ==== import error page riot components. ====

  // To Do: error pages update.
}

async function runProd (config, getPageInfo, entryClient) {
  const app = express();
  const { errorPage, page, port } = config;

  log('initialize...');

  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false })); // header handle for security.

  resourceRoute(app, config); // resource route.
  serviceRoute(app, config); // service route.

  // === import page and error page riot component and update the config. ===

  pageConfigUpdateProd(config, getPageInfo);

  // === server assets files. ===

  app.use('/assets', express.static('.r4f/client/assets'));

  // ==== import page riot components then set up page route. ====

  Object.entries(page).forEach(([ path, pageConfig ]) => {
    const { body } = pageConfig;

    if (!body.initialize) {
      body.initialize = (_request, _option, callback) => callback(0, null);
    }

    const pageModuleInfo = getPageInfo(path);

    if (pageModuleInfo?.module) {
      body.module = pageModuleInfo.module;
    }

    app.get(
      path,
      (request, response, next) => {
        const accept = request.headers.accept || '';

        // asset | sourcemap | vite client.
        if (!accept.includes('text/html')) {
          return next();
        }

        pageRespond(request, response, null, path, pageConfig, entryClient.file, null);
      }
    );
  });

  // ==== 404 route. ====

  app.use((request, response) => {
    const Pg404 = errorPage['404'] || null;

    response.status(404);

    if (Pg404) { pageRespond(request, response, null, request.url, Pg404, entryClient.file, null); }
    else { response.send('Error 404.'); }
  });

  // === start the server. ===

  log('run...');
  app.listen(port, () => { log('server has started - 127.0.0.1:' + port.toString()); });
}

export {
  runDev,
  runProd,
};

export default run;
