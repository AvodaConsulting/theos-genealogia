import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#f6f1e6',
        ink: '#151515',
        bronze: '#b67f38',
        olive: '#54623e',
        deepSea: '#1e3a5f',
      },
      boxShadow: {
        scholar: '0 14px 30px -20px rgba(11, 24, 44, 0.55)',
      },
    },
  },
  plugins: [],
} satisfies Config;
