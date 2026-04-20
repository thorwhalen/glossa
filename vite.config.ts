import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path matches the mount point on apps.thorwhalen.com.
// For local dev, override with BASE=/ or use VITE_BASE env var.
const base = process.env.VITE_BASE ?? '/glossa/';

export default defineConfig({
  base,
  plugins: [react()],
});
