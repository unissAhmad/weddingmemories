import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type { FriendParamsSchema, FriendsQuery } from '@wm/shared';
import * as friends from '../services/friends.service';
import { currentGuest } from '../middleware/requireGuest';

export const getFriends: RequestHandler = async (req, res) => {
  res.json(await friends.listFriends(currentGuest(req), req.valid.query as FriendsQuery));
};

export const getFriend: RequestHandler = async (req, res) => {
  const { guestId } = req.valid.params as z.infer<typeof FriendParamsSchema>;
  res.json(await friends.getFriend(currentGuest(req), guestId));
};
