import fs from 'fs';
import pathLib from 'path';
import { build } from 'vite';

import plugin from '../vite/plugin.mjs';

function jsCodeTrim (jsCode) {
  return jsCode
    .trim()
    .replace(/\n +/g, '\n')
    .replace(/\n\n\n/g, '\n\n');
}

async function ssrBuild (entryCode) {
  const jsCode = `
    ${entryCode}

    export function getPageInfo (nameOrPath) {
      const page = pages.find(
        ({ moduleName, routePath }) => moduleName === nameOrPath || routePath === nameOrPath
      ) || null;

      return {
        ...page,
        module: modules[page.moduleName],
      };
    }
  `;

  await fs.promises.writeFile('.r4f/entry-ssr.mjs', jsCodeTrim(jsCode));

  // ===

  // const r4fRootPath = path.resolve(rootPath, 'node_modules/riot-4-fun');

  await build({
    // configFile: path.join(r4fRootPath, 'vite.config.mjs'), // To Do: config supports merged from user config and r4f defautl config.
    configFile: false,
    plugins: [ plugin() ],
    build: {
      outDir: '.r4f/server',
      ssr: true,
      rollupOptions: {
        input: '.r4f/entry-ssr.mjs',
      },
    }});

  // rename the building entry file.
  await fs.promises.rename('.r4f/entry-ssr.mjs', '.r4f/build-entry-ssr.mjs');
}

async function clientBuild (entryCode) {
  const jsCode = `
    import RiotPlugin from 'riot-4-fun/core/plugin.mjs';
    import { install, hydrate } from 'riot-4-fun/dist/runtime.min.mjs';

    ${entryCode}

    function getPageInfo (nameOrPath) {
      const page = pages.find(
        ({ moduleName, routePath }) => moduleName === nameOrPath || routePath === nameOrPath
      ) || null;

      return {
        ...page,
        module: modules[page.moduleName],
      };
    }

    window.getPageInfo = getPageInfo;
    window.hydrate = hydrate;
    window.riotPlugin = new RiotPlugin();

    install(component => window.riotPlugin.Bind(component));
  `;

  await fs.promises.writeFile('.r4f/entry-client.mjs', jsCodeTrim(jsCode));

  // ===

  // const r4fRootPath = path.resolve(rootPath, 'node_modules/riot-4-fun');

  await build({
    // configFile: path.join(r4fRootPath, 'vite.config.mjs'), // To Do: config supports merged from user config and r4f defautl config.
    configFile: false,
    plugins: [ plugin() ],
    build: {
      outDir: '.r4f/client',
      manifest: true,
      rollupOptions: {
        input: '.r4f/entry-client.mjs',
      },
    },
    resolve: {
      conditions: [ 'browser', 'module', 'import', 'default' ],
      dedupe: [ 'riot' ],
    }});

  // rename the building entry file.
  await fs.promises.rename('.r4f/entry-client.mjs', '.r4f/build-entry-client.mjs');
}

async function r4fBuild (config) {
  const rootPath = process.cwd();

  const { page } = config;

  await fs.promises.mkdir('.r4f', { recursive: true }); // make .r4f directory ready.

  const pages = Object.entries(page || {}).reduce(
    (all, [ pagePath, { body } ]) => {
      let componentPath = body.component || '';

      if (!componentPath) {
        throw new Error(`'${pagePath}' has no body.component.`);
      }

      componentPath = pathLib.resolve(rootPath, componentPath);

      if (!all.includes(componentPath)) {
        const moduleName = pathLib
          .basename(componentPath, '.riot')
          .replace(/-\w/g, matched => matched.slice(1).toUpperCase());

        all.push({
          moduleName,
          routePath: pagePath,
          sourceFilePath: '..' + componentPath.replace(rootPath, ''),
        });
      }

      return all;
    },
    []);

  const imports = pages
    .map(({ moduleName, sourceFilePath }) => `import ${moduleName} from '${sourceFilePath}';`)
    .filter((one, index, all) => all.indexOf(one) === index);

  const modules = pages
    .map(({ moduleName }) => moduleName)
    .filter((one, index, all) => all.indexOf(one) === index);

  const entryCode = `
    ${imports.join('\n')}

    const modules = {
      ${modules.join(',\n  ')}
    };

    const pages = ${
      JSON.stringify(pages)
        .replace('{', '\n  {')
        .replace(/},{/g, '},\n  {')
        .replace('}]', '}\n]')
    };

    // To Do: errorPages.
  `;

  await ssrBuild(entryCode);
  await clientBuild(entryCode);
}

export default r4fBuild;
