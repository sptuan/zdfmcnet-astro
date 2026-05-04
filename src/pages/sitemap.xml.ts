import postsData from '../data/wordpress_data.json';

export async function GET() {
  const posts = postsData.posts;
  const pages = postsData.pages.filter(
    (p: any) => p.slug && p.title !== '示例页面' && p.title !== 'Sample Page'
  );

  const urls: string[] = [
    '', // homepage
    ...posts.map((p: any) => `/p/${p.id}`),
    ...Object.keys(postsData.categories).map((s: string) => `/p/category/${s}`),
    ...Object.keys(postsData as any).filter((k: string) => /^\d{4}-\d{2}$/.test(k)).map((ym: string) => {
      const [y, m] = ym.split('-');
      return `/p/date/${y}/${m}`;
    }),
    ...pages.map((p: any) => `/${p.slug}`),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url: string) => `  <url>
    <loc>https://zdfmc.net${url}</loc>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
