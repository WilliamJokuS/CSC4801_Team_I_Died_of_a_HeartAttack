import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';

export function RoleGate({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (user.role !== role) {
    const dashboard = user.role === 'Candidate' ? '/candidate/dashboard' : '/employer/dashboard';
    return <Navigate to={dashboard} replace />;
  }
  return <>{children}</>;
}
