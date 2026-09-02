/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0c0e12',
          900: '#10141a',
          850: '#12161d',
          800: '#14181f',
          750: '#1a1f28',
          700: '#1a212b',
          600: '#2a3140',
          500: '#3a4050',
          400: '#5c6575',
          300: '#8b93a1',
          100: '#e8eaed',
        },
        mint: {
          DEFAULT: '#6ee7b7',
          dim: '#1a3d32',
          border: '#2d5a45',
        },
        danger: '#f87171',
        warn: '#fbbf24',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 0 0 1px rgba(42,49,64,0.6), 0 8px 24px rgba(0,0,0,0.35)',
        glow: '0 0 0 3px rgba(110,231,183,0.18), 0 0 12px rgba(110,231,183,0.45)',
      },
    },
  },
  plugins: [],
}
