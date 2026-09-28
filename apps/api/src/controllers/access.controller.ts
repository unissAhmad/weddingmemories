import type { RequestHandler } from 'express';
import type { FamilyCode } from '@wm/shared';
import { requestAccess, submitFamilyCode } from '../services/access.service';
import { currentGuest } from '../middleware/requireGuest';

export const postAccessRequest: RequestHandler = async (req, res) => {
  res.json(await requestAccess(currentGuest(req)));
};

export const postFamilyCode: RequestHandler = async (req, res) => {
  const { code } = req.valid.body as FamilyCode;
  res.json(await submitFamilyCode(currentGuest(req), code));
};
