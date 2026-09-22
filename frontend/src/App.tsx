import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoleGate } from '@/layouts/RoleGate';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { CandidateDashboardPage } from '@/pages/CandidateDashboardPage';
import { CandidateProfilePage } from '@/pages/CandidateProfilePage';
import { CandidateApplicationsPage } from '@/pages/CandidateApplicationsPage';
import { CandidateInterviewsPage } from '@/pages/CandidateInterviewsPage';
import { EmployerDashboardPage } from '@/pages/EmployerDashboardPage';
import { EmployerCompanyProfilePage } from '@/pages/EmployerCompanyProfilePage';
import { EmployerJobsPage } from '@/pages/EmployerJobsPage';
import { EmployerApplicantsPage } from '@/pages/EmployerApplicantsPage';
import { EmployerAvailabilityPage } from '@/pages/EmployerAvailabilityPage';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/candidate/dashboard"
          element={
            <RoleGate role="Candidate">
              <CandidateDashboardPage user={user!} />
            </RoleGate>
          }
        />
        <Route
          path="/candidate/profile"
          element={
            <RoleGate role="Candidate">
              <CandidateProfilePage user={user!} />
            </RoleGate>
          }
        />
        <Route
          path="/candidate/applications"
          element={
            <RoleGate role="Candidate">
              <CandidateApplicationsPage user={user!} />
            </RoleGate>
          }
        />
        <Route
          path="/candidate/interviews"
          element={
            <RoleGate role="Candidate">
              <CandidateInterviewsPage user={user!} />
            </RoleGate>
          }
        />

        <Route
          path="/employer/dashboard"
          element={
            <RoleGate role="Employer">
              <EmployerDashboardPage user={user!} />
            </RoleGate>
          }
        />
        <Route
          path="/employer/company"
          element={
            <RoleGate role="Employer">
              <EmployerCompanyProfilePage user={user!} />
            </RoleGate>
          }
        />
        <Route
          path="/employer/jobs"
          element={
            <RoleGate role="Employer">
              <EmployerJobsPage user={user!} />
            </RoleGate>
          }
        />
        <Route
          path="/employer/jobs/:jobId/applicants"
          element={
            <RoleGate role="Employer">
              <EmployerApplicantsPage user={user!} />
            </RoleGate>
          }
        />
        <Route
          path="/employer/jobs/:jobId/availability"
          element={
            <RoleGate role="Employer">
              <EmployerAvailabilityPage user={user!} />
            </RoleGate>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
