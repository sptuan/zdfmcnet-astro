# 图片资源迁移 S3 计划

## 现状

| 指标 | 数量 |
|------|------|
| 磁盘文件 | 5,444 个 |
| 总大小 | 842 MB |
| 唯一 URL 引用（数据中） | 825 个 |
| 源码硬编码引用 | 14 处 |
| .git 大小（含图片） | 803 MB |

### 引用来源
1. **文章/页面内容** — `wordpress_data.json` 中 HTML，混合绝对/相对路径
2. **缩略图** — `thumbnails` 映射（`post_id → url`）
3. **附件表** — `attachments` 映射（`attachment_id → url`）
4. **源码硬编码** — HeroBanner 看板娘、TeamGrid 头像、Nav logo 等
5. **残留绝对路径** — 部分内容中有服务器绝对路径

---

## 方案

### 存储选型：Cloudflare R2（推荐）

| 对比 | AWS S3 | Cloudflare R2 |
|------|--------|---------------|
| 存储费 | $0.023/GB | $0.015/GB |
| 出站流量 | $0.09/GB | **免费** |
| CDN | CloudFront（另收费） | 内置 Cloudflare CDN |
| 月费估算 (10GB/10GB流量) | ~$1.13 | ~$0.15 |

> 842MB 存储 + 预估月流量 5-10GB，R2 几乎零成本。

### 目录结构

```
s3://zdfmcnet-assets/
└── wp-content/
    └── uploads/
        ├── 2014/ ... 2016/ ... 2026/   ← 保持原 WordPress 路径
        ├── layerslider/
        ├── revslider/
        └── ...
```

### URL 策略

**全部改为相对路径** `/wp-content/uploads/...`，部署时通过以下方式之一解析：

| 方案 | 实现 | 适用场景 |
|------|------|----------|
| **子路径托管** | Astro `base: '/wp-content/uploads'` + S3 挂载 | 同域名部署 |
| **独立域名** | `https://assets.zdfmc.net/...` CDN 回源 S3 | 独立资源域名 |
| **构建时替换** | `astro build` 前替换所有路径为 S3/CDN URL | 最灵活 |

**推荐：独立域名 `assets.zdfmc.net`**，DNS CNAME 到 R2 域名，自动获得 CDN。

---

## 实施步骤

### Step 1: 创建 R2 存储桶
- 注册 Cloudflare，创建 R2 bucket `zdfmcnet-assets`
- 绑定自定义域名 `assets.zdfmc.net`（CNAME → R2 endpoint）
- 设置公开读取策略

### Step 2: 上传图片
```bash
# 使用 rclone 或 awscli (S3 兼容)
aws s3 sync public/wp-content/uploads/ \
  s3://zdfmcnet-assets/wp-content/uploads/ \
  --endpoint-url https://<account>.r2.cloudflarestorage.com \
  --acl public-read
```

### Step 3: 清理冗余文件
WordPress 为每张原图生成了多尺寸缩略图（150x150, 300xX, 768xX, 1024xX...），实际使用的主要是：
- 原图（文章内嵌）
- `-150x150` 缩略图（列表/头像）

可选择性只上传实际引用的文件（约 825 个唯一 URL → 可能 2000+ 文件含缩略图变体）。

**分析脚本**：
```python
# 从 wordpress_data.json 提取所有实际引用的 URL
# 同时解析 -150x150 等变体
# 生成需要上传的文件清单
```

### Step 4: 替换路径
需要修改的位置：

| 文件 | 改动 |
|------|------|
| `src/data/wordpress_data.json` | 所有图片 URL 替换为 `https://assets.zdfmc.net/...` |
| `src/components/HeroBanner.astro` | 看板娘路径 |
| `src/components/TeamGrid.astro` | 12 个头像路径 |
| 其他 `.astro` 文件 | 硬编码图片路径 |

**替换脚本**：
```python
# 全局替换以下模式 → https://assets.zdfmc.net/wp-content/uploads/...
# - /wp-content/uploads/...
# - https://zdfmc.net/wp-content/uploads/...
# - /var/www/zdfmc.net/wp-content/uploads/...
```

### Step 5: 移除本地图片
- 从 git 中移除 `public/wp-content/uploads/`
- 添加到 `.gitignore`
- 本地开发时可选择性保留

### Step 6: 验证
- 构建后检查所有页面图片链接
- 死链扫描

---

## 下一步

确认以下事项后开始实施：
1. 使用哪个 S3 兼容服务？（R2 / AWS S3 / 其他）
2. 自定义域名？（`assets.zdfmc.net` 还是其他）
3. 是否需要保留本地图片用于开发？
