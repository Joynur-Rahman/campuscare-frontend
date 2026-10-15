/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        hindi: ['"Noto Sans Devanagari"', 'sans-serif'],
      },
      colors: {
        palette: {
          blue: '#b3cacf',
          sage: '#c5d4d3',
          stone: '#d6ded7',
          parchment: '#e8e7da',
          cream: '#f9f1de',
          ink: '#1e2f33',
          navy: '#2f4e56',
        },
        darkPalette: {
          midnight: '#101214',
          slateViolet: '#2a2e35',
          iris: '#6366f1',
          dusk: '#1d2024',
          steel: '#40444c',
        },
        iiitg: {
          50: '#f9f1de', 100: '#e8e7da', 200: '#d6ded7', 300: '#c5d4d3',
          400: '#b3cacf', 500: '#7fa4ab', 600: '#537d85', 700: '#3e626a',
          800: '#2f4e56', 900: '#1e353b', gold: '#d4af37', goldlight: '#fbf6e2',
        },
      },
    },
  },
  plugins: [],
}
