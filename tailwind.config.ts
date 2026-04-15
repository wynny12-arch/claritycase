import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b1020',
        panel: '#11182b',
        panel2: '#16213a',
        foreground: '#eef4ff',
        muted: '#9fb0cf',
        accent: '#57a8ff',
        accent2: '#7ef0d0',
        warning: '#ffc857',
        danger: '#ff6b6b',
        navy: '#0d1427',
        navy2: '#162340',
        border: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
