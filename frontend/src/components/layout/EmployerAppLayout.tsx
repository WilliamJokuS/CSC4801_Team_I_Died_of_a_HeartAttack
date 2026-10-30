import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import BrandLogo from '../ui/BrandLogo'
import { useAuth } from '../../hooks/useAuth'
import { initialsFromDisplayName } from '../../lib/companyLogoStyle'
import { appTabClass } from './appTabClass'

function EmployerAppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const tabs = [
    { to: '/employer', label: 'Job postings' },
    { to: '/employer/availability', label: 'Interview slots' },
    { to: '/employer/profile', label: 'Company profile' },
  ] as const

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 md:px-[30px]">
          <NavLink to="/employer" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight">
            <BrandLogo />
            <strong className="text-[21px]">SkillMatch</strong>
          </NavLink>

          <nav className="flex items-center justify-center gap-1.5 overflow-x-auto">
            {tabs.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to !== '/employer'}
                className={({ isActive }) => appTabClass(isActive)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-3">
            <span className="hidden rounded-full border border-line px-[11px] py-[7px] text-xs text-[#66748c] sm:inline">
              Employer workspace
            </span>
            <span
              className="grid h-[37px] w-[37px] place-items-center rounded-full bg-[#e6ecf7] text-xs font-bold text-[#3a5c9b]"
              title={user?.display_name}
            >
              {initialsFromDisplayName(user?.display_name ?? 'Co')}
            </span>
            <button type="button" onClick={() => void handleLogout()} className="btn-secondary px-3 py-2 text-xs">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-[15px] pb-[90px] pt-[25px] md:px-[30px] md:pt-[38px]">
        <Outlet />
      </main>
    </div>
  )
}

export default EmployerAppLayout
