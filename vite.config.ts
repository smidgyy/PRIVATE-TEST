import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          stage1: path.resolve(__dirname, 'public/stage1.html'),
          stage2: path.resolve(__dirname, 'public/stage2.html'),
          node02: path.resolve(__dirname, 'public/node02.html'),
          node03_index: path.resolve(__dirname, 'public/node03/index.html'),
          node03_secret: path.resolve(__dirname, 'public/node03/secret.html'),
          node03_secret_index: path.resolve(__dirname, 'public/node03/secret/index.html'),
          node04: path.resolve(__dirname, 'public/node04.html'),
          node04_index: path.resolve(__dirname, 'public/node04/index.html'),
          article: path.resolve(__dirname, 'public/article.html'),
          resonance: path.resolve(__dirname, 'public/resonance.html'),
          archive_index: path.resolve(__dirname, 'public/archive/index.html'),
        },
      },
    },
  };
});
