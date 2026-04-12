/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        overlay: {
          bg: 'rgba(8, 8, 12, 0.92)',
          border: 'rgba(255, 255, 255, 0.08)',
          header: 'rgba(255, 255, 255, 0.04)',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
