function riotCodeSplit (code) {
  if (!code) { return []; }

  const codes = [];

  while (code.length > 0) {
    const tagInfo = code.match(/<([^/<>]+)>\n/); // tag info.

    if (!tagInfo || !tagInfo[1]) { break; }

    const [ tagName ] = tagInfo[1].split(' '); // tag name, options.

    // === handle partial code. ===

    const startTag = `<${tagName}`; // start tag.
    const endTag = `</${tagName}>`; // end tag.
    const endIndex = code.indexOf(endTag) + endTag.length; // end index.
    const partCode = code.substring(code.indexOf(startTag), endIndex);

    // name in Js code will be from tag name with camel case.
    const name = tagName.replace(/-\w/g, Str => Str.substr(1).toUpperCase());

    // === handle partial Js code. ===

    const jsCode = (partCode.indexOf('<script>') > -1) ?
      partCode.substring(partCode.indexOf('<script>') + 8, partCode.indexOf('</script>')) :
      'export default {};';

    // ===

    codes.push({
      code: partCode,
      jsCode,
      name,
    });

    code = code.substr(endIndex);
  }

  return codes;
}


export {
  riotCodeSplit,
};
