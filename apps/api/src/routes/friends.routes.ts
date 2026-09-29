import { Router } from 'express';
import { FriendParamsSchema, FriendsQuerySchema } from '@wm/shared';
import { validate } from '../middleware/validate';
import { requireGuest } from '../middleware/requireGuest';
import * as c from '../controllers/friends.controller';

export const friendsRouter = Router();

friendsRouter.use(requireGuest);

friendsRouter.get('/', validate({ query: FriendsQuerySchema }), c.getFriends);
friendsRouter.get('/:guestId', validate({ params: FriendParamsSchema }), c.getFriend);
