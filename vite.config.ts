import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// If deploying to https://<user>.github.io/<repo>/ set base to '/<repo>/'.
// If deploying to a user/org root or custom domain, set base to '/'.
// Override at build time with:  VITE_BASE=/my-repo/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/cs-chat-assessment/',
});
