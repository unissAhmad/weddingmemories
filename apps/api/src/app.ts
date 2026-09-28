import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { CSRF_HEADER } from '@wm/shared';
import { env, webOrigins } from './env';
import { logger } from './lib/logger';
import { csrfProtection } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { eventsRouter } from './routes/events.routes';
import { guestRouter } from './routes/guest.routes';
import { photosRouter } from './routes/photos.routes';
import { accessRouter } from './routes/access.routes';
import { adminRouter } from './routes/admin.routes';
import { downloadsRouter } from './routes/downloads.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(helmet());
  app.use(
    cors({
      origin: webOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', CSRF_HEADER],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api', csrfProtection);
  app.use('/api/events', eventsRouter);
  app.use('/api/guest', guestRouter);
  app.use('/api/photos', photosRouter);
  app.use('/api/access', accessRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/downloads', downloadsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
