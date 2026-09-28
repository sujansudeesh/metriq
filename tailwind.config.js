/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F3A',
          primary: '#0B1F3A',
          secondary: '#12355B',
          deep: '#08162A',
          800: '#12355B',
          900: '#0B1F3A',
          950: '#08162A',
        },
        beige: {
          DEFAULT: '#C8A46B',
          accent: '#C8A46B',
          hover: '#B79055',
          soft: '#F4ECDD',
          border: '#D9D3C7',
          50: '#F9F9F7',
          100: '#F4ECDD',
          200: '#E8DCC4',
          300: '#D9D3C7',
          400: '#C8A46B',
          500: '#B79055',
        },
        brand: {
          navy: '#0B1F3A',
          secondary: '#12355B',
          deep: '#08162A',
          beige: '#C8A46B',
          hover: '#B79055',
          soft: '#F4ECDD',
        },
      },
    },
  },
  plugins: [],
}
