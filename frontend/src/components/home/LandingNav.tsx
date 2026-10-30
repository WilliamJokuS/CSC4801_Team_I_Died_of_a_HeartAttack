import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../ui/BrandLogo'

const navLinkClass =
  'text-sm text-[#58657b] transition hover:text-[#456be8] max-lg:w-full max-lg:py-1'

function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = () => setMobileOpen(false)

  return (
    <nav className="sticky top-0 z-30 h-[70px] border-b border-[#e7ebf2] bg-white/97 backdrop-blur-sm lg:h-[82px]">
      <div className="relative mx-auto flex h-full max-w-[1190px] items-center gap-5 px-[22px] lg:gap-10 lg:px-[30px]">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[19px] font-bold tracking-[-0.85px] text-[#111d34] lg:text-[22px]"
          onClick={closeMobile}
        >
          <BrandLogo size={35} />
          SkillMatch
        </Link>

        <div
          id="landing-navlinks"
          className={`ml-0 flex items-center gap-4 lg:ml-14 lg:gap-8 ${
            mobileOpen
              ? 'absolute left-0 right-0 top-[69px] flex-col items-start border-b border-[#e7ebf2] bg-white px-[22px] py-[22px] shadow-[0_15px_20px_rgba(21,35,62,0.06)] lg:static lg:flex-row lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
              : 'hidden lg:flex'
          }`}
        >
          <a href="#how" className={navLinkClass} onClick={closeMobile}>
            How it works
          </a>
          <a href="#features" className={navLinkClass} onClick={closeMobile}>
            For job seekers
          </a>
          <a href="#features" className={navLinkClass} onClick={closeMobile}>
            For employers
          </a>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            to="/login"
            className="hidden min-h-[43px] items-center justify-center rounded-[9px] border border-[#dfe4ee] bg-white px-5 py-3 text-sm font-semibold text-[#273650] transition hover:-translate-y-px hover:border-[#b5bfd3] sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-[43px] items-center justify-center gap-2 rounded-[9px] border border-transparent bg-[#4168e4] px-[13px] py-2.5 text-xs font-semibold text-white shadow-[0_6px_13px_rgba(65,104,228,0.1)] transition hover:-translate-y-px hover:bg-[#3358d0] sm:px-5 sm:py-3 sm:text-sm"
          >
            Get started <span aria-hidden>↗</span>
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="landing-navlinks"
            className="ml-2 border-0 bg-white text-2xl leading-none text-[#17243b] lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
      </div>
    </nav>
  )
}

export default LandingNav
