import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseId } from '../lib/params.js';
import { listMyApplications, setStatus, type ApplicationDeps } from '../applications/service.js';
import { bookSlot, listAvailableSlots } from '../scheduling/service.js';

export function applicationsRouter(deps: ApplicationDeps & { jwtSecret: string }): Router {
  const router = Router();
  const candidate = [requireAuth(deps.jwtSecret), requireRole('Candidate')];
  const employer = [requireAuth(deps.jwtSecret), requireRole('Employer')];

  router.get('/applications/mine', ...candidate, async (req, res) => {
    res.json(await listMyApplications(deps, req.auth!.sub));
  });

  router.put('/applications/:id/status', ...employer, async (req, res) => {
    res.json(await setStatus(deps, req.auth!.sub, parseId(req.params.id, 'Application'), req.body));
  });

  router.get('/applications/:id/available-slots', ...candidate, async (req, res) => {
    res.json(await listAvailableSlots(deps, req.auth!.sub, parseId(req.params.id, 'Application')));
  });

  router.post('/applications/:id/book', ...candidate, async (req, res) => {
    res.json(await bookSlot(deps, req.auth!.sub, parseId(req.params.id, 'Application'), req.body));
  });

  return router;
}
