import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'src', 'data');

const wpData = JSON.parse(fs.readFileSync(path.join(dataDir, 'wordpress_data.json'), 'utf8'));
const catIndex = JSON.parse(fs.readFileSync(path.join(dataDir, 'category_index.json'), 'utf8'));
const dateIndex = JSON.parse(fs.readFileSync(path.join(dataDir, 'date_index.json'), 'utf8'));
const mdContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'content', 'posts', 'rebuild-announcement.md'), 'utf8');

// Parse frontmatter
const fmMatch = mdContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const fm = fmMatch[1];
let mdBody = fmMatch[2];

const titleMatch = fm.match(/title:\s*"([^"]*)"/);
const title = titleMatch ? titleMatch[1] : '';

// Simple markdown-to-HTML conversion
// headings
mdBody = mdBody.replace(/^### (.+)$/gm, '<h3>$1</h3>');
mdBody = mdBody.replace(/^## (.+)$/gm, '<h2>$1</h2>');
// bold
mdBody = mdBody.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
// inline code
mdBody = mdBody.replace(/`([^`]+)`/g, '<code>$1</code>');
// links
mdBody = mdBody.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
// horizontal rules
mdBody = mdBody.replace(/^---$/gm, '<hr>');
// blockquotes
mdBody = mdBody.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
// italics
mdBody = mdBody.replace(/\*([^*]+)\*/g, '<em>$1</em>');
// images
mdBody = mdBody.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

// Process ordered lists and tables in a single pass
let lines = mdBody.split('\n');
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
      // skip separator lines
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

let html = outLines.join('\n');

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

const excerpt = '';

const newPost = {
  id: 1686,
  author: 1,
  date: '2026-05-04 13:00:00',
  title: title,
  slug: 'rebuild-announcement',
  excerpt: excerpt,
  content: html,
  password: '',
  comment_status: 'open',
  comment_count: 0,
  guid: 'https://zdfmc.net/?p=1686',
  categories: [
    { id: 5, name: '新鲜事儿', slug: 'news' },
    { id: 2, name: '发展历程', slug: 'history' }
  ],
  tags: [
    { id: 1, name: '重构', slug: 'refactor' },
    { id: 2, name: 'Astro', slug: 'astro' },
    { id: 3, name: '里程碑', slug: 'milestone' }
  ]
};

// Upsert post
const existingIdx = wpData.posts.findIndex(p => p.id === 1686);
if (existingIdx >= 0) {
  wpData.posts[existingIdx] = newPost;
  console.log('Updated existing post 1686');
} else {
  wpData.posts.push(newPost);
  console.log('Added new post 1686');
}

// Update category index
if (!catIndex.news.posts.includes(1686)) {
  catIndex.news.posts.unshift(1686);
  catIndex.news.count = catIndex.news.posts.length;
}
if (!catIndex.history.posts.includes(1686)) {
  catIndex.history.posts.unshift(1686);
  catIndex.history.count = catIndex.history.posts.length;
}

// Update date index
if (!dateIndex['2026-05']) {
  dateIndex['2026-05'] = [];
}
if (!dateIndex['2026-05'].includes(1686)) {
  dateIndex['2026-05'].unshift(1686);
}

// Write files
fs.writeFileSync(path.join(dataDir, 'wordpress_data.json'), JSON.stringify(wpData, null, 2));
fs.writeFileSync(path.join(dataDir, 'category_index.json'), JSON.stringify(catIndex, null, 2));
fs.writeFileSync(path.join(dataDir, 'date_index.json'), JSON.stringify(dateIndex, null, 2));

console.log('Done!');
console.log('News posts:', catIndex.news.count);
console.log('History posts:', catIndex.history.count);
console.log('Date 2026-05:', dateIndex['2026-05']);
