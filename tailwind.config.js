/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        bone:    '#F5F2EC', // warm ivory background
        surface: '#FBFAF6', // slightly lifted card surface
        ink:     '#16130F', // warm near-black
        stone:   '#7A736A', // muted secondary text
        line:    '#E2DBCF', // hairline border
        accent:  '#9C7A54', // restrained bronze, used sparingly
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Noto Serif KR"', 'Georgia', 'serif'],
        body:    ['Inter', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        300: '300', 400: '400', 500: '500', 600: '600', 700: '700',
      },
      letterSpacing: {
        tightest: '-0.055em',
        widest2:  '0.28em',
      },
      boxShadow: {
        soft:    '0 24px 60px -28px rgba(22,19,15,.30)',
        'soft-sm': '0 12px 30px -18px rgba(22,19,15,.22)',
      },
      transitionTimingFunction: {
        lux: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
