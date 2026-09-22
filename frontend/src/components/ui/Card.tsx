import React from 'react';

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border/90 bg-background p-5 shadow-sm shadow-slate-900/[0.025] sm:p-6 ${className}`}>
      {children}
    </div>
  );
}
