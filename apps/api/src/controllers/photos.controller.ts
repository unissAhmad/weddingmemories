import type { RequestHandler } from 'express';
import type { z } from 'zod';
import type {
  CursorQuery,
  GalleryQuery,
  PhotoIdParamsSchema,
  SignPartParamsSchema,
  UploadComplete,
  UploadInit,
} from '@wm/shared';
import * as photos from '../services/photos.service';
import { currentGuest } from '../middleware/requireGuest';

type IdParams = z.infer<typeof PhotoIdParamsSchema>;
type PartParams = z.infer<typeof SignPartParamsSchema>;

export const postUpload: RequestHandler = async (req, res) => {
  res.status(201).json(await photos.initUpload(currentGuest(req), req.valid.body as UploadInit));
};

export const getPartUrl: RequestHandler = async (req, res) => {
  const { id, partNumber } = req.valid.params as PartParams;
  res.json(await photos.signPart(currentGuest(req), id, partNumber));
};

export const getParts: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  res.json(await photos.listUploadedParts(currentGuest(req), id));
};

export const postComplete: RequestHandler = async (req, res) => {
  const { id } = req.valid.params as IdParams;
  const { parts } = req.valid.body as UploadComplete;
  res.json(await photos.completeUpload(currentGuest(req), id, parts));
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
