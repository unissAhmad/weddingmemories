import { Router } from 'express';
import { AccessCodeLoginSchema, OtpRequestSchema, OtpVerifySchema } from '@wm/shared';
import { validate } from '../middleware/validate';
import { requireGuest } from '../middleware/requireGuest';
import { accessCodeLoginLimits, otpRequestLimits, otpVerifyLimits } from '../middleware/rateLimit';
import {
  getMe,
  postAccessCodeLogin,
  postLogout,
  postOtpRequest,
  postOtpVerify,
} from '../controllers/guest.controller';

export const guestRouter = Router();

guestRouter.post(
  '/otp/request',
  validate({ body: OtpRequestSchema }),
  ...otpRequestLimits,
  postOtpRequest,
);
guestRouter.post('/otp/verify', validate({ body: OtpVerifySchema }), ...otpVerifyLimits, postOtpVerify);
guestRouter.post('/code', validate({ body: AccessCodeLoginSchema }), ...accessCodeLoginLimits, postAccessCodeLogin);
guestRouter.get('/me', requireGuest, getMe);
guestRouter.post('/logout', postLogout);
