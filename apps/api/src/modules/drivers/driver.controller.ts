import { RequestHandler } from 'express';
import { driverService } from './driver.service';

export const driverController: Record<string, RequestHandler> = {
  async list(_req, res) {
    res.json(await driverService.list(res.locals.query));
  },
  async mine(req, res) {
    res.json(await driverService.getMine(req.user!));
  },
  async get(req, res) {
    res.json(await driverService.getById(req.params.id as string));
  },
  async create(req, res) {
    res.status(201).json(await driverService.create(req.user!, req.body, req.ip));
  },
  async update(req, res) {
    res.json(await driverService.update(req.user!, req.params.id as string, req.body, req.ip));
  },
  async remove(req, res) {
    await driverService.remove(req.user!, req.params.id as string, req.ip);
    res.status(204).end();
  },
};
