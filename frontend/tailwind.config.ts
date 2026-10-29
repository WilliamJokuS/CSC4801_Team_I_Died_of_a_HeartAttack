/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f8f9fc',
        ink: '#182337',
        'ink-strong': '#25334d',
        muted: '#748095',
        'muted-light': '#8591a2',
        'muted-lighter': '#9aa5b5',
        line: '#e7ebf2',
        'line-strong': '#dbe2ef',
        brand: {
          DEFAULT: '#366be8',
          dark: '#244fc5',
          soft: '#edf3ff',
        },
        'brand-dark': '#244fc5',
        accent: '#cdebb7',
        'accent-soft': '#d6ebd8',
        soft: '#f4f7f3',
        'nav-muted': '#78847c',
        tip: '#f0f6ed',
        'tip-line': '#e4efe0',
        'tip-text': '#748278',
        avatar: '#e8e7da',
        'avatar-fg': '#586b49',
        logo: {
          default: '#eff1eb',
          'default-fg': '#386449',
          purple: '#f0eef8',
          'purple-fg': '#645b98',
          orange: '#f9efe2',
          'orange-fg': '#ad7841',
          blue: '#eaf2f8',
          'blue-fg': '#437c9b',
          pink: '#f7eaf0',
          'pink-fg': '#a96787',
          teal: '#e4f2ef',
          'teal-fg': '#39887b',
        },
        surface: {
          DEFAULT: '#f8f9f7',
          card: '#ffffff',
        },
      },
      boxShadow: {
        card: '0 9px 32px rgba(23, 49, 34, 0.035)',
        'card-hover': '0 14px 30px rgba(30, 70, 40, 0.06)',
        modal: '0 25px 100px rgba(0, 0, 0, 0.18)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        panel: '17px',
      },
    },
  },
  plugins: [],
}
