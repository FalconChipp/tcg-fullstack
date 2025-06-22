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
        'dark-background':  '#16171c',        // Nearly black, NO blue!
        'dark-surface':     '#191a20',        // Panels, a true dark blue/gray, but not saturated.
        'dark-alt':         '#23243c',        // Inputs, etc.
        'dark-text':        '#f7f8fa',        // Off-white.
        'dark-textSecondary':'#b9bedd',
        'dark-textMuted':   '#8f98bc',
        'dark-border':      '#31365e',        // Blue-gray border, subtle.
        'dark-accent':      '#2963FF',
        'dark-accentLight': '#548dff',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Raleway', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
