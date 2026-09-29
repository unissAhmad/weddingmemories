import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type {
  AccessDecision,
  AdminCommentParamsSchema,
  AdminPhotoParamsSchema,
  AccessListQuery,
  AdminLogin,
  AdminPhotoQuery,
  AdminIdParamsSchema,
  CreateAdmin,
  CreateCodeGuests,
  CreateEvent,
  DownloadScope,
  GuestIdParamsSchema,
  GuestListQuery,
  GuestUpdate,
  PhotoAction,
  ShowcaseAdd,
  ShowcaseIdParamsSchema,
  ShowcaseReorder,
  ShowcaseUpdate,
  TotpCode,
  UpdateEvent,
} from '@wm/shared';
import { unauthorized } from '../lib/errors';
import { signAdminPreToken, signAdminToken, verifyAdminPreToken } from '../lib/jwt';
import {
  ADMIN_PRE_COOKIE,
  clearAdminCookies,
  setAdminCookie,
  setAdminPreCookie,
} from '../lib/cookies';
import { currentAdmin, currentEvent } from '../middleware/requireAdmin';
import * as auth from '../services/admin/auth.service';
import * as events from '../services/admin/events.service';
import * as access from '../services/admin/access.service';
import * as photos from '../services/admin/photos.service';
import * as guests from '../services/admin/guests.service';
import * as downloads from '../services/admin/downloads.service';
import * as team from '../services/admin/team.service';
import { createCodeGuests, resetAccessCode } from '../services/accessCode.service';
import * as showcase from '../services/showcase.service';

/* Auth */

export const postLogin: RequestHandler = async (req, res) => {
  const { email, password } = req.valid.body as AdminLogin;
  const { adminId, result } = await auth.login(email, password);
  setAdminPreCookie(res, await signAdminPreToken(adminId));
  res.json(result);
};

export const post2fa: RequestHandler = async (req, res) => {
  const token: unknown = req.cookies?.[ADMIN_PRE_COOKIE];
  const adminId = typeof token === 'string' ? await verifyAdminPreToken(token) : null;
  if (!adminId) throw unauthorized('Your sign-in expired. Please enter your password again.');

  const { code } = req.valid.body as TotpCode;
  const me = await auth.verifySecondFactor(adminId, code);
  setAdminCookie(res, await signAdminToken(me.id));
  res.json(me);
};

export const postLogout: RequestHandler = (_req, res) => {
  clearAdminCookies(res);
  res.status(204).end();
};

export const getMe: RequestHandler = (req, res) => {
  res.json(currentAdmin(req));
};

/* Events */

export const getEvents: RequestHandler = async (req, res) => {
  res.json(await events.listEvents(currentAdmin(req)));
};

export const postEvent: RequestHandler = async (req, res) => {
  res.status(201).json(await events.createEvent(currentAdmin(req), req.valid.body as CreateEvent));
};

export const getEvent: RequestHandler = async (req, res) => {
  res.json(await events.getEventDetail(currentEvent(req).id));
};

export const patchEvent: RequestHandler = async (req, res) => {
  const event = currentEvent(req);
  res.json(await events.updateEvent(currentAdmin(req), event.id, req.valid.body as UpdateEvent));
};

/* Welcome page photos */

type ShowcaseParams = z.infer<typeof ShowcaseIdParamsSchema>;

export const postShowcaseUpload: RequestHandler = async (req, res) => {
  res.json(await showcase.createShowcaseUpload(currentEvent(req).id));
};

export const postShowcase: RequestHandler = async (req, res) => {
  res.status(201).json(await showcase.addShowcasePhoto(currentAdmin(req), currentEvent(req).id, req.valid.body as ShowcaseAdd));
};

export const patchShowcase: RequestHandler = async (req, res) => {
  const { photoId } = req.valid.params as ShowcaseParams;
  const { caption } = req.valid.body as ShowcaseUpdate;
  res.json(await showcase.updateShowcaseCaption(currentAdmin(req), currentEvent(req).id, photoId, caption));
};

export const postShowcaseReorder: RequestHandler = async (req, res) => {
  const { ids } = req.valid.body as ShowcaseReorder;
  res.json(await showcase.reorderShowcase(currentAdmin(req), currentEvent(req).id, ids));
};

export const deleteShowcase: RequestHandler = async (req, res) => {
  const { photoId } = req.valid.params as ShowcaseParams;
  await showcase.deleteShowcasePhoto(currentAdmin(req), currentEvent(req).id, photoId);
  res.status(204).end();
};

export const getStats: RequestHandler = async (req, res) => {
  res.json(await events.getStats(currentEvent(req).id));
};

export const getQr: RequestHandler = async (req, res) => {
  const event = currentEvent(req);
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const { body, contentType } = await events.renderQr(event.slug, format);
  res
    .type(contentType)
    .set('Content-Disposition', `attachment; filename="${event.slug}-qr.${format}"`)
    .send(body);
};

/* Access */

export const getAccess: RequestHandler = async (req, res) => {
  res.json(await access.listAccessRequests(currentEvent(req).id, req.valid.query as AccessListQuery));
};

export const postAccessDecision: RequestHandler = async (req, res) => {
  res.json(
    await access.decideAccess(currentAdmin(req), currentEvent(req), req.valid.body as AccessDecision),
  );
};

/* Photos */

export const getPhotos: RequestHandler = async (req, res) => {
  res.json(await photos.listPhotos(currentEvent(req).id, req.valid.query as AdminPhotoQuery));
};

export const postPhotoAction: RequestHandler = async (req, res) => {
  res.json(
    await photos.applyPhotoAction(currentAdmin(req), currentEvent(req).id, req.valid.body as PhotoAction),
  );
};

export const getPhotoComments: RequestHandler = async (req, res) => {
  const { photoId } = req.valid.params as z.infer<typeof AdminPhotoParamsSchema>;
  res.json(await photos.listPhotoComments(currentEvent(req).id, photoId));
};

export const deletePhotoComment: RequestHandler = async (req, res) => {
  const { commentId } = req.valid.params as z.infer<typeof AdminCommentParamsSchema>;
  await photos.deleteComment(currentAdmin(req), currentEvent(req).id, commentId);
  res.status(204).end();
};

/* Guests */

export const getGuests: RequestHandler = async (req, res) => {
  res.json(await guests.listGuests(currentEvent(req).id, req.valid.query as GuestListQuery));
};

export const patchGuest: RequestHandler = async (req, res) => {
  const { guestId } = req.valid.params as z.infer<typeof GuestIdParamsSchema>;
  res.json(
    await guests.updateGuest(currentAdmin(req), currentEvent(req), guestId, req.valid.body as GuestUpdate),
  );
};

export const postCodeGuests: RequestHandler = async (req, res) => {
  const { names } = req.valid.body as CreateCodeGuests;
  res.status(201).json(await createCodeGuests(currentAdmin(req), currentEvent(req).id, names));
};

export const postResetGuestCode: RequestHandler = async (req, res) => {
  const { guestId } = req.valid.params as z.infer<typeof GuestIdParamsSchema>;
  res.json(await resetAccessCode(currentAdmin(req), currentEvent(req).id, guestId));
};

/* Downloads */

export const getDownloads: RequestHandler = async (req, res) => {
  const event = currentEvent(req);
  res.json(await downloads.listDownloads(event.id, event.slug));
};

export const postDownload: RequestHandler = async (req, res) => {
  const { scope } = req.valid.body as { scope: DownloadScope };
  res.status(201).json(await downloads.createDownload(currentAdmin(req), currentEvent(req).id, scope));
};

/* Audit & team */

export const getAudit: RequestHandler = async (req, res) => {
  res.json(await team.listAudit(currentEvent(req).id, req.valid.query as { cursor?: string; limit: number }));
};

export const getTeam: RequestHandler = async (_req, res) => {
  res.json(await team.listTeam());
};

export const postTeamMember: RequestHandler = async (req, res) => {
  res.status(201).json(await team.createTeamMember(currentAdmin(req), req.valid.body as CreateAdmin));
};

export const deleteTeamMember: RequestHandler = async (req, res) => {
  const { adminId } = req.valid.params as z.infer<typeof AdminIdParamsSchema>;
  await team.removeTeamMember(currentAdmin(req), adminId);
  res.status(204).end();
};

export const postResetTwoFactor: RequestHandler = async (req, res) => {
  const { adminId } = req.valid.params as z.infer<typeof AdminIdParamsSchema>;
  await team.resetTwoFactor(currentAdmin(req), adminId);
  res.status(204).end();
};
