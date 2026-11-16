import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundApi, rejectMongoOperators } from './middleware/errorHandler.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          // Allow plain-HTTP local/LAN demos without forcing an HTTPS upgrade.
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', rejectMongoOperators, apiRoutes);
  app.use('/api', notFoundApi);

  // Frontend (static). Clean URLs: /app → app.html, /display → display.html
  app.use(express.static(publicDir, { extensions: ['html'], index: 'index.html' }));

  app.use(errorHandler);
  return app;
}
