import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f7f5',
          100: '#eeeae3',
          200: '#d8d1c4',
          300: '#b8ad97',
          400: '#928669',
          500: '#746952',
          600: '#5d5446',
          700: '#4b4439',
          800: '#312d26',
          900: '#1c1a16',
          950: '#0e0d0a',
        },
        accent: {
          DEFAULT: '#c75b39',
          soft: '#e89373',
          dim: '#8b3d24',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
