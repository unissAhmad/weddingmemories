import { Router } from 'express';
import {
  AccessDecisionSchema,
  AccessListQuerySchema,
  AdminIdParamsSchema,
  AdminLoginSchema,
  AdminPhotoQuerySchema,
  AuditQuerySchema,
  CoverUploadSchema,
  CreateAdminSchema,
  CreateCodeGuestsSchema,
  CreateDownloadSchema,
  CreateEventSchema,
  GuestIdParamsSchema,
  GuestListQuerySchema,
  GuestUpdateSchema,
  PhotoActionSchema,
  TotpCodeSchema,
  UpdateEventSchema,
} from '@wm/shared';
import { validate } from '../middleware/validate';
import { requireAdmin, requireEventAccess, requireOwner } from '../middleware/requireAdmin';
import { admin2faLimit, adminLoginLimit } from '../middleware/rateLimit';
import * as c from '../controllers/admin.controller';

export const adminRouter = Router();

// Admin responses contain personal data; never let a proxy or the browser cache them.
adminRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/* Sign-in: password, then TOTP */
adminRouter.post('/login', adminLoginLimit, validate({ body: AdminLoginSchema }), c.postLogin);
adminRouter.post('/2fa', admin2faLimit, validate({ body: TotpCodeSchema }), c.post2fa);
adminRouter.post('/logout', c.postLogout);

adminRouter.use(requireAdmin);
adminRouter.get('/me', c.getMe);

/* Team (owner only) */
adminRouter.get('/team', requireOwner, c.getTeam);
adminRouter.post('/team', requireOwner, validate({ body: CreateAdminSchema }), c.postTeamMember);
adminRouter.delete('/team/:adminId', requireOwner, validate({ params: AdminIdParamsSchema }), c.deleteTeamMember);
adminRouter.post(
  '/team/:adminId/reset-2fa',
  requireOwner,
  validate({ params: AdminIdParamsSchema }),
  c.postResetTwoFactor,
);

/* Events */
adminRouter.get('/events', c.getEvents);
adminRouter.post('/events', requireOwner, validate({ body: CreateEventSchema }), c.postEvent);

const event = Router({ mergeParams: true });
adminRouter.use('/events/:eventId', requireEventAccess, event);

event.get('/', c.getEvent);
event.patch('/', requireOwner, validate({ body: UpdateEventSchema }), c.patchEvent);
event.post('/cover', requireOwner, validate({ body: CoverUploadSchema }), c.postCoverUpload);
event.get('/stats', c.getStats);
event.get('/qr', c.getQr);

event.get('/access', validate({ query: AccessListQuerySchema }), c.getAccess);
event.post('/access/decide', validate({ body: AccessDecisionSchema }), c.postAccessDecision);

event.get('/photos', validate({ query: AdminPhotoQuerySchema }), c.getPhotos);
event.post('/photos/actions', validate({ body: PhotoActionSchema }), c.postPhotoAction);

event.get('/guests', validate({ query: GuestListQuerySchema }), c.getGuests);
event.post('/guests', validate({ body: CreateCodeGuestsSchema }), c.postCodeGuests);
event.patch('/guests/:guestId', validate({ params: GuestIdParamsSchema, body: GuestUpdateSchema }), c.patchGuest);
event.post('/guests/:guestId/code', validate({ params: GuestIdParamsSchema }), c.postResetGuestCode);

event.get('/downloads', requireOwner, c.getDownloads);
event.post('/downloads', requireOwner, validate({ body: CreateDownloadSchema }), c.postDownload);

event.get('/audit', requireOwner, validate({ query: AuditQuerySchema }), c.getAudit);
