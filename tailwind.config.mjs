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
        sans: ['"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', '"WenQuanYi Micro Hei"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif SC"', '"STSong"', '"Songti SC"', '"SimSun"', '"Source Han Serif SC"', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
      },
      fontSize: {
        'article-body': ['1.0625rem', { lineHeight: '1.85' }],
      },
      maxWidth: {
        article: '40rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
