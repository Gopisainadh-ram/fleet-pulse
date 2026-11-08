import { Router } from 'express';
import { authController } from './auth.controller';
import { loginSchema, setPasswordSchema } from './auth.schema';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { loginLimiter, passwordSetupLimiter } from '../../common/middleware/rateLimit';
import { requireCustomHeader } from '../../common/middleware/csrfHeader';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post(
  '/set-password',
  passwordSetupLimiter,
  validate({ body: setPasswordSchema }),
  authController.setPassword,
);
authRouter.post('/refresh', requireCustomHeader, authController.refresh);
authRouter.post('/logout', requireCustomHeader, authController.logout);
authRouter.get('/me', authenticate, authController.me);
