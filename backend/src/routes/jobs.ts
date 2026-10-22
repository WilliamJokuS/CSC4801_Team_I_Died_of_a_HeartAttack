import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseId } from '../lib/params.js';
import { createJob, deleteJob, getJob, listMyJobs, updateJob, type JobDeps } from '../jobs/service.js';
import { apply, listApplicants, listScoredJobs } from '../applications/service.js';

export function jobsRouter(deps: JobDeps & { jwtSecret: string }): Router {
  const router = Router();
  const authenticated = requireAuth(deps.jwtSecret);
  const candidate = [authenticated, requireRole('Candidate')];
  const employer = [authenticated, requireRole('Employer')];

  // Candidate dashboard: scored + sorted with the shared FP-MATCH-1 function.
  router.get('/jobs', ...candidate, async (req, res) => {
    res.json(await listScoredJobs(deps, req.auth!.sub));
  });

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

  router.post('/jobs/:id/applications', ...candidate, async (req, res) => {
    res.status(201).json(await apply(deps, req.auth!.sub, parseId(req.params.id, 'Job')));
  });

  router.get('/jobs/:id/applicants', ...employer, async (req, res) => {
    res.json(await listApplicants(deps, req.auth!.sub, parseId(req.params.id, 'Job')));
  });

  return router;
}
