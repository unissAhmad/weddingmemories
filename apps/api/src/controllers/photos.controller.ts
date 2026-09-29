import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type {
  CommentCreate,
  CommentIdParamsSchema,
  CursorQuery,
  GalleryQuery,
  PhotoIdParamsSchema,
  UploadComplete,
  UploadInit,
} from '@wm/shared';
import * as photos from '../services/photos.service';
import * as social from '../services/social.service';
import { currentGuest } from '../middleware/requireGuest';

type IdParams = z.infer<typeof PhotoIdParamsSchema>;

export const postUpload: RequestHandler = async (req, res) => {
  res.status(201).json(await photos.initUpload(currentGuest(req), req.valid.body as UploadInit));
};

export const postComplete: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  res.json(await photos.completeUpload(currentGuest(req), id, req.valid.body as UploadComplete));
};

export const deleteUpload: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  await photos.abortUpload(currentGuest(req), id);
  res.status(204).end();
};

export const deletePhoto: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  await photos.deleteOwnPhoto(currentGuest(req), id);
  res.status(204).end();
};

export const getGallery: RequestHandler = async (req, res) => {
  res.json(await photos.listGallery(currentGuest(req), req.valid.query as GalleryQuery));
};

export const getMine: RequestHandler = async (req, res) => {
  res.json(await photos.listMyPhotos(currentGuest(req), req.valid.query as CursorQuery));
};

/* Likes & comments */

export const postLike: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  res.json(await social.likePhoto(currentGuest(req), id));
};

export const deleteLike: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  res.json(await social.unlikePhoto(currentGuest(req), id));
};

export const getLikes: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  res.json(await social.listLikes(currentGuest(req), id));
};

export const getComments: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  res.json(await social.listComments(currentGuest(req), id));
};

export const postComment: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  const { body } = req.valid.body as CommentCreate;
  res.status(201).json(await social.addComment(currentGuest(req), id, body));
};

export const deleteComment: RequestHandler = async (req, res) => {
  const { id, commentId } = req.valid.params as z.infer<typeof CommentIdParamsSchema>;
  await social.deleteOwnComment(currentGuest(req), id, commentId);
  res.status(204).end();
};
