---
layout: page
title: 目录
permalink: /categories/
---

{%- assign category_list = "知识与项目沉淀,兴趣与生活记录" | split: "," -%}
{%- for category in category_list -%}
<h2>{{ category }}</h2>
{%- assign posts = site.categories[category] -%}
{%- if posts and posts.size > 0 -%}
<ul class="post-list">
  {%- for post in posts -%}
  <li>
    <span class="post-meta">{{ post.date | date: "%Y-%m-%d" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
    </h3>
  </li>
  {%- endfor -%}
</ul>
{%- else -%}
<p><em>暂无内容</em></p>
{%- endif -%}
{%- endfor -%}
