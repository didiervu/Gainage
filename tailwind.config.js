/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg': 'var(--bg)',
        'card': 'var(--card)',
        'muted': 'var(--muted)',
        'text': 'var(--text)',
        'accent': 'var(--accent)',
        'gm': 'var(--gm)',
        'gc': 'var(--gc)',
        'rest': 'var(--rest)',
        'danger': 'var(--danger)',
      },
    },
  },
  plugins: [],
};
