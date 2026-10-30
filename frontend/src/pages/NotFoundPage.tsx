import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function NotFoundPage() {
  const { user } = useAuth()
  const home =
    user?.role === 'Employer' ? '/employer' : user?.role === 'Candidate' ? '/candidate' : '/'

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="page-heading">Page not found</h1>
      <p className="page-sub mt-3">That link doesn&apos;t match any page in SkillMatch.</p>
      <Link to={home} className="btn-primary mt-8">
        Go home
      </Link>
    </div>
  )
}

export default NotFoundPage
