import { riotCodeSplit } from '../helper.mjs';

const filePrefixSpacesMap = {};

const processor = {
  supportsAutofix: true,
  preprocess (text, fileName) {
    const [ _, prefixSpaces ] = text.match(/<script[^>]*>\n( *)/);
    const parts = riotCodeSplit(text);

    filePrefixSpacesMap[fileName] = prefixSpaces; // store the prefix spaces text of each line.

    let parsedText = text;

    parts.forEach(({ code, jsCode, name }) => {
      const [ headLines, tailLines ] = code.split(jsCode).map(part => {
        return (new Array(part.split('\n').length - 1)).fill('\n').join('');
      });

      const newCode = headLines +
        jsCode.replace('export default', `export const ${name} =`) +
        tailLines;

      parsedText = parsedText.replace(code, newCode);

      return headLines +
        jsCode.replace('export default', `export const ${name} =`) +
        tailLines;
    });

    parsedText = parsedText.replace(new RegExp('\n' + prefixSpaces, 'g'), '\n');

    return [ parsedText ];
  },
  postprocess (messages, fileName) {
    const prefixSpaces = filePrefixSpacesMap[fileName].length;

    messages.forEach(message => {
      message.forEach(one => {
        one.column += prefixSpaces;
      });
    });

    filePrefixSpacesMap[fileName] = undefined;

    return [].concat(...messages);
  },
};

export default processor;
