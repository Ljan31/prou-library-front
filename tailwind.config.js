/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['DM Serif Display', 'Georgia', 'serif']
      },
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b'
        },
        slate: {
          850: '#172033'
        }
      },
      boxShadow: {
        'sidebar': '4px 0 24px rgba(0,0,0,0.08)',
        'card':    '0 2px 16px rgba(0,0,0,0.06)',
        'modal':   '0 8px 48px rgba(0,0,0,0.18)'
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-in':  'slideIn 0.25s ease-out',
        'pulse-dot': 'pulseDot 2s cubic-bezier(0.4,0,0.6,1) infinite'
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn:  { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.4' } }
      }
    }
  },
  plugins: []
}
