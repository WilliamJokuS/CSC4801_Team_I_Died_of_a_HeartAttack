import { logoInitial, logoVariantForName, type LogoVariant } from '../../lib/companyLogoStyle'

const variantClass: Record<LogoVariant, string> = {
  default: 'bg-logo-default text-logo-default-fg',
  purple: 'bg-logo-purple text-logo-purple-fg',
  orange: 'bg-logo-orange text-logo-orange-fg',
  blue: 'bg-logo-blue text-logo-blue-fg',
  pink: 'bg-logo-pink text-logo-pink-fg',
  teal: 'bg-logo-teal text-logo-teal-fg',
}

function CompanyLogo({
  name,
  size = 'md',
}: {
  name: string
  size?: 'md' | 'lg'
}) {
  const variant = logoVariantForName(name)
  const initial = logoInitial(name)
  const sizeClass = size === 'lg' ? 'h-[47px] w-[47px] rounded-[13px] text-xl' : 'h-11 w-11 rounded-[13px] text-base'

  return (
    <div
      className={`grid shrink-0 place-items-center font-extrabold ${sizeClass} ${variantClass[variant]}`}
      aria-hidden
    >
      {initial}
    </div>
  )
}

export default CompanyLogo
