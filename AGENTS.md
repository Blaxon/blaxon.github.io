# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Aider, Codex, etc.) working
in this repo. Humans should read `README.md` instead.

## What this is

A personal blog (Hugo static site) for xanderhang.com, deployed to GitHub
Pages via `.github/workflows/hugo.yml`. Content is Chinese (zh-cn).

Theme: [hugo-blog-awesome](https://github.com/hugo-sid/hugo-blog-awesome), a
plain SCSS + vanilla-JS theme (no Tailwind, no npm build step — Hugo Pipes
compiles the SCSS). Installed as a git submodule at `themes/hugo-blog-awesome`.

This was migrated in 2026-09 from a different, heavily-customized theme
(`hugo-minimal-black`, Tailwind-based). The migration approach was "full
port": adopt the new theme's base layout/CSS/dark-mode wholesale, but
re-implement the site's bespoke features as site-level overrides on top of
it, rather than dropping them. Know this going in, because several things
that look like "theme features" are actually ours:

- The 粉馆 (fenguan) game page at `/fenguan/` — entirely bespoke, unrelated
  to the theme. `content/fenguan.md` (`layout: "fenguan"`) →
  `layouts/_default/fenguan.html`, driven by `static/js/fenguan.js` and
  `data/fenguan/menu.yaml`. A site-wide satiety-decay script runs on every
  page via `assets/js/custom.js` (loaded through the theme's own
  `additionalScripts` param — see hugo.toml). Don't touch these without
  reading `static/js/fenguan.js` first; it's a small localStorage state
  machine shared between the page script and the decay script.
- Waline comments (`layouts/_partials/comments.html`) — the theme defaults
  to Disqus; we replaced that partial. The comment server is a custom
  Cloudflare Worker (`waline-on-worker.xanderhang.workers.dev`), not
  official Waline hosting.
- The homepage (`layouts/home.html` + `layouts/_partials/home/now.html`) —
  a plain-markdown "近况" (now) section plus a latest-posts list where the
  most recent post is expanded to a 5-line content preview
  (`.post-item--expanded` / `.post-item-preview` in `_custom.scss`). The
  theme's own `home.html` is a much simpler bio+post-list page; ours
  replaces it entirely.
- A decorative calligraphy image pinned to the homepage's bottom-right
  corner (`static/images/calligraphy-quote.png`, referenced only from
  `layouts/home.html` — Hugo's `home.html` template only ever renders the
  root `/`, so this can't leak onto other pages by construction).

## Setup

```bash
git submodule update --init --recursive   # required — themes/hugo-blog-awesome is empty otherwise
hugo server -D
```

Requires Hugo **extended** ≥ 0.160.0. No Node/npm needed.

Sanity-check a production build before considering any change done:

```bash
rm -rf public resources .hugo_build.lock
hugo --gc --minify
```

All three of those paths are gitignored; clean them between debugging
sessions if you suspect a stale asset-pipeline cache.

## Override mechanics (don't edit inside themes/)

Hugo lets the site's own `layouts/`, `assets/`, `static/` override the
theme's files at the same relative path. This repo relies on that
extensively — `themes/hugo-blog-awesome/` should never be edited directly
(it's a submodule pointing at an upstream repo).

- `layouts/_partials/*.html` — overrides `themes/hugo-blog-awesome/layouts/_partials/*.html`.
  Current overrides: `header.html` (adds site-name text next to the home
  icon), `comments.html` (Waline instead of Disqus), `postCard.html`
  (richer card: description, no category/tag badges, optional expanded
  preview), `toc.html` (only renders if there's an actual heading list —
  the theme's original always renders the box even when empty), `meta/post.html`
  (fixed to check `.Section "blog"` — see gotcha below).
- `assets/sass/_custom.scss` — the theme's `main.scss` ends with
  `@import "custom"`, so this file is auto-imported last and its plain
  selectors win by cascade order. All site-specific CSS lives here; there
  is no separate stylesheet to remember to link.
- `assets/js/theme.js` — overrides the theme's own dark/light toggle
  script. The site is now **permanently dark** (see below); this file
  forces the `dark` class and drops the toggle-button logic entirely
  rather than leaving a hidden/dead toggle around.
- `assets/js/custom.js` — loaded on every page via the theme's
  `additionalScripts` param; currently the fenguan satiety-decay script.
- `layouts/_default/baseof.html` and `layouts/home.html` — full
  overrides (not partials), because the base layout and homepage
  structure both changed significantly.

## Gotchas hit during the migration (read before you re-discover them)

1. **TOML `[params]` subtable ordering.** In `hugo.toml`, once you open a
   subtable header like `[params.author]`, every bare `key = value` line
   *after* it nests under `params.author`, not back under `[params]`.
   This silently broke `additionalScripts` for an entire session (Waline's
   dark-mode script + the fenguan decay script both stopped loading, no
   error, no warning). Keep every flat `params.*` key **before** any
   `[params.xxx]` sub-table, or nest deliberately.

2. **The theme's `class="page-content"` is used twice on the same page** —
   once on the outer `<main>` (single.html) and once on the inner
   `<div>` wrapping `.Content`. Its CSS rule
   `.page-content a[target="_blank"]::after { content: " ↗" }` therefore
   also matches links *inside the Waline comments widget*, since Waline
   renders inside that same outer `<main>`. Fixed by cancelling it back
   out with `.waline-wrapper a[target="_blank"]::after { content: none; }`
   in `_custom.scss`. If you add more content inside `<main class="page-content">`
   that isn't the article body, check for this kind of bleed-through.

3. **`meta/post.html` in the upstream theme hardcodes section name
   `"posts"`** for its OG/JSON-LD tags, but this site's blog section is
   `blog` (kept for URL/backlink stability — see `mainSections = ["blog"]`
   in hugo.toml). We override that partial to check `"blog"` instead.
   If you ever rename the section, update both the `mainSections` param
   and this partial.

4. **ffmpeg's `geq` filter has no `lum(X,Y)` function in RGB mode** (at
   least on ffmpeg 6.0) — it errors "Unknown function". Compute luma
   manually from `r(X,Y)`/`g(X,Y)`/`b(X,Y)` instead. Also: every literal
   comma inside a `geq` expression must be escaped as `\,` in the `-vf`
   string, including the comma inside `r(X,Y)` itself, or the filtergraph
   parser silently truncates the expression at that comma.

5. **The site is forced permanently dark.** `hugo.toml`'s `defaultColor =
   "dark"`, the light/dark toggle button is removed from
   `layouts/_partials/header.html`, and `assets/js/theme.js` unconditionally
   adds the `dark` class (ignoring localStorage/system preference). Both
   `layouts/_default/baseof.html` and `layouts/home.html` render
   `<html class="dark">` server-side too, so there's no flash and no-JS
   visitors still get dark mode via the theme's `_dark.scss`
   `prefers-color-scheme` fallback. If dark-mode-only is ever revisited,
   all four of these need to move together.

6. **Client-side search was deliberately dropped** — the theme has none,
   and the old bespoke search overlay was Tailwind/JS specific to the
   previous theme. Don't assume it still exists.

## Content conventions

- Posts: `content/blog/YYYY-MM-DD-slug.md`, front matter `title`, `date`,
  `draft`, optionally `description` (shown on post cards) and `category`
  (a single string, not a list — the postCard/meta partials assume this).
- `content/fenguan.md`, `content/about.md`, `content/uses.md` are
  standalone pages using the theme's generic `single.html` (except
  fenguan, which sets `layout: "fenguan"`).
- Icons: this theme ships ~80 built-in inline SVG icons
  (`themes/hugo-blog-awesome/layouts/_partials/svgs/svgs.html`) referenced
  by name via `[[params.socialIcons]]` in hugo.toml — no Font Awesome, no
  external icon CDN. Check that file for supported names before adding a
  new social link.

## Deployment

`.github/workflows/hugo.yml` builds with `HUGO_ENVIRONMENT: production`
(required for the GA snippet and JS/CSS fingerprinting to activate — both
are gated on `hugo.IsProduction`) and deploys via
`actions/deploy-pages@v4`. No Node setup step; removing it if it reappears
after a theme swap is *not* an accidental regression.
