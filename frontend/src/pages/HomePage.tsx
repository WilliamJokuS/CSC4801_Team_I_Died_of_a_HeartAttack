import { Link, Navigate } from 'react-router-dom'
import SiteFooter from '../components/layout/SiteFooter'
import { useAuth } from '../hooks/useAuth'
import LoadingScreen from '../components/LoadingScreen'

function HomePage() {
  const { user, isLoading, previewAs } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to={user.role === 'Candidate' ? '/candidate' : '/employer'} replace />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand text-sm font-bold lowercase text-white">
              sm
            </span>
            <span className="font-display text-xl font-extrabold text-ink">skillmatch</span>
          </div>
          <div className="flex gap-2">
            <Link to="/login" className="btn-secondary">
              Log in
            </Link>
            <Link to="/register" className="btn-primary">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-br from-brand via-[#174a39] to-[#0f3328] text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">
            Malaysia&apos;s skill-first job board
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            Find jobs that actually match your skills
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-50">
            Browse openings ranked by match score, apply in one click, and book interviews when
            employers are ready — like a real recruiting platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg hover:bg-brand-50"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              to="/login"
              className="rounded-lg border-2 border-white/80 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:px-8">
        {[
          {
            title: 'For job seekers',
            text: 'See match scores on every role. Highlight skills you have vs skills to learn.',
          },
          {
            title: 'For employers',
            text: 'Post jobs with tags, review applicants sorted by fit, manage interview slots.',
          },
          {
            title: 'Built for CSC4801',
            text: 'Secure auth, fair matching, and atomic interview booking — production-ready flows.',
          },
        ].map((item) => (
          <div key={item.title} className="card-panel">
            <h2 className="font-bold text-brand-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.text}</p>
          </div>
        ))}
      </section>

      {import.meta.env.DEV && (
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Developer preview (no backend)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => previewAs('Candidate')} className="btn-secondary">
                Preview candidate experience
              </button>
              <button type="button" onClick={() => previewAs('Employer')} className="btn-secondary">
                Preview employer experience
              </button>
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  )
}

export default HomePage
