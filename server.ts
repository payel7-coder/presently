import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createAuthApiApp } from './server/app.ts';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

async function startServer() {
  const { app } = createAuthApiApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');

    app.use(
      express.static(distDir, {
        index: false,
      })
    );

    // Serve SPA entrypoint for all non-API GET routes (including /reset-password?token=...)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      if (!fs.existsSync(indexHtml)) {
        res.status(404).send('Build output not found. Run npm run build first.');
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Presently full-stack server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
