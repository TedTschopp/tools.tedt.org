import { defineConfig } from 'astro/config';
export default defineConfig({ site: 'https://tools.tedt.org', trailingSlash: 'always', output: 'static', vite: { build: { chunkSizeWarningLimit: 1500 } } });
