import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// React/ReactDOM 은 CDN(UMD) 에서 로드 → 번들이 작아져 Apps Script 에 붙여넣기 쉬움
export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' }), tailwindcss(), viteSingleFile()],
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    modulePreload: false,
    minify: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client'],
      output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' } }
    }
  }
});
