import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const homeTo = user?.role === 'Employer' ? '/employer' : user?.role === 'Candidate' ? '/candidate' : '/'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to={homeTo} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand text-sm font-bold lowercase text-white shadow-sm">
            sm
          </span>
          <div className="leading-tight">
            <span className="block font-display text-base font-extrabold text-ink">skillmatch</span>
            <span className="hidden text-xs text-slate-500 sm:block">Careers</span>
          </div>
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-semibold text-slate-900">{user.display_name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <button type="button" onClick={handleLogout} className="btn-secondary py-2 text-xs sm:text-sm">
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary py-2 text-xs sm:text-sm">
              Log in
            </Link>
            <Link to="/register" className="btn-primary py-2 text-xs sm:text-sm">
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
