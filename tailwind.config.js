/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        void:    '#05070E', // deepest space
        space:   '#080B16', // page background
        surface: '#111726', // lifted panel
        star:    '#ECE9E2', // primary text (warm white)
        stone:   '#878EA6', // muted secondary text
        gold:    '#D9B26A', // restrained luxury accent
        // subtle per-planet tints
        aura:    '#6FB6B0', // UX/UI planet (teal)
        nebula:  '#9B8CE0', // AI graphic planet (violet)
        ember:   '#E0A15A', // vibe coding planet (amber)
      },
      fontFamily: {
        display: ['Pretendard', 'system-ui', 'sans-serif'],
        body:    ['Pretendard', 'system-ui', 'sans-serif'],
      },
      fontWeight: { 300: '300', 400: '400', 500: '500', 600: '600', 700: '700' },
      letterSpacing: { tightest: '-0.055em', widest2: '0.3em' },
      transitionTimingFunction: { lux: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
};
