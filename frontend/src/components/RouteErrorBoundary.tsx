import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

export default RouteErrorBoundary
