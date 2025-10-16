import * as riot from 'riot';
import * as ssr from '@riotjs/ssr';
import busboy from 'busboy';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import url from 'url';
import { createServer } from 'vite';

import is from '../SRC/is.js';
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
      const mimeType = mimeTypes[path.extname(filePath)] || 'text/plain';

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

  const { name } = path.parse(component);

  const moduleName = name.replace(/-\w/g, one => one.slice(1).toUpperCase());

  initialize(
    request,
    url.parse(request.url),
    (error, data) => {
      if (error < 0) {
        return next(error, `<!-- can not render '${name}' component. -->`);
      }

      const { html, css } = ssr.fragments(name, bodyModule, data);

      const body = html + '\n';
      const head = css ? `<style>${css}</style>\n` : '';
      const script = `
        <script type='module'>
          import ${moduleName} from '/${component}';

          const ${moduleName}Shell = hydrate(${moduleName});

          ${moduleName}Shell(document.querySelector('${name}'));
        </script>
      `;

      next(0, { body, head, script });
    });
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

  request.r4fMixinInstance = new mixin(request); // put riot-4-fun mixin instance into request object.

  riot.install(component => { request.r4fMixinInstance.Bind(component); }); // bind mixin functions to each component on server side rendering.

  return riotRender(
    request,
    body,
    (error, result) => {
      const { css, js } = pageConfig;
      let bodyString = '';
      let headString = getHeader(request.r4fMixinInstance, pageConfig);
      let scriptString = request.r4fMixinInstance.StorePrint();

      if (!is.Array(css)) {
        log(path + '\npage config css is not an array.', 'warn');
      }
      else {
        for (let i = 0; i < css.length; i++) {
          const cssPath = css[i];

          if (!is.String(cssPath)) {
            log('CSS path in page config is not a string.', 'warn');

            continue;
          }

          headString += `<link rel='stylesheet' type='text/css' href='${cssPath}'/>\n`;
        }
      }

      if (!is.Array(js)) {
        log(path + '\npage config js is not an array.', 'warn');
      }
      else {
        for (let i = 0; i < js.length; i++) {
          const jsPath = js[i];

          if (!is.String(jsPath)) {
            log('js path in page config is not a string.', 'warn');

            continue;
          }

          headString += `<script src='${jsPath}'></script>\n`;
        }
      }

      if (is.String(result)) {
        bodyString += result;
      }
      else {
        const { body, head, script } = result;

        headString += head + `
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
        bodyString += body;
        scriptString += script;
      }

      response.writeHead(response.statusCode, { 'Content-Type': 'text/html' });
      response.write(
        '<!DOCTYPE HTML>\n<html>\n<head>\n<meta charset=\'utf-8\'/>\n' +
        headString +
        '</head>\n<body>\n' +
        bodyString +
        scriptString +
        '</body>\n</html>\n'
      );
      response.end();
    }
  );
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
    (key, fileStream, fileName) => { // key, file stream, file name, encoding, mine type.
      const destinationPath = uploadFilePath + '/' + fileName; // destination file path.

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
    {
      path: /hydrate\.min.js$/,
      type: 'resource',
      location: './node_modules/riot-4-fun/DST',
    },
    {
      path: /riot\.min\.js$/,
      type: 'resource',
      location: './node_modules/riot-4-fun/DST',
    },
    {
      path: /riot-4-fun-mixin\.js$/,
      type: 'resource',
      location: './node_modules/riot-4-fun/SRC',
      fileName: 'Mixin.js',
    },
    ...config.route,
  ];

  // ==== resource route. ====

  route.forEach(one => {
    const {
      fileName = '',
      location = '',
      nameOnly = false,
      path: routePath,
      type,
    } = one;

    if (!routePath || !type) {
      log('the route case misses path or type.', 'error');

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
      filePath = path.resolve(process.env.PWD, location, fileName || (nameOnly ? path.basename(filePath) : filePath));

      return fileRespond(request, response, filePath);
    });
  });

  // ==== service route. ====

  const SvcCsEntrs = Object.entries(service); // service case entries.

  for (let i = 0; i < SvcCsEntrs.length; i++) {
    const [ path, Mthds ] = SvcCsEntrs[i];

    const MthdsEntrs = Object.entries(Mthds);

    for (let j = 0; j < MthdsEntrs.length; j++) {
      const [ Mthd, service ] = MthdsEntrs[j];

      if (app[Mthd]) {
        app[Mthd](path, (request, response, next) => { bodyParse(request, response, next, uploadFilePath); }); // parse body for each service.
        app[Mthd](path, (request, response) => { serviceRespond(request, response, service) });
      }
    }
  }

  // ==== import page riot components then set up page route. ====

  const pageModuleMap = await loadR4fPageModules(vite, page);

  Object.entries(page).forEach(([ path, pageConfig ]) => {
    const { body } = pageConfig;

    if (!body.initialize) {
      body.initialize = (_request, _option, callback) => callback(0, null);
    }

    if (pageModuleMap[path]) {
      body.module = pageModuleMap[path];
    }

    app.get(path, async (request, response) => {
      pageRespond(request, response, path, pageConfig);
      // response.write('hello r4f');
      // response.end();
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
