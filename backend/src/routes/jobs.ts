import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseId } from '../lib/params.js';
import { createJob, deleteJob, getJob, listMyJobs, updateJob, type JobDeps } from '../jobs/service.js';

// GET /api/jobs (candidate dashboard, scored + sorted) lands with the match-score function.
export function jobsRouter(deps: JobDeps & { jwtSecret: string }): Router {
  const router = Router();
  const authenticated = requireAuth(deps.jwtSecret);
  const employer = [authenticated, requireRole('Employer')];

  router.post('/jobs', ...employer, async (req, res) => {
    res.status(201).json(await createJob(deps, req.auth!.sub, req.body));
  });

  // Registered before /jobs/:id so "mine" isn't treated as an id.
  router.get('/jobs/mine', ...employer, async (req, res) => {
    res.json(await listMyJobs(deps, req.auth!.sub));
  });

  router.get('/jobs/:id', authenticated, async (req, res) => {
    res.json(await getJob(deps, parseId(req.params.id, 'Job')));
  });

  router.put('/jobs/:id', ...employer, async (req, res) => {
    res.json(await updateJob(deps, req.auth!.sub, parseId(req.params.id, 'Job'), req.body));
  });

  router.delete('/jobs/:id', ...employer, async (req, res) => {
    await deleteJob(deps, req.auth!.sub, parseId(req.params.id, 'Job'));
    res.status(204).end();
  });

  return router;
}
