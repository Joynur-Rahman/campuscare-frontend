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
        iiitg: {
          50: '#f0f5fa', 100: '#e1ecf5', 200: '#c3d9eb', 300: '#93b6d6',
          400: '#5c8bb8', 500: '#2f6396', 600: '#1d4a7c', 700: '#143865',
          800: '#0d2544', 900: '#08172c', gold: '#d4af37', goldlight: '#fbf6e2',
        },
      },
    },
  },
  plugins: [],
}
