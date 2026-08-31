import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// NOTE: deliberately no `define: { 'process.env.X': ... }`. The previous app in
// this repo inlined an API key into the client bundle that way. There are no
// client-side secrets in this design; the family code is user-supplied at runtime.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
  },
});
