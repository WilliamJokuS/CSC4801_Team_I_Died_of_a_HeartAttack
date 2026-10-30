export function appTabClass(isActive: boolean): string {
  return [
    'inline-flex h-[42px] items-center whitespace-nowrap rounded-[9px] px-[17px] text-sm font-semibold transition',
    isActive
      ? 'bg-[#edf3ff] text-[#2858ce]'
      : 'bg-transparent text-[#647187] hover:bg-[#f5f7fb] hover:text-ink',
  ].join(' ')
}
