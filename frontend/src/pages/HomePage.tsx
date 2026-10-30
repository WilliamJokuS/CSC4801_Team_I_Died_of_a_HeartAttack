import { Link, Navigate } from 'react-router-dom'
import LandingNav from '../components/home/LandingNav'
import BrandLogo from '../components/ui/BrandLogo'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'

const landingBtnPrimary =
  'inline-flex min-h-[43px] items-center justify-center gap-2 rounded-[9px] border border-transparent bg-[#4168e4] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_13px_rgba(65,104,228,0.1)] transition hover:-translate-y-px hover:bg-[#3358d0]'

const landingBtnLight =
  'inline-flex min-h-[43px] items-center justify-center gap-2 rounded-[9px] border border-[#dfe4ee] bg-white px-5 py-3 text-sm font-semibold text-[#273650] transition hover:-translate-y-px hover:border-[#b5bfd3]'

function HomePage() {
  const { user, isLoading, previewAs } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to={user.role === 'Candidate' ? '/candidate' : '/employer'} replace />
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#17243b]">
      <LandingNav />

      <main id="home">
        <section
          className="relative overflow-hidden px-[22px] py-[66px] lg:px-[30px] lg:py-[89px] lg:pb-[105px]"
          style={{ background: 'linear-gradient(125deg, #fbfcff 8%, #f4f7ff 100%)' }}
        >
          <div
            className="pointer-events-none absolute -right-[240px] -top-[440px] h-[950px] w-[950px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, #e5ecff 0%, rgba(229,236,255,0.5) 45%, transparent 69%)',
            }}
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-[1190px] items-center gap-9 lg:grid-cols-[1.03fr_0.97fr] lg:gap-11">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[1.15px] text-[#4266cc]">
                <span className="h-[7px] w-[7px] rounded-full bg-[#4c72ec]" aria-hidden />
                A smarter way to find work
              </div>
              <h1 className="my-6 max-w-[670px] text-[clamp(48px,5.1vw,70px)] font-bold leading-[1.07] tracking-[-3.5px] max-lg:tracking-[-2.3px]">
                Find work that <span className="text-[#456be8]">fits your skills.</span>
              </h1>
              <p className="mb-8 max-w-[478px] text-[15px] leading-[1.75] text-[#586780] lg:text-[17px]">
                Discover opportunities that match what you know, see where you&apos;re a strong fit, and
                manage every application in one place.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/register" className={`${landingBtnPrimary} min-h-[51px] px-[21px] py-3.5`}>
                  Find your next role <span aria-hidden>→</span>
                </Link>
                <a href="#how" className={`${landingBtnLight} min-h-[51px] px-[21px] py-3.5`}>
                  See how it works <span aria-hidden>↗</span>
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-[22px] gap-y-2 text-xs text-[#78849b]">
                <span>
                  <b className="font-bold text-[#4369e5]">✓</b> Skill-based job matching
                </span>
                <span>
                  <b className="font-bold text-[#4369e5]">✓</b> Simple applications
                </span>
                <span>
                  <b className="font-bold text-[#4369e5]">✓</b> Clear progress tracking
                </span>
              </div>
            </div>

            <div className="relative flex min-h-[370px] items-center justify-center sm:min-h-[400px] lg:min-h-[460px]">
              <div className="relative w-full max-w-[500px] -rotate-[1.5deg] rounded-[18px] border border-[#e7eaf3] bg-white p-[21px] shadow-[0_28px_70px_rgba(34,60,120,0.1)] transition-transform duration-200 hover:rotate-0 max-sm:max-w-[450px]">
                <div className="flex items-center justify-between border-b border-[#e7ebf2] pb-4 pt-0.5">
                  <div className="text-base font-bold">Recommended for you</div>
                  <span className="text-[11px] text-[#8b96aa]">Based on your skills</span>
                </div>
                <div className="my-[17px] mb-[13px] rounded-lg border border-[#e7ebf2] bg-[#fbfcff] px-3.5 py-3 text-xs text-[#8e99aa]">
                  ⌕ &nbsp;Search by job title, company or skill
                </div>

                {[
                  {
                    letter: 'N',
                    className: 'bg-[#e8eefe] text-[#4765a6]',
                    title: 'Product Analyst',
                    sub: 'Northstar Labs · Kuala Lumpur · Hybrid',
                    tags: ['SQL', 'Python', 'Analytics'],
                    score: '96% match',
                  },
                  {
                    letter: 'A',
                    className: 'bg-[#f0eafb] text-[#7455a2]',
                    title: 'Business Analyst',
                    sub: 'Acme Analytics · Penang · On-site',
                    tags: ['Excel', 'Reporting', 'Communication'],
                    score: '91% match',
                  },
                  {
                    letter: 'S',
                    className: 'bg-[#fff0e4] text-[#b16a31]',
                    title: 'Junior UX Researcher',
                    sub: 'Studio One · Remote',
                    tags: ['Research', 'Figma'],
                    score: '87% match',
                  },
                ].map((job, i, arr) => (
                  <div
                    key={job.title}
                    className={`flex gap-3 border-[#f0f2f6] py-[17px] ${i < arr.length - 1 ? 'border-b' : ''}`}
                  >
                    <div
                      className={`grid h-[41px] w-[41px] shrink-0 place-items-center rounded-[11px] text-[15px] font-bold ${job.className}`}
                    >
                      {job.letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">{job.title}</div>
                      <div className="mt-1.5 text-[11px] text-[#7b869b] max-[410px]:text-[10px]">
                        {job.sub}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.tags.map((tag) => (
                          <em
                            key={tag}
                            className="rounded-[5px] bg-[#f4f6fa] px-2 py-1.5 text-[10px] not-italic text-[#687793]"
                          >
                            {tag}
                          </em>
                        ))}
                      </div>
                    </div>
                    <div className="h-max shrink-0 rounded-[7px] bg-[#eef2ff] px-[9px] py-[7px] text-[11px] font-bold text-[#3b62d9]">
                      {job.score}
                    </div>
                  </div>
                ))}
              </div>

              <div className="absolute bottom-3 left-0 z-[2] flex max-w-[calc(100%-1rem)] rotate-[2deg] items-center gap-2.5 rounded-[11px] border border-[#e8edf7] bg-white p-4 text-xs shadow-[0_16px_38px_rgba(33,54,108,0.11)] max-[410px]:hidden sm:bottom-[41px] sm:-left-[15px] lg:-left-[53px]">
                <div className="grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full bg-[#e3f5eb] text-sm font-bold text-[#238154]">
                  ✓
                </div>
                <div>
                  <strong className="mb-0.5 block">Your profile is a strong match</strong>
                  <small className="text-[#8190a1]">See matched and missing skills at a glance</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#eff1f6] bg-white">
          <div className="mx-auto flex min-h-[93px] max-w-[1190px] flex-wrap items-center justify-between gap-5 px-[22px] py-6 lg:px-[30px] lg:py-0">
            <p className="m-0 w-full text-[13px] text-[#8791a3] lg:w-auto">
              Designed for each step of hiring
            </p>
            {['Discover roles', 'Compare skills', 'Apply confidently', 'Track progress'].map((label) => (
              <div key={label} className="flex items-center gap-2 text-[13px] font-semibold text-[#596784]">
                <span className="text-[#496ee6]" aria-hidden>
                  ✓
                </span>
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="px-[22px] py-[70px] lg:px-[30px] lg:py-[95px]" id="features">
          <div className="mx-auto max-w-[1190px]">
            <div className="mb-8 flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-[#4b6be0]">
                  One platform, fewer steps
                </div>
                <h2 className="my-3 text-[30px] font-bold leading-tight tracking-[-1.4px] lg:text-4xl">
                  Everything in one place.
                </h2>
                <p className="m-0 max-w-[550px] text-[15px] leading-relaxed text-[#77839a]">
                  Focus on the opportunities that matter, with tools for candidates and hiring teams.
                </p>
              </div>
              <a
                href="#how"
                className="whitespace-nowrap text-[13px] font-bold text-[#4267dd] hover:underline"
              >
                Explore the platform ↗
              </a>
            </div>
            <div className="grid gap-[18px] md:grid-cols-3">
              {[
                {
                  icon: '◎',
                  title: 'Find a better fit',
                  text: 'See how your skills line up with each role, so you can spend time on the right opportunities.',
                },
                {
                  icon: '▤',
                  title: 'Keep applications organized',
                  text: 'Track the roles you’ve applied for and see updates without searching through your inbox.',
                },
                {
                  icon: '▦',
                  title: 'Hire with more context',
                  text: 'Review candidates by relevant skills and coordinate interviews from a shared workspace.',
                },
              ].map((f) => (
                <article
                  key={f.title}
                  className="rounded-[14px] border border-[#e7ebf2] bg-white px-[26px] pb-[30px] pt-[27px] transition hover:-translate-y-0.5 hover:border-[#c5d3f9] hover:shadow-[0_14px_34px_rgba(20,35,62,0.04)]"
                >
                  <div className="grid h-[45px] w-[45px] place-items-center rounded-[11px] bg-[#edf2ff] text-[21px] text-[#4668de]">
                    {f.icon}
                  </div>
                  <h3 className="mb-2.5 mt-6 text-lg font-bold tracking-[-0.3px]">{f.title}</h3>
                  <p className="m-0 text-sm leading-[1.7] text-[#768399]">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f7f9fd] px-[22px] py-[70px] lg:px-[30px] lg:py-[95px]" id="how">
          <div className="mx-auto grid max-w-[1190px] items-center gap-9 lg:grid-cols-2 lg:gap-20">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-[#4b6be0]">
                How SkillMatch works
              </div>
              <h2 className="my-3 text-[30px] font-bold leading-tight tracking-[-1.4px] lg:text-4xl">
                From searching to your next step.
              </h2>
              <p className="max-w-[460px] text-[15px] leading-[1.7] text-[#77839a]">
                A clearer way to explore opportunities and stay on top of applications.
              </p>
              <div className="mt-8 grid gap-6">
                {[
                  {
                    num: '01',
                    title: 'Build your profile',
                    text: 'Add your skills, experience, and the kind of role you want.',
                  },
                  {
                    num: '02',
                    title: 'Explore relevant jobs',
                    text: 'Compare roles with skill-match information alongside each listing.',
                  },
                  {
                    num: '03',
                    title: 'Manage what comes next',
                    text: 'Keep applications, statuses, and interview details together.',
                  },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4">
                    <div className="grid h-[33px] w-[33px] shrink-0 place-items-center rounded-[9px] border border-[#cfdaff] text-[13px] font-bold text-[#4064d8]">
                      {step.num}
                    </div>
                    <div>
                      <h3 className="mb-1.5 mt-px text-[15px] font-bold">{step.title}</h3>
                      <p className="m-0 text-sm leading-[1.65] text-[#7b8798]">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#e3e8f2] bg-white p-6 shadow-[0_21px_52px_rgba(28,51,81,0.05)]">
              <div className="mb-5 flex items-center justify-between gap-2.5">
                <strong className="text-[15px]">Application activity</strong>
                <span className="rounded-[20px] border border-[#dfe7f6] px-2.5 py-2 text-[11px] text-[#6078ac]">
                  Example preview
                </span>
              </div>
              {[
                {
                  title: 'Product Analyst',
                  sub: 'Northstar Labs · Applied 18 Oct',
                  status: 'Interview',
                  statusClass: 'bg-[#e7f3ff] text-[#3378bc]',
                },
                {
                  title: 'Business Analyst',
                  sub: 'Acme Analytics · Applied 20 Oct',
                  status: 'In review',
                  statusClass: 'bg-[#edf2ff] text-[#526caa]',
                },
                {
                  title: 'UX Research Intern',
                  sub: 'Studio One · Applied 22 Oct',
                  status: 'Applied',
                  statusClass: 'bg-[#f3f5f8] text-[#758091]',
                },
              ].map((row, i, arr) => (
                <div
                  key={row.title}
                  className={`flex justify-between gap-3 py-[15px] ${i < arr.length - 1 ? 'border-b border-[#e7ebf2]' : ''}`}
                >
                  <div>
                    <strong className="text-[13px]">{row.title}</strong>
                    <p className="mb-0 mt-1 text-xs text-[#8b94a7]">{row.sub}</p>
                  </div>
                  <span
                    className={`h-max shrink-0 rounded-[20px] px-2.5 py-[7px] text-[11px] ${row.statusClass}`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#142440] px-[22px] py-[84px] text-white lg:px-[30px]">
          <div className="mx-auto flex max-w-[1190px] flex-col items-start justify-between gap-9 lg:flex-row lg:items-center">
            <div>
              <h2 className="mb-3 text-[30px] font-bold tracking-[-1.4px] lg:text-4xl">
                Ready for a better way to apply?
              </h2>
              <p className="m-0 max-w-[520px] leading-[1.7] text-[#b2bfd3]">
                Create a profile and start exploring roles that match your skills.
              </p>
            </div>
            <Link
              to="/register"
              className="inline-flex min-h-[43px] min-w-[170px] items-center justify-center rounded-[9px] bg-white px-5 py-3 text-sm font-semibold text-[#1b2a4a] transition hover:-translate-y-px"
            >
              Create an account →
            </Link>
          </div>
        </section>
      </main>

      {import.meta.env.DEV && (
        <section className="mx-auto max-w-[1190px] px-[22px] pb-8 lg:px-[30px]">
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

      <footer className="bg-white">
        <div className="mx-auto flex max-w-[1190px] flex-col items-start justify-between gap-5 px-[22px] py-7 text-xs text-[#8b95a5] lg:flex-row lg:items-center lg:px-[30px]">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 text-base font-bold tracking-[-0.85px] text-[#111d34]"
          >
            <BrandLogo size={25} />
            SkillMatch
          </Link>
          <span>SkillMatch Careers · A skill-first recruitment platform</span>
          <div className="flex flex-wrap gap-6">
            <a href="#features" className="hover:text-[#456be8]">
              Features
            </a>
            <a href="#how" className="hover:text-[#456be8]">
              How it works
            </a>
            <a href="#home" className="hover:text-[#456be8]">
              Back to top ↑
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
