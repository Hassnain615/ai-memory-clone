/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        void: '#000000',
        abyss: '#03050B',
        deep: '#070B16',
        electric: '#2F6BFF',
        'electric-soft': '#5B8CFF',
        cyan: '#22D3EE',
        ice: '#7DE7FF',
        frost: '#E6EDF7',
        mist: '#A3AEC2',
        dim: '#6B7489',
        line: 'rgba(148,163,184,0.12)',
        danger: '#FF5C7A',
        success: '#34E5A4',
        warn: '#FFC560',
      },
      boxShadow: {
        aura: '0 0 0 1px rgba(47,107,255,.35), 0 8px 40px -8px rgba(47,107,255,.55)',
        'aura-cyan': '0 0 0 1px rgba(34,211,238,.35), 0 8px 40px -8px rgba(34,211,238,.45)',
        glass: 'inset 0 1px 0 0 rgba(255,255,255,.06), 0 20px 60px -20px rgba(0,0,0,.8)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: .85 }, '50%': { transform: 'scale(1.06)', opacity: 1 } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        orbit: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade .3s ease-out both',
        breathe: 'breathe 7s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        orbit: 'orbit 60s linear infinite',
      },
    },
  },
  plugins: [],
}
