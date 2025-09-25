import * as sass from 'sass';
import async from 'async';
import fs from 'fs';
import path from 'path';
import { compile, registerPreprocessor } from '@riotjs/compiler';
import { fileURLToPath } from 'url';

import Cch from './Cache.js';
import Log from './Log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

registerPreprocessor(
  'css',
  'scss',
  Cd => {
    const { css: Css } = sass.compileString(Cd);

    return { code: Css, map: null };
  });

function SourceCodeSplit (SrcCd) {
  if (!SrcCd) { return []; }

  const Cds = [];

  while (SrcCd.length > 0) {
    const TgInfo = SrcCd.match(/<([^/<>]+)>\n/); // tag info.

    if (!TgInfo || !TgInfo[1]) { break; }

    const [ TgNm ] = TgInfo[1].split(' '); // tag name, options.

    // ==== handle partial code ====

    const StTg = `<${TgNm}>`; // start tag.
    const EndTg = `</${TgNm}>`; // end tag.
    const EndIdx = SrcCd.indexOf(EndTg) + EndTg.length; // end index.
    const Cd = SrcCd.substring(SrcCd.indexOf(StTg), EndIdx);

    // name in Js code will be from tag name with camel case.
    const Nm = TgNm.replace(/-\w/g, Str => Str.substr(1).toUpperCase());

    Cds.push({ Nm, Cd });

    SrcCd = SrcCd.substr(EndIdx);
  }

  return Cds;
}

/*
  @ source code.
  < source code without comments. */
function CommentsClean (SrcCd) {
  return SrcCd.replace(/\/\/ ?import .+\n/g, '\n');
}

/* to handle specific file path cases.
  @ file path.
  < adjusted file path. */
function FilePathAdjust (FlPth) {
  if (FlPth.includes('riot-4-fun/SRC/Store.riot')) {
    return path.resolve(__dirname, './Store.riot');
  }

  return FlPth;
}

function ModulesCompile (FlPth, Then) {
  Cch.FileLoad(
    FlPth,
    (ErrCd, SrcCd) => { // error code, source code, cached date.
      if (ErrCd < 0) {
        Log('cache file load failed: ' + ErrCd + ' ' + FlPth, 'error');

        return Then(-1, []);
      }

      SrcCd = SrcCd
        .replace(/<!--[\s\S]+?-->/g, '') // trim all HTML comments.
        .replace(/\/\/ ?import .+ from .+/g, ''); // trim comment import.

      // ==== get all 'import ... from ...;' and remove them from source code. ====

      const Mdls = SrcCd.match(/import .+ from .+;\n/g) || []; // modules.
      let Tsks = [];

      SrcCd = SrcCd.replace(/import .+ from .+;\n/g, '');

      // ====

      // prepare import components compiling tasks.
      Tsks = Mdls
        .filter((Itm, Idx) => Mdls.indexOf(Itm) === Idx) // filter duplicate modules.
        .map(Mdl => {
          const [ , Nm, Pth ] = Mdl.match(/import (.+) from '(.+)';/);

          // non riot import handling.
          if (Pth.substr(-5) !== '.riot') {
            return Done => Done(null, { [Pth]: `const ${Nm} = require('${Pth}');` });
          }

          return Done => {
            ModulesCompile(
              path.dirname(FlPth) + '/' + Pth, // handle module path.
              (ErrCd, RsltMdls) => {
                if (ErrCd < 0) {
                  Log('can not do ModulesCompile. error code: ' + ErrCd, 'error');

                  return Done(ErrCd);
                }

                Done(null, RsltMdls);
              });
          };
        });

      async.parallel(
        Tsks,
        (Err, Mdls) => {
          if (Err) {
            Log(Err, 'error');

            return Then(-2, []);
          }

          const RsltMdls = {}; // packed Js module codes.

          Mdls.map(Mdl => { Object.assign(RsltMdls, Mdl); });

          // ==== compile separated component, and combine them after parse. ====

          SourceCodeSplit(SrcCd).map(({ Nm, Cd }) => {
            if (RsltMdls[Nm]) { return ; }

            // console.Log('--- 001 ---');
            // console.Log(Nm);
            // console.Log(Cd);

            RsltMdls[Nm] = compile(Cd).code.replace('export default', Nm + ' ='); // trim 'export default'.
          }); // adjust compiled code to be ready for becoming a single Js module.

          Then(0, RsltMdls);
        });
    });
}

/* compile riot 4 component file with some more feature support.
  @ file path.
  @ type, can be 'node' or 'esm', default 'esm'.
  @ callback function (error code, code string). */
export function Compile (FlPth, Tp = 'esm', Then) {
  const CchKy = `${FlPth}-${Tp}`;

  if (Cch.Has(CchKy)) { return Then(1, Cch.Get(CchKy)); }

  ModulesCompile(
    FlPth,
    (ErrCd, Mdls) => {
      const KyVPrs = Object.entries(Mdls);

      const RiotMdlKys = []; // Riot module keys.
      let JsMdlCd = ''; // Js module code.
      let RiotMdlCd = ''; // Riot module code.

      for (let i = 0; i < KyVPrs.length; i++) {
        const [ Ky, V ] = KyVPrs[i];

        if (typeof V === 'object') {
          const { Nm, Pth } = V;

          JsMdlCd += (Tp === 'node') ?
            `const ${Nm} = require('${Pth}');\n` :
            `import ${Nm} from '${Pth}';\n`;
        }
        else {
          RiotMdlCd += V + '\n\n';
          RiotMdlKys.push(Ky);
        }
      }

      let RsltCd =
        JsMdlCd + '\n' +
        'let ' + RiotMdlKys.join(', ') + ';\n\n' +
        RiotMdlCd;

      RsltCd += (Tp === 'node') ?
        ('\nmodule.exports.default = ' + RiotMdlKys.pop() + ';\n') :
        ('\nexport default ' + RiotMdlKys.pop() + ';\n');

      Then(0, RsltCd);
      Cch.Set(CchKy, RsltCd, 60 * 60 * 24);

      // === this is for debug to save the compiled source code to file. ===

      // const FlNm = FlPth.substr(FlPth.lastIndexOf('/'));

      // fs.writeFileSync(`./TMP/${FlNm}`, RsltCd);
    });
}

/* compile a Riot.js component source code.
  @ file path.
  @ extension. optional, can be 'js', 'ms'. default 'js'.
  @ the flag to merge imports. optional, default false.
  < compiled component Js code object { ExprtDflt, Imprts, JsCd }.
    @ export default.
    @ imports.
    @ modules Js code. */
export function Compile2 (FlPth, Extnsn = 'js', MrgImprts = false) {
  FlPth = FilePathAdjust(FlPth);

  const MdlsSrcCds = SourceCodeSplit(fs.readFileSync(FlPth, 'utf8')); // modules source codes.
  const NwExtnsn = `.riot.${Extnsn}`; // new extension.
  const RsltImprts = []; // result import modules.
  let RsltMdlCds = []; // result modules code.

  MdlsSrcCds.forEach(({ Nm, Cd }) => {
    const RE = /import .+\n+/g; // regular expression.
    let RsltCd = compile(Cd).code.replace('export default', `const ${Nm} =`); //result code; take off 'export default'.

    RsltCd = CommentsClean(RsltCd); // take off all comments.

    let Imprts = RsltCd.match(RE) || [];

    Imprts = Imprts.map(Imprt => Imprt.replace('.riot', NwExtnsn).replace(/\n+/, ''));
    RsltCd = RsltCd.replace(RE, '');

    Imprts.forEach(Imprt => {
      if (!RsltImprts.includes(Imprt)) { RsltImprts.push(Imprt); }
    });

    RsltMdlCds.push({ Nm, Cd: RsltCd });
  });

  if (MrgImprts) {
    const ExtrMdlCds = []; // extra module codes.
    const RsltMdlNms = RsltMdlCds.map(({ Nm }) => Nm); // result module names.

    [ ...RsltImprts ].forEach(Imprt => { // clone then work.
      if (Imprt.indexOf(NwExtnsn) < 0) { return; }

      RsltImprts.splice(RsltImprts.indexOf(Imprt), 1); // remove current 'import'.

      let [ , CmpntFlPth ] = Imprt.match(/from '(.+)\.mjs';$/);

      CmpntFlPth = path.resolve(path.dirname(FlPth), CmpntFlPth);

      const { Imprts, MdlsCd } = Compile2(CmpntFlPth, Extnsn, MrgImprts);

      Imprts.forEach(Imprt => {
        if (!RsltImprts.includes(Imprt)) { RsltImprts.push(Imprt); }
      });

      const MdlNms = [ ...RsltMdlNms, ...ExtrMdlCds.map(({ Nm }) => Nm) ];

      MdlsCd.forEach(MdlCd => {
        if (MdlNms.includes(MdlCd.Nm)) { return; }

        ExtrMdlCds.push(MdlCd);
      });
    });

    RsltMdlCds = [ ...ExtrMdlCds, ...RsltMdlCds ];
  }

  return {
    ExprtDflt: 'export default ' + MdlsSrcCds[MdlsSrcCds.length - 1].Nm + ';', // final module as exported default module.
    Imprts: RsltImprts,                                                        // all 'import ...'.
    MdlsCd: RsltMdlCds,                                                        // all modulea code.
  };
}

/*
  @ folder path.
  @ RegExp object to filter files. */
export function FilesFind (FldrPth, RE) {
  if (FldrPth.substr(-12) === 'node_modules') {
    return [];
  }

  let RsltFlPths = [];

  fs.readdirSync(FldrPth).forEach(FlNm => {
    const FlPth = path.resolve(FldrPth, FlNm); // file path.
    const Stt = fs.statSync(FlPth);

    if (Stt.isDirectory()) { // handle a afolder.
      RsltFlPths = [ ...RsltFlPths, ...FilesFind(FlPth, RE) ];
    }

    if (RE.test(FlNm)) {
      RsltFlPths.push(FlPth);
    }
  });

  return RsltFlPths;
}

export default Compile;
