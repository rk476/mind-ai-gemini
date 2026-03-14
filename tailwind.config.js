/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mission: {
          bg: '#0B0F1A',
          surface: '#111827',
          card: '#1a2236',
          border: '#1e293b',
          primary: '#3B82F6',
          accent: '#8B5CF6',
          highlight: '#22D3EE',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          muted: '#64748B',
          text: '#E2E8F0',
          'text-dim': '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'orb-idle': 'orbIdle 4s ease-in-out infinite',
        'orb-listen': 'orbListen 1.5s ease-in-out infinite',
        'orb-think': 'orbThink 2s linear infinite',
        'orb-speak': 'orbSpeak 0.8s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        orbIdle: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        orbListen: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 30px rgba(59,130,246,0.3)' },
          '50%': { transform: 'scale(1.1)', boxShadow: '0 0 60px rgba(59,130,246,0.6)' },
        },
        orbThink: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        orbSpeak: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 40px rgba(139,92,246,0.4)' },
          '50%': { transform: 'scale(1.08)', boxShadow: '0 0 80px rgba(139,92,246,0.7)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(59,130,246,0.2)' },
          '100%': { boxShadow: '0 0 40px rgba(59,130,246,0.4)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
