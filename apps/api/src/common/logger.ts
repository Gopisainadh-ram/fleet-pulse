import pino from 'pino';
import { isProd } from '../config/env';

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  // Never let credentials leak into logs
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
