import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../ui/BrandLogo'
import AuthLoginShowcase from './AuthLoginShowcase'

function AuthPageShell({
  children,
  headerAction,
}: {
  children: ReactNode
  headerAction: ReactNode
}) {
  return (
    <div className="min-h-screen bg-white text-[#17233b]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <AuthLoginShowcase />

        <div className="flex min-h-screen flex-col bg-canvas">
          <header className="flex items-center justify-between gap-3 px-6 py-5 lg:px-12">
            <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
              <BrandLogo />
              <span className="text-[21px]">SkillMatch</span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted">{headerAction}</div>
          </header>
          <div className="flex flex-1 items-center justify-center px-6 pb-12 lg:px-12">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default AuthPageShell
