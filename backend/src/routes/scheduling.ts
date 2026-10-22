import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseId } from '../lib/params.js';
import { createSlot, deleteSlot, listMySlots, type SchedulingDeps } from '../scheduling/service.js';

export function schedulingRouter(deps: SchedulingDeps & { jwtSecret: string }): Router {
  const router = Router();
  const employer = [requireAuth(deps.jwtSecret), requireRole('Employer')];

  router.get('/employers/me/availability', ...employer, async (req, res) => {
    res.json(await listMySlots(deps, req.auth!.sub));
  });

  router.post('/employers/me/availability', ...employer, async (req, res) => {
    res.status(201).json(await createSlot(deps, req.auth!.sub, req.body));
  });

  router.delete('/employers/me/availability/:id', ...employer, async (req, res) => {
    await deleteSlot(deps, req.auth!.sub, parseId(req.params.id, 'Slot'));
    res.status(204).end();
  });

  return router;
}
