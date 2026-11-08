import { Router } from 'express';
import { driverController } from './driver.controller';
import { createDriverSchema, idParamSchema, listDriversSchema, updateDriverSchema } from './driver.schema';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requirePermission } from '../../common/middleware/authorize';

export const driverRouter = Router();

driverRouter.use(authenticate);

// "/me" has to be declared before "/:id" or Express would treat "me" as an id.
driverRouter.get('/me', requirePermission('self:read'), driverController.mine);

driverRouter.get('/', requirePermission('driver:read'), validate({ query: listDriversSchema }), driverController.list);
driverRouter.get('/:id', requirePermission('driver:read'), validate({ params: idParamSchema }), driverController.get);
driverRouter.post('/', requirePermission('driver:write'), validate({ body: createDriverSchema }), driverController.create);
driverRouter.patch(
  '/:id',
  requirePermission('driver:write'),
  validate({ params: idParamSchema, body: updateDriverSchema }),
  driverController.update,
);
driverRouter.delete('/:id', requirePermission('driver:delete'), validate({ params: idParamSchema }), driverController.remove);
