import { Router } from 'express';
import { vehicleController } from './vehicle.controller';
import {
  assignSchema,
  createVehicleSchema,
  idParamSchema,
  listVehiclesSchema,
  unassignSchema,
  updateVehicleSchema,
} from './vehicle.schema';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requirePermission } from '../../common/middleware/authorize';

export const vehicleRouter = Router();

vehicleRouter.use(authenticate);

// Declared before "/:id" on purpose
vehicleRouter.get('/mine', requirePermission('self:read'), vehicleController.mine);

vehicleRouter.get('/', requirePermission('vehicle:read'), validate({ query: listVehiclesSchema }), vehicleController.list);
vehicleRouter.get('/:id', requirePermission('vehicle:read'), validate({ params: idParamSchema }), vehicleController.get);
vehicleRouter.get('/:id/assignments', requirePermission('vehicle:read'), validate({ params: idParamSchema }), vehicleController.history);

vehicleRouter.post('/', requirePermission('vehicle:write'), validate({ body: createVehicleSchema }), vehicleController.create);
vehicleRouter.patch(
  '/:id',
  requirePermission('vehicle:write'),
  validate({ params: idParamSchema, body: updateVehicleSchema }),
  vehicleController.update,
);
vehicleRouter.delete('/:id', requirePermission('vehicle:delete'), validate({ params: idParamSchema }), vehicleController.remove);

vehicleRouter.post(
  '/:id/assign',
  requirePermission('vehicle:assign'),
  validate({ params: idParamSchema, body: assignSchema }),
  vehicleController.assign,
);
vehicleRouter.post(
  '/:id/unassign',
  requirePermission('vehicle:assign'),
  validate({ params: idParamSchema, body: unassignSchema }),
  vehicleController.unassign,
);
