import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { unauthorized } from '../lib/errors';
import { verifyZipToken } from '../lib/jwt';
import { streamZipPart } from '../services/admin/downloads.service';

/**
 * ZIP part downloads. The signed token in the URL is the credential (created by an owner in the
 * admin panel), because the browser opens this link directly on the API's own domain.
 */
export const downloadsRouter = Router();

downloadsRouter.get(
  '/:token',
  validate({ params: z.object({ token: z.string().min(20).max(2000) }) }),
  async (req, res) => {
    const { token } = req.valid.params as { token: string };
    const claims = await verifyZipToken(token);
    if (!claims) throw unauthorized('This download link is invalid or has expired.');
    await streamZipPart(claims, res);
  },
);
