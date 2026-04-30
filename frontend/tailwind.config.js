/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        void: '#060608',
        surface: '#0d0d12',
        panel: '#12121a',
        border: '#1e1e2e',
        'border-bright': '#2e2e4e',
        accent: '#7c6aff',
        'accent-bright': '#9d8fff',
        'accent-glow': '#7c6aff33',
        cyan: '#00e5ff',
        'cyan-dim': '#00e5ff22',
        emerald: '#00ffa3',
        amber: '#ffb800',
        muted: '#4a4a6a',
        text: '#c8c8e8',
        'text-dim': '#6868a8',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          'from': { boxShadow: '0 0 10px #7c6aff44' },
          'to': { boxShadow: '0 0 25px #7c6aff88, 0 0 50px #7c6aff22' },
        },
        slideUp: {
          'from': { opacity: 0, transform: 'translateY(12px)' },
          'to': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          'from': { opacity: 0 },
          'to': { opacity: 1 },
        }
      }
    },
  },
  plugins: [],
}
