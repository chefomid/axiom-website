/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        black: '#080808',
        ink: {
          primary: '#f0f0f0',
          secondary: '#c4c4c4',
          muted: '#9a9a9a',
          faint: '#6e6e6e',
        },
        command: {
          live: '#4a9eff',
          stable: '#3dd68c',
          watch: '#e8a838',
          critical: '#e05252',
          cyber: '#3dd68c',
        },
        panel: {
          bg: '#0a0a0a',
          border: '#1a1a1a',
          surface: '#111111',
        },
      },
    },
  },
  plugins: [],
}
