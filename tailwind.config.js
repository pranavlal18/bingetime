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
        // Cinematic Precision palette
        surface: {
          DEFAULT: '#15121b',
          dim: '#15121b',
          bright: '#3b3742',
          container: '#211e27',
          'container-low': '#1d1a23',
          'container-high': '#2c2832',
          'container-highest': '#37333d',
          'container-lowest': '#0f0d15',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          light: '#a078ff',
          container: '#d0bcff',
        },
        muted: {
          DEFAULT: '#6b7280',
          light: '#9ca3af',
        },
        'on-surface': {
          DEFAULT: '#e7e0ed',
          variant: '#cbc3d7',
        },
        outline: {
          DEFAULT: '#958ea0',
          variant: '#494454',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        button: '12px',
      },
    },
  },
  plugins: [],
}
