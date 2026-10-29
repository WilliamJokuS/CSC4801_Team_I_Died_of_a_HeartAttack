export type LogoVariant = 'default' | 'purple' | 'orange' | 'blue' | 'pink' | 'teal'

const VARIANTS: LogoVariant[] = ['default', 'purple', 'orange', 'blue', 'pink', 'teal']

export function logoVariantForName(name: string): LogoVariant {
  let hash = 0
  for (const char of name) {
    hash = (hash + char.charCodeAt(0)) % 997
  }
  return VARIANTS[hash % VARIANTS.length] ?? 'default'
}

export function logoInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return '?'
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export function initialsFromDisplayName(displayName: string): string {
  return logoInitial(displayName.replace(/\s+/g, ' '))
}
