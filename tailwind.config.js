/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        'app-bg': 'var(--app-bg)',
        'card-bg': 'var(--card-bg)',
        'card-elevated': 'var(--card-elevated)',
        'accent-orange': 'var(--accent-secondary)',
        'accent-lime': 'var(--accent-primary)',
        'accent-glow': 'var(--accent-primary)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'glass-border': 'var(--glass-border)',
        'quiet-green': 'var(--quiet-green)',
        'quiet-amber': 'var(--quiet-amber)',
        'quiet-red': 'var(--quiet-red)',
        'quiet-purple': 'var(--quiet-purple)',
        'quiet-blue': 'var(--quiet-blue)',
      },
      borderRadius: {
        'card': '1.25rem',
        'pill': '9999px',
      },
      boxShadow: {
        'sheet': '0 -24px 80px rgba(0, 0, 0, 0.65)',
        'glow-lime': '0 0 20px rgba(200, 255, 0, 0.15)',
        'glow-orange': '0 0 20px rgba(255, 107, 44, 0.15)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass': 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'fade-in': 'fadeIn 0.4s ease backwards',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'slide-up': 'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'slide-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'count-up': 'countUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'live-dot': 'liveDot 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(200, 255, 0, 0.2)' },
          '50%': { boxShadow: '0 0 24px rgba(200, 255, 0, 0.4)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        liveDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.8)' },
        },
      },
    },
  },
  plugins: [],
};
