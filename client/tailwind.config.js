/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0E14',
        surface: '#12161F',
        'surface-hover': '#171C27',
        border: '#232838',
        'text-primary': '#E7EAF0',
        'text-secondary': '#8A93A6',
        positive: '#3ADD9A',
        negative: '#FF5C72',
        primary: '#5B8CFF',
        warning: '#FFB020',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      animation: {
        ticker: 'ticker 30s linear infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
