---
title: "评论区搬家：从 Giscus 换成 Waline"
date: 2026-09-18T00:00:00+08:00
draft: false
category: "技能学习"
---

博客之前用的评论系统是 [giscus](https://giscus.app/)，零成本零维护，缺点是评论必须要有 GitHub 账号才能留言，然后默认 UI 有点丑。想着换一个门槛更低、体验更完整的方案，但预算依然是：**免费**。

## 为什么最后选了 Waline

本来就只想在 Cloudflare 生态做的，没想到被 Gemini 虚晃了一枪，说 [Artalk](https://artalk.js.org/) 可以配合CF worker + D1，结果开始接入才知道是坑，Artalk 并不支持这种方案，于是作罢。

调研了一圈，最后看中 [Waline](https://waline.js.org/)——功能齐全（Markdown、点赞、匿名评论、后台管理），UI 也不错，但官方只支持 Vercel、Netlify、Railway 这些平台，没有 Cloudflare。去官方仓库翻了下 [discussion](https://github.com/orgs/walinejs/discussions/2584)，作者原话是"Cloudflare Workers 的架构不太适合直接跑 Node"，基本表态短期内不会官方支持。

好在社区已经有人把它整个重写了一遍：[Waline_On_Worker](https://github.com/lsy-404/Waline_On_Worker)，用 Cloudflare Workers + D1（Serverless SQLite）复刻了一套兼容 `@waline/client` 前端和 `@waline/admin` 管理面板的后端。作者自己也坦白这是"AI 辅助完成，无法保证和官方 Waline Server 行为完全一致"，算是提前打了预防针。抱着"反正免费，试试也无妨"的心态开搞。

## 部署过程

整个流程走下来其实不复杂：

1. `wrangler d1 create` 建一个 D1 数据库
2. `pnpm run db:init --remote` 把 schema 灌进去（一开始漏了 `--remote`，结果灌进了本地模拟数据库，白忙一场）
3. `wrangler secret put JWT_SECRET` 设登录用的密钥
4. `pnpm run deploy` 部署 Worker，拿到一个 `*.workers.dev` 的地址
5. 博客这边加一个 `waline.html` partial，换掉原来的 `giscus.html`

理论上到这一步就该结束了，但真正好玩的部分才刚开始。

## 踩坑两连

**坑一：CORS 不通过。** 部署完用 curl 测试接口，发现无论用什么 Origin 请求，响应里都没有 `Access-Control-Allow-Origin`——包括我自己的域名。翻源码发现 CORS 白名单比较的是裸域名（`xanderhang.com`），但浏览器发过来的 `Origin` 头其实带协议（`https://xanderhang.com`），俩字符串永远对不上，等于白名单形同虚设。改成先用 `URL()` 解析出 hostname 再比较，问题解决。

**坑二：评论组件加载不出来，控制台报 `Uncaught SyntaxError: Unexpected token 'export'`。** 查了下才发现 `@waline/client` 新版本的 `dist/waline.js` 已经是 ESM 格式，用 `<script src="...">` 直接引入必然报错——得用专门给普通 script 标签用的 `dist/waline.umd.js`。官方文档里的示例代码显然没跟上包本身的更新。

两个问题都属于"用久了大概率会有人踩到"的坑，索性把 CORS 的修复提了个 [PR](https://github.com/lsy-404/Waline_On_Worker/pull/8) 回去，也算是薅了免费羊毛之余，顺手还了个人情，同时也感谢 Claude Code。

## 现在的配置

- 留言必须填邮箱，网站可选填
- 所有新评论先进"待审核"队列，我手动过一遍才会公开显示，避免垃圾评论直接刷屏
- 后台管理面板完全复用官方UI，体验上和真正的 Waline 没什么差别

## 回顾

AI 真香～ 评论区正式开张，欢迎在下面留言测试～
