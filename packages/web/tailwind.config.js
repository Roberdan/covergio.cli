/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065'
        },
        surface: {
          0: 'var(--color-surface-0, #ffffff)',
          50: 'var(--color-surface-50, #f8fafc)',
          100: 'var(--color-surface-100, #f1f5f9)',
          200: 'var(--color-surface-200, #e2e8f0)',
          300: 'var(--color-surface-300, #cbd5e1)',
          700: 'var(--color-surface-700, #334155)',
          800: 'var(--color-surface-800, #1e293b)',
          900: 'var(--color-surface-900, #0f172a)',
          950: 'var(--color-surface-950, #020617)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')
  ]
};
