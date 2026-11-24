import { Fragment, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Role } from '../types'
import LoadingScreen from './LoadingScreen'

function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user, isLoading, sessionVersion } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <Fragment key={sessionVersion}>{children}</Fragment>
}

export default ProtectedRoute
