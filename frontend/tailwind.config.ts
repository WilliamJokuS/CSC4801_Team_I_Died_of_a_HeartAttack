import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        'danger-bg': 'var(--color-danger-bg)',
        'info-bg': 'var(--color-info-bg)',
        interviewing: 'var(--color-interviewing)',
        accepted: 'var(--color-accepted)',
        rejected: 'var(--color-rejected)',
        pending: 'var(--color-pending)',
      },
    },
  },
  plugins: [],
} satisfies Config
