import { pino } from 'pino';
import { env } from '../env';

const pretty = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  ...(!pretty ? {} : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});
