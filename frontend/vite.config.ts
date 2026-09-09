import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    // NOTE: the Gemini API key is no longer bundled into the client. All model
    // calls go through the backend. Only VITE_API_BASE_URL (read via
    // import.meta.env) is needed here.
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
