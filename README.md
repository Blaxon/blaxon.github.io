# 背景
有自己的小红书号，发了些不多不少的内容
突然意识到，曾经火遍全国的QQ空间、人人网，说不定哪天没了就真没了，数据不是导不出就是特别麻烦
于是想着做一个个人网站，至少是实实在在自己的数字资产

Github Page作为一个起点

# 技术栈

基于 [Hugo](https://gohugo.io/) + [hugo-minimal-black](https://gitlab.com/jimchr12/hugo-minimal-black) 主题，通过 GitHub Actions 自动构建并部署到 GitHub Pages。

## 目录结构

- `hugo.toml` — 站点配置
- `content/blog/` — 文章，文件名格式 `YYYY-MM-DD-title.md`
- `content/about.md` — 关于页
- `content/now.md` — 近况页
- `content/uses.md` — 装备页
- `themes/minimal-black/` — 主题（git submodule）

## 本地开发

需要 [Hugo Extended](https://gohugo.io/installation/) >= 0.120.0 和 Node.js（主题用 Tailwind CSS）。

```bash
git submodule update --init --recursive
hugo server -D
```

然后访问 http://localhost:1313

## 发新文章

在 `content/blog/` 下新建 `YYYY-MM-DD-标题.md`，文件头写好 front matter：

```yaml
---
title: "标题"
date: 2026-08-13T00:00:00+08:00
draft: false
---
```

## 部署

推送到 `main` 分支后，GitHub Actions（`.github/workflows/hugo.yml`）会自动构建并发布到 GitHub Pages（仓库 Settings → Pages 里 Source 需设为「GitHub Actions」）。
