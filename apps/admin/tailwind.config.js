/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#ff6154',
        surface: '#f6f7fb',
        ink: '#2c2d33',
      },
    },
  },
  plugins: [],
};
