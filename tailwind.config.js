/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1a2e',
          light: '#16213e',
          lighter: '#1e2a4a',
        },
        accent: {
          DEFAULT: '#e94560',
          light: '#ff6b81',
        },
        muted: {
          DEFAULT: '#6b7280',
          light: '#9ca3af',
        },
      },
    },
  },
  plugins: [],
}
