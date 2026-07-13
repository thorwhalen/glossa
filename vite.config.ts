import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Base path matches the mount point on apps.thorwhalen.com. The platform's deploy
// injects VITE_PUBLIC_BASE=/glossa/; VITE_BASE stays supported for local overrides
// (`VITE_BASE=/ npm run dev`).
const base = process.env.VITE_PUBLIC_BASE ?? process.env.VITE_BASE ?? '/glossa/';

/** Where the JSON bundles live. Mirrors `data_dir()` in server.py exactly. */
function dataRoot(): string {
  const override = process.env.GLOSSA_APP_DATA_DIR;
  const root = override
    ? path.resolve(override)
    : path.join(os.homedir(), '.local', 'share', 'glossa');
  return path.join(root, 'data');
}

/**
 * Serve the data root in dev, at the same URL `server.py` serves it from in prod.
 *
 * The data is deliberately NOT in `public/` — Vite copies `public/` into the build, and
 * the build is mirrored to the server with `rsync --delete`, so ~110MB of generated JSON
 * sitting there was one clean checkout away from being wiped. Moving it out fixes that,
 * but it also means the dev server no longer serves it for free. Hence this plugin.
 *
 * The win: dev and prod now read ONE set of bytes, from ONE place, at ONE URL — so a data
 * bug reproduces locally instead of only in production.
 */
function serveDataRoot(): Plugin {
  return {
    name: 'glossa-serve-data-root',
    apply: 'serve', // dev only — the production build must never carry the data
    configureServer(server) {
      const root = dataRoot();
      if (!fs.existsSync(root)) {
        server.config.logger.warn(
          `[glossa] no data at ${root} — the app will load, but every panel will be empty.\n` +
            `         Generate it with:  cd data-prep && uv run glossa-data-prep run-all`,
        );
      }
      // connect strips the mount prefix, so req.url is already relative to the data root.
      server.middlewares.use('/api/glossa/data', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
        const file = path.join(root, rel);
        // Never serve outside the data root, whatever the URL claims.
        if (file !== root && !file.startsWith(root + path.sep)) {
          res.statusCode = 403;
          return res.end();
        }
        fs.stat(file, (err, stat) => {
          if (err || !stat.isFile()) return next();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          fs.createReadStream(file).pipe(res);
        });
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), serveDataRoot()],
});
