import { Router } from 'express';
import { EventSlugParamsSchema } from '@wm/shared';
import { validate } from '../middleware/validate';
import { getEvent, getHome } from '../controllers/events.controller';

export const eventsRouter = Router();

// The site root shows this event (declared before /:slug so "home" isn't read as a slug).
eventsRouter.get('/home', getHome);
eventsRouter.get('/:slug', validate({ params: EventSlugParamsSchema }), getEvent);
