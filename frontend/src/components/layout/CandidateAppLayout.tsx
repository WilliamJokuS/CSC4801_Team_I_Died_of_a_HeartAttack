import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import BrandLogo from '../ui/BrandLogo'
import { useAuth } from '../../hooks/useAuth'
import { initialsFromDisplayName } from '../../lib/companyLogoStyle'

function tabClass({ isActive }: { isActive: boolean }) {
  return [
    'h-[42px] whitespace-nowrap rounded-[9px] px-[17px] text-sm font-semibold transition',
    isActive ? 'bg-[#edf3ff] text-[#2858ce]' : 'bg-transparent text-[#647187] hover:bg-[#f5f7fb] hover:text-ink',
  ].join(' ')
}

function CandidateAppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-white">
        <div className="mx-auto flex h-[74px] max-w-[1240px] flex-wrap items-center gap-3 px-5 md:gap-[54px] md:px-[30px]">
          <NavLink to="/candidate" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight">
            <BrandLogo />
            <strong className="text-[21px]">SkillMatch</strong>
          </NavLink>

          <nav className="flex h-full flex-1 items-center gap-1.5 overflow-x-auto">
            <NavLink to="/candidate" end className={tabClass}>
              Overview
            </NavLink>
            <NavLink to="/candidate/jobs" className={tabClass}>
              Find jobs
            </NavLink>
            <NavLink to="/candidate/saved" className={tabClass}>
              Saved jobs
            </NavLink>
            <NavLink to="/candidate/applications" className={tabClass}>
              Applications
            </NavLink>
            <NavLink to="/candidate/profile" className={tabClass}>
              My profile
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
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
