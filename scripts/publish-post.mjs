/**
 * Publish a new Markdown post to zdfmc.net.
 *
 * Usage: node scripts/publish-post.mjs <path-to-markdown-file> [thumbnail-url]
 *
 * What it does:
 * 1. Reads a Markdown file with YAML frontmatter (title, date, author, categories, tags)
 * 2. Converts Markdown body to basic HTML
 * 3. Assigns the next available post ID
 * 4. Adds the post to wordpress_data.json
 * 5. Updates category_index.json and date_index.json
 * 6. Optionally sets a thumbnail image
 *
 * Slug: derived from filename (e.g., "my-post.md" → slug "my-post")
 *       Must be clean ASCII (letters, numbers, hyphens). New posts use /p/{slug}
 *       as their primary URL, with /p/{id} as a numeric alias.
 *       Old WordPress posts keep /p/{id} only (their slugs are URL-encoded Chinese).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'src', 'data');

// ── Parse args ──────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/publish-post.mjs <path-to-markdown-file> [thumbnail-url]');
  process.exit(1);
}

const mdPath = path.resolve(args[0]);
const thumbnailUrl = args[1] || null;

if (!fs.existsSync(mdPath)) {
  console.error(`File not found: ${mdPath}`);
  process.exit(1);
}

// ── Load current data ───────────────────────────────────────────
const wpData = JSON.parse(fs.readFileSync(path.join(dataDir, 'wordpress_data.json'), 'utf8'));
const catIndex = JSON.parse(fs.readFileSync(path.join(dataDir, 'category_index.json'), 'utf8'));
const dateIndex = JSON.parse(fs.readFileSync(path.join(dataDir, 'date_index.json'), 'utf8'));

// ── Parse Markdown ──────────────────────────────────────────────
const mdContent = fs.readFileSync(mdPath, 'utf8');
const fmMatch = mdContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!fmMatch) {
  console.error('Invalid frontmatter: file must start with ---');
  process.exit(1);
}

const fm = fmMatch[1];
let mdBody = fmMatch[2];

// Extract frontmatter fields
const getFM = (key) => {
  const m = fm.match(new RegExp(`${key}:\\s*(.+)`));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

const title = getFM('title');
const date = getFM('date');
const author = getFM('author') || '周大服小编114514号';

// Parse categories array: categories: ["新鲜事儿", "发展历程"]
const catMatch = fm.match(/categories:\s*\[([^\]]+)\]/);
const categoryNames = catMatch
  ? catMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
  : ['新鲜事儿'];

// Parse tags array
const tagMatch = fm.match(/tags:\s*\[([^\]]+)\]/);
const tagNames = tagMatch
  ? tagMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
  : [];

// ── Resolve categories ──────────────────────────────────────────
// Map category names to their IDs by looking at existing data
const categoryMap = new Map();
for (const post of wpData.posts) {
  for (const c of post.categories || []) {
    if (!categoryMap.has(c.name)) {
      categoryMap.set(c.name, { id: c.id, name: c.name, slug: c.slug });
    }
  }
}

const categories = categoryNames
  .map(name => categoryMap.get(name))
  .filter(Boolean);

if (categories.length === 0) {
  console.error('No valid categories found. Available:', [...categoryMap.keys()].join(', '));
  process.exit(1);
}

// Resolve tags (create new tag IDs as needed)
const maxTagId = Math.max(0, ...wpData.posts.flatMap(p => (p.tags || []).map(t => t.id || 0)));
let nextTagId = maxTagId + 1;
const existingTags = new Map();
for (const post of wpData.posts) {
  for (const t of post.tags || []) {
    if (!existingTags.has(t.name)) {
      existingTags.set(t.name, t);
    }
  }
}

const tags = tagNames.map(name => {
  if (existingTags.has(name)) return existingTags.get(name);
  return { id: nextTagId++, name, slug: name.toLowerCase().replace(/\s+/g, '-') };
});

// ── Slug from filename ──────────────────────────────────────────
const filename = path.basename(mdPath, path.extname(mdPath));
const slug = filename.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

if (!slug || !/[a-zA-Z]/.test(slug)) {
  console.error('Slug must contain at least one letter. Filename:', filename);
  process.exit(1);
}

// ── Markdown → HTML ─────────────────────────────────────────────
let html = mdBody;

// headings
html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
// bold
html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
// inline code
html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
// links
html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
// images
html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
// horizontal rules
html = html.replace(/^---$/gm, '<hr>');
// blockquotes
html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
// italics
html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

// Process ordered lists and tables
let lines = html.split('\n');
let outLines = [];
let inOl = false;
let inTable = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const olMatch = line.match(/^(\d+)\.\s+(.+)/);
  const tableSepMatch = line.match(/^\|[-:\s|]+\|$/);
  const tableRowMatch = line.match(/^\|(.+)\|$/);

  if (olMatch && !inTable) {
    if (!inOl) { outLines.push('<ol>'); inOl = true; }
    outLines.push('<li>' + olMatch[2] + '</li>');
  } else {
    if (inOl) { outLines.push('</ol>'); inOl = false; }
    if (tableSepMatch) {
      continue;
    } else if (tableRowMatch && !inTable) {
      inTable = true;
      outLines.push('<table>');
      const cells = tableRowMatch[1].split('|').map(c => c.trim());
      outLines.push('<tr>' + cells.map(c => '<th>' + c + '</th>').join('') + '</tr>');
    } else if (tableRowMatch && inTable) {
      const cells = tableRowMatch[1].split('|').map(c => c.trim());
      outLines.push('<tr>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>');
    } else {
      if (inTable) { outLines.push('</table>'); inTable = false; }
      outLines.push(line);
    }
  }
}
if (inOl) outLines.push('</ol>');
if (inTable) outLines.push('</table>');

html = outLines.join('\n');

// Wrap non-tag lines in <p>
let finalLines = html.split('\n');
let finalOut = [];
for (const line of finalLines) {
  const trimmed = line.trim();
  if (!trimmed) { finalOut.push(''); continue; }
  if (trimmed.match(/^<(h[1-6]|hr|blockquote|ol|ul|li|table|tr|th|td|code|strong|a|p|div|img|br|em)/)) {
    finalOut.push(trimmed);
    continue;
  }
  if (trimmed.match(/^<hr>/) || trimmed.match(/^<\/?(ol|ul|table|blockquote)>/)) {
    finalOut.push(trimmed);
    continue;
  }
  finalOut.push('<p>' + trimmed + '</p>');
}
html = finalOut.join('\n');

// ── Assign ID and date ──────────────────────────────────────────
const maxId = Math.max(...wpData.posts.map(p => p.id));
const newId = maxId + 1;
const dateStr = date ? `${date} 12:00:00` : new Date().toISOString().replace('T', ' ').substring(0, 19);
const yyyymm = (date || new Date().toISOString().substring(0, 7)).substring(0, 7);

// ── Build post object ───────────────────────────────────────────
const newPost = {
  id: newId,
  author: 1,
  date: dateStr,
  title: title,
  slug: slug,
  excerpt: '',
  content: html,
  password: '',
  comment_status: 'open',
  comment_count: 0,
  guid: `https://zdfmc.net/?p=${newId}`,
  categories: categories,
  tags: tags,
};

// ── Upsert (check slug collision first) ─────────────────────────
const slugExists = wpData.posts.find(p =>
  p.slug === slug && p.id !== newId &&
  /^[a-zA-Z0-9-]*[a-zA-Z][a-zA-Z0-9-]*$/.test(p.slug)
);
if (slugExists) {
  console.error(`Slug "${slug}" already used by post ${slugExists.id}. Rename your file.`);
  process.exit(1);
}

const existingById = wpData.posts.findIndex(p => p.id === newId);
if (existingById >= 0) {
  // Preserve thumbnail if already set
  if (wpData.thumbnails && wpData.thumbnails[String(newId)]) {
    // keep existing thumbnail
  }
  wpData.posts[existingById] = newPost;
  console.log(`Updated post ${newId} (slug: ${slug})`);
} else {
  wpData.posts.push(newPost);
  console.log(`Created post ${newId} (slug: ${slug})`);
}

// ── Thumbnail ───────────────────────────────────────────────────
if (thumbnailUrl) {
  wpData.thumbnails = wpData.thumbnails || {};
  wpData.thumbnails[String(newId)] = thumbnailUrl;
  console.log(`Thumbnail: ${thumbnailUrl}`);
}

// ── Update category index ───────────────────────────────────────
for (const cat of categories) {
  if (catIndex[cat.slug]) {
    if (!catIndex[cat.slug].posts.includes(newId)) {
      catIndex[cat.slug].posts.unshift(newId);
      catIndex[cat.slug].count = catIndex[cat.slug].posts.length;
    }
  }
}

// ── Update date index ───────────────────────────────────────────
if (!dateIndex[yyyymm]) {
  dateIndex[yyyymm] = [];
}
if (!dateIndex[yyyymm].includes(newId)) {
  dateIndex[yyyymm].unshift(newId);
}

// ── Write files ─────────────────────────────────────────────────
fs.writeFileSync(path.join(dataDir, 'wordpress_data.json'), JSON.stringify(wpData, null, 2));
fs.writeFileSync(path.join(dataDir, 'category_index.json'), JSON.stringify(catIndex, null, 2));
fs.writeFileSync(path.join(dataDir, 'date_index.json'), JSON.stringify(dateIndex, null, 2));

console.log(`\nDone! Post live at /p/${slug} (alias /p/${newId})`);
