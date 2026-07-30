/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './src/views/**/*.ts',
    './public/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        // Kestrel Property Management brand — deep teal ("navy" tokens) + soft
        // teal accent ("sky" tokens). Token names kept for template compatibility.
        brand: {
          DEFAULT: '#14584A',
          navy: '#14584A',
          'navy-deep': '#0E4136',
          'navy-soft': '#2F7A69',
          sky: '#5FBFA6',
          'sky-bright': '#45AE93',
          'sky-soft': '#DCF1EB',
        },
        ink: '#0F172A',
        'ink-fade': '#475569',
        'ink-muted': '#64748B',
        canvas: '#F8FAFC',
        'canvas-deep': '#F1F5F9',
        // Demo signaling color family (gold/amber) — distinct from brand
        demo: {
          gold: '#F0C810',
          'gold-bright': '#FFD52E',
          'gold-soft': '#FFF7DA',
          'gold-line': '#E5B800',
          'gold-deep': '#7B5B00',
        },
        // State pills
        state: {
          upcoming: '#94A3B8',
          progress: '#5FBFA6',
          awaiting: '#F0C810',
          escalated: '#DC2626',
          closed: '#16A34A',
        },
      },
      fontFamily: {
        sans: ['Lato', 'system-ui', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'block': '0 8px 20px -8px rgba(95, 191, 166, 0.55)',
        'block-hover': '0 10px 24px -8px rgba(95, 191, 166, 0.75)',
        'card': '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}
