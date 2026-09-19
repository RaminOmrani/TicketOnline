/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Greys come from CSS variables so dark mode can switch to a warm, low-glare palette (see index.css)
        slate: Object.fromEntries(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'].map((k) => [k, `rgb(var(--slate-${k}) / <alpha-value>)`])),
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        page: 'rgb(var(--page-rgb) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark-rgb) / <alpha-value>)',
          light: 'rgb(var(--brand-light-rgb) / <alpha-value>)',
          deep: 'rgb(var(--brand-deep-rgb) / <alpha-value>)',
          soft: 'rgb(var(--brand-rgb) / 0.10)',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
        pop: '0 12px 32px -8px rgba(16,24,40,.18), 0 2px 6px rgba(16,24,40,.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'pulse-ring': { '0%': { transform: 'scale(1)', opacity: 0.6 }, '100%': { transform: 'scale(1.8)', opacity: 0 } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
