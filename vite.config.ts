import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { releaseEpoch, renderWorker } from './scripts/release-epoch';

export default defineConfig({
  base: '/handbook/',
  plugins: [react(), {
    name: 'handbook-offline-shell',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(file => !file.endsWith('.map'));
      const publicFiles = ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'assets/hanken-grotesk-variable.ttf', 'courses/kbai.json', 'courses/everyday-evidence.json', 'downloads/handbook-course-builder.zip', 'downloads/course-pack-v1.schema.json'];
      const contents = Object.fromEntries(files.map(file => [file, bundle[file].type === 'chunk' ? bundle[file].code : bundle[file].source]));
      for (const file of publicFiles) contents[file] = readFileSync(`public/${file}`);
      contents['index.html'] = readFileSync('index.html');
      const version = releaseEpoch(contents);
      const urls = [...new Set(['/handbook/', '/handbook/index.html', ...files.map(file => `/handbook/${file}`), ...publicFiles.map(file => `/handbook/${file}`)])];
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderWorker(readFileSync('scripts/sw-template.js', 'utf8'), version, urls) });
    },
  }],
  build: { sourcemap: true, rollupOptions: { output: { manualChunks: id => id.includes('node_modules/') ? 'vendor' : undefined } } },
});
