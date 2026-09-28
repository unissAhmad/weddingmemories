import type { RequestHandler } from 'express';
import type { AccessCodeLogin, OtpRequest, OtpVerify } from '@wm/shared';
import { requestOtp } from '../services/otp.service';
import { signInWithAccessCode } from '../services/accessCode.service';
import { getGuestMe, verifyGuest } from '../services/guest.service';
import { clearGuestCookie, setGuestCookie } from '../lib/cookies';
import { currentGuest } from '../middleware/requireGuest';

export const postOtpRequest: RequestHandler = async (req, res) => {
  await requestOtp(req.valid.body as OtpRequest);
  res.status(204).end();
};

export const postOtpVerify: RequestHandler = async (req, res) => {
  const { token, me } = await verifyGuest(req.valid.body as OtpVerify);
  setGuestCookie(res, token);
  res.json(me);
};

export const postAccessCodeLogin: RequestHandler = async (req, res) => {
  const { token, me } = await signInWithAccessCode(req.valid.body as AccessCodeLogin);
  setGuestCookie(res, token);
  res.json(me);
};

export const getMe: RequestHandler = async (req, res) => {
  const guest = currentGuest(req);
  res.json(await getGuestMe(guest.id, guest.eventId));
};

export const postLogout: RequestHandler = (_req, res) => {
  clearGuestCookie(res);
  res.status(204).end();
};
