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

目前站点使用两个分类，对应 `categories.md` 目录页的两个栏目：

- `知识与项目沉淀` — 技术、职业、项目相关的沉淀
- `兴趣与生活记录` — 兴趣爱好、生活记录类内容

新文章的 front matter 中 `categories` 字段需二选一，才会出现在目录页对应栏目下。

## 本地开发

需要 Ruby >= 3.0（可用 `rbenv` / `asdf` 管理版本）。

```bash
bundle install
bundle exec jekyll serve
```

然后访问 http://localhost:4000

## 发新文章

在 `_posts/` 下新建 `YYYY-MM-DD-标题.md`，文件头写好 front matter：

```yaml
---
layout: post
title: "标题"
date: 2026-08-13 00:00:00 +0800
categories: 随笔
---
```

## 部署

推送到 `main` 分支即可，GitHub Pages 会自动用 Jekyll 构建并发布（记得在仓库 Settings → Pages 里把 Source 设为 `main` 分支 `/`（root）目录）。
