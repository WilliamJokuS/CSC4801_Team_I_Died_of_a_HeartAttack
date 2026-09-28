import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getCandidateProfile,
  getCompanyProfile,
  updateCandidateProfile,
  updateCompanyProfile,
  type ProfileDeps,
} from '../profiles/service.js';

export function profilesRouter(deps: ProfileDeps & { jwtSecret: string }): Router {
  const router = Router();
  const candidate = [requireAuth(deps.jwtSecret), requireRole('Candidate')];
  const employer = [requireAuth(deps.jwtSecret), requireRole('Employer')];

  router.get('/candidates/me/profile', ...candidate, async (req, res) => {
    res.json(await getCandidateProfile(deps, req.auth!.sub));
  });

  router.put('/candidates/me/profile', ...candidate, async (req, res) => {
    res.json(await updateCandidateProfile(deps, req.auth!.sub, req.body));
  });

  router.get('/employers/me/profile', ...employer, async (req, res) => {
    res.json(await getCompanyProfile(deps, req.auth!.sub));
  });

  router.put('/employers/me/profile', ...employer, async (req, res) => {
    res.json(await updateCompanyProfile(deps, req.auth!.sub, req.body));
  });

  return router;
}
