import type { ReactNode } from 'react'
import Header from '../Header'
import SiteFooter from './SiteFooter'

type PageWidth = '2xl' | '3xl' | '4xl' | '6xl'

const widthClass: Record<PageWidth, string> = {
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
}

function PageShell({
  nav,
  children,
  width = '6xl',
}: {
  nav?: ReactNode
  children: ReactNode
  width?: PageWidth
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header />
      {nav}
      <main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 ${widthClass[width]}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export default PageShell
