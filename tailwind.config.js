/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: '#0E1420',
        slate1: '#141C2B',
        slate2: '#1E293B',
        line: '#2A3648',
        primary: '#2F6FED',
        primarySoft: '#3D82FF',
        good: '#1FB47A',
        warn: '#E0A21A',
        bad: '#E0524A',
        paper: '#F5F7FB',
      },
      keyframes: {
        slidein: { '0%': { transform: 'translateX(24px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        dot: { '0%,60%,100%': { opacity: '.2' }, '30%': { opacity: '1' } },
      },
      animation: {
        slidein: 'slidein .28s ease-out',
        pop: 'pop .18s ease-out',
        dot: 'dot 1.2s infinite',
      },
    },
  },
  plugins: [],
};
