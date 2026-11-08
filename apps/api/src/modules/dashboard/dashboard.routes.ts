import { Router } from 'express';
import { dashboardService } from './dashboard.service';
import { authenticate } from '../../common/middleware/authenticate';
import { requirePermission } from '../../common/middleware/authorize';

export const dashboardRouter = Router();

dashboardRouter.get('/', authenticate, requirePermission('dashboard:read'), async (_req, res) => {
  res.json(await dashboardService.summary());
});
