import { z } from 'zod';
import { AccessStatusSchema } from './guest';
import { PhotoStatusSchema } from './photos';
import { SlugSchema } from './event';
import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from './constants';

/* ----------------------------------------------------------------------------
 * Auth
 * ------------------------------------------------------------------------- */

export const AdminRoleSchema = z.enum(['OWNER', 'MODERATOR']);
export type AdminRole = z.infer<typeof AdminRoleSchema>;

export const AdminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Enter your password').max(200),
});
export type AdminLogin = z.infer<typeof AdminLoginSchema>;

export const TotpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});
export type TotpCode = z.infer<typeof TotpCodeSchema>;

/** Returned by /admin/login: which second step the admin must complete. */
export type AdminLoginResult =
  | { next: '2fa' }
  | { next: 'setup'; otpauthUrl: string; qrDataUrl: string; secret: string };

export interface AdminMe {
  id: string;
  email: string;
  role: AdminRole;
}

/* ----------------------------------------------------------------------------
 * Events & settings
 * ------------------------------------------------------------------------- */

export const EventIdParamsSchema = z.object({ eventId: z.string().min(1).max(64) });

export interface AdminEventSummary {
  id: string;
  slug: string;
  name: string;
  date: string;
}

export const CreateEventSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: SlugSchema,
  date: z.iso.datetime({ offset: true }).or(z.iso.date()),
});
export type CreateEvent = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    date: z.iso.datetime({ offset: true }).or(z.iso.date()),
    uploadsOpen: z.boolean(),
    autoApprove: z.boolean(),
    moderateBeforePublish: z.boolean(),
    /** A new family code, or null to remove it. */
    familyCode: z.string().trim().min(4, 'At least 4 characters').max(64).nullable(),
    coverPublicId: z.string().max(300).nullable(),
  })
  .partial();
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;

export interface AdminEventDetail extends AdminEventSummary {
  coverUrl: string | null;
  guestUrl: string;
  settings: {
    uploadsOpen: boolean;
    autoApprove: boolean;
    moderateBeforePublish: boolean;
    hasFamilyCode: boolean;
  };
}

export const CoverUploadSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});
export type CoverUpload = z.infer<typeof CoverUploadSchema>;

export interface CoverUploadResponse {
  publicId: string;
  uploadUrl: string;
  params: Record<string, string>;
}

export interface EventStats {
  guests: number;
  photos: Record<z.infer<typeof PhotoStatusSchema>, number>;
  access: Record<z.infer<typeof AccessStatusSchema>, number>;
  storageBytes: number;
}

/* ----------------------------------------------------------------------------
 * Lists
 * ------------------------------------------------------------------------- */

const cursorLimit = {
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
};

export const AccessListQuerySchema = z.object({
  ...cursorLimit,
  status: AccessStatusSchema.default('PENDING'),
});
export type AccessListQuery = z.infer<typeof AccessListQuerySchema>;

export interface AdminAccessRequest {
  id: string;
  guestId: string;
  guestName: string;
  contact: string | null;
  status: z.infer<typeof AccessStatusSchema>;
  decidedAt: string | null;
  createdAt: string;
}

export const IdListSchema = z.array(z.string().min(1).max(64)).min(1).max(500);

export const AccessDecisionSchema = z.object({
  ids: IdListSchema,
  status: z.enum(['APPROVED', 'REJECTED']),
});
export type AccessDecision = z.infer<typeof AccessDecisionSchema>;

export const AdminPhotoQuerySchema = z.object({
  ...cursorLimit,
  status: PhotoStatusSchema.exclude(['UPLOADING', 'DELETED']).optional(),
  guestId: z.string().min(1).max(64).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AdminPhotoQuery = z.infer<typeof AdminPhotoQuerySchema>;

export interface AdminPhoto {
  id: string;
  status: z.infer<typeof PhotoStatusSchema>;
  featured: boolean;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  thumbUrl: string | null;
  displayUrl: string | null;
  guestId: string;
  guestName: string;
  originalName: string | null;
  sizeBytes: number;
  takenAt: string | null;
  createdAt: string;
}

export const PhotoActionSchema = z.object({
  ids: IdListSchema,
  action: z.enum(['hide', 'unhide', 'feature', 'unfeature', 'delete']),
});
export type PhotoAction = z.infer<typeof PhotoActionSchema>;

export const GuestListQuerySchema = z.object({
  ...cursorLimit,
  q: z.string().trim().max(100).optional(),
});
export type GuestListQuery = z.infer<typeof GuestListQuerySchema>;

export interface AdminGuest {
  id: string;
  name: string;
  /** Email, or null for access-code guests */
  contact: string | null;
  /** Formatted access code (e.g. AB7K-2MQ9), if the guest has one */
  accessCode: string | null;
  blocked: boolean;
  access: z.infer<typeof AccessStatusSchema> | null;
  photoCount: number;
  verifiedAt: string | null;
  createdAt: string;
}

export const GuestIdParamsSchema = EventIdParamsSchema.extend({
  guestId: z.string().min(1).max(64),
});

export const GuestUpdateSchema = z
  .object({
    blocked: z.boolean(),
    access: z.enum(['APPROVED', 'REJECTED']),
  })
  .partial()
  .refine((v) => v.blocked !== undefined || v.access !== undefined, 'Nothing to update');
export type GuestUpdate = z.infer<typeof GuestUpdateSchema>;

/* ----------------------------------------------------------------------------
 * Downloads
 * ------------------------------------------------------------------------- */

export const DownloadScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('guest'), guestId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('selection'), photoIds: IdListSchema }),
]);
export type DownloadScope = z.infer<typeof DownloadScopeSchema>;

export const CreateDownloadSchema = z.object({ scope: DownloadScopeSchema });

export interface AdminDownloadJob {
  id: string;
  scope: DownloadScope;
  photoCount: number;
  totalBytes: number;
  /** One link per ZIP part (~2 GB each); each streams the originals when opened. */
  parts: { name: string; url: string; photoCount: number }[];
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
}

/* ----------------------------------------------------------------------------
 * Team & audit
 * ------------------------------------------------------------------------- */

export interface AdminTeamMember {
  id: string;
  email: string;
  role: AdminRole;
  twoFactor: boolean;
  eventIds: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export const CreateAdminSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(12, 'At least 12 characters').max(200),
  role: AdminRoleSchema.default('MODERATOR'),
  eventIds: z.array(z.string().min(1).max(64)).max(50).default([]),
});
export type CreateAdmin = z.infer<typeof CreateAdminSchema>;

export const AdminIdParamsSchema = z.object({ adminId: z.string().min(1).max(64) });

export interface AuditEntry {
  id: string;
  adminEmail: string | null;
  action: string;
  targetId: string | null;
  meta: unknown;
  createdAt: string;
}

export const AuditQuerySchema = z.object(cursorLimit);
