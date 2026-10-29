type IconProps = { className?: string }

const searchIconClass = 'h-[18px] w-[18px] shrink-0'

export function IconSearch({ className = '' }: IconProps) {
  return (
    <svg
      className={`${searchIconClass} ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

export function IconBookmark({ className = 'h-[17px] w-[17px]' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  )
}

export function IconBriefcase({ className = 'h-[19px] w-[19px]' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 5V3h8v2M3 11h18" />
    </svg>
  )
}

export function IconUser({ className = 'h-[19px] w-[19px]' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-5 3-7 8-7s8 2 8 7" />
    </svg>
  )
}
