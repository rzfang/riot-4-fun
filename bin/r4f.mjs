#!/usr/bin/env node

import fs from 'node:fs';
import packageInfo from '../package.json' with { type: 'json' };
import path from 'node:path';
import { program } from 'commander';

import build from '../core/build.mjs';
import { runDev, runProd } from '../core/server.mjs';

const processEntry = process.cwd();

async function runDevServer (option) {
  const { config: configName = 'r4f.config.mjs' } = option;

  const configPath = path.resolve(processEntry, configName);
  const extension = configPath.split('.').at(-1);

  if (!fs.existsSync(configPath)) {
    throw new Error(`the config file '${configName}' is not existed in ${processEntry}.`);
  }

  if ((extension !== 'mjs') && (extension !== 'js')) {
    throw new Error(`the config file '${configName}' is not a .mjs.`);
  }

  const { default: config } = await import(configPath);

  runDev(config);
}

async function runBuild (option) {
  const { config: configName = 'r4f.config.mjs' } = option;

  const configPath = path.resolve(processEntry, configName);
  const extension = configPath.split('.').at(-1);

  if (!fs.existsSync(configPath)) {
    throw new Error(`the config file '${configName}' is not existed in ${processEntry}.`);
  }

  if ((extension !== 'mjs') && (extension !== 'js')) {
    throw new Error(`the config file '${configName}' is not a .mjs.`);
  }

  const { default: config } = await import(configPath);

  await build(config);
}

async function runProdServer (option) {
  const { config: configName = 'r4f.config.mjs' } = option;

  const configPath = path.resolve(processEntry, configName);

  if (!fs.existsSync(configPath)) {
    throw new Error(`the config file '${configName}' is not existed in ${processEntry}.`);
  }

  const extension = configPath.split('.').at(-1);

  if ((extension !== 'mjs') && (extension !== 'js')) {
    throw new Error(`the config file '${configName}' is not a .mjs.`);
  }

  const ssrBundlePath = path.resolve(processEntry, '.r4f/server/entry-ssr.mjs');

  if (!fs.existsSync(ssrBundlePath)) {
    throw new Error(`the SSR file '.r4f/server/entry-ssr.mjs' is not existed in ${processEntry}.`);
  }

  const clientMinifestPath = path.resolve(processEntry, '.r4f/client/.vite/manifest.json');

  if (!fs.existsSync(clientMinifestPath)) {
    throw new Error(`the client manifest file '.r4f/client/.vite/manifest.json' is not existed in ${processEntry}.`);
  }

  const { default: config } = await import(configPath);
  const { getPageInfo } = await import(ssrBundlePath);
  const { default: data } = await import(clientMinifestPath, { with: { type: 'json' }} );

  const entryClient = data['.r4f/entry-client.mjs'];

  runProd(config, getPageInfo, entryClient);
}

program
  .name('r4f')
  .description('Riot.js + Vite development CLI')
  .version(packageInfo.version);

program
  .command('dev')
  .description('Start development server')
  .option('-c, --config <config>')
  .action(runDevServer);

program
  .command('build')
  .description('Build project for production')
  .option('-c, --config <config>')
  .action(runBuild);

program
  .command('start')
  .description('Start production server')
  .option('-c, --config <config>')
  .action(runProdServer);

// program.parse(process.argv);
await program.parseAsync(process.argv);
