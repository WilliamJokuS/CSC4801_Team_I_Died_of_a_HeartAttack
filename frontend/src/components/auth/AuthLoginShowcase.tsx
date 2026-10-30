function AuthLoginShowcase() {
  return (
    <section
      className="relative isolate hidden min-h-screen w-full overflow-hidden bg-[#eef2fd] lg:flex lg:items-center lg:px-[clamp(30px,7vw,125px)] lg:py-[clamp(48px,6vw,108px)] xl:pl-[10vw] xl:pr-[7vw]"
      aria-label="SkillMatch introduction"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-[3]"
        style={{ background: 'linear-gradient(123deg,#f7f9ff 0%,#eef2fd 60%,#e8edfd 100%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-[360px] -top-[260px] -z-[1] h-[590px] w-[590px] rounded-full border-[105px] border-[rgba(90,127,229,0.085)]"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-[#50617e]">
          <span className="inline-block h-[7px] w-[7px] rounded-full bg-[#4c74ea]" aria-hidden />
          A smarter way to search
        </div>

        <h1 className="mt-6 max-w-[680px] text-[clamp(38px,4.35vw,64px)] font-bold leading-[1.12] tracking-[-0.053em] text-[#17233b]">
          A better match.
          <br />
          <em className="not-italic text-[#416be9]">A better next step.</em>
        </h1>

        <p className="mt-5 max-w-[490px] text-[clamp(15px,1.25vw,17px)] leading-[1.65] text-[#64718a]">
          Find opportunities that fit your skills, see where you stand, and manage your applications in one place.
        </p>

        <div
          className="mt-10 max-w-[660px] -rotate-1 overflow-hidden rounded-[18px] border border-[#dce3f4] bg-white shadow-[0_24px_65px_rgba(23,42,97,0.09),0_3px_9px_rgba(23,42,97,0.03)] transition-transform duration-200 hover:rotate-0"
          aria-label="Example of SkillMatch job recommendations"
        >
          <div className="flex h-[52px] items-center justify-between border-b border-[#eef0f5] px-[22px]">
            <span className="text-[13px] font-bold text-[#17233b]">Recommended for you</span>
            <span className="text-[11px] text-[#7c89a0]">Skill-based matches&nbsp; ↗</span>
          </div>

          <div className="px-[23px] pb-[22px] pt-[21px]">
            <div className="mb-[15px] flex items-end justify-between gap-3">
              <h3 className="m-0 text-[19px] font-bold tracking-[-0.025em] text-[#17233b]">
                Roles worth exploring
              </h3>
              <span className="text-[11px] text-[#8490a5]">Based on your profile</span>
            </div>

            <div className="flex items-center gap-3.5 border-t border-[#edf0f5] py-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-[#e8edff] text-[15px] font-bold tracking-tight text-[#375ccc]">
                N
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-[13px] text-[#17233b]">Product Analyst</strong>
                <small className="block truncate text-[11px] text-[#8490a4]">
                  Northstar Labs · Hong Kong · Hybrid
                </small>
              </div>
              <div className="whitespace-nowrap rounded-lg bg-[#ecf1ff] px-[11px] py-2 text-xs font-bold text-[#3159c9]">
                96% match
              </div>
            </div>

            <div className="flex items-center gap-3.5 border-t border-[#edf0f5] py-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] bg-[#f2ebfd] text-[15px] font-bold tracking-tight text-[#7655b6]">
                A
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-[13px] text-[#17233b]">Data Analyst</strong>
                <small className="block truncate text-[11px] text-[#8490a4]">
                  Acme Analytics · Hong Kong · Full-time
                </small>
              </div>
              <div className="whitespace-nowrap rounded-lg bg-[#ecf1ff] px-[11px] py-2 text-xs font-bold text-[#3159c9]">
                91% match
              </div>
            </div>

            <div className="mt-[11px] flex flex-wrap items-center gap-[7px]">
              <span className="mr-1 text-[11px] text-[#7e8aa1]">Matched skills</span>
              {['Python', 'SQL', 'Power BI'].map((skill) => (
                <span
                  key={skill}
                  className="rounded-md border border-[#e5eaf4] bg-[#fafbff] px-[9px] py-1.5 text-[11px] text-[#54627b]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 text-xs text-[#72809a]">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#416be9"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 2.5 2.5L16 9" />
          </svg>
          Understand your fit before you apply.
        </p>
      </div>
    </section>
  )
}

export default AuthLoginShowcase
