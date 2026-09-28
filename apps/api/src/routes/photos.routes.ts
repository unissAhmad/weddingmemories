import { Router } from 'express';
import {
  CursorQuerySchema,
  GalleryQuerySchema,
  PhotoIdParamsSchema,
  UploadCompleteSchema,
  UploadInitSchema,
} from '@wm/shared';
import { validate } from '../middleware/validate';
import { requireGuest } from '../middleware/requireGuest';
import { uploadInitLimit } from '../middleware/rateLimit';
import * as c from '../controllers/photos.controller';

export const photosRouter = Router();

photosRouter.use(requireGuest);

photosRouter.get('/', validate({ query: GalleryQuerySchema }), c.getGallery);
photosRouter.get('/mine', validate({ query: CursorQuerySchema }), c.getMine);

// Upload lifecycle: sign → browser uploads to Cloudinary → complete (or abort)
photosRouter.post('/uploads', uploadInitLimit, validate({ body: UploadInitSchema }), c.postUpload);
photosRouter.post(
  '/:id/complete',
  validate({ params: PhotoIdParamsSchema, body: UploadCompleteSchema }),
  c.postComplete,
);
photosRouter.delete('/:id/upload', validate({ params: PhotoIdParamsSchema }), c.deleteUpload);

photosRouter.delete('/:id', validate({ params: PhotoIdParamsSchema }), c.deletePhoto);
