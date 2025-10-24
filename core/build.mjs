import fs from 'fs';
import path from 'path';
import { build } from 'vite';

import log from 'rzjs/log.mjs';

async function r4fBuild (_option) {
  const processEntry = process.cwd();

  const buildDirectory = path.resolve(processEntry, '.r4f');

  if (!fs.existsSync(buildDirectory)) {
    log(`${buildDirectory} does not exist. Create it.`);
    fs.mkdirSync(buildDirectory);
  }

  await build();
  // const { config = 'r4f.mjs' } = _option;

  // const configPath = path.resolve(processEntry, config);

  // if (!fs.existsSync(configPath)) {
  //   throw new Error(`the config file '${config}' is not existed in ${processEntry}.`);
  // }


}

export default r4fBuild;
