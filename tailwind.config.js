/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        cream:  '#F4F1EA',
        ink:    '#0A0A0A',
        violet: '#7C3AED',
        pink:   '#EC4899',
        yellow: '#FFE100',
        blue:   '#2563EB',
        lime:   '#B6F400',
      },
      fontFamily: {
        display: ['Archivo', 'sans-serif'],
        body:    ['"Space Grotesk"', 'sans-serif'],
      },
      fontWeight: {
        400: '400',
        500: '500',
        600: '600',
        700: '700',
        800: '800',
        900: '900',
      },
      boxShadow: {
        hard:      '6px 6px 0 0 #0A0A0A',
        'hard-lg': '10px 10px 0 0 #0A0A0A',
        'hard-sm': '4px 4px 0 0 #0A0A0A',
      },
    },
  },
  plugins: [],
};
