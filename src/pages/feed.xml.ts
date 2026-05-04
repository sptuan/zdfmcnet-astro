import rss from '@astrojs/rss';
import postsData from '../data/wordpress_data.json';

const posts = postsData.posts
  .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 50);

export async function GET(context: any) {
  return rss({
    title: 'zdfmc.net - 周大服Minecraft社群',
    description: '周大服Minecraft社群 - 原为几个高考结束无所事事的逗比运行的Minecraft服务器',
    site: context.site,
    items: posts.map((post: any) => ({
      title: post.title,
      description: post.excerpt || '',
      link: `/p/${post.id}`,
      pubDate: new Date(post.date),
      categories: post.categories?.map((c: any) => c.name),
    })),
    customData: '<language>zh-CN</language>',
  });
}
