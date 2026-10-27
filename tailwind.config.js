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
          jet: '#161618',
          espresso: '#161618',
          umber: '#212124',
          taupe: '#212124',
          mocha: '#333336',
          // Compatibility aliases
          midnight: '#000000',
          dusk: '#161618',
          slate: '#212124',
          violet: '#212124',
          plum: '#212124',
          raisin: '#333336',
          rose: '#333336',
          iris: '#ffffff',
          steel: '#333336',
          slateViolet: '#212124',
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
