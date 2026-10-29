import { Route, Routes } from 'react-router-dom'
import CandidateAppLayout from './components/layout/CandidateAppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import CandidateApplicationsPage from './pages/CandidateApplicationsPage'
import CandidateBookInterviewPage from './pages/CandidateBookInterviewPage'
import CandidateOverviewPage from './pages/CandidateOverviewPage'
import CandidateJobsPage from './pages/CandidateJobsPage'
import CandidateProfilePage from './pages/CandidateProfilePage'
import CandidateSavedJobsPage from './pages/CandidateSavedJobsPage'
import EmployerApplicantsPage from './pages/EmployerApplicantsPage'
import EmployerAvailabilityPage from './pages/EmployerAvailabilityPage'
import EmployerDashboardPage from './pages/EmployerDashboardPage'
import EmployerJobFormPage from './pages/EmployerJobFormPage'
import EmployerProfilePage from './pages/EmployerProfilePage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/candidate"
        element={
          <ProtectedRoute role="Candidate">
            <CandidateAppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CandidateOverviewPage />} />
        <Route path="jobs" element={<CandidateJobsPage />} />
        <Route path="saved" element={<CandidateSavedJobsPage />} />
        <Route path="applications" element={<CandidateApplicationsPage />} />
        <Route path="applications/:applicationId/book" element={<CandidateBookInterviewPage />} />
        <Route path="profile" element={<CandidateProfilePage />} />
      </Route>
      <Route
        path="/employer"
        element={
          <ProtectedRoute role="Employer">
            <EmployerDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/profile"
        element={
          <ProtectedRoute role="Employer">
            <EmployerProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/availability"
        element={
          <ProtectedRoute role="Employer">
            <EmployerAvailabilityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/jobs/new"
        element={
          <ProtectedRoute role="Employer">
            <EmployerJobFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/jobs/:jobId/edit"
        element={
          <ProtectedRoute role="Employer">
            <EmployerJobFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employer/jobs/:jobId/applicants"
        element={
          <ProtectedRoute role="Employer">
            <EmployerApplicantsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
