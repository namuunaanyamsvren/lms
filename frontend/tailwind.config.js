/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5',
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: '#111827',
        border: '#E2E8F0',
      },
      boxShadow: {
        soft: '0 20px 55px rgba(17, 24, 39, 0.08)',
      },
      borderRadius: {
        soft: '1rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
      },
      maxWidth: {
        '8xl': '90rem',
      },
      animation: {
        slideIn: 'slideIn 0.3s ease-in-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

