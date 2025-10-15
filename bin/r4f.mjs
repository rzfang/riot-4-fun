#!/usr/bin/env node

// import build from '../core/build.mjs';
import fs from 'node:fs';
import packageInfo from '../package.json' with { type: 'json' };
import path from 'node:path';
import { program } from 'commander';

import server from '../core/server.mjs';

// // 模擬 dev server
// async function startDevServer() {
//   const app = express();
//   const vite = await createServer({
//     root: path.resolve(process.cwd(), 'src'),
//     server: { middlewareMode: true },
//   });

//   app.use(vite.middlewares);
//   app.listen(5173, () => console.log('🚀 Dev server running at http://localhost:5173'));
// }

// // 模擬 build
// async function buildProject() {
//   console.log('📦 Building project...');
//   await build({
//     root: path.resolve(process.cwd(), 'src'),
//     build: {
//       outDir: path.resolve(process.cwd(), 'dist'),
//     },
//   });
//   console.log('✅ Build complete!');
// }


async function startDevServer (option) {
  const processEntry = process.cwd();
  const { config: configName = 'r4f.mjs' } = option;

  const configPath = path.resolve(processEntry, configName);
  const extension = configPath.split('.').at(-1);

  if (!fs.existsSync(configPath)) {
    throw new Error(`the config file '${configName}' is not existed in ${processEntry}.`);
  }

  if ((extension !== 'mjs') && (extension !== 'js')) {
    throw new Error(`the config file '${configName}' is not a .mjs.`);
  }

  const { default: config } = await import(configPath);

  server(config);
}

program
  .name('r4f')
  .description('Riot.js + Vite development CLI')
  .version(packageInfo.version);

program
  .command('dev')
  .description('Start development server')
  .option('-c, --config <config>')
  .action(startDevServer);

// program
//   .command('build')
//   .description('Build project for production')
//   // .option('-c, --config <config>')
//   .action(build);

program.parse(process.argv);
