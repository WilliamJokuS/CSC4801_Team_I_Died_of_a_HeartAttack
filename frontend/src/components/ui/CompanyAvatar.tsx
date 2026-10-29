function CompanyAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-700"
      aria-hidden
    >
      {initial}
    </div>
  )
}

export default CompanyAvatar
