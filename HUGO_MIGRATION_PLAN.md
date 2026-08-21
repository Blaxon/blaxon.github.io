# Jekyll → Hugo (hugo-minimal-black) 迁移步骤

本文档基于当前仓库实际内容（Jekyll + minima，两个中文分类文件夹）和
[hugo-minimal-black](https://gitlab.com/jimchr12/hugo-minimal-black) 主题的官方 README /
exampleSite 整理，是可以直接照做的操作清单。仅供审阅，**不代表已执行任何改动**。

## 0. 已确认的范围（来自你的反馈）

1. 不再需要文章分类，`知识与项目沉淀/_posts` 和 `兴趣与生活记录/_posts` 两个文件夹的文章合并到 `content/blog/`，不加
   `categories` 字段。
2. 不保留旧 URL（`/posts/:year/:month/:day/:title/`），直接用 Hugo + 主题的默认路由（`/blog/<slug>/`）。
3. `now.md`、`uses.md` 继续作为 Header 菜单项展示，用主题的通用页面模板（`layouts/_default/single.html`），不使用
   `about` 专用布局。
4. `.frontmatter/`、`frontmatter.json`（VS Code Front Matter 插件配置）本次不处理，保持现状。

## 1. 建分支，留安全网

```bash
git checkout -b hugo-migration
```

全程在这个分支上做，确认本地 `hugo server` 效果、GitHub Actions 构建都通过后再合并到 `main`。

## 2. 本地环境准备

- **Hugo Extended ≥ 0.120.0**（主题强制要求 extended 版本，因为要跑 Tailwind/PostCSS）：
  ```bash
  brew install hugo
  hugo version   # 确认输出里带 "extended"，记下版本号，后面 CI 里要对齐
  ```
- **Node.js + npm**（编译主题的 Tailwind CSS）：
  ```bash
  node -v
  npm -v
  ```
  如果没装，`brew install node` 或用 nvm。

## 3. 初始化 Hugo 项目骨架（在当前仓库内）

当前仓库不是空目录，用 `--force`：

```bash
hugo new site . --force
```

会补齐 `archetypes/`、`content/`、`static/`、`hugo.toml`（或 `config.toml`，看版本）等目录，已有文件不受影响。

## 4. 安装主题（git submodule）

```bash
git submodule add https://gitlab.com/jimchr12/hugo-minimal-black.git themes/minimal-black
cd themes/minimal-black && npm install && cd ../..
```

## 5. 写 `hugo.toml`

删掉第 3 步生成的空 `hugo.toml`，替换为下面内容（基于主题 exampleSite 配置，按当前站点信息精简，去掉了
projects/tech-marquee/about-alt 等本站不需要的板块和 taxonomy 里的 `category`）：

```toml
baseURL = 'https://blaxon.github.io/'
languageCode = 'zh-cn'
title = 'Blaxon'
theme = 'minimal-black'

[outputs]
  home = ["HTML", "RSS", "JSON"]

[params]
  brand = "Blaxon"
  description = "记录与备份 —— 属于自己的数字资产"

  [params.theme]
    defaultTheme = "dark"

  [params.home]
    sections = ["hero", "posts"]
    showNowSection = false
    showFeaturedProjects = false
    showLatestPosts = true
    latestPostsLimit = 5
    blogTitle = "最新文章"
    blogSubtitle = ""

  # 先用主题自带的默认文案（照抄自 exampleSite/hugo.toml），看完效果再自己改
  [params.hero]
    badge = "Software Engineer"
    title = "Hi, I'm Your Name or your interesting title."
    role = "Subtitle for title with role perspective"
    summary = "You can write your summary to be displayed here."
    location = "City, Country"
    focus = "Currently focused on Hugo themes & developer experience."
    available = true
    availableLabel = "Available for work"

    [params.hero.primary]
      label = "View Projects"
      href = "/projects/"

    [params.hero.secondary]
      label = "Read the Blog"
      href = "/blog/"

  [params.icons]
    useFontAwesome = true
    useDevicon = false

[menu]
  [[menu.main]]
    name = "首页"
    pageRef = "/"
    url = "/"
    weight = 1

  [[menu.main]]
    name = "博客"
    pageRef = "blog"
    url = "/blog/"
    weight = 2

  [[menu.main]]
    name = "关于"
    pageRef = "about"
    url = "/about/"
    weight = 3

  [[menu.main]]
    name = "Now"
    pageRef = "now"
    url = "/now/"
    weight = 4

  [[menu.main]]
    name = "Uses"
    pageRef = "uses"
    url = "/uses/"
    weight = 5

[markup]
  [markup.tableOfContents]
    startLevel = 2
    endLevel = 4

  [markup.goldmark.renderer]
    unsafe = true

  [markup.highlight]
    codeFences = true
    guessSyntax = true
    style = "monokai"

[taxonomies]
  tag = "tags"
```

> `showNowSection` 是主题首页自带的一个「Quick Facts」小组件（读 `params.hero.now` 列表），和我们要保留的
> `/now/` 独立页面是两个不同的东西，这里关掉避免混淆。以后想要也可以单独打开。

## 6. 迁移内容

### 6.1 首页 `content/_index.md`

主题 exampleSite 里这个文件基本是空的（首页文案主要来自 `hugo.toml` 的 `[params.hero]`），保持简单：

```markdown
---
title: "Home"
---
```

### 6.2 博客 `content/blog/_index.md`

```markdown
---
title: "博客"
---
```

### 6.3 合并两个分类下的文章到 `content/blog/`

```bash
mkdir -p content/blog
git mv 知识与项目沉淀/_posts/2018-07-16-netease-migrate.md content/blog/2018-07-16-netease-migrate.md
git mv 兴趣与生活记录/_posts/2026-08-13-hello-world.md content/blog/2026-08-13-hello-world.md
```

两篇文章的 front matter 去掉 `layout`（Hugo 不需要），日期改成带时区的 RFC3339 格式，**不加 `categories`**：

`content/blog/2026-08-13-hello-world.md`：

```markdown
---
title: "开始搭建自己的数字资产"
date: 2026-08-13T00:00:00+08:00
draft: false
---

这是第一篇文章，用来验证站点搭建成功.
```

`content/blog/2018-07-16-netease-migrate.md`：front matter 同样处理（只改前 4 行，正文原样保留）：

```markdown
---
title: "网易游戏两年工作总结"
date: 2018-07-16T00:00:00+08:00
draft: false
---

文章写于2018-07-16 [博客园](https://www.cnblogs.com/Blaxon/p/9294534.html)，迁移至此
... (正文不变)
```

### 6.4 `about` / `now` / `uses`

```bash
git mv about.md content/about.md
git mv now.md content/now.md
git mv uses.md content/uses.md
```

三个文件的 front matter 都简化成只留 `title`（`layout: page`、`permalink` 是 Jekyll 的东西，不需要了；用默认
`_default/single.html` 模板即可满足「继续显示在 Header」的要求，菜单项已经在第 5 步的 `hugo.toml` 里配了）：

`content/about.md`：

```markdown
---
title: "关于"
---

有自己的小红书号，发了些不多不少的内容。

突然意识到，曾经火遍全国的 QQ 空间、人人网，说不定哪天没了就真没了，数据不是导不出就是特别麻烦。

于是想着做一个个人网站，至少是实实在在自己的数字资产。

GitHub Page 作为一个起点。

联系请直接github站内私信 谢谢
```

`content/now.md`（保留原内容，补一个 `date` 让页面能显示更新时间）：

```markdown
---
title: "Now"
date: 2026-08-17
---

*最近更新：2026-08-17*

> 参考 [nownownow.com](https://nownownow.com/about) 的理念，记录我当下在做的事情。

## 在做什么
- 搭建并持续完善这个个人网站，把小红书上的内容陆续迁移过来
- 刚读完《百年孤独》，目前正在津津有味读《沧浪之水》

## 在关注 / 学习
- 学习个人网站搭建，可以的话想弄个相册专栏
- 对意式料理有一点感兴趣

## 生活状态
- 放松
```

`content/uses.md`（内容不变，只是把最后「本站技术栈」那一段更新成 Hugo，避免信息过期）：

```markdown
---
title: "Uses"
date: 2026-08-21
---

记录目前在用的设备、软件和工具。

## 硬件
- M1 Max MacbookPro: 功能强大但性能过剩，如果再给我一次机会我会选Air
- Steamdeck：游戏掌机，买来吃灰一年多最近又焕发新生，物有所值
- Viture Luma：AR眼镜，买来当便携显示器用的 还是差点意思
- 9 Barista：免插电意式咖啡机，真神；每天用，贵了点但很值

## 软件 / 工具
- Evernote：日记软件，经常做一些杀鸡取卵的优惠来吸引我充值
- Spotify：本来是apple music但中文歌有限，spotify好一点；QQ被墙无奈选择
- Claude：写代码专用
- Gemini：日常用，搜索强，帮我看youtube视频也方便

## 本站技术栈
- [Hugo](https://gohugo.io/) + [hugo-minimal-black](https://gitlab.com/jimchr12/hugo-minimal-black) 主题
- 托管于 GitHub Pages，GitHub Actions 自动构建部署
```

### 6.5 静态资源

```bash
mkdir -p static/images
git mv assets/images/.gitkeep static/images/.gitkeep
```

以后图片放 `static/images/`，Markdown 里用 `/images/xxx.png` 引用即可。

## 7. 本地验证

```bash
hugo server -D
```

打开 http://localhost:1313 逐项检查：

- [ ] 首页 `/`、`/about/`、`/now/`、`/uses/`、`/blog/` 都能打开，Header 菜单里能看到「首页 / 博客 / 关于 / Now / Uses」
- [ ] 两篇文章能在 `/blog/` 列表里看到，点进去正文完整
- [ ] 样式（深色背景、紫色高亮）正常加载，不是没样式的纯 HTML

**如果 CSS 没加载**（主题 README 的 Troubleshooting 里提到的已知坑）：

```bash
cd themes/minimal-black
npx tailwindcss -i ./assets/css/main.css -o ./static/css/main.css
cd ../..
```

再刷新看看。这一点本地必须先验证通过，因为下一步 CI 里要照抄同样的处理方式。

## 8. 清理旧 Jekyll 文件

本地验证通过后，删除不再需要的文件：

```bash
git rm _config.yml Gemfile Gemfile.lock
git rm -r 知识与项目沉淀 兴趣与生活记录
git rm -r --cached assets 2>/dev/null; rm -rf assets   # 图片已挪到 static/images，assets/ 清空
```

`index.md`、`about.md`、`categories.md`、`now.md`、`uses.md`（仓库根目录下的这几个 Jekyll 页面）在第 6 步已经
`git mv` 到 `content/` 下了；`categories.md` 因为不再需要分类页，直接删：

```bash
git rm categories.md
```

`.gitignore` 换成 Hugo 项目常用的规则（删掉 Jekyll 相关的几行）：

```
public/
resources/
.hugo_build.lock
node_modules/
.DS_Store
.frontmatter/
```

## 9. 部署改造：GitHub Actions + Pages 设置

GitHub Pages 原生构建只认 Jekyll，Hugo（尤其还要跑 npm 编译 Tailwind）必须自己写 workflow。

新建 `.github/workflows/hugo.yml`：

```yaml
name: Deploy Hugo site to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

defaults:
  run:
    shell: bash

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      HUGO_VERSION: 0.140.0   # TODO: 换成第 2 步 `hugo version` 输出的实际版本号
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 0

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: ${{ env.HUGO_VERSION }}
          extended: true

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install theme deps & build CSS
        run: |
          cd themes/minimal-black
          npm install
          npx tailwindcss -i ./assets/css/main.css -o ./static/css/main.css
          cd ../..

      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5

      - name: Build with Hugo
        run: |
          hugo --minify --baseURL "${{ steps.pages.outputs.base_url }}/"

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

仓库设置改动（**这一步只能在 GitHub 网页上做，需要你手动操作**）：

- Settings → Pages → Build and deployment → Source，从「Deploy from a branch」改成「**GitHub Actions**」。

## 10. 提交、推送、验证

```bash
git add -A
git status   # 确认没有意外文件（尤其 node_modules 不能进来）
git commit -m "迁移站点框架：Jekyll -> Hugo (hugo-minimal-black)"
git push -u origin hugo-migration
```

推到分支后看 Actions 页面 workflow 是否跑绿；跑绿后可以先用该分支的 workflow_dispatch 或临时改 Pages
source 验证线上效果，确认无误后再合并到 `main`。

## 11. 已知风险 / 后续可选项

- **CSS 编译方式**：第 7 步已经提到，`npx tailwindcss` 这条命令是照抄主题 README 的 Troubleshooting 方案，
  没有在这个具体仓库里跑过，本地验证时如果发现 Hugo 自带的资源管线（不用手动跑这条命令）就已经能正常出样式，
  CI 里这一步可以省掉。
- **首页 Hero 文案**：`hugo.toml` 里 `[params.hero]` 现在是主题原样的英文默认文案，方便你先看效果；其中
  `primary` 按钮链接到 `/projects/`，但本站没有 projects 内容，点击会 404 —— 等你决定好首页文案时，记得把这个
  按钮的 `href`/`label` 一起改掉（或者删掉这个按钮）。
- **Google Analytics**：搜过整个仓库，当前站点没有配置任何 GA / gtag，所以没有旧配置要迁移。主题原生支持
  GA4，需要的话在 `hugo.toml` 里加：
  ```toml
  [params.analytics]
    googleAnalytics = "G-XXXXXXXXXX"
  ```
- **关于页样式**：目前用的是通用页面模板，如果之后想要主题自带的「时间线」风格 `about` 布局（`layout = "about"`，
  按公司/职位分段），内容需要按 `---` 分隔成几段，现在的 about 正文是一整段介绍，没有做这个改造。
- **`.frontmatter/`、`frontmatter.json`**：按你的要求本次不处理，迁移后这两个配置指向的是旧的 Jekyll 目录结构，
  会失效，之后要用 VS Code Front Matter 插件的话需要重新配置，但不影响网站本身。
