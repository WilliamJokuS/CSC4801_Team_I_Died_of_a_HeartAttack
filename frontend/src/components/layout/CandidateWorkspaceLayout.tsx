import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { applicationsApi } from '../../api/endpoints'
import { IconBookmark, IconBriefcase, IconSearch, IconUser } from '../icons/NavIcons'
import { useAuth } from '../../hooks/useAuth'
import { useSavedJobs } from '../../hooks/useSavedJobs'
import { initialsFromDisplayName } from '../../lib/companyLogoStyle'
import { isPreviewUser } from '../../lib/preview'

const breadcrumbLabels: Record<string, string> = {
  '/candidate': 'Find jobs',
  '/candidate/saved': 'Saved jobs',
  '/candidate/applications': 'My applications',
  '/candidate/profile': 'Profile & résumé',
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex w-full items-center gap-3 rounded-[11px] px-[15px] py-[13px] text-left text-sm font-semibold transition',
    isActive ? 'bg-brand-soft text-brand' : 'text-nav-muted hover:bg-soft hover:text-ink',
  ].join(' ')
}

function CandidateWorkspaceLayout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const previewMode = isPreviewUser(user?.id)
  const { savedCount } = useSavedJobs(user?.id)

  const [appsCount, setAppsCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!user || previewMode) {
      setAppsCount(0)
      return
    }
    applicationsApi
      .listMine()
      .then((list) => setAppsCount(list.length))
      .catch(() => setAppsCount(0))
  }, [user, previewMode, location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const breadcrumb =
    location.pathname.includes('/book') ? 'Book interview' : (breadcrumbLabels[location.pathname] ?? 'Workspace')

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-ink/30 md:hidden"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed z-30 flex h-screen w-[252px] flex-col border-r border-line bg-white px-[17px] py-[30px] transition-transform md:sticky md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-[260px]'
        }`}
      >
        <Link to="/candidate" className="flex items-center gap-[11px] px-[13px] pb-10 font-display text-[19px] font-extrabold tracking-tight">
          <span className="grid h-[35px] w-[35px] place-items-center rounded-[11px] bg-brand text-base text-white">sm</span>
          <span>
            skillmatch
            <small className="mt-0.5 block font-sans text-[10px] font-medium uppercase tracking-[2px] text-muted-light">
              Careers, made clearer.
            </small>
          </span>
        </Link>

        <p className="mb-[13px] px-[15px] text-[10px] font-extrabold uppercase tracking-[1.8px] text-muted-lighter">
          Workspace
        </p>

        <nav className="flex flex-col gap-1">
          <NavLink to="/candidate" end className={navClass}>
            <IconSearch />
            Find jobs
          </NavLink>
          <NavLink to="/candidate/saved" className={navClass}>
            <IconBookmark />
            Saved jobs
            {savedCount > 0 && (
              <span className="ml-auto rounded-full bg-accent-soft px-[7px] py-0.5 text-[11px] text-brand-dark">
                {savedCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/candidate/applications" className={navClass}>
            <IconBriefcase />
            My applications
            {appsCount > 0 && (
              <span className="ml-auto rounded-full bg-accent-soft px-[7px] py-0.5 text-[11px] text-brand-dark">
                {appsCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/candidate/profile" className={navClass}>
            <IconUser />
            Profile & résumé
          </NavLink>
        </nav>

        <div className="mt-auto">
          <div className="mb-[18px] rounded-2xl border border-tip-line bg-tip p-[18px]">
            <div className="text-[23px]">✦</div>
            <strong className="mt-[11px] block text-[13px]">Complete your profile</strong>
            <p className="mb-[13px] mt-1.5 text-xs leading-relaxed text-tip-text">
              Add your skills to discover roles that are better aligned with your experience.
            </p>
            <Link to="/candidate/profile" className="text-xs font-bold text-brand">
              Update profile →
            </Link>
          </div>

          <div className="flex items-center gap-2.5 border-t border-line px-1 pt-5">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-avatar text-sm font-extrabold text-avatar-fg">
              {initialsFromDisplayName(user?.display_name ?? 'You')}
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-xs">{user?.display_name}</strong>
              <small className="text-[11px] text-muted-light">Candidate account</small>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="text-xs font-semibold text-nav-muted hover:text-brand"
              title="Log out"
            >
              Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-between border-b border-line bg-white/80 px-5 backdrop-blur md:px-[54px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-[11px] border border-line bg-white text-nav-muted md:hidden"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="text-xs text-muted">
              Your workspace <span className="mx-2 text-line-strong">/</span>{' '}
              <strong className="font-bold text-ink-strong">{breadcrumb}</strong>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-xs text-muted">Your next chapter starts here</span>
            <Link
              to="/candidate/saved"
              className="grid h-9 w-9 place-items-center rounded-[11px] border border-line bg-white text-nav-muted hover:text-brand"
              title="Saved jobs"
            >
              <IconBookmark className="h-[17px] w-[17px]" />
            </Link>
            <Link
              to="/candidate/profile"
              className="grid h-9 w-9 place-items-center rounded-[11px] border border-line bg-white text-nav-muted hover:text-brand"
              title="Profile"
            >
              <IconUser className="h-[17px] w-[17px]" />
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1330px] flex-1 px-[18px] py-8 md:px-[54px] md:py-[45px]">
          {children ?? <Outlet />}
        </div>
      </div>
    </div>
  )
}

export default CandidateWorkspaceLayout
