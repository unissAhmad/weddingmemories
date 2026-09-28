import { Router } from 'express';
import { FamilyCodeSchema } from '@wm/shared';
import { validate } from '../middleware/validate';
import { requireGuest } from '../middleware/requireGuest';
import { familyCodeLimit } from '../middleware/rateLimit';
import { postAccessRequest, postFamilyCode } from '../controllers/access.controller';

export const accessRouter = Router();

accessRouter.use(requireGuest);
accessRouter.post('/request', postAccessRequest);
accessRouter.post('/code', familyCodeLimit, validate({ body: FamilyCodeSchema }), postFamilyCode);
