import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/employer', label: 'Job postings' },
  { to: '/employer/availability', label: 'Interview slots' },
  { to: '/employer/profile', label: 'Company profile' },
] as const

function EmployerNav() {
  const { pathname } = useLocation()

  return (
    <div className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        {links.map(({ to, label }) => {
          const isActive =
            pathname === to ||
            (to === '/employer' && pathname.startsWith('/employer/jobs'))
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

export default EmployerNav
