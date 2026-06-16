/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          app: 'var(--bg-app)',
          panel: 'var(--bg-panel)',
          panelSoft: 'var(--bg-panel-soft)',
          panelStrong: 'var(--bg-panel-strong)',
        },
        border: {
          default: 'var(--border-default)',
          glass: 'var(--border-glass)',
        },
        brand: {
          primary: 'var(--brand-primary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        stock: {
          up: 'var(--color-up)',
          down: 'var(--color-down)',
          warn: 'var(--color-warn)',
          info: 'var(--color-info)',
        },
        accent: {
          cyan: 'var(--accent-cyan)',
          cyanSoft: 'var(--accent-cyan-soft)',
          emerald: 'var(--accent-emerald)',
          rose: 'var(--accent-rose)',
          amber: 'var(--accent-amber)',
        },
        terminal: {
          bg: 'var(--terminal-bg)',
          panel: 'var(--terminal-panel)',
          panelAlt: 'var(--terminal-panel-alt)',
          grid: 'var(--terminal-grid)',
          text: 'var(--terminal-text)',
          muted: 'var(--terminal-muted)',
          cyan: 'var(--terminal-cyan)',
          rise: 'var(--terminal-rise)',
          fall: 'var(--terminal-fall)',
          warn: 'var(--terminal-warn)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'pill': 'var(--radius-pill)',
      },
      transitionTimingFunction: {
        'spring-smooth': 'var(--spring-smooth)',
        'spring-bouncy': 'var(--spring-bouncy)',
      },
      boxShadow: {
        'panel': 'var(--shadow-panel)',
        'focus': 'var(--shadow-focus)',
      },
    },
  },
  plugins: [],
}
