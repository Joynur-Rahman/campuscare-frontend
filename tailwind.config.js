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
          bg: '#f5eeee',
          surface: '#efe2eb',
          blush: '#f3e6e6',
          lavender: '#e5dae4',
          mauve: '#d2c3ce',
          plum: '#433045',
          ink: '#2d202d',
          // Compatibility aliases
          cream: '#f5eeee',
          parchment: '#efe2eb',
          stone: '#d2c3ce',
          sage: '#e5dae4',
          blue: '#d2c3ce',
          navy: '#433045',
        },
        darkPalette: {
          black: '#000000',
          jet: '#0c0c0c',
          espresso: '#141414',
          umber: '#1a1a1a',
          taupe: '#222222',
          mocha: '#2c2c2c',
          // Compatibility aliases
          midnight: '#000000',
          dusk: '#0c0c0c',
          slate: '#141414',
          violet: '#1a1a1a',
          plum: '#222222',
          raisin: '#2c2c2c',
          rose: '#2c2c2c',
          iris: '#2c2c2c',
          steel: '#222222',
          slateViolet: '#1a1a1a',
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
