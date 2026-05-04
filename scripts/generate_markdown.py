#!/usr/bin/env python3
"""Generate Markdown files from extracted WordPress data."""
import json
import os
import re

CONTENT_DIR = os.path.expanduser("~/workspace/zdfmcnet/zdfmcnet-astro/src/content")
DATA_FILE = os.path.join(CONTENT_DIR, 'wordpress_data.json')

def slugify(text):
    """Slugify a string for filenames."""
    return re.sub(r'[^\w\-]', '', text.replace(' ', '-').lower())[:50]

def html_to_markdown_text(html):
    """Minimal HTML-to-plain-text for excerpts."""
    text = re.sub(r'<[^>]+>', '', html)
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:200]

def escape_yaml(s):
    """Escape a string for YAML value."""
    if not s:
        return '""'
    if '\n' in s:
        return f'"{s.replace(chr(34), chr(92)+chr(34))}"'
    if '"' in s or ':' in s or '#' in s or s.startswith(('{', '[', "'", '&', '*', '!', '|', '>', '%', '@', '`')):
        return f'"{s.replace(chr(34), chr(92)+chr(34))}"'
    return s

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

posts_dir = os.path.join(CONTENT_DIR, 'posts')
pages_dir = os.path.join(CONTENT_DIR, 'pages')
os.makedirs(posts_dir, exist_ok=True)
os.makedirs(pages_dir, exist_ok=True)

# --- Generate Post Markdown files ---
print("Generating post markdown files...")
for post in data['posts']:
    pid = post['id']
    title = post['title']
    date = post['date'][:10]
    slug = post['slug'] or f'post-{pid}'

    # Categories and tags as YAML lists
    cat_names = [c['name'] for c in post['categories']]
    tag_names = [t['name'] for t in post['tags']]

    # Thumbnail
    thumbnail = data['thumbnails'].get(str(pid))

    # Comments for this post
    post_comments = data['comments'].get(str(pid), [])

    # Build frontmatter
    fm = f"""---
title: {escape_yaml(title)}
date: {date}
id: {pid}
slug: {slug}
"""
    if cat_names:
        fm += f"categories: {json.dumps(cat_names, ensure_ascii=False)}\n"
    if tag_names:
        fm += f"tags: {json.dumps(tag_names, ensure_ascii=False)}\n"
    if thumbnail:
        fm += f"thumbnail: {escape_yaml(thumbnail)}\n"
    if post['comment_count'] > 0:
        fm += f"comment_count: {post['comment_count']}\n"
    if post['excerpt']:
        excerpt_clean = html_to_markdown_text(post['excerpt'])
        if excerpt_clean:
            fm += f"excerpt: {escape_yaml(excerpt_clean)}\n"

    fm += "---\n\n"

    # Content - keep as HTML (Astro handles HTML in md files)
    content = post['content']
    # Fix image placeholders
    def resolve_img(m):
        img_id = m.group(1)
        url = data['attachments'].get(img_id)
        if url:
            return f'<img src="{url}" alt="" loading="lazy" />'
        return f'<!-- missing image id={img_id} -->'
    content = re.sub(r'<!-- IMG:(\d+) -->', resolve_img, content)

    # Add comments if any
    if post_comments:
        content += '\n\n<hr />\n\n## 评论\n\n'
        for c in sorted(post_comments, key=lambda x: x['id']):
            cdate = c['date'][:10]
            author = c['author'] or '匿名'
            content += f'<div class="comment" id="comment-{c["id"]}">\n'
            content += f'  <p><strong>{author}</strong> — {cdate}</p>\n'
            content += f'  <div>{c["content"]}</div>\n'
            content += '</div>\n\n'

    # Write file - use post ID as filename for guaranteed uniqueness
    filename = f'{pid}.md'
    filepath = os.path.join(posts_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(fm + content)

print(f"  Generated {len(data['posts'])} post files")

# --- Generate Page Markdown files ---
print("Generating page markdown files...")
important_pages = []
for page in data['pages']:
    pid = page['id']
    title = page['title']
    slug = page['slug']

    # Skip sample/template pages
    if title in ['示例页面', 'Sample Page']:
        continue

    content = page['content']
    def resolve_img(m):
        img_id = m.group(1)
        url = data['attachments'].get(img_id)
        if url:
            return f'<img src="{url}" alt="" loading="lazy" />'
        return f'<!-- missing image id={img_id} -->'
    content = re.sub(r'<!-- IMG:(\d+) -->', resolve_img, content)

    fm = f"""---
title: {escape_yaml(title)}
page_id: {pid}
slug: {slug}
layout: ../layouts/BaseLayout.astro
---

"""
    filename = f'{slug}.md' if slug else f'page-{pid}.md'
    filepath = os.path.join(pages_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(fm + content)

    important_pages.append({'id': pid, 'title': title, 'slug': slug})

print(f"  Generated {len(important_pages)} page files")

# --- Generate category index data ---
print("Building category-post index...")
cat_posts = {}
for post in data['posts']:
    for c in post['categories']:
        cat_posts.setdefault(c['slug'], []).append(post['id'])

cat_index = {}
for slug, cat in data['categories'].items():
    posts_in_cat = cat_posts.get(slug, [])
    cat_index[slug] = {
        'name': cat['name'],
        'slug': slug,
        'count': len(posts_in_cat),
        'posts': sorted(posts_in_cat, reverse=True),  # newest first (IDs roughly chronological)
    }

with open(os.path.join(CONTENT_DIR, 'category_index.json'), 'w', encoding='utf-8') as f:
    json.dump(cat_index, f, ensure_ascii=False, indent=2)

# --- Generate date index ---
date_posts = {}
for post in data['posts']:
    ym = post['date'][:7]  # YYYY-MM
    date_posts.setdefault(ym, []).append(post['id'])

with open(os.path.join(CONTENT_DIR, 'date_index.json'), 'w', encoding='utf-8') as f:
    json.dump(date_posts, f, ensure_ascii=False, indent=2)

print(f"Categories: {len(cat_index)}")
print(f"Date archives: {len(date_posts)}")
print("Done!")
