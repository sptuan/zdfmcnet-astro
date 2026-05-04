import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: 'https://zdfmc.net',

  integrations: [
    tailwind(),
  ],

  output: "hybrid",

  build: {
    format: 'file',
  },

  trailingSlash: 'never',
  adapter: cloudflare()
});