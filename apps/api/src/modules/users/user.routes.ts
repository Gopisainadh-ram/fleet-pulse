import { Router } from 'express';
import { userController } from './user.controller';
import { createUserSchema, idParamSchema, listUsersSchema, updateUserSchema } from './user.schema';
import { validate } from '../../common/middleware/validate';
import { authenticate } from '../../common/middleware/authenticate';
import { requirePermission } from '../../common/middleware/authorize';

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get('/', requirePermission('user:read'), validate({ query: listUsersSchema }), userController.list);
userRouter.post('/', requirePermission('user:write'), validate({ body: createUserSchema }), userController.create);
userRouter.post(
  '/:id/invitation',
  requirePermission('user:write'),
  validate({ params: idParamSchema }),
  userController.resendInvitation,
);
userRouter.patch(
  '/:id',
  requirePermission('user:write'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  userController.update,
);
