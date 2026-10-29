import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/candidate', label: 'Find jobs' },
  { to: '/candidate/applications', label: 'My applications' },
  { to: '/candidate/profile', label: 'Profile & resume' },
] as const

function CandidateNav() {
  const { pathname } = useLocation()

  return (
    <div className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        {links.map(({ to, label }) => {
          const isActive =
            pathname === to ||
            (to === '/candidate/applications' && pathname.includes('/book'))
          return (
            <Link
              key={to}
              to={to}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default CandidateNav
