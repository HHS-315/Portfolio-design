/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        paper:  '#F4F2EC', // warm off-white page background
        panel:  '#FBFAF6', // lifted card / surface
        ink:    '#1A1815', // primary text (near-black)
        muted:  '#6B655C', // secondary text
        faint:  '#9A9488', // tertiary / captions
        gold:   '#A9793A', // restrained accent
        // per-discipline accents (tuned for a light background)
        ux:     '#2F7D6B', // UX/UI (teal)
        ai:     '#6E52C7', // AI 캐릭터 · 그래픽 (violet)
        vibe:   '#C26A24', // 바이브코딩 (amber)
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
