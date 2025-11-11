前端代码规范（HTML / CSS / JavaScript）
来源说明

参考并裁剪自：

Google HTML/CSS Style Guide

Airbnb JavaScript Style Guide

WAI-ARIA / WCAG 2.1 可访问性建议

项目结构与命名

目录/文件采用 kebab-case：index.html, style.css, app.js, utils.js

资源分层：

StudentID_concacts_frontend/
├─ public/
│  ├─ index.html
│  ├─ style.css
│  └─ app.js
└─ assets/ (images, icons, fonts…)


模块职责清晰：app.js（启动/事件绑定/渲染）、api.js（fetch 封装）、dom.js（模板与渲染）

HTML 规范

语义化标签：header/main/section/form/table/button/input/label

可访问性（A11y）：

所有可交互元素使用 <button>，配 aria-label

表单控件配对 label[for] 与 id

图片需 alt；动态区域可使用 aria-live="polite"

表单校验：使用原生属性 required, type="email", maxlength，再配合 JS 二次校验

示例：

<form id="contact-form" aria-label="Input / Edit Contact">
  <label for="name">Name</label>
  <input id="name" name="name" required maxlength="100" />
  …
  <button type="submit">Save</button>
</form>

CSS 规范

采用 BEM 命名：.card, .card__title, .table__row--warn

主题变量：使用 :root 定义色彩/间距/圆角

尽量使用 Flex/Grid 布局；移动优先，适配断点 @media (min-width: 768px)

禁止内联样式；组件化样式分组，避免全局选择器污染

示例：

:root { --bg:#f7f8fb; --card:#fff; --text:#1f2937; --radius:12px; }
.card { background:var(--card); border-radius:var(--radius); box-shadow:0 6px 16px rgba(0,0,0,.06); }
.btn { padding:.5rem .9rem; border-radius:10px; }
.btn--danger { background:#ef4444; color:#fff; }

JavaScript 规范

使用 ES Modules：type="module"；const/let 代替 var

命名：函数/变量 camelCase，常量 SCREAMING_SNAKE_CASE

单一职责：UI 渲染、状态管理、网络请求分文件

事件绑定事件委托优先，减少大量监听

防抖/节流用于输入搜索与窗口尺寸变更

示例（模块与错误处理）：

// api.js
export async function fetchJSON(url, { method='GET', body } = {}) {
  const opts = { method, headers:{ 'Content-Type':'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text() || res.statusText);
  return res.status === 204 ? null : res.json();
}

状态与渲染

只在单一“源状态”（state.cache）上做读写；渲染由状态驱动

先服务端筛选，再前端关键词过滤；渲染使用字符串模板 + innerHTML 或 DocumentFragment

列表更新使用“整表重渲染”或“行级差量更新”，保持一致性

示例（事件委托 + 行操作）：

tableBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  if (btn.dataset.act === 'delete') {
    if (confirm('Confirm to delete?')) { await apiDelete(id); await refresh(); }
  }
});

表单与校验

前端基础校验（必填/格式/长度），后端权威校验

手机号在前端进行归一化（去空格/短横/括号/点）再提交

错误展示：字段附近 inline message + 顶部 toast

示例：

const normalizePhone = (s) => String(s||'').trim().replace(/[\s\-().]/g, '');

可用性与交互

按钮禁用态防重复提交：提交时 disabled = true，完成后还原

关键操作（删除/拉黑）二次确认

保存成功后主动刷新列表；额外设置5s 轮询兜底

空状态与加载状态占位；错误使用 toast 明确提示

性能与安全

避免不必要的重排/重绘，批量 DOM 更新使用片段

跨域：所有请求走同一 BASE_URL，后端配置 CORS（含 PATCH）

不在前端硬编码敏感信息（密钥、库密码等）

输入内容一律作为文本渲染（textContent），避免 XSS

Git 与提交

采用 Conventional Commits：feat:, fix:, refactor:, docs:

变更点小步提交；每次提交通过自测（新增/编辑/删除/拉黑/筛选/搜索）

代码示例（最小启动）
<!-- index.html -->
<script type="module">
  import { fetchJSON } from './api.js';
  const form = document.querySelector('#contact-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // 校验与归一化…
    await fetchJSON('/api/contacts', { method:'POST', body:{ /* … */ } });
    // 刷新与提示…
  });
</script>
