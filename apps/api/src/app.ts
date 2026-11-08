import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './common/logger';
import { apiLimiter } from './common/middleware/rateLimit';
import { errorHandler } from './common/middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { driverRouter } from './modules/drivers/driver.routes';
import { vehicleRouter } from './modules/vehicles/vehicle.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // we sit behind one reverse proxy; needed for correct client IPs

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), // explicit allow-list, no "*"
      credentials: true,
    }),
  );
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/drivers', driverRouter);
  app.use('/api/vehicles', vehicleRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } });
  });
  app.use(errorHandler);

  return app;
}
