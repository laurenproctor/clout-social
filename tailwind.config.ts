import type { Config } from 'tailwindcss';

// The `slate` scale is remapped to CSS variables so the existing slate-* classes
// become theme-aware: dark theme keeps the normal slate ramp; light theme uses an
// inverted/tuned ramp (see globals.css). No component class changes required.
const slateVar = (n: number) => `rgb(var(--s${n}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: slateVar(50),
          100: slateVar(100),
          200: slateVar(200),
          300: slateVar(300),
          400: slateVar(400),
          500: slateVar(500),
          600: slateVar(600),
          700: slateVar(700),
          800: slateVar(800),
          900: slateVar(900),
          950: slateVar(950),
        },
        // Clout brand accent — Mint Green (matches Tailwind's emerald-500).
        primary: {
          DEFAULT: '#10B981',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
