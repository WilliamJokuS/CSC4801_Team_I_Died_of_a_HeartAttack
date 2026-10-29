function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      <p className="mt-4 text-sm font-medium text-slate-600">Loading…</p>
    </div>
  )
}

export default LoadingScreen
