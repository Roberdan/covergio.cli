import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build', precompress: false }),
    alias: {
      '$components': 'src/lib/components',
      '$stores': 'src/lib/stores',
      '$types': 'src/lib/types',
      '$api': 'src/lib/api',
      '$server': 'src/lib/server'
    }
  }
};

export default config;
