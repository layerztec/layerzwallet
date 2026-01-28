/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(0 0% 14.9%)',
        input: 'hsl(0 0% 14.9%)',
        ring: 'hsl(0 0% 83.1%)',
        background: 'hsl(0 0% 0%)',
        foreground: 'hsl(0 0% 98%)',
        primary: {
          DEFAULT: 'hsl(0 0% 98%)',
          foreground: 'hsl(0 0% 9%)',
        },
        secondary: {
          DEFAULT: 'hsl(0 0% 14.9%)',
          foreground: 'hsl(0 0% 98%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 62.8% 30.6%)',
          foreground: 'hsl(0 0% 98%)',
        },
        muted: {
          DEFAULT: 'hsl(0 0% 14.9%)',
          foreground: 'hsl(0 0% 63.9%)',
        },
        accent: {
          DEFAULT: 'hsl(0 0% 14.9%)',
          foreground: 'hsl(0 0% 98%)',
        },
        popover: {
          DEFAULT: 'hsl(0 0% 9%)',
          foreground: 'hsl(0 0% 98%)',
        },
        card: {
          DEFAULT: 'hsl(0 0% 9%)',
          foreground: 'hsl(0 0% 98%)',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [],
};

