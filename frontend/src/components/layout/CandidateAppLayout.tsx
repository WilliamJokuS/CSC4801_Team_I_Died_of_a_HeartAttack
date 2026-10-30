import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import BrandLogo from '../ui/BrandLogo'
import { useAuth } from '../../hooks/useAuth'
import { initialsFromDisplayName } from '../../lib/companyLogoStyle'
import { appTabClass } from './appTabClass'

function CandidateAppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 md:px-[30px]">
          <NavLink to="/candidate" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight">
            <BrandLogo />
            <strong className="text-[21px]">SkillMatch</strong>
          </NavLink>

          <nav className="flex items-center justify-center gap-1.5 overflow-x-auto">
            <NavLink to="/candidate/jobs" className={({ isActive }) => appTabClass(isActive)}>
              Find jobs
            </NavLink>
            <NavLink to="/candidate/saved" className={({ isActive }) => appTabClass(isActive)}>
              Saved jobs
            </NavLink>
            <NavLink to="/candidate/applications" className={({ isActive }) => appTabClass(isActive)}>
              Applications
            </NavLink>
            <NavLink to="/candidate/profile" className={({ isActive }) => appTabClass(isActive)}>
              My profile
            </NavLink>
          </nav>

          <div className="flex items-center justify-end gap-3">
            <span className="hidden rounded-full border border-line px-[11px] py-[7px] text-xs text-[#66748c] sm:inline">
              Candidate workspace
            </span>
            <NavLink
              to="/candidate/profile"
              className="grid h-[37px] w-[37px] place-items-center rounded-full bg-[#e6ecf7] text-xs font-bold text-[#3a5c9b]"
              title="Profile"
            >
              {initialsFromDisplayName(user?.display_name ?? 'You')}
            </NavLink>
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

export default CandidateAppLayout
