#!/usr/bin/env python3
"""
Extract WordPress data from MySQL dump and output structured JSON.
All content cleaned and ready for Markdown conversion.
"""
import re
import json
import os
import gzip

SQL_FILE = os.path.expanduser("~/workspace/zdfmcnet/attachment/zdfmc_net_2026-04-26_03-30-20_mysql_data.sql.gz")
OUT_DIR = os.path.expanduser("~/workspace/zdfmcnet/zdfmcnet-astro/src/content")


def parse_sql_values(data):
    """Parse SQL VALUES content - returns list of raw record strings."""
    records = []
    current = ""
    depth = 0
    in_string = False
    escaped = False

    for i, ch in enumerate(data):
        if escaped:
            current += ch
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            current += ch
            continue
        if ch == "'" and not escaped:
            in_string = not in_string
            current += ch
            continue
        if in_string:
            current += ch
            continue
        if ch == '(':
            depth += 1
            if depth == 1:
                current = ""
                continue
        if ch == ')':
            depth -= 1
            if depth == 0:
                records.append(current.strip())
                # Check if next non-whitespace is ; (end of INSERT)
                j = i + 1
                while j < len(data) and data[j] in ' \t\n\r':
                    j += 1
                if j < len(data) and data[j] == ';':
                    return records
                continue
        if depth > 0:
            current += ch

    return records


def parse_fields(r):
    """Parse a raw record string into individual field values."""
    fields = []
    field = ""
    in_str = False
    esc = False
    for ch in r:
        if esc:
            field += ch
            esc = False
            continue
        if ch == '\\':
            esc = True
            field += ch
            continue
        if ch == "'":
            in_str = not in_str
            field += ch
            continue
        if not in_str and ch == ',':
            fields.append(field.strip())
            field = ""
            continue
        field += ch
    fields.append(field.strip())
    return fields


def unquote(s):
    if s.startswith("'") and s.endswith("'"):
        s = s[1:-1]
    s = s.replace("\\'", "'")
    s = s.replace('\\"', '"')
    s = s.replace('\\\\', '\\')
    s = s.replace('\\n', '\n')
    s = s.replace('\\r', '\r')
    s = s.replace('\\t', '\t')
    return s


def extract_table(sql_content, table_name):
    """Extract all records from all INSERT INTO `table` blocks."""
    all_records = []
    prefix = f"INSERT INTO `{table_name}` VALUES "

    idx = 0
    while True:
        pos = sql_content.find(prefix, idx)
        if pos == -1:
            break

        start = pos + len(prefix)
        records = parse_sql_values(sql_content[start:])
        all_records.extend(records)

        # Advance past this INSERT statement
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(sql_content)):
            ch = sql_content[i]
            if esc:
                esc = False
                continue
            if ch == '\\':
                esc = True
                continue
            if ch == "'":
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch == '(':
                depth += 1
                continue
            if ch == ')':
                depth -= 1
                if depth < 0:
                    j = i
                    while j < len(sql_content) and sql_content[j] in ' \t\n\r':
                        j += 1
                    if j < len(sql_content) and sql_content[j] == ';':
                        idx = j + 1
                    else:
                        idx = i + 1
                    break
                continue

    return all_records


def clean_content(html):
    """Remove WordPress/WPBakery shortcodes, keep readable HTML."""
    # Remove self-closing utility shortcodes
    html = re.sub(r'\[vc_empty_space[^\]]*\]', '', html)
    html = re.sub(r'\[layerslider[^\]]*\]', '', html)
    html = re.sub(r'\[rev_slider[^\]]*\]', '', html)
    html = re.sub(r'\[dt_button[^\]]*\]', '', html)
    html = re.sub(r'\[lab_blog_posts[^\]]*\]', '', html)

    # vc_text_separator → <hr> or keep title
    def replace_separator(m):
        attrs = m.group(1) if m.group(1) else ''
        title = re.search(r'title="([^"]*)"', attrs)
        if title and title.group(1):
            return f'<p class="text-separator">{title.group(1)}</p>'
        return '<hr />'
    html = re.sub(r'\[vc_text_separator([^\]]*)\]', replace_separator, html)

    # lab_heading → heading
    def replace_lab_heading(m):
        attrs = m.group(2) if m.group(2) else ''
        title = re.search(r'title="([^"]*)"', attrs)
        content = m.group(3).strip() if m.group(3) else ''
        if title:
            return f'<h3>{title.group(1)}</h3>'
        if content:
            return f'<h3>{content}</h3>'
        return ''
    html = re.sub(r'\[lab_heading([^\]]*)\](.*?)\[/lab_heading\]', replace_lab_heading, html, flags=re.DOTALL)

    # vc_single_image → img placeholder
    def replace_vc_image(m):
        attrs = m.group(1)
        img_id = re.search(r'image="(\d+)"', attrs)
        css_class = re.search(r'el_class="([^"]*)"', attrs)
        cls = css_class.group(1) if css_class else ''
        if img_id:
            return f'<!-- IMG:{img_id.group(1)} -->'
        return f'<span class="{cls}"></span>'
    html = re.sub(r'\[vc_single_image([^\]]*)\]', replace_vc_image, html)

    # Unwrap vc_column_text - keep inner content
    html = re.sub(r'\[vc_column_text[^\]]*\]', '', html)
    html = re.sub(r'\[/vc_column_text\]', '', html)

    # Remove container shortcodes (keep inner content)
    html = re.sub(r'\[/?vc_row[^\]]*\]', '', html)
    html = re.sub(r'\[/?vc_row_inner[^\]]*\]', '', html)
    html = re.sub(r'\[/?vc_column[^\]]*\]', '', html)
    html = re.sub(r'\[/?vc_column_inner[^\]]*\]', '', html)

    # Unwrap caption
    html = re.sub(r'\[caption[^\]]*\](.*?)\[/caption\]', r'\1', html, flags=re.DOTALL)

    # Remove any remaining shortcodes
    html = re.sub(r'\[/?[a-zA-Z_][a-zA-Z0-9_]*[^\]]*\]', '', html)

    # Clean up whitespace
    html = re.sub(r'\n\s*\n\s*\n+', '\n\n', html)
    html = re.sub(r'<p>\s*</p>', '', html)
    html = re.sub(r'<p>&nbsp;</p>', '', html)
    html = html.strip()

    return html


def get_post_url(post_id):
    return f'/p/{post_id}'


def get_category_url(slug):
    return f'/p/category/{slug}'


def main():
    print("Reading SQL dump...")
    with gzip.open(SQL_FILE, 'rt', encoding='utf-8', errors='replace') as f:
        sql_content = f.read()

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, 'posts'), exist_ok=True)
    os.makedirs(os.path.join(OUT_DIR, 'pages'), exist_ok=True)

    # --- Extract terms ---
    print("Extracting terms...")
    terms = {}
    for r in extract_table(sql_content, 'wp_terms'):
        fields = parse_fields(r)
        if len(fields) >= 3:
            term_id = int(fields[0])
            name = unquote(fields[1])
            slug = unquote(fields[2])
            terms[term_id] = {'id': term_id, 'name': name, 'slug': slug}

    # --- Extract term taxonomy ---
    print("Extracting term taxonomy...")
    term_tax = {}
    term_tax_by_term = {}
    for r in extract_table(sql_content, 'wp_term_taxonomy'):
        fields = parse_fields(r)
        if len(fields) >= 6:
            tt_id = int(fields[0])
            term_id = int(fields[1])
            taxonomy = unquote(fields[2])
            parent = int(fields[4])
            count = int(fields[5])
            term_tax[tt_id] = {
                'term_taxonomy_id': tt_id,
                'term_id': term_id,
                'taxonomy': taxonomy,
                'parent': parent,
                'count': count,
            }
            if term_id not in term_tax_by_term:
                term_tax_by_term[term_id] = {}
            term_tax_by_term[term_id][taxonomy] = tt_id

    # --- Extract term relationships ---
    print("Extracting term relationships...")
    post_terms = {}
    for r in extract_table(sql_content, 'wp_term_relationships'):
        fields = parse_fields(r)
        if len(fields) >= 3:
            object_id = int(fields[0])
            tt_id = int(fields[1])
            if object_id not in post_terms:
                post_terms[object_id] = []
            post_terms[object_id].append(tt_id)

    # --- Extract attachments ---
    print("Extracting attachments...")
    attachments = {}
    for r in extract_table(sql_content, 'wp_posts'):
        fields = parse_fields(r)
        if len(fields) < 23:
            continue
        if fields[20].strip("'") == 'attachment':
            post_id = int(fields[0])
            guid = unquote(fields[18])
            attachments[post_id] = guid

    # --- Extract posts/pages ---
    print("Extracting posts & pages...")
    posts_data = []
    pages_data = []
    attachment_map = {}

    for r in extract_table(sql_content, 'wp_posts'):
        fields = parse_fields(r)
        if len(fields) < 23:
            continue

        post_id = int(fields[0])
        post_author = int(fields[1])
        post_date = unquote(fields[2])
        post_content = unquote(fields[4])
        post_title = unquote(fields[5])
        post_excerpt = unquote(fields[6])
        post_status = unquote(fields[7])
        comment_status = unquote(fields[8])
        post_password = unquote(fields[10])
        post_name = unquote(fields[11])
        post_parent = int(fields[17])
        guid = unquote(fields[18])
        post_type = unquote(fields[20])
        post_mime_type = unquote(fields[21])
        comment_count_str = fields[22].strip()
        comment_count = int(comment_count_str) if comment_count_str.isdigit() else 0

        if post_status != 'publish':
            continue

        # Build category/tag lists
        cats = []
        tags = []
        if post_id in post_terms:
            for tt_id in post_terms[post_id]:
                tt = term_tax.get(tt_id)
                if tt:
                    term = terms.get(tt['term_id'])
                    if term:
                        if tt['taxonomy'] == 'category':
                            cats.append({'id': term['id'], 'name': term['name'], 'slug': term['slug']})
                        elif tt['taxonomy'] == 'post_tag':
                            tags.append({'id': term['id'], 'name': term['name'], 'slug': term['slug']})

        entry = {
            'id': post_id,
            'author': post_author,
            'date': post_date,
            'title': post_title,
            'slug': post_name,
            'excerpt': post_excerpt,
            'content': clean_content(post_content),
            'raw_content': post_content,
            'status': post_status,
            'password': post_password,
            'comment_status': comment_status,
            'comment_count': comment_count,
            'guid': guid,
            'categories': cats,
            'tags': tags,
        }

        if post_type == 'post':
            posts_data.append(entry)
        elif post_type == 'page':
            pages_data.append(entry)

    # --- Extract postmeta (thumbnails) ---
    print("Extracting thumbnails...")
    thumbnails = {}
    for r in extract_table(sql_content, 'wp_postmeta'):
        fields = parse_fields(r)
        if len(fields) < 4:
            continue
        post_id = int(fields[1])
        meta_key = unquote(fields[2])
        meta_value = unquote(fields[3])
        if meta_key == '_thumbnail_id':
            att_id = int(meta_value)
            if att_id in attachments:
                thumbnails[post_id] = attachments[att_id]
            else:
                thumbnails[post_id] = None

    # --- Extract comments ---
    print("Extracting comments...")
    comments_data = {}
    for r in extract_table(sql_content, 'wp_comments'):
        fields = parse_fields(r)
        if len(fields) < 13:
            continue
        comment_approved = unquote(fields[10])
        if comment_approved != '1':
            continue

        comment_id = int(fields[0])
        comment_post_id = int(fields[1])
        comment_data = {
            'id': comment_id,
            'author': unquote(fields[2]),
            'email': unquote(fields[3]),
            'url': unquote(fields[4]),
            'date': unquote(fields[6]),
            'content': unquote(fields[7]),
            'parent': int(fields[9]),
        }
        if comment_post_id not in comments_data:
            comments_data[comment_post_id] = []
        comments_data[comment_post_id].append(comment_data)

    # --- Build category index ---
    print("Building category index...")
    categories = {}
    for term_id, term in terms.items():
        if term_id in term_tax_by_term and 'category' in term_tax_by_term[term_id]:
            tt = term_tax[term_tax_by_term[term_id]['category']]
            categories[term['slug']] = {
                'id': term_id,
                'name': term['name'],
                'slug': term['slug'],
                'count': tt['count'],
            }

    # --- Compile all data ---
    all_data = {
        'posts': posts_data,
        'pages': pages_data,
        'categories': categories,
        'comments': {str(k): v for k, v in comments_data.items()},
        'thumbnails': {str(k): v for k, v in thumbnails.items()},
        'attachments': {str(k): v for k, v in attachments.items()},
        'terms': {str(k): v for k, v in terms.items()},
    }

    output_file = os.path.join(OUT_DIR, 'wordpress_data.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    # Summary
    print(f"\n{'='*60}")
    print(f"EXTRACTION COMPLETE")
    print(f"{'='*60}")
    print(f"Published posts:  {len(posts_data)}")
    print(f"Published pages:  {len(pages_data)}")
    print(f"Categories:       {len(categories)}")
    print(f"Comments total:   {sum(len(c) for c in comments_data.values())}")
    for slug, cat in sorted(categories.items(), key=lambda x: -x[1]['count']):
        print(f"  [{cat['count']:>3}] {cat['name']} ({slug})")
    print(f"Thumbnails:       {len(thumbnails)}")
    print(f"Attachments:      {len(attachments)}")
    print(f"\nOutput: {output_file}")

    # Print page slugs for URL mapping
    print(f"\nPages (for URL routing):")
    for p in pages_data:
        if p['title'] not in ['示例页面', 'Sample Page']:
            print(f"  ID:{p['id']:>4} slug:{p['slug'][:50]} -> \"{p['title'][:60]}\"")


if __name__ == '__main__':
    main()
