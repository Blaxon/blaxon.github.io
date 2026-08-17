# 背景
有自己的小红书号，发了些不多不少的内容
突然意识到，曾经火遍全国的QQ空间、人人网，说不定哪天没了就真没了，数据不是导不出就是特别麻烦
于是想着做一个个人网站，至少是实实在在自己的数字资产

Github Page作为一个起点

# 技术栈

基于 [Jekyll](https://jekyllrb.com/) + [minima](https://github.com/jekyll/minima) 主题，通过 GitHub Pages 自动构建部署。

## 目录结构

- `_config.yml` — 站点配置
- `_posts/` — 文章，文件名格式 `YYYY-MM-DD-title.md`
- `index.md` — 首页（文章列表）
- `about.md` — 关于页
- `categories.md` — 目录页，按分类汇总文章
- `now.md` — Now 页，记录近期状态
- `uses.md` — Uses 页，记录当前在用的设备/软件

## 分类（目录）

分类通过 `_posts/` 下的子文件夹实现（Jekyll 会自动把子文件夹名当作 category，无需插件）。目前有两个分类文件夹，对应 `categories.md` 目录页的两个栏目：

- `_posts/知识与项目沉淀/` — 技术、职业、项目相关的沉淀
- `_posts/兴趣与生活记录/` — 兴趣爱好、生活记录类内容

新文章需放进对应的分类文件夹，才会出现在目录页对应栏目下。文章 URL 由 `permalink` 配置决定，不受分类文件夹影响。

## 本地开发

需要 Ruby >= 3.0（可用 `rbenv` / `asdf` 管理版本）。

```bash
bundle install
bundle exec jekyll serve
```

然后访问 http://localhost:4000

## 发新文章

在 `_posts/知识与项目沉淀/` 或 `_posts/兴趣与生活记录/` 下新建 `YYYY-MM-DD-标题.md`，文件头写好 front matter：

```yaml
---
layout: post
title: "标题"
date: 2026-08-13 00:00:00 +0800
---
```

## 部署

推送到 `main` 分支即可，GitHub Pages 会自动用 Jekyll 构建并发布（记得在仓库 Settings → Pages 里把 Source 设为 `main` 分支 `/`（root）目录）。
