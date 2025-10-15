import plugin from './vite/plugin.mjs';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [ plugin() ],
  build: {
    emptyOutDir: true, // clean even not in root.
    outDir: './.r4f',
  },
});
