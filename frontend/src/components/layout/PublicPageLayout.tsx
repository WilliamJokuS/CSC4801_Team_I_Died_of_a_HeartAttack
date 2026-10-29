import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SiteFooter from './SiteFooter'

function PublicPageLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              SM
            </span>
            <span className="text-lg font-bold text-brand-900">SkillMatch</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Back to home
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="hidden flex-1 flex-col justify-center bg-gradient-to-br from-brand-700 to-brand-900 px-10 py-16 text-white lg:flex">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-100">Careers platform</p>
          <h1 className="mt-4 max-w-md text-4xl font-bold leading-tight">{title}</h1>
          <p className="mt-4 max-w-md text-brand-100">
            Discover roles ranked by your skills. Employers review applicants by match score and schedule
            interviews in one place.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-brand-50">
            <li>✓ Smart skill matching</li>
            <li>✓ One-click applications</li>
            <li>✓ Interview booking</li>
          </ul>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">{children}</div>
      </div>

      <SiteFooter />
    </div>
  )
}

export default PublicPageLayout
