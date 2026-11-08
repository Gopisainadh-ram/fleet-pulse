import { RequestHandler } from 'express';
import { vehicleService } from './vehicle.service';

export const vehicleController: Record<string, RequestHandler> = {
  async list(_req, res) {
    res.json(await vehicleService.list(res.locals.query));
  },
  async mine(req, res) {
    res.json(await vehicleService.getMine(req.user!));
  },
  async get(req, res) {
    res.json(await vehicleService.getById(req.params.id as string));
  },
  async history(req, res) {
    res.json(await vehicleService.history(req.params.id as string));
  },
  async create(req, res) {
    res.status(201).json(await vehicleService.create(req.user!, req.body, req.ip));
  },
  async update(req, res) {
    res.json(await vehicleService.update(req.user!, req.params.id as string, req.body, req.ip));
  },
  async remove(req, res) {
    await vehicleService.remove(req.user!, req.params.id as string, req.ip);
    res.status(204).end();
  },
  async assign(req, res) {
    res.status(201).json(await vehicleService.assign(req.user!, req.params.id as string, req.body, req.ip));
  },
  async unassign(req, res) {
    await vehicleService.unassign(req.user!, req.params.id as string, req.body ?? {}, req.ip);
    res.status(204).end();
  },
};
