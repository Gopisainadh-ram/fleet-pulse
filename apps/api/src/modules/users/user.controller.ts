import { RequestHandler } from 'express';
import { userService } from './user.service';

export const userController: Record<string, RequestHandler> = {
  async list(req, res) {
    res.json(await userService.list(req.user!, res.locals.query));
  },
  async create(req, res) {
    res.status(201).json(await userService.create(req.user!, req.body, req.ip));
  },
  async resendInvitation(req, res) {
    res.json(await userService.resendInvitation(req.user!, req.params.id as string, req.ip));
  },
  async update(req, res) {
    res.json(await userService.update(req.user!, req.params.id as string, req.body, req.ip));
  },
};
