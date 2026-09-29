import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { EventSlugParamsSchema } from '@wm/shared';
import { getHomeEvent, getPublicEvent } from '../services/events.service';

export const getEvent: RequestHandler = async (req, res) => {
  const { slug } = req.valid.params as z.infer<typeof EventSlugParamsSchema>;
  res.json(await getPublicEvent(slug));
};

export const getHome: RequestHandler = async (_req, res) => {
  res.json(await getHomeEvent());
};
