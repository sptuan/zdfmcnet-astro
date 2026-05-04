/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f8f7f4',
          light: '#ffffff',
          lighter: '#f0efe9',
        },
        accent: {
          DEFAULT: '#0891b2',
          warm: '#e55c4a',
          gold: '#d49532',
        },
        text: {
          primary: '#1a1a1a',
          secondary: '#555555',
          muted: '#999999',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Noto Serif SC"', '"Noto Sans SC"', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
