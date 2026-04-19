/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        ipa: ['"Charis SIL"', '"Noto Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#0d7377',
          muted: '#14a098',
        },
      },
    },
  },
  plugins: [],
};
