import * as acorn from 'acorn';
import Concat from 'concat-with-sourcemaps';
import fs from 'fs';
import { compile } from '@riotjs/compiler';
import { SourceMapConsumer } from '@jridgewell/source-map';

import log from 'rzjs/log.mjs';
import { riotCodeSplit } from '../helper.mjs';

function getCodeBlock (code, line, range = 3, lineWidth = 80) {
  const codeBlock = code
    .split('\n')
    .slice(
      ((line - range) < 0) ? 0 : (line - range),
      line + range
    )
    .map(line => (line.length > lineWidth) ? (line.slice(0, lineWidth) + '...') : line)
    .join('\n');

  return codeBlock;
}

/*
  @ given source code so won't load file in function.
  < { code, error, map }, or null as error. */
function r4fCompile (filePath, sourceCode  = '') {
  const codeParts = riotCodeSplit(sourceCode || fs.readFileSync(filePath, 'utf8'));
  const concat = new Concat(true, filePath, '\n\n');
  let compiledCode = '';
  let compiledMap = null;
  let error = null;

  codeParts.forEach(({ code, name }) => {
    const {
      code: newCode,
      map,
    } = compile(code, { file: `${filePath}::${name}` });

    concat.add(
      `${filePath}::${name}`,
      newCode.replace(/export default/, `export const ${name} = `),
      map
    );
  });

  compiledCode = concat.content.toString() + '\n\nexport default ' + codeParts.at(-1).name + ';\n';
  compiledMap = concat.sourceMap;

  try {
    acorn.parse(compiledCode, { ecmaVersion: 'latest', sourceType: 'module' });
  }
  catch ({ loc, message }) {
    const errorCodeBlock = getCodeBlock(compiledCode, loc.line);
    let errorMessage = '';

    errorMessage += `--- error ---\nin: ${filePath}\n${message}\n\n--- the error line at compiled code ---`;
    errorMessage += errorCodeBlock;

    // === locate error source code. ===

    const consumer = new SourceMapConsumer(compiledMap);

    const position = consumer.originalPositionFor({
      line: loc.line,
      column: loc.column,
    });

    consumer.destroy();

    const sourceCodeLine = codeParts.reduce(
      (result, part, index) => {
        if (position.source.indexOf(part.name) < 0) {
          return result;
        }

        const beforeLineCount = codeParts
          .slice(0, index)
          .reduce(
            (count, part) => count + part.code.split('\n').length,
            0
          );

        return position.line + beforeLineCount + index;
      },
      0
    );

    errorMessage += '\n--- the error line at source code ---';
    errorMessage += getCodeBlock(
      codeParts.map(part => part.code).join('\n\n'),
      sourceCodeLine
    );

    log(errorMessage, 'error');

    error = new Error(errorMessage);
  }

  return {
    code: compiledCode,
    error,
    map: compiledMap,
  };
}

export default r4fCompile;
