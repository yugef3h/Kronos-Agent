import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
      },
      colors: {
        ink: '#101322',
        accent: '#0f766e',
        mist: '#f4f7f6',
        signal: '#f59e0b',
      },
    },
  },
  plugins: [],
};

export default config;
