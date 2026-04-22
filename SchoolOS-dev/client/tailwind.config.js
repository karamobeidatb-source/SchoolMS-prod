/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--f-display)'],
        sans: ['var(--f-sans)'],
        mono: ['var(--f-mono)'],
        ar: ['var(--f-ar)'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
}
