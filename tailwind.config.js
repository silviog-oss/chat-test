/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Bizee-inspired light palette
        ink: '#1A1A2E',        // near-black text
        muted: '#5B6070',      // secondary text
        line: '#E6E8EF',       // hairline borders
        surface: '#FFFFFF',    // cards
        canvas: '#F7F8FC',     // page background
        primary: '#F26522',    // Bizee orange
        primarySoft: '#FF7A38',
        primaryInk: '#C74E12',
        good: '#1FB47A',
        warn: '#E0A21A',
        bad: '#E0524A',
      },
      keyframes: {
        slidein: { '0%': { transform: 'translateX(24px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        dot: { '0%,60%,100%': { opacity: '.2' }, '30%': { opacity: '1' } },
        rise: { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        slidein: 'slidein .28s ease-out',
        pop: 'pop .18s ease-out',
        dot: 'dot 1.2s infinite',
        rise: 'rise .5s ease-out both',
      },
    },
  },
  plugins: [],
};
