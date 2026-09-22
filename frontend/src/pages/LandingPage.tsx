
import { Link } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { Button } from '@/components/ui/Button';

export function LandingPage() {
  return (
    <AppShell user={null}>
      <section className="grid min-h-[calc(100vh-11rem)] items-center gap-14 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
        <div className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-accent shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-success" />
            Skills-first hiring
          </div>
          <h1 className="text-5xl font-bold leading-[1.04] tracking-[-0.045em] text-text-primary sm:text-6xl lg:text-7xl">
            Great work starts with the <span className="text-accent">right match.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-text-secondary">
            TalentMatch brings ambitious candidates and thoughtful teams together using the skills that actually matter.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/register?role=Candidate">
              <Button size="lg" className="w-full rounded-xl px-6 shadow-lg shadow-accent/20 sm:w-auto">
                Find your next role
                <span aria-hidden="true" className="ml-2">→</span>
              </Button>
            </Link>
            <Link to="/register?role=Employer">
              <Button variant="secondary" size="lg" className="w-full rounded-xl border-slate-300 bg-white/70 px-6 sm:w-auto">
                Hire great people
              </Button>
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-text-secondary">
            <span className="flex items-center gap-2"><span className="text-success">✓</span> Free to get started</span>
            <span className="flex items-center gap-2"><span className="text-success">✓</span> Transparent match scores</span>
            <span className="flex items-center gap-2"><span className="text-success">✓</span> Simple interview booking</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg" aria-label="Example candidate matches">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/5 blur-2xl" />
          <div className="rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-secondary">Top opportunities</p>
                <h2 className="mt-1 text-xl font-bold">Matched for you</h2>
              </div>
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">3 new</span>
            </div>
            {[
              ['Senior Product Designer', 'Northstar Studio', '96', ['Figma', 'Research', 'Systems']],
              ['Frontend Engineer', 'Vertex Labs', '89', ['React', 'TypeScript', 'CSS']],
              ['Product Manager', 'Atlas Works', '82', ['Strategy', 'Analytics', 'Agile']],
            ].map(([title, company, score, skills], index) => (
              <div key={title as string} className={`flex gap-4 py-5 ${index ? 'border-t border-border/70' : ''}`}>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface font-bold text-accent">{(company as string).charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-bold">{title as string}</h3><p className="mt-0.5 text-sm text-text-secondary">{company as string}</p></div>
                    <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-sm font-bold text-accent">{score as string}%</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{(skills as string[]).map((skill) => <span key={skill} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary">{skill}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute -bottom-5 -left-4 rounded-2xl border border-white bg-white px-4 py-3 shadow-xl sm:-left-10">
            <p className="text-xs font-semibold text-text-secondary">Average match quality</p>
            <p className="mt-0.5 text-2xl font-bold text-text-primary">91<span className="text-sm text-success">% ↑</span></p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
