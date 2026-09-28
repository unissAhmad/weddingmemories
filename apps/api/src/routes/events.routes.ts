import { Router } from 'express';
import { EventSlugParamsSchema } from '@wm/shared';
import { validate } from '../middleware/validate';
import { getEvent } from '../controllers/events.controller';

export const eventsRouter = Router();

eventsRouter.get('/:slug', validate({ params: EventSlugParamsSchema }), getEvent);
