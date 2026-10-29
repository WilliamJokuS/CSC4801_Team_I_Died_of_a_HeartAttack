import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../ui/BrandLogo'

function AuthPageShell({
  children,
  headerAction,
}: {
  children: ReactNode
  headerAction: ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="hidden items-center justify-center bg-[#152644] px-10 py-14 text-white lg:flex">
          <div className="max-w-[470px]">
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#a9c4ff]">A better way to find work</p>
            <h1 className="mt-4 text-[clamp(36px,4vw,49px)] font-bold leading-[1.12] tracking-[-2px]">
              Discover work that fits what you do best.
            </h1>
            <p className="mt-4 leading-[1.8] text-[#c1cde2]">
              Find relevant opportunities, understand how your skills compare, and keep every application in one place.
            </p>
            <div className="mt-11 rounded-[15px] border border-[#526481] bg-[#223655] p-5">
              <div className="text-xs text-[#c4d2eb]">RECOMMENDED FOR YOU</div>
              <div className="mt-4 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e3e9fa] text-lg font-bold text-[#3155a9]">
                  N
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block">Product Analyst</strong>
                  <div className="mt-1 text-sm text-[#b6c8e6]">Northstar Labs · Hong Kong</div>
                </div>
                <span className="rounded-[7px] bg-[#edf3ff] px-2 py-1.5 text-[11px] font-bold text-[#295fc8]">
                  96% match
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
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
