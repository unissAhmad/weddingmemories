import { Router } from 'express';
import {
  CursorQuerySchema,
  GalleryQuerySchema,
  PhotoIdParamsSchema,
  SignPartParamsSchema,
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

// Multipart upload lifecycle (called by Uppy's AwsS3 plugin)
photosRouter.post('/uploads', uploadInitLimit, validate({ body: UploadInitSchema }), c.postUpload);
photosRouter.get('/:id/parts', validate({ params: PhotoIdParamsSchema }), c.getParts);
photosRouter.get('/:id/parts/:partNumber', validate({ params: SignPartParamsSchema }), c.getPartUrl);
photosRouter.post(
  '/:id/complete',
  validate({ params: PhotoIdParamsSchema, body: UploadCompleteSchema }),
  c.postComplete,
);
photosRouter.delete('/:id/upload', validate({ params: PhotoIdParamsSchema }), c.deleteUpload);

photosRouter.delete('/:id', validate({ params: PhotoIdParamsSchema }), c.deletePhoto);
