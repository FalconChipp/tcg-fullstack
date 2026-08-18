/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- Light Theme ---
        'light-background': '#f5f6fa',        // Very light, *neutral*, NOT blue!
        'light-surface':    '#f7f7fb',        // Cards/panels—use white sparingly.
        'light-alt':        '#eef1f7',        // For slightly raised or input backgrounds.
        'light-text':       '#232346',        // Near-black, never blue.
        'light-textSecondary': '#464d6b',
        'light-textMuted':  '#5f6570',        // More gray than blue.
        'light-border':     '#e2e8f0',        // Soft gray border.
        'light-accent':     '#2963FF',        // Brand blue ONLY for accents, links, CTA.
        'light-accentLight':'#548dff',

        // DARK
        'dark-background':  '#0b0d14',
        'dark-surface':     '#111520',
        'dark-alt':         '#181c28',
        'dark-surf3':       '#1e2234',
        'dark-text':        '#edf0fa',
        'dark-textSecondary':'#9aa3c4',
        'dark-textMuted':   '#5c6480',
        'dark-border':      'rgba(255,255,255,0.07)',
        'dark-borderMid':   'rgba(255,255,255,0.13)',
        'dark-accent':      '#4169f4',
        'dark-accentDim':   'rgba(65,105,244,0.14)',
        'dark-accentLight': '#6b8ff7',

        // --- Precision Vault (redesign tokens, scoped to new components) ---
        'vault-bg':          '#0a0b0f',
        'vault-surface':     '#13151a',
        'vault-raised':      '#1a1d24',
        'vault-overlay':     '#22262e',
        'vault-border':      'rgba(255,255,255,0.08)',
        'vault-borderStrong':'rgba(255,255,255,0.16)',
        'vault-text':        '#f2f3f5',
        'vault-textSecondary':'#9ca3af',
        'vault-textTertiary': '#6b7280',
        'vault-accent':      '#3b82f6',
        'vault-accentHover': '#5b95f7',
        'vault-success':     '#22c55e',
        'vault-danger':      '#ef4444',
        'vault-warning':     '#eab308',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Raleway', 'sans-serif'],
        vault: ['"Space Grotesk"', 'sans-serif'],
        'vault-body': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography")
  ],
};
