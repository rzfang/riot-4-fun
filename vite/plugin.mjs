import compile from '../core/compile.mjs';

function plugin () {
  return {
    name: 'vite-plugin-riot-4-fun',
    enforce: 'pre',
    // apply: 'both',
    // handleHotUpdate(context) {
    //   // 可以在這裡加上自訂 HMR 行為
    // },
    load (id, _options) {
      // non undefined, null to tell vite calls transform function.
      return id.endsWith('.riot') ? '' : null;
    },
    transform (sourceCode, id, _options) {
      if (!id.endsWith('.riot')) {
        return null;
      }

      const { code, error, map } = compile(id, sourceCode);

      if (error) {
        throw error;
      }

      // const hmrCode = `
      //   if (import.meta.hot) {
      //     import.meta.hot.accept(newModule => {
      //       console.log('--- 002');
      //       console.log(newModule);
      //       console.log('[HMR] Riot parts updated:', '${parts.map(({ tagName }) => tagName).join(', ')}');
      //     });
      //   }
      // `;

      return { code, map };
    },
  };
}

export default plugin;
