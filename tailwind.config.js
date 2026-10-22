/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07070c', 900: '#0b0b12', 800: '#12121c', 700: '#1a1a27', 600: '#252536', 500: '#34344a' },
        accent: { DEFAULT: '#8b5cf6', soft: '#a78bfa', blue: '#3b82f6', cyan: '#22d3ee' },
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'] },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { fadeUp: 'fadeUp .35s ease-out both' },
    },
  },
  plugins: [],
};
